'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';

interface StockItem { id: string; source: 'PART' | 'PRINTER'; name: string; sku?: string | null; barcode?: string | null; sellPrice: number; }
interface Row { key: string; code: string; name: string; price: number; copies: number; }

// Code 128 — yalnız yazdırılabilir ASCII; Türkçe/özel karakter varsa basmaz, uyarır.
function Barcode({ value, heightMm }: { value: string; heightMm: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const valid = /^[\x20-\x7E]+$/.test(value || '');
  useEffect(() => {
    if (ref.current && valid) {
      try { JsBarcode(ref.current, value, { format: 'CODE128', height: heightMm * 3.78, width: 2, margin: 0, displayValue: false }); } catch { /* yoksay */ }
    }
  }, [value, heightMm, valid]);
  if (!valid) return <div style={{ fontSize: 9, color: '#b91c1c' }}>⚠ Barkod uyumsuz (özel karakter)</div>;
  return <svg ref={ref} style={{ width: '92%', height: `${heightMm}mm` }} preserveAspectRatio="none" />;
}

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
          body { background: white !important; }
          .zlabel { page-break-after: always; break-after: page; }
          .zlabel:last-child { page-break-after: auto; break-after: auto; }
          .zsheet { display: block !important; }
        }
        @page { size: ${w}mm ${h}mm; margin: 0; }
        .zsheet { display: none; }
        .zlabel {
          width: ${w}mm; height: ${h}mm; box-sizing: border-box; padding: 1.5mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; overflow: hidden; background: white; color: black;
        }
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

        {msg && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.5rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{msg}</div>}

        {/* Ayarlar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div><label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Genişlik (mm)</label>
            <input type="number" min={20} max={120} value={w} onChange={(e) => setW(Math.max(20, Math.min(120, parseInt(e.target.value) || 50)))} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} /></div>
          <div><label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Yükseklik (mm)</label>
            <input type="number" min={15} max={120} value={h} onChange={(e) => setH(Math.max(15, Math.min(120, parseInt(e.target.value) || 30)))} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} /></div>
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

        {/* Önizleme (tek etiket) */}
        {rows[0] && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Önizleme ({w}×{h} mm)</div>
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, display: 'inline-block', background: '#f8fafc' }}>
              <div className="zlabel" style={{ width: `${w}mm`, height: `${h}mm`, boxSizing: 'border-box', padding: '1.5mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden', background: 'white', border: '1px solid #e5e7eb' }}>
                {showName && <div style={{ fontSize: '2.6mm', fontWeight: 700, lineHeight: 1.1, marginBottom: '1mm', maxHeight: '6mm', overflow: 'hidden' }}>{rows[0].name}</div>}
                <Barcode value={rows[0].code} heightMm={Math.max(8, h * 0.42)} />
                {showCode && <div style={{ fontSize: '2.4mm', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '0.5mm' }}>{rows[0].code}</div>}
                {showPrice && <div style={{ fontSize: '3mm', fontWeight: 800, marginTop: '0.5mm' }}>{fmt(rows[0].price)}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Yazdırma alanı — her etiket bir sayfa (Zebra termal) */}
      <div className="zsheet">
        {labels.map((l) => (
          <div key={l.key} className="zlabel">
            {showName && <div style={{ fontSize: '2.6mm', fontWeight: 700, lineHeight: 1.1, marginBottom: '1mm', maxHeight: '6mm', overflow: 'hidden' }}>{l.name}</div>}
            <Barcode value={l.code} heightMm={Math.max(8, h * 0.42)} />
            {showCode && <div style={{ fontSize: '2.4mm', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '0.5mm' }}>{l.code}</div>}
            {showPrice && <div style={{ fontSize: '3mm', fontWeight: 800, marginTop: '0.5mm' }}>{fmt(l.price)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
