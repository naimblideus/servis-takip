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
    UNPAID: 'Ödenmedi', PARTIAL: 'Kısmi Ödeme', PAID: 'Ödendi', REFUNDED: 'İade',
};

export default async function TicketPrintPage({ params }: { params: Promise<{ id: string }> }) {
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
    const remaining = Math.max(0, Number(ticket.totalCost) - paidTotal);
    const isPaid = paidTotal >= Number(ticket.totalCost);

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #f3f4f6; color: #111827; }

        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }

        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          .flex.min-h-screen { display: block !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrapper { padding: 0 !important; }
          .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
          .header { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .status-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        @media screen {
          .print-wrapper { padding: 2rem; }
          .receipt { max-width: 794px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 0; overflow: hidden; }
        }

        /* ─── HEADER ─── */
        .header {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
          color: white;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .header-logo { max-height: 44px; max-width: 130px; object-fit: contain; background: white; border-radius: 6px; padding: 3px 6px; }
        .company-name { font-size: 15px; font-weight: 700; line-height: 1.2; }
        .company-sub { font-size: 11px; opacity: 0.8; margin-top: 2px; }
        .header-right { text-align: right; }
        .ticket-label { font-size: 9px; font-weight: 600; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.08em; }
        .ticket-number { font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; line-height: 1; }
        .ticket-date { font-size: 10px; opacity: 0.8; margin-top: 3px; }

        /* ─── STATUS BAR ─── */
        .status-bar {
          background: #f0f7ff;
          border-bottom: 1.5px solid #bfdbfe;
          padding: 6px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }
        .status-bar-item { display: flex; align-items: center; gap: 6px; color: #374151; }
        .status-pill {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 700;
        }

        /* ─── BODY ─── */
        .body { padding: 14px 20px; }

        /* ─── INFO GRID ─── */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        .info-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .info-card-header {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          padding: 5px 10px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #6b7280;
        }
        .info-card-body { padding: 8px 10px; }
        .info-row { display: flex; margin-bottom: 4px; align-items: baseline; }
        .info-row:last-child { margin-bottom: 0; }
        .info-key { font-size: 10px; color: #9ca3af; width: 64px; flex-shrink: 0; }
        .info-val { font-size: 11.5px; font-weight: 600; color: #111827; }

        /* ─── SERVICE INFO ─── */
        .service-section { margin-bottom: 10px; }
        .section-title {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.07em; color: #6b7280;
          margin-bottom: 5px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e5e7eb;
        }
        .text-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 11px;
          line-height: 1.5;
          color: #374151;
          white-space: pre-wrap;
          min-height: 28px;
        }
        .text-box.green { background: #f0fdf4; border-color: #bbf7d0; }
        .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }

        /* ─── PARTS TABLE ─── */
        .parts-table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 10px; }
        .parts-table thead tr { background: #f9fafb; }
        .parts-table th {
          padding: 5px 8px; text-align: left;
          border-bottom: 1.5px solid #d1d5db;
          font-size: 9px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;
        }
        .parts-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
        .parts-table tr:last-child td { border-bottom: none; }
        .parts-total td { border-top: 1.5px solid #d1d5db !important; font-weight: 700; background: #f9fafb; }

        /* ─── PAYMENT SUMMARY ─── */
        .payment-row {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-bottom: 10px;
        }
        .pay-box {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 7px 14px;
          text-align: center;
          min-width: 90px;
        }
        .pay-label { font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; }
        .pay-value { font-size: 15px; font-weight: 700; margin-top: 2px; }

        /* ─── SIGNATURE ─── */
        .signature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
        }
        .sig-box { text-align: center; }
        .sig-line { border-top: 1.5px solid #9ca3af; padding-top: 4px; font-size: 9.5px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 28px; }

        /* ─── FOOTER ─── */
        .footer { text-align: center; font-size: 9px; color: #9ca3af; padding: 6px 20px 10px; }
      `}</style>

            <PrintButton ticketId={ticket.id} />

            <div className="print-wrapper">
                <div className="receipt">

                    {/* ── HEADER ── */}
                    <div className="header">
                        <div className="header-left">
                            {ticket.tenant.logo && (
                                <img src={ticket.tenant.logo} alt="Logo" className="header-logo" />
                            )}
                            <div>
                                <div className="company-name">{ticket.tenant.name}</div>
                                <div className="company-sub">
                                    {ticket.tenant.phone && `📞 ${ticket.tenant.phone}`}
                                    {ticket.tenant.phone && ticket.tenant.address && ' · '}
                                    {ticket.tenant.address}
                                </div>
                            </div>
                        </div>
                        <div className="header-right">
                            <div className="ticket-label">Servis Fişi</div>
                            <div className="ticket-number">{ticket.ticketNumber}</div>
                            <div className="ticket-date">
                                {new Date(ticket.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                        </div>
                    </div>

                    {/* ── STATUS BAR ── */}
                    <div className="status-bar">
                        <div className="status-bar-item">
                            <span style={{ color: '#9ca3af' }}>Durum:</span>
                            <span className="status-pill" style={{ background: '#dbeafe', color: '#1e40af' }}>
                                {STATUS_LABELS[ticket.status] || ticket.status}
                            </span>
                        </div>
                        <div className="status-bar-item">
                            <span style={{ color: '#9ca3af' }}>Öncelik:</span>
                            <strong>{PRIORITY_LABELS[ticket.priority]}</strong>
                        </div>
                        <div className="status-bar-item">
                            <span style={{ color: '#9ca3af' }}>Teknisyen:</span>
                            <strong>{ticket.assignedUser?.name || '—'}</strong>
                        </div>
                        <div className="status-bar-item">
                            <span style={{ color: '#9ca3af' }}>Ödeme:</span>
                            <span className="status-pill" style={{
                                background: isPaid ? '#d1fae5' : '#fee2e2',
                                color: isPaid ? '#065f46' : '#b91c1c',
                            }}>
                                {PAYMENT_LABELS[ticket.paymentStatus]}
                            </span>
                        </div>
                    </div>

                    {/* ── BODY ── */}
                    <div className="body">

                        {/* Müşteri & Cihaz */}
                        <div className="info-grid">
                            <div className="info-card">
                                <div className="info-card-header">👤 Müşteri Bilgileri</div>
                                <div className="info-card-body">
                                    <div className="info-row">
                                        <span className="info-key">Ad Soyad</span>
                                        <span className="info-val">{ticket.device.customer.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-key">Telefon</span>
                                        <span className="info-val">{ticket.device.customer.phone}</span>
                                    </div>
                                    {ticket.device.customer.address && (
                                        <div className="info-row">
                                            <span className="info-key">Adres</span>
                                            <span className="info-val" style={{ fontSize: '10.5px' }}>{ticket.device.customer.address}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="info-card-header">🖨️ Cihaz Bilgileri</div>
                                <div className="info-card-body">
                                    <div className="info-row">
                                        <span className="info-key">Cihaz</span>
                                        <span className="info-val">{ticket.device.brand} {ticket.device.model}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-key">Seri No</span>
                                        <span className="info-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{ticket.device.serialNo}</span>
                                    </div>
                                    {ticket.device.location && (
                                        <div className="info-row">
                                            <span className="info-key">Konum</span>
                                            <span className="info-val">{ticket.device.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Servis Bilgileri */}
                        <div className="service-section">
                            <div className="section-title">🔧 Servis Bilgileri</div>
                            <div className="service-grid">
                                {ticket.issueText && (
                                    <div>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, marginBottom: 3 }}>ARIZA / TALEP</div>
                                        <div className="text-box">{ticket.issueText}</div>
                                    </div>
                                )}
                                {ticket.actionText && (
                                    <div>
                                        <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, marginBottom: 3 }}>YAPILAN İŞLEM</div>
                                        <div className="text-box green">{ticket.actionText}</div>
                                    </div>
                                )}
                            </div>
                            {ticket.notes && (
                                <div style={{ marginTop: 4 }}>
                                    <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, marginBottom: 3 }}>NOTLAR</div>
                                    <div className="text-box" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>{ticket.notes}</div>
                                </div>
                            )}
                        </div>

                        {/* Kullanılan Parçalar */}
                        {ticket.ticketParts.length > 0 && (
                            <div className="service-section">
                                <div className="section-title">🔩 Kullanılan Parçalar</div>
                                <table className="parts-table">
                                    <thead>
                                        <tr>
                                            <th>SKU</th>
                                            <th>Parça Adı</th>
                                            <th style={{ textAlign: 'center' }}>Adet</th>
                                            <th style={{ textAlign: 'right' }}>Birim</th>
                                            <th style={{ textAlign: 'right' }}>Toplam</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ticket.ticketParts.map(tp => (
                                            <tr key={tp.id}>
                                                <td style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '10px' }}>{tp.part.sku}</td>
                                                <td>{tp.part.name}</td>
                                                <td style={{ textAlign: 'center' }}>{tp.quantity}</td>
                                                <td style={{ textAlign: 'right' }}>₺{Number(tp.unitPrice).toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>₺{(Number(tp.unitPrice) * tp.quantity).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr className="parts-total">
                                            <td colSpan={4} style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280' }}>Parçalar Toplamı</td>
                                            <td style={{ textAlign: 'right', color: '#059669' }}>₺{partTotal.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Ödeme Özeti */}
                        <div className="payment-row">
                            <div className="pay-box">
                                <div className="pay-label">Toplam</div>
                                <div className="pay-value" style={{ color: '#374151' }}>₺{Number(ticket.totalCost).toFixed(2)}</div>
                            </div>
                            <div className="pay-box" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                                <div className="pay-label">Ödenen</div>
                                <div className="pay-value" style={{ color: '#059669' }}>₺{paidTotal.toFixed(2)}</div>
                            </div>
                            <div className="pay-box" style={{
                                borderColor: isPaid ? '#bbf7d0' : '#fecaca',
                                background: isPaid ? '#f0fdf4' : '#fef2f2',
                            }}>
                                <div className="pay-label">Kalan</div>
                                <div className="pay-value" style={{ color: isPaid ? '#059669' : '#dc2626' }}>₺{remaining.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* İmza */}
                        <div className="signature-grid">
                            {['Müşteri İmzası', 'Teknisyen İmzası'].map(label => (
                                <div key={label} className="sig-box">
                                    <div className="sig-line">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="footer">
                        Bu belge {ticket.tenant.name} servis merkezi tarafından {new Date(ticket.createdAt).toLocaleDateString('tr-TR')} tarihinde düzenlenmiştir.
                    </div>
                </div>
            </div>
        </>
    );
}
