import { randomUUID } from 'crypto';
import { faturaAdi, faturaEksikleri, faturaYolu, vergiKimlikTuru, type FaturaMusterisi } from '@/lib/fatura-kimlik';

/**
 * e-BELGE — entegratöre gidecek kanonik fatura nesnesi.
 *
 * ── NEDEN BU DOSYA ───────────────────────────────────────────────────────
 * "UBL'e çevirip entegratöre göndermek" cümlesindeki UBL'i biz yazmıyoruz:
 * özel entegratör JSON alıp UBL-TR XML'ini kendisi üretiyor, mali mühürle
 * kendisi imzalıyor, GİB'e kendisi gönderiyor. Bize düşen DOĞRU VERİYİ
 * hazırlamak. Bu dosya o veriyi üretiyor ve eksikse üretmeyi REDDEDİYOR.
 *
 * Entegratöre özel HİÇBİR ŞEY burada yok — alan adları, kimlik kuralları ve
 * toplamlar hangi entegratör seçilirse seçilsin aynı. Seçim yapılınca
 * yazılacak tek şey bu nesneyi o firmanın alan adlarına çeviren uyarlayıcı.
 *
 * ── EN PAHALI HATA ───────────────────────────────────────────────────────
 * Defterdeki tutarla belgedeki tutarın AYRIŞMASI. Müşteriye resmî olarak
 * bizim takip ettiğimizden başka bir rakam gitmiş olur ve bunu ne bayi ne
 * müşteri fark eder — ikisi de kendi kâğıdına bakar. Bu yüzden belge
 * üretilirken kalem toplamları, KDV ve genel toplam faturayla KARŞILAŞTIRILIP
 * tutmuyorsa belge üretilmiyor.
 */

// ── TİPLER ───────────────────────────────────────────────────────────────

export type BelgeSaticisi = {
  name: string;
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  email?: string | null;
  eFaturaEtiket?: string | null;
};

export type BelgeSatiri = {
  aciklama: string;
  miktar: number;
  birimFiyat: number;
  tutar: number;
  /** null ise faturanın genel oranı kullanılır. */
  kdvOrani: number | null;
};

export type BelgeFaturasi = {
  invoiceNumber: string;
  ettn?: string | null;
  gibNo?: string | null;
  invoiceDate: Date;
  senaryo?: string | null;
  faturaTipi?: string | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string | null;
};

export type Senaryo = 'TEMELFATURA' | 'EARSIVFATURA';
/**
 * Belgenin gönderim durumu.
 *
 * GONDERILIYOR ara durumu ÇİFT FATURAYI önlüyor: gönderim başlarken
 * yazılıyor, eş zamanlı ikinci bir istek onu görüp geri dönüyor.
 * KABUL ve RED nihai — o belgeye bir daha dokunulmuyor.
 */
export type BelgeDurumu =
  | 'HAZIR'
  | 'GONDERILIYOR'
  | 'GONDERILDI'
  | 'KABUL'
  | 'RED'
  | 'HATA'
  | 'ESKI_SISTEM';

/**
 * Göçte aktarılan geçmiş fatura: eski sistemde ZATEN kesildi, bir daha
 * gönderilmeyecek. e-Fatura Hazırlığı ekranı bu durumdakileri
 * gönderilecekler listesinden çıkarıyor — görünselerdi bayi onları da
 * hazırlamaya çalışır, gönderirse müşteriye ikinci kez fatura giderdi.
 */
export const ESKI_SISTEM: BelgeDurumu = 'ESKI_SISTEM';

const yuvarla = (n: number) => Math.round(n * 100) / 100;

// ── KİMLİK ───────────────────────────────────────────────────────────────

/** Belgenin evrensel tekil numarası. Her belgeye BİR kez üretilir. */
export function ettnUret(): string {
  return randomUUID();
}

/**
 * Faturanın hangi senaryoyla gideceği:
 *   alıcı mükellef  → TEMELFATURA (sistem üzerinden)
 *   alıcı mükellef değil → EARSIVFATURA (kendisine iletilir)
 *   sorulmamış      → null, belge üretilmez
 *
 * null'ı e-Arşiv saymıyoruz: mükellef çıkarsa yanlış belge kesilmiş olur ve
 * yanlış belge, belge olmamasından daha kötüdür.
 */
export function belgeSenaryosu(m: { eInvoiceUser?: boolean | null }): Senaryo | null {
  // Kural TEK YERDE: faturaYolu(). Burada `if (eInvoiceUser === true)`
  // diye ikinci bir kopya yazsaydık, biri değişip diğeri kalabilirdi —
  // ve o an müşteri ekranında e-Arşiv, belgede e-Fatura yazardı.
  const yol = faturaYolu(m);
  if (yol === 'e-Fatura') return 'TEMELFATURA';
  if (yol === 'e-Arşiv') return 'EARSIVFATURA';
  return null;
}

