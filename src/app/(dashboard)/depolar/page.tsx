'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { icerir } from '@/lib/tr-katla';

/**
 * DEPOLAR VE ARAÇLAR — ana depo + teknisyen araçları + ek depolar.
 *
 * Toplam stok değişmez; bu ekran yalnız "nerede duruyor"u gösterir ve
 * yer değiştirir. Teknisyen fişe parça ekleyince parça kendiliğinden ONUN
 * aracından düşer (lib/depo-veri fistenDus) — bu ekranda elle bir şey
 * yapması gerekmez; yalnız sabah "araca yükle", akşam "depoya bırak".
 */

const LACIVERT = '#0F2253';

interface Depo {
  id: string; ad: string; tur: 'ANA' | 'ARAC' | 'DEPO';
  kullaniciId: string | null; kullaniciAdi: string | null; aktif: boolean;
  kalem: number; adet: number; deger: number | null; eksikKalem?: number;
}
interface Ozet { ana: Depo; depolar: Depo[]; benimArac: string | null; yonetici: boolean; kullanicilar: { id: string; name: string; role: string }[] }
interface Kalem { partId: string; ad: string; sku: string; grup: string | null; adet: number; toplam: number; birimMaliyet: number | null }

const kart: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '0.9rem 1rem' };
const dugme = (zemin: string, yazi: string): React.CSSProperties => ({
  minHeight: 44, padding: '0 1rem', borderRadius: 10, border: zemin === 'white' ? '1px solid #d1d5db' : 'none',
  background: zemin, color: yazi, fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
});
const giris: React.CSSProperties = { width: '100%', minHeight: 44, padding: '0 0.75rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 16, background: 'white' };

export default function DepolarPage() {
  const t = useT();
  const d = t.depo;
  const b = useBicim();
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [kalemler, setKalemler] = useState<Record<string, Kalem[]>>({});
  const [aktarim, setAktarim] = useState<{ kaynak: string; hedef: string } | null>(null);
  const [yeniDepo, setYeniDepo] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(() => {
    fetch('/api/depolar').then(async (r) => {
      const j = await r.json();
      if (!r.ok) { setHata(j.error || t.genel.hata); return; }
      setOzet(j);
    }).catch(() => setHata(t.genel.hata));
  }, [t]);
  useEffect(() => { yukle(); }, [yukle]);

  const kalemYukle = useCallback(async (id: string) => {
    const r = await fetch(`/api/depolar/${id}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setKalemler((k) => ({ ...k, [id]: j.kalemler }));
    return r.ok ? (j.kalemler as Kalem[]) : [];
  }, []);

  const depoAdi = useCallback((x: Depo) => (x.tur === 'ANA' ? d.anaDepo : x.ad), [d]);

  if (hata) return <div style={{ padding: '1.5rem', color: '#b91c1c' }}>{hata}</div>;
  if (!ozet) return <div style={{ padding: '1.5rem', color: '#6b7280' }}>{t.genel.yukleniyor}</div>;

  const tum = [ozet.ana, ...ozet.depolar];
  const araclar = ozet.depolar.filter((x) => x.tur === 'ARAC');
  const aractaToplam = araclar.reduce((s, x) => s + x.adet, 0);
  // Teknisyen kendi aracını ilk görür.
  const sirali = ozet.benimArac
    ? [...tum].sort((a, b2) => (a.id === ozet.benimArac ? -1 : b2.id === ozet.benimArac ? 1 : 0))
    : tum;

  return (
    <div style={{ padding: '1.25rem 1rem 2rem', maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{d.baslik}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.35rem 0 1rem', lineHeight: 1.5 }}>{d.alt}</p>

      <div style={{ ...kart, background: LACIVERT, borderColor: LACIVERT, color: 'white' }}>
        <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 700 }}>{d.ozetOn}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>{doldur(d.ozetArac, { n: aractaToplam, a: araclar.length })}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }}>{doldur(d.ozetAna, { n: ozet.ana.adet, k: ozet.ana.kalem })}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {(ozet.yonetici || ozet.benimArac) && (
            <button type="button" onClick={() => setAktarim({ kaynak: 'ana', hedef: ozet.benimArac ?? (ozet.depolar.find((x) => x.aktif)?.id ?? '') })}
              style={{ ...dugme('white', LACIVERT), flex: '1 1 160px' }}>⇄ {d.aktar}</button>
          )}
          {ozet.yonetici && (
            <button type="button" onClick={() => setYeniDepo(true)} style={{ ...dugme('rgba(255,255,255,.14)', 'white'), flex: '1 1 160px' }}>+ {d.yeniDepo}</button>
          )}
        </div>
      </div>

      {(ozet.ana.eksikKalem ?? 0) > 0 && (
        <div style={{ ...kart, marginTop: 10, background: '#FBF0DD', borderColor: '#F3D9A6', color: '#7A4A0B', fontSize: '0.88rem' }}>
          ⚠ {doldur(d.eksikUyari, { n: ozet.ana.eksikKalem ?? 0 })}
        </div>
      )}
      {mesaj && <div style={{ ...kart, marginTop: 10, background: '#E8F6EF', borderColor: '#BFE5D0', color: '#11603F', fontSize: '0.9rem' }}>{mesaj}</div>}

      {ozet.depolar.length === 0 && (
        <div style={{ ...kart, marginTop: 12, textAlign: 'center', padding: '1.5rem 1rem' }}>
          <div style={{ fontWeight: 700 }}>{d.bosBaslik}</div>
          <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: 6, lineHeight: 1.5 }}>{d.bosAlt}</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {sirali.map((x) => (
          <DepoKarti key={x.id} depo={x} ad={depoAdi(x)} benim={x.id === ozet.benimArac} yonetici={ozet.yonetici}
            acik={acik === x.id} kalemler={kalemler[x.id]}
            ac={async () => { if (acik === x.id) { setAcik(null); return; } setAcik(x.id); if (!kalemler[x.id]) await kalemYukle(x.id); }}
            aktar={(yon) => setAktarim(yon === 'yukle' ? { kaynak: 'ana', hedef: x.id } : { kaynak: x.id, hedef: 'ana' })}
            aktifDegistir={async () => {
              const r = await fetch(`/api/depolar/${x.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktif: !x.aktif }) });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) { setMesaj(j.error || t.genel.hata); return; }
              yukle();
            }}
            b={b} d={d} />
        ))}
      </div>

      {aktarim && (
        <AktarimFormu depolar={tum.filter((x) => x.aktif)} depoAdi={depoAdi} baslangic={aktarim}
          yonetici={ozet.yonetici} benimArac={ozet.benimArac} kalemYukle={kalemYukle} d={d} t={t}
          kapat={() => setAktarim(null)}
          bitti={(m) => { setAktarim(null); setMesaj(m); setKalemler({}); setAcik(null); yukle(); }} />
      )}
      {yeniDepo && (
        <YeniDepoFormu kullanicilar={ozet.kullanicilar} d={d} t={t} kapat={() => setYeniDepo(false)}
          bitti={() => { setYeniDepo(false); yukle(); }} />
      )}
    </div>
  );
}

