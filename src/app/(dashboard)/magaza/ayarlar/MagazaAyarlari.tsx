'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { magazaKurulumMetni, type MagazaKurulumMetni } from '@/lib/magaza-kurulum-metin';

/**
 * MAĞAZA AYARLARI EKRANI — mağaza panelindeki ayar formunun Servis içindeki
 * karşılığı. Aynı alanlar, aynı sıra; kurallar mağazada. Kaydedince
 * mağazanın mesajı (hata, uyarı) olduğu gibi gösterilir.
 *
 * Kampanya ve logo anında uygulanır (ayrı düğme), ayar formu tek "Kaydet"le.
 * Günlük işe gerekmeyenler "Gelişmiş" altında kapalı.
 */

type Deger = string | boolean;
type Kampanya = { id: string; tur: string; yuzde: number | null; bitis: string } | null;
interface Durum {
  ayar: Record<string, Deger>;
  magaza: { ad: string; vitrin: string | null; domain: string | null; logo: string | null; aktif: boolean };
  eksikler: string[];
  kampanya: { indirim: Kampanya; kargo: Kampanya };
  kaliplar: { tur: string; yuzde: number | null; gun: number }[];
  sinir: { azamiYuzde: number; azamiGun: number };
}
type Alan = { ad: string; etiket: keyof MagazaKurulumMetni; ipucu?: keyof MagazaKurulumMetni; tip?: 'cok' | 'sayi' | 'anahtar'; yer?: keyof MagazaKurulumMetni };

const BOLUMLER: { baslik: keyof MagazaKurulumMetni; alt?: keyof MagazaKurulumMetni; alanlar: Alan[] }[] = [
  {
    baslik: 'ayOdeme', alt: 'ayOdemeAlt', alanlar: [
      { ad: 'havaleBilgi', etiket: 'ayHavaleBilgi', tip: 'cok', yer: 'ayHavaleYer' },
      { ad: 'havaleAcik', etiket: 'ayHavaleAcik', tip: 'anahtar' },
    ],
  },
  {
    baslik: 'ayIletisim', alt: 'ayIletisimAlt', alanlar: [
      { ad: 'telefon', etiket: 'ayTelefon' },
      { ad: 'eposta', etiket: 'ayEposta' },
      { ad: 'adres', etiket: 'ayAdres', tip: 'cok' },
      { ad: 'calismaSaatleri', etiket: 'ayCalisma', ipucu: 'ayCalismaIpucu', yer: 'ayCalismaYer' },
      { ad: 'hakkimizda', etiket: 'ayHakkimizda', ipucu: 'ayHakkimizdaIpucu', tip: 'cok' },
    ],
  },
  {
    baslik: 'ayKargo', alanlar: [
      { ad: 'kargoUcreti', etiket: 'ayKargoUcreti', ipucu: 'ayKargoUcretiIpucu', tip: 'sayi' },
      { ad: 'kargoBedavaEsik', etiket: 'ayBedavaEsik', ipucu: 'ayBedavaEsikIpucu', tip: 'sayi' },
      { ad: 'kargoyaVerisGun', etiket: 'ayVerisGun', ipucu: 'ayVerisGunIpucu', tip: 'sayi' },
      { ad: 'tedarikGun', etiket: 'ayTedarikGun', ipucu: 'ayTedarikGunIpucu', tip: 'sayi' },
      { ad: 'gelAlAcik', etiket: 'ayGelAl', ipucu: 'ayGelAlIpucu', tip: 'anahtar' },
      { ad: 'bayiIndirimYuzde', etiket: 'ayBayiIndirim', ipucu: 'ayBayiIndirimIpucu', tip: 'sayi' },
    ],
  },
  {
    baslik: 'ayYasal', alt: 'ayYasalAlt', alanlar: [
      { ad: 'unvan', etiket: 'ayUnvan', ipucu: 'ayUnvanIpucu' },
      { ad: 'vergiNo', etiket: 'ayVergiNo' },
      { ad: 'vergiDairesi', etiket: 'ayVergiDairesi' },
      { ad: 'kepAdresi', etiket: 'ayKep', ipucu: 'ayKepIpucu' },
      { ad: 'meslekOdasi', etiket: 'ayOda', ipucu: 'ayOdaIpucu' },
      { ad: 'mersisNo', etiket: 'ayMersis', ipucu: 'ayMersisIpucu' },
      { ad: 'etbisNo', etiket: 'ayEtbis', ipucu: 'ayEtbisIpucu' },
    ],
  },
  { baslik: 'ayYayin', alanlar: [{ ad: 'aktif', etiket: 'ayAktif', ipucu: 'ayAktifIpucu', tip: 'anahtar' }] },
];

