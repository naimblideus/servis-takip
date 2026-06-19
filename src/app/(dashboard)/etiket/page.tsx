'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';

interface StockItem { id: string; source: 'PART' | 'PRINTER'; name: string; sku?: string | null; barcode?: string | null; sellPrice: number; }
interface Device { id: string; brand: string; model: string; serialNo: string; publicCode: string; customer?: { name: string } | null; }
interface Cand { key: string; code: string; name: string; sub: string; price: number; }
interface Row { key: string; code: string; name: string; price: number; copies: number; }

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MAX_LABELS = 1500; // tek baskıda makul üst sınır

// Code 128 — JsBarcode viewBox koymaz; el ile ekliyoruz. SVG'yi SABİT mm boyuta veriyoruz
// (flex/% yazdırmada çöküp barkodu küçültüyordu); preserveAspectRatio=none ile kutuyu birebir doldurur.
function Barcode({ value, wmm, hmm }: { value: string; wmm: number; hmm: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const valid = /^[\x20-\x7E]+$/.test(value || '');
  useEffect(() => {
    const el = ref.current;
    if (el && valid) {
      try {
        JsBarcode(el, value, { format: 'CODE128', height: 100, width: 2, margin: 0, displayValue: false });
        const bw = parseFloat(el.getAttribute('width') || '0');
        const bh = parseFloat(el.getAttribute('height') || '0');
        if (bw > 0 && bh > 0) el.setAttribute('viewBox', `0 0 ${bw} ${bh}`);
        el.removeAttribute('width'); el.removeAttribute('height');
      } catch { /* yoksay */ }
    }
  }, [value, valid]);
  if (!valid) return <div style={{ fontSize: '2.4mm', color: '#b91c1c' }}>⚠ Barkod uyumsuz</div>;
  return <svg ref={ref} preserveAspectRatio="none" style={{ display: 'block', width: `${wmm}mm`, height: `${hmm}mm`, shapeRendering: 'crispEdges' }} />;
}

function LabelInner({ r, w, h, showName, showCode, showPrice }: { r: Row; w: number; h: number; showName: boolean; showCode: boolean; showPrice: boolean }) {
  // Barkod boyutunu etikete göre mm cinsinden hesapla: metin alanlarını düş, kalanı barkoda ver (büyük çıksın)
  const reserved = 2 /*padding*/ + (showName ? 3.6 : 0) + (showCode ? 3 : 0) + (showPrice && r.price > 0 ? 4 : 0);
  const bcH = Math.max(8, h - reserved);
  const bcW = Math.max(10, w - 3);
  return (
    <>
      {showName && <div className="zl-name">{r.name}</div>}
      <Barcode value={r.code} wmm={bcW} hmm={bcH} />
      {showCode && <div className="zl-code">{r.code}</div>}
      {showPrice && r.price > 0 && <div className="zl-price">{fmt(r.price)}</div>}
    </>
  );
}

export default function EtiketPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [source, setSource] = useState<'STOCK' | 'DEVICE'>('STOCK');
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [w, setW] = useState(50);
  const [h, setH] = useState(30);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stock').then((r) => r.json()).then((d) => setStock(Array.isArray(d.items) ? d.items : [])).catch(() => {});
    fetch('/api/devices').then((r) => r.json()).then((d) => setDevices(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Tüm kalemleri ortak "aday" biçimine indir (stok + cihaz)
  const stockCands = useMemo<Cand[]>(() => stock.map((i) => ({
    key: `${i.source}-${i.id}`, code: (i.barcode && i.barcode.trim()) || (i.sku && i.sku.trim()) || '',
    name: i.name, sub: i.source === 'PART' ? 'Parça' : 'Yazıcı/Toner', price: Number(i.sellPrice) || 0,
  })), [stock]);
  const deviceCands = useMemo<Cand[]>(() => devices.map((d) => ({
    key: `DEV-${d.id}`, code: (d.publicCode || '').trim(),
    name: `${d.brand} ${d.model}`, sub: `SN ${d.serialNo}${d.customer?.name ? ' · ' + d.customer.name : ''}`, price: 0,
  })), [devices]);

  const candidates = source === 'STOCK' ? stockCands : deviceCands;
  const allCands = useMemo(() => [...stockCands, ...deviceCands], [stockCands, deviceCands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
  }, [candidates, search]);

  const inList = useMemo(() => new Set(rows.map((r) => r.key)), [rows]);

  const addCand = (c: Cand) => {
    if (!c.code) { setMsg(`"${c.name}" için kod yok — atlandı.`); return; }
    setRows((rs) => {
      if (rs.find((r) => r.key === c.key)) return rs.map((r) => r.key === c.key ? { ...r, copies: r.copies + 1 } : r);
      return [...rs, { key: c.key, code: c.code, name: c.name, price: c.price, copies: 1 }];
    });
    setMsg(null);
  };

  const addAllFiltered = () => {
    const usable = filtered.filter((c) => c.code && !inList.has(c.key));
    if (usable.length === 0) { setMsg('Eklenecek yeni kalem yok (zaten listede veya kodsuz).'); return; }
    const slice = usable.slice(0, MAX_LABELS);
    setRows((rs) => [...rs, ...slice.map((c) => ({ key: c.key, code: c.code, name: c.name, price: c.price, copies: 1 }))]);
    const skipped = filtered.filter((c) => !c.code).length;
    setMsg(`${slice.length} kalem eklendi${usable.length > slice.length ? ` (ilk ${MAX_LABELS})` : ''}${skipped ? ` · ${skipped} kalem kodsuz atlandı` : ''}.`);
  };

  const addByCode = (raw: string) => {
    const code = raw.trim();
    const found = allCands.find((c) => c.code === code);
    if (found) addCand(found);
    else {
      // ham eşleşme: stok barkod/sku ya da cihaz seri no
      const dev = devices.find((d) => d.serialNo === code);
      if (dev) addCand({ key: `DEV-${dev.id}`, code: (dev.publicCode || code), name: `${dev.brand} ${dev.model}`, sub: '', price: 0 });
      else setMsg(`Bulunamadı: ${code}`);
    }
  };
  useBarcodeWedge((code) => addByCode(code), { enabled: true });

  const labels = useMemo(() => {
    const out: Row[] = [];
    rows.forEach((r) => { for (let i = 0; i < r.copies; i++) out.push({ ...r, key: `${r.key}-${i}` }); });
    return out;
  }, [rows]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 760, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .zsheet { display: block !important; }
          .zlabel { page-break-after: always; break-after: page; page-break-inside: avoid; }
          .zlabel:last-child { page-break-after: auto; break-after: auto; }
        }
        @page { size: ${w}mm ${h}mm; margin: 0; }
        .zsheet { display: none; }
        .zlabel {
          width: ${w}mm; height: ${h}mm; box-sizing: border-box;
          padding: 1mm 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.4mm; overflow: hidden; background: #fff; color: #000;
        }
        .zl-name { font-size: 2.4mm; font-weight: 700; line-height: 1.05; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .zl-bc { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
        .zl-bc svg { width: 100%; height: 100%; }
        .zl-code { font-size: 2.2mm; font-family: 'Courier New', monospace; letter-spacing: 0.3mm; line-height: 1; }
        .zl-price { font-size: 3.2mm; font-weight: 800; line-height: 1; }
      `}</style>

      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🏷️ Zebra Etiket (GC420T)</h1>
            <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Termal yazıcıya tek tek etiket bas. <b>Toplu basım:</b> kaynağı seç → (ara/filtrele) → “Görünenleri ekle” → tek seferde bas.
            </p>
          </div>
          <button onClick={() => window.print()} disabled={labels.length === 0}
            style={{ padding: '0.6rem 1.3rem', background: labels.length ? '#0f2253' : '#9ca3af', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: labels.length ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>
            🖨️ Zebra'ya Yazdır ({labels.length})
          </button>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.82rem', lineHeight: 1.5 }}>
          💡 <b>440 makine için:</b> elle kod girmene gerek yok — her makinenin/parçanın sistemdeki benzersiz kodu (cihaz kodu / SKU) barkoda basılır. Kaynağı <b>Cihazlar</b> yap, aramayı boş bırak, <b>“Görünenleri ekle”</b> ile hepsini tek baskıya al.
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.82rem', lineHeight: 1.5 }}>
          ⚙️ <b>İlk kurulumda</b> yazdır penceresinde: Hedef = <b>GC420T</b>, Kâğıt = <b>{w}×{h} mm</b>, Kenar = <b>Yok</b>, Ölçek = <b>%100</b>.
        </div>

        {msg && <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#334155', borderRadius: 8, padding: '0.5rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{msg}</div>}

        {/* Boyut + alanlar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div><label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Genişlik (mm)</label>
            <input type="number" min={20} max={120} value={w} onChange={(e) => setW(Math.max(20, Math.min(120, parseInt(e.target.value) || 50)))} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} /></div>
          <div><label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Yükseklik (mm)</label>
            <input type="number" min={15} max={120} value={h} onChange={(e) => setH(Math.max(15, Math.min(120, parseInt(e.target.value) || 30)))} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} /></div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[[50, 30], [40, 25], [60, 40], [100, 50]].map(([pw, ph]) => (
              <button key={`${pw}x${ph}`} type="button" onClick={() => { setW(pw); setH(ph); }}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid', borderColor: w === pw && h === ph ? '#2563eb' : '#d1d5db', background: w === pw && h === ph ? '#eff6ff' : 'white', color: '#374151', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {pw}×{ph}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 6 }}><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Ad</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 6 }}><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Fiyat</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 6 }}><input type="checkbox" checked={showCode} onChange={(e) => setShowCode(e.target.checked)} /> Kod yazısı</label>
        </div>

        {/* Kaynak seçimi */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '0.6rem' }}>
          {([['STOCK', `🔧 Parça / Toner (${stockCands.length})`], ['DEVICE', `🖨️ Cihazlar / Makineler (${deviceCands.length})`]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setSource(k); setSearch(''); }}
              style={{ padding: '0.5rem 0.9rem', border: '1px solid', borderColor: source === k ? '#2563eb' : '#d1d5db', background: source === k ? '#2563eb' : 'white', color: source === k ? 'white' : '#374151', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Ara + toplu ekle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.5rem' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={source === 'DEVICE' ? '🔍 Marka / model / seri / müşteri…' : '🔍 Ad / SKU / barkod…'}
            style={{ flex: 1, padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          <button onClick={addAllFiltered}
            style={{ padding: '0.6rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ＋ Görünenleri ekle ({filtered.length})
          </button>
        </div>

        {/* Aday listesi (tıkla = ekle) */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem', maxHeight: 260, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>Kayıt yok.</p>
          ) : filtered.slice(0, 200).map((c) => (
            <div key={c.key} onClick={() => addCand(c)}
              style={{ padding: '0.45rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, opacity: inList.has(c.key) ? 0.5 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name} {!c.code && <em style={{ color: '#b91c1c', fontSize: '0.7rem' }}>(kod yok)</em>}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{c.sub}{c.code ? ` · ${c.code}` : ''}</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: '0.78rem', fontWeight: 700, color: inList.has(c.key) ? '#16a34a' : '#2563eb' }}>{inList.has(c.key) ? '✓' : '+ ekle'}</span>
            </div>
          ))}
          {filtered.length > 200 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '0.5rem', fontSize: '0.78rem' }}>… {filtered.length - 200} kayıt daha (aramayla daralt; “Görünenleri ekle” hepsini ekler)</p>}
        </div>

        {/* Yazdırılacaklar */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.85rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
            <span>Yazdırılacaklar ({labels.length} etiket)</span>
            {rows.length > 0 && <button onClick={() => setRows([])} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Temizle</button>}
          </div>
          {rows.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.25rem', fontSize: '0.875rem' }}>Yukarıdan kalem ekleyin (tek tek ya da “Görünenleri ekle”).</p>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {rows.map((r) => (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 1rem', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace' }}>{r.code}</div>
                  </div>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>kopya</label>
                  <input type="number" min={1} max={100} value={r.copies} onChange={(e) => { const c = Math.max(1, Math.min(100, parseInt(e.target.value) || 1)); setRows((rs) => rs.map((x) => x.key === r.key ? { ...x, copies: c } : x)); }}
                    style={{ width: 56, padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', textAlign: 'center' }} />
                  <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Önizleme */}
        {rows[0] && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Önizleme — gerçek boyut ({w}×{h} mm)</div>
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, display: 'inline-block', background: '#f8fafc' }}>
              <div className="zlabel" style={{ border: '1px solid #e5e7eb' }}>
                <LabelInner r={rows[0]} w={w} h={h} showName={showName} showCode={showCode} showPrice={showPrice} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Yazdırma alanı — her etiket bir sayfa */}
      <div className="zsheet">
        {labels.map((l) => (
          <div key={l.key} className="zlabel">
            <LabelInner r={l} w={w} h={h} showName={showName} showCode={showCode} showPrice={showPrice} />
          </div>
        ))}
      </div>
    </div>
  );
}
