// ═══════════════════════════════════════
// SQL DUMP PARSER - Eski sistemden veri aktarma
// MySqlBackup.NET formatı için optimize edildi
// ═══════════════════════════════════════

// ── TypeScript Interface'ler ──

export interface MySQLMusteri {
    ID: number;
    Musteri: string;
    Yetkili?: string;
    Adres?: string;
    ilce?: string;
    il?: string;
    Tel?: string;
    Gsm?: string;
    Mail?: string;
    Tarih?: string;
}

export interface MySQLServis {
    ID: number;
    ServisNo: number;
    MusteriID?: number;
    BelgeNo?: string;
    FisTarih?: string;
    islemdurumu?: string;
    Teknisyen?: string;
    TeslimTarih?: string;
    BildirimTarih?: string;
    OnayTarih?: string;
    FisNot?: string;
    Cihaz?: string;
    Marka?: string;
    SeriNo?: string;
    Aksesuar?: string;
    Ariza?: string;
    Rapor?: string;
    Tahsilat?: string;
    isk?: string;
    GToplam?: string;
    Bakim?: string;
}

export interface MySQLServisUrun {
    ID: number;
    ServisNo: number;
    Sira?: number;
    UrunKod?: string;
    UrunAd?: string;
    Adet?: number;
    Maliyet?: string;
    Fiyat?: string;
    indirim?: string;
    Tarih?: string;
    Grup?: string;
}

export interface MySQLUrun {
    ID: number;
    UrunKod?: string;
    UrunAd?: string;
    Marka?: string;
    Stok?: number;
    AlisFiyat?: string;
    SatisFiyat?: string;
    Barkod?: string;
}

export interface MySQLKasa {
    ID: number;
    Tarih?: string;
    Saat?: string;
    Tur?: string;
    Aciklama?: string;
    GelirTutar?: string;
    GiderTutar?: string;
}

export interface MySQLFirma {
    ID: number;
    Firma?: string;
    Adres?: string;
    Tel?: string;
    Fax?: string;
    Gsm?: string;
    Email?: string;
    Web?: string;
}

export type TicketStatus = 'NEW' | 'IN_SERVICE' | 'WAITING_FOR_PART' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface ParsedDump {
    musteriler: MySQLMusteri[];
    servisler: MySQLServis[];
    servisurunler: MySQLServisUrun[];
    urunler: MySQLUrun[];
    kasa: MySQLKasa[];
    firma: MySQLFirma | null;
}

// ═══════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════

/**
 * UTF-8 Türkçe karakter düzeltme
 */
export function fixEncoding(str: string): string {
    if (!str) return '';
    return str
        .replace(/Ã¼/g, 'ü').replace(/Ã¶/g, 'ö').replace(/Ã§/g, 'ç')
        .replace(/Ä±/g, 'ı').replace(/Ã¤/g, 'ğ').replace(/ÅŸ/g, 'ş')
        .replace(/Äž/g, 'Ğ').replace(/Åž/g, 'Ş')
        .replace(/Ä°/g, 'İ').replace(/Ã‡/g, 'Ç').replace(/Ã–/g, 'Ö')
        .replace(/Ãœ/g, 'Ü')
        .trim();
}

/**
 * Türk telefon formatını temizle
 * "(274) 223-62-06" → "02742236206"
 * "(   )    -  -" → null (boş)
 * "0x7e4cc22" gibi hex değerler → null
 */