/**
 * GİB belge numarası: 3 harf + 4 hane yıl + 9 hane sıra (NXS2026000000001).
 *
 * Sıra YIL BAZINDA ve boşluksuz ilerliyor. `sonSira`/`sonYil` bayinin son
 * durumu; dönen `sira`/`yil` yazılacak yeni durum. Yıl döndüğünde 1'den
 * başlıyor — bu bir tercih değil, numaranın içinde yıl var.
 */
export function gibNumarasiUret(
  onEk: string | null | undefined,
  yil: number,
  sonSira: number,
  sonYil: number | null | undefined,
): { no: string; sira: number; yil: number } {
  const e = (onEk ?? '').toLocaleUpperCase('tr-TR').replace(/[^A-Z]/g, '');
  if (e.length !== 3) throw new Error('e-Fatura ön eki tam 3 harf olmalı (GİB\'e kayıtlı ön ek)');
  if (!Number.isInteger(yil) || yil < 2000 || yil > 2999) throw new Error('Yıl 4 haneli olmalı');
  const sira = sonYil === yil ? sonSira + 1 : 1;
  if (sira > 999999999) throw new Error('Yıllık belge sırası doldu (999.999.999)');
  return { no: `${e}${yil}${String(sira).padStart(9, '0')}`, sira, yil };
}

// ── EKSİK KONTROLÜ ───────────────────────────────────────────────────────

/** Satıcı tarafında eksik olanlar — bayi Ayarlar'dan doldurur. */
export function saticiEksikleri(s: BelgeSaticisi): string[] {
  const eksik: string[] = [];
  if (!(s.name ?? '').trim()) eksik.push('Bayi adı yok');
  if (vergiKimlikTuru(s.taxNumber) === null) eksik.push('Bayi vergi numarası yok ya da hatalı');
  if (!(s.taxOffice ?? '').trim()) eksik.push('Bayi vergi dairesi yok');
  if (!(s.address ?? '').trim()) eksik.push('Bayi adresi yok');
  if (!(s.city ?? '').trim()) eksik.push('Bayi ili yok');
  if (!(s.district ?? '').trim()) eksik.push('Bayi ilçesi yok');
  if (!(s.eFaturaEtiket ?? '').trim()) eksik.push('e-Fatura ön eki/etiketi tanımlı değil (Ayarlar → e-Fatura)');
  return eksik;
}

/**
 * Belge üretilebilir mi? Üretilemiyorsa NE eksik?
 * Alıcı eksikleri lib/fatura-kimlik.ts'ten geliyor — müşteri formundaki
 * liste ile birebir aynı olsun diye; iki ayrı liste iki farklı cevap verirdi.
 */
export function belgeEksikleri(
  satici: BelgeSaticisi,
  alici: FaturaMusterisi,
  fatura: Pick<BelgeFaturasi, 'totalAmount'>,
  satirlar: BelgeSatiri[],
): string[] {
  const eksik = [
    ...saticiEksikleri(satici).map((x) => `Satıcı: ${x}`),
    ...faturaEksikleri(alici).map((x) => `Alıcı: ${x}`),
  ];
  if (!satirlar.length) eksik.push('Faturada hiç kalem yok');
  // Sıfır tutarlı belge göndermenin anlamı yok ve çoğu entegratör reddeder.
  if (!(fatura.totalAmount > 0)) eksik.push('Fatura tutarı sıfır');
  return eksik;
}

// ── BELGE ────────────────────────────────────────────────────────────────

export type EBelge = {
  senaryo: Senaryo;
  faturaTipi: 'SATIS';
  ettn: string;
  gibNo: string;
  tarih: string;          // yyyy-aa-gg
  paraBirimi: 'TRY';
  satici: {
    unvan: string; vkn: string; vergiDairesi: string;
    adres: string; il: string; ilce: string;
    telefon: string; eposta: string; etiket: string;
  };
  alici: {
    unvan: string;
    kimlikTuru: 'VKN' | 'TCKN';
    kimlikNo: string;
    vergiDairesi: string;
    adres: string; il: string; ilce: string;
    eposta: string;
  };
  satirlar: {
    sira: number; aciklama: string; miktar: number; birim: 'C62';
    birimFiyat: number; tutar: number; kdvOrani: number; kdvTutari: number;
  }[];
  /** UBL'de KDV oran oran ayrışır — TaxSubtotal başına bir satır. */
  kdvOzeti: { oran: number; matrah: number; tutar: number }[];
  toplamlar: { matrah: number; kdv: number; genelToplam: number };
  not: string | null;
};

/**
 * Kanonik belgeyi üretir. Eksik varsa ÜRETMEZ — hata fırlatır.
 *
 * `ettn` ve `gibNo` çağıran tarafından veriliyor: bir belgeye bir kez
 * atanır ve veritabanına yazılır. Burada üretseydik her çağrıda başka bir
 * numara çıkar, aynı fatura iki farklı belge numarasıyla gönderilebilirdi.
 */
