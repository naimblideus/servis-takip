'use client';

import { useCallback, useEffect, useState } from 'react';
import { bugununTarihi } from '@/lib/utils';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';

/**
 * SÖZLEŞMELER
 *
 * Ekran PARAYLA açılıyor, dosya listesiyle değil. Sözleşmeyi saklamak bir
 * dosya dolabıdır; bayi onu bir kez yükler ve bir daha açmaz. Bu ekranın
 * açılma sebebi şu dört sorunun cevabı olmalı:
 *
 *   1. Sözleşmede yazan fiyatla sistemdeki fiyat ayrışmış mı? Kaç ₺?
 *   2. Zam zamanı gelen sözleşme var mı?
 *   3. Fesih ihbar penceresi kaçan var mı? (bitiş tarihinden AYRI bir şey)
 *   4. Sözleşmeye girmemiş kiralık makine var mı?
 *
 * Fark bulmak yetmiyor: her farkın yanında "Sisteme uygula" var. O düğme
 * olmadan bayi farkı okuyup cihaz kartına gidiyor, yedi alanı elle
 * kopyalıyor, birini yanlış yazıyor.
 */

const durumAdi = (t: Sozluk, durum: string): string =>
  durum === 'AKTIF' ? t.sozlesmeler.durumAktif
  : durum === 'BITTI' ? t.sozlesmeler.durumBitti
  : durum === 'FESIH' ? t.sozlesmeler.durumFesih
  : durum;

// Fark satırlarının adı sunucudan Türkçe geliyordu; alan anahtarı zaten
// gönderiliyor, etiketi ekran kendi sözlüğünden yazıyor.
const alanAdi = (t: Sozluk, alan: string): string => ({
  monthlyRent: t.sozlesmeler.alanKira,
  includedBlack: t.sozlesmeler.alanDahilSb,
  includedColor: t.sozlesmeler.alanDahilRenkli,
  pricePerBlack: t.sozlesmeler.alanFiyatSb,
  pricePerColor: t.sozlesmeler.alanFiyatRenkli,
  overagePriceBlack: t.sozlesmeler.alanAsimSb,
  overagePriceColor: t.sozlesmeler.alanAsimRenkli,
}[alan] ?? alan);

// Sayfa adedi ile para aynı biçimde yazılırsa bayi "3537" ve "2500"e
// bakıp hangisinin ne olduğunu ayırt edemiyor. Kalem türüne göre biçim.
const SAYFA_ALANLARI = new Set(['includedBlack', 'includedColor']);
const KURUS_ALANLARI = new Set(['pricePerBlack', 'pricePerColor', 'overagePriceBlack', 'overagePriceColor']);
function deger(t: Sozluk, b: Bicimleyici, alan: string, v: number) {
  if (SAYFA_ALANLARI.has(alan)) return doldur(t.sozlesmeler.sayfaBirim, { n: b.sayi(v) });
  // Sayfa fiyatı kuruşun altında oynuyor: 2 basamağa yuvarlarsak
  // 0,4250 ile 0,4200 aynı görünür ve fark anlamsızlaşır.
  if (KURUS_ALANLARI.has(alan)) return b.para(v, 4);
  return b.para(v);
}