const GELISMIS: Alan[] = [
  { ad: 'sehir', etiket: 'aySehir', ipucu: 'aySehirIpucu' },
  { ad: 'markaAdi', etiket: 'ayMarka', ipucu: 'ayMarkaIpucu' },
  { ad: 'yorumBaglantisi', etiket: 'ayYorum', ipucu: 'ayYorumIpucu' },
  { ad: 'baglantilar', etiket: 'ayBaglantilar', ipucu: 'ayBaglantilarIpucu', tip: 'cok' },
  { ad: 'vitrinBaslik', etiket: 'ayVitrinBaslik' },
  { ad: 'cariAcik', etiket: 'ayCari', tip: 'anahtar' },
  { ad: 'posAcik', etiket: 'ayPos', ipucu: 'ayPosIpucu', tip: 'anahtar' },
  { ad: 'bildirimTelefon', etiket: 'ayBildirimTel', ipucu: 'ayBildirimTelIpucu' },
  { ad: 'kurMarjiYuzde', etiket: 'ayKurMarji', ipucu: 'ayKurMarjiIpucu', tip: 'sayi' },
];

const kart: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem', marginBottom: 12 };
const girdi: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '1rem', background: 'white', color: '#111827', boxSizing: 'border-box',
};
const dugme = (renk: string, cerceve = false): React.CSSProperties => ({
  minHeight: 44, padding: '0.55rem 1rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
  background: cerceve ? 'white' : renk, color: cerceve ? renk : 'white', border: `1px solid ${renk}`,
});

