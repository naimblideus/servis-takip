import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const KIND: Record<string, string> = { COUNTER: 'Sayaç', RENTAL: 'Kira', PART: 'Parça', LABOR: 'İşçilik', OTHER: 'Diğer' };
const STATUS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  OPEN: { label: 'Açık', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  PARTIAL: { label: 'Kısmi Ödendi', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  PAID: { label: 'Ödendi', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  OVERDUE: { label: 'Vadesi Geçti', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  CANCELLED: { label: 'İptal', bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  DRAFT: { label: 'Taslak', bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
};

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) redirect('/login');

  const invoice = await prisma.customerInvoice.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: { customer: true, tenant: true, lines: { orderBy: { id: 'asc' } } },
  });
  if (!invoice) redirect('/invoices');

  const t = invoice.tenant;
  const c = invoice.customer;
  const subtotal = Number(invoice.subtotal);
  const vatRate = Number(invoice.vatRate);
  const vatAmount = Number(invoice.vatAmount);
  const totalAmount = Number(invoice.totalAmount);
  const paidAmount = Number(invoice.paidAmount);
  const openAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
  const st = STATUS[invoice.status] || STATUS.OPEN;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrapper { padding: 0 !important; background: white !important; }
          .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; border: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen {
          .print-wrapper { padding: 2.5rem; min-height: 100vh; background: #e5e7eb; }
          .receipt { max-width: 794px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.16); overflow: hidden; border: 1px solid #e5e7eb; }
        }
        .header { background: linear-gradient(135deg, #0f2253 0%, #1a3a8f 50%, #2563eb 100%); color: white; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .header::after { content: ''; position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; background: rgba(255,255,255,0.05); border-radius: 50%; }
        .header::before { content: ''; position: absolute; bottom: -60px; right: 60px; width: 200px; height: 200px; background: rgba(255,255,255,0.04); border-radius: 50%; }
        .header-left { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
        .header-logo { max-height: 52px; max-width: 140px; object-fit: contain; background: white; border-radius: 8px; padding: 4px 8px; }
        .company-name { font-size: 17px; font-weight: 800; line-height: 1.2; letter-spacing: -0.2px; }
        .company-sub { font-size: 12px; opacity: 0.75; margin-top: 3px; }
        .company-tax { font-size: 10.5px; opacity: 0.7; margin-top: 2px; }
        .header-right { text-align: right; position: relative; z-index: 1; }
        .doc-label { font-size: 9px; font-weight: 700; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .doc-title { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: 0.3px; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .doc-no { font-size: 12px; opacity: 0.85; margin-top: 5px; font-variant-numeric: tabular-nums; }
        .body { padding: 18px 24px; }
        .meta-bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .meta-chip { flex: 1; min-width: 120px; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 9px 14px; background: #f9fafb; }
        .meta-key { font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-val { font-size: 14px; font-weight: 800; color: #111827; margin-top: 3px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; }
        .info-card { border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
        .info-card-header { background: linear-gradient(90deg, #f9fafb, #f3f4f6); border-bottom: 1.5px solid #e5e7eb; padding: 7px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; }
        .info-card-body { padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
        .info-row { display: flex; align-items: baseline; }
        .info-key { font-size: 11px; color: #9ca3af; width: 78px; flex-shrink: 0; font-weight: 500; }
        .info-val { font-size: 13px; font-weight: 700; color: #111827; }
        .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        .ext-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .ext-table thead tr { background: linear-gradient(90deg, #f9fafb, #f3f4f6); }
        .ext-table th { padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
        .ext-table td { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
        .ext-table tr:last-child td { border-bottom: none; }
        .kind-badge { display: inline-block; font-size: 9.5px; font-weight: 700; padding: 1px 7px; border-radius: 4px; background: #eef2ff; color: #4338ca; margin-right: 6px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .totals-box { width: 280px; border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .totals-row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 12.5px; }
        .totals-row.sub { color: #6b7280; }
        .totals-row.grand { background: linear-gradient(135deg, #0f2253, #2563eb); color: white; font-weight: 800; font-size: 15px; padding: 11px 14px; }
        .totals-row.paid { color: #059669; border-top: 1px solid #f3f4f6; }
        .totals-row.open { color: #b91c1c; font-weight: 800; font-size: 14px; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 14px; padding-top: 14px; border-top: 2px solid #e5e7eb; }
        .sig-box { text-align: center; }
        .sig-area { height: 52px; border-bottom: 2px solid #9ca3af; margin-bottom: 6px; }
        .sig-label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .footer { text-align: center; font-size: 10px; color: #9ca3af; padding: 10px 24px 14px; border-top: 1px solid #f3f4f6; background: #fafafa; }
        .empty { text-align: center; color: #9ca3af; padding: 28px; font-size: 13px; }
      `}</style>

      <PrintNowButton />

      <div className="print-wrapper">
        <div className="receipt">
          {/* HEADER */}
          <div className="header">
            <div className="header-left">
              {t.logo && <img src={t.logo} alt="Logo" className="header-logo" />}
              <div>
                <div className="company-name">{t.name}</div>
                <div className="company-sub">
                  {t.phone && `📞 ${t.phone}`}{t.phone && t.address && ' · '}{t.address}
                </div>
                {(t.taxOffice || t.taxNumber) && (
                  <div className="company-tax">
                    {t.taxOffice && `${t.taxOffice} V.D.`}{t.taxOffice && t.taxNumber && ' · '}{t.taxNumber && `VKN ${t.taxNumber}`}
                  </div>
                )}
              </div>
            </div>
            <div className="header-right">
              <div className="doc-label">Fatura</div>
              <div className="doc-title">{fmt(totalAmount)}</div>
              <div className="doc-no">{invoice.invoiceNumber}</div>
            </div>
          </div>

          <div className="body">
            {/* META BAR */}
            <div className="meta-bar">
              <div className="meta-chip"><div className="meta-key">Fatura Tarihi</div><div className="meta-val">{fmtDate(invoice.invoiceDate)}</div></div>
              <div className="meta-chip"><div className="meta-key">Vade Tarihi</div><div className="meta-val">{fmtDate(invoice.dueDate)}</div></div>
              <div className="meta-chip"><div className="meta-key">Dönem</div><div className="meta-val">{invoice.period}</div></div>
              <div className="meta-chip">
                <div className="meta-key">Durum</div>
                <div style={{ marginTop: '3px' }}>
                  <span className="status-badge" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                </div>
              </div>
            </div>

            {/* MÜŞTERİ */}
            <div className="info-card">
              <div className="info-card-header">👤 Sayın (Alıcı)</div>
              <div className="info-card-body">
                <div className="info-row"><span className="info-key">Ad / Unvan</span><span className="info-val">{c.name}</span></div>
                <div className="info-row"><span className="info-key">Telefon</span><span className="info-val">{c.phone}</span></div>
                {c.taxNo && <div className="info-row"><span className="info-key">Vergi No</span><span className="info-val">{c.taxNo}</span></div>}
                {c.contactPerson && <div className="info-row"><span className="info-key">Yetkili</span><span className="info-val">{c.contactPerson}</span></div>}
                {c.address && <div className="info-row" style={{ gridColumn: '1 / -1' }}><span className="info-key">Adres</span><span className="info-val" style={{ fontSize: '12px' }}>{c.address}</span></div>}
              </div>
            </div>

            {/* KALEMLER */}
            <div className="section-title">📑 Fatura Kalemleri</div>
            {invoice.lines.length === 0 ? (
              <div className="empty">Bu faturada kalem bulunmuyor.</div>
            ) : (
              <table className="ext-table">
                <thead>
                  <tr>
                    <th>Açıklama</th>
                    <th className="num" style={{ width: '60px' }}>Adet</th>
                    <th className="num" style={{ width: '95px' }}>Birim Fiyat</th>
                    <th className="num" style={{ width: '105px' }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}><span className="kind-badge">{KIND[l.kind] || l.kind}</span>{l.description}</td>
                      <td className="num">{Number(l.quantity).toLocaleString('tr-TR')}</td>
                      <td className="num">{fmt(Number(l.unitPrice))}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmt(Number(l.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* TOPLAMLAR */}
            <div className="totals">
              <div className="totals-box">
                <div className="totals-row sub"><span>Ara Toplam</span><span className="num">{fmt(subtotal)}</span></div>
                <div className="totals-row sub"><span>KDV (%{vatRate.toLocaleString('tr-TR')})</span><span className="num">{fmt(vatAmount)}</span></div>
                <div className="totals-row grand"><span>Genel Toplam</span><span className="num">{fmt(totalAmount)}</span></div>
                {paidAmount > 0 && <div className="totals-row paid"><span>Tahsil Edilen</span><span className="num">{fmt(paidAmount)}</span></div>}
                <div className="totals-row open"><span>Kalan Tutar</span><span className="num">{fmt(openAmount)}</span></div>
              </div>
            </div>

            {/* İMZA */}
            <div className="signature-grid">
              {['Teslim Eden', 'Teslim Alan'].map((label) => (
                <div key={label} className="sig-box"><div className="sig-area" /><div className="sig-label">{label} İmza / Kaşe</div></div>
              ))}
            </div>
          </div>

          <div className="footer">
            Bu belge {t.name} tarafından {fmtDate(invoice.invoiceDate)} tarihinde düzenlenmiştir.
            {openAmount > 0 ? ` Ödeme vadesi: ${fmtDate(invoice.dueDate)}.` : ' Ödeme tamamlanmıştır, teşekkür ederiz.'}
          </div>
        </div>
      </div>
    </>
  );
}
