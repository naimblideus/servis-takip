import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import TicketFilters from '@/components/TicketFilters';

const statusLabel: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Yeni', color: '#fef3c7' },
  IN_SERVICE: { label: 'Serviste', color: '#dbeafe' },
  WAITING_FOR_PART: { label: 'Parça Bkl.', color: '#fce7f3' },
  READY: { label: 'Hazır', color: '#d1fae5' },
  DELIVERED: { label: 'Teslim', color: '#f0fdf4' },
  CANCELLED: { label: 'İptal', color: '#f3f4f6' },
};

const priorityLabel: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Düşük', color: '#6b7280' },
  NORMAL: { label: 'Normal', color: '#3b82f6' },
  HIGH: { label: 'Yüksek', color: '#f59e0b' },
  URGENT: { label: 'Acil', color: '#ef4444' },
};

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

      {/* Tablo */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['Fiş No', 'Müşteri / Cihaz', 'Arıza', 'Durum', 'Öncelik', 'Teknisyen', 'Tarih', ''].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t, i) => {
              const st = statusLabel[t.status] ?? { label: t.status, color: '#f3f4f6' };
              const pr = priorityLabel[t.priority] ?? { label: t.priority, color: '#6b7280' };
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: '600' }}>
                    <Link href={`/tickets/${t.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{t.ticketNumber}</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t.device.customer.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t.device.brand} {t.device.model}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ backgroundColor: st.color, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ color: pr.color, fontSize: '0.8rem', fontWeight: '600' }}>{pr.label}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.assignedUser?.name ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/tickets/${t.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Detay →</Link>
                      <Link href={`/tickets/${t.id}/print`} style={{ color: '#6b7280', fontSize: '0.8rem', textDecoration: 'none' }} target="_blank">🖨️</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                {hasFilter ? 'Bu filtreye uyan fiş yok' : 'Henüz servis fişi yok'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}