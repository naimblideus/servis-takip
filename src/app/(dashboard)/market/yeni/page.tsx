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
    <div style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 680, margin: '0 auto' }}>
      <Link href="/market" className="mk-back">← Pazar</Link>
      <div className="mk-eyebrow" style={{ marginTop: 10 }}>Satıcı</div>
      <h1 className="mk-h1" style={{ marginBottom: '1.3rem' }}>Yeni İlan</h1>

      <div className="mk-shell">
        <div className="mk-core" style={{ display: 'grid', gap: '.9rem', padding: '1.35rem 1.4rem' }}>
          {/* Stoktan doldur */}
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <label className="mk-lbl">Stoktan doldur (opsiyonel)</label>
            <input value={stockSearch} onChange={(e) => { setStockSearch(e.target.value); setShowStock(true); }} placeholder="Stoktan ürün ara — bilgiler otomatik gelsin" className="mk-in" />
            {showStock && filteredStock.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid var(--line)', borderRadius: 14, marginTop: 6, maxHeight: 230, overflowY: 'auto', boxShadow: '0 22px 44px -24px rgba(15,34,83,.6)' }}>
                {filteredStock.map((i) => (
                  <div key={`${i.source}-${i.id}`} onClick={() => pickStock(i)} style={{ padding: '.6rem .85rem', cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: '.87rem', color: 'var(--ink)' }}>
                    {i.source === 'PART' ? '🔧' : '🖨️'} {i.name} {i.sellPrice > 0 && <span className="mk-price" style={{ fontSize: '.82rem' }}>· ₺{i.sellPrice}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
            <div>
              <label className="mk-lbl">Tür</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="mk-in">
                <option value="PART">🔧 Parça</option><option value="PRINTER">🖨️ Yazıcı/Toner</option><option value="MACHINE">🏭 Makine</option><option value="OTHER">📦 Diğer</option>
              </select>
            </div>
            <div>
              <label className="mk-lbl">Durum</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mk-in">
                <option value="">—</option><option value="SIFIR">Sıfır</option><option value="IKINCI_EL">İkinci el</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mk-lbl">Başlık *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="örn. HP 26A Toner (orijinal)" className="mk-in" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
            <div><label className="mk-lbl">Marka</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mk-in" /></div>
            <div><label className="mk-lbl">Model</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mk-in" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
            <div><label className="mk-lbl">Fiyat (₺)</label><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mk-in" /></div>
            <div><label className="mk-lbl">Adet</label><input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mk-in" /></div>
            <div><label className="mk-lbl">Şehir</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="(boşsa profil)" className="mk-in" /></div>
          </div>

          <div>
            <label className="mk-lbl">Açıklama</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Durum, uyumluluk, teslim şekli…" className="mk-in" style={{ minHeight: 84, resize: 'vertical' }} />
          </div>

          {/* Fotoğraflar */}
          <div>
            <label className="mk-lbl">Fotoğraflar ({photos.length}/{MAX_PHOTOS})</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p} alt="" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
                  <button onClick={() => setPhotos((ph) => ph.filter((_, x) => x !== i))}
                    style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: '50%', background: '#C6362F', color: 'white', border: '2px solid #fff', cursor: 'pointer', fontSize: '.68rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label style={{ width: 68, height: 68, border: '1px dashed rgba(15,34,83,.22)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--mut)', fontSize: '1.35rem', background: 'rgba(15,34,83,.02)' }}>
                  {busy ? '…' : '＋'}
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </div>

          {err && <div style={{ color: '#B91C1C', fontSize: '.85rem' }}>{err}</div>}

          <button onClick={submit} disabled={saving || !form.title.trim()} className="mk-btn mk-btn-g"
            style={{ justifyContent: 'center', padding: '.8rem 1rem', fontSize: '.95rem', fontWeight: 800, opacity: (saving || !form.title.trim()) ? .55 : 1 }}>
            <span>{saving ? 'Yayınlanıyor…' : 'İlanı Yayınla'}</span>
            {!saving && <span className="mk-ico">→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