/** Ayarları oku. Durum değiştirmez: sonucu döner (ağ hatası = ayrı kod). */
async function ayarlariGetir(): Promise<{ durum: Durum } | { govde: Record<string, unknown> | null }> {
  try {
    const r = await fetch('/api/magaza/ayarlar', { cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    return r.ok && j?.ok ? { durum: j as unknown as Durum } : { govde: j };
  } catch {
    return { govde: { kod: 'ULASILAMADI' } };
  }
}

export function MagazaAyarlari({ sekmeler }: { sekmeler?: React.ReactNode }) {
  const { dil } = useDil();
  const km = magazaKurulumMetni(dil);
  const [durum, setDurum] = useState<Durum | null>(null);
  const [form, setForm] = useState<Record<string, Deger>>({});
  const [ilk, setIlk] = useState<Record<string, Deger>>({});
  const [yukHata, setYukHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string; uyari?: string } | null>(null);
  const [kMesaj, setKMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [lMesaj, setLMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<'kampanya' | 'logo' | null>(null);
  const [ozel, setOzel] = useState({ tur: 'SEPET_INDIRIM', yuzde: '10', gun: '7' });
  const dosyaRef = useRef<HTMLInputElement>(null);

  // Kod → kullanıcıya söylenecek cümle. Mağazanın kendi mesajı (hata) varsa o önce gelir.
  const kodMetni = useCallback((kod: unknown): string => {
    switch (kod) {
      case 'GUNCELLENIYOR': return km.ayGuncelleniyor;
      case 'AYAR_YOK': return km.ayAyarYok;
      case 'MAGAZA_YOK': return km.ayMagazaYok;
      case 'DEMO': return km.ayDemo;
      case 'YETKI': return km.ayYetki;
      case 'SINIR': return km.aySinir;
      default: return km.ayUlasilamadi;
    }
  }, [km]);
  const hataMetni = useCallback((j: Record<string, unknown> | null) =>
    (typeof j?.hata === 'string' && j.hata) ? j.hata : kodMetni(j?.kod), [kodMetni]);

  const uygula = useCallback((d: Durum, formuDa: boolean) => {
    setDurum(d);
    if (formuDa) { setForm(d.ayar); setIlk(d.ayar); }
  }, []);

  // Durum yalnız yanıt gelince yazılır (efekt içinde eşzamanlı setState yok).
  const isle = useCallback((s: Awaited<ReturnType<typeof ayarlariGetir>>) => {
    if ('durum' in s) { setYukHata(null); uygula(s.durum, true); }
    else setYukHata(hataMetni(s.govde));
  }, [uygula, hataMetni]);

  useEffect(() => {
    let iptal = false;
    ayarlariGetir().then((s) => { if (!iptal) isle(s); });
    return () => { iptal = true; };
  }, [isle]);
  const tekrarDene = () => { setYukHata(null); ayarlariGetir().then(isle); };

  const degisti = useMemo(() => Object.keys(form).some((k) => form[k] !== ilk[k]), [form, ilk]);

  // Sayfadan çıkarken kaydedilmemiş değişiklik kaybolmasın.
  useEffect(() => {
    if (!degisti) return;
    const uyar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', uyar);
    return () => window.removeEventListener('beforeunload', uyar);
  }, [degisti]);

  const ayarla = (ad: string, v: Deger) => { setForm((f) => ({ ...f, [ad]: v })); setMesaj(null); };

  const kaydet = async () => {
    setKaydediliyor(true);
    setMesaj(null);
    try {
      // Alan adı bu ekrandan yazılmaz (mağaza panelinde, DNS adımıyla).
      const { domain: _alanAdi, ...veri } = form;
      void _alanAdi;
      const r = await fetch('/api/magaza/ayarlar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ islem: 'KAYDET', veri }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        if (j.durum) uygula(j.durum as Durum, true);
        setMesaj({ tip: 'ok', metin: km.ayKaydedildi, uyari: typeof j.uyari === 'string' ? j.uyari : undefined });
      } else setMesaj({ tip: 'hata', metin: hataMetni(j) });
    } catch {
      setMesaj({ tip: 'hata', metin: km.ayUlasilamadi });
    }
    setKaydediliyor(false);
  };

  const kampanya = async (govde: Record<string, unknown>, basari: string) => {
    setMesgul('kampanya');
    setKMesaj(null);
    try {
      const r = await fetch('/api/magaza/ayarlar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        // Yalnız kampanya kısmı tazelenir: formdaki kaydedilmemiş değişiklik kaybolmasın.
        if (j.durum) setDurum((d) => (d ? { ...d, kampanya: (j.durum as Durum).kampanya } : (j.durum as Durum)));
        setKMesaj({ tip: 'ok', metin: basari });
      } else setKMesaj({ tip: 'hata', metin: hataMetni(j) });
    } catch {
      setKMesaj({ tip: 'hata', metin: km.ayUlasilamadi });
    }
    setMesgul(null);
  };

  const logo = async (dosya: File | null) => {
    setMesgul('logo');
    setLMesaj(null);
    try {
      let r: Response;
      if (dosya) {
        const f = new FormData();
        f.set('dosya', dosya);
        r = await fetch('/api/magaza/logo', { method: 'POST', body: f });
      } else {
        r = await fetch('/api/magaza/logo', { method: 'DELETE' });
      }
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDurum((d) => (d ? { ...d, magaza: { ...d.magaza, logo: (j.logo as string | null) ?? null } } : d));
      else setLMesaj(hataMetni(j));
    } catch {
      setLMesaj(km.ayUlasilamadi);
    }
    if (dosyaRef.current) dosyaRef.current.value = '';
    setMesgul(null);
  };

  const tarih = (iso: string) =>
    new Intl.DateTimeFormat(dil === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
  const kampanyaAdi = (k: { tur: string; yuzde: number | null }) =>
    k.tur === 'KARGO_BEDAVA' ? km.kampanyaKargo : doldur(km.kampanyaIndirim, { n: k.yuzde ?? 0 });

  const alanCiz = (a: Alan) => {
    const id = `ay-${a.ad}`;
    const ipucu = a.ipucu ? <span style={{ display: 'block', color: '#6b7280', fontSize: '0.76rem', marginTop: 3, lineHeight: 1.45 }}>{km[a.ipucu]}</span> : null;
    if (a.tip === 'anahtar') {
      return (
        <label key={a.ad} htmlFor={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', minHeight: 44, gridColumn: '1 / -1' }}>
          <input id={id} type="checkbox" checked={form[a.ad] === true} onChange={(e) => ayarla(a.ad, e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, cursor: 'pointer' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{km[a.etiket]}{ipucu}</span>
        </label>
      );
    }
    const deger = typeof form[a.ad] === 'string' ? (form[a.ad] as string) : '';
    return (
      <div key={a.ad} style={a.tip === 'cok' ? { gridColumn: '1 / -1' } : undefined}>
        <label htmlFor={id} style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>{km[a.etiket]}</label>
        {a.tip === 'cok' ? (
          <textarea id={id} rows={3} value={deger} placeholder={a.yer ? km[a.yer] : undefined} onChange={(e) => ayarla(a.ad, e.target.value)} style={{ ...girdi, resize: 'vertical' }} />
        ) : (
          <input id={id} value={deger} placeholder={a.yer ? km[a.yer] : undefined} inputMode={a.tip === 'sayi' ? 'decimal' : undefined}
            onChange={(e) => ayarla(a.ad, e.target.value)} style={girdi} />
        )}
        {ipucu}
      </div>
    );
  };

  const izgara: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.9rem 1rem' };

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: 820, margin: '0 auto' }}>
      {!sekmeler && <Link href="/magaza" style={{ color: '#1d4ed8', fontSize: '0.85rem', textDecoration: 'none' }}>{km.ayGeri}</Link>}
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.4rem 0 0' }}>{km.ayBaslik}</h1>
      {/* Mağaza sekmeleri (Bugün · Siparişler · Ürünler · Site): sayfa verirse başlığın altında. */}
      {sekmeler}
      <p style={{ color: '#6b7280', margin: sekmeler ? '0.9rem 0 1rem' : '0.25rem 0 1rem', fontSize: '0.9rem' }}>{km.ayAlt}</p>

      {!durum && !yukHata && <p style={{ color: '#6b7280' }}>{km.ayYukleniyor}</p>}
      {yukHata && (
        <div role="alert" style={{ ...kart, borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{yukHata}</p>
          <button type="button" onClick={tekrarDene} style={{ ...dugme('#92400e', true), marginTop: 10 }}>{km.ayTekrarDene}</button>
        </div>
      )}

      {durum && (
        <>
          {/* Durum: yayında mı, adres, yayına almadaki eksikler. */}
          <div style={kart}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{durum.magaza.ad}</div>
                {durum.magaza.vitrin && (
                  <a href={durum.magaza.vitrin} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontSize: '0.85rem', overflowWrap: 'anywhere' }}>
                    {durum.magaza.vitrin.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
              <span style={{
                padding: '0.25rem 0.7rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700,
                background: durum.magaza.aktif ? '#ecfdf5' : '#fffbeb', color: durum.magaza.aktif ? '#05603a' : '#92400e',
                border: `1px solid ${durum.magaza.aktif ? '#abefc6' : '#fde68a'}`,
              }}>
                {durum.magaza.aktif ? km.ayYayinda : km.ayKapali}
              </span>
            </div>
            {!durum.magaza.aktif && durum.eksikler.length > 0 && (
              <div style={{ marginTop: 10, color: '#92400e', fontSize: '0.84rem' }}>
                {km.ayEksikler}
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.7 }}>
                  {durum.eksikler.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}
            <p style={{ margin: '0.6rem 0 0', color: '#9ca3af', fontSize: '0.76rem' }}>{km.ayAlanAdi}</p>
          </div>

          {/* Kampanya: anında başlar/durur. */}
          <div style={kart}>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{km.ayKampanya}</div>
            <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0.2rem 0 0.8rem' }}>{km.ayKampanyaAlt}</p>
            {[durum.kampanya.indirim, durum.kampanya.kargo].filter(Boolean).length === 0 && (
              <p style={{ color: '#6b7280', fontSize: '0.86rem', margin: '0 0 0.8rem' }}>{km.ayKampanyaYok}</p>
            )}
            {[durum.kampanya.indirim, durum.kampanya.kargo].map((k) => k && (
              <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center',
                background: '#ecfdf5', border: '1px solid #abefc6', borderRadius: 10, padding: '0.55rem 0.8rem', marginBottom: 8 }}>
                <span style={{ color: '#05603a', fontSize: '0.88rem', fontWeight: 600 }}>
                  {kampanyaAdi(k)} · {doldur(km.kampanyaBitis, { t: tarih(k.bitis) })}
                </span>
                <button type="button" disabled={mesgul !== null} onClick={() => kampanya({ islem: 'KAMPANYA_DURDUR', id: k.id }, km.ayKampanyaDurduruldu)}
                  style={dugme('#b42318', true)}>{km.ayKampanyaDurdur}</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {durum.kaliplar.map((k) => (
                <button key={`${k.tur}-${k.yuzde}-${k.gun}`} type="button" disabled={mesgul !== null}
                  onClick={() => kampanya({ islem: 'KAMPANYA_BASLAT', tur: k.tur, yuzde: k.yuzde, gun: k.gun }, km.ayKampanyaBasladi)}
                  style={dugme('#0e9f6e', true)}>
                  {k.tur === 'KARGO_BEDAVA'
                    ? doldur(km.ayKampanyaKalipKargo, { g: k.gun })
                    : doldur(km.ayKampanyaKalipIndirim, { n: k.yuzde ?? 0, g: k.gun })}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>{km.ayKampanyaOzel}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
              <select aria-label={km.ayKampanya} value={ozel.tur} onChange={(e) => setOzel({ ...ozel, tur: e.target.value })} style={{ ...girdi, width: 'auto', minHeight: 44 }}>
                <option value="SEPET_INDIRIM">{km.ayKampanyaTurIndirim}</option>
                <option value="KARGO_BEDAVA">{km.ayKampanyaTurKargo}</option>
              </select>
              {ozel.tur === 'SEPET_INDIRIM' && (
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>{km.ayKampanyaYuzde}
                  <input inputMode="numeric" value={ozel.yuzde} onChange={(e) => setOzel({ ...ozel, yuzde: e.target.value })}
                    style={{ ...girdi, width: 84, display: 'block', marginTop: 2 }} />
                </label>
              )}
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>{km.ayKampanyaGun}
                <input inputMode="numeric" value={ozel.gun} onChange={(e) => setOzel({ ...ozel, gun: e.target.value })}
                  style={{ ...girdi, width: 84, display: 'block', marginTop: 2 }} />
              </label>
              <button type="button" disabled={mesgul !== null}
                onClick={() => kampanya({
                  islem: 'KAMPANYA_BASLAT', tur: ozel.tur,
                  yuzde: ozel.tur === 'SEPET_INDIRIM' ? Number(ozel.yuzde) : null, gun: Number(ozel.gun),
                }, km.ayKampanyaBasladi)}
                style={dugme('#0e9f6e')}>{km.ayKampanyaBaslat}</button>
            </div>
            {kMesaj && <p role={kMesaj.tip === 'ok' ? 'status' : 'alert'} style={{ margin: '0.6rem 0 0', fontSize: '0.84rem', color: kMesaj.tip === 'ok' ? '#05603a' : '#b42318' }}>{kMesaj.metin}</p>}
          </div>

          {/* Logo: anında yüklenir/kalkar. */}
          <div style={kart}>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{km.ayLogo}</div>
            <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0.2rem 0 0.8rem' }}>{km.ayLogoAlt}</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 120, height: 60, border: '1px dashed #d1d5db', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', overflow: 'hidden' }}>
                {durum.magaza.logo && durum.magaza.vitrin
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`${durum.magaza.vitrin}${durum.magaza.logo}`} alt={km.ayLogo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{durum.magaza.logo ? '✓' : km.ayLogoYok}</span>}
              </div>
              <input ref={dosyaRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => logo(e.target.files?.[0] ?? null)} />
              <button type="button" disabled={mesgul !== null} onClick={() => dosyaRef.current?.click()} style={dugme('#1d4ed8', true)}>
                {mesgul === 'logo' ? km.ayLogoYukleniyor : durum.magaza.logo ? km.ayLogoDegistir : km.ayLogoYukle}
              </button>
              {durum.magaza.logo && (
                <button type="button" disabled={mesgul !== null} onClick={() => logo(null)} style={dugme('#6b7280', true)}>{km.ayLogoKaldir}</button>
              )}
            </div>
            {lMesaj && <p role="alert" style={{ margin: '0.6rem 0 0', fontSize: '0.84rem', color: '#b42318' }}>{lMesaj}</p>}
          </div>

          {/* Ayar formu: tek "Kaydet". */}
          <form onSubmit={(e) => { e.preventDefault(); kaydet(); }}>
            {BOLUMLER.map((b) => (
              <section key={b.baslik} style={kart}>
                <h2 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>{km[b.baslik]}</h2>
                {b.alt && <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0.2rem 0 0' }}>{km[b.alt]}</p>}
                <div style={{ ...izgara, marginTop: 12 }}>{b.alanlar.map(alanCiz)}</div>
              </section>
            ))}
            <details style={kart}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.98rem', minHeight: 32 }}>
                {km.ayGelismis} <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.8rem' }}>· {km.ayGelismisAlt}</span>
              </summary>
              <div style={{ ...izgara, marginTop: 12 }}>{GELISMIS.map(alanCiz)}</div>
            </details>

            {/* Kaydet çubuğu: ekranın altına yapışır; telefonda alt menünün üstünde
                durur (mobil.css .yapiskan-alt). */}
            <div className="yapiskan-alt" style={{
              position: 'sticky', bottom: 0, zIndex: 5, background: 'white', borderTop: '1px solid #e5e7eb',
              boxShadow: '0 -6px 16px -12px rgba(0,0,0,.25)', padding: '0.75rem 1rem', margin: '0 -1rem',
              display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
            }}>
              <div role={mesaj?.tip === 'hata' ? 'alert' : 'status'} style={{ fontSize: '0.86rem', minWidth: 0, flex: '1 1 200px' }}>
                {mesaj ? (
                  <>
                    <span style={{ color: mesaj.tip === 'ok' ? '#05603a' : '#b42318', fontWeight: 600 }}>{mesaj.metin}</span>
                    {mesaj.uyari && <span style={{ display: 'block', color: '#92400e' }}>{mesaj.uyari}</span>}
                  </>
                ) : degisti ? <span style={{ color: '#92400e' }}>{km.ayDegisti}</span> : null}
              </div>
              <button type="submit" disabled={kaydediliyor || !degisti} style={{ ...dugme('#0f2253'), opacity: kaydediliyor || !degisti ? 0.5 : 1 }}>
                {kaydediliyor ? km.ayKaydediliyor : km.ayKaydet}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
