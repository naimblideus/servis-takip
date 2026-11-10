'use client';

import { useState } from 'react';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';

/**
 * PROVA YANITI — iki düğme. "Onaylıyorum" tek dokunuş; "Düzeltme istiyorum"
 * ne istendiğini sorar (not zorunlu: notsuz düzeltme isteği matbaaya bir tur
 * daha WhatsApp yazdırır). Yanıt bir kez verilir; sonra yalnız sonuç görünür.
 */
export default function ProvaYaniti({ kisaAd, jeton, dil }: { kisaAd: string; jeton: string; dil: string }) {
  const m = musteriMetni(dil);
  const [duzeltme, setDuzeltme] = useState(false);
  const [not, setNot] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [sonuc, setSonuc] = useState<'ONAYLANDI' | 'DUZELTME' | null>(null);

  async function gonder(karar: 'ONAY' | 'DUZELTME') {
    setMesgul(true);
    setHata('');
    const r = await fetch('/api/b/prova', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kisaAd, jeton, karar, not: karar === 'DUZELTME' ? not : undefined }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    setSonuc(j.durum);
  }

  if (sonuc) {
    return <p className={`rounded-2xl border p-5 font-semibold ${sonuc === 'ONAYLANDI' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white'}`}>{sonuc === 'ONAYLANDI' ? m.provaOnaylandi : m.provaDuzeltmeAlindi}</p>;
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      {!duzeltme ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={mesgul} onClick={() => gonder('ONAY')} className="rounded-xl bg-emerald-600 px-5 py-3 text-base font-bold text-white disabled:opacity-50">{m.provaOnay}</button>
          <button type="button" disabled={mesgul} onClick={() => setDuzeltme(true)} className="rounded-xl border border-slate-300 px-5 py-3 text-base font-semibold disabled:opacity-50">{m.provaDuzeltme}</button>
        </div>
      ) : (
        <div>
          <label htmlFor="pnot" className="mb-1 block text-xs font-semibold text-slate-600">{m.provaNot}</label>
          <textarea id="pnot" value={not} onChange={(e) => setNot(e.target.value)} rows={4} maxLength={1000} autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-[#0f2253] focus:outline-none" />
          <button type="button" disabled={mesgul || not.trim().length < 3} onClick={() => gonder('DUZELTME')} className="mt-2 rounded-xl bg-[#0f2253] px-5 py-3 text-base font-bold text-white disabled:opacity-50">{m.provaGonder}</button>
        </div>
      )}
      {hata && <p role="alert" className="mt-2 text-sm text-red-700">{hata}</p>}
    </section>
  );
}
