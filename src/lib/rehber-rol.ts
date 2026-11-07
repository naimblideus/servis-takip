/**
 * İLK GİRİŞ — ROL BAZLI ADIMLAR (saf; metinler sözlükte: t.rehber.ekip).
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * İlk giriş rehberi herkese aynıydı: teknisyen "müşteri ekle, fatura kes,
 * tahsilat al" listesini görüyordu. Bu ekranların hiçbiri teknisyen menüsünde
 * yok (menu-aileleri → TEKNISYEN_MENUSU); düğmeye basan kapalı sayfaya
 * düşüyordu. Uzaktan kurulumda teknisyeni ilk dakikada kaybetmek demek.
 *
 * Teknisyen ve ön büro artık kendi üç işini görür. Yönetici (sahip) bugünkü
 * listede kalır: o liste bayinin kurulumunu VERİDEN sayar (ilk müşteri, ilk
 * fatura...). Buradaki adımlar KİŞİSEL: kişi ekranı bir kez açınca tamam.
 * Bu bir öğrenme listesi, kurulum ölçüsü değil; kurulum ölçüsü kurulum.ts'te.
 *
 * Her adresin o role açık olduğunu scripts/test-onboarding-rol.mjs denetler.
 */

export type EkipRolu = 'TECHNICIAN' | 'FRONT_DESK';

/** href null: ekran değil, eylem (telefona kurmak). */
export type RolAdimi = { key: string; icon: string; href: string | null };

export const ROL_ADIMLARI: Readonly<Record<EkipRolu, readonly RolAdimi[]>> = {
  TECHNICIAN: [
    { key: 'telefon', icon: '📱', href: null },
    { key: 'islerim', icon: '🧾', href: '/tickets' },
    { key: 'sayac', icon: '🔢', href: '/sayac-turu' },
  ],
  FRONT_DESK: [
    { key: 'musteri', icon: '👤', href: '/customers' },
    { key: 'fis', icon: '🧾', href: '/tickets/new' },
    { key: 'takip', icon: '📋', href: '/tickets' },
  ],
};

/** Rehberi kişiye göre olan rol; yönetici ve bilinmeyen rol null (bugünkü liste). */
export function ekipRolu(rol: unknown): EkipRolu | null {
  return rol === 'TECHNICIAN' || rol === 'FRONT_DESK' ? rol : null;
}

/** Tarayıcıda kişiye özel anahtar: aynı tarayıcıyı paylaşan iki kişi karışmasın. */
export function ekipAdimAnahtari(userId: string): string {
  return `gs_ekip_adim_v1:${userId}`;
}

/**
 * Bu yol hangi adımı tamamlar? En uzun eşleşen adres kazanır: ön büroda
 * "/tickets/new" Fiş aç'ı, "/tickets" Fişleri takip et'i tamamlar.
 */
export function yolunAdimi(rol: EkipRolu, yol: string): string | null {
  let enIyi: RolAdimi | null = null;
  for (const a of ROL_ADIMLARI[rol]) {
    if (!a.href) continue;
    const eslesir = yol === a.href || yol.startsWith(`${a.href}/`);
    if (eslesir && (!enIyi || a.href.length > (enIyi.href?.length ?? 0))) enIyi = a;
  }
  return enIyi?.key ?? null;
}

/** Adım tamam mı: ekran adımı bir kez açılınca; telefon adımı uygulama kuruluysa. */
export function adimTamam(adim: RolAdimi, acilanlar: ReadonlySet<string>, kurulu: boolean): boolean {
  return adim.href === null ? kurulu : acilanlar.has(adim.key);
}
