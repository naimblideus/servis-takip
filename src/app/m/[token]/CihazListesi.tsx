'use client';

import { useMemo, useState } from 'react';
import TalepFormu from './TalepFormu';
import { sozluk, doldur, type Dil } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';

/**
 * Müşterinin cihaz listesi.
 *
 * NEDEN ARAMA VAR: gerçek veride tek bir müşteride 130+ cihaz olabiliyor
 * (hastane, kamu binası). Böyle bir listede müşteri kendi katındaki yazıcıyı
 * kaydırarak arayamaz. Az cihazlı müşteride kutu hiç görünmez — olmayan
 * sorunu çözen bir arayüz göstermeyiz.
 */

interface Cihaz {
  id: string; ad: string; seri: string; yer: string | null;
  kiralik: boolean; sayacBlack: number | null; sayacColor: number | null;
  sayacTarih: string | null;
  sayacKaynak: string | null;
}

/**
 * Müşteriye gösterilen kaynak cümlesi. YALNIZ itiraz edilemez kaynaklar
 * yazılır: cihazın kendi raporu, fotoğraf, müşterinin kendi girişi. Bayinin
 * elle yazdığı sayaç için cümle YOK — "bayi elle girdi" yazmak müşteriyi
 * itiraza davet eder; yalan da söylenmez, sadece susulur.
 */

const ARAMA_ESIGI = 12;
const ILK_GOSTERIM = 25;

/** Türkçe'ye duyarlı karşılaştırma: "İSTANBUL" ile "istanbul" eşleşsin. */
const kucult = (s: string) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

export default function CihazListesi({ token, cihazlar, dil = 'tr' }: { token: string; cihazlar: Cihaz[]; dil?: Dil }) {
  const sz = sozluk(dil).portal;
  const b = bicimYap(dil);
  const [q, setQ] = useState('');
  const [hepsi, setHepsi] = useState(false);

  const suzulmus = useMemo(() => {
    const a = kucult(q.trim());
    if (!a) return cihazlar;
    return cihazlar.filter((c) =>
      kucult(`${c.ad} ${c.seri} ${c.yer ?? ''}`).includes(a));
  }, [q, cihazlar]);

  const gosterilen = hepsi || q ? suzulmus : suzulmus.slice(0, ILK_GOSTERIM);
  const gizli = suzulmus.length - gosterilen.length;

  return (
    <>
      {cihazlar.length >= ARAMA_ESIGI && (
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={sz.cihazAraYer}
          className="mb-2.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
        />
      )}

      {suzulmus.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {sz.aramaSonucYok}
        </div>
      ) : (
        <div className="space-y-2.5">
          {gosterilen.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold">{c.ad}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {c.yer ? `${c.yer} · ` : ''}{doldur(sz.seri, { n: c.seri })}
              </div>
              {c.sayacBlack != null && (
                <div className="mt-2 text-xs text-slate-600">
                  <div className="flex gap-4">
                    <span>{sz.sbSayac} <b className="tabular-nums">{b.sayi(c.sayacBlack)}</b></span>
                    {c.sayacColor != null && <span>{sz.renkliSayac} <b className="tabular-nums">{b.sayi(c.sayacColor)}</b></span>}
                  </div>
                  {/* Tarih olmadan sayaç yanıltıcı: müşteri onu "şu anki" sanır. */}
                  {c.sayacTarih && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {doldur(sz.okunduTarih, { tarih: b.tarih(c.sayacTarih) })}
                      {c.sayacKaynak && (sz.kaynak as Record<string, string>)[c.sayacKaynak] && (
                        <span className="text-emerald-700"> · {(sz.kaynak as Record<string, string>)[c.sayacKaynak]}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <TalepFormu token={token} cihazId={c.id} cihazAd={c.ad} kiralik={c.kiralik} dil={dil} />
            </div>
          ))}
        </div>
      )}

      {gizli > 0 && (
        <button type="button" onClick={() => setHepsi(true)}
          className="mt-2.5 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400">
          {doldur(sz.dahaGoster, { n: gizli })}
        </button>
      )}
    </>
  );
}
