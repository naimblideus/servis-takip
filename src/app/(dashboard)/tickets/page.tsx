import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import TicketFilters from '@/components/TicketFilters';
import TicketTable from '@/components/TicketTable';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; assignedUserId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) redirect('/login');

  // Filtre koşulları
  const where: any = { tenantId: user.tenantId };
  if (sp.status) where.status = sp.status;
  if (sp.priority) where.priority = sp.priority;
  if (sp.assignedUserId) {
    where.assignedUserId = sp.assignedUserId === 'unassigned' ? null : sp.assignedUserId;
  }

  const [tickets, users] = await Promise.all([
    prisma.serviceTicket.findMany({
      where,
      include: {
        device: { include: { customer: true } },
        assignedUser: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const allCounts = await prisma.serviceTicket.groupBy({
    by: ['status'],
    where: { tenantId: user.tenantId },
    _count: true,
  });

  const open = allCounts.filter(c => ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'].includes(c.status)).reduce((s, c) => s + c._count, 0);
  const ready = allCounts.find(c => c.status === 'READY')?._count || 0;
  const total = allCounts.reduce((s, c) => s + c._count, 0);

  const hasFilter = !!(sp.status || sp.priority || sp.assignedUserId);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Servis Fişleri</h1>
          <p style={{ color: '#6b7280' }}>
            {hasFilter ? `Filtreli: ${tickets.length} fiş` : `Toplam ${total} fiş`}
          </p>
        </div>
        <Link href="/tickets/new" style={{
          backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500',
        }}>+ Yeni Fiş</Link>
      </div>

      {/* Stat Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Toplam', value: total, color: '#6b7280', href: '/tickets' },
          { label: 'Açık / Serviste', value: open, color: '#f59e0b', href: '/tickets?status=IN_SERVICE' },
          { label: 'Teslime Hazır', value: ready, color: '#10b981', href: '/tickets?status=READY' },
        ].map(c => (
          <Link key={c.label} href={c.href} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', textAlign: 'center', textDecoration: 'none' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Filtreler (Client Component) */}
      <TicketFilters currentStatus={sp.status} currentPriority={sp.priority} currentAssigned={sp.assignedUserId} users={users} />

      {/* Tablo — satıra tıklayınca detaya gider */}
      <TicketTable tickets={tickets as any} />
    </div>
  );
}