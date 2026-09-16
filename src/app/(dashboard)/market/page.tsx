'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { para } from '@/lib/bicim';

interface Listing {
  id: string; kind: string; title: string; brand: string | null; model: string | null;
  condition: string | null; price: number; currency: string; quantity: number; unit: string | null;
  city: string | null; photos: string[]; sellerName: string | null; isOwner: boolean;
  sellerRating: number | null; sellerRatingCount: number;
}

const turler = (t: Sozluk): Record<string, string> => ({
  PART: t.pazar.turParca, PRINTER: t.pazar.turYazici, MACHINE: t.pazar.turMakine, OTHER: t.pazar.turDiger,
});

export default function MarketPage() {
  const t = useT();
  const b = useBicim();
  const KINDS = turler(t);
  // Pazar bayiler arası: her ilan KENDİ para biriminde yazılıyor.
  const fmt = (n: number, birim?: string | null) => para(n, { dil: b.dil, birim: birim ?? b.birim });
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
      else setErr(d.error || t.pazar.hata);
    } catch { setErr(t.excelAktar.sunucuYok); }
    setJoining(false);
  };

  // ── Katılım kapısı ──
  if (profile && !profile.enabled) {
    const isAdmin = profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN';
    return (
      <div className="mk" style={{ padding: '1.75rem 1.25rem', maxWidth: 620, margin: '1.5rem auto' }}>

        <div style={{ background: 'linear-gradient(145deg,#0B1533 0%,#12285C 55%,#1B3A86 100%)', color: 'white', borderRadius: 22, padding: '1.9rem 1.75rem', marginBottom: '1.15rem', boxShadow: '0 26px 50px -30px rgba(15,34,83,.85)' }}>
          <div className="mk-eyebrow" style={{ color: 'rgba(255,255,255,.62)' }}>{t.pazar.ustBaslik}</div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.022em', margin: '.4rem 0 0' }}>{t.pazar.baslik}</h1>
          <p style={{ margin: '.55rem 0 0', color: 'rgba(255,255,255,.8)', fontSize: '.95rem', lineHeight: 1.6, maxWidth: 440 }}>
            {t.pazar.katilimAltOn} <b style={{ color: '#fff' }}>{t.pazar.katilimAltVurgu}</b> {t.pazar.katilimAltSon}
          </p>
        </div>

        <div className="mk-shell" style={{ marginBottom: '1.15rem' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {[
              { i: '💰', t: t.pazar.faydaStokBaslik, d: t.pazar.faydaStokAlt },
              { i: '⚡', t: t.pazar.faydaAcilBaslik, d: t.pazar.faydaAcilAlt },
              { i: '🔒', t: t.pazar.faydaTeslimBaslik, d: t.pazar.faydaTeslimAlt },
            ].map((b) => (
              <div key={b.t} className="mk-ben">
                <span style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>{b.i}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--ink)', letterSpacing: '-.01em' }}>{b.t}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--ink2)', marginTop: 3, lineHeight: 1.5 }}>{b.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isAdmin ? (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 14, padding: '1rem 1.1rem', fontSize: '.9rem', lineHeight: 1.55 }}>
            {t.pazar.yoneticiGerekOn} <b>{t.pazar.yoneticiGerekVurgu}</b> {t.pazar.yoneticiGerekSon}
          </div>
        ) : (
          <div className="mk-shell">
            <div className="mk-core">
              <div className="mk-eyebrow">{t.pazar.katilim}</div>
              <p style={{ margin: '.45rem 0 1.1rem', color: 'var(--ink2)', fontSize: '.9rem' }}>{t.pazar.katilimAlt}</p>
              <label className="mk-eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t.pazar.gorunenAd}</label>
              <input value={jName} onChange={(e) => setJName(e.target.value)} placeholder={t.pazar.gorunenAdYer} className="mk-in" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginTop: '.85rem' }}>
                <div>
                  <label className="mk-eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t.pazar.sehir}</label>
                  <input value={jCity} onChange={(e) => setJCity(e.target.value)} placeholder={t.pazar.sehirYer} className="mk-in" />
                </div>
                <div>
                  <label className="mk-eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t.pazar.iletisim}</label>
                  <input value={jPhone} onChange={(e) => setJPhone(e.target.value)} placeholder={t.pazar.iletisimYer} className="mk-in" />
                </div>
              </div>
              <p style={{ fontSize: '.75rem', color: 'var(--mut)', margin: '.75rem 0 1.15rem', lineHeight: 1.55 }}>
                {t.pazar.telefonNotuOn} <b>{t.pazar.telefonNotuVurgu}</b> {t.pazar.telefonNotuSon}
              </p>
              {err && <div style={{ color: '#B91C1C', fontSize: '.85rem', marginBottom: '.8rem' }}>{err}</div>}
              <button onClick={join} disabled={joining || !jName.trim()} className="mk-btn mk-btn-g"
                style={{ width: '100%', justifyContent: 'center', padding: '.75rem 1rem', fontSize: '.95rem', fontWeight: 800, opacity: (joining || !jName.trim()) ? .55 : 1 }}>
                {joining ? t.pazar.katiliyor : t.pazar.pazaraKatil}
                {!joining && <span className="mk-ico">→</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const chips: { v: string; label: string }[] = [{ v: '', label: t.pazar.sekmeTumu }, ...Object.entries(KINDS).map(([k, v]) => ({ v: k, label: v }))];
  const filtered = !!(q || city || kind);

  // ── Vitrin ──
  return (
    <div className="mk" style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 1140, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.35rem' }}>
        <div>
          <div className="mk-eyebrow">{t.pazar.ustBaslik}</div>
          <h1 className="mk-h1">{t.pazar.baslik}</h1>
          <p className="mk-sub">{t.pazar.vitrinAlt}</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Link href="/market/siparislerim" className="mk-btn"><span>{t.pazar.siparislerim}</span><span className="mk-ico">📦</span></Link>
          <Link href="/market/mesajlar" className="mk-btn"><span>{t.pazar.mesajlar}</span><span className="mk-ico">💬</span></Link>
          <Link href="/market/ilanlarim" className="mk-btn"><span>{t.pazar.ilanlarim}</span><span className="mk-ico">📋</span></Link>
          <Link href="/market/yeni" className="mk-btn mk-btn-p"><span>{t.pazar.yeniIlan}</span><span className="mk-ico">＋</span></Link>
        </div>
      </div>

      {/* Tür — tek tıkla */}
      <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
        {chips.map((c) => (
          <button key={c.v} className="mk-chip" data-on={kind === c.v ? '1' : '0'} onClick={() => setKind(c.v)}>{c.label}</button>
        ))}
      </div>

      {/* Arama */}
      <form onSubmit={(e) => { e.preventDefault(); load(0, false); }} style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap', marginBottom: '1.4rem' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.pazar.araYer} className="mk-in" style={{ flex: 1, minWidth: 210 }} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.pazar.sehir} className="mk-in" style={{ width: 140 }} />
        <button type="submit" className="mk-btn mk-btn-p"><span>{t.pazar.ara}</span><span className="mk-ico">→</span></button>
      </form>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="mk-sk" style={{ height: 262 }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="mk-shell">
          <div className="mk-core" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.65rem' }}>🛒</div>
            <div className="mk-eyebrow">{filtered ? t.pazar.sonucYok : t.pazar.pazarYeni}</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--ink)', letterSpacing: '-.02em', margin: '.4rem 0 0' }}>
              {filtered ? t.pazar.eslesenYok : t.pazar.ilkIlanBaslik}
            </div>
            <p style={{ color: 'var(--ink2)', fontSize: '.92rem', margin: '.55rem auto 1.4rem', maxWidth: 430, lineHeight: 1.6 }}>
              {filtered ? t.pazar.suzgecTemizleAlt : t.pazar.ilkIlanAlt}
            </p>
            <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/market/yeni" className="mk-btn mk-btn-g" style={{ padding: '.7rem .8rem .7rem 1.25rem', fontSize: '.92rem', fontWeight: 800 }}>
                <span>{t.pazar.ilkIlaniVer}</span><span className="mk-ico">＋</span>
              </Link>
              {filtered && (
                <button onClick={() => { setQ(''); setCity(''); setKind(''); }} className="mk-btn" style={{ padding: '.7rem 1.15rem' }}>{t.pazar.suzgecTemizle}</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
          {listings.map((l) => (
            <Link key={l.id} href={`/market/${l.id}`} className="mk-card">
              <div className="mk-thumb">
                {l.photos[0]
                  ? <img src={l.photos[0]} alt={l.title} />
                  : <span style={{ fontSize: '2rem', opacity: .3 }}>{(KINDS[l.kind] || '📦').split(' ')[0]}</span>}
                {l.isOwner && <span className="mk-badge">{t.pazar.ilaniniz}</span>}
              </div>
              <div style={{ padding: '.85rem .95rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: '.71rem', color: 'var(--mut)', fontWeight: 600 }}>
                  {KINDS[l.kind] || l.kind}{l.condition ? ` · ${l.condition === 'SIFIR' ? t.pazar.durumSifir : t.pazar.durumIkinciEl}` : ''}
                </div>
                <div style={{ fontWeight: 700, fontSize: '.94rem', lineHeight: 1.3, color: 'var(--ink)', letterSpacing: '-.011em' }}>{l.title}</div>
                {(l.brand || l.model) && <div style={{ fontSize: '.79rem', color: 'var(--ink2)' }}>{[l.brand, l.model].filter(Boolean).join(' ')}</div>}
                <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                  <div className="mk-price">{fmt(l.price, l.currency)}</div>
                  <div className="mk-meta">
                    {l.sellerRating ? `⭐ ${l.sellerRating} · ` : ''}{l.sellerName || t.pazar.bayi}{l.city ? ` · ${l.city}` : ''}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '1.6rem' }}>
          <button onClick={() => load(nextOffset, true)} disabled={loadingMore} className="mk-btn" style={{ padding: '.65rem .8rem .65rem 1.25rem' }}>
            <span>{loadingMore ? t.genel.yukleniyor : t.pazar.dahaFazla}</span><span className="mk-ico">↓</span>
          </button>
        </div>
      )}
    </div>
  );
}
