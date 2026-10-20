'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { distributorMetni } from '@/lib/distributor-metin';
import { BASLIK_EN_UZUN, METIN_EN_UZUN } from '@/lib/distributor';
import type { DuyuruSatiri } from '@/lib/distributor-veri';

/**
 * Duyuru yaz / sil. Marka oturumdan gelir; `marka` yalnız sahip görünümünde
 * (sahip başka markayı seçtiyse) adrese eklenir — distribütörde sunucu onu
 * zaten yok sayar. Hatalar kod olarak gelir, cümle burada kurulur.
 */
const girdi = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white placeholder-gray-500 focus:border-violet-400 focus:outline-none';

export default function DuyuruFormu({ marka, duyurular }: { marka: string | null; duyurular: DuyuruSatiri[] }) {
  const { dil } = useDil();
  const m = distributorMetni(dil).duyuru;
  const router = useRouter();
  const [f, setF] = useState({ baslik: '', metin: '', baglanti: '', bitis: '' });
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const q = marka ? `?marka=${encodeURIComponent(marka)}` : '';
  const yerel = dil === 'en' ? 'en-GB' : 'tr-TR';

  const hata = (kod: unknown) => m.hata[String(kod)] ?? m.hata.GENEL;

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setMesgul(true); setMesaj(null);
    const r = await fetch(`/api/super-admin/distributor/duyuru${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baslik: f.baslik, metin: f.metin, baglanti: f.baglanti || null, bitis: f.bitis || null }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setMesaj({ ok: false, metin: hata(j.hata) }); return; }
    setF({ baslik: '', metin: '', baglanti: '', bitis: '' });
    setMesaj({ ok: true, metin: m.yayinlandi });
    router.refresh();
  };

  const sil = async (id: string) => {
    if (!window.confirm(m.silOnay)) return;
    setMesgul(true); setMesaj(null);
    const sep = q ? '&' : '?';
    const r = await fetch(`/api/super-admin/distributor/duyuru${q}${sep}id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setMesaj({ ok: false, metin: hata(j.hata) }); return; }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={gonder} className="space-y-3">
        <label className="block text-sm text-gray-300">
          <span className="mb-1 flex justify-between"><span>{m.baslikEtiket}</span><span className="text-xs text-gray-500">{doldur(m.karakter, { n: f.baslik.length, m: BASLIK_EN_UZUN })}</span></span>
          <input value={f.baslik} maxLength={BASLIK_EN_UZUN} required onChange={(e) => setF({ ...f, baslik: e.target.value })} className={girdi} />
        </label>
        <label className="block text-sm text-gray-300">
          <span className="mb-1 flex justify-between"><span>{m.metinEtiket}</span><span className="text-xs text-gray-500">{doldur(m.karakter, { n: f.metin.length, m: METIN_EN_UZUN })}</span></span>
          <textarea value={f.metin} maxLength={METIN_EN_UZUN} required rows={4} onChange={(e) => setF({ ...f, metin: e.target.value })} className={girdi} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block">{m.baglantiEtiket}</span>
            <input type="url" inputMode="url" value={f.baglanti} maxLength={500} placeholder="https://" onChange={(e) => setF({ ...f, baglanti: e.target.value })} className={girdi} />
          </label>
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block">{m.bitisEtiket}</span>
            <input type="date" value={f.bitis} onChange={(e) => setF({ ...f, bitis: e.target.value })} className={`${girdi} min-h-11`} />
          </label>
        </div>
        <button type="submit" disabled={mesgul} className="min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
          {mesgul ? m.gonderiliyor : m.gonder}
        </button>
        {mesaj && <p role={mesaj.ok ? 'status' : 'alert'} className={`text-sm ${mesaj.ok ? 'text-emerald-300' : 'text-red-300'}`}>{mesaj.metin}</p>}
      </form>

      {duyurular.length === 0 ? (
        <p className="text-sm text-gray-400">{m.bos}</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
          {duyurular.map((d) => (
            <li key={d.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <b className="break-words text-white">{d.baslik}</b>
                  <span className={`text-xs ${d.aktif ? 'text-emerald-300' : 'text-gray-500'}`}>{d.aktif ? m.yayinda : m.suresiDoldu}</span>
                  {d.bitis && <span className="text-xs text-gray-500">{doldur(m.bitis, { t: new Date(d.bitis).toLocaleDateString(yerel) })}</span>}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-300">{d.metin}</p>
                {d.baglanti && <p className="mt-1 break-all text-xs text-sky-300">{d.baglanti}</p>}
                <p className="mt-1 text-xs text-gray-500">{d.kurumAd} · {new Date(d.createdAt).toLocaleString(yerel, { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
              <button type="button" disabled={mesgul} onClick={() => sil(d.id)} className="min-h-11 rounded-lg px-3 text-sm text-red-300 hover:bg-red-500/10">{m.sil}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
