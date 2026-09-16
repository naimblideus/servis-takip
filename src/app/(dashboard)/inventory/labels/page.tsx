'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Part {
  id: string;
  sku: string;
  name: string;
  sellPrice: number;
  barcode?: string | null;
}

// Tek bir Code 128 barkodu SVG olarak çizer. Code 128 yalnız yazdırılabilir ASCII destekler;
// Türkçe/özel karakter varsa barkod basılmaz, net bir uyarı gösterilir (sessiz boş alan yerine).
function Barcode({ value, height, uyumsuz }: { value: string; height: number; uyumsuz: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const valid = /^[\x20-\x7E]+$/.test(value || '');
  useEffect(() => {
    if (ref.current && valid) {
      try {
        // margin: quiet zone (ISO/IEC 15417) — okuyucu güvenilirliği için zorunlu
        JsBarcode(ref.current, value, { format: 'CODE128', height, width: 1.5, margin: 10, displayValue: false });
      } catch { /* yoksay */ }
    }
  }, [value, height, valid]);
  if (!valid) return <div style={{ fontSize: 10, color: '#b91c1c', padding: '4px 0' }}>{uyumsuz}</div>;
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
}

export default function LabelsPage() {
  const t = useT();
  const b = useBicim();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copies, setCopies] = useState(1);
  const [cols, setCols] = useState(3);
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);

  useEffect(() => {
    fetch('/api/inventory').then((r) => r.json()).then((d: Part[]) => {
      setParts(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q))
      : parts;
    return list;
  }, [parts, search]);

  // Etiket listesi: her parça × kopya adedi. Barkod değeri = barcode varsa o, yoksa SKU.
  const labels = useMemo(() => {
    const out: { key: string; code: string; name: string; sku: string; price: number }[] = [];
    filtered.forEach((p) => {
      const code = (p.barcode && p.barcode.trim()) || p.sku;
      for (let i = 0; i < copies; i++) {
        out.push({ key: `${p.id}-${i}`, code, name: p.name, sku: p.sku, price: Number(p.sellPrice) });
      }
    });
    return out;
  }, [filtered, copies]);

  // Etiketi rafta müşteri de okuyor; fiyat bayinin para biriminde.
  const fmt = (n: number) => b.para(n);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          body { background: white !important; }
          .label-grid { gap: 0 !important; }
          .label-cell { break-inside: avoid; }
        }
        @page { size: A4 portrait; margin: 8mm; }
      `}</style>

      {/* ── Kontroller (yazdırılmaz) ── */}
      <div className="no-print" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.barkodEtiket.parcaBaslik}</h1>
            <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              {t.barkodEtiket.parcaAlt}
            </p>
          </div>
          <button onClick={() => window.print()} style={{ padding: '0.6rem 1.3rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}>
            {doldur(t.barkodEtiket.yazdir, { n: labels.length })}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
          <div style={{ flex: '1', minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{t.barkodEtiket.parcaAra}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.barkodEtiket.parcaAraYer}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{t.barkodEtiket.kopyaParca}</label>
            <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              style={{ width: 90, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{t.barkodEtiket.sutun}</label>
            <select value={cols} onChange={(e) => setCols(parseInt(e.target.value))} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
              {[2, 3, 4].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 6 }}>
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> {t.barkodEtiket.urunAdi}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 6 }}>
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> {t.barkodEtiket.fiyat}
          </label>
        </div>
      </div>

      {/* ── Etiket Izgarası (yazdırılır) ── */}
      {labels.length > 300 && (
        <div className="no-print" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          {doldur(t.barkodEtiket.cokFazla, { n: labels.length })}
        </div>
      )}
      {loading ? (
        <p style={{ color: '#9ca3af' }}>{t.genel.yukleniyor}</p>
      ) : labels.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>{t.barkodEtiket.parcaYok}</p>
      ) : (
        <div className="label-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}>
          {labels.slice(0, 300).map((l) => (
            <div key={l.key} className="label-cell" style={{
              border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 96, background: 'white',
            }}>
              {showName && <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.15, marginBottom: 4, maxHeight: 28, overflow: 'hidden' }}>{l.name}</div>}
              <Barcode value={l.code} height={38} uyumsuz={t.barkodEtiket.barkodUyumsuzOzel} />
              <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, marginTop: 2 }}>{l.code}</div>
              {showPrice && <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', marginTop: 2 }}>{fmt(l.price)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
