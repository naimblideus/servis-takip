'use client';

/**
 * KAÇAN TONER — Kaçan Gelir sayfasının en üstü (lib/kacan-toner.ts).
 *
 * Tarayıcının gördüğü ama bayinin vermediği toner değişimleri. Her satırda
 * iki iş: müşteriye WhatsApp'tan "bundan sonra biz getirelim" yazmak ya da
 * "bizden aldı, kaydı eksikti" deyip satırı düşürmek. Müşteriye giden metin
 * BAYİNİN dilinde ve "toner değiştirdiğinizi gördük" demiyor: müşteri
 * izlendiğini değil, hizmet teklifi aldığını duymalı.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { waUrl, waGecerliMi } from '@/lib/share';

interface Kayit {
  id: string; deviceId: string; cihaz: string; seri: string;
  musteri: { id: string; name: string; phone: string | null } | null;
  tarih: string; not: string | null; tutar: number | null; parca: string | null;
}

export default function KacanToner() {
  const t = useT();
  const k = t.kacanToner;
  const b = useBicim();
  const m = useMusteriDili();
  const { data: session } = useSession();
  const bayi = ((session?.user as any)?.tenantName as string | undefined) ?? '';
  const [veri, setVeri] = useState<{ kayitlar: Kayit[]; adet: number; tutar: number; izlenenCihaz: number } | null>(null);
  const [hata, setHata] = useState('');

  const yukle = useCallback(async () => {
    const r = await fetch('/api/kacan-toner').catch(() => null);
    if (r?.ok) setVeri(await r.json());
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  async function bizden(id: string) {
    setHata('');
    const r = await fetch('/api/kacan-toner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!r.ok) { setHata((await r.json().catch(() => ({}))).error ?? t.ucHata.BULUNAMADI); return; }
    yukle();
  }

  if (!veri) return null;

  // Tarayıcı hiçbir müşteride çalışmıyorsa sayı yok: "0 kaçan" demek "her
  // şey yolunda" demek olurdu — bilmiyoruz. Bunun yerine nasıl görüleceği.
  if (veri.izlenenCihaz === 0) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">{k.baslik}</p>
          <p className="mt-0.5 text-sm text-gray-500">{k.izlenmiyor}</p>
        </div>
        <Link href="/sayac-tarayici" className="btn-secondary text-sm">{k.tarayiciyaGit}</Link>
      </div>
    );
  }

  if (veri.adet === 0) {
    return (
      <div className="card">
        <p className="font-bold text-gray-900">{k.baslik}</p>
        <p className="mt-0.5 text-sm text-gray-500">{doldur(k.yok, { n: veri.izlenenCihaz })}</p>
      </div>
    );
  }

  const mesaj = (x: Kayit) => doldur(m.sz.kacanToner.musteriMesaji, { ad: x.musteri?.name ?? '', cihaz: x.cihaz, bayi });

  return (
    <section className="card border-l-4 border-l-amber-500">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[.72rem] font-bold uppercase tracking-[.08em] text-amber-700">{k.baslik}</p>
          <h2 className="mt-1 text-xl font-extrabold text-gray-900">
            {doldur(k.ozet, { n: veri.adet })}
            {veri.tutar > 0 && <span className="text-amber-700"> · {doldur(k.tutarOzet, { tutar: b.para(veri.tutar) })}</span>}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{doldur(k.aciklama, { n: veri.izlenenCihaz })}</p>
        </div>
      </div>
      {hata && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}
      <ul className="mt-4 divide-y divide-gray-100">
        {veri.kayitlar.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{x.musteri?.name ?? k.musteriYok}</p>
              <p className="text-sm text-gray-500">
                <Link href={`/devices/${x.deviceId}`} className="hover:underline">{x.cihaz}</Link>
                <span className="text-gray-400"> · {x.seri}</span>
                <span className="text-gray-400"> · {b.tarih(x.tarih)}</span>
                {x.not && <span className="text-gray-400"> · {x.not}</span>}
              </p>
              {x.parca && <p className="text-xs text-gray-400">{doldur(k.tahmin, { parca: x.parca })}</p>}
            </div>
            <div className="flex items-center gap-2">
              {x.tutar !== null && <span className="tabular-nums font-bold text-gray-900">{b.para(x.tutar)}</span>}
              {waGecerliMi(x.musteri?.phone) && (
                <a href={waUrl(x.musteri?.phone, mesaj(x))} target="_blank" rel="noopener"
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">{k.whatsapp}</a>
              )}
              <button type="button" onClick={() => bizden(x.id)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">{k.bizden}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
