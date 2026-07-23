import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TopluPrintButton from '@/components/TopluPrintButton';

const STATUS_TR: Record<string, string> = {
    NEW: 'Yeni', IN_SERVICE: 'Serviste', WAITING_FOR_PART: 'Parça Bkl.',
    READY: 'Hazır', DELIVERED: 'Teslim', CANCELLED: 'İptal',
};

const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default async function TopluYazdirPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; priority?: string; assignedUserId?: string; dateFrom?: string; dateTo?: string; customer?: string }>;
}) {
    const sp = await searchParams;
    const session = await auth();
    if (!session) redirect('/login');
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) redirect('/login');

    // Filtreler — /tickets liste sayfasıyla BİREBİR aynı mantık (tenant + soft-delete güvenli)
    const where: any = { tenantId: user.tenantId, deletedAt: null };
    if (sp.status) where.status = sp.status;
    if (sp.priority) where.priority = sp.priority;
    if (sp.assignedUserId) {
        where.assignedUserId = sp.assignedUserId === 'unassigned' ? null : sp.assignedUserId;
    }
    if (sp.dateFrom || sp.dateTo) {
        where.createdAt = {};
        if (sp.dateFrom) {
            const [y, m, d] = sp.dateFrom.split('-').map(Number);
            where.createdAt.gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
        }
        if (sp.dateTo) {
            const [y, m, d] = sp.dateTo.split('-').map(Number);
            where.createdAt.lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        }
    }
    if (sp.customer) {
        const q = sp.customer.trim();
        where.OR = [
            { device: { customer: { name: { contains: q, mode: 'insensitive' } } } },
            { device: { customer: { phone: { contains: q } } } },
            { ticketNumber: { contains: q, mode: 'insensitive' } },
            { device: { brand: { contains: q, mode: 'insensitive' } } },
            { device: { model: { contains: q, mode: 'insensitive' } } },
        ];
    }

    const tickets = await prisma.serviceTicket.findMany({
        where,
        include: {
            device: { select: { brand: true, model: true, customer: { select: { id: true, name: true, phone: true } } } },
            payments: { select: { amount: true } },
            assignedUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' }, // kronolojik (ekstre gibi)
    });

    // Fişe bağlı sayaç okumaları — TOPLU (N+1 önle), tenant-scoped
    const ticketIds = tickets.map(t => t.id);
    const readings = ticketIds.length ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, ticketId: { in: ticketIds } },
        orderBy: { readingDate: 'desc' },
        select: { ticketId: true, counterBlack: true, counterColor: true },
    }) : [];
    const readingMap = new Map<string, { b: number | null; c: number | null }>();
    for (const r of readings) {
        if (r.ticketId && !readingMap.has(r.ticketId)) {
            readingMap.set(r.ticketId, { b: r.counterBlack, c: r.counterColor });
        }
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

    // Toplamlar
    let totalSum = 0, paidSum = 0, remainingSum = 0;
    const rows = tickets.map((t) => {
        const cost = Number(t.totalCost || 0);
        const paid = t.payments.reduce((s, p) => s + Number(p.amount), 0);
        const remaining = Math.max(0, cost - paid);
        totalSum += cost; paidSum += paid; remainingSum += remaining;
        const rd = readingMap.get(t.id);
        return { t, cost, paid, remaining, reading: rd };
    });

    // Tek müşteri filtresi → başlıkta göster
    const uniqueCustomers = Array.from(new Set(tickets.map(t => t.device.customer.id)));
    const singleCustomer = uniqueCustomers.length === 1 && tickets[0] ? tickets[0].device.customer : null;

    const rangeLabel = (() => {
        const from = sp.dateFrom ? new Date(sp.dateFrom).toLocaleDateString('tr-TR') : null;
        const to = sp.dateTo ? new Date(sp.dateTo).toLocaleDateString('tr-TR') : null;
        if (from && to) return `${from} — ${to}`;
        if (from) return `${from}'den itibaren`;
        if (to) return `${to}'ye kadar`;
        return 'Tüm tarihler';
    })();

    return (
        <>
            <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }

        @page { size: A4 portrait; margin: 8mm 8mm; }

        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          #app-main { padding-top: 0 !important; padding-bottom: 0 !important; overflow: visible !important; }
          .flex.min-h-screen { display: block !important; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-wrapper { padding: 0 !important; background: white !important; }
          .icmal-card {
            box-shadow: none !important; border-radius: 0 !important;
            margin: 0 !important; padding: 0 !important; max-width: 100% !important; border: none !important;
          }
          table.icmal thead { display: table-header-group; }
          table.icmal tr { page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        @media screen {
          .print-wrapper { padding: 2rem 1rem; min-height: 100vh; background: #e5e7eb; }
          .icmal-card {
            max-width: 794px; margin: 0 auto; background: white;
            border-radius: 12px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.14);
            padding: 20px 22px 24px;
            border: 1px solid #e5e7eb;
          }
        }

        .head {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 12px; border-bottom: 2px solid #0f2253;
          margin-bottom: 14px;
        }
        .head-left { display: flex; gap: 12px; align-items: flex-start; }
        .logo { max-height: 44px; max-width: 120px; object-fit: contain; }
        .company { font-size: 15px; font-weight: 800; color: #0f2253; letter-spacing: -.01em; }
        .company-sub { font-size: 10px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
        .head-right { text-align: right; }
        .title { font-size: 14px; font-weight: 800; color: #0f2253; letter-spacing: .03em; text-transform: uppercase; }
        .range { font-size: 11px; color: #374151; margin-top: 4px; font-weight: 600; }
        .customer-strip {
          background: #f0f4fa; border-left: 3px solid #0f2253;
          padding: 8px 12px; margin-bottom: 12px; border-radius: 6px;
          font-size: 12px;
        }
        .customer-strip b { color: #0f2253; }

        table.icmal { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
        table.icmal thead th {
          background: #f0f4fa;
          border-bottom: 1.5px solid #cbd5e1;
          padding: 6px 5px; text-align: left;
          font-size: 9px; font-weight: 800; color: #0f2253;
          text-transform: uppercase; letter-spacing: 0.04em;
          white-space: nowrap;
        }
        table.icmal td {
          padding: 6px 5px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
          line-height: 1.4;
          overflow: hidden;
        }
        table.icmal tr:nth-child(even) td { background: #fafbfd; }
        .num { font-family: 'Courier New', monospace; font-size: 10px; }
        .col-no { width: 22px; text-align: right; color: #9ca3af; }
        .col-date { width: 52px; }
        .col-fis { width: 60px; }
        .col-device { width: 92px; }
        .col-sayac { width: 68px; }
        .col-money { width: 58px; text-align: right; }
        .fis-no { color: #1d4ed8; font-weight: 700; font-size: 10px; }
        .device-brand { font-weight: 700; color: #111827; }
        .device-model { color: #6b7280; font-size: 9.5px; }
        .issue-txt { font-weight: 600; color: #111827; }
        .action-txt { color: #4b5563; margin-top: 2px; font-size: 10px; }
        .action-txt::before { content: '↳ '; color: #9ca3af; }
        .money { text-align: right; white-space: nowrap; font-weight: 700; }
        .money.green { color: #059669; }
        .money.red { color: #dc2626; }
        .money.zero { color: #9ca3af; font-weight: 500; }
        .status-mini { font-size: 9px; color: #6b7280; margin-top: 2px; }

        .totals {
          margin-top: 16px; padding-top: 12px;
          border-top: 2px solid #0f2253;
          display: grid; grid-template-columns: 1fr auto auto auto; gap: 20px; align-items: end;
        }
        .totals-left { font-size: 11px; color: #6b7280; line-height: 1.5; }
        .total-box { text-align: right; min-width: 90px; }
        .total-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; margin-bottom: 2px; }
        .total-value { font-size: 14px; font-weight: 800; color: #0f2253; font-family: 'Courier New', monospace; }
        .total-value.green { color: #059669; }
        .total-value.red { color: #dc2626; }

        .footer-sign {
          margin-top: 22px; padding-top: 14px;
          border-top: 1px dashed #cbd5e1;
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
        }
        .sig { text-align: center; }
        .sig-area { height: 40px; border-bottom: 1.5px solid #9ca3af; margin-bottom: 5px; }
        .sig-label { font-size: 10px; color: #6b7280; font-weight: 600; }

        .footer-note {
          text-align: center; font-size: 9px; color: #9ca3af;
          margin-top: 14px; padding-top: 8px; border-top: 1px solid #f3f4f6;
        }

        .empty {
          padding: 40px 20px; text-align: center; color: #6b7280;
          background: #f9fafb; border-radius: 8px; border: 1px dashed #d1d5db;
        }
      `}</style>

            <TopluPrintButton count={tickets.length} />

            <div className="print-wrapper">
                <div className="icmal-card">

                    {/* HEADER */}
                    <div className="head">
                        <div className="head-left">
                            {tenant?.logo && <img src={tenant.logo} alt="Logo" className="logo" />}
                            <div>
                                <div className="company">{tenant?.name || 'Nexus Servis'}</div>
                                <div className="company-sub">
                                    {tenant?.phone && <>📞 {tenant.phone}<br /></>}
                                    {tenant?.address}
                                </div>
                            </div>
                        </div>
                        <div className="head-right">
                            <div className="title">Servis İcmali</div>
                            <div className="range">{rangeLabel}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                                {tickets.length} kayıt · {new Date().toLocaleDateString('tr-TR')} tarihinde düzenlendi
                            </div>
                        </div>
                    </div>

                    {/* MÜŞTERİ ŞERİDİ (tek müşteriyse) */}
                    {singleCustomer && (
                        <div className="customer-strip">
                            <b>Müşteri:</b> {singleCustomer.name}
                            {singleCustomer.phone && <> · 📞 {singleCustomer.phone}</>}
                        </div>
                    )}

                    {/* TABLO */}
                    {rows.length === 0 ? (
                        <div className="empty">
                            Bu filtrelerle eşleşen fiş yok.
                        </div>
                    ) : (
                        <table className="icmal">
                            <thead>
                                <tr>
                                    <th className="col-no">#</th>
                                    <th className="col-date">Tarih</th>
                                    <th className="col-fis">Fiş No</th>
                                    <th className="col-device">Cihaz</th>
                                    <th>Arıza / Yapılan İşlem</th>
                                    <th className="col-sayac">Sayaç</th>
                                    <th className="col-money">Tutar</th>
                                    <th className="col-money">Ödenen</th>
                                    <th className="col-money">Kalan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(({ t, cost, paid, remaining, reading }, i) => (
                                    <tr key={t.id}>
                                        <td className="col-no">{i + 1}</td>
                                        <td className="col-date num">{shortDate(new Date(t.createdAt))}</td>
                                        <td className="col-fis"><span className="fis-no">{t.ticketNumber}</span>
                                            <div className="status-mini">{STATUS_TR[t.status] || t.status}</div>
                                        </td>
                                        <td className="col-device">
                                            <div className="device-brand">{t.device.brand}</div>
                                            <div className="device-model">{t.device.model}</div>
                                        </td>
                                        <td>
                                            {t.issueText && <div className="issue-txt">{t.issueText}</div>}
                                            {t.actionText && <div className="action-txt">{t.actionText}</div>}
                                            {!t.issueText && !t.actionText && <span style={{ color: '#9ca3af' }}>—</span>}
                                        </td>
                                        <td className="col-sayac num">
                                            {reading?.b != null ? (
                                                <>⚫ {reading.b.toLocaleString('tr-TR')}</>
                                            ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                            {reading?.c != null && reading.c > 0 && (
                                                <div style={{ color: '#7c3aed', fontSize: 9 }}>🟣 {reading.c.toLocaleString('tr-TR')}</div>
                                            )}
                                        </td>
                                        <td className="col-money money">{fmt(cost)}</td>
                                        <td className={`col-money money ${paid > 0 ? 'green' : 'zero'}`}>{fmt(paid)}</td>
                                        <td className={`col-money money ${remaining > 0 ? 'red' : 'zero'}`}>{fmt(remaining)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* TOPLAMLAR */}
                    {rows.length > 0 && (
                        <div className="totals">
                            <div className="totals-left">
                                <b>{tickets.length}</b> servis fişi<br />
                                Dönem: <b>{rangeLabel}</b>
                            </div>
                            <div className="total-box">
                                <div className="total-label">Toplam</div>
                                <div className="total-value">₺{fmt(totalSum)}</div>
                            </div>
                            <div className="total-box">
                                <div className="total-label">Ödenen</div>
                                <div className="total-value green">₺{fmt(paidSum)}</div>
                            </div>
                            <div className="total-box">
                                <div className="total-label">Kalan Bakiye</div>
                                <div className={`total-value ${remainingSum > 0 ? 'red' : 'green'}`}>₺{fmt(remainingSum)}</div>
                            </div>
                        </div>
                    )}

                    {/* İMZA */}
                    {rows.length > 0 && (
                        <div className="footer-sign">
                            <div className="sig">
                                <div className="sig-area" />
                                <div className="sig-label">Müşteri İmzası</div>
                            </div>
                            <div className="sig">
                                <div className="sig-area" />
                                <div className="sig-label">Yetkili İmza</div>
                            </div>
                        </div>
                    )}

                    <div className="footer-note">
                        {tenant?.name || 'Nexus Servis'} · Servis icmal raporu · {new Date().toLocaleDateString('tr-TR')}
                    </div>
                </div>
            </div>
        </>
    );
}
