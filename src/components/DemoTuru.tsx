'use client';

/**
 * DEMO TURU — herkese açık demoda panelin en üstü.
 *
 * Demoyu açan bayi çoğu zaman telefonda, yalnız ve iki dakikası var (bir
 * etkinlik salonunda QR okutmuş). Kurulum rehberi ona yanlış soruyu soruyor
 * ("müşterinizi ekleyin"): veriler zaten hazır, o değeri görmeye geldi.
 * Bu kart onu doğrudan para kazandıran dört ekrana götürür; her düğmenin
 * altında o ekranın tek cümlelik vaadi var. Yalnız demo bayisinde çizilir.
 */
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

export default function DemoTuru({ ariza, toner }: { ariza: number; toner: number }) {
  const t = useT();
  const k = t.demoTuru;
  const duraklar = [
    { href: '/sayac-tarayici#durum', ikon: '📡', baslik: k.tarayiciBaslik, alt: ariza > 0 ? doldur(k.tarayiciSayi, { n: ariza }) : k.tarayiciAlt },
    { href: '/sarf', ikon: '🧴', baslik: k.sarfBaslik, alt: toner > 0 ? doldur(k.sarfSayi, { n: toner }) : k.sarfAlt },
    { href: '/kacan-gelir', ikon: '💸', baslik: k.kacanBaslik, alt: k.kacanAlt },
    { href: '/cihaz-karlilik', ikon: '📉', baslik: k.karBaslik, alt: k.karAlt },
  ];
  return (
    <section className="rounded-2xl border border-[#1D3E7E]/15 bg-[#EEF2FA] p-4 sm:p-5">
      <p className="text-[10.5px] font-bold uppercase tracking-[.16em] text-[#1D3E7E]/70">{k.ust}</p>
      <h2 className="mt-1 text-[1.15rem] font-extrabold tracking-[-.015em] text-gray-900">{k.baslik}</h2>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {duraklar.map((d, i) => (
          <Link key={d.href} href={d.href}
            className="flex items-start gap-3 rounded-xl border border-white bg-white p-3.5 shadow-[0_1px_2px_rgba(11,21,51,.05)] transition hover:shadow-[0_6px_16px_-6px_rgba(11,21,51,.18)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FA] text-lg">{d.ikon}</span>
            <span className="min-w-0">
              <span className="block text-[.9rem] font-bold text-gray-900">{i + 1}. {d.baslik}</span>
              <span className="mt-0.5 block text-[.8rem] leading-snug text-gray-500">{d.alt}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[.8rem] text-gray-500">{k.not}</p>
        <a href="/kayit" className="rounded-lg bg-[#1D3E7E] px-3.5 py-2 text-[.82rem] font-bold text-white transition hover:bg-[#16326a]">{k.kayit}</a>
      </div>
    </section>
  );
}
