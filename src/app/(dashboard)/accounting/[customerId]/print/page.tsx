import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default async function CariEkstrePrintPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) redirect('/login');

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: user.tenantId },
    include: { tenant: true },
  });
  if (!customer) redirect('/accounting');

  const entries = await prisma.accountEntry.findMany({
    where: { tenantId: user.tenantId, customerId },
    orderBy: { date: 'asc' },
  });

  let running = 0;
  const rows = entries.map((e) => {
    const isSale = e.type === 'SALE';
    const amount = Number(e.amount);
    running += isSale ? amount : -amount;
    return {
      date: e.date,
      desc: isSale ? (e.product || 'Satış / Hizmet') : 'Ödeme / Tahsilat',
      method: e.method,
      notes: e.notes,
      debit: isSale ? amount : 0,
      credit: isSale ? 0 : amount,
      balance: running,
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const balance = totalDebit - totalCredit;
  const t = customer.tenant;

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
        .header-right { text-align: right; position: relative; z-index: 1; }
        .doc-label { font-size: 9px; font-weight: 700; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; }
        .doc-title { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: 0.3px; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .doc-date { font-size: 11px; opacity: 0.75; margin-top: 5px; }
        .body { padding: 18px 24px; }
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
        .ext-total td { border-top: 2px solid #d1d5db !important; font-weight: 800; background: #f9fafb; font-size: 13px; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .pay-row { display: flex; justify-content: flex-end; gap: 14px; margin-bottom: 14px; }
        .pay-box { border: 2px solid #e5e7eb; border-radius: 12px; padding: 12px 20px; text-align: center; min-width: 120px; background: #f9fafb; }
        .pay-label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .pay-value { font-size: 22px; font-weight: 800; margin-top: 4px; line-height: 1; }
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
              </div>
            </div>
            <div className="header-right">
              <div className="doc-label">Cari Hesap Ekstresi</div>
              <div className="doc-title">{fmt(balance)}</div>
              <div className="doc-date">{fmtDate(new Date())} itibarıyla</div>
            </div>
          </div>

          <div className="body">
            {/* MÜŞTERİ */}
            <div className="info-card">
              <div className="info-card-header">👤 Müşteri Bilgileri</div>
              <div className="info-card-body">
                <div className="info-row"><span className="info-key">Ad / Unvan</span><span className="info-val">{customer.name}</span></div>
                <div className="info-row"><span className="info-key">Telefon</span><span className="info-val">{customer.phone}</span></div>
                {customer.taxNo && <div className="info-row"><span className="info-key">Vergi No</span><span className="info-val">{customer.taxNo}</span></div>}
                {customer.contactPerson && <div className="info-row"><span className="info-key">Yetkili</span><span className="info-val">{customer.contactPerson}</span></div>}
                {customer.address && <div className="info-row" style={{ gridColumn: '1 / -1' }}><span className="info-key">Adres</span><span className="info-val" style={{ fontSize: '12px' }}>{customer.address}</span></div>}
              </div>
            </div>

            {/* EKSTRE TABLOSU */}
            <div className="section-title">📑 Hesap Hareketleri</div>
            {rows.length === 0 ? (
              <div className="empty">Bu müşteri için kayıtlı hesap hareketi bulunmuyor.</div>
            ) : (
              <table className="ext-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Tarih</th>
                    <th>Açıklama</th>
                    <th className="num" style={{ width: '90px' }}>Borç</th>
                    <th className="num" style={{ width: '90px' }}>Alacak</th>
                    <th className="num" style={{ width: '100px' }}>Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: '#6b7280', fontSize: '11.5px' }}>{fmtDate(r.date)}</td>
                      <td style={{ fontWeight: 600 }}>{r.desc}{r.notes ? <span style={{ color: '#9ca3af', fontWeight: 400 }}> — {r.notes}</span> : ''}</td>
                      <td className="num" style={{ color: r.debit ? '#b91c1c' : '#d1d5db' }}>{r.debit ? fmt(r.debit) : '—'}</td>
                      <td className="num" style={{ color: r.credit ? '#059669' : '#d1d5db' }}>{r.credit ? fmt(r.credit) : '—'}</td>
                      <td className="num" style={{ fontWeight: 700, color: r.balance > 0 ? '#b91c1c' : '#059669' }}>{fmt(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="ext-total">
                    <td colSpan={2} style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>TOPLAM</td>
                    <td className="num" style={{ color: '#b91c1c' }}>{fmt(totalDebit)}</td>
                    <td className="num" style={{ color: '#059669' }}>{fmt(totalCredit)}</td>
                    <td className="num" style={{ color: balance > 0 ? '#b91c1c' : '#059669' }}>{fmt(balance)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* ÖZET */}
            <div className="pay-row">
              <div className="pay-box"><div className="pay-label">Toplam Borç</div><div className="pay-value" style={{ color: '#b91c1c' }}>{fmt(totalDebit)}</div></div>
              <div className="pay-box" style={{ borderColor: '#86efac', background: '#f0fdf4' }}><div className="pay-label">Toplam Tahsilat</div><div className="pay-value" style={{ color: '#059669' }}>{fmt(totalCredit)}</div></div>
              <div className="pay-box" style={{ borderColor: balance > 0 ? '#fca5a5' : '#86efac', background: balance > 0 ? '#fef2f2' : '#f0fdf4' }}>
                <div className="pay-label">{balance > 0 ? 'Kalan Borç' : 'Bakiye'}</div>
                <div className="pay-value" style={{ color: balance > 0 ? '#dc2626' : '#059669' }}>{fmt(Math.abs(balance))}</div>
              </div>
            </div>

            {/* İMZA */}
            <div className="signature-grid">
              {['Müşteri', 'Yetkili'].map((label) => (
                <div key={label} className="sig-box"><div className="sig-area" /><div className="sig-label">{label} İmza / Kaşe</div></div>
              ))}
            </div>
          </div>

          <div className="footer">
            Bu ekstre {t.name} tarafından {fmtDate(new Date())} tarihinde düzenlenmiştir. Bilgilendirme amaçlıdır.
          </div>
        </div>
      </div>
    </>
  );
}
