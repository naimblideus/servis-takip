/**
 * EKİP HESAPLARI — giriş adı.
 *
 * Teknik ekip kısa adla girer: "teknik3" ya da teknisyen olarak
 * "teknik3-teknisyen". Kısa ad yalnız bu kalıpta tam adrese açılır
 * (teknik3@nextusservis.com); başka hiçbir giriş değişmez. Saf: veritabanına
 * dokunmaz.
 *
 * Aynı ad iki yerde geçer: bayi girişinde örnek veriyle dolu test bayisi
 * (scripts/seed-bayi-demo.mjs, EKIP_TEST_SIFRE) ve süper admin girişinde
 * "Ekip" yetkili hesap (Süper Admin → Ekip Hesapları'nda bu adresle açılır).
 * Eski ad "testN" 2026-10-31'de "teknikN" oldu; canlıda hesap kurulmamıştı.
 */
const KISA_AD = /^teknik([1-9]|1[0-9]|20)(-teknisyen)?$/;

export function girisAdiniCoz(girilen: string): string {
  const s = girilen.trim().toLowerCase().slice(0, 200);
  return KISA_AD.test(s) ? `${s}@nextusservis.com` : s;
}
