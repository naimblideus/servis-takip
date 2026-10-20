/**
 * SORUN BİLDİR — saf kurallar (veritabanı yok, test edilir: scripts/test-sorun.mjs).
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Sahadaki kurulum ekibi ve bayi kullanıcısı bir takılmayı gördüğü AN
 * bildirmezse o gözlem kaybolur: WhatsApp'ta bir cümle, aklında bir not,
 * bir hafta sonra "neydi o?". Bildirim 30 saniyede bitmeli, bağlam (sayfa,
 * ekran, rol) kendiliğinden eklenmeli. Ekip haftada bir ayıklar: rehbere
 * yazılacak (BILGI_EKSIGI), düzeltilecek (HATA), istenen (ISTEK).
 *
 * Bu dosyada yalnız kural var: doğrulama, adres ayıklama, ayıklama
 * geçişleri, istek sınırı, CSV satırı, WhatsApp bağlantısı. Veritabanı işi
 * sorun-veri.ts'te.
 */

export const SORUN_TURLERI = ['DURDURUYOR', 'YAVASLATIYOR', 'ONERI'] as const;
export type SorunTuru = (typeof SORUN_TURLERI)[number];

export const SORUN_DURUMLARI = ['YENI', 'INCELENIYOR', 'COZULDU', 'KAPANDI'] as const;
export type SorunDurumu = (typeof SORUN_DURUMLARI)[number];

export const SORUN_KUTULARI = ['BILGI_EKSIGI', 'HATA', 'ISTEK'] as const;
export type SorunKutusu = (typeof SORUN_KUTULARI)[number];

export const turMu = (x: unknown): x is SorunTuru => SORUN_TURLERI.includes(x as SorunTuru);
export const durumMu = (x: unknown): x is SorunDurumu => SORUN_DURUMLARI.includes(x as SorunDurumu);
export const kutuMu = (x: unknown): x is SorunKutusu => SORUN_KUTULARI.includes(x as SorunKutusu);

/** "Ne oldu?" sınırları. 5'in altı "olmadı" gibi bir şeydir, ayıklanamaz. */
export const NE_OLDU_EN_AZ = 5;
export const METIN_EN_COK = 2000;
export const NOT_EN_COK = 2000;

/**
 * Ekran görüntüsü üst sınırı: data URL KARAKTER sayısı. İstemci 1280 px /
 * JPEG 0.7'ye küçültüyor; tipik sonuç 100–300 KB. ~1 MB ikili veri base64'te
 * ~1,37 milyon karakter eder. Sınır sunucuda da var: istemciyi atlayan biri
 * veritabanına megabaytlar yazamasın.
 */
export const EKRAN_EN_COK_KARAKTER = 1_400_000;
/** İstemcinin küçültme hedefi — iki taraf aynı sayıyı görsün diye burada. */
export const EKRAN_EN_UZUN_KENAR = 1280;
export const EKRAN_JPEG_KALITE = 0.7;

/** İstek sınırı: kullanıcı başına saatte 10, bayi başına günde 50. */
export const SINIR_KULLANICI_SAAT = 10;
export const SINIR_BAYI_GUN = 50;

/**
 * Adresten ayıklanan sorgu parametreleri. Bildirim süper admin'de okunur ve
 * CSV ile Notion'a aktarılır; şifre sıfırlama jetonu, davet kodu ya da bir
 * API anahtarı orada durmamalı. Ad küçük harfe çevrilip KARŞILAŞTIRILIR;
 * ayrıca adında bu köklerden biri geçen her parametre de atılır
 * (resetToken, api_key, sifreYeni…).
 */
const HASSAS_TAM = new Set(['t', 'k', 'kod', 'code', 'otp', 'pin', 'sig', 'signature', 'state', 'nonce']);
const HASSAS_KOK = ['token', 'sifre', 'şifre', 'password', 'passwd', 'pass', 'key', 'anahtar', 'secret', 'gizli', 'auth', 'session', 'oturum', 'jwt', 'hash', 'iban', 'kart', 'card'];

