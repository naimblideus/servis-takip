'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Kartın TEK düğmesi: işi bir adım ilerletir (ya da geri alır). Kural
 * sunucuda (lib/baski-is gecisIzinli); reddedilirse sebep düğmenin altında.
 */
export default function IsAdimi({ id, sonra, etiket, ikincil = false }: { id: string; sonra: string; etiket: string; ikincil?: boolean }) {
  const router = useRouter();
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');

  async function bas() {
    setMesgul(true);
    setHata('');
    const r = await fetch(`/api/matbaa/isler/${id}/durum`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ durum: sonra }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? '…'); return; }
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={bas} disabled={mesgul}
        className={ikincil
          ? 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
          : 'rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1a3170] disabled:opacity-50'}>
        {etiket}
      </button>
      {hata && <p role="alert" className="mt-1 text-xs text-red-700">{hata}</p>}
    </div>
  );
}
