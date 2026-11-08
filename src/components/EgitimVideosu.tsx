'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useDil, useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import {
  EGITIM_DOSYALARI, EGITIM_VIDEOLARI, egitimDakika, egitimDosyaAdresi, egitimKaynagi, izlenenlereEkle, type EgitimKodu,
} from '@/lib/egitim-videolari';

/**
 * "▶ 1 dk" — EKRAN İÇİ EĞİTİM VİDEOSU (harita: lib/egitim-videolari.ts).
 *
 * Düğme pencere açar; video bölümün başından başlar, sonunda durur. Kurulum
 * görüşmesinden sonra gelen yeni personel ve unutulan adım için: anlatan
 * kimse yokken ekranın kendisi anlatsın.
 *
 * ── ÖĞRENEN KİŞİDE KALKAR ───────────────────────────────────────────────
 * Sayfalardaki düğme (varsayılan) yalnız kişinin ilk 45 gününde görünür
 * (/api/egitim/durum) ve klibi sonuna kadar izleyen kişide bir sonraki
 * açılışta kalkar. İzlenenler tarayıcıda, kişiye özel anahtarla durur; liste
 * yalnız düğme ekrana gelirken okunur: izlerken düğme kaybolmaz, geri sarıp
 * yeniden bakmak isteyen bulsun. `herZaman`: ilk giriş adımları (adım bitince
 * zaten gider) ve Yardım (unutulan adımın videosu orada kalır).
 *
 * ── DOSYA YOKSA DÜĞME YOK ───────────────────────────────────────────────
 * Dosya bir kez HEAD ile sorulur (sayfa başına değil, dosya başına; sonuç
 * bellekte) ve YALNIZ düğme gösterilecekse: süresi dolan ya da klibi izleyen
 * kişide hiç sorulmaz. Cevap gelene kadar da düğme çizilmez: basınca boş
 * pencere açan düğme, hiç olmayan düğmeden kötüdür.
 *
 * ── SİSTEMİ YAVAŞLATMAZ ─────────────────────────────────────────────────
 * Video yalnız ▶'e basılınca iner: <video> pencere açılınca kurulur,
 * preload="none", inen de yalnız izlenen bölüm. Adreste içerik özeti var
 * (egitimDosyaAdresi): ikinci izleyiş telefonun önbelleğinden açılır.
 * Öğrenme döneminin bitiş anı kişi başına bir kez sorulur ve tarayıcıda
 * saklanır; sonraki açılışlarda bu uca istek gitmez.
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
export function dosyaVarMi(yol: string): Promise<boolean> {
  let p = varMi.get(yol);
  if (!p) {
    p = fetch(yol, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false);
    varMi.set(yol, p);
  }
  return p;
}

// Kişi öğrenme döneminde mi. Dönemin bitiş anı kişi başına BİR KEZ sorulur ve
// tarayıcıda saklanır: sonraki açılışlarda istek gitmez, süre dolunca da hiç
// gitmez. Bitişi olmayan cevap (demo) saklanmaz, sayfa açılışı başına bir kez
// sorulur (aynı sayfadaki iki düğme tek istek).
const donemAnahtari = (kisi: string) => `nextus-egitim-donem:${kisi}`;
const donemler = new Map<string, Promise<boolean>>();
function ogrenmedeMi(kisi: string): Promise<boolean> {
  try {
    const kayit = JSON.parse(localStorage.getItem(donemAnahtari(kisi)) || 'null') as { bitis?: unknown } | null;
    if (kayit && typeof kayit.bitis === 'number') return Promise.resolve(Date.now() < kayit.bitis);
  } catch { /* özel sekme: uca sorulur */ }
  let p = donemler.get(kisi);
  if (!p) {
    p = fetch('/api/egitim/durum', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ogrenmede?: unknown; bitis?: unknown } | null) => {
        if (d && typeof d.bitis === 'number') {
          try { localStorage.setItem(donemAnahtari(kisi), JSON.stringify({ bitis: d.bitis })); } catch { /* yoksay */ }
        }
        return d?.ogrenmede === true;
      })
      .catch(() => { donemler.delete(kisi); return false; }); // ağ yoksa sonraki açılışta yeniden sorulur
    donemler.set(kisi, p);
  }
  return p;
}

