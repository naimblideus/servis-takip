'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import type { Sozluk } from '@/lib/i18n/sozluk';

type BolumAnahtari = keyof Sozluk['yardim']['bolum'];

interface Bolum {
  id: string;
  /** Sözlükteki karşılığı — metin oradan, ikon ve renk burada. */
  anahtar: BolumAnahtari;
  icon: string;
}

/**
 * ── KILAVUZUN YAPISI KODDA, METNİ SÖZLÜKTE ───────────────────────────────
 * Bölümlerin sırası, ikonu ve hangi aileye düştüğü burada duruyor; başlık,
 * adımlar ve ipucu sözlükten geliyor. Metni burada tutsaydık İngilizce
 * kılavuz ayrı bir dosyada kopya olarak yaşar ve biri güncellenince diğeri
 * sessizce eskirdi.
 */
const BOLUMLER: Bolum[] = [
  { id: 'musteri', anahtar: 'musteri', icon: '👤' },
  { id: 'goc', anahtar: 'goc', icon: '📦' },
  { id: 'disa-aktar', anahtar: 'disaAktar', icon: '⬇️' },
  { id: 'cihaz', anahtar: 'cihaz', icon: '🖨️' },
  { id: 'fis', anahtar: 'fis', icon: '🧾' },
  { id: 'sayac', anahtar: 'sayac', icon: '🔢' },
  { id: 'cihazdan-sayac', anahtar: 'cihazdanSayac', icon: '📡' },
  { id: 'sayac-uyarilari', anahtar: 'sayacUyarilari', icon: '🚨' },
  { id: 'portal', anahtar: 'portal', icon: '🔗' },
  { id: 'toner', anahtar: 'toner', icon: '🧴' },
  { id: 'sozlesme', anahtar: 'sozlesme', icon: '📜' },
  { id: 'karlilik', anahtar: 'karlilik', icon: '📈' },
  { id: 'alis', anahtar: 'alis', icon: '🧾' },
  { id: 'teklif', anahtar: 'teklif', icon: '📝' },
  { id: 'fatura', anahtar: 'fatura', icon: '📄' },
  { id: 'e-fatura', anahtar: 'eFatura', icon: '🧾' },
  { id: 'kdv', anahtar: 'kdv', icon: '🧮' },
  { id: 'tahsilat', anahtar: 'tahsilat', icon: '💰' },
  { id: 'ciktilar', anahtar: 'ciktilar', icon: '🖨️' },
  { id: 'patron', anahtar: 'patron', icon: '📊' },
  { id: 'saha', anahtar: 'saha', icon: '🗺️' },
  { id: 'pazar', anahtar: 'pazar', icon: '🤝' },
  { id: 'guvenlik', anahtar: 'guvenlik', icon: '🔐' },
];

const ZINCIR_IKON = ['👤', '🖨️', '🧾', '💰'];
const HIZLI_IKON = ['🧾', '🔢', '💰'];

/**
 * ── KILAVUZ AİLELERE AYRILIYOR ───────────────────────────────────────────
 * 23 bölüm birbirinin aynı beyaz satırı olarak alt alta duruyordu: aradığını
 * bulmak için hepsini okumak gerekiyordu ve kimse okumuyordu. Bölümler işin
 * sırasına göre dört aileye ayrılmış ve her ailenin kendi rengi var.
 *
 * EŞLEŞMEYEN BÖLÜM KAYBOLMUYOR: listede adı geçmeyen her bölüm en sondaki
 * "Diğer" ailesine düşer.
 */
const GRUPLAR = [
  {
    ad: 'grupBaslangic', aciklama: 'grupBaslangicAlt',
    cizgi: 'border-l-amber-400', etiket: 'text-amber-700', nokta: 'bg-amber-400',
    idler: ['musteri', 'goc', 'disa-aktar', 'cihaz'],
  },
  {
    ad: 'grupGunluk', aciklama: 'grupGunlukAlt',
    cizgi: 'border-l-blue-500', etiket: 'text-blue-700', nokta: 'bg-blue-500',
    idler: ['fis', 'sayac', 'cihazdan-sayac', 'sayac-uyarilari', 'portal', 'saha', 'toner'],
  },
  {
    ad: 'grupPara', aciklama: 'grupParaAlt',
    cizgi: 'border-l-emerald-500', etiket: 'text-emerald-700', nokta: 'bg-emerald-500',
    idler: ['fatura', 'e-fatura', 'kdv', 'tahsilat', 'sozlesme', 'karlilik', 'alis', 'teklif'],
  },
  {
    ad: 'grupYonetim', aciklama: 'grupYonetimAlt',
    cizgi: 'border-l-violet-500', etiket: 'text-violet-700', nokta: 'bg-violet-500',
    idler: ['ciktilar', 'patron', 'pazar', 'guvenlik'],
  },
] as const;

const SON_AILE = {
  ad: 'grupDiger', aciklama: 'grupDigerAlt',
  cizgi: 'border-l-gray-300', etiket: 'text-gray-600', nokta: 'bg-gray-400',
  idler: [] as readonly string[],
} as const;

