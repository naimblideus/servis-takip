'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import CameraScanner from '@/components/CameraScanner';

interface StockItem { id: string; source: 'PART' | 'PRINTER'; name: string; sku?: string | null; barcode?: string | null; sellPrice: number; stockQty: number; }
interface Customer { id: string; name: string; phone: string; }
interface CartLine { key: string; kind: 'PART' | 'PRINTER'; id: string; name: string; unitPrice: number; qty: number; stockQty: number; }

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SatisPage() {
  const { data: session } = useSession();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [seller, setSeller] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState(true); // true=peşin, false=açık hesap
  const [method, setMethod] = useState('CASH');
  const [custSearch, setCustSearch] = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [sel, setSel] = useState<Customer | null>(null);
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const stockRef = useRef<StockItem[]>([]);
  stockRef.current = stock;

  const load = () => {
    fetch('/api/stock').then((r) => r.json()).then((d) => setStock(Array.isArray(d.items) ? d.items : [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d) => setCustomers(Array.isArray(d) ? d : d.customers || [])).catch(() => {});
    fetch('/api/users').then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  // Satışı yapan: varsayılan = giriş yapan kullanıcı (elle değiştirilebilir)
  useEffect(() => { if (!seller && session?.user?.name) setSeller(session.user.name); }, [session, seller]);
  useEffect(() => {
    const h = () => setShowCustDrop(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const addByCode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const found = stockRef.current.find((i) => (i.barcode || '') === code || (i.sku || '') === code);
    if (!found) { setMsg({ text: `Bulunamadı: ${code} — stoğa barkod ekleyin`, ok: false }); return; }
    addItem(found);
    setMsg({ text: `✓ Eklendi: ${found.name}`, ok: true });
  };

  const addItem = (it: StockItem) => {
    setCart((c) => {
      const key = `${it.source}-${it.id}`;
      const ex = c.find((l) => l.key === key);
      if (ex) return c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key, kind: it.source, id: it.id, name: it.name, unitPrice: Number(it.sellPrice) || 0, qty: 1, stockQty: it.stockQty }];
    });
  };

  useBarcodeWedge((code) => addByCode(code), { enabled: true });

  const total = useMemo(() => cart.reduce((s, l) => s + l.qty * l.unitPrice, 0), [cart]);
  const filteredCusts = customers.filter((c) => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).slice(0, 12);

  const complete = async () => {
    if (!sel) { setMsg({ text: 'Önce müşteri seçin', ok: false }); return; }
    if (cart.length === 0) { setMsg({ text: 'Sepet boş', ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: sel.id, paid, method,
          sellerName: seller.trim() || undefined,
          sellerUserId: users.find((u) => u.name === seller.trim())?.id,
          items: cart.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty, unitPrice: l.unitPrice, name: l.name })),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg({ text: `✓ Satış kaydedildi: ${d.count} kalem · ${fmt(d.total)} ${paid ? '(peşin — tahsil edildi)' : '(açık hesap — cariye işlendi)'}`, ok: true });
        setCart([]); load();
      } else setMsg({ text: '❌ ' + (d.error || 'Hata'), ok: false });
    } catch { setMsg({ text: '❌ Sunucuya bağlanılamadı', ok: false }); }
    setSaving(false);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🛒 Barkodla Satış</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          Ürünü okut → sepete düşer → müşteri + ödeme seç → tamamla. Stok otomatik düşer, muhasebeye işlenir.
        </p>
      </div>

      {msg && (
        <div style={{ margin: '0 0 1rem', padding: '0.6rem 0.9rem', borderRadius: 10, fontSize: '0.88rem', fontWeight: 600,
          background: msg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, color: msg.ok ? '#15803d' : '#b91c1c' }}>
          {msg.text}
        </div>
      )}

      {/* Müşteri + mod */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Müşteri *</label>
          <input style={inp} value={custSearch} placeholder="Müşteri ara…"
            onChange={(e) => { setCustSearch(e.target.value); setShowCustDrop(true); setSel(null); }}
            onFocus={() => setShowCustDrop(true)} autoComplete="off" />
          {sel && <span style={{ position: 'absolute', right: 10, top: 32, color: '#10b981' }}>✓</span>}
          {showCustDrop && custSearch && !sel && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
              {filteredCusts.length === 0 ? <div style={{ padding: '0.5rem 0.75rem', color: '#9ca3af', fontSize: '0.85rem' }}>Bulunamadı</div> :
                filteredCusts.map((c) => (
                  <div key={c.id} onClick={() => { setSel(c); setCustSearch(c.name); setShowCustDrop(false); }}
                    style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6' }}>
                    {c.name} <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>· {c.phone}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ödeme</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, flex: 1 }}>
              <button type="button" onClick={() => setPaid(true)} style={{ flex: 1, padding: '0.45rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: paid ? '#16a34a' : 'transparent', color: paid ? 'white' : '#6b7280' }}>Peşin</button>
              <button type="button" onClick={() => setPaid(false)} style={{ flex: 1, padding: '0.45rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: !paid ? '#d97706' : 'transparent', color: !paid ? 'white' : '#6b7280' }}>Açık Hesap</button>
            </div>
            {paid && (
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="CASH">💵 Nakit</option>
                <option value="CARD">💳 Kart</option>
                <option value="TRANSFER">🏦 Havale</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Satışı yapan (teknisyen) — otomatik gelir, elle değiştirilebilir */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Satışı yapan (teknisyen)</label>
        <input list="seller-list" value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Adı yaz veya listeden seç" style={inp} />
        <datalist id="seller-list">
          {users.map((u) => <option key={u.id} value={u.name} />)}
        </datalist>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>Varsayılan giriş yapan kişidir; satışı başka teknisyen yaptıysa elle yaz veya seç.</div>
      </div>

      {/* Okutma kutusu */}
      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { addByCode(manual); setManual(''); } }}
        style={{ border: '2px dashed #16a34a', borderRadius: 12, padding: '1rem', textAlign: 'center', marginBottom: '1rem', background: '#f0fdf4' }}>
        <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8, fontSize: '0.95rem' }}>📷 Ürünü okut veya kodu yaz</div>
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Barkod/SKU + Enter"
          style={{ width: '100%', maxWidth: 340, padding: '0.55rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', textAlign: 'center' }} />
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <CameraScanner onDetect={(c) => addByCode(c)} />
        </div>
      </form>

      {/* Sepet */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.85rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
          <span>Sepet ({cart.length} kalem)</span>
          {cart.length > 0 && <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Temizle</button>}
        </div>
        {cart.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem', fontSize: '0.875rem' }}>Henüz ürün okutulmadı.</p>
        ) : (
          <div>
            {cart.map((l) => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontSize: '1rem' }}>{l.kind === 'PART' ? '🔧' : '🖨️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                  <div style={{ fontSize: '0.72rem', color: l.qty > l.stockQty ? '#dc2626' : '#9ca3af' }}>Stok: {l.stockQty}{l.qty > l.stockQty ? ' ⚠ yetersiz' : ''}</div>
                </div>
                <input type="number" min={1} value={l.qty} onChange={(e) => { const q = Math.max(1, parseInt(e.target.value) || 1); setCart((c) => c.map((x) => x.key === l.key ? { ...x, qty: q } : x)); }}
                  style={{ width: 56, padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', textAlign: 'center' }} />
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>×</span>
                <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => { const p = Math.max(0, parseFloat(e.target.value) || 0); setCart((c) => c.map((x) => x.key === l.key ? { ...x, unitPrice: p } : x)); }}
                  style={{ width: 86, padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', textAlign: 'right' }} />
                <span style={{ width: 90, textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>{fmt(l.qty * l.unitPrice)}</span>
                <button onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))} title="Çıkar" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alt bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', position: 'sticky', bottom: 0, background: '#fff', padding: '0.75rem 0' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>Toplam: <span style={{ color: '#16a34a' }}>{fmt(total)}</span></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/accounting" style={{ padding: '0.7rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, color: '#374151', textDecoration: 'none', fontSize: '0.9rem' }}>📊 Muhasebe</Link>
          <button onClick={complete} disabled={saving || cart.length === 0 || !sel}
            style={{ padding: '0.7rem 1.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', opacity: (saving || cart.length === 0 || !sel) ? 0.5 : 1 }}>
            {saving ? 'Kaydediliyor…' : '✅ Satışı Tamamla'}
          </button>
        </div>
      </div>
    </div>
  );
}
