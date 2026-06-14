import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const METHOD: Record<string, string> = { CASH: 'Nakit', CARD: 'Kredi Kartı', TRANSFER: 'IBAN / Havale', OPEN_ACCOUNT: 'Açık Hesap', OTHER: 'Diğer' };

export default async function ReceiptPrintPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) redirect('/login');

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId },
    include: {
      customer: true,
      tenant: true,
      allocations: { include: { invoice: { select: { invoiceNumber: true, status: true, totalAmount: true, paidAmount: true } } } },
    },
  });
  if (!payment) redirect('/collections');

  const t = payment.tenant;
  const c = payment.customer;
  const amount = Number(payment.amount);
  const allocated = payment.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const advance = Math.round((amount - allocated) * 100) / 100;
  const receiptNo = `SF-MKB-${payment.id.slice(-6).toUpperCase()}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }
        @page { size: A5 portrait; margin: 8mm 10mm; }
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
          .receipt { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.16); overflow: hidden; border: 1px solid #e5e7eb; }
        }
        .header { background: linear-gradient(135deg, #064e3b 0%, #047857 55%, #10b981 100%); color: white; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .header::after { content: ''; position: absolute; top: -40px; right: -40px; width: 150px; height: 150px; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .header-left { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
        .header-logo { max-height: 46px; max-width: 120px; object-fit: contain; background: white; border-radius: 8px; padding: 4px 8px; }
        .company-name { font-size: 16px; font-weight: 800; line-height: 1.2; }
        .company-sub { font-size: 11px; opacity: 0.8; margin-top: 2px; }
        .header-right { text-align: right; position: relative; z-index: 1; }
        .doc-label { font-size: 9px; font-weight: 700; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(255,255,255,0.18); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .doc-title { font-size: 24px; font-weight: 800; line-height: 1; text-shadow: 0 2px 8px rgba(0,0,0,0.25); }
        .doc-no { font-size: 11px; opacity: 0.85; margin-top: 5px; font-variant-numeric: tabular-nums; }
        .body { padding: 18px 24px; }
        .info-card { border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
        .info-card-header { background: linear-gradient(90deg, #f9fafb, #f3f4f6); border-bottom: 1.5px solid #e5e7eb; padding: 7px 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; }
        .info-card-body { padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
        .info-row { display: flex; align-items: baseline; }
        .info-key { font-size: 11px; color: #9ca3af; width: 84px; flex-shrink: 0; font-weight: 500; }
        .info-val { font-size: 13px; font-weight: 700; color: #111827; }
        .amount-card { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 18px; margin-bottom: 14px; text-align: center; }
        .amount-label { font-size: 10px; color: #047857; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .amount-value { font-size: 32px; font-weight: 800; color: #047857; line-height: 1.1; margin-top: 4px; }
        .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        .ext-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .ext-table thead tr { background: linear-gradient(90deg, #f9fafb, #f3f4f6); }
        .ext-table th { padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
        .ext-table td { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
        .ext-table tr:last-child td { border-bottom: none; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .pill { display: inline-block; padding: 1px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 18px; padding-top: 14px; border-top: 2px solid #e5e7eb; }
        .sig-box { text-align: center; }
        .sig-area { height: 48px; border-bottom: 2px solid #9ca3af; margin-bottom: 6px; }
        .sig-label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .footer { text-align: center; font-size: 10px; color: #9ca3af; padding: 10px 24px 14px; border-top: 1px solid #f3f4f6; background: #fafafa; }
        .empty { text-align: center; color: #9ca3af; padding: 18px; font-size: 12.5px; }
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
                <div className="company-sub">{t.phone && `📞 ${t.phone}`}</div>
              </div>
            </div>
            <div className="header-right">
              <div className="doc-label">Tahsilat Makbuzu</div>
              <div className="doc-title">{fmt(amount)}</div>
              <div className="doc-no">{receiptNo}</div>
            </div>
          </div>

          <div className="body">
            {/* TUTAR */}
            <div className="amount-card">
              <div className="amount-label">Tahsil Edilen Tutar</div>
              <div className="amount-value">{fmt(amount)}</div>
            </div>

            {/* ÖDEME BİLGİLERİ */}
            <div className="info-card">
              <div className="info-card-header">💳 Tahsilat Bilgileri</div>
              <div className="info-card-body">
                <div className="info-row"><span className="info-key">Tarih</span><span className="info-val">{fmtDate(payment.paymentDate)}</span></div>
                <div className="info-row"><span className="info-key">Yöntem</span><span className="info-val">{METHOD[payment.method] || payment.method}</span></div>
                <div className="info-row"><span className="info-key">Müşteri</span><span className="info-val">{c?.name || '—'}</span></div>
                {c?.phone && <div className="info-row"><span className="info-key">Telefon</span><span className="info-val">{c.phone}</span></div>}
                {payment.referenceNo && <div className="info-row" style={{ gridColumn: '1 / -1' }}><span className="info-key">Dekont/Ref</span><span className="info-val">{payment.referenceNo}</span></div>}
              </div>
            </div>

            {/* MAHSUP EDİLEN FATURALAR */}
            <div className="section-title">📑 Mahsup Edilen Faturalar (FIFO)</div>
            {payment.allocations.length === 0 ? (
              <div className="empty">Açık fatura bulunmadığından tamamı avans olarak kaydedilmiştir.</div>
            ) : (
              <table className="ext-table">
                <thead>
                  <tr>
                    <th>Fatura No</th>
                    <th style={{ width: '90px' }}>Durum</th>
                    <th className="num" style={{ width: '110px' }}>Mahsup</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.allocations.map((a, i) => {
                    const paid = a.invoice.status === 'PAID';
                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.invoice.invoiceNumber}</td>
                        <td><span className="pill" style={{ background: paid ? '#dcfce7' : '#fef3c7', color: paid ? '#15803d' : '#b45309' }}>{paid ? 'Kapandı' : 'Kısmi'}</span></td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmt(Number(a.amount))}</td>
                      </tr>
                    );
                  })}
                  {advance > 0 && (
                    <tr>
                      <td colSpan={2} style={{ color: '#6b7280' }}>Avans (gelecek faturaya mahsup)</td>
                      <td className="num" style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(advance)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* İMZA */}
            <div className="signature-grid">
              {['Tahsil Eden', 'Ödeyen'].map((label) => (
                <div key={label} className="sig-box"><div className="sig-area" /><div className="sig-label">{label} İmza</div></div>
              ))}
            </div>
          </div>

          <div className="footer">
            Bu makbuz {t.name} tarafından {fmtDate(payment.paymentDate)} tarihinde düzenlenmiştir. Yukarıdaki tutar tahsil edilmiştir.
          </div>
        </div>
      </div>
    </>
  );
}
