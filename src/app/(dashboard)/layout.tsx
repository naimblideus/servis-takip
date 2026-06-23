import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { effectiveModules } from '@/lib/modules';
import Sidebar from '@/components/Sidebar';
import ModuleGuard from '@/components/ModuleGuard';
import AccessLock from '@/components/AccessLock';
import Onboarding from '@/components/Onboarding';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  // Tenant durumu + modüller + platform bakım ayarı — her gezinmede taze (askıya alma anında etkili)
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  const [tenant, settings] = await Promise.all([
    tenantId
      ? prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true, modules: true, marketEnabled: true, isActive: true, isSuspended: true, suspendReason: true, trialEndsAt: true, planEndDate: true },
        })
      : Promise.resolve(null),
    prisma.platformSettings.findFirst({ select: { maintenanceMode: true, contactEmail: true } }).catch(() => null),
  ]);

  // 1) Bakım modu — tüm tenant kullanıcıları
  if (settings?.maintenanceMode) {
    return <AccessLock title="Bakımdayız" message="Sistem kısa süreli bakımda. Lütfen birazdan tekrar deneyin." contactEmail={settings?.contactEmail} showLogout={false} />;
  }

  // 2) Abonelik kilidi — askıya alındı / deneme bitti / süre doldu / pasif
  if (tenant) {
    const now = Date.now();
    const trialExpired = tenant.plan === 'trial' && tenant.trialEndsAt && new Date(tenant.trialEndsAt).getTime() < now;
    const planExpired = !!tenant.planEndDate && new Date(tenant.planEndDate).getTime() < now;
    if (tenant.isActive === false || tenant.isSuspended || trialExpired || planExpired) {
      const reason = tenant.isSuspended
        ? (tenant.suspendReason || 'Aboneliğiniz askıya alındı.')
        : trialExpired ? 'Deneme süreniz doldu.'
          : planExpired ? 'Abonelik süreniz doldu.'
            : 'Hesabınız şu an pasif durumda.';
      return <AccessLock title="Erişim Kapalı" message={`${reason} Devam etmek için lütfen bizimle iletişime geçin.`} contactEmail={settings?.contactEmail} />;
    }
  }

  const modules = tenant ? Array.from(effectiveModules(tenant)) : [];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar modules={modules} />
      <main id="app-main" className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
        <ModuleGuard modules={modules}>{children}</ModuleGuard>
      </main>
      <Onboarding />
    </div>
  );
}
