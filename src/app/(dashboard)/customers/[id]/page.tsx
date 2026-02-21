import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import CustomerEditPanel from '@/components/CustomerEditPanel';
import CustomerCariPanel from '@/components/CustomerCariPanel';

const statusLabel: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Yeni', color: '#fef3c7' },
  IN_SERVICE: { label: 'Serviste', color: '#dbeafe' },
  WAITING_FOR_PART: { label: 'Parça Bkl.', color: '#fce7f3' },
  READY: { label: 'Hazır', color: '#d1fae5' },
  DELIVERED: { label: 'Teslim', color: '#f0fdf4' },
  CANCELLED: { label: 'İptal', color: '#f3f4f6' },
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      devices: {
        include: {
          serviceTickets: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!customer) redirect('/customers');

  const allTickets = customer.devices.flatMap(d => d.serviceTickets);

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/customers" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Müşteriler</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{customer.name}</h1>
          <CustomerEditPanel customer={{ id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, taxNo: customer.taxNo }} />
        </div>
      </div>

      {/* Müşteri Bilgileri */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>İletişim Bilgileri</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            ['Telefon', customer.phone],
            ['Adres', customer.address || '-'],
            ['Kayıt Tarihi', new Date(customer.createdAt).toLocaleDateString('tr-TR')],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280', display: 'block', fontSize: '0.75rem' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cihazlar */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600' }}>Cihazlar ({customer.devices.length})</h2>
          <Link href="/devices/new" style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.4rem 0.875rem',
            borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '500'
          }}>+ Yeni Cihaz</Link>
        </div>
        {customer.devices.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '1.5rem' }}>Henüz cihaz yok</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {customer.devices.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{d.brand} {d.model}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Seri: {d.serialNo} {d.location ? `· ${d.location}` : ''}</div>
                </div>
                <Link href={`/devices/${d.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Detay →</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Son Fişler */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600' }}>Son Servis Fişleri ({allTickets.length})</h2>
          <Link href="/tickets/new" style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.4rem 0.875rem',
            borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '500'
          }}>+ Yeni Fiş</Link>
        </div>
        {allTickets.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '1.5rem' }}>Henüz servis fişi yok</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {allTickets.map(t => {
              const st = statusLabel[t.status] ?? { label: t.status, color: '#f3f4f6' };
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem', fontFamily: 'monospace' }}>{t.ticketNumber}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ backgroundColor: st.color, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>{st.label}</span>
                    <Link href={`/tickets/${t.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Detay →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cari Hesap */}
      <CustomerCariPanel customerId={customer.id} />
    </div>
  );
}