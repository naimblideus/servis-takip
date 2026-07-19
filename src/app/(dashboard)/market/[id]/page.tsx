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

  if (loading) return (
    <div style={{ padding: '1.5rem 1.25rem', maxWidth: 800, margin: '0 auto' }}>
      <div className="mk-sk" style={{ height: 240 }} />
      <div className="mk-sk" style={{ height: 120, marginTop: '.85rem' }} />
    </div>
  );
  if (notFound || !l) return (
    <div style={{ padding: '3rem 1.25rem', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: '2.2rem', marginBottom: '.5rem' }}>🔍</div>
      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>İlan bulunamadı</div>
      <p style={{ color: 'var(--ink2)', fontSize: '.9rem', margin: '.4rem 0 1.2rem' }}>Kaldırılmış ya da satılmış olabilir.</p>
      <Link href="/market" className="mk-btn mk-btn-p"><span>Pazara dön</span><span className="mk-ico">→</span></Link>
    </div>
  );

  const sold = l.status !== 'ACTIVE';

  return (
    <div style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/market" className="mk-back">← Pazar</Link>

      <div className="mk-panel" style={{ overflow: 'hidden', marginTop: '.7rem' }}>
        {/* Fotoğraflar */}
        {l.photos.length > 0 ? (
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', background: '#F2F4F8' }}>
            {l.photos.map((p, i) => <img key={i} src={p} alt="" style={{ height: 250, objectFit: 'cover', flexShrink: 0 }} />)}
          </div>
        ) : (
          <div style={{ height: 160, background: '#F2F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.6rem', opacity: .3 }}>
            {(KINDS[l.kind] || '📦').split(' ')[0]}
          </div>
        )}

        <div style={{ padding: '1.3rem 1.4rem 1.5rem' }}>
          <div className="mk-eyebrow">
            {KINDS[l.kind] || l.kind}{l.condition ? ` · ${l.condition === 'SIFIR' ? 'Sıfır' : 'İkinci el'}` : ''}{sold ? ` · ${STATUS[l.status] || l.status}` : ''}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.024em', color: 'var(--ink)', margin: '.4rem 0 0', lineHeight: 1.2 }}>{l.title}</h1>
          {(l.brand || l.model) && <div style={{ color: 'var(--ink2)', fontSize: '.9rem', marginTop: 4 }}>{[l.brand, l.model].filter(Boolean).join(' ')}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <span className="mk-price" style={{ fontSize: '1.75rem' }}>{fmt(l.price)}</span>
            <span style={{ fontSize: '.82rem', color: 'var(--ink2)', textAlign: 'right' }}>
              {l.quantity} adet{l.unit ? ` ${l.unit}` : ''} · <b style={{ color: 'var(--ink)' }}>{l.sellerName}</b>
              {l.sellerRating ? ` · ⭐ ${l.sellerRating} (${l.sellerRatingCount})` : ''}{l.city ? ` · ${l.city}` : ''}
            </span>
          </div>

          {l.description && (
            <p style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)', color: 'var(--ink2)', fontSize: '.91rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{l.description}</p>
          )}
        </div>
      </div>

      {/* Sahip: yönetim · Alıcı: sipariş + mesaj */}
      {l.isOwner ? (
        <div className="mk-shell" style={{ marginTop: '.85rem' }}>
          <div className="mk-core">
            <div className="mk-eyebrow">Senin ilanın</div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--ink)', margin: '.35rem 0 .9rem' }}>İlanı yönet</div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {l.status !== 'ACTIVE' && <button onClick={() => setStatus('ACTIVE')} style={ownBtn('#0E9F6E')}>Aktifleştir</button>}
              {l.status === 'ACTIVE' && <button onClick={() => setStatus('PAUSED')} style={ownBtn('#B7791F')}>Duraklat</button>}
              {l.status !== 'SOLD' && <button onClick={() => setStatus('SOLD')} style={ownBtn('#5B2E90')}>Satıldı işaretle</button>}
              <Link href="/market/mesajlar" style={{ ...ownBtn('#0F2253'), textDecoration: 'none', display: 'inline-block' }}>Gelen mesajlar</Link>
              <button onClick={remove} style={ownBtn('#C6362F')}>Kaldır</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {l.status === 'ACTIVE' && (
            <div className="mk-shell" style={{ marginTop: '.85rem' }}>
              <div className="mk-core">
                <div className="mk-eyebrow">Sipariş</div>
                {orderDone ? (
                  <div style={{ marginTop: '.6rem' }}>
                    <div style={{ fontWeight: 700, color: '#0B6B4A', fontSize: '.95rem' }}>✓ Sipariş talebin gönderildi</div>
                    <p style={{ color: 'var(--ink2)', fontSize: '.86rem', margin: '.35rem 0 .9rem' }}>Satıcı onaylayınca süreç başlar.</p>
                    <Link href="/market/siparislerim" className="mk-btn mk-btn-p"><span>Siparişlerim</span><span className="mk-ico">→</span></Link>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--ink)', margin: '.35rem 0 .9rem' }}>Bu üründen sipariş ver</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '.83rem', color: 'var(--ink2)', fontWeight: 600 }}>Adet</label>
                      <input type="number" min={1} max={l.quantity} value={qty}
                        onChange={(e) => setQty(Math.max(1, Math.min(l.quantity, parseInt(e.target.value) || 1)))}
                        className="mk-in" style={{ width: 88 }} />
                      <span style={{ fontSize: '.85rem', color: 'var(--mut)' }}>
                        × {fmt(l.price)} = <b className="mk-price" style={{ fontSize: '1rem' }}>{fmt(l.price * qty)}</b>
                      </span>
                    </div>
                    <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Not (opsiyonel): teslimat, kargo vb." rows={2} className="mk-in" style={{ marginTop: 10, resize: 'vertical' }} />
                    <button onClick={placeOrder} disabled={ordering} className="mk-btn mk-btn-g" style={{ marginTop: 12, padding: '.7rem .8rem .7rem 1.25rem', fontWeight: 800 }}>
                      <span>{ordering ? 'Gönderiliyor…' : 'Sipariş Talebi Gönder'}</span>
                      {!ordering && <span className="mk-ico">→</span>}
                    </button>
                    <p style={{ fontSize: '.74rem', color: 'var(--mut)', margin: '.7rem 0 0', lineHeight: 1.55 }}>
                      Talebin satıcıya iletilir; onaylayınca süreç başlar. Ödeme/teslimat bayiler arasındadır.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mk-panel" style={{ padding: '1.15rem 1.25rem', marginTop: '.85rem' }}>
            <div className="mk-eyebrow">Mesaj</div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--ink)', margin: '.35rem 0 .9rem' }}>Satıcıya sor</div>
            {msgs.length > 0 && (
              <div style={{ display: 'grid', gap: 7, maxHeight: 270, overflowY: 'auto', marginBottom: 12 }}>
                {msgs.map((m) => (
                  <div key={m.id} className={`mk-bub${m.mine ? ' mk-bub-me' : ''}`} style={{ justifySelf: m.mine ? 'end' : 'start' }}>
                    <div style={{ fontSize: '.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
                    <div style={{ fontSize: '.66rem', color: 'var(--mut)', marginTop: 4 }}>{m.mine ? 'Sen' : (m.senderName || 'Satıcı')} · {new Date(m.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Mesajını yaz…" className="mk-in" style={{ flex: 1 }} />
              <button onClick={send} disabled={sending || !text.trim()} className="mk-btn mk-btn-g" style={{ padding: '.6rem .7rem .6rem 1.1rem' }}>
                <span>Gönder</span><span className="mk-ico">→</span>
              </button>
            </div>
            <p style={{ fontSize: '.74rem', color: 'var(--mut)', margin: '.7rem 0 0', lineHeight: 1.55 }}>
              İletişim bilgisi baştan paylaşılmaz; satıcı dönünce burada konuşursunuz.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const ownBtn = (c: string): React.CSSProperties => ({
  padding: '.48rem 1rem', background: 'white', border: `1px solid ${c}`, color: c, borderRadius: 999,
  fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '-.005em',
  transition: 'transform .2s cubic-bezier(.32,.72,0,1)',
});