export function hassasParametreMi(ad: string): boolean {
  const k = ad.toLowerCase();
  if (HASSAS_TAM.has(k)) return true;
  return HASSAS_KOK.some((kok) => k.includes(kok));
}

/**
 * Sayfa adresini saklanabilir hâle getirir: yalnız yol + güvenli sorgu.
 * Alan adı ve parça (#...) atılır — bilgi taşımaz, parça bazen jeton taşır.
 * Geçersiz girdide null.
 */
export function sayfaAyikla(adres: unknown): string | null {
  if (typeof adres !== 'string' || !adres.trim()) return null;
  let u: URL;
  try {
    u = new URL(adres.trim(), 'http://yerel.invalid');
  } catch {
    return null;
  }
  const temiz = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (!hassasParametreMi(k)) temiz.append(k, v);
  const q = temiz.toString();
  return (u.pathname + (q ? `?${q}` : '')).slice(0, 500);
}

/** "375x812" biçimi; değilse null. */
export function ekranAyikla(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  return /^\d{2,5}x\d{2,5}$/.test(s) ? s : null;
}

/** Kullanıcı aracısı: tek satır, 200 karakter — ayıklamaya yeter. */
export function tarayiciAyikla(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
  return s || null;
}

const metin = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

export type SorunHataKodu =
  | 'SORUN_TUR_GECERSIZ'
  | 'SORUN_METIN_KISA'
  | 'SORUN_METIN_UZUN'
  | 'SORUN_EKRAN_GECERSIZ'
  | 'SORUN_EKRAN_BUYUK';

export interface SorunGirdisi {
  tur: SorunTuru;
  neYapiyordu: string | null;
  neOldu: string;
  sayfa: string | null;
  ekran: string | null;
  tarayici: string | null;
  ekranGoruntusu: string | null;
}

/**
 * Bildirimi doğrular. Bağlam alanları (sayfa, ekran, tarayıcı) hatalıysa
 * bildirim REDDEDİLMEZ, alan boş bırakılır: gözlemi kaybetmek, bağlamın
 * eksik olmasından kötüdür. Reddedilen yalnız kullanıcının düzeltebileceği
 * şeyler: tür, metin, görüntü.
 */
export function sorunDogrula(g: Record<string, unknown> | null | undefined):
  | { ok: true; veri: SorunGirdisi }
  | { ok: false; kod: SorunHataKodu } {
  const b = g ?? {};
  if (!turMu(b.tur)) return { ok: false, kod: 'SORUN_TUR_GECERSIZ' };
  const neOldu = metin(b.neOldu);
  if (neOldu.length < NE_OLDU_EN_AZ) return { ok: false, kod: 'SORUN_METIN_KISA' };
  const neYapiyordu = metin(b.neYapiyordu);
  if (neOldu.length > METIN_EN_COK || neYapiyordu.length > METIN_EN_COK) return { ok: false, kod: 'SORUN_METIN_UZUN' };

  let ekranGoruntusu: string | null = null;
  if (b.ekranGoruntusu !== undefined && b.ekranGoruntusu !== null && b.ekranGoruntusu !== '') {
    if (typeof b.ekranGoruntusu !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(b.ekranGoruntusu)) {
      return { ok: false, kod: 'SORUN_EKRAN_GECERSIZ' };
    }
    if (b.ekranGoruntusu.length > EKRAN_EN_COK_KARAKTER) return { ok: false, kod: 'SORUN_EKRAN_BUYUK' };
    ekranGoruntusu = b.ekranGoruntusu;
  }

  return {
    ok: true,
    veri: {
      tur: b.tur,
      neYapiyordu: neYapiyordu || null,
      neOldu,
      sayfa: sayfaAyikla(b.sayfa),
      ekran: ekranAyikla(b.ekran),
      tarayici: tarayiciAyikla(b.tarayici),
      ekranGoruntusu,
    },
  };
}

