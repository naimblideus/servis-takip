import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintButton from '@/components/PrintButton';

const STATUS_LABELS: Record<string, string> = {
    NEW: 'Yeni', IN_SERVICE: 'Serviste', WAITING_FOR_PART: 'Parça Bekleniyor',
    READY: 'Hazır', DELIVERED: 'Teslim Edildi', CANCELLED: 'İptal',
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};

const PAYMENT_LABELS: Record<string, string> = {
    UNPAID: 'Ödenmedi', PARTIAL: 'Kısmi', PAID: 'Ödendi', REFUNDED: 'İade',
};

export default async function TicketPrintPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await auth();
    if (!session) redirect('/login');

    const ticket = await prisma.serviceTicket.findUnique({
        where: { id },
        include: {
            device: { include: { customer: true } },
            assignedUser: true,
            ticketParts: { include: { part: true } },
            payments: { orderBy: { createdAt: 'asc' } },
            tenant: true,
        },
    });

    if (!ticket) redirect('/tickets');

    const partTotal = ticket.ticketParts.reduce((s, tp) => s + Number(tp.unitPrice) * tp.quantity, 0);
    const paidTotal = ticket.payments.reduce((s, p) => s + Number(p.amount), 0);

    return (
        <>
            <style>{`
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; width: 0 !important; }
          .flex.min-h-screen { display: block !important; }
          #app-main { overflow: visible !important; }
          body { margin: 0; background: white !important; }
          .print-page { padding: 15mm; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
        @media screen {
          body { font-family: 'Segoe UI', sans-serif; }
          .print-page { max-width: 800px; margin: 2rem auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        }
        h1 { font-size: 1.5rem; font-weight: bold; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        .badge { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .section-title { font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.5rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .info-label { font-size: 0.75rem; color: #9ca3af; }
        .info-value { font-size: 0.95rem; font-weight: 500; }
      `}</style>

            <PrintButton ticketId={ticket.id} />

            <div className="print-page">
                {/* Antet: Logo + Firma Bilgisi | Fiş No + Tarih */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {ticket.tenant.logo && (
                            <img src={ticket.tenant.logo} alt="Logo" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }} />
                        )}
                        <div>
                            <h1>{ticket.tenant.name}</h1>
                            {ticket.tenant.phone && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>📞 {ticket.tenant.phone}</div>}
                            {ticket.tenant.address && <div style={{ fontSize: '0.75rem', color: '#9ca3af', maxWidth: '250px' }}>{ticket.tenant.address}</div>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Servis Fişi</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb' }}>{ticket.ticketNumber}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(ticket.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1e40af', marginTop: '0.25rem', display: 'inline-block' }}>
                            {STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                    </div>
                </div>

                {/* Müşteri & Cihaz */}
                <div className="grid2">
                    <div>
                        <div className="section-title">Müşteri Bilgileri</div>
                        <div className="info-label">Ad Soyad</div>
                        <div className="info-value">{ticket.device.customer.name}</div>
                        <div className="info-label" style={{ marginTop: '0.5rem' }}>Telefon</div>
                        <div className="info-value">{ticket.device.customer.phone}</div>
                        {ticket.device.customer.address && <>
                            <div className="info-label" style={{ marginTop: '0.5rem' }}>Adres</div>
                            <div className="info-value">{ticket.device.customer.address}</div>
                        </>}
                    </div>
                    <div>
                        <div className="section-title">Cihaz Bilgileri</div>
                        <div className="info-label">Cihaz</div>
                        <div className="info-value">{ticket.device.brand} {ticket.device.model}</div>
                        <div className="info-label" style={{ marginTop: '0.5rem' }}>Seri No</div>
                        <div className="info-value">{ticket.device.serialNo}</div>
                        {ticket.device.location && <>
                            <div className="info-label" style={{ marginTop: '0.5rem' }}>Konum</div>
                            <div className="info-value">{ticket.device.location}</div>
                        </>}
                    </div>
                </div>

                {/* Servis Bilgileri */}
                <div className="section-title">Servis Bilgileri</div>
                <div className="grid2">
                    <div>
                        <div className="info-label">Öncelik</div>
                        <div className="info-value">{PRIORITY_LABELS[ticket.priority] || ticket.priority}</div>
                    </div>
                    <div>
                        <div className="info-label">Teknisyen</div>
                        <div className="info-value">{ticket.assignedUser?.name || '—'}</div>
                    </div>
                </div>
                {ticket.issueText && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <div className="info-label">Arıza / Talep</div>
                        <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem', marginTop: '0.25rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{ticket.issueText}</div>
                    </div>
                )}
                {ticket.actionText && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <div className="info-label">Yapılan İşlem</div>
                        <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '0.375rem', marginTop: '0.25rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{ticket.actionText}</div>
                    </div>
                )}

                {/* Parçalar */}
                {ticket.ticketParts.length > 0 && (
                    <>
                        <div className="section-title">Kullanılan Parçalar</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th><th>Parça</th><th>Adet</th><th>Birim Fiyat</th><th>Toplam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticket.ticketParts.map(tp => (
                                    <tr key={tp.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{tp.part.sku}</td>
                                        <td>{tp.part.name}</td>
                                        <td>{tp.quantity}</td>
                                        <td>₺{Number(tp.unitPrice).toFixed(2)}</td>
                                        <td style={{ fontWeight: '600' }}>₺{(Number(tp.unitPrice) * tp.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: '700' }}>Parçalar Toplamı</td>
                                    <td style={{ fontWeight: '700', color: '#059669' }}>₺{partTotal.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </>
                )}

                {/* Ödeme Özeti */}
                <div className="section-title">Ödeme Özeti</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', margin: '0.75rem 0' }}>
                    {[
                        { label: 'Toplam Tutar', value: `₺${Number(ticket.totalCost).toFixed(2)}`, color: '#374151' },
                        { label: 'Ödenen', value: `₺${paidTotal.toFixed(2)}`, color: '#059669' },
                        { label: 'Kalan', value: `₺${Math.max(0, Number(ticket.totalCost) - paidTotal).toFixed(2)}`, color: paidTotal >= Number(ticket.totalCost) ? '#059669' : '#ef4444' },
                    ].map(c => (
                        <div key={c.label} style={{ backgroundColor: '#f9fafb', padding: '0.875rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.label}</div>
                            <div style={{ fontWeight: '700', fontSize: '1.125rem', color: c.color }}>{c.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                    <span className="badge" style={{
                        backgroundColor: ticket.paymentStatus === 'PAID' ? '#d1fae5' : '#fee2e2',
                        color: ticket.paymentStatus === 'PAID' ? '#065f46' : '#b91c1c',
                    }}>
                        {PAYMENT_LABELS[ticket.paymentStatus] || ticket.paymentStatus}
                    </span>
                </div>

                {/* İmza */}
                <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {['Müşteri İmzası', 'Teknisyen İmzası'].map(label => (
                        <div key={label} style={{ borderTop: '2px solid #d1d5db', paddingTop: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>{label}</div>
                    ))}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                    Bu belge {ticket.tenant.name} servis merkezi tarafından düzenlenmiştir.
                </div>
            </div>
        </>
    );
}
