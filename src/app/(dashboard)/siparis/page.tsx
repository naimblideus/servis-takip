'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { waUrl } from '@/lib/share';
import { siparisMetni, tahminiTutar, type SiparisGrubu, type SiparisKalemi } from '@/lib/tedarik-siparisi';

/**
 * ── TEDARİKÇİ SİPARİŞİ ────────────────────────────────────────────────────
 * Asgari stoğun altına düşen ve bayinin gerçekten kullandığı/aldığı
 * kalemler, son alındıkları tedarikçiye göre gruplu. Bayi adetleri düzeltir,
 * sipariş metni tek dokunuşla WhatsApp'a ya da e-postaya gider. Burada kayıt
 * tutulmaz: mal gelince Stok → Alış.
 *
 * Hareketsiz kalemler (90 günde kullanılmamış, hiç alınmamış) ayrı ve
 * kapalı: bayi isterse "Siparişe ekle" ile tedarikçisiz gruba ekler.
 *
 * Tedarikçiye giden metin BAYİNİN dilinde (useMusteriDili).
 */

type Veri = { gruplar: SiparisGrubu[]; hareketsiz: SiparisKalemi[]; kritikSayisi: number; firma: string };

export default function SiparisPage() {
  const t = useT();
  const b = useBicim();
  const disari = useMusteriDili();
  const s = t.siparis;

  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState(false);
  const [adet, setAdet] = useState<Record<string, number>>({});
  const [eklenen, setEklenen] = useState<Set<string>>(new Set());
  const [acil, setAcil] = useState<number | null>(null);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/siparis')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Veri) => {
        setVeri(d);
        setAdet(Object.fromEntries([...d.gruplar.flatMap((g) => g.kalemler), ...d.hareketsiz].map((k) => [k.id, k.oneri])));
      })
      .catch(() => setHata(true));
    // Toner tahmini ayrı ekranda; burada yalnız "bakmaya değer" diye sayısı.
    fetch('/api/toner').then((r) => (r.ok ? r.json() : null)).then((d) => setAcil(d?.urgent ?? null)).catch(() => {});
  }, []);

  // Görünen gruplar: sunucunun grupları + bayinin hareketsizlerden eklediği
  // kalemler (tedarikçisi belli olmayan gruba).
  const gruplar = useMemo(() => {
    if (!veri) return [];
    const ek = veri.hareketsiz.filter((k) => eklenen.has(k.id));
    if (!ek.length) return veri.gruplar;
    const bilinmeyen = veri.gruplar.find((g) => g.tedarikci === null);
    const digerleri = veri.gruplar.filter((g) => g.tedarikci !== null);
    return [...digerleri, { tedarikci: null, kalemler: [...(bilinmeyen?.kalemler ?? []), ...ek], tahminiTutar: null }];
  }, [veri, eklenen]);

  const adetOf = (k: SiparisKalemi) => adet[k.id] ?? k.oneri;
  const metin = (g: SiparisGrubu) => siparisMetni({
    selam: disari.sz.siparis.mesajSelam,
    kapanis: doldur(disari.sz.siparis.mesajKapanis, { firma: veri?.firma ?? '' }),
    adetEki: disari.sz.siparis.adetEki,
    kalemler: g.kalemler.map((k) => ({ ad: k.ad, oemKodu: k.oemKodu, sku: k.sku, adet: adetOf(k) })),
  });

  const kopyala = async (anahtar: string, m: string) => {
    try { await navigator.clipboard.writeText(m); setKopyalanan(anahtar); setTimeout(() => setKopyalanan(null), 2000); } catch { /* izin yoksa sessiz */ }
  };

  const hareketsiz = (veri?.hareketsiz ?? []).filter((k) => !eklenen.has(k.id));

  return (
    <div className="mx-auto max-w-5xl p-6 pb-16">
      <h1 className="text-2xl font-bold text-gray-900">{s.baslik}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">{s.alt}</p>
      <p className="mt-2 max-w-3xl text-xs text-gray-500">{s.nasil}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {acil != null && acil > 0 && (
          <Link href="/sarf" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100">
            {doldur(s.tonerUyari, { n: acil })}
          </Link>
        )}
        <Link href="/inventory/alis" className="rounded-lg border px-3 py-1.5 text-gray-700 hover:bg-gray-50">{s.alisLink}</Link>
      </div>

      {hata && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{s.yuklenemedi}</div>}
      {veri && veri.kritikSayisi === 0 && <p className="mt-6 rounded-xl border bg-white px-5 py-6 text-sm text-gray-600">{s.bos}</p>}
      {veri && veri.kritikSayisi > 0 && gruplar.length === 0 && (
        <p className="mt-6 rounded-xl border bg-white px-5 py-6 text-sm text-gray-600">{s.aktifYok}</p>
      )}

      <div className="mt-4 space-y-4">
        {gruplar.map((g) => {
          const anahtar = g.tedarikci ?? '—';
          const m = metin(g);
          const tutar = tahminiTutar(g.kalemler.map((k) => ({ sonFiyat: k.sonFiyat, adet: adetOf(k) })));
          return (
            <section key={anahtar} className="rounded-xl border bg-white">
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-5 py-3">
                <h2 className="text-base font-semibold text-gray-900">{g.tedarikci ?? s.tedarikciYok}</h2>
                <span className="text-xs text-gray-500">{doldur(s.kalem, { n: g.kalemler.length })}</span>
                <span className="ml-auto text-xs text-gray-600">
                  {tutar != null ? doldur(s.tahmini, { tutar: b.para(tutar) }) : s.tahminiYok}
                </span>
              </header>
              {!g.tedarikci && <p className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-900">{s.tedarikciYokNot}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2">{s.sutunParca}</th>
                      <th className="px-4 py-2 text-right">{s.sutunStok}</th>
                      <th className="px-4 py-2 text-right">{s.sutunKullanim}</th>
                      <th className="px-4 py-2 text-right">{s.sutunFiyat}</th>
                      <th className="px-4 py-2 text-right">{s.sutunAdet}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {g.kalemler.map((k) => (
                      <tr key={k.id}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{k.ad}</div>
                          <div className="font-mono text-xs text-gray-500">{[k.oemKodu, k.sku].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2 text-right ${k.stok <= 0 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{k.stok} / {k.asgari}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-700">{k.kullanim90}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-700">{k.sonFiyat ? b.para(k.sonFiyat) : '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" min={0} value={adetOf(k)}
                            onChange={(e) => setAdet((a) => ({ ...a, [k.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                            className="w-20 rounded border px-2 py-1 text-right text-sm" aria-label={`${k.ad} ${s.sutunAdet}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                <a href={waUrl(null, m)} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{s.whatsapp}</a>
                <a href={`mailto:?subject=${encodeURIComponent(doldur(disari.sz.siparis.konu, { firma: veri?.firma ?? '' }))}&body=${encodeURIComponent(m)}`}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">{s.eposta}</a>
                <button type="button" onClick={() => kopyala(anahtar, m)} className="rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
                  {kopyalanan === anahtar ? s.kopyalandi : s.kopyala}
                </button>
                <span className="ml-auto text-xs text-gray-500">{s.alisNot}</span>
              </footer>
            </section>
          );
        })}
      </div>

      {hareketsiz.length > 0 && (
        <details className="mt-6 rounded-xl border bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-800">
            {doldur(s.hareketsizBaslik, { n: hareketsiz.length })}
          </summary>
          <p className="border-t px-5 py-2 text-xs text-gray-600">{s.hareketsizNot}</p>
          <ul className="max-h-96 divide-y overflow-y-auto border-t text-sm">
            {hareketsiz.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-5 py-2">
                <span className="min-w-0 flex-1 truncate text-gray-800">{k.ad}</span>
                <span className="whitespace-nowrap text-xs text-gray-500">{k.stok} / {k.asgari}</span>
                <button type="button" onClick={() => setEklenen((e) => new Set(e).add(k.id))}
                  className="rounded border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">{s.ekle}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
