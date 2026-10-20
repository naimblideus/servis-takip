'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDil, useT } from '@/lib/i18n/client';
import {
  EKRAN_EN_COK_KARAKTER, EKRAN_EN_UZUN_KENAR, EKRAN_JPEG_KALITE, METIN_EN_COK, NE_OLDU_EN_AZ,
  SORUN_TURLERI, sayfaAyikla, type GorunenDurum, type SorunTuru,
} from '@/lib/sorun';

/**
 * SORUN BİLDİR — tek pencere, her yerden açılır.
 *
 * Açmak için: `sorunBildirAc()` (ya da `window.dispatchEvent(new CustomEvent('sorun-bildir'))`).
 * Pencere panel yerleşiminde (app/(dashboard)/layout.tsx) BİR KEZ duruyor;
 * giriş noktaları (yan menünün altı, alt menüdeki "+" sayfası, Yardım) yalnız
 * olayı atar. Böylece üç yerde üç ayrı form yaşamaz.
 *
 * 30 SANİYE KURALI: kullanıcı yalnız önemini seçer ve ne olduğunu yazar.
 * Sayfa, ekran boyutu ve tarayıcı kendiliğinden eklenir; kim olduğu ve rolü
 * sunucuda oturumdan okunur. Sayfa adresindeki jeton/şifre gibi sorgu
 * parametreleri TARAYICIDA ayıklanır — hiç gönderilmez (sunucu yine ayıklar).
 *
 * EKRAN GÖRÜNTÜSÜ istemcide küçültülür (en uzun kenar 1280 px, JPEG 0.7):
 * telefon ekran görüntüsü 3–5 MB gelir, saha bağlantısında yüklenmez.
 */
export const SORUN_BILDIR_OLAYI = 'sorun-bildir';
export function sorunBildirAc() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SORUN_BILDIR_OLAYI));
}

interface OncekiKayit {
  id: string;
  tur: SorunTuru;
  neOldu: string;
  durum: GorunenDurum;
  createdAt: string;
  kullaniciAd: string | null;
}

const DURUM_RENGI: Record<GorunenDurum, string> = {
  ALINDI: 'bg-slate-100 text-slate-700',
  INCELENIYOR: 'bg-amber-100 text-amber-800',
  COZULDU: 'bg-emerald-100 text-emerald-800',
};