export function cleanPhone(raw: string | null | undefined): string | null {
    if (!raw || raw.trim() === '') return null;
    const trimmed = raw.trim();

    // Boş parantez formatları: "(   )    -  -" → null
    if (/^\(\s*\)\s*[-\s]*$/.test(trimmed)) return null;

    // Hex değerleri reddet: 0x... formatı
    if (/^0x/i.test(trimmed)) return null;

    // Sadece rakamları al
    const digits = trimmed.replace(/\D/g, '');

    // Çok kısa veya sıfır → geçersiz
    if (digits.length < 7) return null;

    // Sadece sıfırlardan oluşan → geçersiz  
    if (/^0+$/.test(digits)) return null;

    // Türk mobil: 5XX ile başlayan 10 haneli
    if (digits.length === 10 && digits.startsWith('5')) return '0' + digits;

    // 0 ile başlayan 11 haneli → doğrudan
    if (digits.length === 11 && digits.startsWith('0')) return digits;

    // 10 haneli (şehir kodu dahil, 0 yok)
    if (digits.length === 10) return '0' + digits;

    // 11 haneli (0 başlıyor, genel kural)
    if (digits.length === 11) return digits;

    // Diğer uzunluklar: 7-9 ve 12+
    // 12+ → büyük ihtimalle ülke kodu var, son 10/11 hanesi al
    if (digits.length >= 12) {
        const last11 = digits.slice(-11);
        if (last11.startsWith('0')) return last11;
        const last10 = digits.slice(-10);
        return '0' + last10;
    }

    // 7-9 hane: geçerli sayı olarak sakla
    return digits;
}

/**
 * Boş telefon tespiti
 */
export function isEmptyPhone(raw: string | null | undefined): boolean {
    if (!raw) return true;
    const digits = raw.replace(/\D/g, '');
    return digits.length < 7;
}

/**
 * Türk para formatını parse et
 * "2.000,00" → 2000.00
 * "750.00" → 750.00 (MySQL decimal formatı)
 */
export function parseTurkishDecimal(raw: string | null | undefined): number {
    if (!raw || raw.trim() === '') return 0;
    const trimmed = raw.trim();
    if (!/[\d]/.test(trimmed)) return 0;

    // MySQL'den gelen decimal: "750.00" → nokta ondalık ayırıcı
    // Türk formatı: "2.000,00" → virgül ondalık ayırıcı
    if (trimmed.includes(',')) {
        // Türk formatı: binlik ayırıcı nokta, ondalık virgül
        const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    } else {
        // MySQL decimal veya düz sayı
        const num = parseFloat(trimmed);
        return isNaN(num) ? 0 : num;
    }
}

/**
 * Karışık tarih formatlarını parse et
 * "2025-03-08 00:00:00" → Date
 * "08.03.2025" → Date
 * "0000-00-00 00:00:00" → null
 */
export function parseDate(raw: string | null | undefined): Date | null {
    if (!raw || raw.trim() === '') return null;
    const s = raw.trim();

    if (s.startsWith('0000-00-00') || s === '0000-00-00') return null;

    if (s.includes('-') && s.length >= 10) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;
    }

    if (s.includes('.') && !s.includes('-')) {
        const parts = s.split('.');
        if (parts.length >= 3) {
            const [day, month, year] = parts;
            if (day && month && year) {
                const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
                if (!isNaN(d.getTime())) return d;
            }
        }
    }

    const fallback = new Date(s);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * islemdurumu → TicketStatus dönüşümü
 */
export function mapStatus(raw: string | null | undefined): TicketStatus {
    if (!raw) return 'NEW';
    const s = raw.toLowerCase().trim();
    if (s.includes('teslim')) return 'DELIVERED';
    if (s.includes('bakım') || s.includes('bakim') || s.includes('servis')) return 'IN_SERVICE';
    if (s.includes('iptal')) return 'CANCELLED';
    if (s.includes('hazır') || s.includes('hazir')) return 'READY';
    if (s.includes('parça') || s.includes('parca') || s.includes('bekleme')) return 'WAITING_FOR_PART';
    return 'NEW';
}

/**
 * Sayaç/Numaratör formatlarını parse et
 * - "343551" → {black: 343551, color: 0}
 * - "BK:84047\r\nC:53756" → {black: 84047, color: 53756}
 * - "MONO:297.012\r\nCOLOR:202.703" → {black: 297012, color: 202703}
 * - "BK : 9217\r\nC  : 21055" → {black: 9217, color: 21055}
 * - "MONO:100.539\r\nCOLOR:371.407" → {black: 100539, color: 371407}
 * - "BK:168132\r\nC:175596" → {black: 168132, color: 175596}
 */
