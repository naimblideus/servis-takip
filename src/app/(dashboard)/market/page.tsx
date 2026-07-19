'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Listing {
  id: string; kind: string; title: string; brand: string | null; model: string | null;
  condition: string | null; price: number; currency: string; quantity: number; unit: string | null;
  city: string | null; photos: string[]; sellerName: string | null; isOwner: boolean;
  sellerRating: number | null; sellerRatingCount: number;
}

const KINDS: Record<string, string> = { PART: '🔧 Parça', PRINTER: '🖨️ Yazıcı/Toner', MACHINE: '🏭 Makine', OTHER: '📦 Diğer' };
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CSS = `
.mk-card{transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
.mk-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(15,34,83,.10);border-color:#c7d2fe}
.mk-chip{padding:.45rem .9rem;border-radius:999px;border:1px solid #e5e7eb;background:#fff;font-size:.83rem;font-weight:600;color:#4b5563;cursor:pointer;transition:all .12s ease;white-space:nowrap}
.mk-chip:hover{border-color:#94a3b8}
.mk-chip[data-on="1"]{background:#0f2253;border-color:#0f2253;color:#fff}
.mk-sk{background:#eef2f7;border-radius:12px}
`;

export default function MarketPage() {
  const [profile, setProfile] = useState<{ enabled: boolean; displayName: string; city: string; contactPhone: string; role: string } | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [city, setCity] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Katılım formu
  const [jName, setJName] = useState('');
  const [jCity, setJCity] = useState('');
  const [jPhone, setJPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/market/profile').then((r) => r.json()).then((p) => {
      setProfile(p);
      setJName(p.displayName || ''); setJCity(p.city || ''); setJPhone(p.contactPhone || '');
      if (!p.enabled) setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async (off = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (kind) p.set('kind', kind);
    if (city.trim()) p.set('city', city.trim());
    p.set('offset', String(off));
    try {
      const r = await fetch(`/api/market/listings?${p}`);
      if (r.ok) { const d = await r.json(); setListings((prev) => append ? [...prev, ...(d.listings || [])] : (d.listings || [])); setHasMore(!!d.hasMore); setNextOffset(d.offset || 0); }
    } catch { /* yoksay */ }
    setLoading(false); setLoadingMore(false);
  }, [q, kind, city]);

  useEffect(() => { if (profile?.enabled) load(0, false); }, [profile?.enabled, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setJoining(true); setErr(null);
    try {
      const r = await fetch('/api/market/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, displayName: jName.trim(), city: jCity.trim(), contactPhone: jPhone.trim() }) });
      const d = await r.json();
      if (r.ok) { setProfile((pr) => pr ? { ...pr, enabled: true, displayName: jName, city: jCity, contactPhone: jPhone } : pr); }
      else setErr(d.error || 'Hata');
    } catch { setErr('Sunucuya bağlanılamadı'); }
    setJoining(false);
  };

  // ── Katılım kapısı ──
  if (profile && !profile.enabled) {
    const isAdmin = profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN';
    return (
      <div style={{ padding: '1.5rem', maxWidth: 580, margin: '2rem auto' }}>
        <style>{CSS}</style>
        <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', borderRadius: '1rem', padding: '1.6rem 1.75rem', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, margin: 0 }}>🤝 Bayi Pazarı</h1>
          <p style={{ margin: '0.45rem 0 0', opacity: 0.92, fontSize: '0.94rem', lineHeight: 1.55 }}>
            Diğer bayilerle parça ve makine al-sat. Ücretsiz — her pakete dahil.
          </p>
        </div>

        {/* Neden katılmalı — 3 net fayda */}
        <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            { i: '💰', t: 'Atıl stoğunu nakde çevir', d: 'Rafta bekleyen parçayı ihtiyacı olan bayiye sat.' },
            { i: '⚡', t: 'Acil parçayı hızlı bul', d: 'Müşteriyi bekletme — ağdaki bayilerde ara, hemen al.' },
            { i: '🔒', t: 'Güvenli teslim', d: 'Sipariş tamamlanınca stok ve cari otomatik işlenir.' },
          ].map((b) => (
            <div key={b.t} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.8rem 0.9rem' }}>
              <span style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>{b.i}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{b.t}</div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>{b.d}</div>
              </div>
            </div>
          ))}
        </div>

        {!isAdmin ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 12, padding: '1rem', fontSize: '0.9rem' }}>
            Pazara katılımı yalnızca <b>yönetici</b> açabilir. Lütfen işletme yöneticinize iletin.
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
            <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.9rem' }}>Katılmak için pazarda görünecek bilgilerini gir:</p>
            <label style={lbl}>Görünen ad *</label>
            <input value={jName} onChange={(e) => setJName(e.target.value)} placeholder="İşletme adın" style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div><label style={lbl}>Şehir</label><input value={jCity} onChange={(e) => setJCity(e.target.value)} placeholder="Kütahya" style={inp} /></div>
              <div><label style={lbl}>İletişim (opsiyonel)</label><input value={jPhone} onChange={(e) => setJPhone(e.target.value)} placeholder="05xx…" style={inp} /></div>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#9ca3af', margin: '0.6rem 0 1rem' }}>Telefonun ilanda görünmez; alıcılar önce <b>uygulama içi mesaj</b> atar, sen dönünce iletişim açılır.</p>
            {err && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{err}</div>}
            <button onClick={join} disabled={joining || !jName.trim()} style={{ width: '100%', padding: '0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', opacity: (joining || !jName.trim()) ? 0.6 : 1 }}>
              {joining ? 'Katılıyor…' : '🤝 Pazara Katıl'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const chips: { v: string; label: string }[] = [{ v: '', label: 'Tümü' }, ...Object.entries(KINDS).map(([k, v]) => ({ v: k, label: v }))];

  // ── Vitrin ──
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🤝 Bayi Pazarı</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Ağdaki bayilerden parça/makine al — atıl stoğunu sat.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/market/siparislerim" style={navBtn}>📦 Siparişlerim</Link>
          <Link href="/market/mesajlar" style={navBtn}>💬 Mesajlar</Link>
          <Link href="/market/ilanlarim" style={navBtn}>📋 İlanlarım</Link>
          <Link href="/market/yeni" style={{ ...navBtn, background: '#16a34a', color: 'white', border: 'none' }}>＋ Yeni İlan</Link>
        </div>
      </div>

      {/* Tür — tek tıkla filtre */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        {chips.map((c) => (
          <button key={c.v} className="mk-chip" data-on={kind === c.v ? '1' : '0'} onClick={() => setKind(c.v)}>{c.label}</button>
        ))}
      </div>

      {/* Arama */}
      <form onSubmit={(e) => { e.preventDefault(); load(0, false); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Ara (ad / marka / model)…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Şehir" style={{ ...inp, width: 130 }} />
        <button type="submit" style={{ padding: '0.5rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Ara</button>
      </form>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="mk-sk" style={{ height: 240 }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '2.75rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🛒</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#111827' }}>
            {q || city || kind ? 'Aramanla eşleşen ilan yok' : 'Pazar yeni — ilk ilanı sen ver'}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.45rem auto 1.1rem', maxWidth: 420, lineHeight: 1.55 }}>
            {q || city || kind
              ? 'Filtreleri temizleyip tüm ilanlara göz atabilirsin.'
              : 'Rafta bekleyen parçanı 1 dakikada ilana çevir — ihtiyacı olan bayi bulsun, atıl stok nakde dönsün.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/market/yeni" style={{ padding: '0.7rem 1.3rem', background: '#16a34a', color: 'white', borderRadius: 10, fontWeight: 800, textDecoration: 'none', fontSize: '0.92rem' }}>＋ İlk ilanını ver</Link>
            {(q || city || kind) && (
              <button onClick={() => { setQ(''); setCity(''); setKind(''); }} style={{ padding: '0.7rem 1.2rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 700, cursor: 'pointer', color: '#374151' }}>Filtreleri temizle</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {listings.map((l) => (
            <Link key={l.id} href={`/market/${l.id}`} className="mk-card" style={{ textDecoration: 'none', color: 'inherit', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 132, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                {l.photos[0]
                  ? <img src={l.photos[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '2rem', opacity: 0.35 }}>{(KINDS[l.kind] || '📦').split(' ')[0]}</span>}
                {l.isOwner && (
                  <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(15,34,83,.92)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>İlanınız</span>
                )}
              </div>
              <div style={{ padding: '0.75rem 0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  {KINDS[l.kind] || l.kind}{l.condition ? ` · ${l.condition === 'SIFIR' ? 'Sıfır' : 'İkinci el'}` : ''}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.25, color: '#111827' }}>{l.title}</div>
                {(l.brand || l.model) && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{[l.brand, l.model].filter(Boolean).join(' ')}</div>}
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.02rem' }}>{fmt(l.price)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 3 }}>
                    {l.sellerRating ? `⭐ ${l.sellerRating} · ` : ''}{l.sellerName || 'Bayi'}{l.city ? ` · ${l.city}` : ''}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button onClick={() => load(nextOffset, true)} disabled={loadingMore}
            style={{ padding: '0.6rem 1.4rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 700, cursor: 'pointer', color: '#374151' }}>
            {loadingMore ? 'Yükleniyor…' : '↓ Daha fazla göster'}
          </button>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box', width: '100%' };
const lbl: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 };
const navBtn: React.CSSProperties = { padding: '0.5rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', color: '#374151', textDecoration: 'none' };