export default function SozlesmelerPage() {
  const t = useT();
  const b = useBicim();
  const tl = (n: number | null | undefined) => b.para(n);
  const ayda = (n: number | null | undefined) => doldur(t.sozlesmeler.ayBasi, { m: tl(n) });
  const [veri, setVeri] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [suzgec, setSuzgec] = useState<'hepsi' | 'farkli' | 'zam' | 'ihbar'>('hepsi');
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await fetch('/api/sozlesmeler');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.genel.hata);
      setVeri(d); setHata(null);
    } catch (e: any) { setHata(e.message); }
    setYukleniyor(false);
  }, [t.genel.hata]);
  useEffect(() => { yukle(); }, [yukle]);

  const patch = async (id: string, govde: any) => {
    const r = await fetch(`/api/sozlesmeler/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    if (!r.ok) { alert((await r.json()).error || t.sozlesmeler.islemBasarisiz); return false; }
    await yukle();
    return true;
  };

  if (yukleniyor && !veri) return <div style={{ padding: '2rem', color: '#6b7280' }}>{t.genel.yukleniyor}</div>;
  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;
  if (!veri) return null;

  const o = veri.ozet;
  const liste = veri.sozlesmeler.filter((k: any) => {
    if (suzgec === 'farkli') return k.farkSayisi > 0;
    if (suzgec === 'zam') return k.zam.zamani;
    if (suzgec === 'ihbar') return k.takvim.ihbarKacti || (!k.takvim.bitmis && k.takvim.bitimeGun <= 60) || k.takvim.bitmis;
    return true;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 1150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{t.sozlesmeler.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>{t.sozlesmeler.alt}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* KÂRLILIK — yenileme görüşmesine bu rakamla oturulur. Ayrı menü
              satırı açmıyoruz; bayi zaten sözleşmeye bakarken burada. */}
          <a href="/sozlesmeler/karlilik"
            style={{ background: 'white', color: '#0f2253', border: '1px solid #0f2253', padding: '0.625rem 1.1rem', borderRadius: '0.5rem', fontWeight: 600, textDecoration: 'none' }}>
            {t.sozlesmeler.karlilikLink}
          </a>
          <button onClick={() => setFormAcik(true)}
            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 500, cursor: 'pointer' }}>
            {t.sozlesmeler.yeniSozlesme}
          </button>
        </div>
      </div>

      {/* ── PARA ÖNCE ────────────────────────────────────────────────────
          Bayi bu ekranı "dosyalarım nerede" diye açmıyor; "ne kaybediyorum"
          diye açıyor. Kartların hepsi tıklanınca ilgili listeyi süzüyor. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Kart
          baslik={t.sozlesmeler.kartFiyat}
          buyuk={o.aylikEksik > 0 ? ayda(o.aylikEksik) : o.farkliSozlesme ? t.sozlesmeler.kartFiyatFarkVar : t.sozlesmeler.yok}
          alt={
            o.farkliSozlesme === 0 ? t.sozlesmeler.kartFiyatUyumlu
              : doldur(t.sozlesmeler.kartFiyatFark, { n: o.farkliSozlesme })
                + (o.aylikFazla > 0 ? doldur(t.sozlesmeler.kartFiyatFazla, { m: tl(o.aylikFazla) }) : '')
          }
          renk={o.aylikEksik > 0 ? '#b45309' : o.farkliSozlesme ? '#b45309' : '#15803d'}
          secili={suzgec === 'farkli'}
          tikla={() => setSuzgec(suzgec === 'farkli' ? 'hepsi' : 'farkli')}
        />
        <Kart
          baslik={t.sozlesmeler.kartZam}
          buyuk={o.zamZamani ? doldur(t.sozlesmeler.kartZamAdet, { n: o.zamZamani }) : t.sozlesmeler.yok}
          alt={o.zamKaybi > 0 ? doldur(t.sozlesmeler.kartZamKayip, { m: tl(o.zamKaybi) })
            : o.zamZamani ? t.sozlesmeler.kartZamOranYok : t.sozlesmeler.kartZamYok}
          renk={o.zamZamani ? '#b45309' : '#15803d'}
          secili={suzgec === 'zam'}
          tikla={() => setSuzgec(suzgec === 'zam' ? 'hepsi' : 'zam')}
        />
        <Kart
          baslik={t.sozlesmeler.kartBitis}
          buyuk={o.ihbarKacan ? doldur(t.sozlesmeler.kartIhbarKacan, { n: o.ihbarKacan })
            : o.bitiyor ? doldur(t.sozlesmeler.kartYaklasan, { n: o.bitiyor }) : t.sozlesmeler.sorunYok}
          alt={o.bitmis ? doldur(t.sozlesmeler.kartBitmis, { n: o.bitmis }) : t.sozlesmeler.kartBitisAlt}
          renk={o.ihbarKacan || o.bitmis ? '#b91c1c' : o.bitiyor ? '#b45309' : '#15803d'}
          secili={suzgec === 'ihbar'}
          tikla={() => setSuzgec(suzgec === 'ihbar' ? 'hepsi' : 'ihbar')}
        />
        <Kart
          baslik={t.sozlesmeler.kartKapsamDisi}
          buyuk={o.kapsamDisi ? doldur(t.sozlesmeler.cihazAdet, { n: o.kapsamDisi }) : t.sozlesmeler.yok}
          alt={o.kapsamDisi ? t.sozlesmeler.kartKapsamDisiAlt : t.sozlesmeler.kartKapsamDisiYok}
          renk={o.kapsamDisi ? '#b45309' : '#15803d'}
        />
      </div>

      {veri.kapsamDisi.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 0.5rem' }}>
            {t.sozlesmeler.kapsamDisiBaslik}
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#92400e', margin: '0 0 0.6rem' }}>
            {t.sozlesmeler.kapsamDisiAlt}
          </p>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem' }}>
            {veri.kapsamDisi.map((d: any) => (
              <div key={d.deviceId} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#78350f' }}>
                <span style={{ fontWeight: 600, minWidth: '9rem' }}>{d.musteri}</span>
                <span>{d.cihaz}</span>
                <span style={{ fontFamily: 'monospace', color: '#a16207' }}>{d.serialNo}</span>
                <span>{d.aylikKira ? ayda(d.aylikKira) : t.sozlesmeler.kiraGirilmemis}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          {doldur(t.sozlesmeler.sayac, { n: liste.length, t: veri.toplam })}
        </span>
        {suzgec !== 'hepsi' && (
          <button onClick={() => setSuzgec('hepsi')}
            style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', borderRadius: '999px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
            {t.sozlesmeler.suzgeciKaldir}
          </button>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
        {liste.length === 0 && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
            {veri.toplam === 0 ? t.sozlesmeler.hicYok : t.sozlesmeler.suzgecBos}
          </div>
        )}
        {liste.map((k: any) => (
          <SozlesmeSatiri
            key={k.id} k={k}
            acik={acik === k.id}
            ac={() => setAcik(acik === k.id ? null : k.id)}
            patch={patch}
            yenile={yukle}
          />
        ))}
      </div>

      {formAcik && <YeniSozlesme kapat={() => setFormAcik(false)} bitti={() => { setFormAcik(false); yukle(); }} />}
    </div>
  );
}

function Kart({ baslik, buyuk, alt, renk, secili, tikla }: any) {
  const icerik = (
    <>
      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{baslik}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: renk, margin: '0.15rem 0' }}>{buyuk}</div>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.3 }}>{alt}</div>
    </>
  );
  const stil: any = {
    background: 'white', border: `1px solid ${secili ? '#0f2253' : '#e5e7eb'}`,
    borderRadius: '0.75rem', padding: '0.9rem', textAlign: 'left', width: '100%',
    boxShadow: secili ? '0 0 0 2px rgba(15,34,83,0.12)' : 'none',
  };
  if (!tikla) return <div style={stil}>{icerik}</div>;
  return <button onClick={tikla} style={{ ...stil, cursor: 'pointer', font: 'inherit' }}>{icerik}</button>;
}

function Rozet({ metin, renk, arka }: { metin: string; renk: string; arka: string }) {
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: renk, background: arka, borderRadius: '999px', padding: '0.12rem 0.5rem', whiteSpace: 'nowrap' }}>
      {metin}
    </span>
  );
}

function SozlesmeSatiri({ k, acik, ac, patch, yenile }: any) {
  const t = useT();
  const b = useBicim();
  const tl = (n: number | null | undefined) => b.para(n);
  const gg = (s: string | null | undefined) => (s ? b.tarih(s) : '—');
  const ayda = (n: number | null | undefined) => doldur(t.sozlesmeler.ayBasi, { m: tl(n) });
  const [mesgul, setMesgul] = useState(false);

  const uygula = async (c: any) => {
    const satirlar = c.farklar.map((f: any) =>
      `· ${alanAdi(t, f.alan)}: ${deger(t, b, f.alan, f.sistemde)} → ${deger(t, b, f.alan, f.sozlesmede)}`).join('\n');
    if (!confirm(
      doldur(t.sozlesmeler.uygulaOnayBas, { cihaz: c.cihaz, sn: c.serialNo })
      + `\n\n${satirlar}\n\n` + t.sozlesmeler.uygulaOnaySon,
    )) return;
    setMesgul(true);
    await patch(k.id, { sistemeUygula: c.contractDeviceId });
    setMesgul(false);
  };

  const zamYapildi = async () => {
    if (!confirm(t.sozlesmeler.zamOnay)) return;
    setMesgul(true);
    // Yerel takvim — UTC'den türetilirse zam bir gün erken görünür.
    await patch(k.id, { lastEscalationAt: bugununTarihi() });
    setMesgul(false);
  };

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button onClick={ac} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
        padding: '0.85rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontWeight: 600, color: '#111827', minWidth: '9rem', flex: 1 }}>{k.musteri?.name}</span>
        {k.contractNo && <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>{k.contractNo}</span>}
        <span style={{ fontSize: '0.76rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
          {gg(k.startDate)} – {gg(k.endDate)}
        </span>
        <span style={{ fontSize: '0.76rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{doldur(t.sozlesmeler.cihazAdet, { n: k.cihazSayisi })}</span>

        {k.status !== 'AKTIF' && <Rozet metin={durumAdi(t, k.status)} renk="#374151" arka="#f3f4f6" />}
        {k.etki.eksik > 0 && <Rozet metin={doldur(t.sozlesmeler.rozetEksik, { m: tl(k.etki.eksik) })} renk="#92400e" arka="#fef3c7" />}
        {k.etki.fazla > 0 && <Rozet metin={doldur(t.sozlesmeler.rozetFazla, { m: tl(k.etki.fazla) })} renk="#9a3412" arka="#ffedd5" />}
        {k.zam.zamani && <Rozet metin={t.sozlesmeler.rozetZam} renk="#92400e" arka="#fef3c7" />}
        {k.takvim.ihbarKacti && <Rozet metin={t.sozlesmeler.rozetIhbar} renk="#991b1b" arka="#fee2e2" />}
        {k.takvim.bitmis && <Rozet metin={t.sozlesmeler.rozetSuresiGecmis} renk="#991b1b" arka="#fee2e2" />}
        {!k.takvim.bitmis && !k.takvim.ihbarKacti && k.takvim.bitimeGun <= 60 && (
          <Rozet metin={doldur(t.sozlesmeler.rozetGunKaldi, { n: k.takvim.bitimeGun })} renk="#92400e" arka="#fef3c7" />
        )}
        {k.farkSayisi === 0 && k.status === 'AKTIF' && <Rozet metin={t.sozlesmeler.rozetUyumlu} renk="#166534" arka="#dcfce7" />}
        <span style={{ color: '#9ca3af' }}>{acik ? '▲' : '▼'}</span>
      </button>

      {acik && (
        <div style={{ padding: '0 1rem 1.1rem', fontSize: '0.83rem' }}>
          {/* ── TAKVİM ──────────────────────────────────────────────────
              İhbar günü bitiş tarihinden AYRI gösteriliyor: "daha 2 ay var"
              diye rahat olan bayi ihbar penceresini kaçırıyor. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
            <Kutu baslik={t.sozlesmeler.kutuBitis}
              icerik={doldur(k.takvim.bitmis ? t.sozlesmeler.bitisGecti : t.sozlesmeler.bitisKaldi,
                { t: gg(k.endDate), n: Math.abs(k.takvim.bitimeGun) })}
              renk={k.takvim.bitmis ? '#b91c1c' : k.takvim.bitimeGun <= 60 ? '#b45309' : '#374151'} />
            <Kutu baslik={t.sozlesmeler.kutuIhbar}
              icerik={k.takvim.ihbarSonGun
                ? doldur(k.takvim.ihbarKacti ? t.sozlesmeler.ihbarGecti : t.sozlesmeler.ihbarKaldi,
                  { t: gg(k.takvim.ihbarSonGun), n: Math.abs(k.takvim.ihbaraGun) })
                : t.sozlesmeler.ihbarYok}
              renk={k.takvim.ihbarKacti ? '#b91c1c' : '#374151'} />
            <Kutu baslik={t.sozlesmeler.kutuZam}
              icerik={!k.zam.maddeVar ? t.sozlesmeler.zamMaddeYok
                : k.zam.zamani
                  ? t.sozlesmeler.zamGeldi
                    + (k.zam.gecikenAy ? doldur(t.sozlesmeler.zamGecikme, { n: k.zam.gecikenAy }) : '')
                    + (k.zam.aylikKayip ? doldur(t.sozlesmeler.zamKayip, { m: tl(k.zam.aylikKayip) }) : '')
                  : doldur(t.sozlesmeler.zamSonraki, { t: gg(k.zam.sonrakiTarih), n: k.zam.kalanGun })}
              renk={k.zam.zamani ? '#b45309' : '#374151'} />
          </div>

          {k.zam.zamani && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <a href={`/toplu-zam?musteri=${k.musteri?.id}`}
                style={{ padding: '0.4rem 0.85rem', background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                {t.sozlesmeler.zammiUygula}
              </a>
              <button onClick={zamYapildi} disabled={mesgul}
                style={{ padding: '0.4rem 0.85rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                {t.sozlesmeler.zamIsaretle}
              </button>
            </div>
          )}

          {/* ── CİHAZ BAZINDA FARK ──────────────────────────────────────── */}
          {k.cihazlar.map((c: any) => (
            <div key={c.contractDeviceId} style={{ border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.7rem', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: c.farklar.length ? '0.6rem' : 0 }}>
                <b>{c.cihaz}</b>
                <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#6b7280' }}>{c.serialNo}</span>
                {c.konum && <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>{c.konum}</span>}
                <span style={{ fontSize: '0.74rem', color: '#9ca3af' }}>
                  {c.aylikSayfaSB !== null ? doldur(t.sozlesmeler.aylikSb, { n: b.sayi(c.aylikSayfaSB) }) : t.sozlesmeler.sayfaGecmisiYok}
                  {c.aylikSayfaRenkli ? doldur(t.sozlesmeler.aylikRenkli, { n: b.sayi(c.aylikSayfaRenkli) }) : ''}
                </span>
                {c.farklar.length === 0
                  ? <Rozet metin={t.sozlesmeler.rozetUyumlu} renk="#166534" arka="#dcfce7" />
                  : <Rozet metin={doldur(t.sozlesmeler.rozetFark, { n: c.farklar.length })} renk="#92400e" arka="#fef3c7" />}
              </div>

              {c.farklar.length > 0 && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', minWidth: '30rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>{[t.sozlesmeler.sutunKalem, t.sozlesmeler.sutunSozlesmede, t.sozlesmeler.sutunSistemde, t.sozlesmeler.sutunAylikEtki, ''].map((h) => (
                          <th key={h} style={{ padding: '0.35rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {c.farklar.map((f: any) => (
                          <tr key={f.alan} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.35rem 0.5rem' }}>{alanAdi(t, f.alan)}</td>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{deger(t, b, f.alan, f.sozlesmede)}</td>
                            <td style={{ padding: '0.35rem 0.5rem' }}>{deger(t, b, f.alan, f.sistemde)}</td>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: f.yon === 'EKSIK_FATURALAMA' ? '#b45309' : '#9a3412' }}>
                              {f.aylikEtki === null ? '—' : tl(f.aylikEtki)}
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', color: f.yon === 'EKSIK_FATURALAMA' ? '#b45309' : '#9a3412', fontSize: '0.72rem' }}>
                              {f.yon === 'EKSIK_FATURALAMA' ? t.sozlesmeler.eksikFaturalama : t.sozlesmeler.fazlaFaturalama}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
                    <button onClick={() => uygula(c)} disabled={mesgul}
                      style={{ padding: '0.4rem 0.85rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      {mesgul ? t.sozlesmeler.uygulaniyor : t.sozlesmeler.sistemeUygula}
                    </button>
                    <a href={`/devices/${c.deviceId}`} style={{ fontSize: '0.78rem', color: '#2563eb' }}>{t.sozlesmeler.cihazKarti}</a>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      {t.sozlesmeler.sozlesmeDuzelt}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.6rem' }}>
            {k.fileUrl && <a href={k.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb' }}>{t.sozlesmeler.taranmisNusha}</a>}
            {k.notes && <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{k.notes}</span>}
            <button
              onClick={async () => {
                if (!confirm(t.sozlesmeler.silOnay)) return;
                const r = await fetch(`/api/sozlesmeler/${k.id}`, { method: 'DELETE' });
                if (r.ok) yenile(); else alert(t.sozlesmeler.silinemedi);
              }}
              style={{ marginLeft: 'auto', fontSize: '0.76rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t.sozlesmeler.sil}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kutu({ baslik, icerik, renk }: any) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '0.5rem', padding: '0.6rem 0.7rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{baslik}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: renk, marginTop: '0.15rem' }}>{icerik}</div>
    </div>
  );
}

function YeniSozlesme({ kapat, bitti }: { kapat: () => void; bitti: () => void }) {
  const t = useT();
  const [musteriler, setMusteriler] = useState<any[]>([]);
  const [cihazlar, setCihazlar] = useState<any[]>([]);
  const [seciliCihaz, setSeciliCihaz] = useState<string[]>([]);
  const [f, setF] = useState<any>({
    customerId: '', contractNo: '', startDate: '', endDate: '',
    noticeDays: 30, autoRenew: true, escalationMonths: 12, escalationRate: '',
    slaResponseHours: '', slaResolutionHours: '', slaPauseOnPart: false,
    fileUrl: '', notes: '',
  });
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json())
      .then((d) => setMusteriler(Array.isArray(d) ? d : d.customers || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!f.customerId) { setCihazlar([]); setSeciliCihaz([]); return; }
    fetch(`/api/devices?customerId=${f.customerId}`).then((r) => r.json())
      .then((d) => {
        const liste = (Array.isArray(d) ? d : d.devices || []).filter((x: any) => x.isRental);
        setCihazlar(liste);
        // Kiralık cihazların hepsi varsayılan seçili: sözleşme zaten onları
        // kapsıyor; bayi istisnayı çıkarsın, hepsini tek tek seçmesin.
        setSeciliCihaz(liste.map((x: any) => x.id));
      })
      .catch(() => setCihazlar([]));
  }, [f.customerId]);

  const kaydet = async () => {
    setMesgul(true); setHata(null);
    const r = await fetch('/api/sozlesmeler', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, deviceIds: seciliCihaz }),
    });
    const d = await r.json();
    setMesgul(false);
    if (!r.ok) { setHata(d.error || t.sozlesmeler.kaydedilemedi); return; }
    bitti();
  };

  const inp: any = { width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.88rem' };
  const lbl: any = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' };

  return (
    <div onClick={kapat} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '1.5rem 1rem',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        margin: 'auto', background: 'white', borderRadius: '1rem', padding: '1.5rem',
        width: '100%', maxWidth: 560, boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '1rem' }}>{t.sozlesmeler.formBaslik}</h2>

        <div style={{ marginBottom: '0.8rem' }}>
          <label style={lbl}>{t.sozlesmeler.formMusteri}</label>
          <select style={inp} value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
            <option value="">{t.genel.secin}</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <div><label style={lbl}>{t.sozlesmeler.formNo}</label><input style={inp} value={f.contractNo} onChange={(e) => setF({ ...f, contractNo: e.target.value })} /></div>
          <div><label style={lbl}>{t.sozlesmeler.formBaslangic}</label><input type="date" style={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><label style={lbl}>{t.sozlesmeler.formBitis}</label><input type="date" style={inp} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <div>
            <label style={lbl}>{t.sozlesmeler.formIhbarGun}</label>
            <input type="number" style={inp} value={f.noticeDays} onChange={(e) => setF({ ...f, noticeDays: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>{t.sozlesmeler.formZamAy}</label>
            <input type="number" style={inp} value={f.escalationMonths} onChange={(e) => setF({ ...f, escalationMonths: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>{t.sozlesmeler.formZamOran}</label>
            <input type="number" style={inp} placeholder={t.sozlesmeler.formZamOranYer} value={f.escalationRate} onChange={(e) => setF({ ...f, escalationRate: e.target.value })} />
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.8rem' }}>
          {t.sozlesmeler.formIpucu}
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} />
          {t.sozlesmeler.formOtoUzama}
        </label>

        {/* SLA — büyük müşterinin yıl sonunda denetlediği söz. Boş bırakılırsa
            o kalem ÖLÇÜLMEZ: uydurulmuş hedefe göre uyum oranı üretmiyoruz. */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.8rem', marginBottom: '0.35rem' }}>
          <label style={{ ...lbl, fontWeight: 700 }}>{t.sozlesmeler.slaBaslik}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem' }}>
            <div>
              <label style={lbl}>{t.sozlesmeler.slaMudahale}</label>
              <input type="number" min={0} step="0.5" style={inp} value={f.slaResponseHours}
                onChange={(e) => setF({ ...f, slaResponseHours: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>{t.sozlesmeler.slaCozum}</label>
              <input type="number" min={0} step="0.5" style={inp} value={f.slaResolutionHours}
                onChange={(e) => setF({ ...f, slaResolutionHours: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0.4rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={f.slaPauseOnPart}
              onChange={(e) => setF({ ...f, slaPauseOnPart: e.target.checked })} />
            {t.sozlesmeler.slaParcaDurdurur}
          </label>
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.8rem' }}>{t.sozlesmeler.slaIpucu}</p>
        </div>

        {cihazlar.length > 0 && (
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={lbl}>{t.sozlesmeler.formCihazlar}</label>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxHeight: '11rem', overflowY: 'auto' }}>
              {cihazlar.map((d) => (
                <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderBottom: '1px solid #f3f4f6' }}>
                  <input type="checkbox" checked={seciliCihaz.includes(d.id)}
                    onChange={(e) => setSeciliCihaz(e.target.checked ? [...seciliCihaz, d.id] : seciliCihaz.filter((x) => x !== d.id))} />
                  <span>{[d.brand, d.model].filter(Boolean).join(' ')}</span>
                  <span style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '0.75rem' }}>{d.serialNo}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.3rem 0 0' }}>
              {t.sozlesmeler.formCihazIpucuOn} <b>{t.sozlesmeler.formCihazIpucuVurgu}</b>{t.sozlesmeler.formCihazIpucuSon}
            </p>
          </div>
        )}

        <div style={{ marginBottom: '0.8rem' }}>
          <label style={lbl}>{t.sozlesmeler.formDosya}</label>
          <input style={inp} placeholder={t.sozlesmeler.formDosyaYer} value={f.fileUrl} onChange={(e) => setF({ ...f, fileUrl: e.target.value })} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={lbl}>{t.sozlesmeler.formNot}</label>
          <input style={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>

        {hata && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{hata}</div>}

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={kaydet} disabled={mesgul || !f.customerId || !f.startDate || !f.endDate}
            style={{ flex: 1, padding: '0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', opacity: mesgul ? 0.7 : 1 }}>
            {mesgul ? t.genel.kaydediliyor : t.genel.kaydet}
          </button>
          <button onClick={kapat} style={{ padding: '0.7rem 1.4rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', color: '#374151' }}>{t.genel.iptal}</button>
        </div>
      </div>
    </div>
  );
}
