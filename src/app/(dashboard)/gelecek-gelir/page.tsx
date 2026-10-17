'use client';

/**
 * GELECEK GELİR — önümüzdeki 12 / 24 / 60 ayın geliri.
 *
 * Tepede TEK büyük sayı: seçili ufkun sözleşmeli geliri. Yanında iki küçük
 * sayı: yenilenirse gelecek olan ve sözleşmesiz aylık gelir. Altında aylık
 * yığılmış sütun grafiği (sade SVG; renk kesinliği anlatır: koyu = sözleşmeli,
 * orta = yenilenirse, açık = sözleşmesiz — tek tonlu sıralı ölçek, denetlendi),
 * sonra "riskteki gelir" ve "nasıl hesaplandı".
 *
 * Hesap sunucuda (lib/gelecek-gelir.ts, faturanın fiyat işlevleriyle); ekran
 * yalnız çizer. Para birimleri karışmaz: her birim kendi bloğunda.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT, useDil } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { INTL_LOCALE, para, tarih } from '@/lib/bicim';
import type { GelecekGelirVerisi } from '@/lib/gelecek-gelir-veri';
import type { AyDilimi, BirimTahmini, RiskSatiri } from '@/lib/gelecek-gelir';

type Dil = 'tr' | 'en';
const SERI = [
  { anahtar: 'sozlesmeli', renk: '#1D3E7E' },
  { anahtar: 'yenilenirse', renk: '#4C6BA8' },
  { anahtar: 'sozlesmesiz', renk: '#8CA1CE' },
] as const;
type SeriAnahtari = (typeof SERI)[number]['anahtar'];

export default function GelecekGelirSayfasi() {
  const t = useT();
  const { dil } = useDil();
  const g = t.gelecekGelir;
  const [veri, setVeri] = useState<GelecekGelirVerisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [ufuk, setUfuk] = useState(12);

  useEffect(() => {
    let bitti = false;
    fetch('/api/gelecek-gelir', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(d?.error || t.genel.hata);
        if (!bitti) setVeri(d as GelecekGelirVerisi);
      })
      .catch((e: Error) => { if (!bitti) setHata(e.message || t.genel.hata); });
    return () => { bitti = true; };
  }, [t.genel.hata]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{g.baslik}</h1>
          <p style={{ color: '#6C7A93', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 640 }}>{g.alt}</p>
        </div>
        {veri && !veri.bos && (
          <div role="group" aria-label={g.ufukAria} style={{ display: 'inline-flex', background: '#E4E9F1', borderRadius: 10, padding: 3, gap: 2 }}>
            {veri.ufuklar.map((u) => (
              <button key={u} type="button" onClick={() => setUfuk(u)} aria-pressed={ufuk === u}
                style={{
                  minHeight: 36, padding: '0.35rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 700,
                  background: ufuk === u ? '#FFFFFF' : 'transparent', color: ufuk === u ? '#0F2253' : '#53617B',
                  boxShadow: ufuk === u ? '0 1px 2px rgba(11,21,51,.12)' : 'none',
                }}>
                {doldur(g.ufuk, { n: u })}
              </button>
            ))}
          </div>
        )}
      </div>

      {hata && <div className="card" style={{ color: '#B93333' }}>{hata}</div>}
      {!veri && !hata && <div style={{ color: '#6C7A93', padding: '2rem 0' }}>{t.genel.yukleniyor}</div>}

      {veri && veri.bos && <BosDurum t={t} />}

      {veri && !veri.bos && (
        <>
          {veri.birimler.map((b) => (
            <BirimBlogu key={b.birim} t={t} dil={dil} b={b} ufuk={ufuk} sozlesmeSayisi={veri.sozlesmeSayisi} />
          ))}
          <Risk t={t} dil={dil} satirlar={veri.risk} toplam={veri.riskAylik} />
          <NasilHesaplandi t={t} birimler={veri.birimler} />
        </>
      )}
    </div>
  );
}

function BosDurum({ t }: { t: Sozluk }) {
  const g = t.gelecekGelir;
  return (
    <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem' }}>{g.bosBaslik}</h2>
      <p style={{ color: '#53617B', margin: '0 auto 1.25rem', maxWidth: 520, lineHeight: 1.55 }}>{g.bosAciklama}</p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/devices" className="btn-primary">{g.bosCihaz}</Link>
        <Link href="/sozlesmeler" className="btn-secondary">{g.bosSozlesme}</Link>
      </div>
    </div>
  );
}

function BirimBlogu({ t, dil, b, ufuk, sozlesmeSayisi }: { t: Sozluk; dil: Dil; b: BirimTahmini; ufuk: number; sozlesmeSayisi: number }) {
  const g = t.gelecekGelir;
  const pb = (n: number, kesir = 0) => para(n, { dil, birim: b.birim, kesir });
  const o = b.ozet[String(ufuk)] ?? b.ozet['12'];
  const aylar = b.aylar.slice(0, ufuk);
  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#53617B' }}>{doldur(g.buyukEtiket, { n: ufuk })}</p>
        <p style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2.1rem, 6vw, 3.2rem)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.05, color: '#0B1533', overflowWrap: 'anywhere' }}>
          {pb(o.sozlesmeli)}
        </p>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#53617B' }}>
          {doldur(g.kiraSayfa, { kira: pb(o.sozlesmeliKira), sayfa: pb(o.sozlesmeliSayfa) })}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.9rem' }}>
          <Rozet etiket={g.yenilenirseEtiket} deger={`+${pb(o.yenilenirse)}`} alt={doldur(g.yenilenirseAlt, { n: ufuk })} renk={SERI[1].renk} />
          <Rozet etiket={g.sozlesmesizEtiket} deger={doldur(g.aylik, { m: pb(b.sozlesmesizAylik) })} alt={doldur(g.sozlesmesizAlt, { n: b.cihaz.sozlesmesiz })} renk={SERI[2].renk} />
        </div>
        <p style={{ margin: '0.9rem 0 0', fontSize: '0.78rem', color: '#6C7A93' }}>
          {g.kurNotu}{' '}
          {doldur(g.cihazOzeti, { toplam: b.cihaz.toplam, sozlesmeli: b.cihaz.sozlesmeli, gecmis: b.cihaz.suresiGecmis, sozlesmesiz: b.cihaz.sozlesmesiz })}
        </p>
        {sozlesmeSayisi === 0 && (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: '#B0721F' }}>
            {g.sozlesmeYok}{' '}<Link href="/sozlesmeler" style={{ color: '#0F2253', fontWeight: 700 }}>{g.sozlesmeEkle}</Link>
          </p>
        )}
      </div>
      <Grafik t={t} dil={dil} birim={b.birim} aylar={aylar} />
    </>
  );
}

function Rozet({ etiket, deger, alt, renk }: { etiket: string; deger: string; alt: string; renk: string }) {
  return (
    <div style={{ flex: '1 1 13rem', minWidth: 0, border: '1px solid #E4E9F1', borderRadius: 12, padding: '0.6rem 0.8rem', background: '#F8FAFC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#53617B' }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: renk, flexShrink: 0 }} />{etiket}
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0B1533', marginTop: 2, overflowWrap: 'anywhere' }}>{deger}</div>
      <div style={{ fontSize: '0.72rem', color: '#6C7A93', marginTop: 1 }}>{alt}</div>
    </div>
  );
}

function ayAdi(anahtar: string, dil: Dil, uzun = false): string {
  const [y, m] = anahtar.split('-').map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[dil], uzun ? { month: 'long', year: 'numeric' } : { month: 'short' }).format(new Date(y, m - 1, 1));
}

function kisaPara(n: number, dil: Dil, birim: string): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[dil], { style: 'currency', currency: birim, currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch { return para(n, { dil, birim, kesir: 0 }); }
}

/** Yuvarlak eksen tavanı: 1/2/2,5/5 × 10^k. */
function guzelTavan(n: number): number {
  if (!(n > 0)) return 1;
  const us = 10 ** Math.floor(Math.log10(n));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * us >= n) return k * us;
  return 10 * us;
}

