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
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  REQUESTED: { bg: '#FEF6E7', color: '#8A5A08' },
  ACCEPTED: { bg: '#EAEDFB', color: '#2E3A8C' },
  REJECTED: { bg: '#FDECEC', color: '#9B1C1C' },
  CANCELLED: { bg: '#F2F4F8', color: '#5B6479' },
  SHIPPED: { bg: '#F1EAFB', color: '#5B2E90' },
  COMPLETED: { bg: '#E7F6EF', color: '#0B6B4A' },
};

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
    <div style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 880, margin: '0 auto' }}>
      <Link href="/market" className="mk-back">← Pazar</Link>
      <div className="mk-eyebrow" style={{ marginTop: 10 }}>Ticaret</div>
      <h1 className="mk-h1" style={{ marginBottom: '1.2rem' }}>Siparişlerim</h1>

      <div style={{ display: 'flex', gap: '.45rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {([['all', 'Tümü'], ['buyer', 'Aldıklarım'], ['seller', 'Sattıklarım']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="mk-chip" data-on={tab === k ? '1' : '0'}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '.65rem' }}>
          {[0, 1, 2].map((i) => <div key={i} className="mk-sk" style={{ height: 128 }} />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="mk-shell">
          <div className="mk-core" style={{ padding: '2.75rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.3rem', marginBottom: '.55rem' }}>📦</div>
            <div className="mk-eyebrow">Boş</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)', letterSpacing: '-.02em', margin: '.35rem 0 0' }}>Henüz sipariş yok</div>
            <p style={{ color: 'var(--ink2)', fontSize: '.9rem', margin: '.5rem auto 1.3rem', maxWidth: 380, lineHeight: 1.6 }}>
              Pazardan bir parça al ya da kendi ilanına sipariş gelmesini bekle.
            </p>
            <Link href="/market" className="mk-btn mk-btn-p" style={{ padding: '.7rem .8rem .7rem 1.25rem', fontWeight: 800 }}>
              <span>Pazara göz at</span><span className="mk-ico">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.65rem' }}>
          {shown.map((o) => {
            const st = STATUS_STYLE[o.status] || { bg: '#F2F4F8', color: '#5B6479' };
            return (
              <div key={o.id} className="mk-panel" style={{ padding: '1rem 1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="mk-pill" style={{ background: o.role === 'seller' ? '#F1EAFB' : '#EAEDFB', color: o.role === 'seller' ? '#5B2E90' : '#2E3A8C' }}>
                      {o.role === 'seller' ? 'SATIŞ' : 'ALIŞ'}
                    </span>
                    <Link href={`/market/${o.listingId}`} style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-.012em', fontSize: '.95rem' }}>{o.listingTitle || 'İlan'}</Link>
                  </div>
                  <span className="mk-pill" style={{ background: st.bg, color: st.color }}>{STATUS_TR[o.status] || o.status}</span>
                </div>

                <div style={{ fontSize: '.85rem', color: 'var(--ink2)', marginTop: 9 }}>
                  {o.role === 'seller' ? 'Alıcı' : 'Satıcı'}: <b style={{ color: 'var(--ink)' }}>{o.counterparty || 'Bayi'}</b>
                  <span style={{ color: 'var(--mut)' }}> · {o.quantity} × {fmt(o.unitPrice)} = </span>
                  <b className="mk-price" style={{ fontSize: '.92rem' }}>{fmt(o.totalPrice)}</b>
                </div>
                {o.note && <div style={{ fontSize: '.82rem', color: 'var(--ink2)', marginTop: 5, fontStyle: 'italic' }}>“{o.note}”</div>}
                <div style={{ fontSize: '.7rem', color: 'var(--mut)', marginTop: 6 }}>
                  {new Date(o.createdAt).toLocaleString('tr-TR')}{o.settled ? ' · ✓ stok + muhasebe işlendi' : ''}
                </div>

                <div style={{ display: 'flex', gap: '.45rem', marginTop: 12, flexWrap: 'wrap' }}>
                  {o.role === 'seller' && o.status === 'REQUESTED' && (<>
                    <button onClick={() => act(o.id, 'accept')} disabled={busy === o.id} style={btn('#0E9F6E')}>Onayla</button>
                    <button onClick={() => act(o.id, 'reject')} disabled={busy === o.id} style={btn('#C6362F')}>Reddet</button>
                  </>)}
                  {o.role === 'seller' && o.status === 'ACCEPTED' && (<>
                    <button onClick={() => act(o.id, 'ship')} disabled={busy === o.id} style={btn('#6D3BB0')}>Kargola</button>
                    <button onClick={() => act(o.id, 'cancel')} disabled={busy === o.id} style={btn('#6B7280')}>İptal</button>
                  </>)}
                  {o.role === 'seller' && o.status === 'SHIPPED' && (
                    <span style={{ fontSize: '.79rem', color: 'var(--mut)' }}>Alıcının teslim onayı bekleniyor…</span>
                  )}
                  {o.role === 'buyer' && o.status === 'REQUESTED' && (
                    <button onClick={() => act(o.id, 'cancel')} disabled={busy === o.id} style={btn('#6B7280')}>Talebi iptal et</button>
                  )}
                  {o.role === 'buyer' && ['ACCEPTED', 'SHIPPED'].includes(o.status) && (
                    <button onClick={() => act(o.id, 'complete')} disabled={busy === o.id} style={btn('#0E9F6E')}>Teslim aldım</button>
                  )}
                  {o.canReview && (
                    <button onClick={() => { setReviewing(o); setScore(5); setComment(''); }} style={btn('#B7791F')}>⭐ Değerlendir</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewing && (
        <div onClick={() => setReviewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,21,51,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="mk-shell" style={{ maxWidth: 440, width: '100%', boxShadow: '0 40px 80px -40px rgba(11,21,51,.8)' }}>
            <div className="mk-core" style={{ padding: '1.4rem 1.5rem' }}>
              <div className="mk-eyebrow">Değerlendirme</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)', letterSpacing: '-.02em', margin: '.35rem 0 0' }}>Satıcıyı değerlendir</div>
              <div style={{ fontSize: '.84rem', color: 'var(--ink2)', margin: '.3rem 0 1rem' }}>{reviewing.counterparty} · {reviewing.listingTitle}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: '1.9rem' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} onClick={() => setScore(s)} style={{ cursor: 'pointer', filter: s <= score ? 'none' : 'grayscale(1)', opacity: s <= score ? 1 : .3, transition: 'transform .2s cubic-bezier(.32,.72,0,1)', transform: s <= score ? 'scale(1)' : 'scale(.92)' }}>⭐</span>
                ))}
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yorum (opsiyonel)" rows={3} className="mk-in" style={{ marginTop: 14, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => setReviewing(null)} className="mk-btn" style={{ padding: '.55rem 1.1rem' }}>Vazgeç</button>
                <button onClick={submitReview} disabled={busy === reviewing.id} className="mk-btn mk-btn-g" style={{ padding: '.55rem .7rem .55rem 1.15rem' }}>
                  <span>Gönder</span><span className="mk-ico">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = (c: string): React.CSSProperties => ({
  padding: '.45rem 1rem', background: c, color: 'white', border: 'none', borderRadius: 999,
  fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '-.005em',
  transition: 'transform .2s cubic-bezier(.32,.72,0,1), box-shadow .2s cubic-bezier(.32,.72,0,1)',
});
