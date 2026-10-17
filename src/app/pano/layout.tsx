import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { LocaleProvider } from '@/lib/i18n/client';
import { dilMi, sozluk } from '@/lib/i18n/sozluk';
import { paraBirimiMi, VARSAYILAN_BIRIM } from '@/lib/bicim';

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${sozluk(await sunucuDili()).canliPano.baslik} · Nextus Servis` };
}

/**
 * CANLI PANO — panel düzeninin DIŞINDA (yan menü yok, tam ekran).
 *
 * Panel düzeninin kapıları burada da geçerli olmalı; yoksa askıya alınmış
 * bayinin televizyonu çalışmaya devam ederdi. Kilit ekranını İKİNCİ kez
 * yazmıyoruz: kilitli bayi /dashboard'a gönderilir, kilit ekranı (ödeme
 * bilgisiyle birlikte) orada tek yerden çizilir.
 */
export default async function PanoLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?next=/pano');

  const tenantId = (session.user as { tenantId?: string } | undefined)?.tenantId;
  const [tenant, ayar] = await Promise.all([
    tenantId
      ? prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { locale: true, currency: true, country: true, plan: true, isActive: true, isSuspended: true, trialEndsAt: true, planEndDate: true },
        })
      : Promise.resolve(null),
    prisma.platformSettings.findFirst({ select: { maintenanceMode: true } }).catch(() => null),
  ]);
  if (!tenant) redirect('/login?hata=oturum-bayat');

  const simdi = Date.now();
  const kilitli = tenant.isActive === false || tenant.isSuspended
    || (tenant.plan === 'trial' && !!tenant.trialEndsAt && tenant.trialEndsAt.getTime() < simdi)
    || (!!tenant.planEndDate && tenant.planEndDate.getTime() < simdi);
  if (kilitli || ayar?.maintenanceMode) redirect('/dashboard');

  const kullaniciId = (session.user as { id?: string } | undefined)?.id;
  const kullanici = kullaniciId
    ? await prisma.user.findUnique({ where: { id: kullaniciId }, select: { locale: true } }).catch(() => null)
    : null;
  const dil = await sunucuDili(kullanici?.locale, tenant.locale);
  const birim = paraBirimiMi(tenant.currency) ? tenant.currency : VARSAYILAN_BIRIM;
  const bayiDili = dilMi(tenant.locale) ? tenant.locale : dil;

  return (
    <LocaleProvider dil={dil} birim={birim} ulke={tenant.country ?? 'TR'} bayiDili={bayiDili}>
      {children}
    </LocaleProvider>
  );
}
