/**
 * DEMO KORUMASI.
 *
 * Herkese açık demoyu (ana sayfadaki "Demoyu hemen dene") her ziyaretçi aynı
 * hesapla açıyor. Üç şey o hesapta kapalı:
 *   · Şifre, e-posta, 2FA ve kullanıcı kapatma: biri değiştirirse demo
 *     herkese kilitlenir (gece tazelemesine kadar).
 *   · Dışarıya SMS/WhatsApp: demo müşterilerinin uydurma numaraları gerçek
 *     birine ait olabilir; ziyaretçi de kendi yazdığı numaraya platformun
 *     hesabından mesaj attırabilirdi.
 *   · Tarayıcı anahtarı: bir ziyaretçinin ağındaki yazıcılar (IP, seri) öbür
 *     ziyaretçilere görünürdü. Yerine ücretsiz tarama önerilir.
 * Saha demoları (demo1–5) da aynı bayrağı taşır: aynı riskler orada da var.
 *
 * EKİP TEST HESABI (Tenant.ekipTest) da demo bayisidir: veri örnek, numaralar
 * uydurma. Ona yalnız DIŞARIYA MESAJ kapalıdır; şifre, tarayıcı, toplu işlem
 * gibi kısıtlar uygulanmaz — ekip o özellikleri denemek için orada.
 */
import { prisma } from '@/lib/prisma';

/** Demo kısıtları (şifre, 2FA, tarayıcı, toplu işlem) bu bayide geçerli mi. Ekip testinde hayır. */
export async function demoBayiMi(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { demo: true, ekipTest: true } });
  return Boolean(t?.demo && !t.ekipTest);
}

/**
 * Dışarıya SMS/WhatsApp kapalı mı. Her demo bayisinde, ekip testi DAHİL,
 * kapalı. Kapalıysa ekranın göstereceği hata kodunu döndürür: ekip test
 * hesabına "demoyu çok kişi kullanıyor" demek yanlış olurdu.
 */
export async function disariyaMesajKapali(tenantId: string | null | undefined): Promise<'DEMO_HESABINDA_KAPALI' | 'TEST_HESABINDA_MESAJ_KAPALI' | null> {
  if (!tenantId) return null;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { demo: true, ekipTest: true } });
  if (!t?.demo) return null;
  return t.ekipTest ? 'TEST_HESABINDA_MESAJ_KAPALI' : 'DEMO_HESABINDA_KAPALI';
}