const toplamAy = (a: AyDilimi) => a.sozlesmeli + a.yenilenirse + a.sozlesmesiz;

function Grafik({ t, dil, birim, aylar }: { t: Sozluk; dil: Dil; birim: string; aylar: AyDilimi[] }) {
  const g = t.gelecekGelir;
  const kap = useRef<HTMLDivElement>(null);
  const [gen, setGen] = useState(720);
  const [secili, setSecili] = useState(0);
  const [tablo, setTablo] = useState(false);
  useEffect(() => {
    const n = kap.current;
    if (!n || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setGen(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(n);
    return () => ro.disconnect();
  }, []);
  const sec = Math.min(secili, aylar.length - 1);
  const pb = (n: number) => para(n, { dil, birim, kesir: 0 });

  const H = 240, SOL = 58, ALT = 26, UST = 10;
  const cizimG = gen - SOL - 8;
  const cizimY = H - ALT - UST;
  const tavan = guzelTavan(Math.max(...aylar.map(toplamAy), 0) * 1.05);
  const bant = cizimG / Math.max(1, aylar.length);
  const sutun = Math.max(2, Math.min(24, bant - 2));
  const y = (v: number) => UST + cizimY - (v / tavan) * cizimY;
  const etiketAdim = bant >= 34 ? 1 : bant >= 17 ? 3 : 12;
  const ustYuvarlak = (x: number, yy: number, w: number, h: number) => {
    const r = Math.min(4, w / 2, h);
    return `M${x},${yy + h}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + w - r}Q${x + w},${yy} ${x + w},${yy + r}V${yy + h}Z`;
  };
  const s = aylar[sec];

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{g.grafikBaslik}</h2>
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#33405C' }}>
          {SERI.map((sr) => (
            <span key={sr.anahtar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: sr.renk }} />{g.seri[sr.anahtar]}
            </span>
          ))}
        </div>
      </div>
      <div ref={kap} style={{ width: '100%' }}>
        <svg width={gen} height={H} viewBox={`0 0 ${gen} ${H}`} role="img" aria-label={g.grafikAria} style={{ display: 'block', maxWidth: '100%' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((k) => (
            <g key={k}>
              <line x1={SOL} x2={gen - 8} y1={y(tavan * k)} y2={y(tavan * k)} stroke={k === 0 ? '#CFD7E4' : '#EEF1F6'} strokeWidth={1} />
              <text x={SOL - 8} y={y(tavan * k) + 4} textAnchor="end" fontSize={11} fill="#6C7A93" style={{ fontVariantNumeric: 'tabular-nums' }}>{kisaPara(tavan * k, dil, birim)}</text>
            </g>
          ))}
          {aylar.map((a, i) => {
            const x = SOL + i * bant + (bant - sutun) / 2;
            let taban = 0;
            const parcalar = SERI.map((sr) => {
              const v = a[sr.anahtar as SeriAnahtari];
              const p = { sr, alt: taban, ust: taban + v, v };
              taban += v;
              return p;
            }).filter((p) => p.v > 0);
            return (
              <g key={a.ay} opacity={i === sec ? 1 : 0.88}>
                {parcalar.map((p, j) => {
                  const ust = y(p.ust), altY = y(p.alt);
                  const h = Math.max(0, altY - ust - (j > 0 ? 2 : 0));
                  if (h <= 0) return null;
                  return j === parcalar.length - 1
                    ? <path key={p.sr.anahtar} d={ustYuvarlak(x, ust, sutun, h)} fill={p.sr.renk} />
                    : <rect key={p.sr.anahtar} x={x} y={ust} width={sutun} height={h} fill={p.sr.renk} />;
                })}
                {i % etiketAdim === 0 && (
                  <text x={x + sutun / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6C7A93">
                    {etiketAdim === 12 ? a.ay.slice(0, 4) : ayAdi(a.ay, dil)}
                  </text>
                )}
                <rect x={SOL + i * bant} y={UST} width={bant} height={cizimY} fill="transparent" tabIndex={0}
                  role="button" aria-label={`${ayAdi(a.ay, dil, true)}: ${pb(toplamAy(a))}`}
                  onMouseEnter={() => setSecili(i)} onFocus={() => setSecili(i)} onClick={() => setSecili(i)}
                  style={{ cursor: 'pointer', outline: 'none' }} />
              </g>
            );
          })}
          {s && <rect x={SOL + sec * bant} y={UST} width={bant} height={cizimY} fill="none" stroke="#98A3B8" strokeWidth={1} rx={3} pointerEvents="none" />}
        </svg>
      </div>
      {s && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.2rem', marginTop: '0.6rem', fontSize: '0.85rem', color: '#33405C' }}>
          <strong style={{ color: '#0B1533' }}>{ayAdi(s.ay, dil, true)}</strong>
          {SERI.map((sr) => (
            <span key={sr.anahtar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ width: 12, height: 2, background: sr.renk }} />
              <strong style={{ color: '#0B1533' }}>{pb(s[sr.anahtar as SeriAnahtari])}</strong> {g.seri[sr.anahtar]}
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setTablo(!tablo)} className="btn-secondary" style={{ marginTop: '0.75rem', minHeight: 36, padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
        {tablo ? g.tabloGizle : g.tabloGoster}
      </button>
      {tablo && (
        <div style={{ overflowX: 'auto', marginTop: '0.6rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ color: '#6C7A93', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>{g.tabloAy}</th>
                {SERI.map((sr) => <th key={sr.anahtar} style={{ padding: '0.35rem 0.5rem' }}>{g.seri[sr.anahtar]}</th>)}
                <th style={{ padding: '0.35rem 0.5rem' }}>{g.tabloToplam}</th>
              </tr>
            </thead>
            <tbody>
              {aylar.map((a) => (
                <tr key={a.ay} style={{ borderTop: '1px solid #EEF1F6', textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>{ayAdi(a.ay, dil, true)}</td>
                  {SERI.map((sr) => <td key={sr.anahtar} style={{ padding: '0.35rem 0.5rem' }}>{pb(a[sr.anahtar as SeriAnahtari])}</td>)}
                  <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>{pb(toplamAy(a))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Risk({ t, dil, satirlar, toplam }: { t: Sozluk; dil: Dil; satirlar: RiskSatiri[]; toplam: Record<string, number> }) {
  const g = t.gelecekGelir;
  const toplamMetni = Object.entries(toplam).map(([b, n]) => para(n, { dil, birim: b, kesir: 0 })).join(' + ');
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{g.riskBaslik}</h2>
        {satirlar.length > 0 && <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#B93333' }}>{doldur(g.riskToplam, { m: toplamMetni })}</span>}
      </div>
      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8rem', color: '#6C7A93' }}>{g.riskAlt}</p>
      {satirlar.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#0B8259' }}>{g.riskYok}</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {satirlar.map((r) => {
            const ihbar = r.ihbarSonGun
              ? (r.ihbarKacti ? doldur(g.ihbarGecti, { t: tarih(r.ihbarSonGun, dil) })
                : r.bitti ? tarih(r.ihbarSonGun, dil)
                  : doldur(g.ihbarKaldi, { t: tarih(r.ihbarSonGun, dil), n: r.ihbaraGun ?? 0 }))
              : g.ihbarYok;
            const bitis = r.bitti
              ? doldur(g.bittiGun, { t: tarih(r.bitis, dil), n: Math.abs(r.bitimeGun) })
              : doldur(g.bitisKaldi, { t: tarih(r.bitis, dil), n: r.bitimeGun });
            const kritik = r.bitti || r.ihbarKacti;
            return (
              <div key={`${r.id}-${r.birim}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', border: `1px solid ${kritik ? '#F2C2C2' : '#E4E9F1'}`, background: kritik ? '#FEF7F7' : '#FFFFFF', borderRadius: 12, padding: '0.65rem 0.8rem' }}>
                <div style={{ flex: '2 1 12rem', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#0B1533', overflowWrap: 'anywhere' }}>{r.musteri}{r.contractNo ? <span style={{ color: '#6C7A93', fontWeight: 500, fontSize: '0.78rem' }}>{' · '}{r.contractNo}</span> : null}</div>
                  <div style={{ fontSize: '0.76rem', color: '#6C7A93' }}>
                    {doldur(g.cihazAdet, { n: r.cihaz })}{' · '}{r.otomatikYenileme ? g.kendiliginden : g.yenilenmez}
                  </div>
                </div>
                <div style={{ flex: '1 1 7rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6C7A93' }}>{g.aylikGelir}</div>
                  <div style={{ fontWeight: 800, color: '#0B1533' }}>{para(r.aylik, { dil, birim: r.birim, kesir: 0 })}</div>
                </div>
                <div style={{ flex: '1 1 9rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6C7A93' }}>{g.bitis}</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: r.bitti ? '#B93333' : '#33405C' }}>{bitis}</div>
                </div>
                <div style={{ flex: '1 1 10rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6C7A93' }}>{g.ihbarSonGun}</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: r.ihbarKacti ? '#B93333' : '#33405C' }}>{ihbar}</div>
                </div>
                <Link href={`/sozlesmeler?ac=${encodeURIComponent(r.id)}`} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F2253', whiteSpace: 'nowrap', padding: '0.4rem 0' }}>
                  {g.yenilemeGorusmesi}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NasilHesaplandi({ t, birimler }: { t: Sozluk; birimler: BirimTahmini[] }) {
  const g = t.gelecekGelir;
  const bilinmeyen = birimler.reduce((n, b) => n + b.cihaz.sayfasiBilinmeyen, 0);
  return (
    <details className="card" style={{ marginBottom: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}>{g.nasilBaslik}</summary>
      <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.45rem', fontSize: '0.85rem', color: '#33405C', lineHeight: 1.5 }}>
        {g.nasil.map((m, i) => <li key={i}>{m}</li>)}
        {bilinmeyen > 0 && <li style={{ color: '#B0721F' }}>{doldur(g.sayfasiBilinmeyen, { n: bilinmeyen })}</li>}
      </ul>
    </details>
  );
}