/**
 * İstek sınırı. Sınır işlevi dışarıdan verilir (rate-limit.ts'in rateLimit'i):
 * test aynı kuralı gerçek sayaçla dener. Önce kullanıcı sınırı bakılır; o
 * aşıldıysa bayi sayacı ARTMAZ — tek bir kullanıcının ısrarı ekip
 * arkadaşlarının günlük hakkını yemesin.
 */
export function sorunSiniri(
  sinir: (anahtar: string, adet: number, pencereMs: number) => { ok: boolean; retryAfter: number },
  kullaniciId: string,
  tenantId: string,
): { ok: boolean; retryAfter: number } {
  const k = sinir(`sorun:k:${kullaniciId}`, SINIR_KULLANICI_SAAT, 3_600_000);
  if (!k.ok) return k;
  return sinir(`sorun:b:${tenantId}`, SINIR_BAYI_GUN, 86_400_000);
}

/**
 * Kim neyi görür (ürün tarafı): yönetici bayinin bütün bildirimlerini,
 * diğerleri yalnız kendisininkini. Bayi süzgeci HER ZAMAN var.
 */
export function listeKapsami(user: { id: string; tenantId: string; role?: string | null }) {
  const yonetici = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  return yonetici ? { tenantId: user.tenantId } : { tenantId: user.tenantId, kullaniciId: user.id };
}

/** Müşteriye görünen durum: iç ayrıntı (KAPANDI ile COZULDU farkı) dışarı çıkmaz. */
export type GorunenDurum = 'ALINDI' | 'INCELENIYOR' | 'COZULDU';
export function gorunenDurum(d: string): GorunenDurum {
  if (d === 'INCELENIYOR') return 'INCELENIYOR';
  if (d === 'COZULDU' || d === 'KAPANDI') return 'COZULDU';
  return 'ALINDI';
}

export type AyiklamaHataKodu = 'SORUN_DURUM_GECERSIZ' | 'SORUN_KUTU_GECERSIZ' | 'SORUN_NOT_UZUN' | 'SORUN_BILDIRIM_COZULMEDEN';

/**
 * Süper admin ayıklaması: gelen gövdeden veritabanı güncellemesini kurar.
 *
 * Geçişler:
 *  · COZULDU'ya geçince cozulduAt şimdi (zaten çözülmüşse dokunulmaz).
 *  · YENI/INCELENIYOR'a geri dönünce (yeniden açıldı) cozulduAt ve
 *    bildirildiAt silinir: "yapıldı" denmiş iş yeniden açıldıysa müşteriye
 *    bir daha söylenmesi gerekir.
 *  · KAPANDI (yapılmayacak / tekrar) cozulduAt'a dokunmaz.
 *  · "Müşteriye bildirildi" YALNIZ sonuçtaki durum COZULDU iken.
 *  · kutu null gönderilirse temizlenir.
 */
export function ayiklamaKur(
  mevcut: { durum: string; cozulduAt: Date | null; bildirildiAt: Date | null },
  govde: Record<string, unknown> | null | undefined,
  simdi: Date,
): { ok: true; data: Record<string, unknown> } | { ok: false; kod: AyiklamaHataKodu } {
  const b = govde ?? {};
  const data: Record<string, unknown> = {};
  let durum = mevcut.durum;

  if (b.durum !== undefined) {
    if (!durumMu(b.durum)) return { ok: false, kod: 'SORUN_DURUM_GECERSIZ' };
    if (b.durum !== mevcut.durum) {
      data.durum = b.durum;
      if (b.durum === 'COZULDU') data.cozulduAt = simdi;
      if (b.durum === 'YENI' || b.durum === 'INCELENIYOR') {
        data.cozulduAt = null;
        data.bildirildiAt = null;
      }
    }
    durum = b.durum;
  }

  if (b.kutu !== undefined) {
    if (b.kutu !== null && b.kutu !== '' && !kutuMu(b.kutu)) return { ok: false, kod: 'SORUN_KUTU_GECERSIZ' };
    data.kutu = b.kutu || null;
  }

  if (b.yoneticiNotu !== undefined) {
    const n = typeof b.yoneticiNotu === 'string' ? b.yoneticiNotu.trim() : '';
    if (n.length > NOT_EN_COK) return { ok: false, kod: 'SORUN_NOT_UZUN' };
    data.yoneticiNotu = n || null;
  }

  if (b.bildirildi !== undefined) {
    if (b.bildirildi === true) {
      if (durum !== 'COZULDU') return { ok: false, kod: 'SORUN_BILDIRIM_COZULMEDEN' };
      if (!mevcut.bildirildiAt) data.bildirildiAt = simdi;
    } else {
      data.bildirildiAt = null;
    }
  }

  return { ok: true, data };
}

