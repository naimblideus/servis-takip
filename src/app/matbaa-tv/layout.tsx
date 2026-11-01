import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { LocaleProvider } from '@/lib/i18n/client';
import { dilMi } from '@/lib/i18n/sozluk';
import { paraBirimiMi, VARSAYILAN_BIRIM } from '@/lib/bicim';
import { hesapTuru } from '@/lib/menu-aileleri';
import { matbaaMetni } from '@/lib/matbaa-metin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${matbaaMetni(await sunucuDili()).tvBaslik} · Nextus Servis` };
}

/**
 * MATBAA TV PANOSU — panel düzeninin DIŞINDA, tam ekran (canlı pano gibi).
 * Panel düzeninin kapıları burada da: kilitli bayi /dashboard'a gider
 * (kilit ekranı orada); bayi hesabı kendi paneline döner.
 */
/** Askıda, pasif, deneme ya da abonelik süresi dolmuş (panel düzeniyle aynı kural). */
function kilitliMi(t: { isActive: boolean; isSuspended: boolean; plan: string; trialEndsAt: Date | null; planEndDate: Date | null }) {
  const simdi = Date.now();
  return t.isActive === false || t.isSuspended
    || (t.plan === 'trial' && !!t.trialEndsAt && t.trialEndsAt.getTime() < simdi)
    || (!!t.planEndDate && t.planEndDate.getTime() < simdi);
}

export default async function MatbaaTvLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?next=/matbaa-tv');
  const tenantId = (session.user as { tenantId?: string } | undefined)?.tenantId;
  const [tenant, ayar] = await Promise.all([
    tenantId
      ? prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { locale: true, currency: true, country: true, plan: true, isActive: true, isSuspended: true, trialEndsAt: true, planEndDate: true, hesapTuru: true },
        })
      : Promise.resolve(null),
    prisma.platformSettings.findFirst({ select: { maintenanceMode: true } }).catch(() => null),
  ]);
  if (!tenant) redirect('/login?hata=oturum-bayat');
  if (kilitliMi(tenant) || ayar?.maintenanceMode || hesapTuru(tenant.hesapTuru) !== 'MATBAA') redirect('/dashboard');

  const kullaniciId = (session.user as { id?: string } | undefined)?.id;
  const kullanici = kullaniciId
    ? await prisma.user.findUnique({ where: { id: kullaniciId }, select: { locale: true } }).catch(() => null)
    : null;
  const dil = await sunucuDili(kullanici?.locale, tenant.locale);
  const birim = paraBirimiMi(tenant.currency) ? tenant.currency : VARSAYILAN_BIRIM;
  return (
    <LocaleProvider dil={dil} birim={birim} ulke={tenant.country ?? 'TR'} bayiDili={dilMi(tenant.locale) ? tenant.locale : dil}>
      {children}
    </LocaleProvider>
  );
}
