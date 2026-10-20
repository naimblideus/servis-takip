'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { doldur } from '@/lib/i18n/sozluk';
import { SORUN_DURUMLARI, SORUN_KUTULARI, waBaglantisi, type SorunDurumu, type SorunKutusu, type SorunTuru } from '@/lib/sorun';
import type { SorunMetni } from '@/lib/sorun-metin';

export interface KartVerisi {
  id: string;
  tenantId: string;
  bayi: string;
  yetkili: string | null;
  telefon: string | null;
  kullaniciAd: string | null;
  rol: string | null;
  tur: string;
  neYapiyordu: string | null;
  neOldu: string;
  sayfa: string | null;
  ekran: string | null;
  tarayici: string | null;
  demo: boolean;
  durum: string;
  kutu: string | null;
  yoneticiNotu: string | null;
  ekranVar: boolean;
  zaman: string;
  tarih: string;
  bildirildi: string | null;
}

const TUR_RENGI: Record<string, string> = {
  DURDURUYOR: 'bg-red-500/20 text-red-200 border-red-400/40',
  YAVASLATIYOR: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  ONERI: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
};

/**
 * Tek bildirimin kartı ve ayıklaması. Tek "Kaydet" düğmesi: kutu, durum,
 * iç not ve "müşteriye bildirildi" birlikte gider; kurallar sunucuda
 * (lib/sorun.ts ayiklamaKur). Görüntü küçük resim olarak TEMBEL yüklenir
 * (loading="lazy"), tıklayınca büyür.
 */
