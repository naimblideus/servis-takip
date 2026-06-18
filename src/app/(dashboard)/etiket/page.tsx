'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';

interface StockItem { id: string; source: 'PART' | 'PRINTER'; name: string; sku?: string | null; barcode?: string | null; sellPrice: number; }
interface Row { key: string; code: string; name: string; price: number; copies: number; }

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Code 128 — yalnız yazdırılabilir ASCII. JsBarcode viewBox koymaz; el ile ekleyip
// width/height attribute'larını kaldırınca svg kutuyu DOLDURACAK şekilde ölçeklenir (yoksa minik kalır).
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const valid = /^[\x20-\x7E]+$/.test(value || '');
  useEffect(() => {
    const el = ref.current;
    if (el && valid) {
      try {
        JsBarcode(el, value, { format: 'CODE128', height: 100, width: 2, margin: 0, displayValue: false });
        const bw = parseFloat(el.getAttribute('width') || '0');
        const bh = parseFloat(el.getAttribute('height') || '0');
        if (bw > 0 && bh > 0) {
          el.setAttribute('viewBox', `0 0 ${bw} ${bh}`);
          el.removeAttribute('width');
          el.removeAttribute('height');
        }
      } catch { /* yoksay */ }
    }
  }, [value, valid]);
  if (!valid) return <div style={{ fontSize: '2mm', color: '#b91c1c' }}>⚠ Barkod uyumsuz</div>;
  return <svg ref={ref} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', shapeRendering: 'crispEdges' }} />;
}

function LabelInner({ r, showName, showCode, showPrice }: { r: Row; showName: boolean; showCode: boolean; showPrice: boolean }) {
  return (
    <>
      {showName && <div className="zl-name">{r.name}</div>}
      <div className="zl-bc"><Barcode value={r.code} /></div>
      {showCode && <div className="zl-code">{r.code}</div>}
      {showPrice && r.price > 0 && <div className="zl-price">{fmt(r.price)}</div>}
    </>
  );
}

export default function EtiketPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [w, setW] = useState(50);
  const [h, setH] = useState(30);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const stockRef = useRef<StockItem[]>([]);
  stockRef.current = stock;

  useEffect(() => {
    fetch('/api/stock').then((r) => r.json()).then((d) => setStock(Array.isArray(d.items) ? d.items : [])).catch(() => {});
  }, []);

  const codeOf = (i: StockItem) => (i.barcode && i.barcode.trim()) || (i.sku && i.sku.trim()) || '';

  const addItem = (i: StockItem) => {
    const code = codeOf(i);
    if (!code) { setMsg(`"${i.name}" için barkod/SKU yok — önce Stok'tan barkod ekleyin.`); return; }
    setRows((rs) => {
      const key = `${i.source}-${i.id}`;
      if (rs.find((r) => r.key === key)) return rs.map((r) => r.key === key ? { ...r, copies: r.copies + 1 } : r);
      return [...rs, { key, code, name: i.name, price: Number(i.sellPrice) || 0, copies: 1 }];
    });
    setMsg(null);
  };

  const addByCode = (raw: string) => {
    const code = raw.trim();
    const found = stockRef.current.find((i) => (i.barcode || '') === code || (i.sku || '') === code);
    if (found) addItem(found); else setMsg(`Bulunamadı: ${code}`);
  };
  useBarcodeWedge((code) => addByCode(code), { enabled: true });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return stock.filter((i) => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.barcode || '').toLowerCase().includes(q)).slice(0, 8);
  }, [stock, search]);

  // Yazdırılacak etiketler: her satır × kopya
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
              Termal yazıcıya <b>tek tek etiket</b> bas (A4 sayfa değil). Ürünü okut/ara → listeye ekle → Zebra'ya yazdır.
            </p>
          </div>
          <button onClick={() => window.print()} disabled={labels.length === 0}
            style={{ padding: '0.6rem 1.3rem', background: labels.length ? '#0f2253' : '#9ca3af', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: labels.length ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>
            🖨️ Zebra'ya Yazdır ({labels.length})
          </button>
        </div>

        {/* Yazdırma ayarı uyarısı */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.82rem', lineHeight: 1.5 }}>
          ⚙️ <b>İlk kurulumda:</b> Yazdır penceresinde <b>Hedef = ZDesigner GC420T</b>, <b>Kâğıt boyutu = {w} × {h} mm</b> (Windows&apos;ta yazıcı tercihlerinden de ayarlı olmalı), <b>Kenar boşlukları = Yok</b>, <b>Ölçek = %100</b> seç. Böylece her ürün için tam <b>tek etiket</b> çıkar.
        </div>

        {msg && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '0.5rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{msg}</div>}

        {/* Ayarlar */}
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

        {/* Ekle: ara veya okut */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Ürün ara (ad / SKU / barkod) — ya da okuyucuyla okut"
            style={{ width: '100%', padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          {filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 260, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
              {filtered.map((i) => (
                <div key={`${i.source}-${i.id}`} onClick={() => { addItem(i); setSearch(''); }}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>{i.source === 'PART' ? '🔧' : '🖨️'} {i.name} {!codeOf(i) && <em style={{ color: '#b91c1c', fontSize: '0.72rem' }}>(barkod yok)</em>}</span>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace' }}>{i.barcode || i.sku || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liste */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>Yazdırılacaklar ({labels.length} etiket)</div>
          {rows.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.25rem', fontSize: '0.875rem' }}>Ürün ekleyin (okutun veya arayın).</p>
          ) : rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderBottom: '1px solid #f9fafb' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace' }}>{r.code}</div>
              </div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>kopya</label>
              <input type="number" min={1} max={100} value={r.copies} onChange={(e) => { const c = Math.max(1, Math.min(100, parseInt(e.target.value) || 1)); setRows((rs) => rs.map((x) => x.key === r.key ? { ...x, copies: c } : x)); }}
                style={{ width: 60, padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', textAlign: 'center' }} />
              <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>

        {/* Önizleme (gerçek mm boyutunda) */}
        {rows[0] && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Önizleme — gerçek boyut ({w}×{h} mm)</div>
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, display: 'inline-block', background: '#f8fafc' }}>
              <div className="zlabel" style={{ border: '1px solid #e5e7eb' }}>
                <LabelInner r={rows[0]} showName={showName} showCode={showCode} showPrice={showPrice} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Yazdırma alanı — her etiket bir sayfa (Zebra termal) */}
      <div className="zsheet">
        {labels.map((l) => (
          <div key={l.key} className="zlabel">
            <LabelInner r={l} showName={showName} showCode={showCode} showPrice={showPrice} />
          </div>
        ))}
      </div>
    </div>
  );
}