export function eBelgeUret(args: {
  satici: BelgeSaticisi;
  alici: FaturaMusterisi;
  fatura: BelgeFaturasi;
  satirlar: BelgeSatiri[];
  ettn: string;
  gibNo: string;
}): EBelge {
  const { satici, alici, fatura, satirlar, ettn, gibNo } = args;

  const eksik = belgeEksikleri(satici, alici, fatura, satirlar);
  if (eksik.length) {
    throw new Error(`Belge üretilemedi — eksik bilgi:\n· ${eksik.join('\n· ')}`);
  }
  const senaryo = belgeSenaryosu(alici);
  if (!senaryo) throw new Error('Alıcının e-Fatura mükellefliği sorgulanmamış — senaryo belirlenemiyor');

  const kimlikTuru = vergiKimlikTuru(alici.taxNo);
  if (!kimlikTuru) throw new Error('Alıcı vergi/TC kimlik numarası hatalı');

  // ── KDV: oran oran ayrıştır ────────────────────────────────────────────
  // Tek oran varsa matrah bütün olarak hesaplanıyor; böylece faturanın
  // kendi hesabıyla kuruşu kuruşuna aynı çıkıyor. Birden çok oran varsa
  // her oran ayrı yuvarlanıyor (UBL'in beklediği biçim).
  const genelOran = Number(fatura.vatRate);
  const gruplar = new Map<number, number>();
  for (const s of satirlar) {
    const oran = s.kdvOrani === null || s.kdvOrani === undefined ? genelOran : Number(s.kdvOrani);
    gruplar.set(oran, yuvarla((gruplar.get(oran) ?? 0) + Number(s.tutar)));
  }
  const kdvOzeti = [...gruplar.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([oran, matrah]) => ({ oran, matrah, tutar: yuvarla((matrah * oran) / 100) }));

  const matrahToplam = yuvarla(kdvOzeti.reduce((t, x) => t + x.matrah, 0));
  const kdvToplam = yuvarla(kdvOzeti.reduce((t, x) => t + x.tutar, 0));
  const genelToplam = yuvarla(matrahToplam + kdvToplam);

  // ── DEFTER İLE BELGE AYRIŞMASIN ────────────────────────────────────────
  // Bu üç kontrol olmadan, müşteriye resmî olarak bizim takip ettiğimizden
  // başka bir rakam gidebilir ve kimse fark etmez.
  const fark = (a: number, b: number) => Math.abs(yuvarla(a) - yuvarla(b));
  if (fark(matrahToplam, Number(fatura.subtotal)) > 0.001) {
    throw new Error(`Kalem toplamı faturanın matrahıyla tutmuyor (kalemler ${matrahToplam}, fatura ${Number(fatura.subtotal)})`);
  }
  if (fark(kdvToplam, Number(fatura.vatAmount)) > 0.001) {
    throw new Error(`Hesaplanan KDV faturadakiyle tutmuyor (belge ${kdvToplam}, fatura ${Number(fatura.vatAmount)})`);
  }
  if (fark(genelToplam, Number(fatura.totalAmount)) > 0.001) {
    throw new Error(`Genel toplam faturadakiyle tutmuyor (belge ${genelToplam}, fatura ${Number(fatura.totalAmount)})`);
  }

  const g = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    senaryo,
    faturaTipi: 'SATIS',
    ettn,
    gibNo,
    tarih: g(fatura.invoiceDate),
    paraBirimi: 'TRY',
    satici: {
      unvan: satici.name,
      vkn: (satici.taxNumber ?? '').replace(/\D/g, ''),
      vergiDairesi: (satici.taxOffice ?? '').trim(),
      adres: (satici.address ?? '').trim(),
      il: (satici.city ?? '').trim(),
      ilce: (satici.district ?? '').trim(),
      telefon: (satici.phone ?? '').trim(),
      eposta: (satici.email ?? '').trim(),
      etiket: (satici.eFaturaEtiket ?? '').trim(),
    },
    alici: {
      unvan: faturaAdi(alici),
      kimlikTuru,
      kimlikNo: (alici.taxNo ?? '').replace(/\D/g, ''),
      vergiDairesi: (alici.taxOffice ?? '').trim(),
      adres: (alici.address ?? '').trim(),
      il: (alici.city ?? '').trim(),
      ilce: (alici.district ?? '').trim(),
      eposta: (alici.email ?? '').trim(),
    },
    satirlar: satirlar.map((s, i) => {
      const oran = s.kdvOrani === null || s.kdvOrani === undefined ? genelOran : Number(s.kdvOrani);
      return {
        sira: i + 1,
        aciklama: s.aciklama,
        miktar: Number(s.miktar),
        birim: 'C62', // UN/ECE birim kodu: adet
        birimFiyat: Number(s.birimFiyat),
        tutar: yuvarla(Number(s.tutar)),
        kdvOrani: oran,
        kdvTutari: yuvarla((Number(s.tutar) * oran) / 100),
      };
    }),
    kdvOzeti,
    toplamlar: { matrah: matrahToplam, kdv: kdvToplam, genelToplam },
    not: (fatura.notes ?? '').trim() || null,
  };
}
