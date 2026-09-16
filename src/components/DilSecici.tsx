'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDil, useT } from '@/lib/i18n/client';
import { DILLER, DIL_ADLARI, type Dil } from '@/lib/i18n/sozluk';

/**
 * DİL SEÇİCİ — giriş sayfasında ve panel kenar çubuğunda aynı bileşen.
 *
 * Seçim önce çereze yazılır (sunucu), sonra `router.refresh()` ile sunucu
 * bileşenleri yeniden çalışır ve yeni dil bağlamdan akar. Sayfa yenilenmez,
 * form durumu kaybolmaz.
 *
 * `koyu`: koyu zeminde (kenar çubuğu, giriş) açık renkli düğmeler.
 */
export default function DilSecici({ koyu = true }: { koyu?: boolean }) {
  const { dil } = useDil();
  const t = useT();
  const router = useRouter();
  const [mesgul, setMesgul] = useState(false);

  const sec = async (yeni: Dil) => {
    if (yeni === dil || mesgul) return;
    setMesgul(true);
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dil: yeni }),
      });
      router.refresh();
    } finally {
      setMesgul(false);
    }
  };

  const zemin = koyu ? 'border-white/15 bg-white/[0.04]' : 'border-gray-200 bg-white';
  const pasif = koyu ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900';
  const aktif = koyu ? 'bg-white/15 text-white' : 'bg-gray-900 text-white';

  return (
    <div role="group" aria-label={t.dil.sec}
      className={`inline-flex rounded-lg border p-0.5 text-xs font-semibold ${zemin}`}>
      {DILLER.map((d) => (
        <button key={d} type="button" onClick={() => sec(d)} disabled={mesgul}
          aria-pressed={d === dil} title={DIL_ADLARI[d]}
          className={`rounded-md px-2.5 py-1 uppercase tracking-wide transition ${d === dil ? aktif : pasif}`}>
          {d}
        </button>
      ))}
    </div>
  );
}