/** Süper admin süzgeçleri (?durum ?kutu ?tur ?bayi ?demo=1). Demo varsayılan HARİÇ. */
export function suzgecKur(sp: { get(k: string): string | null }) {
  const where: Record<string, unknown> = {};
  const durum = sp.get('durum');
  const kutu = sp.get('kutu');
  const tur = sp.get('tur');
  const bayi = (sp.get('bayi') ?? '').trim();
  if (durumMu(durum)) where.durum = durum;
  if (kutu === 'YOK') where.kutu = null;
  else if (kutuMu(kutu)) where.kutu = kutu;
  if (turMu(tur)) where.tur = tur;
  if (bayi) where.tenantId = bayi.slice(0, 64);
  if (sp.get('demo') !== '1') where.demo = false;
  return where;
}

/** CSV sütunları — anahtar sırası sabit; başlık metni sorun-metin.ts'ten. */
export const CSV_SUTUNLARI = [
  'tarih', 'bayi', 'kullanici', 'rol', 'tur', 'durum', 'kutu', 'neYapiyordu', 'neOldu',
  'sayfa', 'ekran', 'tarayici', 'ekranVar', 'yoneticiNotu', 'cozulduAt', 'bildirildiAt', 'demo', 'id',
] as const;

export interface CsvKaydi {
  id: string; createdAt: Date; bayi: string; kullaniciAd: string | null; rol: string | null; tur: string;
  durum: string; kutu: string | null; neYapiyordu: string | null; neOldu: string; sayfa: string | null;
  ekran: string | null; tarayici: string | null; ekranVar: boolean; yoneticiNotu: string | null;
  cozulduAt: Date | null; bildirildiAt: Date | null; demo: boolean;
}

const zaman = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '');
/** Formül sanılmasın: = + - @ ile başlayan kullanıcı metninin başına kesme. */
const formulsuz = (s: string | null) => (s && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s ?? '');

/**
 * CSV satırı. GÖRÜNTÜ GİRMEZ (yalnız var/yok): CSV Notion'a ve e-postaya
 * gider, müşterinin ekranı orada durmamalı.
 */
export function csvSatiri(k: CsvKaydi, evet: string, hayir: string): string[] {
  return [
    zaman(k.createdAt), formulsuz(k.bayi), formulsuz(k.kullaniciAd), k.rol ?? '', k.tur, k.durum, k.kutu ?? '',
    formulsuz(k.neYapiyordu), formulsuz(k.neOldu), k.sayfa ?? '', k.ekran ?? '', formulsuz(k.tarayici),
    k.ekranVar ? evet : hayir, formulsuz(k.yoneticiNotu), zaman(k.cozulduAt), zaman(k.bildirildiAt),
    k.demo ? evet : hayir, k.id,
  ];
}

/** Cep telefonuna hazır mesajlı wa.me bağlantısı; sabit hat ya da boşsa null. */
export function waBaglantisi(telefon: string | null | undefined, mesaj: string): string | null {
  if (!telefon) return null;
  let d = telefon.replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  if (!/^905\d{9}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(mesaj)}`;
}