export function parseCounter(raw: string | null | undefined): { black: number; color: number } {
    if (!raw || raw.trim() === '') return { black: 0, color: 0 };
    const s = raw.trim();

    let black = 0;
    let color = 0;

    // BK/MONO/SB satırı (siyah)
    const blackMatch = s.match(/(?:BK|MONO|SB)\s*[:=]\s*([\d.,\s]+)/i);
    if (blackMatch) {
        black = parseInt(blackMatch[1].replace(/[.\s,]/g, '')) || 0;
    }

    // Renkli sayaç: COLOR: veya satır/kelime sınırında C: formatı
    // Örnek: "BK:84047\r\nC:53756" veya "COLOR:202.703"
    const colorMatch = s.match(/(?:COLOR|(?:^|\r?\n|\s)C)\s*[:=]\s*([\d.,\s]+)/im);
    if (colorMatch) {
        color = parseInt(colorMatch[1].replace(/[.\s,]/g, '')) || 0;
    }

    // Eğer BK/MONO paterni yoksa, sadece düz sayı ise siyah olarak al
    if (!blackMatch && !colorMatch) {
        const plainNum = s.replace(/[.\s,]/g, '');
        if (/^\d+$/.test(plainNum)) {
            black = parseInt(plainNum) || 0;
        }
    }

    return { black, color };
}

// ═══════════════════════════════════════
// CORE SQL PARSER
// ═══════════════════════════════════════

/**
 * SQL değerini parse eder (tırnak kaldırır, NULL → null, escape düzeltir)
 */
function parseSQLValue(val: string): string | null {
    const trimmed = val.trim();
    if (trimmed.toUpperCase() === 'NULL') return null;

    // Tek tırnaklı string
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1)
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/''/g, "'");
    }

    // Tırnaksız sayı veya değer
    return trimmed;
}

/**
 * Bir VALUES içindeki token'ları karakteri karakteri parse eder.
 * String içeriğini, kaçış karakterlerini ve iç içe parantezleri doğru işler.
 * Sonuç: [['v1','v2',...], ['v1','v2',...], ...]
 */
