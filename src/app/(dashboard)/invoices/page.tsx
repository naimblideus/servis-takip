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
type Gerekce = { kod: string; cihaz?: string; okumaSayisi?: number; sayfa?: number; ortalama?: number; tutar?: number };
interface Taslak {
  id: string; period: string; customer: { id: string; name: string } | null;
  gerekceler: Gerekce[]; satirlar: Line[]; araToplam: number; toplam: number;
}

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
  // 'YYYY-MM' → "Ekim 2026" (ayın ortası: saat dilimi ayı kaydırmasın)
  const donemAdi = (p?: string) => {
    if (!p) return '';
    const [y, m] = p.split('-').map(Number);
    return b.ayYil(new Date(Date.UTC(y, m - 1, 15)));
  };
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
  // Taslakta bekleyen dönem faturaları (lib/fatura-bekletme)
  const [taslaklar, setTaslaklar] = useState<Taslak[]>([]);
  const [taslakToplam, setTaslakToplam] = useState(0);
  const [taslakAcik, setTaslakAcik] = useState(false);
  const [taslakIslem, setTaslakIslem] = useState(false);

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

  const taslakYukle = useCallback(async () => {
    try {
      const r = await fetch('/api/invoices/taslak');
      if (r.ok) { const d = await r.json(); setTaslaklar(d.taslaklar); setTaslakToplam(d.toplam); }
    } catch { /* yoksay */ }
  }, []);
  useEffect(() => { taslakYukle(); }, [taslakYukle]);

  const gerekceMetni = (g: Gerekce) => doldur((t.faturalar.gerekce as Record<string, string>)[g.kod] ?? g.kod, {
    cihaz: g.cihaz ?? '', sayfa: b.sayi(g.sayfa ?? 0), ort: b.sayi(g.ortalama ?? 0), tutar: fmt(g.tutar ?? 0),
  });

  // "Kes" / "Bu ay kesme": sunucu kesmeden önce hesabı yeniden yapar; tutar
  // değiştiyse kesmez, taslağı günceller (ekran yeni tutarı gösterir).
  const taslakUygula = async (ids: string[], islem: 'KES' | 'AT') => {
    if ((session?.user as { demo?: boolean } | undefined)?.demo) { setMsg(t.demoOnizleme.faturaGenel); return; }
    setTaslakIslem(true); setMsg(null);
    try {
      const r = await fetch('/api/invoices/taslak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, islem }) });
      const d = await r.json();
      if (r.ok) {
        const parca = [
          d.kesilen ? doldur(t.faturalar.taslakKesildi, { n: d.kesilen, tutar: fmt(d.tutar) }) : '',
          d.atilan ? doldur(t.faturalar.taslakAtildi, { n: d.atilan }) : '',
          d.degisen ? doldur(t.faturalar.taslakDegisti, { n: d.degisen }) : '',
          d.hata ? doldur(t.faturalar.taslakHata, { n: d.hata }) : '',
        ].filter(Boolean);
        setMsg(parca.join(' '));
        load(); taslakYukle();
      } else setMsg('❌ ' + (d.error || t.genel.hata));
    } catch { setMsg('❌ ' + t.sayacTuru.sunucuYok); }
    setTaslakIslem(false);
  };

  // FATURA ÖNCESİ SAYAÇ ÖN KONTROLÜ — çıplak onay yerine "hangi cihazın sayacı okunmadı" ekranı
  // Dönem verilmezse sunucu varsayılanı seçer (ayın ilk yarısı → kapanan ay).
  const openPreflight = async (donem?: string) => {
    setPreflight({ loading: true, data: null });
    try {
      const r = await fetch(`/api/invoices/preflight${donem ? `?period=${encodeURIComponent(donem)}` : ''}`);
      const d = await r.json();
      if (r.ok) setPreflight({ loading: false, data: d });
      else { setPreflight(null); setMsg('❌ ' + (d.error || t.faturalar.kontrolYapilamadi)); }
    } catch { setPreflight(null); setMsg('❌ ' + t.sayacTuru.sunucuYok); }
  };

  const runBilling = async () => {
    const donem: string | undefined = preflight?.data?.period;
    setPreflight(null);
    if ((session?.user as { demo?: boolean } | undefined)?.demo) { setMsg(t.demoOnizleme.faturaGenel); return; }
    setRunning(true); setMsg(null);
    try {
      // Dönem AÇIKÇA gönderilir: ekranda gösterilen ay ile kesilen ay aynı olsun.
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donem ? { period: donem } : {}) });
      const d = await res.json();
      if (res.ok) {
        setMsg(doldur(t.faturalar.donemOnEki, { ay: donemAdi(d.period) }) + doldur(t.faturalar.kesildi, {
          n: d.created, tutar: fmt(d.total),
          ek: (d.errors ? doldur(t.faturalar.hataEki, { n: d.errors }) : '') + (d.bekleyen ? doldur(t.faturalar.bekleyenEki, { n: d.bekleyen }) : ''),
        }));
        load(); taslakYukle();
        if (d.bekleyen) setTaslakAcik(true);
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
        <button onClick={() => openPreflight()} disabled={running}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {running ? t.faturalar.kesiliyor : t.faturalar.faturala}
        </button>
      </div>

      {msg && <div role="status" className="mb-4 p-3 rounded-lg bg-gray-50 border text-sm text-gray-700">{msg}</div>}

      {/* TASLAKTA BEKLEYEN FATURALAR — kendiliğinden kesilmedi, gerekçesiyle. */}
      {taslaklar.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">{doldur(t.faturalar.taslakBaslik, { n: taslaklar.length, tutar: fmt(taslakToplam) })}</p>
              <p className="text-sm text-amber-800 mt-1">{t.faturalar.taslakAlt}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setTaslakAcik((a) => !a)} aria-expanded={taslakAcik}
                className="min-h-[44px] px-4 py-2 bg-white border border-amber-300 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-100">
                {taslakAcik ? t.faturalar.taslakKapat : t.faturalar.taslakAc}
              </button>
              <button onClick={() => taslakUygula(taslaklar.map((x) => x.id), 'KES')} disabled={taslakIslem}
                className="min-h-[44px] px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {doldur(t.faturalar.hepsiniKes, { n: taslaklar.length })}
              </button>
            </div>
          </div>
          {taslakAcik && (
            <div className="mt-4 grid gap-3">
              {taslaklar.map((x) => (
                <div key={x.id} className="bg-white rounded-lg border border-amber-200 p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{x.customer?.name ?? '—'} <span className="text-gray-400 font-normal text-sm">· {donemAdi(x.period)}</span></p>
                      <ul className="mt-1 space-y-0.5">
                        {(x.gerekceler.length ? x.gerekceler : [{ kod: 'ONAY' }]).map((g, i) => (
                          <li key={i} className="text-sm text-amber-900 [overflow-wrap:anywhere]">⚠ {gerekceMetni(g)}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="font-bold text-gray-900 tabular-nums">{fmt(x.toplam)}</p>
                  </div>
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer select-none min-h-[32px] flex items-center">{t.faturalar.kalem} ({x.satirlar.length})</summary>
                    <ul className="mt-1 text-xs text-gray-600 space-y-1">
                      {x.satirlar.map((l, i) => (
                        <li key={i} className="flex justify-between gap-3"><span className="[overflow-wrap:anywhere]">{l.description}</span><span className="tabular-nums whitespace-nowrap">{fmt(l.lineTotal)}</span></li>
                      ))}
                    </ul>
                  </details>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={() => taslakUygula([x.id], 'KES')} disabled={taslakIslem}
                      className="min-h-[44px] px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      {t.faturalar.taslakKes}
                    </button>
                    <button onClick={() => taslakUygula([x.id], 'AT')} disabled={taslakIslem}
                      className="min-h-[44px] px-4 py-2 bg-white border text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50">
                      {t.faturalar.taslakAt}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              {/* Hangi ay kesilecek — iki seçenek, seçili olan koyu. */}
              {!preflight.loading && preflight.data?.secenekler && (
                <div style={{ marginTop: '.7rem' }}>
                  <div style={{ fontSize: '.8rem', color: '#5B6479', marginBottom: 6 }}>{t.faturalar.donemSec}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {([['kapanan', t.faturalar.kapananAy], ['acik', t.faturalar.buAy]] as const).map(([k, etiket]) => {
                      const p: string = preflight.data.secenekler[k];
                      const secili = p === preflight.data.period;
                      return (
                        <button key={k} type="button" onClick={() => { if (!secili) openPreflight(p); }}
                          aria-pressed={secili}
                          style={{ minHeight: 44, padding: '.5rem .9rem', borderRadius: 10, fontSize: '.86rem', fontWeight: 700, cursor: secili ? 'default' : 'pointer',
                            border: secili ? '2px solid #0F2253' : '1px solid #d1d5db', background: secili ? '#EEF2FF' : 'white', color: '#0B1533' }}>
                          {doldur(etiket, { ay: donemAdi(p) })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* Özet kartlar — TUTAR HER GENİŞLİKTE TAM GÖRÜNÜR. Telefonda iki
          sütunda text-2xl tutar kartın dışına taşıyor, overflow-hidden onu
          kesiyordu ("₺2,908,742.3", "₺257.484,2…"). Şimdi: 420 px altında tek
          sütun, 4 sütun yalnız lg'de; rakam kartın genişliğine göre küçülür
          (12cqi, 1rem–1.5rem; geniş ekranda eski 1.5rem). Yine de sığmazsa
          kesilmez, alt satıra kırılır. */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="@container bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.toplamFatura}</p><span>🧾</span></div>
          <p className="text-[length:clamp(1rem,12cqi,1.5rem)] leading-[1.333] [overflow-wrap:anywhere] font-bold text-gray-900 mt-1 tabular-nums">{summary.count}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{doldur(t.faturalar.adetOdendi, { n: summary.paidCount })}</p>
        </div>
        <div className="@container bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.toplamTutar}</p><span>💼</span></div>
          <p className="text-[length:clamp(1rem,12cqi,1.5rem)] leading-[1.333] [overflow-wrap:anywhere] font-bold text-gray-900 mt-1 tabular-nums">{fmt(summary.total)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t.faturalar.kdvDahilCiro}</p>
        </div>
        <div className="@container bg-white rounded-xl border border-blue-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.acikBakiye}</p><span>⏳</span></div>
          <p className="text-[length:clamp(1rem,12cqi,1.5rem)] leading-[1.333] [overflow-wrap:anywhere] font-bold text-blue-600 mt-1 tabular-nums">{fmt(summary.open)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t.faturalar.tahsilEdilecek}</p>
        </div>
        <div className="@container bg-white rounded-xl border border-red-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">{t.faturalar.vadesiGecen}</p><span>🔴</span></div>
          <p className="text-[length:clamp(1rem,12cqi,1.5rem)] leading-[1.333] [overflow-wrap:anywhere] font-bold text-red-600 mt-1 tabular-nums">{fmt(summary.overdue)}</p>
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
