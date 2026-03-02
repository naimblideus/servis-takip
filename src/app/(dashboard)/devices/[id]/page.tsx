import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DeviceEditPanel from '@/components/DeviceEditPanel';
import CounterReadingPanel from '@/components/CounterReadingPanel';
import DeviceQRCode from '@/components/DeviceQRCode';

const statusLabel: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Yeni', color: '#fef3c7' },
  IN_SERVICE: { label: 'Serviste', color: '#dbeafe' },
  WAITING_FOR_PART: { label: 'Parça Bkl.', color: '#fce7f3' },
  READY: { label: 'Hazır', color: '#d1fae5' },
  DELIVERED: { label: 'Teslim', color: '#f0fdf4' },
  CANCELLED: { label: 'İptal', color: '#f3f4f6' },
};

const priorityLabel: Record<string, string> = {
  LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      customer: true,
      serviceTickets: {
        include: { assignedUser: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!device) redirect('/devices');

  // Tenant varsayılan fiyatlarını al
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  const tenant = user ? await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { pricePerBlack: true, pricePerColor: true },
  }) : null;

  const effectiveBlackPrice = (device as any).pricePerBlack !== null ? Number((device as any).pricePerBlack) : Number(tenant?.pricePerBlack ?? 0);
  const effectiveColorPrice = (device as any).pricePerColor !== null ? Number((device as any).pricePerColor) : Number(tenant?.pricePerColor ?? 0);

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      {/* Başlık */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/devices" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Cihazlar</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{device.brand} {device.model}</h1>
            {device.isRental && (
              <span style={{ fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>KİRALIK</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <DeviceQRCode publicCode={device.publicCode} deviceName={`${device.brand} ${device.model}`} />
            <DeviceEditPanel device={{
              id: device.id, brand: device.brand, model: device.model, serialNo: device.serialNo,
              location: device.location, isRental: device.isRental, monthlyRent: Number(device.monthlyRent || 0),
              pricePerBlack: (device as any).pricePerBlack !== null ? Number((device as any).pricePerBlack) : null,
              pricePerColor: (device as any).pricePerColor !== null ? Number((device as any).pricePerColor) : null,
            }} />
          </div>
        </div>
        <p style={{ color: '#6b7280' }}>Seri No: {device.serialNo}</p>
      </div>

      {/* Cihaz + Müşteri + Kiralık Bilgisi */}
      <div style={{ display: 'grid', gridTemplateColumns: device.isRental ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cihaz Bilgileri</h2>
          {[
            ['Marka', device.brand],
            ['Model', device.model],
            ['Seri No', device.serialNo],
            ['Sayaç (Siyah)', device.counterBlack ? device.counterBlack.toLocaleString('tr-TR') : '-'],
            ['Sayaç (Renkli)', device.counterColor ? device.counterColor.toLocaleString('tr-TR') : '-'],
            ['Konum', device.location || '-'],
            ['QR Kodu', device.publicCode],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Müşteri</h2>
          {[
            ['Ad Soyad', device.customer.name],
            ['Telefon', device.customer.phone],
            ['Adres', device.customer.address || '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: '1rem' }}>
            <Link href={`/customers/${device.customer.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>
              Müşteri Detayına Git →
            </Link>
          </div>
        </div>

        {/* Kiralık Bilgi Kartı */}
        {device.isRental && (
          <div style={{ backgroundColor: '#eff6ff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', border: '1px solid #bfdbfe' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem', color: '#1e40af' }}>🏷️ Kira Bilgileri</h2>
            {[
              ['Aylık Kira', `₺${Number(device.monthlyRent).toFixed(2)}`],
              ['⚫ Siyah Birim', `₺${effectiveBlackPrice.toFixed(2)}`],
              ['🟣 Renkli Birim', `₺${effectiveColorPrice.toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #bfdbfe', fontSize: '0.875rem' }}>
                <span style={{ color: '#1e40af' }}>{k}</span>
                <span style={{ fontWeight: '600', color: '#1e3a8a' }}>{v}</span>
              </div>
            ))}
            {((device as any).pricePerBlack !== null || (device as any).pricePerColor !== null) && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                Özel fiyat uygulanıyor
              </div>
            )}
          </div>
        )}
      </div>

      {/* Servis Fişleri */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600' }}>Servis Fişleri ({device.serviceTickets.length})</h2>
          <Link href={`/tickets/new`} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem',
            borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500'
          }}>+ Yeni Fiş</Link>
        </div>

        {device.serviceTickets.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Henüz servis fişi yok</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Fiş No', 'Arıza', 'Durum', 'Öncelik', 'Teknisyen', 'Tarih', ''].map(h => (
                  <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {device.serviceTickets.map((t, i) => {
                const st = statusLabel[t.status] ?? { label: t.status, color: '#f3f4f6' };
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>{t.ticketNumber}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{ backgroundColor: st.color, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem' }}>{priorityLabel[t.priority] ?? t.priority}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.assignedUser?.name ?? '-'}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <Link href={`/tickets/${t.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Detay →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sayaç Okumalar */}
      <CounterReadingPanel deviceId={device.id} />
    </div>
  );
}