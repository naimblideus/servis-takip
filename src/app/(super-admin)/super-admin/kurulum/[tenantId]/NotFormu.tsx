'use client';

/**
 * Yeni not: tür (arama / ziyaret / not) + en çok 1000 karakter. Yazan adı
 * sunucuda oturumdan konur; istemci gönderemez. Uyarı formun hemen üstünde:
 * notları bütün ekip görür, şifre ya da kart bilgisi yazılmaz.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doldur } from '@/lib/i18n/sozluk';

type Tur = 'ARAMA' | 'ZIYARET' | 'NOT';
const TURLER: Tur[] = ['ARAMA', 'ZIYARET', 'NOT'];

export default function NotFormu({
  tenantId,
  enUzun,
  m,
}: {
  tenantId: string;
  enUzun: number;
  m: {
    yeniNot: string;
    notTuru: Record<Tur, string>;
    notYer: string;
    notUyari: string;
    notKaydet: string;
    karakter: string;
    hata: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [tur, setTur] = useState<Tur>('ARAMA');
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    try {
      const r = await fetch(`/api/super-admin/kurulum/${encodeURIComponent(tenantId)}/not`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tur, metin }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setHata(m.hata[d?.hata] ?? m.hata.GENEL);
      else {
        setMetin('');
        router.refresh();
      }
    } catch {
      setHata(m.hata.GENEL);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form onSubmit={kaydet} className="space-y-2">
      <div className="text-sm text-gray-500">{m.yeniNot}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {TURLER.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tur === t}
            onClick={() => setTur(t)}
            className={`min-h-11 rounded-xl border px-4 text-sm ${tur === t ? 'border-blue-300 bg-blue-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
          >
            {m.notTuru[t]}
          </button>
        ))}
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{m.notUyari}</p>
      <textarea
        value={metin}
        onChange={(e) => setMetin(e.target.value.slice(0, enUzun))}
        maxLength={enUzun}
        rows={3}
        placeholder={m.notYer}
        className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{doldur(m.karakter, { n: metin.length, t: enUzun })}</span>
        <button type="submit" disabled={bekliyor || !metin.trim()} className="min-h-11 rounded-xl bg-blue-600 text-white px-4 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
          {m.notKaydet}
        </button>
      </div>
      {hata && <p className="text-sm text-red-700" role="alert">{hata}</p>}
    </form>
  );
}
