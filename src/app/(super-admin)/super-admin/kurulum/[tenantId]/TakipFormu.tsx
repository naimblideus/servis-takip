'use client';

/**
 * Takip formu: sorumlu (süper admin listesinden) + sonraki temas günü.
 * Metinler sunucudan prop olarak gelir (kurulum-metin.ts); burada cümle yok.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TakipFormu({
  tenantId,
  ekip,
  sorumluId,
  sonrakiTemas,
  m,
}: {
  tenantId: string;
  ekip: { id: string; ad: string }[];
  sorumluId: string | null;
  sonrakiTemas: string;
  m: { sorumlu: string; sorumluYok: string; sonrakiTemas: string; kaydet: string; kaydedildi: string; hata: Record<string, string> };
}) {
  const router = useRouter();
  const [sorumlu, setSorumlu] = useState(sorumluId ?? '');
  const [temas, setTemas] = useState(sonrakiTemas);
  const [durum, setDurum] = useState<{ ok: boolean; metin: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setDurum(null);
    try {
      const r = await fetch(`/api/super-admin/kurulum/${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sorumluId: sorumlu || null, sonrakiTemas: temas || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setDurum({ ok: false, metin: m.hata[d?.hata] ?? m.hata.GENEL });
      else {
        setDurum({ ok: true, metin: m.kaydedildi });
        router.refresh();
      }
    } catch {
      setDurum({ ok: false, metin: m.hata.GENEL });
    } finally {
      setBekliyor(false);
    }
  }

  const alan = 'mt-1 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900';
  return (
    <form onSubmit={kaydet} className="space-y-3">
      <label className="block text-sm">
        <span className="text-gray-500">{m.sorumlu}</span>
        <select value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} className={alan}>
          <option value="">{m.sorumluYok}</option>
          {ekip.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-gray-500">{m.sonrakiTemas}</span>
        <input type="date" value={temas} onChange={(e) => setTemas(e.target.value)} className={alan} />
      </label>
      <button type="submit" disabled={bekliyor} className="min-h-11 w-full rounded-xl bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
        {m.kaydet}
      </button>
      {durum && <p className={`text-sm ${durum.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{durum.metin}</p>}
    </form>
  );
}
