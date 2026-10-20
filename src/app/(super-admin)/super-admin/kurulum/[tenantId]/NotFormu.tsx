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
      <div className="text-sm text-gray-400">{m.yeniNot}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {TURLER.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tur === t}
            onClick={() => setTur(t)}
            className={`min-h-11 rounded-xl border px-4 text-sm ${tur === t ? 'border-violet-400/60 bg-violet-600/30' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
          >
            {m.notTuru[t]}
          </button>
        ))}
      </div>
      <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{m.notUyari}</p>
      <textarea
        value={metin}
        onChange={(e) => setMetin(e.target.value.slice(0, enUzun))}
        maxLength={enUzun}
        rows={3}
        placeholder={m.notYer}
        className="block w-full rounded-xl border border-white/15 bg-gray-900 px-3 py-2 text-sm text-white"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{doldur(m.karakter, { n: metin.length, t: enUzun })}</span>
        <button type="submit" disabled={bekliyor || !metin.trim()} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60">
          {m.notKaydet}
        </button>
      </div>
      {hata && <p className="text-sm text-red-300" role="alert">{hata}</p>}
    </form>
  );
}
