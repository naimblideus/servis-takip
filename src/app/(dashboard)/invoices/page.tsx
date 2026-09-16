'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { openWhatsApp, invoiceMessage } from '@/lib/share';
import { openPrintable } from '@/lib/print';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Line { kind: string; description: string; quantity: number; unitPrice: number; lineTotal: number; }
interface Invoice {
  id: string; docToken?: string; invoiceNumber: string; period: string; invoiceDate: string; dueDate: string;
  status: string; source: string;
  customer: { id: string; name: string; phone: string } | null;
  subtotal: number; vatAmount: number; totalAmount: number; paidAmount: number; openAmount: number;
  lines: Line[];
}
interface Summary { count: number; total: number; open: number; overdue: number; paidCount: number; }

// Etiketler sözlükte (faturalar.durum / faturalar.tur); burada yalnız renk.
const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-gray-100 text-gray-500',
};

export default function InvoicesPage() {
  const router = useRouter();
  const t = useT();
  const b = useBicim();
  const musteri = useMusteriDili(); // müşteriye giden mesaj bayinin dilinde
  const fmt = (n: number) => b.para(n);
  const fmtDate = (s: string) => b.tarih(s);
  const durumAdi = (k: string) => (t.faturalar.durum as Record<string, string>)[k] ?? k;
  const turAdi = (k: string) => (t.faturalar.tur as Record<string, string>)[k] ?? k;
  const { data: session } = useSession();
  const tenantName = (session?.user as any)?.tenantName as string | undefined;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ count: 0, total: 0, open: 0, overdue: 0, paidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<{ loading: boolean; data: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (status !== 'all') p.set('status', status);
    if (search.trim()) p.set('search', search.trim());
    try {
      const res = await fetch(`/api/invoices?${p}`);
      if (res.ok) {
        const d = await res.json();
        setInvoices(d.invoices);
        setSummary(d.summary);
      }
    } catch { /* yoksay */ }
    setLoading(false);
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  // FATURA ÖNCESİ SAYAÇ ÖN KONTROLÜ — çıplak onay yerine "hangi cihazın sayacı okunmadı" ekranı
  const openPreflight = async () => {
    setPreflight({ loading: true, data: null });
    try {
      const r = await fetch('/api/invoices/preflight');
      const d = await r.json();
      if (r.ok) setPreflight({ loading: false, data: d });
      else { setPreflight(null); setMsg('❌ ' + (d.error || t.faturalar.kontrolYapilamadi)); }
    } catch { setPreflight(null); setMsg('❌ ' + t.sayacTuru.sunucuYok); }
  };

  const runBilling = async () => {
    setPreflight(null);
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (res.ok) {
        setMsg(doldur(t.faturalar.kesildi, {
          n: d.created, tutar: fmt(d.total),
          ek: d.errors ? doldur(t.faturalar.hataEki, { n: d.errors }) : '',
        }));
        load();
      } else setMsg('❌ ' + (d.error || t.genel.hata));
    } catch { setMsg('❌ ' + t.sayacTuru.sunucuYok); }
    setRunning(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.faturalar.baslik}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.faturalar.alt}</p>
        </div>
        <button onClick={openPreflight} disabled={running}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {running ? t.faturalar.kesiliyor : t.faturalar.faturala}
        </button>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg bg-gray-50 border text-sm text-gray-700">{msg}</div>}

      {/* FATURA ÖNCESİ SAYAÇ ÖN KONTROLÜ */}
      {preflight && (
        <div onClick={() => setPreflight(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(11,21,51,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 16, width: 620, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 30px 70px -30px rgba(11,21,51,.7)' }}>
            <div style={{ padding: '1.25rem 1.4rem', borderBottom: '1px solid #eef2f7' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB' }}>{t.faturalar.kontrolUst}</div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0B1533', marginTop: 4 }}>
                {preflight.loading ? t.faturalar.kontrolEdiliyor
                  : preflight.data?.missingCount > 0
                    ? doldur(t.faturalar.okunmayan, { n: preflight.data.missingCount })
                    : t.faturalar.hepsiOkundu}
              </div>
              {!preflight.loading && preflight.data?.missingCount > 0 && (
                <p style={{ color: '#B45309', fontSize: '.88rem', margin: '.45rem 0 0', lineHeight: 1.55 }}>
                  {t.faturalar.okunmayanUyariOn} <b>{t.faturalar.okunmayanUyariVurgu}</b> {t.faturalar.okunmayanUyariSon}
                </p>
              )}
              {!preflight.loading && preflight.data?.missingCount === 0 && (
                <p style={{ color: '#0B6B4A', fontSize: '.88rem', margin: '.45rem 0 0' }}>
                  {doldur(t.faturalar.hepsiOkunduAlt, { n: preflight.data.totalRental })}
                </p>
              )}
            </div>

            {!preflight.loading && preflight.data?.customers?.length > 0 && (
              <div style={{ padding: '.9rem 1.4rem', maxHeight: '46vh', overflowY: 'auto' }}>
                {preflight.data.customers.map((c: any) => (
                  <div key={c.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <a href={`/customers/${c.id}`} style={{ fontWeight: 700, fontSize: '.92rem', color: '#0B1533', textDecoration: 'none' }}>{c.name}</a>
                      <a href={`/sayac-turu`} style={{ fontSize: '.78rem', fontWeight: 700, color: '#0E9F6E', textDecoration: 'none', whiteSpace: 'nowrap' }}>{t.faturalar.sayacTuruOk}</a>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {c.devices.map((d: any) => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '.8rem', color: '#5B6479', background: '#F7F9FC', borderRadius: 8, padding: '.4rem .6rem' }}>
                          <span>{d.brand} {d.model}{d.location ? ` · 📍 ${d.location}` : ''}</span>
                          <span style={{ color: '#9AA3B8', fontFamily: 'monospace', fontSize: '.72rem' }}>{d.serialNo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '1rem 1.4rem', borderTop: '1px solid #eef2f7', display: 'flex', gap: '.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setPreflight(null)}
                style={{ padding: '.6rem 1.1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                {t.genel.iptal}
              </button>
              {!preflight.loading && preflight.data?.missingCount > 0 && (
                <a href="/sayac-turu"
                  style={{ padding: '.6rem 1.1rem', background: '#0E9F6E', color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
                  {t.faturalar.onceSayac}
                </a>
              )}
              <button onClick={runBilling} disabled={preflight.loading}
                style={{ padding: '.6rem 1.2rem', background: preflight.data?.missingCount > 0 ? '#B45309' : '#0F2253', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: preflight.loading ? .5 : 1 }}>
                {preflight.data?.missingCount > 0 ? t.faturalar.yineDeFaturala : t.faturalar.faturalaKisa}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.toplamFatura}</p><span>🧾</span></div>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{summary.count}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{doldur(t.faturalar.adetOdendi, { n: summary.paidCount })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.toplamTutar}</p><span>💼</span></div>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmt(summary.total)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t.faturalar.kdvDahilCiro}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.acikBakiye}</p><span>⏳</span></div>
          <p className="text-2xl font-bold text-blue-600 mt-1 tabular-nums">{fmt(summary.open)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t.faturalar.tahsilEdilecek}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.vadesiGecen}</p><span>🔴</span></div>
          <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">{fmt(summary.overdue)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t.faturalar.gecikmisTutar}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.faturalar.araYer}
          className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">{t.fisler.filtre.tumDurumlar}</option>
          {(['OPEN', 'PARTIAL', 'OVERDUE', 'PAID'] as const).map((k) => (
            <option key={k} value={k}>{durumAdi(k)}</option>
          ))}
        </select>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">{t.faturalar.sutunFaturaNo}</th>
                <th className="text-left px-4 py-3">{t.genel.musteri}</th>
                <th className="text-left px-4 py-3">{t.faturalar.sutunDonem}</th>
                <th className="text-right px-4 py-3">{t.genel.tutar}</th>
                <th className="text-right px-4 py-3">{t.faturalar.sutunAcik}</th>
                <th className="text-left px-4 py-3">{t.faturalar.sutunVade}</th>
                <th className="text-left px-4 py-3">{t.genel.durum}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{t.genel.yukleniyor}</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {t.faturalar.faturaYok}
                </td></tr>
              ) : invoices.map((i) => {
                const st = { label: durumAdi(i.status), cls: STATUS_CLS[i.status] ?? STATUS_CLS.OPEN };
                return (
                  <tr key={i.id} onClick={() => setDetail(i)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {i.invoiceNumber}
                      {/* e-BELGE DURUMU. Ay sonunda bayi bu listede duruyor;
                          hangisinin gönderildiğini görmek için ayrı ekrana
                          gitmek zorunda kalmasın. */}
                      {(i as any).eBelgeDurum && (i as any).eBelgeDurum !== 'ESKI_SISTEM' && (
                        <div className={`mt-0.5 text-[10px] font-semibold ${
                          ['KABUL', 'GONDERILDI'].includes((i as any).eBelgeDurum) ? 'text-green-700'
                            : ['RED', 'HATA'].includes((i as any).eBelgeDurum) ? 'text-red-700' : 'text-amber-700'
                        }`}>
                          {(t.faturalar.eBelge as Record<string, string>)[(i as any).eBelgeDurum] ?? ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{i.customer?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{i.period}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(i.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">{i.openAmount > 0 ? <span className="text-red-600 font-medium">{fmt(i.openAmount)}</span> : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(i.dueDate)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detay modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-gray-500">{detail.invoiceNumber}</p>
                <h3 className="text-lg font-bold">{detail.customer?.name}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-5">
              <div className="flex justify-between text-sm text-gray-500 mb-3">
                <span>{doldur(t.faturalar.donem, { n: detail.period })}</span>
                <span>{doldur(t.faturalar.vade, { n: fmtDate(detail.dueDate) })}</span>
              </div>
              <table className="w-full text-sm mb-4">
                <thead className="text-xs text-gray-400 border-b">
                  <tr><th className="text-left py-1">{t.faturalar.kalem}</th><th className="text-right py-1">{t.parcalar.sutun.adet}</th><th className="text-right py-1">{t.faturalar.birimFiyat}</th><th className="text-right py-1">{t.genel.tutar}</th></tr>
                </thead>
                <tbody>
                  {detail.lines.map((l, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2"><span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded mr-1">{turAdi(l.kind)}</span>{l.description}</td>
                      <td className="py-2 text-right">{l.quantity}</td>
                      <td className="py-2 text-right">{fmt(l.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{fmt(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between text-gray-500"><span>{t.faturalar.araToplam}</span><span>{fmt(detail.subtotal)}</span></div>
                <div className="flex justify-between text-gray-500"><span>{t.faturalar.kdv}</span><span>{fmt(detail.vatAmount)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>{t.faturalar.genelToplam}</span><span>{fmt(detail.totalAmount)}</span></div>
                <div className="flex justify-between text-green-600"><span>{t.faturalar.tahsilEdilen}</span><span>{fmt(detail.paidAmount)}</span></div>
                <div className="flex justify-between font-medium text-red-600"><span>{t.faturalar.kalan}</span><span>{fmt(detail.openAmount)}</span></div>
              </div>
            </div>
            {/* Aksiyonlar */}
            <div className="p-4 border-t bg-gray-50 flex gap-2 flex-wrap sticky bottom-0">
              <button onClick={() => openPrintable(`/invoices/${detail.id}/print`)}
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                {t.faturalar.yazdirPdf}
              </button>
              {detail.customer && (
                <button onClick={() => {
                  const link = detail.docToken ? `${window.location.origin}/belge/fatura/${detail.id}/${detail.docToken}` : '';
                  const msg = invoiceMessage({ dil: musteri.dil, birim: musteri.b.birim, tenantName, customerName: detail.customer!.name, invoiceNumber: detail.invoiceNumber, period: detail.period, totalAmount: detail.totalAmount, openAmount: detail.openAmount, dueDate: detail.dueDate })
                    + (link ? `\n\n${doldur(t.faturalar.faturaLinkOn, { n: link })}` : '');
                  openWhatsApp(detail.customer!.phone, msg);
                }}
                  className="flex-1 min-w-[120px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                  {t.faturalar.whatsappLink}
                </button>
              )}
              {detail.docToken && (
                <button onClick={() => {
                  const link = `${window.location.origin}/belge/fatura/${detail.id}/${detail.docToken}`;
                  navigator.clipboard?.writeText(link).then(() => setMsg(t.faturalar.linkKopyalandi)).catch(() => window.open(link, '_blank'));
                }}
                  className="px-4 py-2.5 bg-white border text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium" title={t.faturalar.linkIpucu}>
                  {t.faturalar.link}
                </button>
              )}
              {detail.openAmount > 0 && detail.customer && (
                <button onClick={() => router.push(`/collections?customerId=${detail.customer!.id}`)}
                  className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                  {t.faturalar.tahsilatYap}
                </button>
              )}
              <button onClick={() => setDetail(null)}
                className="px-4 py-2.5 bg-white border text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                {t.genel.kapat}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
