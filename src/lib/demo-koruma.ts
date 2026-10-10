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
 */
import { prisma } from '@/lib/prisma';

export async function demoBayiMi(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { demo: true } });
  return Boolean(t?.demo);
}
