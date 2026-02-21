import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function CustomersPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
  });

  const customers = await prisma.customer.findMany({
    where: { tenantId: user!.tenantId },
    include: { devices: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Müşteriler</h1>
          <p style={{ color: '#6b7280' }}>Toplam {customers.length} müşteri</p>
        </div>
        <Link href="/customers/new" style={{
          backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500'
        }}>+ Yeni Müşteri</Link>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Ad Soyad', 'Telefon', 'Adres', 'Cihaz Sayısı', 'Kayıt Tarihi', ''].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{c.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{c.phone}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{c.address || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {c.devices.length} cihaz
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {new Date(c.createdAt).toLocaleDateString('tr-TR')}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/customers/${c.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>Detay →</Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Henüz müşteri yok</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}