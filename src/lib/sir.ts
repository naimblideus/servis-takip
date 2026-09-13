import crypto from 'crypto';

/**
 * SIR SAKLAMA — entegratör parolası gibi geri okunması GEREKEN sırlar için.
 *
 * ── NEDEN ÖZET (HASH) DEĞİL ──────────────────────────────────────────────
 * Kullanıcı parolası hash'lenir çünkü geri okunması gerekmez. Entegratör
 * parolası her gönderimde o servise YOLLANACAK — geri okunabilmeli. Yani
 * bu bir şifreleme işi, özet işi değil.
 *
 * ── ANAHTAR YOKSA YAZMIYORUZ ─────────────────────────────────────────────
 * Anahtar tanımlı değilse sır KAYDEDİLMİYOR; düz metne DÜŞMÜYOR. Düz metin
 * yedeklere, loglara ve veritabanı dökümlerine sızar; "şimdilik böyle
 * kalsın" diye bırakılan düz parola en uzun yaşayan şeydir.
 *
 * AES-256-GCM: şifreleme + bütünlük birlikte. Kayıt sonradan kurcalanırsa
 * çözme BAŞARISIZ olur, sessizce yanlış parola üretmez.
 */

const ALGO = 'aes-256-gcm';
const ANAHTAR_DEGISKENI = 'SIR_ANAHTARI';

export class SirAnahtariYok extends Error {
  constructor() {
    super(
      `${ANAHTAR_DEGISKENI} tanımlı değil. Sır şifrelenemediği için KAYDEDİLMEDİ — `
      + 'düz metin olarak yazmıyoruz. 64 karakterlik onaltılık bir anahtar üretip '
      + '.env dosyasına ekleyin.',
    );
    this.name = 'SirAnahtariYok';
  }
}

/** Anahtar tanımlı mı? Ekranlar "önce anahtarı tanımlayın" diyebilsin diye. */
export function sirAnahtariVarMi(): boolean {
  return !!anahtarOku();
}

function anahtarOku(): Buffer | null {
  const ham = process.env[ANAHTAR_DEGISKENI];
  if (!ham) return null;
  const temiz = ham.trim();
  // 64 onaltılık karakter = 32 bayt. Kısa/uzun anahtarı "idare etmiyoruz":
  // sessizce zayıf bir anahtar türetmek, şifrelemeyi olduğundan güçlü
  // göstermek demek.
  if (!/^[0-9a-fA-F]{64}$/.test(temiz)) return null;
  return Buffer.from(temiz, 'hex');
}

/** Kurulumda kullanılacak anahtar üretir (yalnız yardımcı — kendisi saklamaz). */
export function sirAnahtariUret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Şifreler. Çıktı: "v1.<iv>.<etiket>.<şifreli>" — sürüm öneki ileride
 * algoritma değişirse eski kayıtların hâlâ okunabilmesi için.
 */
export function sirla(duzMetin: string): string {
  const anahtar = anahtarOku();
  if (!anahtar) throw new SirAnahtariYok();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, anahtar, iv);
  const sifreli = Buffer.concat([c.update(duzMetin, 'utf8'), c.final()]);
  const etiket = c.getAuthTag();
  return `v1.${iv.toString('base64')}.${etiket.toString('base64')}.${sifreli.toString('base64')}`;
}

/**
 * Çözer. Kayıt kurcalandıysa ya da anahtar değiştiyse `null` döner —
 * yanlış bir parola ÜRETMEZ. Yanlış parola ile gönderim denemek, hesabın
 * kilitlenmesine yol açar.
 */
export function sirCoz(saklanan: string | null | undefined): string | null {
  if (!saklanan) return null;
  const anahtar = anahtarOku();
  if (!anahtar) return null;
  const p = String(saklanan).split('.');
  if (p.length !== 4 || p[0] !== 'v1') return null;
  try {
    const d = crypto.createDecipheriv(ALGO, anahtar, Buffer.from(p[1], 'base64'));
    d.setAuthTag(Buffer.from(p[2], 'base64'));
    return Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8');
  } catch {
    // Bütünlük doğrulaması düştü: kayıt bozulmuş ya da anahtar değişmiş.
    return null;
  }
}

/** Ekranda gösterim: "••••1234" — parolanın kendisi asla dönmüyor. */
export function sirMaskesi(duzMetin: string | null | undefined): string | null {
  if (!duzMetin) return null;
  const s = String(duzMetin);
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
}
