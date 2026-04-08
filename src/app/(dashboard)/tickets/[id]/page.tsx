import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import TicketStatusPanel from '@/components/TicketStatusPanel';
import TicketPartsPanel from '@/components/TicketPartsPanel';
import TicketPaymentPanel from '@/components/TicketPaymentPanel';
import TicketPrintButton from '@/components/TicketPrintButton';
import TicketDeleteButton from '@/components/TicketDeleteButton';

const statusLabel: Record<string, { label: string; color: string; text: string }> = {
  NEW: { label: 'Yeni', color: '#fef3c7', text: '#92400e' },
  IN_SERVICE: { label: 'Serviste', color: '#dbeafe', text: '#1e40af' },
  WAITING_FOR_PART: { label: 'Parça Bkl.', color: '#fce7f3', text: '#9d174d' },
  READY: { label: 'Hazır', color: '#d1fae5', text: '#065f46' },
  DELIVERED: { label: 'Teslim', color: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'İptal', color: '#f3f4f6', text: '#374151' },
};

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const ticket = await prisma.serviceTicket.findUnique({
    where: { id },
    include: {
      device: { include: { customer: true } },
      assignedUser: true,
      createdBy: true,
    },
  });

  if (!ticket) redirect('/tickets');

  const users = await prisma.user.findMany({
    where: { tenantId: ticket.tenantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const latestReading = await prisma.counterReading.findFirst({
    where: { deviceId: ticket.deviceId },
    orderBy: { readingDate: 'desc' },
  });

  const counterBlackVal = latestReading?.counterBlack ?? ticket.device.counterBlack ?? null;
  const counterColorVal = latestReading?.counterColor ?? ticket.device.counterColor ?? null;

  const st = statusLabel[ticket.status] ?? { label: ticket.status, color: '#f3f4f6', text: '#374151' };

  return (
    <div style={{ padding: '2rem', maxWidth: '960px' }}>
      {/* Başlık */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/tickets" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Servis Fişleri</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{ticket.ticketNumber}</h1>
            <span style={{
              backgroundColor: st.color, color: st.text,
              padding: '0.25rem 0.875rem', borderRadius: '9999px',
              fontSize: '0.875rem', fontWeight: '700',
              border: `1px solid ${st.color}`,
            }}>{st.label}</span>
          </div>
          {/* Yazdır + Status Güncelleme Paneli */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <TicketPrintButton ticketId={ticket.id} />
            <TicketDeleteButton ticketId={ticket.id} ticketNumber={ticket.ticketNumber} />
            <TicketStatusPanel
              ticketId={ticket.id}
              currentStatus={ticket.status}
              currentAssignedUserId={ticket.assignedUserId ?? ''}
              currentPriority={ticket.priority}
              currentPaymentStatus={ticket.paymentStatus}
              currentTotalCost={Number(ticket.totalCost)}
              currentIssueText={ticket.issueText ?? ''}
              currentActionText={ticket.actionText ?? ''}
              currentNotes={ticket.notes ?? ''}
              users={users}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Cihaz & Müşteri */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cihaz & Müşteri</h2>
          {[
            ['Müşteri', ticket.device.customer.name],
            ['Telefon', ticket.device.customer.phone],
            ['Cihaz', `${ticket.device.brand} ${ticket.device.model}`],
            ['Seri No', ticket.device.serialNo],
            ['Konum', ticket.device.location || '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <Link href={`/devices/${ticket.device.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Cihaz Detayı →</Link>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href={`/customers/${ticket.device.customer.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>Müşteri Detayı →</Link>
          </div>
        </div>

        {/* Fiş Bilgileri */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Fiş Bilgileri</h2>

          {/* Siyah / Renkli Sayaç Göstergesi */}
          {(counterBlackVal !== null || counterColorVal !== null) && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {counterBlackVal !== null && (
                <div style={{
                  flex: 1, backgroundColor: '#1f2937', borderRadius: '0.625rem',
                  padding: '0.625rem 0.875rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                    ⚫ Siyah Sayaç
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'white', fontFamily: 'monospace' }}>
                    {counterBlackVal.toLocaleString('tr-TR')}
                  </div>
                </div>
              )}
              {counterColorVal !== null && (
                <div style={{
                  flex: 1, backgroundColor: '#5b21b6', borderRadius: '0.625rem',
                  padding: '0.625rem 0.875rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#c4b5fd', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                    🟣 Renkli Sayaç
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'white', fontFamily: 'monospace' }}>
                    {counterColorVal.toLocaleString('tr-TR')}
                  </div>
                </div>
              )}
            </div>
          )}

          {[
            ['Teknisyen', ticket.assignedUser?.name ?? '-'],
            ['Oluşturan', ticket.createdBy?.name ?? '-'],
            ['Toplam Tutar', `₺${Number(ticket.totalCost).toFixed(2)}`],
            ['Ödeme', ticket.paymentStatus === 'UNPAID' ? 'Ödenmedi' : ticket.paymentStatus === 'PAID' ? 'Ödendi' : ticket.paymentStatus === 'PARTIAL' ? 'Kısmi' : '-'],
            ['Tarih', new Date(ticket.createdAt).toLocaleDateString('tr-TR')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Arıza Bilgileri */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Arıza & İşlem Bilgileri</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[
            ['Arıza Açıklaması', ticket.issueText],
            ['Yapılan İşlem', ticket.actionText || '-'],
            ['Notlar', ticket.notes || '-'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>{k}</div>
              <div style={{ fontSize: '0.875rem', backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', whiteSpace: 'pre-wrap' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Parçalar */}
      <TicketPartsPanel ticketId={ticket.id} />

      {/* Ödeme Takibi */}
      <TicketPaymentPanel
        ticketId={ticket.id}
        totalCost={Number(ticket.totalCost)}
        paymentStatus={ticket.paymentStatus}
      />
    </div>
  );
}