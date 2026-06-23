import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { effectiveModules } from '@/lib/modules';
import Sidebar from '@/components/Sidebar';
import ModuleGuard from '@/components/ModuleGuard';
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

  // Bayinin EFEKTİF açık modüllerini taze çek (sidebar + sayfa kapısı için)
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  const tenant = tenantId
    ? await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, modules: true, marketEnabled: true } })
    : null;
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