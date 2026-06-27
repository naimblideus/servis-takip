'use client';

import { useEffect, useRef, useState } from 'react';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import CameraScanner from '@/components/CameraScanner';

interface Part {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  stockQty: number;
}

interface LogEntry {
  ok: boolean;
  text: string;
  detail?: string;
}

export default function StockScanPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'in' | 'out'>('in'); // in=giriş(+), out=çıkış(−)
  const [qty, setQty] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  // En güncel state'e closure-safe erişim
  const partsRef = useRef<Part[]>([]);
  const modeRef = useRef(mode);
  const qtyRef = useRef(qty);
  partsRef.current = parts;
  modeRef.current = mode;
  qtyRef.current = qty;

  const load = () => {
    fetch('/api/inventory').then((r) => r.json()).then((d: Part[]) => {
      setParts(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const prependLog = (e: LogEntry) => setLog((l) => [e, ...l].slice(0, 50));

  const handleCode = async (raw: string) => {
    const code = raw.trim();
    if (!code || busy) return;
    const found = partsRef.current.find((p) => (p.barcode || '') === code || p.sku === code);
    if (!found) {
      prependLog({ ok: false, text: `Bulunamadı: ${code}`, detail: 'Bu barkod/SKU kayıtlı değil' });
      return;
    }
    const m = modeRef.current;
    const n = qtyRef.current;
    const delta = m === 'in' ? n : -n;
    if (m === 'out' && found.stockQty - n < 0) {
      prependLog({ ok: false, text: `${found.name}`, detail: `Stok yetersiz (mevcut: ${found.stockQty}, çıkış: ${n})` });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${found.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustQty: delta }),
      });
      if (res.ok) {
        const updated = await res.json();
        const newQty = typeof updated?.stockQty === 'number' ? updated.stockQty : found.stockQty + delta;
        setParts((ps) => ps.map((p) => (p.id === found.id ? { ...p, stockQty: newQty } : p)));
        prependLog({ ok: true, text: `${m === 'in' ? '📥 Giriş' : '📤 Çıkış'}: ${found.name}`, detail: `${found.stockQty} → ${newQty} (${delta > 0 ? '+' : ''}${delta})` });
      } else {
        const d = await res.json().catch(() => ({}));
        prependLog({ ok: false, text: `${found.name}`, detail: d.error || 'Güncellenemedi' });
      }
    } catch {
      prependLog({ ok: false, text: `${found.name}`, detail: 'Bağlantı hatası' });
    }
    setBusy(false);
  };

  useBarcodeWedge((code) => handleCode(code), { enabled: !loading });

  const totalIn = log.filter((l) => l.ok && l.text.includes('Giriş')).length;
  const totalOut = log.filter((l) => l.ok && l.text.includes('Çıkış')).length;

  const modeColor = mode === 'in' ? '#059669' : '#dc2626';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>📦 Hızlı Stok Giriş / Çıkış</h1>
      <p style={{ color: '#6b7280', margin: '0.25rem 0 1.25rem', fontSize: '0.9rem' }}>
        Modu seç, sonra parçaları <b>okut</b> (ya da kodu yazıp Enter'a bas). Her okutmada stok otomatik {mode === 'in' ? 'artar' : 'azalır'}.
      </p>

      {/* Mod + adet */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
          <button onClick={() => setMode('in')} style={{ padding: '0.6rem 1.4rem', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', background: mode === 'in' ? '#059669' : 'transparent', color: mode === 'in' ? 'white' : '#6b7280' }}>📥 Giriş (+)</button>
          <button onClick={() => setMode('out')} style={{ padding: '0.6rem 1.4rem', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', background: mode === 'out' ? '#dc2626' : 'transparent', color: mode === 'out' ? 'white' : '#6b7280' }}>📤 Çıkış (−)</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>Adet/okutma:</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: 70, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', fontWeight: 700, textAlign: 'center' }} />
        </div>
      </div>

      {/* Okutma kutusu (görsel + manuel) — <form> YOK: Enter doğrudan yakalanır (sayfa yenilenmez) */}
      <div style={{ border: `2px dashed ${modeColor}`, borderRadius: 12, padding: '1.25rem', textAlign: 'center', marginBottom: '1rem', background: mode === 'in' ? '#f0fdf4' : '#fef2f2' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: modeColor, marginBottom: 8 }}>
          {mode === 'in' ? '📥 GİRİŞ modu' : '📤 ÇIKIŞ modu'} — okutmaya hazır
        </div>
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Barkod/SKU okut veya yaz + Enter"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (manual.trim()) { handleCode(manual); setManual(''); } } }}
          style={{ width: '100%', maxWidth: 360, padding: '0.6rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', textAlign: 'center' }} />
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <CameraScanner onDetect={(c) => handleCode(c)} />
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>USB okuyucu açık alana okutursa otomatik işlenir; telefondaysan <b>📷 Kamerayla Tara</b> ile okut.</div>
      </div>

      {/* Özet */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #a7f3d0', borderRadius: 10, padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>BU OTURUM GİRİŞ</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{totalIn}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #fecaca', borderRadius: 10, padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>BU OTURUM ÇIKIŞ</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{totalOut}</div>
        </div>
      </div>

      {/* Log */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>Son işlemler</div>
        {log.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem', fontSize: '0.875rem' }}>Henüz okutma yapılmadı.</p>
        ) : (
          <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
            {log.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 1rem', borderBottom: '1px solid #f9fafb', background: e.ok ? 'white' : '#fef2f2' }}>
                <span style={{ fontSize: '1rem' }}>{e.ok ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{e.text}</div>
                  {e.detail && <div style={{ fontSize: '0.78rem', color: e.ok ? '#6b7280' : '#b91c1c' }}>{e.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
