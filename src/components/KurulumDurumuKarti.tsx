'use client';

/**
 * KURULUM DURUMU — panelde, yalnız yöneticiye, "Hazır" olana kadar küçük kart:
 * "Kurulum 3/5 · Sıradaki: …" ve o adımın sayfasına tek bağlantı.
 *
 * KurulumKarti ("kurulumu birlikte yapalım", Pantum) ile ÇAKIŞMAZ: o kart
 * henüz hiç müşteri yokken çıkar ve üç yol gösterir; bu kart ilk müşteri
 * girildikten SONRA devralır. İkisi aynı anda görünmez — boş panelde iki
 * kurulum kartı kalabalık eder, dolu panelde büyük kart gereksiz yer kaplar.
 * Adımlar elle işaretlenmez; /api/kurulum veriden sayar.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

type Kod = 'FIRMA' | 'CIHAZ' | 'FIYAT' | 'SAYAC' | 'FATURA';
interface Durum {
  goster: boolean;
  tamam: number;
  toplam: number;
  musteri: number;
  sonraki: { kod: Kod; yol: string } | null;
}

export default function KurulumDurumuKarti() {
  const t = useT();
  const k = t.kurulumDurumu;
  const { data: session } = useSession();
  const u = session?.user as { role?: string; demo?: boolean } | undefined;
  const yonetici = u?.role === 'ADMIN' || u?.role === 'SUPER_ADMIN';
  const [d, setD] = useState<Durum | null>(null);

  useEffect(() => {
    if (!yonetici || u?.demo) return;
    fetch('/api/kurulum')
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => setD(x))
      .catch(() => {});
  }, [yonetici, u?.demo]);

  // Müşteri yokken büyük kurulum kartı (KurulumKarti) zaten görünüyor.
  if (!d?.goster || d.musteri === 0 || !d.sonraki) return null;
  const kalan = d.toplam - d.tamam;
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3">
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-gray-900">{doldur(k.baslik, { n: d.tamam, t: d.toplam })}</b>
          <span className="text-xs text-gray-500">{doldur(k.kalan, { n: kalan })}</span>
        </div>
        <div className="mt-1 flex items-center gap-1" aria-hidden>
          {Array.from({ length: d.toplam }, (_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i < d.tamam ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          ))}
        </div>
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-semibold">{k.sirada}</span> {k.adim[d.sonraki.kod]}
        </p>
        <p className="text-xs text-gray-500">{k.alt}</p>
      </div>
      <Link
        href={d.sonraki.yol}
        className="inline-flex min-h-11 items-center rounded-lg bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-700"
      >
        {k.ac}
      </Link>
    </section>
  );
}
