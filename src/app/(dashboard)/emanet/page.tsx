'use client';

/**
 * MÜŞTERİDE DURAN TONER (emanet) — bayinin müşteri raflarındaki yedek toner.
 *
 * Tepede tek sayı ("Müşterilerde 46 toner duruyor"), altında iki uyarı
 * (uzun süredir duran, sayım farkı), sonra aranabilir müşteri listesi.
 * Teknisyen bunu müşterinin yanında telefonla kullanır: her form tek elle,
 * 30 saniyede biter — müşteri seç → toner seç → ± → Kaydet. Değer (₺) yalnız
 * yöneticiye gelir; ekran gelmeyeni göstermez.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { icerir } from '@/lib/tr-katla';
import { openPrintable } from '@/lib/print';
import { waUrl } from '@/lib/share';
import type { Bicimleyici } from '@/lib/bicim';
import type { EmanetOzeti, MusteriOzetCikti, MusteriDefteri, HareketCikti, KalemCikti } from '@/lib/emanet-veri';

type Islem = 'birak' | 'iade' | 'kayip' | 'sayim';
type Defter = Omit<MusteriDefteri, 'hareketler'> & { hareketler: (HareketCikti & { tutanakImza: string | null })[] };
interface Secenekler {
  musteriler: { id: string; ad: string; telefon: string | null }[];
  parcalar: { id: string; ad: string; kod: string | null; stok: number; grup: string | null; toner: boolean }[];
}
interface Satir { partId: string | null; parcaAdi: string | null; ad: string; adet: number; enCok: number; defterde?: number }
interface Sonuc {
  islem: Islem; adet: number; tutanakId: string | null; tutanakImza: string | null;
  sayim: { ad: string; defterde: number; sayilan: number; fark: number }[] | null;
  musteri: { id: string; ad: string; telefon: string | null };
}

const LACIVERT = '#0F2253';
const DOKUNMA = 44;
const dugme = (renk: string, zemin: string, kenar = zemin): React.CSSProperties => ({
  minHeight: DOKUNMA, padding: '0 0.95rem', borderRadius: 10, border: `1px solid ${kenar}`, background: zemin, color: renk,
  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
});
const girdi: React.CSSProperties = {
  width: '100%', minHeight: DOKUNMA, padding: '0.55rem 0.8rem', border: '1px solid #CFD7E4', borderRadius: 10,
  fontSize: 16, boxSizing: 'border-box', background: 'white', color: '#0B1533',
};

// ── ± SAYAÇ ──────────────────────────────────────────────────────────────
function Sayac({ deger, enAz, enCok, onDegis, t }: { deger: number; enAz: number; enCok: number; onDegis: (n: number) => void; t: Sozluk }) {
  const kare = (pasif: boolean): React.CSSProperties => ({
    width: DOKUNMA, height: DOKUNMA, borderRadius: 10, border: '1px solid #CFD7E4', background: pasif ? '#F1F4F9' : 'white',
    color: pasif ? '#98A3B8' : LACIVERT, fontSize: '1.3rem', fontWeight: 800, cursor: pasif ? 'not-allowed' : 'pointer', flexShrink: 0,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label={t.emanet.azalt} disabled={deger <= enAz} onClick={() => onDegis(Math.max(enAz, deger - 1))} style={kare(deger <= enAz)}>−</button>
      <input type="number" inputMode="numeric" min={enAz} max={enCok} value={deger} aria-label={t.genel.adet}
        onChange={(e) => { const n = parseInt(e.target.value, 10); onDegis(Number.isFinite(n) ? Math.min(enCok, Math.max(enAz, n)) : enAz); }}
        style={{ ...girdi, width: 64, textAlign: 'center', fontWeight: 800, padding: '0.4rem 0.2rem' }} />
      <button type="button" aria-label={t.emanet.artir} disabled={deger >= enCok} onClick={() => onDegis(Math.min(enCok, deger + 1))} style={kare(deger >= enCok)}>+</button>
    </div>
  );
}

// ── PARÇA SEÇİCİ ─────────────────────────────────────────────────────────
/** Arama + liste. Bu müşterinin makinelerine uyanlar üstte; stok gösterilir, fiyat gösterilmez. */
function ParcaSecici({ parcalar, uygun, haric, onSec, t }: {
  parcalar: Secenekler['parcalar']; uygun: ReadonlySet<string>; haric: ReadonlySet<string>; onSec: (p: Secenekler['parcalar'][number]) => void; t: Sozluk;
}) {
  const [q, setQ] = useState('');
  const liste = useMemo(() => {
    const aday = parcalar.filter((p) => !haric.has(p.id) && (!q.trim() || icerir(p.ad, q) || icerir(p.kod, q)));
    const ust = aday.filter((p) => uygun.has(p.id));
    // Aramasız listede yalnız tonerler: 300 kalemlik stokta kâğıt ve paten aranmadan gösterilmez.
    const alt = aday.filter((p) => !uygun.has(p.id) && (q.trim() || p.toner));
    return { ust: ust.slice(0, 20), alt: alt.slice(0, 30) };
  }, [parcalar, uygun, haric, q]);
  const satir = (p: Secenekler['parcalar'][number]) => (
    <button key={p.id} type="button" onClick={() => onSec(p)}
      style={{ textAlign: 'left', minHeight: DOKUNMA, padding: '0.5rem 0.75rem', borderRadius: 10, border: '1px solid #E4E9F1', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, color: '#0B1533', fontSize: '0.9rem' }}>{p.ad}</span>
        {p.kod && <span style={{ fontSize: '0.75rem', color: '#6C7A93' }}>{p.kod}</span>}
      </span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.stok > 0 ? '#096847' : '#B93333', whiteSpace: 'nowrap' }}>{doldur(t.emanet.depoda, { n: p.stok })}</span>
    </button>
  );
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.emanet.tonerAra} aria-label={t.emanet.tonerAra} style={girdi} />
      {liste.ust.length > 0 && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0B8259', marginTop: 4 }}>{t.emanet.uyanlar}</div>}
      {liste.ust.map(satir)}
      {liste.alt.length > 0 && liste.ust.length > 0 && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6C7A93', marginTop: 4 }}>{t.emanet.digerleri}</div>}
      {liste.alt.map(satir)}
    </div>
  );
}

