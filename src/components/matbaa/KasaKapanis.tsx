'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { liraOku } from '@/lib/baski-fiyat';

/**
 * GÜN SONU — tek kutu, tek düğme: kasadaki nakit sayılır, yazılır. Fark
 * ekranda hemen görünür (yazarken), kayıtta sunucu yeniden hesaplar.
 */
export default function KasaKapanis({ gun, nakit, yeniden }: { gun: string; nakit: number; yeniden?: boolean }) {
  const router = useRouter();
  const { dil } = useDil();
  const b = useBicim();
  const m = matbaaMetni(dil);
  const [sayilan, setSayilan] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const kurus = sayilan.trim() === '0' ? 0 : liraOku(sayilan);
  const yazildi = sayilan.trim() !== '' && (kurus > 0 || sayilan.trim() === '0');
  const fark = kurus - nakit;

  async function kapat(e: React.FormEvent) {
    e.preventDefault();
    if (!yazildi) return;
    setMesgul(true);
    setHata('');
    const r = await fetch('/api/matbaa/kasa/kapanis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gun, sayilan: kurus }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    setSayilan('');
    router.refresh();
  }

  return (
    <form onSubmit={kapat} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <label className="text-xs font-semibold text-gray-600">{m.kapanisSayilan}
        <input inputMode="decimal" value={sayilan} onChange={(e) => setSayilan(e.target.value)} className="mt-1 block w-36 rounded-lg border border-gray-300 px-3 py-2 text-[15px] focus:border-[#0f2253] focus:outline-none" />
      </label>
      <button type="submit" disabled={mesgul || !yazildi} className="rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{yeniden ? m.kapanisYeniden : m.kapanisKapat}</button>
      {yazildi && <span className={`pb-2 text-sm font-semibold ${fark === 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fark === 0 ? m.kapanisTam : doldur(fark > 0 ? m.kapanisFazla : m.kapanisEksik, { tutar: b.para(Math.abs(fark) / 100) })}</span>}
      {hata && <p role="alert" className="w-full text-sm text-red-700">{hata}</p>}
    </form>
  );
}
