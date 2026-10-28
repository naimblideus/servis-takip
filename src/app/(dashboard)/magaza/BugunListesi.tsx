'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { bicimYap } from '@/lib/bicim';
import { useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { magazaSiparisMetni, type MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { SiparisEylemi } from './SiparisEylemi';
import { MAVI, dugme, kodMetni, siparisleriGetir, type Siparis, type SiparisVerisi } from './siparis-ortak';

/**
 * BUGÜN — mağaza ve stokla ilgili yapılacak her iş, tek liste.
 *
 * Her satırda tek iş ve tek düğme; iş bitince satır kapanır, üstteki sayı
 * azalır. Sipariş satırlarının adımı ve kuralı mağazadan gelir (onay,
 * kargo, teslim — mağaza panelindekiyle aynı). Stok, toner ve fiyat
 * satırları Servis'in kendi verisi: ilgili ekrana götürür.
 */
type Tur = 'hata' | 'yeni' | 'havale' | 'dukkan' | 'stokBekliyor' | 'kargo' | 'gelAl' | 'teknisyen' | 'tahsilat';

const SIRA: Tur[] = ['hata', 'yeni', 'havale', 'dukkan', 'stokBekliyor', 'kargo', 'gelAl', 'teknisyen', 'tahsilat'];

/** Siparişin Bugün listesindeki satırı; null = bugün yapılacak iş yok (kargoda, sırada, kapandı). */
function satirTuru(s: Siparis): Tur | null {
  if (s.adim === 'ONAY' && s.durum === 'STOK_BEKLIYOR') return 'stokBekliyor';
  if (s.adim === 'ONAY' && s.settleHata) return 'hata';
  switch (s.adim) {
    case 'ONAY': return 'yeni';
    case 'ODEME_ONAY': return 'havale';
    case 'DUKKAN_TESLIM': return 'dukkan';
    case 'KARGO': return 'kargo';
    case 'GEL_AL': return 'gelAl';
    case 'TEKNISYEN': return 'teknisyen';
  }
  // Parayı beklemeden onaylanmış havale: başka iş kalmadıysa tahsilat hatırlatılır.
  return s.odemeServiste ? 'tahsilat' : null;
}

const RENK: Record<Tur | 'stokAzaldi' | 'toner' | 'fiyatsiz', [string, string]> = {
  hata: ['#fef3f2', '#b42318'],
  yeni: ['#fef3f2', '#b42318'],
  havale: ['#fef3f2', '#b42318'],
  dukkan: ['#fef3f2', '#b42318'],
  stokBekliyor: ['#fffaeb', '#93370d'],
  kargo: ['#eff6ff', '#1d4ed8'],
  gelAl: ['#eff6ff', '#1d4ed8'],
  teknisyen: ['#eff6ff', '#1d4ed8'],
  tahsilat: ['#ecfdf5', '#05603a'],
  stokAzaldi: ['#fffaeb', '#93370d'],
  toner: ['#fffaeb', '#93370d'],
  fiyatsiz: ['#f3f4f6', '#374151'],
};

function etiket(t: Tur, sm: MagazaSiparisMetni): string {
  return {
    hata: sm.etiketHata,
    yeni: sm.etiketYeni,
    havale: sm.etiketHavale,
    dukkan: sm.etiketDukkan,
    stokBekliyor: sm.etiketStokBekliyor,
    kargo: sm.etiketKargo,
    gelAl: sm.etiketHazir,
    teknisyen: sm.etiketTeknisyen,
    tahsilat: sm.etiketTahsilat,
  }[t];
}

function aciklama(t: Tur, s: Siparis, sm: MagazaSiparisMetni): string {
  switch (t) {
    case 'hata': return s.settleHata ?? '';
    case 'yeni': return sm.altOnay;
    case 'havale': return sm.altHavale;
    case 'dukkan': return sm.altDukkan;
    case 'stokBekliyor': return sm.altStokBekliyor;
    case 'kargo': return sm.altKargo;
    case 'gelAl': return sm.altGelAl;
    case 'teknisyen': return sm.altTeknisyen;
    case 'tahsilat': return sm.altTahsilat;
  }
}

const Rozet = ({ renk, metin }: { renk: [string, string]; metin: string }) => (
  <span style={{ background: renk[0], color: renk[1], fontSize: '0.74rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 6, whiteSpace: 'nowrap' }}>
    {metin}
  </span>
);

const satirKutusu: React.CSSProperties = {
  display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '0.85rem 1rem', borderTop: '1px solid #f0f0f0',
};

export function BugunListesi({ servis }: { servis: { stokAzaldi: number; toner: number; fiyatsiz: number } }) {
  const { dil } = useDil();
  const sm = magazaSiparisMetni(dil);
  const [veri, setVeri] = useState<SiparisVerisi | null>(null);
  const [kod, setKod] = useState<string | null>(null);
  // Bu oturumda biten işler: satır kısa bir süre "✓" ile kalır, sayı hemen düşer.
  const [bitenler, setBitenler] = useState<Record<string, string>>({});

  useEffect(() => {
    let iptal = false;
    const isle = (r: Awaited<ReturnType<typeof siparisleriGetir>>) => {
      if (iptal) return;
      if ('veri' in r) {
        setVeri(r.veri);
        setKod(null);
      } else setKod(r.kod);
    };
    const yenile = () => void siparisleriGetir('ACIK').then(isle);
    yenile();
    // Liste kendiliğinden yenilenir: sekmeye dönünce ve iki dakikada bir.
    const gorununce = () => document.visibilityState === 'visible' && yenile();
    document.addEventListener('visibilitychange', gorununce);
    const zaman = window.setInterval(yenile, 120_000);
    return () => {
      iptal = true;
      document.removeEventListener('visibilitychange', gorununce);
      window.clearInterval(zaman);
    };
  }, []);

  function degisti(yeni: Siparis, mesaj: string) {
    setVeri((v) => (v ? { ...v, siparisler: v.siparisler.map((s) => (s.id === yeni.id ? yeni : s)) } : v));
    // İş bitti mi: yeni hâlde de yapılacak iş varsa satır o işe geçer (onay → kargo).
    if (!satirTuru(yeni) && mesaj) setBitenler((b) => ({ ...b, [yeni.id]: mesaj }));
  }

  const satirlar = useMemo(() => {
    const liste = (veri?.siparisler ?? [])
      .map((s) => ({ s, tur: satirTuru(s) }))
      .filter((x): x is { s: Siparis; tur: Tur } => x.tur !== null || x.s.id in bitenler)
      .map((x) => ({ ...x, tur: x.tur ?? ('yeni' as Tur) }));
    // En eski iş üstte; tür önceliği önce (onay bekleyen kargodan önce gelir).
    return liste.sort((a, b) => SIRA.indexOf(a.tur) - SIRA.indexOf(b.tur) || a.s.tarih.localeCompare(b.s.tarih));
  }, [veri, bitenler]);

  const servisSatirlari = [
    { anahtar: 'stokAzaldi' as const, n: servis.stokAzaldi, etiket: sm.etiketStokAzaldi, alt: sm.altStokAzaldi, href: '/siparis', dugme: sm.dTedarikci },
    { anahtar: 'toner' as const, n: servis.toner, etiket: sm.etiketToner, alt: sm.altToner, href: '/sarf', dugme: sm.dSevk },
    { anahtar: 'fiyatsiz' as const, n: servis.fiyatsiz, etiket: sm.etiketFiyatsiz, alt: sm.altFiyatsiz, href: '/magaza/urunler?filtre=FIYATSIZ', dugme: sm.dFiyatGir },
  ].filter((x) => x.n > 0);

  const kalan = satirlar.filter((x) => !(x.s.id in bitenler)).length + servisSatirlari.length;

  return (
    <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, marginTop: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '1rem 1rem 0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
            {!veri && !kod ? sm.yukleniyor : kalan > 0 ? doldur(sm.bugunBaslik, { n: kalan }) : sm.bugunBos}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>{kalan > 0 ? sm.bugunAlt : veri ? sm.bugunBosAlt : ''}</p>
        </div>
        <Link href="/magaza/siparisler" style={{ color: MAVI, fontSize: '0.86rem', fontWeight: 700, textDecoration: 'none' }}>
          {sm.tumSiparisler}
        </Link>
      </div>

      {kod && (
        <p style={{ margin: '0 1rem 0.75rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
          {kodMetni(kod, sm)}
        </p>
      )}

      {veri && satirlar.map(({ s, tur }) => {
        const bitti = bitenler[s.id];
        const para = bicimYap(dil, s.paraBirimi).para;
        const adet = s.satirlar.reduce((t, r) => t + r.adet, 0);
        return (
          <div key={s.id} style={{ ...satirKutusu, opacity: bitti ? 0.75 : 1 }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Rozet renk={RENK[tur]} metin={etiket(tur, sm)} />
                <span style={{ fontWeight: 700, fontSize: '0.93rem' }}>
                  {s.alici.ad} · {doldur(sm.urunAdet, { n: adet })} · {para(s.toplam)}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', color: tur === 'hata' ? '#b42318' : '#6b7280', fontSize: '0.8rem' }}>
                {aciklama(tur, s, sm)} <span style={{ color: '#9ca3af' }}>· {s.no}</span>
              </p>
            </div>
            <div style={{ flex: '0 1 auto' }}>
              {bitti ? (
                <span style={{ color: '#05603a', fontSize: '0.86rem', fontWeight: 600 }}>
                  ✓ {bitti}
                  {s.waLink && (
                    <>
                      {' '}
                      <a href={s.waLink} target="_blank" rel="noopener noreferrer" style={{ color: MAVI }}>
                        {sm.dMusteriyeYaz} ↗
                      </a>
                    </>
                  )}
                </span>
              ) : tur === 'stokBekliyor' ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Link href="/siparis" style={dugme(MAVI, true)}>{sm.dTedarikci}</Link>
                  <SiparisEylemi s={s} sm={sm} bagli={veri.bagli} otomatikWa={veri.otomatikWa} kargoFirmalari={veri.kargoFirmalari} onDegisti={degisti} />
                </div>
              ) : tur === 'tahsilat' ? (
                s.musteri?.kaynak === 'SERVIS' ? (
                  <Link href={`/customers/${s.musteri.id}`} style={dugme(MAVI)}>{sm.dTahsilat}</Link>
                ) : null
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <SiparisEylemi s={s} sm={sm} bagli={veri.bagli} otomatikWa={veri.otomatikWa} kargoFirmalari={veri.kargoFirmalari} onDegisti={degisti} />
                  {/* Havale bekleniyor: "IBAN atar mısınız"ın cevabı tek dokunuş (mesajda IBAN ve tutar). */}
                  {tur === 'havale' && s.waLink && (
                    <a href={s.waLink} target="_blank" rel="noopener noreferrer" style={{ color: MAVI, fontSize: '0.82rem' }}>
                      {sm.dMusteriyeYaz} ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {servisSatirlari.map((x) => (
        <div key={x.anahtar} style={satirKutusu}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <Rozet renk={RENK[x.anahtar]} metin={x.etiket} />
            <p style={{ margin: '0.3rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>{doldur(x.alt, { n: x.n })}</p>
          </div>
          <Link href={x.href} style={dugme(MAVI, true)}>{x.dugme}</Link>
        </div>
      ))}
    </section>
  );
}