export default function SorunKarti({ k, m, bayiAdresi }: { k: KartVerisi; m: SorunMetni; bayiAdresi: string }) {
  const router = useRouter();
  const [durum, setDurum] = useState(k.durum);
  const [kutu, setKutu] = useState(k.kutu ?? '');
  const [not, setNot] = useState(k.yoneticiNotu ?? '');
  const [bildirildi, setBildirildi] = useState(Boolean(k.bildirildi));
  const [kayit, setKayit] = useState<'' | 'oluyor' | 'tamam' | 'hata'>('');
  const [buyuk, setBuyuk] = useState(false);

  const cozuldu = durum === 'COZULDU';
  const degisti = durum !== k.durum || kutu !== (k.kutu ?? '') || not !== (k.yoneticiNotu ?? '') || bildirildi !== Boolean(k.bildirildi);

  // Hazır mesaj: kişinin ilk adıyla, ne bildirdiğini hatırlatarak. Tek tek gönderilir.
  const ad = (k.kullaniciAd ?? k.yetkili ?? k.bayi).trim().split(/\s+/)[0] ?? '';
  const ozet = k.neOldu.length > 90 ? `${k.neOldu.slice(0, 87)}...` : k.neOldu;
  const wa = waBaglantisi(k.telefon, doldur(m.waMesaj, { ad, tarih: k.tarih, ozet }));
  const goruntuAdresi = `/api/super-admin/sorunlar/${k.id}/ekran`;

  async function kaydet() {
    setKayit('oluyor');
    try {
      const r = await fetch(`/api/super-admin/sorunlar/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum, kutu: kutu || null, yoneticiNotu: not, ...(cozuldu ? { bildirildi } : {}) }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setKayit('tamam');
      router.refresh();
    } catch {
      setKayit('hata');
    }
  }

  return (
    <li className={`rounded-2xl border px-4 py-4 ${k.durum === 'YENI' ? 'border-amber-400/40 bg-amber-500/5' : 'border-white/10 bg-white/5'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/super-admin/kurulum/${k.tenantId}`} className="font-semibold hover:underline">{k.bayi}</Link>
        <Link href={bayiAdresi} className="text-xs text-violet-300 hover:underline" title={m.bayiSuzgeci}>⌕</Link>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${TUR_RENGI[k.tur] ?? 'border-white/10'}`}>{m.tur[k.tur as SorunTuru] ?? k.tur}</span>
        {k.demo && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">{m.demo}</span>}
        <span className="ml-auto text-xs text-gray-400">{k.zaman}</span>
      </div>
      <div className="mt-0.5 text-xs text-gray-400">
        {k.kullaniciAd ?? m.kullaniciYok}
        {k.rol ? ` · ${k.rol}` : ''}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-2">
          {k.neYapiyordu && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.neYapiyordu}</div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{k.neYapiyordu}</p>
            </div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.neOldu}</div>
            <p className="text-sm text-white whitespace-pre-wrap break-words">{k.neOldu}</p>
          </div>
          <dl className="grid gap-x-3 gap-y-0.5 text-xs text-gray-400 sm:grid-cols-[auto_1fr]">
            {k.sayfa && (<><dt className="text-gray-500">{m.sayfa}</dt><dd className="break-all font-mono">{k.sayfa}</dd></>)}
            {k.ekran && (<><dt className="text-gray-500">{m.ekran}</dt><dd className="font-mono">{k.ekran}</dd></>)}
            {k.tarayici && (<><dt className="text-gray-500">{m.tarayici}</dt><dd className="break-all">{k.tarayici}</dd></>)}
          </dl>
          {k.ekranVar && (
            <button type="button" onClick={() => setBuyuk(true)} className="mt-1 block overflow-hidden rounded-lg border border-white/10 hover:border-violet-400/60" title={m.goruntuAc}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={goruntuAdresi} alt={m.goruntu} loading="lazy" className="h-28 w-auto max-w-[220px] object-cover object-top" />
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-400">
              {m.kutuBaslik}
              <select value={kutu} onChange={(e) => setKutu(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-gray-900 px-2 py-2 text-sm text-white">
                <option value="">{m.kutuYok}</option>
                {SORUN_KUTULARI.map((x) => <option key={x} value={x}>{m.kutu[x as SorunKutusu]}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-gray-400">
              {m.durumBaslik}
              <select value={durum} onChange={(e) => setDurum(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-gray-900 px-2 py-2 text-sm text-white">
                {SORUN_DURUMLARI.map((x) => <option key={x} value={x}>{m.durum[x as SorunDurumu]}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-[11px] text-gray-400">
            {m.icNot}
            <textarea value={not} onChange={(e) => setNot(e.target.value)} rows={2} maxLength={2000} placeholder={m.icNotYer}
              className="mt-1 w-full rounded-lg border border-white/10 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-600" />
          </label>
          <label className={`flex items-center gap-2 text-sm ${cozuldu ? 'text-white' : 'text-gray-500'}`} title={cozuldu ? undefined : m.bildirimIcinCoz}>
            <input type="checkbox" checked={cozuldu && bildirildi} disabled={!cozuldu} onChange={(e) => setBildirildi(e.target.checked)} className="h-4 w-4" />
            {m.bildirildi}
            {k.bildirildi && <span className="text-xs text-gray-400">({doldur(m.bildirildiZaman, { t: k.bildirildi })})</span>}
          </label>
          {cozuldu && (
            wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold hover:bg-emerald-500">
                {m.whatsapp}
              </a>
            ) : (
              <p className="text-xs text-gray-500">{m.telefonYok}</p>
            )
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={kaydet} disabled={!degisti || kayit === 'oluyor'}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-40">
              {m.kaydet}
            </button>
            {kayit === 'tamam' && !degisti && <span className="text-xs text-emerald-300">{m.kaydedildi}</span>}
            {kayit === 'hata' && <span className="text-xs text-red-300">{m.hata}</span>}
          </div>
        </div>
      </div>

      {buyuk && (
        <div role="dialog" aria-label={m.goruntu} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setBuyuk(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={goruntuAdresi} alt={m.goruntu} className="max-h-[90vh] max-w-full rounded-lg shadow-2xl" />
          <button type="button" onClick={() => setBuyuk(false)} className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
            {m.kapat}
          </button>
        </div>
      )}
    </li>
  );
}
