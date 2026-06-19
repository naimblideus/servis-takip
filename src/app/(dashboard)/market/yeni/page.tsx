'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StockItem { id: string; source: 'PART' | 'PRINTER'; name: string; brand?: string | null; model?: string | null; sellPrice: number; }

const MAX_PHOTOS = 4;

async function downscale(file: File, max = 1000, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) { const r = Math.min(max / width, max / height); width = Math.round(width * r); height = Math.round(height * r); }
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('ctx'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('img'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function YeniIlanPage() {
  const router = useRouter();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [showStock, setShowStock] = useState(false);
  const [form, setForm] = useState({ kind: 'PART', title: '', brand: '', model: '', condition: '', category: '', price: '', quantity: '1', unit: '', city: '', description: '', sourceKind: '', sourceId: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { fetch('/api/stock').then((r) => r.json()).then((d) => setStock(Array.isArray(d.items) ? d.items : [])).catch(() => {}); }, []);

  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return [];
    return stock.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [stock, stockSearch]);

  const pickStock = (i: StockItem) => {
    setForm((f) => ({ ...f, kind: i.source === 'PRINTER' ? 'PRINTER' : 'PART', title: i.name, brand: i.brand || '', model: i.model || '', price: i.sellPrice > 0 ? String(i.sellPrice) : f.price, sourceKind: i.source, sourceId: i.id }));
    setStockSearch(i.name); setShowStock(false);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      const out: string[] = [];
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        try { out.push(await downscale(f)); } catch { /* atla */ }
      }
      setPhotos((p) => [...p, ...out].slice(0, MAX_PHOTOS));
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!form.title.trim()) { setErr('Başlık zorunlu'); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch('/api/market/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, photos }) });
      const d = await r.json();
      if (r.ok) router.push(`/market/${d.id}`);
      else { setErr(d.error || 'Hata'); setSaving(false); }
    } catch { setErr('Sunucuya bağlanılamadı'); setSaving(false); }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
      <Link href="/market" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>← Pazar</Link>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.25rem 0 1rem' }}>＋ Yeni İlan</h1>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
        {/* Stoktan doldur */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <label style={lbl}>Stoktan doldur (opsiyonel)</label>
          <input value={stockSearch} onChange={(e) => { setStockSearch(e.target.value); setShowStock(true); }} placeholder="🔍 Stoktan ürün ara → bilgiler otomatik gelsin" style={inp} />
          {showStock && filteredStock.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
              {filteredStock.map((i) => (
                <div key={`${i.source}-${i.id}`} onClick={() => pickStock(i)} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem' }}>
                  {i.source === 'PART' ? '🔧' : '🖨️'} {i.name} {i.sellPrice > 0 && <span style={{ color: '#16a34a' }}>· ₺{i.sellPrice}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div><label style={lbl}>Tür</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inp}>
              <option value="PART">🔧 Parça</option><option value="PRINTER">🖨️ Yazıcı/Toner</option><option value="MACHINE">🏭 Makine</option><option value="OTHER">📦 Diğer</option>
            </select>
          </div>
          <div><label style={lbl}>Durum</label>
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} style={inp}>
              <option value="">—</option><option value="SIFIR">Sıfır</option><option value="IKINCI_EL">İkinci el</option>
            </select>
          </div>
        </div>

        <div><label style={lbl}>Başlık *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="örn. HP 26A Toner (orijinal)" style={inp} /></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div><label style={lbl}>Marka</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>Model</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inp} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <div><label style={lbl}>Fiyat (₺)</label><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>Adet</label><input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>Şehir</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="(boşsa profil)" style={inp} /></div>
        </div>

        <div><label style={lbl}>Açıklama</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Durum, uyumluluk, teslim şekli…" style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} /></div>

        {/* Fotoğraflar */}
        <div>
          <label style={lbl}>Fotoğraflar ({photos.length}/{MAX_PHOTOS})</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={p} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <button onClick={() => setPhotos((ph) => ph.filter((_, x) => x !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label style={{ width: 64, height: 64, border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', fontSize: '1.3rem' }}>
                {busy ? '…' : '＋'}
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>

        {err && <div style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{err}</div>}
        <button onClick={submit} disabled={saving || !form.title.trim()} style={{ padding: '0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', opacity: (saving || !form.title.trim()) ? 0.6 : 1 }}>
          {saving ? 'Yayınlanıyor…' : '📢 İlanı Yayınla'}
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box', width: '100%' };
const lbl: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 };
