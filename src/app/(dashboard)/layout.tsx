import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main id="app-main" className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}