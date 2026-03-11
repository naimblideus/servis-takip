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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    NEW: { bg: '#fef3c7', text: '#92400e' },
    IN_SERVICE: { bg: '#dbeafe', text: '#1e40af' },
    WAITING_FOR_PART: { bg: '#fce7f3', text: '#9d174d' },
    READY: { bg: '#d1fae5', text: '#065f46' },
    DELIVERED: { bg: '#ede9fe', text: '#4c1d95' },
    CANCELLED: { bg: '#f3f4f6', text: '#374151' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    LOW: { bg: '#f3f4f6', text: '#374151' },
    NORMAL: { bg: '#dbeafe', text: '#1e40af' },
    HIGH: { bg: '#ffedd5', text: '#c2410c' },
    URGENT: { bg: '#fee2e2', text: '#b91c1c' },
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
    const statusColor = STATUS_COLORS[ticket.status] ?? { bg: '#f3f4f6', text: '#374151' };
    const priorityColor = PRIORITY_COLORS[ticket.priority] ?? { bg: '#f3f4f6', text: '#374151' };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }

        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          .flex.min-h-screen { display: block !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrapper { padding: 0 !important; background: white !important; }
          .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; border: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        @media screen {
          .print-wrapper { padding: 2.5rem; min-height: 100vh; background: #e5e7eb; }
          .receipt {
            max-width: 794px; margin: 0 auto; background: white;
            border-radius: 16px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.16);
            overflow: hidden;
            border: 1px solid #e5e7eb;
          }
        }

        /* ─── HEADER ─── */
        .header {
          background: linear-gradient(135deg, #0f2253 0%, #1a3a8f 50%, #2563eb 100%);
          color: white;
          padding: 18px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .header::after {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 160px; height: 160px;
          background: rgba(255,255,255,0.05);
          border-radius: 50%;
        }
        .header::before {
          content: '';
          position: absolute;
          bottom: -60px; right: 60px;
          width: 200px; height: 200px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .header-left { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
        .header-logo { max-height: 52px; max-width: 140px; object-fit: contain; background: white; border-radius: 8px; padding: 4px 8px; }
        .company-name { font-size: 17px; font-weight: 800; line-height: 1.2; letter-spacing: -0.2px; }
        .company-sub { font-size: 12px; opacity: 0.75; margin-top: 3px; }
        .header-right { text-align: right; position: relative; z-index: 1; }
        .ticket-label {
          font-size: 9px; font-weight: 700; opacity: 0.65;
          text-transform: uppercase; letter-spacing: 0.12em;
          background: rgba(255,255,255,0.15);
          padding: 2px 8px; border-radius: 4px;
          display: inline-block; margin-bottom: 4px;
        }
        .ticket-number {
          font-family: 'Courier New', monospace;
          font-size: 28px; font-weight: 700; line-height: 1;
          letter-spacing: 0.5px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .ticket-date { font-size: 11px; opacity: 0.75; margin-top: 4px; }

        /* ─── STATUS BAR ─── */
        .status-bar {
          background: linear-gradient(90deg, #f0f7ff 0%, #f8faff 100%);
          border-bottom: 2px solid #bfdbfe;
          padding: 10px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .status-bar-item { display: flex; align-items: center; gap: 7px; color: #374151; font-size: 12px; }
        .status-bar-label { color: #9ca3af; font-weight: 500; font-size: 11px; }
        .status-pill {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.3;
        }
        .status-val { font-size: 13px; font-weight: 700; }

        /* ─── BODY ─── */
        .body { padding: 18px 24px; }

        /* ─── INFO GRID ─── */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
        }
        .info-card {
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .info-card-header {
          background: linear-gradient(90deg, #f9fafb, #f3f4f6);
          border-bottom: 1.5px solid #e5e7eb;
          padding: 7px 14px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #374151;
        }
        .info-card-body { padding: 10px 14px; }
        .info-row { display: flex; margin-bottom: 6px; align-items: baseline; }
        .info-row:last-child { margin-bottom: 0; }
        .info-key { font-size: 11px; color: #9ca3af; width: 72px; flex-shrink: 0; font-weight: 500; }
        .info-val { font-size: 13px; font-weight: 700; color: #111827; }

        /* ─── SERVICE INFO ─── */
        .service-section { margin-bottom: 14px; }
        .section-title {
          font-size: 10px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.08em; color: #374151;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 2px solid #e5e7eb;
          display: flex; align-items: center; gap: 6px;
        }
        .text-box {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.6;
          color: #1f2937;
          white-space: pre-wrap;
          min-height: 36px;
          font-weight: 500;
        }
        .text-box.green { background: #f0fdf4; border-color: #86efac; }
        .text-box.yellow { background: #fffbeb; border-color: #fde68a; }
        .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .text-box-label {
          font-size: 10px; color: #6b7280; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          margin-bottom: 5px;
        }

        /* ─── PARTS TABLE ─── */
        .parts-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .parts-table thead tr { background: linear-gradient(90deg, #f9fafb, #f3f4f6); }
        .parts-table th {
          padding: 8px 12px; text-align: left;
          border-bottom: 2px solid #d1d5db;
          font-size: 10px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.06em; color: #374151;
        }
        .parts-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
        .parts-table tr:last-child td { border-bottom: none; }
        .parts-total td { border-top: 2px solid #d1d5db !important; font-weight: 800; background: #f9fafb; font-size: 13px; }

        /* ─── PAYMENT SUMMARY ─── */
        .payment-row {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          margin-bottom: 14px;
        }
        .pay-box {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px 20px;
          text-align: center;
          min-width: 110px;
          background: #f9fafb;
        }
        .pay-label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .pay-value { font-size: 22px; font-weight: 800; margin-top: 4px; line-height: 1; }

        /* ─── SIGNATURE ─── */
        .signature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 2px solid #e5e7eb;
        }
        .sig-box { text-align: center; }
        .sig-area { height: 52px; border-bottom: 2px solid #9ca3af; margin-bottom: 6px; }
        .sig-label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

        /* ─── FOOTER ─── */
        .footer {
          text-align: center; font-size: 10px; color: #9ca3af;
          padding: 10px 24px 14px;
          border-top: 1px solid #f3f4f6;
          background: #fafafa;
        }
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
                            <span className="status-bar-label">Durum:</span>
                            <span className="status-pill" style={{ background: statusColor.bg, color: statusColor.text }}>
                                {STATUS_LABELS[ticket.status] || ticket.status}
                            </span>
                        </div>
                        <div className="status-bar-item">
                            <span className="status-bar-label">Öncelik:</span>
                            <span className="status-pill" style={{ background: priorityColor.bg, color: priorityColor.text }}>
                                {PRIORITY_LABELS[ticket.priority]}
                            </span>
                        </div>
                        <div className="status-bar-item">
                            <span className="status-bar-label">Teknisyen:</span>
                            <span className="status-val">{ticket.assignedUser?.name || '—'}</span>
                        </div>
                        <div className="status-bar-item">
                            <span className="status-bar-label">Ödeme:</span>
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
                                            <span className="info-val" style={{ fontSize: '12px' }}>{ticket.device.customer.address}</span>
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
                                        <span className="info-val" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{ticket.device.serialNo}</span>
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
                                        <div className="text-box-label">Arıza / Talep</div>
                                        <div className="text-box">{ticket.issueText}</div>
                                    </div>
                                )}
                                {ticket.actionText && (
                                    <div>
                                        <div className="text-box-label">Yapılan İşlem</div>
                                        <div className="text-box green">{ticket.actionText}</div>
                                    </div>
                                )}
                            </div>
                            {ticket.notes && (
                                <div style={{ marginTop: 8 }}>
                                    <div className="text-box-label">Notlar</div>
                                    <div className="text-box yellow">{ticket.notes}</div>
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
                                                <td style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '11px' }}>{tp.part.sku}</td>
                                                <td style={{ fontWeight: 600 }}>{tp.part.name}</td>
                                                <td style={{ textAlign: 'center' }}>{tp.quantity}</td>
                                                <td style={{ textAlign: 'right' }}>₺{Number(tp.unitPrice).toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#374151' }}>₺{(Number(tp.unitPrice) * tp.quantity).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr className="parts-total">
                                            <td colSpan={4} style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>Parçalar Toplamı</td>
                                            <td style={{ textAlign: 'right', color: '#059669', fontSize: '14px' }}>₺{partTotal.toFixed(2)}</td>
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
                            <div className="pay-box" style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                                <div className="pay-label">Ödenen</div>
                                <div className="pay-value" style={{ color: '#059669' }}>₺{paidTotal.toFixed(2)}</div>
                            </div>
                            <div className="pay-box" style={{
                                borderColor: isPaid ? '#86efac' : '#fca5a5',
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
                                    <div className="sig-area" />
                                    <div className="sig-label">{label}</div>
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
