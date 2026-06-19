'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Order {
  id: string; listingId: string; listingTitle: string | null; listingKind: string | null;
  role: 'seller' | 'buyer'; counterparty: string | null;
  quantity: number; unitPrice: number; totalPrice: number;
  status: string; note: string | null; createdAt: string; settled: boolean; canReview: boolean;
}

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_TR: Record<string, string> = { REQUESTED: 'Talep edildi', ACCEPTED: 'Onaylandı', REJECTED: 'Reddedildi', CANCELLED: 'İptal edildi', SHIPPED: 'Kargoda', COMPLETED: 'Tamamlandı' };
const STATUS_COLOR: Record<string, string> = { REQUESTED: '#d97706', ACCEPTED: '#2563eb', REJECTED: '#dc2626', CANCELLED: '#6b7280', SHIPPED: '#7c3aed', COMPLETED: '#16a34a' };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'buyer' | 'seller'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Order | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/market/orders');
      if (r.ok) { const d = await r.json(); setOrders(d.orders || []); }
    } catch { /* yoksay */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    if (action === 'reject' && !confirm('Sipariş reddedilsin mi?')) return;
    if (action === 'cancel' && !confirm('Sipariş iptal edilsin mi?')) return;
    if (action === 'complete' && !confirm('Tamamlandı olarak işaretlensin mi? Bu işlem stok ve muhasebeye işlenir.')) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/market/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) alert(d.error || 'İşlem yapılamadı');
      else if (action === 'complete' && d.settled) alert('✓ Tamamlandı. Stok ve muhasebe kayıtları her iki tarafta da oluşturuldu.');
      await load();
    } catch { alert('Sunucuya bağlanılamadı'); }
    setBusy(null);
  };

  const submitReview = async () => {
    if (!reviewing) return;
    setBusy(reviewing.id);
    try {
      const r = await fetch(`/api/market/orders/${reviewing.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score, comment: comment.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) alert(d.error || 'Değerlendirme kaydedilemedi');
      else { setReviewing(null); setComment(''); setScore(5); await load(); }
    } catch { alert('Sunucuya bağlanılamadı'); }
    setBusy(null);
  };

  const shown = orders.filter((o) => tab === 'all' || o.role === tab);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Link href="/market" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>← Pazar</Link>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Siparişlerim</h1>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {([['all', 'Tümü'], ['buyer', 'Aldıklarım'], ['seller', 'Sattıklarım']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '0.4rem 0.9rem', borderRadius: 999, border: '1px solid', borderColor: tab === k ? '#16a34a' : '#d1d5db', background: tab === k ? '#16a34a' : 'white', color: tab === k ? 'white' : '#374151', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {loading ? <div style={{ color: '#6b7280' }}>Yükleniyor…</div>
        : shown.length === 0 ? <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Henüz sipariş yok.</div>
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {shown.map((o) => (
              <div key={o.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: o.role === 'seller' ? '#7c3aed' : '#2563eb', background: o.role === 'seller' ? '#f3e8ff' : '#eff6ff', padding: '2px 8px', borderRadius: 999 }}>{o.role === 'seller' ? 'SATIŞ' : 'ALIŞ'}</span>
                    <Link href={`/market/${o.listingId}`} style={{ fontWeight: 700, marginLeft: 8, color: '#111827', textDecoration: 'none' }}>{o.listingTitle || 'İlan'}</Link>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: STATUS_COLOR[o.status] || '#374151' }}>{STATUS_TR[o.status] || o.status}</span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#6b7280', marginTop: 6 }}>
                  {o.role === 'seller' ? 'Alıcı' : 'Satıcı'}: <b style={{ color: '#374151' }}>{o.counterparty || 'Bayi'}</b> · {o.quantity} × {fmt(o.unitPrice)} = <b style={{ color: '#16a34a' }}>{fmt(o.totalPrice)}</b>
                </div>
                {o.note && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>“{o.note}”</div>}
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 4 }}>{new Date(o.createdAt).toLocaleString('tr-TR')}{o.settled ? ' · ✓ stok+muhasebe işlendi' : ''}</div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {o.role === 'seller' && o.status === 'REQUESTED' && (<>
                    <button onClick={() => act(o.id, 'accept')} disabled={busy === o.id} style={btn('#16a34a')}>Onayla</button>
                    <button onClick={() => act(o.id, 'reject')} disabled={busy === o.id} style={btn('#dc2626')}>Reddet</button>
                  </>)}
                  {o.role === 'seller' && o.status === 'ACCEPTED' && (<>
                    <button onClick={() => act(o.id, 'ship')} disabled={busy === o.id} style={btn('#7c3aed')}>Kargola</button>
                    <button onClick={() => act(o.id, 'cancel')} disabled={busy === o.id} style={btn('#6b7280')}>İptal</button>
                  </>)}
                  {o.role === 'seller' && o.status === 'SHIPPED' && (
                    <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Alıcının teslim onayı bekleniyor…</span>
                  )}
                  {o.role === 'buyer' && o.status === 'REQUESTED' && (
                    <button onClick={() => act(o.id, 'cancel')} disabled={busy === o.id} style={btn('#6b7280')}>Talebi iptal et</button>
                  )}
                  {o.role === 'buyer' && ['ACCEPTED', 'SHIPPED'].includes(o.status) && (
                    <button onClick={() => act(o.id, 'complete')} disabled={busy === o.id} style={btn('#16a34a')}>Teslim aldım</button>
                  )}
                  {o.canReview && (
                    <button onClick={() => { setReviewing(o); setScore(5); setComment(''); }} style={btn('#d97706')}>⭐ Değerlendir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      {reviewing && (
        <div onClick={() => setReviewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '1.4rem', maxWidth: 420, width: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Satıcıyı değerlendir</div>
            <div style={{ fontSize: '0.84rem', color: '#6b7280', margin: '0.25rem 0 0.9rem' }}>{reviewing.counterparty} · {reviewing.listingTitle}</div>
            <div style={{ display: 'flex', gap: 6, fontSize: '1.8rem' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} onClick={() => setScore(s)} style={{ cursor: 'pointer', filter: s <= score ? 'none' : 'grayscale(1)', opacity: s <= score ? 1 : 0.35 }}>⭐</span>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yorum (opsiyonel)" rows={3} style={{ width: '100%', marginTop: 12, padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setReviewing(null)} style={{ padding: '0.55rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Vazgeç</button>
              <button onClick={submitReview} disabled={busy === reviewing.id} style={{ padding: '0.55rem 1.2rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: busy === reviewing.id ? 0.6 : 1 }}>Gönder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = (c: string): React.CSSProperties => ({ padding: '0.42rem 0.85rem', background: c, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' });
