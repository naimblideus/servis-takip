'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Listing {
  id: string; kind: string; title: string; brand: string | null; model: string | null;
  condition: string | null; price: number; currency: string; quantity: number; unit: string | null;
  city: string | null; photos: string[]; sellerName: string | null; isOwner: boolean;
}

const KINDS: Record<string, string> = { PART: '🔧 Parça', PRINTER: '🖨️ Yazıcı/Toner', MACHINE: '🏭 Makine', OTHER: '📦 Diğer' };
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <div style={{ padding: '1.5rem', maxWidth: 560, margin: '2rem auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', borderRadius: '1rem', padding: '1.5rem 1.75rem', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>🤝 Bayi Pazarı</h1>
          <p style={{ margin: '0.4rem 0 0', opacity: 0.9, fontSize: '0.92rem', lineHeight: 1.5 }}>
            Ağdaki diğer bayilerle parça/makine alıp sat. Atıl stoğunu değerlendir, acil ihtiyacını hızlı bul.
          </p>
        </div>
        {!isAdmin ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 12, padding: '1rem', fontSize: '0.9rem' }}>
            Pazara katılımı yalnızca <b>yönetici</b> açabilir. Lütfen işletme yöneticinize iletin.
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
            <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.9rem' }}>Katılmak için pazarda görünecek bilgilerini gir:</p>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Görünen ad *</label>
            <input value={jName} onChange={(e) => setJName(e.target.value)} placeholder="İşletme adın" style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <div><label style={lbl}>Şehir</label><input value={jCity} onChange={(e) => setJCity(e.target.value)} placeholder="Kütahya" style={inp} /></div>
              <div><label style={lbl}>İletişim (opsiyonel)</label><input value={jPhone} onChange={(e) => setJPhone(e.target.value)} placeholder="05xx…" style={inp} /></div>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#9ca3af', margin: '0.6rem 0 1rem' }}>Telefonun ilanda görünmez; alıcılar önce <b>uygulama içi mesaj</b> atar, sen dönünce iletişim açılır.</p>
            {err && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{err}</div>}
            <button onClick={join} disabled={joining || !jName.trim()} style={{ width: '100%', padding: '0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', opacity: (joining || !jName.trim()) ? 0.6 : 1 }}>
              {joining ? 'Katılıyor…' : '🤝 Pazara Katıl'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Vitrin ──
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🤝 Bayi Pazarı</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Ağdaki bayilerden parça/makine al-sat.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/market/mesajlar" style={navBtn}>💬 Mesajlar</Link>
          <Link href="/market/ilanlarim" style={navBtn}>📋 İlanlarım</Link>
          <Link href="/market/yeni" style={{ ...navBtn, background: '#16a34a', color: 'white', border: 'none' }}>＋ Yeni İlan</Link>
        </div>
      </div>

      {/* Filtreler */}
      <form onSubmit={(e) => { e.preventDefault(); load(0, false); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Ara (ad / marka / model)…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="">Tüm türler</option>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Şehir" style={{ ...inp, width: 130 }} />
        <button type="submit" style={{ padding: '0.5rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Ara</button>
      </form>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : listings.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
          Eşleşen ilan yok. İlk ilanı sen ver → <Link href="/market/yeni" style={{ color: '#2563eb' }}>＋ Yeni İlan</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {listings.map((l) => (
            <Link key={l.id} href={`/market/${l.id}`} style={{ textDecoration: 'none', color: 'inherit', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 130, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {l.photos[0] ? <img src={l.photos[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2rem', opacity: 0.4 }}>{(KINDS[l.kind] || '📦').split(' ')[0]}</span>}
              </div>
              <div style={{ padding: '0.7rem 0.8rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{KINDS[l.kind] || l.kind}{l.condition ? ` · ${l.condition === 'SIFIR' ? 'Sıfır' : 'İkinci el'}` : ''}{l.isOwner ? ' · İlanınız' : ''}</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>{l.title}</div>
                {(l.brand || l.model) && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{[l.brand, l.model].filter(Boolean).join(' ')}</div>}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 6 }}>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{fmt(l.price)}</span>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right' }}>{l.sellerName}{l.city ? `· ${l.city}` : ''}</span>
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