export default function YardimPage() {
  const t = useT();
  const [open, setOpen] = useState<string>('');

  // Aileler kuruluyor; eşleşmeyenler sona düşüyor.
  const yerlesen = new Set<string>(GRUPLAR.flatMap((g) => [...g.idler]));
  const artan = BOLUMLER.filter((b) => !yerlesen.has(b.id));
  const aileler = [
    ...GRUPLAR.map((g) => ({
      ...g,
      bolumler: g.idler.map((id) => BOLUMLER.find((b) => b.id === id)).filter(Boolean) as Bolum[],
    })),
    ...(artan.length ? [{ ...SON_AILE, bolumler: artan }] : []),
  ].filter((g) => g.bolumler.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-16">
      <div className="rounded-2xl bg-gradient-to-br from-[#0f2253] to-blue-600 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.yardim.baslik}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">
          {t.yardim.altOn} <b className="text-white">{t.yardim.altVurgu}</b> {t.yardim.altSon}
        </p>
      </div>

      {/* 2 DAKİKADA SİSTEM (hep açık) */}
      <section className="mt-5 rounded-xl border-2 border-[#0f2253] bg-white p-6">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
          {t.yardim.ozetEtiket}
        </div>

        <h2 className="mt-2 text-lg font-bold text-slate-900">{t.yardim.zincirBaslik}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {t.yardim.zincir.map((ad, i) => (
            <div key={ad} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                <span>{ZINCIR_IKON[i]}</span>
                <span className="text-sm font-bold text-slate-900">{ad}</span>
              </span>
              {i < t.yardim.zincir.length - 1 && <span className="font-bold text-slate-400">&rarr;</span>}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-slate-600">
          {t.yardim.zincirAltOn}{' '}
          <b className="text-slate-900">{t.yardim.zincirAltVurgu}</b>{t.yardim.zincirAltSon}
        </p>

        <h2 className="mt-6 text-lg font-bold text-slate-900">{t.yardim.gunlukBaslik}</h2>
        <div className="mt-2 grid gap-2">
          {t.yardim.hizli.map(([baslik, aciklama], i) => (
            <div key={baslik} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-lg">{HIZLI_IKON[i]}</span>
              <span className="text-[0.95rem] text-slate-900">
                <b>{baslik}</b> <span className="text-slate-500">&mdash; {aciklama}</span>
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-6 text-lg font-bold text-slate-900">{t.yardim.neredeBaslik}</h2>
        <div className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
          {t.yardim.nerede.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <b className="whitespace-nowrap text-[#0f2253]">{k}</b>
              <span className="text-slate-500">&mdash; {v}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/import"
            className="rounded-lg bg-[#0f2253] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#16306e]">
            {t.yardim.verimiAktar}
          </Link>
          <Link href="/customers/new"
            className="rounded-lg border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            {t.yardim.ilkMusteri}
          </Link>
        </div>
      </section>

      {/* AYRINTILI BÖLÜMLER */}
      <div className="mt-8 lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        {/* İÇİNDEKİLER — 23 bölümü kaydırmadan gezmenin tek yolu. */}
        <nav className="hidden lg:block">
          <div className="sticky top-6">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              {t.yardim.icindekiler}
            </div>
            <ul className="mt-3 space-y-3">
              {aileler.map((g) => (
                <li key={g.ad}>
                  <div className={`flex items-center gap-2 text-xs font-bold ${g.etiket}`}>
                    <span className={`h-2 w-2 rounded-full ${g.nokta}`} />
                    {t.yardim[g.ad]}
                  </div>
                  <ul className="mt-1 space-y-0.5 border-l pl-3">
                    {g.bolumler.map((b) => (
                      <li key={b.id}>
                        <a href={`#k-${b.id}`} onClick={() => setOpen(b.id)}
                          className="block truncate py-0.5 text-xs text-slate-500 hover:text-slate-900">
                          {t.yardim.bolum[b.anahtar].baslik.split(/[\u2014(]/)[0].trim()}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          {aileler.map((g) => (
            <section key={g.ad}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className={`text-base font-extrabold ${g.etiket}`}>{t.yardim[g.ad]}</h2>
                <span className="text-sm text-slate-500">{t.yardim[g.aciklama]}</span>
              </div>

              <div className="mt-3 grid gap-2">
                {g.bolumler.map((b) => {
                  const isOpen = open === b.id;
                  const metin = t.yardim.bolum[b.anahtar] as { baslik: string; intro?: string; adimlar: string[]; ipucu?: string };
                  return (
                    <div key={b.id} id={`k-${b.id}`}
                      className={`scroll-mt-6 overflow-hidden rounded-xl border border-l-4 bg-white ${g.cizgi}`}>
                      <button type="button" onClick={() => setOpen(isOpen ? '' : b.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <span className="text-lg">{b.icon}</span>
                        <span className="flex-1 text-[0.95rem] font-bold text-gray-900">{metin.baslik}</span>
                        <span className="text-lg text-gray-400">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="border-t px-4 pb-4">
                          {metin.intro && (
                            <p className="mt-3 max-w-2xl text-[0.93rem] leading-relaxed text-slate-700">{metin.intro}</p>
                          )}
                          <ol className="mt-3 grid list-decimal gap-2 pl-5">
                            {metin.adimlar.map((st, i) => (
                              <li key={i} className="max-w-2xl text-[0.93rem] leading-relaxed text-slate-800">{st}</li>
                            ))}
                          </ol>
                          {metin.ipucu && (
                            <div className="mt-4 max-w-2xl rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-[0.9rem] leading-relaxed text-cyan-900">
                              {metin.ipucu}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-slate-400">
        {t.yardim.altbilgi}
      </p>
    </div>
  );
}
