import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
  });

  const devices = await prisma.device.findMany({
    where: { tenantId: user!.tenantId },
    include: { customer: true, serviceTickets: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });

  const activeTab = tab || 'all';
  const filtered = activeTab === 'rental' ? devices.filter(d => d.isRental) :
    activeTab === 'normal' ? devices.filter(d => !d.isRental) : devices;

  const rentalCount = devices.filter(d => d.isRental).length;
  const normalCount = devices.filter(d => !d.isRental).length;

  const tabs = [
    { key: 'all', label: 'Tümü', count: devices.length },
    { key: 'rental', label: '🏷️ Kiralık', count: rentalCount },
    { key: 'normal', label: 'Normal', count: normalCount },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Cihazlar</h1>
          <p style={{ color: '#6b7280' }}>Toplam {devices.length} cihaz ({rentalCount} kiralık)</p>
        </div>
        <Link href="/devices/new" style={{
          backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500'
        }}>+ Yeni Cihaz</Link>
      </div>

      {/* Tab Filtre */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', backgroundColor: '#f3f4f6', padding: '0.25rem', borderRadius: '0.5rem', width: 'fit-content' }}>
        {tabs.map(t => (
          <Link key={t.key} href={`/devices?tab=${t.key}`} style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '500',
            textDecoration: 'none', transition: 'all 0.15s',
            backgroundColor: activeTab === t.key ? 'white' : 'transparent',
            color: activeTab === t.key ? '#1f2937' : '#6b7280',
            boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Marka / Model', 'Seri No', 'Müşteri', 'Konum', activeTab !== 'normal' ? 'Kira' : '', 'Son Fiş', ''].filter(Boolean).map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{d.brand}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{d.model}</div>
                    </div>
                    {d.isRental && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '9999px', whiteSpace: 'nowrap' }}>KİRALIK</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>{d.serialNo}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{d.customer.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{d.location || '-'}</td>
                {activeTab !== 'normal' && (
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                    {d.isRental ? (
                      <span style={{ fontWeight: '600', color: '#059669' }}>₺{Number(d.monthlyRent).toFixed(0)}/ay</span>
                    ) : '-'}
                  </td>
                )}
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {d.serviceTickets[0] ? new Date(d.serviceTickets[0].createdAt).toLocaleDateString('tr-TR') : '-'}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/devices/${d.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>Detay →</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                {activeTab === 'rental' ? 'Kiralık cihaz yok' : activeTab === 'normal' ? 'Normal cihaz yok' : 'Henüz cihaz yok'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}