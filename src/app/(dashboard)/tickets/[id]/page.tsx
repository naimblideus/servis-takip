import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import TicketStatusPanel from '@/components/TicketStatusPanel';
import TicketPartsPanel from '@/components/TicketPartsPanel';
import TicketPaymentPanel from '@/components/TicketPaymentPanel';
import TicketPrintButton from '@/components/TicketPrintButton';
import TicketDeleteButton from '@/components/TicketDeleteButton';
import ContactActions from '@/components/ContactActions';
import { waUrl, statusMessage, NOTIFY_STATUSES } from '@/lib/share';
import { faultLabel } from '@/lib/fault-categories';
import { ASAMA_KISA } from '@/lib/ticket-asama';
import { oturumKullanicisi } from '@/lib/api-auth';

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

  // IDOR koruması: yalnızca bu tenant'ın fişi görüntülenebilir
  const me = await oturumKullanicisi(session);
  if (!me) redirect('/login');
  const tenantName = (session.user as any)?.tenantName as string | undefined;

  const ticket = await prisma.serviceTicket.findFirst({
    where: { id, tenantId: me.tenantId },
    include: {
      device: { include: { customer: true } },
      assignedUser: true,
      createdBy: true,
      // Aşama geçmişi — müşteri "siz bunu bir hafta beklettiniz" derse cevap burada
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        select: { id: true, status: true, oncekiStatus: true, changedAt: true, kaynak: true, notu: true, changedByUserId: true },
      },
    },
  });

  if (!ticket) redirect('/tickets');

  const users = await prisma.user.findMany({
    where: { tenantId: ticket.tenantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Aşama geçmişindeki kullanıcı adları — id yerine isim göstermek için
  const kisiAdi = new Map(users.map((u) => [u.id, u.name]));

  // ── SAYAÇ: BU FİŞİN okuması + BİR ÖNCEKİ ────────────────────────────────
  // ÖNCEDEN cihazın EN SON okuması gösteriliyordu: eski bir fişi açınca
  // BUGÜNKÜ sayaç görünüyordu, yani fişte olmayan bir değer. Yazdırma sayfası
  // da düzeltildi; ikisi AYNI sayıyı göstermeli, yoksa ekranla kâğıt çelişir.
  // Ayrıca tenantId filtresi yoktu — diğer sorgularla aynı korumaya alındı.
  const fisOkumasi = await prisma.counterReading.findFirst({
    where: { ticketId: ticket.id, tenantId: me.tenantId },
    orderBy: { readingDate: 'desc' },
  });
  const guncelOkuma = fisOkumasi ?? await prisma.counterReading.findFirst({
    where: {
      deviceId: ticket.deviceId, tenantId: me.tenantId,
      readingDate: { lte: ticket.createdAt },
    },
    orderBy: { readingDate: 'desc' },
  });
  const oncekiOkuma = guncelOkuma
    ? await prisma.counterReading.findFirst({
      where: {
        deviceId: ticket.deviceId, tenantId: me.tenantId,
        readingDate: { lt: guncelOkuma.readingDate },
      },
      orderBy: { readingDate: 'desc' },
    })
    : null;

  const counterBlackVal = guncelOkuma?.counterBlack ?? ticket.device.counterBlack ?? null;
  const counterColorVal = guncelOkuma?.counterColor ?? ticket.device.counterColor ?? null;

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
              currentCreatedAt={ticket.createdAt.toISOString()}
              users={users}
              customerPhone={ticket.device.customer.phone}
              customerName={ticket.device.customer.name}
              deviceName={`${ticket.device.brand} ${ticket.device.model}`}
              ticketNumber={ticket.ticketNumber}
              tenantName={tenantName}
              deviceId={ticket.deviceId}
              reading={fisOkumasi ? {
                id: fisOkumasi.id,
                counterBlack: fisOkumasi.counterBlack,
                counterColor: fisOkumasi.counterColor,
                billed: fisOkumasi.billed,
              } : null}
              currentFaultCategory={ticket.faultCategory}
            />
          </div>
        </div>
      </div>

      {/* auto-fit: telefonda tek sütun, masaüstünde yine iki kart yan yana.
          Sabit iki sütun 375 px'te 408 px istiyordu ve sağdaki "Fiş Bilgileri"
          kartı ekranın 65 px dışında kalıyordu (ölçüldü: #app-main 440/375).
          Teknisyen fişi açtığında arıza kategorisini, toplam tutarı, ödemeyi
          ve sayaç değerlerini göremiyordu; görmek için yana kaydırınca bu kez
          soldaki müşteri kartı ekrandan çıkıyordu. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(17rem,1fr))', gap: '1rem', marginBottom: '1rem' }}>
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

          {/* Mobil iletişim aksiyonları */}
          <ContactActions phone={ticket.device.customer.phone} address={ticket.device.customer.address} />

          {/* Müşteriye durum bildirimi — durum değiştirdiğin an değil, fiş açık olduğu SÜRECE burada durur */}
          {NOTIFY_STATUSES.includes(ticket.status) && ticket.device.customer.phone && (() => {
            const done = ticket.status === 'READY' || ticket.status === 'DELIVERED';
            const label = ticket.status === 'READY' ? '🔔 Arıza giderildi — müşteriye bildir'
              : ticket.status === 'DELIVERED' ? '🔔 Müşteriye işlem özetini gönder'
              : '🔔 Müşteriye durumu bildir';
            return (
              <div style={{ marginTop: '0.6rem' }}>
                <a
                  href={waUrl(ticket.device.customer.phone, statusMessage(ticket.status, {
                    tenantName,
                    customerName: ticket.device.customer.name,
                    deviceName: `${ticket.device.brand} ${ticket.device.model}`,
                    ticketNumber: ticket.ticketNumber,
                    actionText: ticket.actionText ?? '',
                    totalCost: Number(ticket.totalCost),
                  }))}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.55rem 1rem', backgroundColor: '#16a34a', color: 'white', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  {label}
                </a>
                {done && (
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.35rem', lineHeight: 1.5 }}>
                    {ticket.actionText?.trim() || Number(ticket.totalCost) > 0
                      ? <>Mesaja {ticket.actionText?.trim() ? <b>yapılan işlem</b> : null}{ticket.actionText?.trim() && Number(ticket.totalCost) > 0 ? ' ve ' : null}{Number(ticket.totalCost) > 0 ? <b>tutar</b> : null} da eklenir.</>
                      : <>💡 “Yapılan İşlem” ve tutarı girerseniz mesaja otomatik eklenir.</>}
                  </div>
                )}
              </div>
            );
          })()}
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
                    {oncekiOkuma && (
                      <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: '0.85rem' }}>
                        {oncekiOkuma.counterBlack.toLocaleString('tr-TR')} →{' '}
                      </span>
                    )}
                    {counterBlackVal.toLocaleString('tr-TR')}
                  </div>
                  {oncekiOkuma && guncelOkuma && (
                    <div style={{ fontSize: '0.7rem', color: '#6ee7b7', fontWeight: 700, marginTop: '0.15rem' }}>
                      +{Math.max(0, guncelOkuma.counterBlack - oncekiOkuma.counterBlack).toLocaleString('tr-TR')} sayfa
                    </div>
                  )}
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
                    {oncekiOkuma && (
                      <span style={{ color: '#c4b5fd', fontWeight: 500, fontSize: '0.85rem' }}>
                        {oncekiOkuma.counterColor.toLocaleString('tr-TR')} →{' '}
                      </span>
                    )}
                    {counterColorVal.toLocaleString('tr-TR')}
                  </div>
                  {oncekiOkuma && guncelOkuma && (
                    <div style={{ fontSize: '0.7rem', color: '#ddd6fe', fontWeight: 700, marginTop: '0.15rem' }}>
                      +{Math.max(0, guncelOkuma.counterColor - oncekiOkuma.counterColor).toLocaleString('tr-TR')} sayfa
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {[
            ['Teknisyen', ticket.assignedUser?.name ?? '-'],
            ['Arıza Kategorisi', faultLabel(ticket.faultCategory)],
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

      {/* Aşama geçmişi — fişin nereden nereye gittiği. Silinmez, üzerine
          yazılmaz: yanlış aşamaya alındıysa doğrusuna geçilir, ikisi de kalır. */}
      {ticket.statusHistory.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '0.35rem' }}>Aşama Geçmişi</h2>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1rem' }}>
            Müşteri bu adımları kendi panelinde de görüyor.
          </p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {ticket.statusHistory.map((h) => {
              const kisi = kisiAdi.get(h.changedByUserId ?? '') ?? null;
              return (
                <div key={h.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', fontSize: '0.85rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.78rem', minWidth: 128, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(h.changedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {h.oncekiStatus ? `${ASAMA_KISA[h.oncekiStatus]} → ` : ''}{ASAMA_KISA[h.status]}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.75rem', textAlign: 'right' }}>
                    {h.kaynak === 'GECMIS' ? 'devir kaydı'
                      : h.kaynak === 'PORTAL' ? (h.notu || 'müşteri kanalı')
                        : kisi ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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