const izlenenAnahtari = (kisi: string) => `nextus-egitim-izlenen:${kisi}`;
function izlenenler(kisi: string): unknown[] {
  try {
    const x = JSON.parse(localStorage.getItem(izlenenAnahtari(kisi)) || '[]');
    return Array.isArray(x) ? x : [];
  } catch { return []; } // özel sekme: düğme kalır, zararı yok
}
function izlendiYaz(kisi: string, kod: EgitimKodu) {
  try { localStorage.setItem(izlenenAnahtari(kisi), JSON.stringify(izlenenlereEkle(izlenenler(kisi), kod))); } catch { /* yoksay */ }
}

export default function EgitimVideosu({ kod, onIzlendi, herZaman = false, baslikli = false, className }: {
  kod: EgitimKodu | null | undefined;
  onIzlendi?: () => void;
  /** İlk giriş adımı ve Yardım: kişinin süresine ve izlediğine bakılmaz. */
  herZaman?: boolean;
  /** Düğmede klibin adı da yazar (Yardım'daki liste). */
  baslikli?: boolean;
  className?: string;
}) {
  const t = useT();
  const { dil } = useDil();
  const { data: oturum } = useSession();
  const kisi = (oturum?.user as { id?: string } | undefined)?.id ?? null;
  const v = kod ? EGITIM_VIDEOLARI[kod] : null;
  const dosya = v ? EGITIM_DOSYALARI[v.dosya] : null;
  // Video Türkçe: arayüz başka dildeyse düğme çıkmaz.
  const dilUyar = !!dosya && dosya.dil === dil;
  const [var_, setVar] = useState(false);
  // Sayfa düğmesi: cevap gelene kadar çizilmez (önce görünüp sonra kaybolmasın).
  const [izinliKod, setIzinliKod] = useState<EgitimKodu | null>(null);
  const izinli = herZaman || (!!kod && izinliKod === kod);
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);
  const acanDugme = useRef<HTMLButtonElement>(null);
  const izlendi = useRef(false);

  // Dosya yalnız düğme gösterilecekse sorulur (süresi dolan kişide istek yok).
  const dosyaKodu = v?.dosya ?? null;
  useEffect(() => {
    if (!dosyaKodu || !dilUyar || !izinli) return;
    let iptal = false;
    dosyaVarMi(egitimDosyaAdresi(dosyaKodu)).then((ok) => { if (!iptal) setVar(ok); });
    return () => { iptal = true; };
  }, [dosyaKodu, dilUyar, izinli]);

  useEffect(() => {
    if (herZaman || !kod || !dilUyar || !kisi) return;
    if (izlenenler(kisi).includes(kod)) return; // bu klibi sonuna kadar izledi: sayfada bir daha yok
    let iptal = false;
    ogrenmedeMi(kisi).then((ok) => { if (!iptal && ok) setIzinliKod(kod); });
    return () => { iptal = true; };
  }, [herZaman, kod, dilUyar, kisi]);

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

  if (!kod || !v || !dilUyar || !var_ || !izinli) return null;

  const dk = egitimDakika(kod);
  const baslik = t.egitim.video[v.baslik];

  const zaman = () => {
    const el = video.current;
    if (!el) return;
    if (el.currentTime >= v.bit - 0.05) {
      el.pause();
      if (!izlendi.current) {
        izlendi.current = true;
        if (kisi) izlendiYaz(kisi, kod); // nerede izlenirse izlensin (Yardım dahil) sayfadaki düğme kalkar
        onIzlendi?.();
      }
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
        className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 ${baslikli ? 'text-left' : 'whitespace-nowrap'} ${className ?? ''}`}>
        {baslikli ? doldur(t.egitim.baslikliDugme, { baslik, n: dk }) : doldur(t.egitim.dugme, { n: dk })}
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
