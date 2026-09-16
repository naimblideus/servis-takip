import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DokumPrintButton from '@/components/DokumPrintButton';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { bicimYap, INTL_LOCALE } from '@/lib/bicim';

export default async function CihazDokumuPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ bos?: string }>;
}) {
    const { id } = await params;
    const { bos } = await searchParams;
    const blank = bos === '1'; // sayaç sütunu boş → teknisyenin dolduracağı saha föyü

    const session = await auth();
    if (!session) redirect('/login');
    const user = await oturumKullanicisi(session);
    if (!user) redirect('/login');

    // TENANT-scoped (başka bayinin müşterisi yazdırılamaz)
    // Kâğıdı MÜŞTERİ imzalıyor: dil bayiden geliyor, ekranı açan
    // kullanıcıdan değil.
    const { bayiDili, bayiSz: sz } = await sunucuBicimi(user);
    const b = bicimYap(bayiDili);
    const nf = (n: number | null | undefined) => (n == null ? '—' : b.sayi(n));

    const customer = await prisma.customer.findFirst({
        where: { id, tenantId: user.tenantId },
        select: { id: true, name: true, phone: true, address: true },
    });
    if (!customer) redirect('/customers');

    const devices = await prisma.device.findMany({
        where: { tenantId: user.tenantId, customerId: id },
        select: {
            id: true, brand: true, model: true, serialNo: true, location: true,
            isRental: true, counterBlack: true, counterColor: true,
        },
    });

    // Son okuma tarihleri — TOPLU (N+1 yok)
    const readings = devices.length
        ? await prisma.counterReading.groupBy({
            by: ['deviceId'],
            where: { tenantId: user.tenantId, deviceId: { in: devices.map((d) => d.id) } },
            _max: { readingDate: true },
        })
        : [];
    const lastRead = new Map(readings.map((r) => [r.deviceId, r._max.readingDate]));

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

    // Kat/oda sırasına diz; konumu olmayanlar sona
    const coll = new Intl.Collator(INTL_LOCALE[bayiDili], { numeric: true, sensitivity: 'base' });
    const sorted = [...devices].sort((a, b) => {
        const la = a.location || '', lb = b.location || '';
        if (!la && lb) return 1;
        if (la && !lb) return -1;
        const byLoc = coll.compare(la, lb);
        return byLoc !== 0 ? byLoc : coll.compare(`${a.brand} ${a.model}`, `${b.brand} ${b.model}`);
    });

    // Konuma göre grupla
    const groups: { loc: string; items: typeof sorted }[] = [];
    for (const d of sorted) {
        const loc = d.location || sz.dokum.konumBelirtilmemis;
        const g = groups[groups.length - 1];
        if (g && g.loc === loc) g.items.push(d);
        else groups.push({ loc, items: [d] });
    }

    const noLocation = devices.filter((d) => !d.location).length;
    const rentalCount = devices.filter((d) => d.isRental).length;

    return (
        <>
            <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter','Segoe UI',sans-serif; background: #e5e7eb; color: #111827; }
        @page { size: A4 portrait; margin: 10mm 10mm; }

        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          #app-main { padding-top: 0 !important; padding-bottom: 0 !important; overflow: visible !important; }
          .flex.min-h-screen { display: block !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pw { padding: 0 !important; background: #fff !important; }
          .card { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; border: none !important; }
          table thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          .grp { page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen {
          .pw { padding: 2rem 1rem; min-height: 100vh; background: #e5e7eb; }
          .card { max-width: 794px; margin: 0 auto; background: #fff; border-radius: 12px;
                  box-shadow: 0 8px 40px rgba(0,0,0,.14); padding: 22px 24px 26px; border: 1px solid #e5e7eb; }
        }

        .head { display:flex; justify-content:space-between; align-items:flex-start;
                padding-bottom:12px; border-bottom:2px solid #0f2253; margin-bottom:14px; }
        .logo { max-height:44px; max-width:120px; object-fit:contain; }
        .company { font-size:15px; font-weight:800; color:#0f2253; letter-spacing:-.01em; }
        .company-sub { font-size:10px; color:#6b7280; margin-top:3px; line-height:1.5; }
        .title { font-size:14px; font-weight:800; color:#0f2253; letter-spacing:.03em; text-transform:uppercase; text-align:right; }
        .meta { font-size:10px; color:#9ca3af; margin-top:3px; text-align:right; }

        .cust { background:#f0f4fa; border-left:3px solid #0f2253; padding:9px 12px;
                margin-bottom:14px; border-radius:6px; font-size:12px; line-height:1.6; }
        .cust b { color:#0f2253; }

        .grp { margin-bottom:14px; }
        .grp-h { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em;
                 color:#0f2253; background:#f0f4fa; padding:5px 10px; border-radius:5px; margin-bottom:6px; }
        /* min-width: sabit sütunlar 390 px tuttuğu için Marka/Model sütununa
           telefonda sıfır piksel kalıyordu (ölçüldü: hücre genişliği 0). Taban
           genişlik verilince sütun payını alıyor, tablo da .tbl-kaydir içinde
           yana kayıyor. Yazdırmada sayfa ~718 px olduğu için çıktı DEĞİŞMEZ. */
        table { width:100%; min-width:530px; border-collapse:collapse; font-size:11px; table-layout:fixed; }
        .tbl-kaydir { overflow-x:auto; }
        @media print { .tbl-kaydir { overflow:visible !important; } }
        th { background:#fafbfd; border-bottom:1.5px solid #cbd5e1; padding:6px 6px; text-align:left;
             font-size:9px; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:.04em; }
        td { padding:7px 6px; border-bottom:1px solid #eef2f7; vertical-align:top; line-height:1.4; }
        .c-no { width:24px; text-align:right; color:#9ca3af; }
        .c-dev { width:auto; }   /* payini tablonun min-width'inden alir */
        .c-ser { width:104px; }
        .c-kind { width:52px; }
        .c-cnt { width:74px; text-align:right; }
        .c-date { width:62px; }
        .brand { font-weight:700; color:#111827; }
        .model { color:#6b7280; font-size:10px; }
        .mono { font-family:'Courier New',monospace; font-size:10.5px; }
        .pill { font-size:8.5px; font-weight:700; padding:1px 6px; border-radius:999px; white-space:nowrap; }
        .blank-box { border-bottom:1px solid #9ca3af; height:14px; }

        .foot { margin-top:16px; padding-top:12px; border-top:2px solid #0f2253;
                display:flex; justify-content:space-between; align-items:flex-end; gap:20px; }
        .totals { font-size:11px; color:#6b7280; line-height:1.6; }
        .totals b { color:#0f2253; font-size:13px; }
        .sig-wrap { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:24px; padding-top:14px; border-top:1px dashed #cbd5e1; }
        .sig { text-align:center; }
        .sig-a { height:42px; border-bottom:1.5px solid #9ca3af; margin-bottom:5px; }
        .sig-l { font-size:10px; color:#6b7280; font-weight:600; }
        .note { text-align:center; font-size:9px; color:#9ca3af; margin-top:14px; padding-top:8px; border-top:1px solid #f3f4f6; }
        .warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-size:10px;
                padding:6px 10px; border-radius:6px; margin-bottom:10px; }
      `}</style>

            <DokumPrintButton customerId={customer.id} blank={blank} count={devices.length} />

            <div className="pw" lang={bayiDili}>
                <div className="card">
                    <div className="head">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            {tenant?.logo && <img src={tenant.logo} alt="" className="logo" />}
                            <div>
                                <div className="company">{tenant?.name || sz.dokum.firmaVarsayilan}</div>
                                <div className="company-sub">
                                    {tenant?.phone && <>📞 {tenant.phone}<br /></>}
                                    {tenant?.address}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="title">{blank ? sz.dokum.baslikFoy : sz.dokum.baslikDokum}</div>
                            <div className="meta">
                                {doldur(sz.dokum.cihazAdet, { n: devices.length })}
                                {rentalCount > 0 && doldur(sz.dokum.kiralikEk, { n: rentalCount })}<br />
                                {b.tarih(new Date())}
                            </div>
                        </div>
                    </div>

                    <div className="cust">
                        <b>{sz.dokum.musteri}</b> {customer.name}
                        {customer.phone && <> · 📞 {customer.phone}</>}
                        {customer.address && <><br /><span style={{ color: '#6b7280' }}>{customer.address}</span></>}
                    </div>

                    {noLocation > 0 && (
                        <div className="warn no-print">
                            {doldur(sz.dokum.konumsuzUyari, { n: noLocation })}
                        </div>
                    )}

                    {devices.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
                            {sz.dokum.cihazYok}
                        </div>
                    ) : (
                        <>
                            {groups.map((g, gi) => (
                                <div className="grp" key={gi}>
                                    <div className="grp-h">📍 {g.loc} <span style={{ opacity: .6, fontWeight: 700 }}>({g.items.length})</span></div>
                                    <div className="tbl-kaydir">
            <table>
                                        <thead>
                                            <tr>
                                                <th className="c-no">#</th>
                                                <th className="c-dev">{sz.dokum.sutunCihaz}</th>
                                                <th className="c-ser">{sz.dokum.sutunSeri}</th>
                                                <th className="c-kind">{sz.dokum.sutunTur}</th>
                                                <th className="c-cnt">{sz.dokum.sutunSiyah}</th>
                                                <th className="c-cnt">{sz.dokum.sutunRenkli}</th>
                                                <th className="c-date">{blank ? sz.dokum.sutunTarih : sz.dokum.sutunSonOkuma}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.items.map((d, i) => {
                                                const lr = lastRead.get(d.id);
                                                return (
                                                    <tr key={d.id}>
                                                        <td className="c-no">{i + 1}</td>
                                                        <td className="c-dev">
                                                            <div className="brand">{d.brand}</div>
                                                            <div className="model">{d.model}</div>
                                                        </td>
                                                        <td className="c-ser mono">{d.serialNo}</td>
                                                        <td className="c-kind">
                                                            <span className="pill" style={{
                                                                background: d.isRental ? '#EAEDFB' : '#F2F4F8',
                                                                color: d.isRental ? '#2E3A8C' : '#5B6479',
                                                            }}>{d.isRental ? sz.dokum.turKiralik : sz.dokum.turMusteri}</span>
                                                        </td>
                                                        <td className="c-cnt mono">
                                                            {blank ? <div className="blank-box" /> : nf(d.counterBlack)}
                                                        </td>
                                                        <td className="c-cnt mono">
                                                            {blank ? <div className="blank-box" /> : nf(d.counterColor)}
                                                        </td>
                                                        <td className="c-date mono" style={{ color: '#6b7280' }}>
                                                            {blank ? <div className="blank-box" /> : (lr ? b.kisaTarih(lr) : '—')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
            </div>
                                </div>
                            ))}

                            <div className="foot">
                                <div className="totals">
                                    {sz.dokum.toplamOn} <b>{devices.length}</b> {sz.dokum.toplamSon}
                                    {rentalCount > 0 && <> · <b>{rentalCount}</b> {sz.dokum.kiralikSon}</>}
                                    <br />
                                    <span style={{ fontSize: 10 }}>{doldur(sz.dokum.konumAdet, { n: groups.length })}</span>
                                </div>
                            </div>

                            <div className="sig-wrap">
                                <div className="sig"><div className="sig-a" /><div className="sig-l">{sz.dokum.imzaTeslimEden}</div></div>
                                <div className="sig"><div className="sig-a" /><div className="sig-l">{sz.dokum.imzaTeslimAlan}</div></div>
                            </div>
                        </>
                    )}

                    <div className="note">
                        {tenant?.name || sz.dokum.firmaVarsayilan} · {blank ? sz.dokum.baslikFoy : sz.dokum.baslikDokum} · {b.tarih(new Date())}
                    </div>
                </div>
            </div>
        </>
    );
}