function parseValuesTokens(valuesStr: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    const len = valuesStr.length;

    while (i < len) {
        // Satır başı: '(' bul
        while (i < len && valuesStr[i] !== '(') i++;
        if (i >= len) break;
        i++; // '(' geç

        const values: string[] = [];
        let current = '';
        let inString = false;
        let stringChar = '';
        let depth = 1;

        while (i < len && depth > 0) {
            const ch = valuesStr[i];

            if (inString) {
                if (ch === '\\') {
                    // Escape karakter - sonraki karakteri de al
                    current += ch;
                    i++;
                    if (i < len) current += valuesStr[i];
                } else if (ch === stringChar) {
                    // Çift-tırnak escape: '' → '
                    if (i + 1 < len && valuesStr[i + 1] === stringChar) {
                        current += ch + ch;
                        i++;
                    } else {
                        inString = false;
                        current += ch;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === "'" || ch === '"') {
                    inString = true;
                    stringChar = ch;
                    current += ch;
                } else if (ch === '(') {
                    depth++;
                    current += ch;
                } else if (ch === ')') {
                    depth--;
                    if (depth === 0) {
                        values.push(parseSQLValue(current.trim()) ?? '');
                        current = '';
                    } else {
                        current += ch;
                    }
                } else if (ch === ',' && depth === 1) {
                    values.push(parseSQLValue(current.trim()) ?? '');
                    current = '';
                } else {
                    current += ch;
                }
            }
            i++;
        }

        if (values.length > 0) {
            rows.push(values);
        }
    }

    return rows;
}

/**
 * INSERT INTO satırından sütun adlarını çıkarır.
 * `INSERT INTO \`tablo\`(\`Kol1\`,\`Kol2\`,...) VALUES`
 * → ['Kol1', 'Kol2', ...]
 */
function extractColumnNames(insertLine: string): string[] {
    // (\`col1\`,\`col2\`,...) VALUES kısmını bul
    const colMatch = insertLine.match(/INSERT\s+INTO\s+`?\w+`?\s*\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) return [];
    return colMatch[1]
        .split(',')
        .map(c => c.replace(/`/g, '').trim());
}

/**
 * Satır değerlerini sütun adlarına göre bir nesneye dönüştürür.
 */
function rowToObject(columns: string[], values: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = values[i] ?? '';
    }
    return obj;
}

/**
 * Ana SQL dump parser.
 * MySqlBackup.NET ve benzeri formatları destekler.
 * INSERT INTO `tablo`(`col1`,`col2`) VALUES (...),(...)
 */
export function parseSQLDump(sqlContent: string): ParsedDump {
    const result: ParsedDump = {
        musteriler: [],
        servisler: [],
        servisurunler: [],
        urunler: [],
        kasa: [],
        firma: null,
    };

    // SQL'i satırlara böl
    const lines = sqlContent.split('\n');

    // INSERT satırlarını birleştir (çok satırlı olabilir)
    const insertLines: string[] = [];
    let buffer = '';

    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, ''); // Windows CRLF

        // Yorum satırları ve boş satırları atla
        if (line.trim().startsWith('--') || line.trim().startsWith('/*') || line.trim() === '') {
            if (buffer === '') continue;
        }

        // SET, DROP, CREATE, ALTER, LOCK, UNLOCK, /*!...*/ komutlarını atla
        const t = line.trim();
        if (buffer === '' && (
            t.startsWith('SET ') || t.startsWith('DROP ') || t.startsWith('CREATE ') ||
            t.startsWith('ALTER ') || t.startsWith('LOCK ') || t.startsWith('UNLOCK ') ||
            t.startsWith('/*!') || t.startsWith('USE ')
        )) {
            continue;
        }

        if (/^INSERT\s+INTO/i.test(t)) {
            if (buffer !== '') insertLines.push(buffer);
            buffer = line;
        } else if (buffer !== '') {
            buffer += ' ' + line;
        }

        if (buffer !== '' && t.endsWith(';')) {
            insertLines.push(buffer);
            buffer = '';
        }
    }
    if (buffer !== '') insertLines.push(buffer);

    // Her INSERT satırını parse et
    for (const insertLine of insertLines) {
        // Tablo adını tespit et
        const tableMatch = insertLine.match(/INSERT\s+INTO\s+`?(\w+)`?\s*\(/i);
        if (!tableMatch) continue;
        const tableName = tableMatch[1].toLowerCase();

        // Sadece ilgilendiğimiz tablolar
        if (!['musteriler', 'servisler', 'servisurunler', 'urunler', 'kasa', 'firma'].includes(tableName)) {
            continue;
        }

        // Sütun adlarını çıkar
        const columns = extractColumnNames(insertLine);
        if (columns.length === 0) continue;

        // VALUES kısmını bul
        const valuesMatch = insertLine.match(/VALUES\s*(\([\s\S]*)/i);
        if (!valuesMatch) continue;
        const valuesStr = valuesMatch[1].replace(/;?\s*$/, ''); // Sondaki ; kaldır

        // Satırları parse et
        const rows = parseValuesTokens(valuesStr);

        // Her satırı ilgili interface'e dönüştür
        for (const row of rows) {
            const obj = rowToObject(columns, row);

            switch (tableName) {
                case 'musteriler':
                    result.musteriler.push({
                        ID: parseInt(obj['ID']) || 0,
                        Musteri: fixEncoding(obj['Musteri'] || ''),
                        Yetkili: fixEncoding(obj['Yetkili'] || ''),
                        Adres: fixEncoding(obj['Adres'] || ''),
                        ilce: fixEncoding(obj['ilce'] || ''),
                        il: fixEncoding(obj['il'] || ''),
                        Tel: obj['Tel'] || '',
                        Gsm: obj['Gsm'] || '',
                        Mail: obj['Mail'] || '',
                        Tarih: obj['Tarih'] || '',
                    });
                    break;

                case 'servisler':
                    result.servisler.push({
                        ID: parseInt(obj['ID']) || 0,
                        ServisNo: parseInt(obj['ServisNo']) || 0,
                        MusteriID: parseInt(obj['MusteriID']) || undefined,
                        BelgeNo: obj['BelgeNo'] || '',
                        FisTarih: obj['FisTarih'] || '',
                        islemdurumu: fixEncoding(obj['islemdurumu'] || ''),
                        Teknisyen: fixEncoding(obj['Teknisyen'] || ''),
                        TeslimTarih: obj['TeslimTarih'] || '',
                        BildirimTarih: obj['BildirimTarih'] || '',
                        OnayTarih: obj['OnayTarih'] || '',
                        FisNot: fixEncoding(obj['FisNot'] || ''),
                        Cihaz: fixEncoding(obj['Cihaz'] || ''),
                        Marka: fixEncoding(obj['Marka'] || ''),
                        SeriNo: obj['SeriNo'] || '',
                        Aksesuar: fixEncoding(obj['Aksesuar'] || ''),
                        Ariza: fixEncoding(obj['Ariza'] || ''),
                        Rapor: fixEncoding(obj['Rapor'] || ''),
                        Tahsilat: obj['Tahsilat'] || '',
                        isk: obj['isk'] || '',
                        GToplam: obj['GToplam'] || '',
                        Bakim: obj['Bakim'] || '',
                    });
                    break;

                case 'servisurunler':
                    result.servisurunler.push({
                        ID: parseInt(obj['ID']) || 0,
                        ServisNo: parseInt(obj['ServisNo']) || 0,
                        Sira: parseInt(obj['Sira']) || 0,
                        UrunKod: obj['UrunKod'] || '',
                        UrunAd: fixEncoding(obj['UrunAd'] || ''),
                        Adet: parseInt(obj['Adet']) || 1,
                        Maliyet: obj['Maliyet'] || '',
                        Fiyat: obj['Fiyat'] || '',
                        indirim: obj['indirim'] || '',
                        Tarih: obj['Tarih'] || '',
                        Grup: fixEncoding(obj['Grup'] || ''),
                    });
                    break;

                case 'urunler':
                    result.urunler.push({
                        ID: parseInt(obj['ID']) || 0,
                        UrunKod: obj['UrunKod'] || '',
                        UrunAd: fixEncoding(obj['UrunAd'] || ''),
                        Marka: fixEncoding(obj['Marka'] || ''),
                        Stok: parseInt(obj['Stok']) || 0,
                        AlisFiyat: obj['AlisFiyat'] || '',
                        SatisFiyat: obj['SatisFiyat'] || '',
                        Barkod: obj['Barkod'] || '',
                    });
                    break;

                case 'kasa':
                    result.kasa.push({
                        ID: parseInt(obj['ID']) || 0,
                        Tarih: obj['Tarih'] || '',
                        Saat: obj['Saat'] || '',
                        Tur: fixEncoding(obj['Tur'] || ''),
                        Aciklama: fixEncoding(obj['Aciklama'] || ''),
                        GelirTutar: obj['GelirTutar'] || '',
                        GiderTutar: obj['GiderTutar'] || '',
                    });
                    break;

                case 'firma':
                    // Sadece ilk firma kaydını al
                    if (!result.firma) {
                        result.firma = {
                            ID: parseInt(obj['ID']) || 0,
                            Firma: fixEncoding(obj['Firma'] || ''),
                            Adres: fixEncoding(obj['Adres'] || ''),
                            Tel: obj['Tel'] || '',
                            Fax: obj['Fax'] || '',
                            Gsm: obj['Gsm'] || '',
                            Email: obj['Email'] || '',
                            Web: obj['Web'] || '',
                        };
                    }
                    break;
            }
        }
    }

    return result;
}
