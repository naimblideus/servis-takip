'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDil, useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { EGITIM_DOSYALARI, EGITIM_VIDEOLARI, egitimDakika, egitimKaynagi, type EgitimKodu } from '@/lib/egitim-videolari';

/**
 * "▶ 1 dk" — EKRAN İÇİ EĞİTİM VİDEOSU (harita: lib/egitim-videolari.ts).
 *
 * Düğme pencere açar; video bölümün başından başlar, sonunda durur. Kurulum
 * görüşmesinden sonra gelen yeni personel ve unutulan adım için: anlatan
 * kimse yokken ekranın kendisi anlatsın.
 *
 * ── DOSYA YOKSA DÜĞME YOK ───────────────────────────────────────────────
 * Dosya bir kez HEAD ile sorulur (sayfa başına değil, dosya başına; sonuç
 * bellekte). Cevap gelene kadar da düğme çizilmez: basınca boş pencere açan
 * düğme, hiç olmayan düğmeden kötüdür. Video yalnız oynatılınca iner
 * (preload="none"); telefonda kota yemez.
 *
 * ── BÖLÜMÜN DIŞINA TAŞMAZ ───────────────────────────────────────────────
 * `#t=bas,bit` tarayıcıya bölümü söyler ama yeniden "oynat"a basınca bazı
 * tarayıcılar bölümün sonundan devam eder. Burada sonda durdurulur, yeniden
 * oynatılınca baştan başlar.
 *
 * `onIzlendi`: bölüm sonuna kadar izlenince bir kez (ilk giriş adımları
 * "izlendi" sayar).
 *
 * Pencere body'ye taşınır (portal): düğme Başlangıç Rehberi'nin içinde
 * duruyor ve o kutu kendi katmanında (z 39); pencere onun içinde kalsaydı
 * telefonda alt sekme çubuğu (z 45) videonun üstüne binerdi.
 */

const varMi = new Map<string, Promise<boolean>>();
function dosyaVarMi(yol: string): Promise<boolean> {
  let p = varMi.get(yol);
  if (!p) {
    p = fetch(yol, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false);
    varMi.set(yol, p);
  }
  return p;
}

export default function EgitimVideosu({ kod, onIzlendi, className }: {
  kod: EgitimKodu | null | undefined;
  onIzlendi?: () => void;
  className?: string;
}) {
  const t = useT();
  const { dil } = useDil();
  const v = kod ? EGITIM_VIDEOLARI[kod] : null;
  const dosya = v ? EGITIM_DOSYALARI[v.dosya] : null;
  // Video Türkçe: arayüz başka dildeyse düğme çıkmaz.
  const dilUyar = !!dosya && dosya.dil === dil;
  const [var_, setVar] = useState(false);
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);
  const acanDugme = useRef<HTMLButtonElement>(null);
  const izlendi = useRef(false);

  useEffect(() => {
    if (!dosya || !dilUyar) return;
    let iptal = false;
    dosyaVarMi(dosya.yol).then((ok) => { if (!iptal) setVar(ok); });
    return () => { iptal = true; };
  }, [dosya, dilUyar]);

  const kapat = useCallback(() => {
    video.current?.pause();
    setAcik(false);
    acanDugme.current?.focus(); // klavyeyle gelen, kaldığı yere dönsün
  }, []);

  useEffect(() => {
    if (!acik) return;
    setHata(false);
    kapatDugmesi.current?.focus();
    // Dokunuşla açıldı: tarayıcı sesli oynatmaya izin verir; vermezse oynat düğmesi görünür.
    video.current?.play().catch(() => {});
    const tus = (e: KeyboardEvent) => { if (e.key === 'Escape') kapat(); };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [acik, kapat]);

  if (!kod || !v || !dilUyar || !var_) return null;

  const dk = egitimDakika(kod);
  const baslik = t.egitim.video[v.baslik];

  const zaman = () => {
    const el = video.current;
    if (!el) return;
    if (el.currentTime >= v.bit - 0.05) {
      el.pause();
      if (!izlendi.current) { izlendi.current = true; onIzlendi?.(); }
    }
  };
  const oynarken = () => {
    const el = video.current;
    if (el && (el.currentTime < v.bas - 0.5 || el.currentTime >= v.bit - 0.05)) el.currentTime = v.bas;
  };

  return (
    <>
      <button ref={acanDugme} type="button" onClick={() => setAcik(true)}
        aria-label={doldur(t.egitim.dugmeEtiket, { baslik, n: dk })} title={baslik}
        className={`inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 ${className ?? ''}`}>
        {doldur(t.egitim.dugme, { n: dk })}
      </button>
      {acik && createPortal(
        <div role="dialog" aria-modal="true" aria-label={baslik}
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/80 p-3 print:hidden"
          // Portal olsa da tıklama React ağacında düğmenin atalarına kabarır: orada durdur.
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) kapat(); }}>
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-black shadow-2xl">
            <div className="flex items-center gap-3 bg-slate-900 px-4 py-2.5 text-white">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-blue-300">{t.egitim.ust}</div>
                <div className="truncate text-sm font-bold">{baslik}</div>
              </div>
              <button ref={kapatDugmesi} type="button" onClick={kapat} aria-label={t.egitim.kapat}
                className="min-h-[40px] min-w-[40px] rounded-lg bg-white/10 text-lg hover:bg-white/20">✕</button>
            </div>
            <video ref={video} src={egitimKaynagi(kod)} controls playsInline preload="none"
              onTimeUpdate={zaman} onPlay={oynarken} onError={() => setHata(true)}
              className="max-h-[78vh] w-full bg-black object-contain" />
            {hata && <div role="alert" className="bg-slate-900 px-4 py-2.5 text-sm text-amber-200">{t.egitim.acilmadi}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
