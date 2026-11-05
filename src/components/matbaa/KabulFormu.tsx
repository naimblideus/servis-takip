'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDil } from '@/lib/i18n/client';
import { matbaaMetni } from '@/lib/matbaa-metin';

/**
 * Tahmini fiyatlı işin kabulü: müşterinin bildirdiği sayfa sayısı dosyadan
 * kontrol edilir, gerekirse düzeltilir. Tutar sunucuda yeniden hesaplanır.
 */
export default function KabulFormu({ id, kalemler }: { id: string; kalemler: { id: string; ozet: string; sayfa: number }[] }) {
  const router = useRouter();
  const { dil } = useDil();
  const m = matbaaMetni(dil);
  const [sayfalar, setSayfalar] = useState<Record<string, string>>(() => Object.fromEntries(kalemler.map((k) => [k.id, String(k.sayfa)])));
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');

  async function kabul() {
    setMesgul(true);
    setHata('');
    const r = await fetch(`/api/matbaa/isler/${id}/kabul`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sayfalar }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-bold text-red-900">{m.kabulBaslik}</h2>
      <p className="mt-1 text-sm text-red-800">{m.tahminiUyari}</p>
      <div className="mt-3 space-y-2">
        {kalemler.map((k) => (
          <label key={k.id} className="flex items-center justify-between gap-3 text-sm text-gray-800">
            <span className="min-w-0">{k.ozet}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-600">
              {m.sayfa}
              <input type="number" min={1} inputMode="numeric" value={sayfalar[k.id] ?? ''} onChange={(e) => setSayfalar((s) => ({ ...s, [k.id]: e.target.value }))}
                className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" />
            </span>
          </label>
        ))}
      </div>
      <button type="button" onClick={kabul} disabled={mesgul} className="mt-3 rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{m.adim.SIRADA}</button>
      {hata && <p role="alert" className="mt-1 text-xs text-red-700">{hata}</p>}
    </section>
  );
}
