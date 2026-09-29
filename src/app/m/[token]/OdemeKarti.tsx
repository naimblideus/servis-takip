'use client';

/**
 * "Nasıl ödenir" kartı — müşteri panelinde bakiyenin hemen altında.
 *
 * Metinler sunucudan (bayinin dilinde) hazır gelir; bu bileşen yalnız
 * kopyalama düğmelerinin davranışını taşır. Kopyalama önemli: IBAN elle
 * yazılınca tek hane kaçar ve havale geri döner.
 */
import { useState } from 'react';

interface Props {
  iban: string | null;
  hesapAdi: string | null;
  link: string | null;
  aciklama: string;
  metin: {
    baslik: string; iban: string; hesapAdi: string; aciklama: string;
    kopyala: string; kopyalandi: string; kartlaOde: string; kartlaOdeNot: string; havaleNot: string;
  };
}

function Satir({ etiket, deger, kopyala, kopyalandi, esnek }: { etiket: string; deger: string; kopyala: string; kopyalandi: string; esnek?: boolean }) {
  const [tamam, setTamam] = useState(false);
  const kopya = async () => {
    try {
      // Kopyalanan değerde boşluk yok: bankaların çoğu IBAN alanına
      // boşluklu yapıştırmayı kabul etmiyor.
      await navigator.clipboard.writeText(esnek ? deger : deger.replace(/\s/g, ''));
      setTamam(true);
      setTimeout(() => setTamam(false), 1800);
    } catch { /* pano izni yok: kullanıcı elle seçer */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{etiket}</div>
        <div className="mt-0.5 break-all font-mono text-sm text-slate-900 select-all">{deger}</div>
      </div>
      <button type="button" onClick={kopya}
        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        {tamam ? kopyalandi : kopyala}
      </button>
    </div>
  );
}

export default function OdemeKarti({ iban, hesapAdi, link, aciklama, metin }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700">{metin.baslik}</h2>
      {iban && (
        <div className="mt-2 divide-y divide-slate-100">
          <Satir etiket={metin.iban} deger={iban} kopyala={metin.kopyala} kopyalandi={metin.kopyalandi} />
          {hesapAdi && <Satir etiket={metin.hesapAdi} deger={hesapAdi} kopyala={metin.kopyala} kopyalandi={metin.kopyalandi} esnek />}
          <Satir etiket={metin.aciklama} deger={aciklama} kopyala={metin.kopyala} kopyalandi={metin.kopyalandi} esnek />
          <p className="pt-2 text-xs leading-relaxed text-slate-500">{metin.havaleNot}</p>
        </div>
      )}
      {link && (
        <div className={iban ? 'mt-4' : 'mt-3'}>
          <a href={link} target="_blank" rel="noopener noreferrer nofollow"
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
            {metin.kartlaOde}
          </a>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{metin.kartlaOdeNot}</p>
        </div>
      )}
    </section>
  );
}
