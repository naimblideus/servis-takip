'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBicim, useDil } from '@/lib/i18n/client';
import { matbaaMetni } from '@/lib/matbaa-metin';

/**
 * İş ayrıntısında para ve iptal: ödeme al (tutar varsayılan kalan; yol tek
 * dokunuş) ve iptal (neden ile). Kural sunucuda; reddedilirse sebep burada.
 */
export default function IsEylemleri({ id, kalan, odemeAlinir, iptalEdilir }: { id: string; kalan: number; odemeAlinir: boolean; iptalEdilir: boolean }) {
  const router = useRouter();
  const { dil } = useDil();
  const b = useBicim();
  const m = matbaaMetni(dil);
  const [tutar, setTutar] = useState((kalan / 100).toFixed(2));
  const [iptalAcik, setIptalAcik] = useState(false);
  const [neden, setNeden] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');

  async function gonder(yol: string, govde: object) {
    setMesgul(true);
    setHata('');
    const r = await fetch(`/api/matbaa/isler/${id}/${yol}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    setIptalAcik(false);
    router.refresh();
  }

  // Virgül ya da nokta: "125,50" ve "125.50" aynı.
  const kurus = Math.round(Number(tutar.replace(',', '.')) * 100);

  if (!odemeAlinir && !iptalEdilir) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      {odemeAlinir && (
        <div>
          <h2 className="text-sm font-bold text-gray-700">{m.odemeAl}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input aria-label={m.tutar} inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-[15px]" />
            {(['NAKIT', 'KART', 'HAVALE'] as const).map((y) => (
              <button key={y} type="button" disabled={mesgul || !(kurus > 0)} onClick={() => gonder('odeme', { tutar: kurus, yol: y })}
                className="rounded-lg bg-[#0f2253] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{m.yol[y]}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">{m.kalan}: {b.para(kalan / 100)}</p>
        </div>
      )}
      {iptalEdilir && (
        iptalAcik ? (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label={m.iptalNeden} placeholder={m.iptalNeden} value={neden} onChange={(e) => setNeden(e.target.value)} maxLength={500}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" disabled={mesgul} onClick={() => gonder('durum', { durum: 'IPTAL', iptalNedeni: neden })}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{m.iptalEt}</button>
            <button type="button" onClick={() => setIptalAcik(false)} className="text-sm text-gray-500 underline">{m.vazgec}</button>
          </div>
        ) : (
          <button type="button" onClick={() => setIptalAcik(true)} className="text-sm font-semibold text-red-700 hover:underline">{m.iptalEt}</button>
        )
      )}
      {hata && <p role="alert" className="text-sm text-red-700">{hata}</p>}
    </section>
  );
}
