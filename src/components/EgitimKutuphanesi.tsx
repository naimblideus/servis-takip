'use client';

import { useEffect, useState } from 'react';
import { useDil, useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import EgitimVideosu, { dosyaVarMi } from '@/components/EgitimVideosu';
import {
  EGITIM_ACIK_GUN, EGITIM_DOSYALARI, EGITIM_VIDEOLARI, type EgitimDosyasi, type EgitimKodu,
} from '@/lib/egitim-videolari';

/**
 * YARDIM'DAKİ VİDEO LİSTESİ — haritadaki bütün klipler, videoya göre gruplu.
 *
 * Sayfalardaki "▶ 1 dk" düğmeleri kişinin ilk 45 gününde görünür; sonra
 * unutulan adımın videosu buradan açılır. Bu yüzden liste haritanın
 * KENDİSİNDEN kurulur: yeni klip eklenince burada kendiliğinden çıkar,
 * hiçbir klip ulaşılamaz kalmaz.
 *
 * Dosyası olmayan grup çizilmez; arayüz videonun dilinde değilse kutu hiç çıkmaz.
 */
const GRUPLAR = Object.keys(EGITIM_DOSYALARI) as EgitimDosyasi[];
const klipleri = (d: EgitimDosyasi) =>
  (Object.keys(EGITIM_VIDEOLARI) as EgitimKodu[]).filter((k) => EGITIM_VIDEOLARI[k].dosya === d);

export default function EgitimKutuphanesi({ className }: { className?: string }) {
  const t = useT();
  const { dil } = useDil();
  const [olanlar, setOlanlar] = useState<EgitimDosyasi[]>([]);

  useEffect(() => {
    let iptal = false;
    const adaylar = GRUPLAR.filter((d) => EGITIM_DOSYALARI[d].dil === dil);
    Promise.all(adaylar.map((d) => dosyaVarMi(EGITIM_DOSYALARI[d].yol))).then((ok) => {
      if (!iptal) setOlanlar(adaylar.filter((_, i) => ok[i]));
    });
    return () => { iptal = true; };
  }, [dil]);

  if (!olanlar.length) return null;

  const k = t.egitim.kutuphane;
  return (
    <section id="egitim-videolari" className={`scroll-mt-6 rounded-xl border bg-white p-5 ${className ?? ''}`}>
      <h2 className="text-base font-bold text-slate-900">{k.baslik}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{doldur(k.alt, { gun: EGITIM_ACIK_GUN })}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {olanlar.map((d) => (
          <div key={d}>
            <h3 className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{k.grup[d]}</h3>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              {klipleri(d).map((kod) => <EgitimVideosu key={kod} kod={kod} herZaman baslikli />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