/** Resmi tuvale çizip küçültür; sonuç JPEG data URL. */
async function kucult(dosya: File): Promise<string> {
  const url = URL.createObjectURL(dosya);
  try {
    const img = await new Promise<HTMLImageElement>((coz, reddet) => {
      const i = new Image();
      i.onload = () => coz(i);
      i.onerror = () => reddet(new Error('okunamadi'));
      i.src = url;
    });
    const oran = Math.min(1, EKRAN_EN_UZUN_KENAR / Math.max(img.naturalWidth, img.naturalHeight));
    const g = Math.max(1, Math.round(img.naturalWidth * oran));
    const y = Math.max(1, Math.round(img.naturalHeight * oran));
    const tuval = document.createElement('canvas');
    tuval.width = g;
    tuval.height = y;
    const c = tuval.getContext('2d');
    if (!c) throw new Error('tuval');
    // Saydam PNG'de JPEG siyah zemin çıkarmasın.
    c.fillStyle = '#fff';
    c.fillRect(0, 0, g, y);
    c.drawImage(img, 0, 0, g, y);
    return tuval.toDataURL('image/jpeg', EKRAN_JPEG_KALITE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SorunBildir() {
  const t = useT();
  const s = t.sorunBildir;
  const { dil } = useDil();
  const [acik, setAcik] = useState(false);
  const [tur, setTur] = useState<SorunTuru | null>(null);
  const [neYapiyordu, setNeYapiyordu] = useState('');
  const [neOldu, setNeOldu] = useState('');
  const [goruntu, setGoruntu] = useState<string | null>(null);
  const [goruntuHazirlaniyor, setGoruntuHazirlaniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);
  const [onceki, setOnceki] = useState<OncekiKayit[] | null>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);

  const sifirla = useCallback(() => {
    setTur(null); setNeYapiyordu(''); setNeOldu(''); setGoruntu(null);
    setHata(''); setGonderildi(false); setOnceki(null);
    if (dosyaRef.current) dosyaRef.current.value = '';
  }, []);

  useEffect(() => {
    const ac = () => { setAcik(true); };
    window.addEventListener(SORUN_BILDIR_OLAYI, ac);
    return () => window.removeEventListener(SORUN_BILDIR_OLAYI, ac);
  }, []);

  const kapat = useCallback(() => {
    setAcik(false);
    // Gönderilmiş formu temizle; yarım kalanı koru (yanlışlıkla kapatan kaybetmesin).
    if (gonderildi) sifirla();
  }, [gonderildi, sifirla]);

  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => { if (e.key === 'Escape') kapat(); };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [acik, kapat]);

  async function goruntuSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setHata('');
    setGoruntuHazirlaniyor(true);
    try {
      const veri = await kucult(f);
      if (veri.length > EKRAN_EN_COK_KARAKTER) {
        setGoruntu(null);
        setHata(s.ekranBuyuk);
      } else {
        setGoruntu(veri);
      }
    } catch {
      setGoruntu(null);
      setHata(s.ekranOkunamadi);
    } finally {
      setGoruntuHazirlaniyor(false);
    }
  }

  async function oncekileriGetir() {
    try {
      const r = await fetch('/api/sorun', { cache: 'no-store' });
      if (r.ok) setOnceki(((await r.json()) as { liste: OncekiKayit[] }).liste);
    } catch {
      setOnceki([]);
    }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!tur || gonderiliyor) return;
    if (neOldu.trim().length < NE_OLDU_EN_AZ) { setHata(s.kisa); return; }
    setHata('');
    setGonderiliyor(true);
    try {
      const r = await fetch('/api/sorun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tur,
          neYapiyordu,
          neOldu,
          sayfa: sayfaAyikla(window.location.pathname + window.location.search),
          ekran: `${window.innerWidth}x${window.innerHeight}`,
          tarayici: navigator.userAgent,
          ekranGoruntusu: goruntu,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setHata(j?.error || s.hata);
        return;
      }
      setGonderildi(true);
      void oncekileriGetir();
    } catch {
      setHata(s.hata);
    } finally {
      setGonderiliyor(false);
    }
  }

  if (!acik) return null;

  const tarih = (d: string) =>
    new Date(d).toLocaleDateString(dil === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short' });
  const gonderilebilir = Boolean(tur) && neOldu.trim().length >= NE_OLDU_EN_AZ && !gonderiliyor && !goruntuHazirlaniyor;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center print:hidden" role="dialog" aria-modal="true" aria-labelledby="sorun-bildir-baslik">
      <div className="absolute inset-0 bg-[rgba(11,21,51,.45)]" style={{ touchAction: 'none' }} onClick={kapat} aria-hidden="true" />
      <div
        className="relative w-full max-h-[92dvh] overflow-y-auto rounded-t-[22px] bg-white px-4 pt-3 shadow-2xl md:max-w-lg md:rounded-2xl md:px-6 md:pt-5"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', overscrollBehavior: 'contain' }}
      >
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-[rgba(15,34,83,.15)] md:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="sorun-bildir-baslik" className="text-lg font-bold text-[#0B1533]">{s.baslik}</h2>
            {!gonderildi && <p className="mt-0.5 text-sm text-slate-500">{s.alt}</p>}
          </div>
          <button type="button" onClick={kapat} aria-label={s.kapat}
            className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {gonderildi ? (
          <div className="mt-4">
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="font-semibold text-emerald-900">{s.tesekkur}</p>
              <p className="mt-0.5 text-sm text-emerald-800">{s.tesekkurAlt}</p>
            </div>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-slate-400">{s.onceki}</h3>
            {onceki === null ? null : onceki.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{s.oncekiYok}</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {onceki.map((o) => (
                  <li key={o.id} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">{o.neOldu}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {tarih(o.createdAt)} · {s.tur[o.tur] ?? o.tur}{o.kullaniciAd ? ` · ${o.kullaniciAd}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${DURUM_RENGI[o.durum]}`}>{s.durum[o.durum]}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={sifirla} className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                {s.yeniBildirim}
              </button>
              <button type="button" onClick={kapat} className="min-h-[44px] flex-1 rounded-xl bg-[#0F2253] px-4 text-[15px] font-semibold text-white hover:bg-[#16306e]">
                {s.kapat}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={gonder} className="mt-4 space-y-4" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">{s.turSoru}</legend>
              <div className="grid grid-cols-3 gap-2">
                {SORUN_TURLERI.map((x) => (
                  <button key={x} type="button" onClick={() => setTur(x)} aria-pressed={tur === x}
                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-sm font-semibold leading-tight ${tur === x
                      ? x === 'DURDURUYOR' ? 'border-red-500 bg-red-50 text-red-800' : x === 'YAVASLATIYOR' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    {s.tur[x]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">{s.neYapiyordu} <span className="font-normal text-slate-400">({s.istegeBagli})</span></span>
              <input type="text" value={neYapiyordu} onChange={(e) => setNeYapiyordu(e.target.value)} maxLength={METIN_EN_COK}
                placeholder={s.neYapiyorduYer}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none" />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">{s.neOldu}</span>
              <textarea value={neOldu} onChange={(e) => setNeOldu(e.target.value)} maxLength={METIN_EN_COK} rows={4} required
                placeholder={s.neOlduYer}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none" />
            </label>

            <div>
              <input ref={dosyaRef} type="file" accept="image/*" onChange={goruntuSec} className="sr-only" id="sorun-bildir-dosya" />
              {goruntu ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={goruntu} alt="" className="h-16 w-auto max-w-[120px] rounded-lg border border-slate-200 object-cover object-top" />
                  <label htmlFor="sorun-bildir-dosya" className="flex min-h-[44px] cursor-pointer items-center rounded-xl px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                    {s.ekranDegistir}
                  </label>
                  <button type="button" onClick={() => { setGoruntu(null); if (dosyaRef.current) dosyaRef.current.value = ''; }}
                    className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                    {s.ekranKaldir}
                  </button>
                </div>
              ) : (
                <label htmlFor="sorun-bildir-dosya"
                  className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.9a2 2 0 001.7-.9l.8-1.2A2 2 0 0110.1 4h3.8a2 2 0 011.7.9l.8 1.2a2 2 0 001.7.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {goruntuHazirlaniyor ? s.ekranHazirlaniyor : s.ekranEkle}
                </label>
              )}
            </div>

            {hata && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}

            <button type="submit" disabled={!gonderilebilir}
              className="min-h-[48px] w-full rounded-xl bg-[#0F2253] px-4 text-base font-semibold text-white hover:bg-[#16306e] disabled:opacity-40">
              {gonderiliyor ? s.gonderiliyor : s.gonder}
            </button>
            <p className="text-center text-xs text-slate-400">{s.baglam}</p>
          </form>
        )}
      </div>
    </div>
  );
}
