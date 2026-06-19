'use client';

import { useEffect, useState, useCallback, use as usePromise } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Listing {
  id: string; kind: string; title: string; description: string | null; brand: string | null; model: string | null;
  condition: string | null; category: string | null; price: number; currency: string; quantity: number; unit: string | null;
  city: string | null; photos: string[]; status: string; sellerName: string | null; isOwner: boolean;
  sellerRating: number | null; sellerRatingCount: number;
}
interface Msg { id: string; body: string; senderName: string | null; mine: boolean; createdAt: string; }

const KINDS: Record<string, string> = { PART: '🔧 Parça', PRINTER: '🖨️ Yazıcı/Toner', MACHINE: '🏭 Makine', OTHER: '📦 Diğer' };
const STATUS: Record<string, string> = { ACTIVE: 'Aktif', PAUSED: 'Duraklatıldı', SOLD: 'Satıldı', REMOVED: 'Kaldırıldı' };
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [l, setL] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [qty, setQty] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  const loadListing = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/market/listings/${id}`);
      if (r.ok) { const d = await r.json(); setL(d.listing); } else setNotFound(true);
    } catch { setNotFound(true); }
    setLoading(false);
  }, [id]);

  const loadMsgs = useCallback(async () => {
    try {
      const r = await fetch(`/api/market/messages?listingId=${id}`);
      if (r.ok) { const d = await r.json(); setMsgs(d.messages || []); }
    } catch { /* yoksay */ }
  }, [id]);

  useEffect(() => { loadListing(); }, [loadListing]);
  useEffect(() => { if (l && !l.isOwner) loadMsgs(); }, [l, loadMsgs]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/market/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: id, body: text.trim() }) });
      if (r.ok) { setText(''); loadMsgs(); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || 'Gönderilemedi'); }
    } catch { alert('Sunucuya bağlanılamadı'); }
    setSending(false);
  };

  const placeOrder = async () => {
    setOrdering(true);
    try {
      const r = await fetch('/api/market/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: id, quantity: qty, note: orderNote.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setOrderDone(true);
      else alert(d.error || 'Sipariş oluşturulamadı');
    } catch { alert('Sunucuya bağlanılamadı'); }
    setOrdering(false);
  };

  const setStatus = async (status: string) => {
    await fetch(`/api/market/listings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadListing();
  };
  const remove = async () => {
    if (!confirm('İlan kaldırılsın mı?')) return;
    await fetch(`/api/market/listings/${id}`, { method: 'DELETE' });
    router.push('/market/ilanlarim');
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;
  if (notFound || !l) return <div style={{ padding: '2rem', color: '#6b7280' }}>İlan bulunamadı. <Link href="/market" style={{ color: '#2563eb' }}>← Pazar</Link></div>;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 760, margin: '0 auto' }}>
      <Link href="/market" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>← Pazar</Link>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginTop: '0.5rem' }}>
        {/* Fotoğraflar */}
        {l.photos.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', background: '#f3f4f6' }}>
            {l.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 220, objectFit: 'cover' }} />)}
          </div>
        ) : (
          <div style={{ height: 140, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', opacity: 0.4 }}>{(KINDS[l.kind] || '📦').split(' ')[0]}</div>
        )}

        <div style={{ padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{KINDS[l.kind] || l.kind}{l.condition ? ` · ${l.condition === 'SIFIR' ? 'Sıfır' : 'İkinci el'}` : ''}{l.status !== 'ACTIVE' ? ` · ${STATUS[l.status] || l.status}` : ''}</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0' }}>{l.title}</h1>
          {(l.brand || l.model) && <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{[l.brand, l.model].filter(Boolean).join(' ')}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.6rem', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>{fmt(l.price)}</span>
            <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>Adet: {l.quantity}{l.unit ? ` ${l.unit}` : ''} · 🏪 {l.sellerName}{l.sellerRating ? ` · ⭐${l.sellerRating} (${l.sellerRatingCount})` : ''}{l.city ? ` · ${l.city}` : ''}</span>
          </div>
          {l.description && <p style={{ marginTop: '0.85rem', color: '#374151', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.description}</p>}
        </div>
      </div>

      {/* Sahip: yönetim · Alıcı: mesaj */}
      {l.isOwner ? (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '1rem', marginTop: '0.85rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e40af', marginBottom: 8 }}>Bu senin ilanın</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {l.status !== 'ACTIVE' && <button onClick={() => setStatus('ACTIVE')} style={ownBtn('#16a34a')}>Aktifleştir</button>}
            {l.status === 'ACTIVE' && <button onClick={() => setStatus('PAUSED')} style={ownBtn('#d97706')}>Duraklat</button>}
            {l.status !== 'SOLD' && <button onClick={() => setStatus('SOLD')} style={ownBtn('#6366f1')}>Satıldı işaretle</button>}
            <Link href="/market/mesajlar" style={{ ...ownBtn('#2563eb'), textDecoration: 'none', display: 'inline-block' }}>💬 Gelen mesajlar</Link>
            <button onClick={remove} style={ownBtn('#dc2626')}>🗑️ Kaldır</button>
          </div>
        </div>
      ) : (
        <>
        {l.status === 'ACTIVE' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '1rem', marginTop: '0.85rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#15803d', marginBottom: 8 }}>📦 Sipariş Ver</div>
            {orderDone ? (
              <div style={{ fontSize: '0.9rem', color: '#166534' }}>✓ Sipariş talebin gönderildi. <Link href="/market/siparislerim" style={{ color: '#2563eb', fontWeight: 700 }}>Siparişlerim →</Link></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.82rem', color: '#374151' }}>Adet:</label>
                  <input type="number" min={1} max={l.quantity} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(l.quantity, parseInt(e.target.value) || 1)))} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8 }} />
                  <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>× {fmt(l.price)} = <b style={{ color: '#16a34a' }}>{fmt(l.price * qty)}</b></span>
                </div>
                <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Not (opsiyonel): teslimat, kargo vb." rows={2} style={{ width: '100%', marginTop: 8, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical' }} />
                <button onClick={placeOrder} disabled={ordering} style={{ marginTop: 8, padding: '0.6rem 1.2rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: ordering ? 0.6 : 1 }}>{ordering ? 'Gönderiliyor…' : 'Sipariş Talebi Gönder'}</button>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>Talebin satıcıya iletilir; onaylayınca süreç başlar. Ödeme/teslimat bayiler arasındadır.</p>
              </>
            )}
          </div>
        )}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginTop: '0.85rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>💬 Satıcıya mesaj</div>
          {msgs.length > 0 && (
            <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 10, padding: '0.25rem' }}>
              {msgs.map((m) => (
                <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', justifySelf: m.mine ? 'end' : 'start', maxWidth: '85%', background: m.mine ? '#dcfce7' : '#f3f4f6', borderRadius: 10, padding: '0.45rem 0.7rem' }}>
                  <div style={{ fontSize: '0.88rem', color: '#111827', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  <div style={{ fontSize: '0.66rem', color: '#9ca3af', marginTop: 2 }}>{m.mine ? 'Sen' : (m.senderName || 'Satıcı')} · {new Date(m.createdAt).toLocaleString('tr-TR')}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Mesajını yaz…" style={{ flex: 1, padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
            <button onClick={send} disabled={sending || !text.trim()} style={{ padding: '0.6rem 1.1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: (sending || !text.trim()) ? 0.6 : 1 }}>Gönder</button>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.5rem 0 0' }}>İletişim bilgisi baştan paylaşılmaz; satıcı dönünce burada konuşursunuz.</p>
        </div>
        </>
      )}
    </div>
  );
}

const ownBtn = (c: string): React.CSSProperties => ({ padding: '0.45rem 0.8rem', background: 'white', border: `1px solid ${c}`, color: c, borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' });