// ── FORM ─────────────────────────────────────────────────────────────────
function Form({ islem, baslangicMusteri, demo, t, onKapat, onBitti, defterAl }: {
  islem: Islem;
  baslangicMusteri: { id: string; ad: string; telefon: string | null } | null;
  demo: boolean;
  t: Sozluk;
  onKapat: () => void;
  onBitti: (s: Sonuc) => void;
  defterAl: (id: string) => Promise<Defter | null>;
}) {
  const e = t.emanet;
  const [secenek, setSecenek] = useState<Secenekler | null>(null);
  const [musteri, setMusteri] = useState(baslangicMusteri);
  const [defter, setDefter] = useState<Defter | null>(null);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [secici, setSecici] = useState(false);
  const [mq, setMq] = useState('');
  const [ayrinti, setAyrinti] = useState(false);
  const [bosAdet, setBosAdet] = useState(0);
  const [cihaz, setCihaz] = useState('');
  const [not, setNot] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (islem === 'birak' || islem === 'sayim') {
      fetch('/api/emanet?secenek=1').then((r) => r.json()).then((d) => setSecenek(d?.parcalar ? d : { musteriler: [], parcalar: [] })).catch(() => setSecenek({ musteriler: [], parcalar: [] }));
    }
  }, [islem]);

  // Müşteri seçilince defteri gelir: iade/kayıp/sayım satırları raftan kurulur.
  useEffect(() => {
    if (!musteri) return;
    let iptal = false;
    defterAl(musteri.id).then((d) => {
      if (iptal || !d) return;
      setDefter(d);
      const rafta = d.kalemler.filter((k: KalemCikti) => (islem === 'sayim' ? k.bakiye !== 0 : k.bakiye > 0));
      if (islem === 'iade' || islem === 'kayip') {
        setSatirlar(rafta.map((k) => ({ partId: k.partId, parcaAdi: k.partId ? null : k.ad, ad: k.ad, adet: 0, enCok: k.bakiye })));
      } else if (islem === 'sayim') {
        setSatirlar(rafta.map((k) => ({ partId: k.partId, parcaAdi: k.partId ? null : k.ad, ad: k.ad, adet: Math.max(0, k.bakiye), enCok: 1000, defterde: k.bakiye })));
      } else if (islem === 'birak') {
        setSecici(true);
      }
    });
    return () => { iptal = true; };
  }, [musteri, islem, defterAl]);

  const uygun = useMemo(() => new Set(defter?.uygunParcalar ?? []), [defter]);
  const haric = useMemo(() => new Set(satirlar.map((s) => s.partId).filter((x): x is string => !!x)), [satirlar]);
  const musteriListesi = useMemo(() => {
    const l = secenek?.musteriler ?? [];
    return (mq.trim() ? l.filter((m) => icerir(m.ad, mq) || (m.telefon ?? '').includes(mq.trim())) : l).slice(0, 12);
  }, [secenek, mq]);

  const gonderilecek = satirlar.filter((s) => islem === 'sayim' || s.adet > 0);
  const kaydet = async () => {
    if (!musteri) return;
    if (!gonderilecek.length) { setHata(e.secimYok); return; }
    // Ortak demo: kaydetmek vitrini herkes için değiştirirdi (lib/demo-yazma).
    if (demo) { setHata(e.demo); return; }
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/emanet', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          islem, customerId: musteri.id,
          kalemler: gonderilecek.map((s) => (islem === 'sayim'
            ? { partId: s.partId, parcaAdi: s.parcaAdi, sayilan: s.adet }
            : { partId: s.partId, parcaAdi: s.parcaAdi, adet: s.adet })),
          ...(islem === 'birak' ? { bosAdet, deviceId: cihaz || null } : {}),
          not: not.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setHata(j.error || t.genel.hata); return; }
      onBitti({ islem, adet: j.adet ?? 0, tutanakId: j.tutanakId ?? null, tutanakImza: j.tutanakImza ?? null, sayim: j.sayim ?? null, musteri });
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setMesgul(false);
    }
  };

  const baslik = islem === 'birak' ? e.birakBaslik : islem === 'iade' ? e.iadeBaslik : islem === 'kayip' ? e.kayipBaslik : e.sayimBaslik;
  return (
    <div role="dialog" aria-modal="true" aria-label={baslik}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,21,51,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(ev) => { if (ev.target === ev.currentTarget && !mesgul) onKapat(); }}>
      <div style={{ background: 'white', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: '1rem 1rem 1.25rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0B1533' }}>{baslik}</h2>
          <button type="button" onClick={onKapat} disabled={mesgul} aria-label={e.kapat} style={{ ...dugme('#33405C', 'white', '#CFD7E4'), padding: 0, width: DOKUNMA }}>✕</button>
        </div>

        {/* 1) Müşteri */}
        {!musteri ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#53617B' }}>{e.musteri}</label>
            <input autoFocus value={mq} onChange={(ev) => setMq(ev.target.value)} placeholder={e.musteriAra} aria-label={e.musteriAra} style={girdi} />
            {!secenek && <p style={{ color: '#98A3B8', margin: 0 }}>{t.genel.yukleniyor}</p>}
            {musteriListesi.map((m) => (
              <button key={m.id} type="button" onClick={() => setMusteri(m)}
                style={{ textAlign: 'left', minHeight: DOKUNMA, padding: '0.5rem 0.75rem', borderRadius: 10, border: '1px solid #E4E9F1', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#0B1533' }}>
                {m.ad}{m.telefon ? <span style={{ fontWeight: 400, color: '#6C7A93', fontSize: '0.8rem' }}> · {m.telefon}</span> : null}
              </button>
            ))}
            {secenek && mq.trim() && musteriListesi.length === 0 && <p style={{ color: '#6C7A93', margin: 0 }}>{e.aramaYok}</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.55rem 0.75rem', background: '#F1F4F9', borderRadius: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, color: '#0B1533', minWidth: 0 }}>{musteri.ad}</span>
            {!baslangicMusteri && islem === 'birak' && (
              <button type="button" onClick={() => { setMusteri(null); setSatirlar([]); setDefter(null); }} style={{ background: 'none', border: 'none', color: '#1D3E7E', fontWeight: 700, cursor: 'pointer', minHeight: DOKUNMA }}>{e.degistir}</button>
            )}
          </div>
        )}

        {/* 2) Kalemler */}
        {musteri && (
          <div style={{ display: 'grid', gap: 8 }}>
            {islem === 'sayim' && <p style={{ margin: 0, fontSize: '0.8rem', color: '#53617B' }}>{e.sayimAlt}</p>}
            {islem === 'kayip' && <p style={{ margin: 0, fontSize: '0.8rem', color: '#962929', background: '#FDECEC', borderRadius: 8, padding: '0.5rem 0.65rem' }}>{e.kayipUyari}</p>}
            {(islem === 'iade' || islem === 'kayip') && defter && satirlar.length === 0 && <p style={{ color: '#6C7A93', margin: 0 }}>{e.rafBos}</p>}
            {!defter && <p style={{ color: '#98A3B8', margin: 0 }}>{t.genel.yukleniyor}</p>}
            {satirlar.map((s, i) => (
              <div key={`${s.partId ?? s.parcaAdi}-${i}`} style={{ border: '1px solid #E4E9F1', borderRadius: 12, padding: '0.6rem 0.7rem', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, color: '#0B1533', fontSize: '0.9rem', minWidth: 0 }}>{s.ad}</span>
                  <span style={{ fontSize: '0.74rem', color: '#6C7A93', whiteSpace: 'nowrap' }}>
                    {islem === 'birak' ? doldur(e.depoda, { n: s.enCok }) : doldur(e.defterde, { n: s.defterde ?? s.enCok })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Sayac deger={s.adet} enAz={islem === 'birak' ? 1 : 0} enCok={Math.max(islem === 'birak' ? 1 : 0, s.enCok)} t={t}
                    onDegis={(n) => setSatirlar((l) => l.map((x, j) => (j === i ? { ...x, adet: n } : x)))} />
                  {islem === 'birak' && (
                    <button type="button" onClick={() => setSatirlar((l) => l.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#B93333', fontWeight: 700, cursor: 'pointer', minHeight: DOKUNMA }}>{e.kaldir}</button>
                  )}
                </div>
              </div>
            ))}
            {(islem === 'birak' || islem === 'sayim') && secenek && defter && (
              secici ? (
                <ParcaSecici parcalar={secenek.parcalar} uygun={uygun} haric={haric} t={t}
                  onSec={(p) => {
                    setSatirlar((l) => [...l, islem === 'birak'
                      ? { partId: p.id, parcaAdi: null, ad: p.ad, adet: Math.min(1, Math.max(1, p.stok)), enCok: Math.min(100, p.stok) }
                      : { partId: p.id, parcaAdi: null, ad: p.ad, adet: 0, enCok: 1000, defterde: 0 }]);
                    setSecici(false);
                  }} />
              ) : (
                <button type="button" onClick={() => setSecici(true)} style={{ ...dugme('#1D3E7E', '#EEF2FA', '#B9C7E4'), width: '100%' }}>
                  {islem === 'birak' ? e.baskaEkle : e.sayimEkle}
                </button>
              )
            )}
          </div>
        )}

        {/* 3) Ayrıntı (yalnız bırakışta, katlanır) */}
        {musteri && islem === 'birak' && defter && (
          <div style={{ marginTop: 10 }}>
            {!ayrinti ? (
              <button type="button" onClick={() => setAyrinti(true)} style={{ background: 'none', border: 'none', color: '#1D3E7E', fontWeight: 700, cursor: 'pointer', minHeight: DOKUNMA, padding: 0 }}>{e.ayrinti}</button>
            ) : (
              <div style={{ display: 'grid', gap: 8, padding: '0.6rem 0.7rem', background: '#F8FAFC', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#33405C' }}>{e.bosKartusEtiket}</span>
                  <Sayac deger={bosAdet} enAz={0} enCok={100} onDegis={setBosAdet} t={t} />
                </div>
                {defter.cihazlar.length > 0 && (
                  <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', fontWeight: 700, color: '#33405C' }}>
                    {e.cihazEtiket}
                    <select value={cihaz} onChange={(ev) => setCihaz(ev.target.value)} style={girdi}>
                      <option value="">{e.cihazYok}</option>
                      {defter.cihazlar.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
                    </select>
                  </label>
                )}
                <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', fontWeight: 700, color: '#33405C' }}>
                  {e.notEtiket}
                  <input value={not} onChange={(ev) => setNot(ev.target.value)} maxLength={300} placeholder={e.notYer} style={girdi} />
                </label>
              </div>
            )}
          </div>
        )}
        {musteri && islem !== 'birak' && defter && (
          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem', fontWeight: 700, color: '#33405C', marginTop: 10 }}>
            {e.notEtiket}
            <input value={not} onChange={(ev) => setNot(ev.target.value)} maxLength={300} style={girdi} />
          </label>
        )}

        {hata && <div role="alert" style={{ marginTop: 10, background: '#FDECEC', color: '#962929', borderRadius: 10, padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}>{hata}</div>}

        {musteri && (
          <button type="button" onClick={kaydet} disabled={mesgul || !defter}
            style={{ ...dugme('white', mesgul ? '#98A3B8' : islem === 'kayip' ? '#B93333' : LACIVERT), width: '100%', minHeight: 50, marginTop: 12, fontSize: '1rem' }}>
            {mesgul ? e.kaydediliyor : e.kaydet}
          </button>
        )}
      </div>
    </div>
  );
}

// ── SONUÇ ────────────────────────────────────────────────────────────────
function SonucKarti({ s, t, onKapat }: { s: Sonuc; t: Sozluk; onKapat: () => void }) {
  const e = t.emanet;
  const musteriDili = useMusteriDili();
  const metin = s.islem === 'birak' ? doldur(e.birakildi, { n: s.adet })
    : s.islem === 'iade' ? doldur(e.iadeAlindi, { n: s.adet })
      : s.islem === 'kayip' ? doldur(e.kayipYazildi, { n: s.adet })
        : (s.sayim ?? []).every((x) => x.fark === 0) ? e.sayimTam : e.sayimFarkli;
  const link = s.tutanakId && s.tutanakImza && typeof window !== 'undefined'
    ? `${window.location.origin}/belge/emanet/${s.tutanakId}/${s.tutanakImza}` : null;
  return (
    <div role="status" className="card" style={{ marginTop: '0.8rem', borderColor: '#A7F3D0', background: '#F0FDF4' }}>
      <div style={{ fontWeight: 800, color: '#096847' }}>✓ {metin}</div>
      {s.islem === 'sayim' && (s.sayim ?? []).filter((x) => x.fark !== 0).map((x) => (
        <div key={x.ad} style={{ fontSize: '0.85rem', color: x.fark < 0 ? '#962929' : '#B0721F', marginTop: 4 }}>
          {doldur(e.sayimSatir, { ad: x.ad, defter: x.defterde, sayilan: x.sayilan })} — {x.fark < 0 ? doldur(e.eksik, { n: -x.fark }) : doldur(e.fazla, { n: x.fark })}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {s.tutanakId && (
          <button type="button" onClick={() => openPrintable(`/emanet/tutanak/${s.tutanakId}`)} style={dugme('white', LACIVERT)}>{e.tutanakYazdir}</button>
        )}
        {link && (
          <a href={waUrl(s.musteri.telefon, doldur(musteriDili.sz.emanet.tutanakMesaji, { ad: s.musteri.ad, link }))} target="_blank" rel="noreferrer"
            style={{ ...dugme('#047857', '#ECFDF5', '#A7F3D0'), textDecoration: 'none' }}>{e.tutanakGonder}</a>
        )}
        <button type="button" onClick={onKapat} style={dugme('#33405C', 'white', '#CFD7E4')}>{e.kapat}</button>
      </div>
    </div>
  );
}

// ── HAREKET SATIRI ───────────────────────────────────────────────────────
function HareketSatiri({ h, t, b, telefon, musteriAd }: { h: Defter['hareketler'][number]; t: Sozluk; b: Bicimleyici; telefon: string | null; musteriAd: string }) {
  const e = t.emanet;
  const musteriDili = useMusteriDili();
  const renk = h.adet > 0 ? '#096847' : h.tur === 'KAYIP' || (h.tur === 'SAYIM' && h.adet < 0) ? '#B93333' : '#33405C';
  const kim = h.tur === 'TAKILDI' && !h.kullanici ? [e.sistem, h.kaynak ? (e.kaynak as Record<string, string>)[h.kaynak] : null].filter(Boolean).join(' · ') : h.kullanici;
  const link = h.tutanak && h.tutanakImza && typeof window !== 'undefined' ? `${window.location.origin}/belge/emanet/${h.id}/${h.tutanakImza}` : null;
  return (
    <div style={{ padding: '0.55rem 0', borderBottom: '1px solid #F1F4F9', display: 'grid', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0B1533', minWidth: 0 }}>
          {(e.tur as Record<string, string>)[h.tur] ?? h.tur} · {h.ad}
        </span>
        <span style={{ fontWeight: 800, color: renk, whiteSpace: 'nowrap' }}>{h.adet > 0 ? `+${h.adet}` : h.adet}</span>
      </div>
      <div style={{ fontSize: '0.74rem', color: '#6C7A93' }}>
        {b.tarih(h.tarih)}{kim ? ` · ${kim}` : ''}{h.cihaz ? ` · ${h.cihaz}` : ''}
        {h.bosAdet > 0 ? ` · ${doldur(e.bosKartus, { n: h.bosAdet })}` : ''}
        {h.birimMaliyet !== null ? ` · ${b.para(Math.abs(h.adet) * h.birimMaliyet)}` : ''}
      </div>
      {h.not && <div style={{ fontSize: '0.74rem', color: '#53617B', fontStyle: 'italic' }}>{h.not}</div>}
      {h.tutanak && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openPrintable(`/emanet/tutanak/${h.id}`)} style={{ background: 'none', border: 'none', padding: 0, color: '#1D3E7E', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', minHeight: 32 }}>{e.tutanak}</button>
          {link && (
            <a href={waUrl(telefon, doldur(musteriDili.sz.emanet.tutanakMesaji, { ad: musteriAd, link }))} target="_blank" rel="noreferrer"
              style={{ color: '#047857', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 32 }}>WhatsApp</a>
          )}
        </div>
      )}
    </div>
  );
}

// ── MÜŞTERİ KARTI ────────────────────────────────────────────────────────
function MusteriKarti({ m, acik, onAc, defter, t, b, onIslem }: {
  m: MusteriOzetCikti; acik: boolean; onAc: () => void; defter: Defter | null; t: Sozluk; b: Bicimleyici; onIslem: (i: Islem) => void;
}) {
  const e = t.emanet;
  const [hepsi, setHepsi] = useState(false);
  const rafta = m.bakiye > 0;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderColor: m.fazla ? '#F8E6C7' : undefined }}>
      <button type="button" onClick={onAc} aria-expanded={acik}
        style={{ width: '100%', textAlign: 'left', background: 'white', border: 'none', padding: '0.85rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', minHeight: 56 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, color: '#0B1533' }}>{m.ad}</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#6C7A93', marginTop: 2 }}>
            {[m.enEskiGun !== null ? doldur(e.enEski, { gun: m.enEskiGun }) : null, doldur(e.tuketim90, { n: m.tuketim90 })].filter(Boolean).join(' · ')}
          </span>
          {m.fazla && <span className="badge" style={{ background: '#FCF3E4', color: '#B0721F', marginTop: 4 }}>{e.fazlaRozet}</span>}
        </span>
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ display: 'block', fontSize: '1.35rem', fontWeight: 800, color: rafta ? LACIVERT : '#98A3B8' }}>{m.bakiye}</span>
          {m.deger !== null && rafta && <span style={{ display: 'block', fontSize: '0.75rem', color: '#53617B', fontWeight: 700 }}>{b.para(m.deger, 0)}</span>}
        </span>
      </button>
      {acik && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #F1F4F9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0.8rem 0' }}>
            <button type="button" onClick={() => onIslem('birak')} style={dugme('white', LACIVERT)}>{e.yedekBirak}</button>
            <button type="button" onClick={() => onIslem('sayim')} style={dugme('#1D3E7E', '#EEF2FA', '#B9C7E4')}>{e.sayimYap}</button>
            <button type="button" onClick={() => onIslem('iade')} disabled={!rafta} style={{ ...dugme('#33405C', 'white', '#CFD7E4'), opacity: rafta ? 1 : 0.5 }}>{e.iadeAl}</button>
            <button type="button" onClick={() => onIslem('kayip')} disabled={!rafta} style={{ ...dugme('#B93333', 'white', '#FBDADA'), opacity: rafta ? 1 : 0.5 }}>{e.kayipYaz}</button>
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#53617B', letterSpacing: '0.04em' }}>{e.raftakiler}</div>
          {m.kalemler.filter((k) => k.bakiye !== 0).length === 0 && <p style={{ color: '#6C7A93', fontSize: '0.85rem', margin: '0.3rem 0' }}>{e.rafBos}</p>}
          {m.kalemler.filter((k) => k.bakiye !== 0).map((k) => (
            <div key={k.anahtar} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.45rem 0', borderBottom: '1px solid #F1F4F9' }}>
              <span style={{ minWidth: 0, fontSize: '0.86rem' }}>
                <span style={{ fontWeight: 700, color: '#0B1533' }}>{k.ad}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#6C7A93' }}>
                  {[k.kod, k.enEskiGun !== null ? doldur(e.enEski, { gun: k.enEskiGun }) : null, doldur(e.tuketim90, { n: k.tuketim90 })].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 800, color: k.bakiye < 0 ? '#B93333' : '#0B1533' }}>{doldur(e.adet, { n: k.bakiye })}</span>
                {k.deger !== null && k.bakiye > 0 && <span style={{ display: 'block', fontSize: '0.72rem', color: '#53617B' }}>{b.para(k.deger, 0)}</span>}
              </span>
            </div>
          ))}
          {defter?.sonSayim && (
            <div style={{ fontSize: '0.75rem', color: defter.sonSayim.tam ? '#096847' : '#B0721F', marginTop: 6 }}>
              {doldur(defter.sonSayim.tam ? e.sonSayimTam : e.sonSayim, { tarih: b.tarih(defter.sonSayim.tarih) })}
            </div>
          )}
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#53617B', letterSpacing: '0.04em', marginTop: 14 }}>{e.hareketler}</div>
          {!defter && <p style={{ color: '#98A3B8', fontSize: '0.85rem' }}>{t.genel.yukleniyor}</p>}
          {defter && defter.hareketler.length === 0 && <p style={{ color: '#6C7A93', fontSize: '0.85rem' }}>{e.hareketYok}</p>}
          {defter && (hepsi ? defter.hareketler : defter.hareketler.slice(0, 12)).map((h) => (
            <HareketSatiri key={h.id} h={h} t={t} b={b} telefon={defter.musteri.telefon} musteriAd={defter.musteri.ad} />
          ))}
          {defter && !hepsi && defter.hareketler.length > 12 && (
            <button type="button" onClick={() => setHepsi(true)} style={{ background: 'none', border: 'none', color: '#1D3E7E', fontWeight: 700, cursor: 'pointer', minHeight: DOKUNMA, padding: 0 }}>
              {defter.hareketler.length - 12} {t.genel.dahaFazla}
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <Link href={`/customers/${m.id}`} style={{ fontSize: '0.8rem', color: '#1D3E7E', fontWeight: 700, textDecoration: 'none' }}>{t.genel.detayOk}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SAYFA ────────────────────────────────────────────────────────────────
export default function EmanetSayfasi() {
  const t = useT();
  const b = useBicim();
  const e = t.emanet;
  const { data: oturum } = useSession();
  const demo = Boolean((oturum?.user as { demo?: boolean } | undefined)?.demo);
  const [ozet, setOzet] = useState<EmanetOzeti | null>(null);
  const [yuk, setYuk] = useState(true);
  const [q, setQ] = useState('');
  const [acik, setAcik] = useState<string | null>(null);
  const [defterler, setDefterler] = useState<Record<string, Defter>>({});
  const [form, setForm] = useState<{ islem: Islem; musteri: { id: string; ad: string; telefon: string | null } | null } | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const yukle = useCallback(() => fetch('/api/emanet').then((r) => r.json()).then((d: EmanetOzeti) => {
    if (d && Array.isArray(d.musteriler)) setOzet(d);
  }).catch(() => {}).finally(() => setYuk(false)), []);

  const defterAl = useCallback(async (id: string): Promise<Defter | null> => {
    const r = await fetch(`/api/emanet/${id}`).catch(() => null);
    if (!r || !r.ok) return null;
    const d = (await r.json()) as Defter;
    setDefterler((x) => ({ ...x, [id]: d }));
    return d;
  }, []);

  useEffect(() => {
    yukle();
    // Müşteri kartındaki "Yedek bırak" müşteriyi taşır (?musteri=…&islem=birak).
    const p = new URLSearchParams(window.location.search);
    const mid = p.get('musteri');
    if (mid) {
      setAcik(mid);
      defterAl(mid).then((d) => {
        if (d && p.get('islem') === 'birak') setForm({ islem: 'birak', musteri: { id: d.musteri.id, ad: d.musteri.ad, telefon: d.musteri.telefon } });
      });
    }
  }, [yukle, defterAl]);

  const liste = useMemo(() => (ozet?.musteriler ?? []).filter((m) => !q.trim() || icerir(m.ad, q)), [ozet, q]);
  const ac = (id: string) => {
    setAcik((x) => (x === id ? null : id));
    if (!defterler[id]) defterAl(id);
  };
  const bitti = async (s: Sonuc) => {
    setForm(null);
    setSonuc(s);
    setAcik(s.musteri.id);
    await Promise.all([yukle(), defterAl(s.musteri.id)]);
  };

  const bos = !yuk && ozet && ozet.musteriler.length === 0;
  return (
    <div style={{ padding: '1.25rem 1rem 6rem', maxWidth: 820, margin: '0 auto', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#0B1533' }}>{e.baslik}</h1>
      <p style={{ color: '#6C7A93', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>{e.alt}</p>

      {yuk && <p style={{ color: '#98A3B8' }}>{t.genel.yukleniyor}</p>}

      {bos && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div style={{ fontSize: '2rem' }}>📦</div>
          <p style={{ fontWeight: 800, color: '#0B1533', margin: '0.4rem 0' }}>{e.bosBaslik}</p>
          <p style={{ color: '#53617B', fontSize: '0.9rem', margin: '0 0 1rem' }}>{e.bosAlt}</p>
          <button type="button" onClick={() => { setSonuc(null); setForm({ islem: 'birak', musteri: null }); }} style={{ ...dugme('white', LACIVERT), minHeight: 50 }}>{e.ilkYedek}</button>
        </div>
      )}

      {ozet && !bos && (
        <>
          {/* ── TEK SAYI ── */}
          <div className="card" style={{ marginTop: '1rem', background: LACIVERT, borderColor: LACIVERT, color: 'white' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 700 }}>{e.ozetOn}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.15 }}>
              {doldur(e.ozetAdet, { n: ozet.toplam.adet })}
              {ozet.toplam.deger !== null && <span style={{ fontSize: '1.25rem', opacity: 0.9 }}> · {b.para(ozet.toplam.deger, 0)}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 4 }}>
              {doldur(e.ozetMusteri, { n: ozet.toplam.musteri })}
              {ozet.toplam.deger !== null && ozet.toplam.degerEksik ? ` · ${e.degerEksik}` : ''}
            </div>
            <button type="button" onClick={() => { setSonuc(null); setForm({ islem: 'birak', musteri: null }); }}
              style={{ ...dugme(LACIVERT, 'white'), width: '100%', minHeight: 50, marginTop: 12, fontSize: '1rem' }}>+ {e.yedekBirak}</button>
          </div>

          {sonuc && <SonucKarti s={sonuc} t={t} onKapat={() => setSonuc(null)} />}

          {/* ── UYARILAR ── */}
          {ozet.uyarilar.fazla.length > 0 && (
            <details className="card" style={{ marginTop: '0.8rem', borderColor: '#F8E6C7', background: '#FFFBF3' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#B0721F', minHeight: 28 }}>⚠ {e.uyariFazla} ({ozet.uyarilar.fazla.length})</summary>
              <p style={{ fontSize: '0.78rem', color: '#7A5417', margin: '0.4rem 0' }}>{e.uyariFazlaAlt}</p>
              {ozet.uyarilar.fazla.map((u) => (
                <button key={`${u.musteriId}-${u.anahtar}`} type="button" onClick={() => ac(u.musteriId)}
                  style={{ width: '100%', textAlign: 'left', background: 'white', border: '1px solid #F8E6C7', borderRadius: 10, padding: '0.5rem 0.7rem', marginTop: 6, cursor: 'pointer', minHeight: DOKUNMA }}>
                  <span style={{ display: 'block', fontWeight: 700, color: '#0B1533', fontSize: '0.86rem' }}>{u.musteri} · {u.ad}</span>
                  <span style={{ fontSize: '0.75rem', color: '#7A5417' }}>
                    {doldur(e.fazlaSatir, { n: u.bakiye, gun: u.enEskiGun, tuketim: u.tuketim90 })}{u.deger !== null ? ` · ${b.para(u.deger, 0)}` : ''}
                  </span>
                </button>
              ))}
            </details>
          )}
          {ozet.uyarilar.sayimFarki.length > 0 && (
            <details className="card" style={{ marginTop: '0.8rem', borderColor: '#FBDADA', background: '#FFF7F7' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#B93333', minHeight: 28 }}>⚠ {e.uyariSayim} ({ozet.uyarilar.sayimFarki.length})</summary>
              <p style={{ fontSize: '0.78rem', color: '#962929', margin: '0.4rem 0' }}>{e.uyariSayimAlt}</p>
              {ozet.uyarilar.sayimFarki.map((u) => (
                <button key={`${u.musteriId}-${u.anahtar}`} type="button" onClick={() => ac(u.musteriId)}
                  style={{ width: '100%', textAlign: 'left', background: 'white', border: '1px solid #FBDADA', borderRadius: 10, padding: '0.5rem 0.7rem', marginTop: 6, cursor: 'pointer', minHeight: DOKUNMA }}>
                  <span style={{ display: 'block', fontWeight: 700, color: '#0B1533', fontSize: '0.86rem' }}>{u.musteri} · {u.ad}</span>
                  <span style={{ fontSize: '0.75rem', color: u.fark < 0 ? '#962929' : '#B0721F' }}>
                    {u.fark < 0 ? doldur(e.eksik, { n: -u.fark }) : doldur(e.fazla, { n: u.fark })} · {b.tarih(u.tarih)}{u.deger !== null ? ` · ${b.para(u.deger, 0)}` : ''}
                  </span>
                </button>
              ))}
            </details>
          )}
          {ozet.kayip.kayipDeger !== null && (ozet.kayip.kayipAdet > 0 || ozet.kayip.eksikAdet > 0) && (
            <p style={{ fontSize: '0.78rem', color: '#53617B', margin: '0.7rem 0 0' }}>
              {doldur(e.kayipRapor, {
                kayip: `${ozet.kayip.kayipAdet} · ${b.para(ozet.kayip.kayipDeger, 0)}`,
                eksik: `${ozet.kayip.eksikAdet} · ${b.para(ozet.kayip.eksikDeger ?? 0, 0)}`,
              })}
            </p>
          )}

          {/* ── MÜŞTERİLER ── */}
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={e.ara} aria-label={e.ara} style={{ ...girdi, marginTop: '1rem' }} />
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {liste.map((m) => (
              <MusteriKarti key={m.id} m={m} acik={acik === m.id} onAc={() => ac(m.id)} defter={defterler[m.id] ?? null} t={t} b={b}
                onIslem={(i) => { setSonuc(null); setForm({ islem: i, musteri: { id: m.id, ad: m.ad, telefon: m.telefon } }); }} />
            ))}
            {liste.length === 0 && <p style={{ color: '#6C7A93', textAlign: 'center' }}>{e.aramaYok}</p>}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6C7A93', margin: '1rem 0 0' }}>{e.otomatikNot}</p>
        </>
      )}

      {form && (
        <Form islem={form.islem} baslangicMusteri={form.musteri} demo={demo} t={t} defterAl={defterAl}
          onKapat={() => setForm(null)} onBitti={bitti} />
      )}
    </div>
  );
}