function DepoKarti({ depo, ad, benim, yonetici, acik, kalemler, ac, aktar, aktifDegistir, b, d }: {
  depo: Depo; ad: string; benim: boolean; yonetici: boolean; acik: boolean; kalemler?: Kalem[];
  ac: () => void; aktar: (yon: 'yukle' | 'bosalt') => void; aktifDegistir: () => void;
  b: ReturnType<typeof useBicim>; d: ReturnType<typeof useT>['depo'];
}) {
  const [ara, setAra] = useState('');
  const liste = useMemo(() => (kalemler ?? []).filter((k) => !ara.trim() || icerir(k.ad, ara) || icerir(k.sku, ara)), [kalemler, ara]);
  const rozet = depo.tur === 'ANA' ? d.turAna : depo.tur === 'ARAC' ? d.turArac : d.turDepo;
  const aktarabilir = yonetici || benim;
  return (
    <div style={{ ...kart, opacity: depo.aktif ? 1 : 0.6, borderColor: benim ? '#9DB8F2' : '#e5e7eb' }}>
      <button type="button" onClick={ac} aria-expanded={acik}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}>
        <span aria-hidden style={{ fontSize: '1.4rem' }}>{depo.tur === 'ARAC' ? '🚐' : depo.tur === 'ANA' ? '🏬' : '📦'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0B1533' }}>{ad}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#EEF2FA', color: '#1D3E7E', borderRadius: 6, padding: '2px 7px' }}>{rozet}</span>
            {benim && <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#1D3E7E', color: 'white', borderRadius: 6, padding: '2px 7px' }}>{d.benim}</span>}
            {!depo.aktif && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280' }}>{d.pasif}</span>}
          </span>
          <span style={{ display: 'block', fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>
            {depo.kullaniciAdi ? `${depo.kullaniciAdi} · ` : ''}{doldur(d.kalemAdet, { k: depo.kalem, n: depo.adet })}
            {depo.deger !== null && depo.deger > 0 ? ` · ${b.para(depo.deger, 0)}` : ''}
          </span>
        </span>
        <span aria-hidden style={{ color: '#9ca3af' }}>{acik ? '▴' : '▾'}</span>
      </button>

      {acik && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f1f2f4', paddingTop: 10 }}>
          {depo.tur !== 'ANA' && aktarabilir && depo.aktif && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button type="button" onClick={() => aktar('yukle')} style={{ ...dugme(LACIVERT, 'white'), flex: '1 1 140px' }}>↓ {depo.tur === 'ARAC' ? d.aracaYukle : d.depoyaAl}</button>
              <button type="button" onClick={() => aktar('bosalt')} style={{ ...dugme('white', LACIVERT), flex: '1 1 140px' }}>↑ {d.anaDepoyaBirak}</button>
            </div>
          )}
          {kalemler === undefined ? (
            <div style={{ color: '#9ca3af', fontSize: '0.88rem' }}>…</div>
          ) : kalemler.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.88rem' }}>{d.bosDepo}</div>
          ) : (
            <>
              {kalemler.length > 8 && <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder={d.ara} style={{ ...giris, marginBottom: 8 }} />}
              <div style={{ display: 'grid', gap: 4 }}>
                {liste.map((k) => (
                  <div key={k.partId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', borderBottom: '1px solid #f5f6f8' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{k.ad}</span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>{k.sku}</span>
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>{k.adet}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {yonetici && depo.tur !== 'ANA' && (
            <button type="button" onClick={aktifDegistir} style={{ marginTop: 10, background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', minHeight: 36 }}>
              {depo.aktif ? d.pasifYap : d.aktifYap}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Pencere({ baslik, kapat, children }: { baslik: string; kapat: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={baslik} onClick={kapat}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,21,51,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain', background: 'white', borderRadius: '20px 20px 0 0', padding: '1rem 1rem calc(1.2rem + env(safe-area-inset-bottom))' }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.8rem' }}>{baslik}</div>
        {children}
      </div>
    </div>
  );
}

function AktarimFormu({ depolar, depoAdi, baslangic, yonetici, benimArac, kalemYukle, d, t, kapat, bitti }: {
  depolar: Depo[]; depoAdi: (x: Depo) => string; baslangic: { kaynak: string; hedef: string };
  yonetici: boolean; benimArac: string | null; kalemYukle: (id: string) => Promise<Kalem[]>;
  d: ReturnType<typeof useT>['depo']; t: ReturnType<typeof useT>; kapat: () => void; bitti: (m: string) => void;
}) {
  const [kaynak, setKaynak] = useState(baslangic.kaynak);
  const [hedef, setHedef] = useState(baslangic.hedef);
  const [kalemler, setKalemler] = useState<Kalem[] | null>(null);
  const [ara, setAra] = useState('');
  const [secili, setSecili] = useState<Kalem | null>(null);
  const [adet, setAdet] = useState(1);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => { setKalemler(null); setSecili(null); kalemYukle(kaynak).then(setKalemler); }, [kaynak, kalemYukle]);
  // Teknisyen yalnız kendi aracına giren/çıkan aktarımı yapabilir (sunucu da denetler).
  const secenek = (taraf: 'k' | 'h') => depolar.filter((x) => yonetici || x.id === benimArac || x.id === 'ana' || (taraf === 'k' ? hedef === benimArac : kaynak === benimArac));
  const liste = (kalemler ?? []).filter((k) => !ara.trim() || icerir(k.ad, ara) || icerir(k.sku, ara)).slice(0, 50);

  const gonder = async () => {
    if (!secili) return;
    setMesgul(true); setHata(null);
    const r = await fetch('/api/depolar/aktar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kaynak, hedef, partId: secili.partId, adet }) });
    const j = await r.json().catch(() => ({}));
    setMesgul(false);
    if (!r.ok) { setHata(j.error || t.genel.hata); return; }
    const hedefAd = depoAdi(depolar.find((x) => x.id === hedef) as Depo);
    bitti(doldur(d.aktarildi, { n: adet, p: secili.ad, h: hedefAd }));
  };

  return (
    <Pencere baslik={d.aktar} kapat={kapat}>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>{d.nereden}
          <select value={kaynak} onChange={(e) => setKaynak(e.target.value)} style={{ ...giris, marginTop: 4 }}>
            {secenek('k').map((x) => <option key={x.id} value={x.id}>{depoAdi(x)}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>{d.nereye}
          <select value={hedef} onChange={(e) => setHedef(e.target.value)} style={{ ...giris, marginTop: 4 }}>
            {secenek('h').filter((x) => x.id !== kaynak).map((x) => <option key={x.id} value={x.id}>{depoAdi(x)}</option>)}
          </select>
        </label>
        {!secili ? (
          <div>
            <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder={d.parcaAra} style={giris} autoFocus />
            <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {kalemler === null && <div style={{ color: '#9ca3af', fontSize: '0.88rem' }}>…</div>}
              {kalemler !== null && liste.length === 0 && <div style={{ color: '#6b7280', fontSize: '0.88rem' }}>{d.kaynakBos}</div>}
              {liste.map((k) => (
                <button key={k.partId} type="button" onClick={() => { setSecili(k); setAdet(1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', minHeight: 48, padding: '6px 8px', border: '1px solid #eef0f3', borderRadius: 10, background: 'white', cursor: 'pointer' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.9rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{k.ad}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{doldur(d.eldeki, { n: k.adet })}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...kart, background: '#F7F8FA' }}>
            <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{secili.ad}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{doldur(d.eldeki, { n: secili.adet })} · <button type="button" onClick={() => setSecili(null)} style={{ background: 'none', border: 'none', color: '#1D3E7E', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>{d.degistir}</button></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <button type="button" aria-label="−" onClick={() => setAdet((a) => Math.max(1, a - 1))} style={{ ...dugme('white', LACIVERT), width: 48, padding: 0, fontSize: '1.3rem' }}>−</button>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{adet}</span>
              <button type="button" aria-label="+" onClick={() => setAdet((a) => Math.min(secili.adet, a + 1))} style={{ ...dugme('white', LACIVERT), width: 48, padding: 0, fontSize: '1.3rem' }}>+</button>
            </div>
          </div>
        )}
        {hata && <div style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{hata}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={kapat} style={{ ...dugme('white', '#374151'), flex: 1 }}>{t.genel.iptal}</button>
          <button type="button" onClick={gonder} disabled={!secili || mesgul || !hedef}
            style={{ ...dugme(LACIVERT, 'white'), flex: 2, opacity: !secili || mesgul || !hedef ? 0.5 : 1 }}>{mesgul ? '…' : d.aktarOnay}</button>
        </div>
      </div>
    </Pencere>
  );
}

function YeniDepoFormu({ kullanicilar, d, t, kapat, bitti }: {
  kullanicilar: { id: string; name: string; role: string }[];
  d: ReturnType<typeof useT>['depo']; t: ReturnType<typeof useT>; kapat: () => void; bitti: () => void;
}) {
  const [tur, setTur] = useState<'ARAC' | 'DEPO'>('ARAC');
  const [kisi, setKisi] = useState(kullanicilar.find((k) => k.role === 'TECHNICIAN')?.id ?? '');
  const [ad, setAd] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const kisiAdi = kullanicilar.find((k) => k.id === kisi)?.name ?? '';
  const onerilen = tur === 'ARAC' ? doldur(d.aracOnerAd, { k: kisiAdi }) : '';

  const kaydet = async () => {
    setMesgul(true); setHata(null);
    const r = await fetch('/api/depolar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tur, ad: ad.trim() || onerilen, kullaniciId: tur === 'ARAC' ? kisi : null }) });
    const j = await r.json().catch(() => ({}));
    setMesgul(false);
    if (!r.ok) { setHata(j.error || t.genel.hata); return; }
    bitti();
  };

  return (
    <Pencere baslik={d.yeniDepo} kapat={kapat}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div role="radiogroup" style={{ display: 'flex', gap: 8 }}>
          {(['ARAC', 'DEPO'] as const).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={tur === x} onClick={() => setTur(x)}
              style={{ ...dugme(tur === x ? LACIVERT : 'white', tur === x ? 'white' : '#374151'), flex: 1 }}>
              {x === 'ARAC' ? `🚐 ${d.turArac}` : `📦 ${d.turDepo}`}
            </button>
          ))}
        </div>
        {tur === 'ARAC' && (
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>{d.teknisyen}
            <select value={kisi} onChange={(e) => setKisi(e.target.value)} style={{ ...giris, marginTop: 4 }}>
              {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
        )}
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>{d.ad}
          <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder={onerilen || d.depoAdOrnek} style={{ ...giris, marginTop: 4 }} />
        </label>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.45 }}>{tur === 'ARAC' ? d.aracAciklama : d.depoAciklama}</div>
        {hata && <div style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{hata}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={kapat} style={{ ...dugme('white', '#374151'), flex: 1 }}>{t.genel.iptal}</button>
          <button type="button" onClick={kaydet} disabled={mesgul || (tur === 'ARAC' && !kisi) || (!ad.trim() && !onerilen)}
            style={{ ...dugme(LACIVERT, 'white'), flex: 2 }}>{mesgul ? '…' : d.kaydet}</button>
        </div>
      </div>
    </Pencere>
  );
}
