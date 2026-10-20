/**
 * EKİP TEST HESAPLARI — giriş adı.
 *
 * Teknik ekip test hesabına (scripts/seed-bayi-demo.mjs, EKIP_TEST_SIFRE)
 * kısa adla girer: "test3" ya da teknisyen olarak "test3-teknisyen". Kısa ad
 * yalnız bu kalıpta tam adrese açılır (test3@nextusservis.com); başka hiçbir
 * giriş değişmez. Saf: veritabanına dokunmaz.
 */
const KISA_AD = /^test([1-9]|1[0-9]|20)(-teknisyen)?$/;

export function girisAdiniCoz(girilen: string): string {
  const s = girilen.trim().toLowerCase().slice(0, 200);
  return KISA_AD.test(s) ? `${s}@nextusservis.com` : s;
}
