'use client';

/**
 * PARÇA ÖMRÜ — "hangi makinenin drumu, fırını, bakım kiti bitiyor".
 *
 * Tepede TEK sayı: önümüzdeki 30 günde ömrü dolan parça. Altında liste en
 * acilden: müşteri, cihaz, parça, kalan, tahmini gün ve kaynak ("Cihaz
 * bildirdi" / "Sayaçtan"); her satırdan fiş tek dokunuşla açılır. En altta
 * stok ihtiyacı: ömrü dolacak parçalar için hangi karttan kaç adet gerekiyor.
 *
 * Hesap lib/parca-omru.ts'te; ekran yalnız çizer. Para yok — teknisyen de
 * görüyor; "Sipariş et" yalnız yöneticiye (tedarikçi siparişi ona kilitli).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import ParcaOmruSatiri from '@/components/ParcaOmruSatiri';
import type { OmurOzeti, OmurSatiri, StokKalemi } from '@/lib/parca-omru';

interface Veri {
  ozet: OmurOzeti;
  satirlar: OmurSatiri[];
  toplamSatir: number;
  stok: { kalemler: StokKalemi[]; kartsiz: { ad: string; adet: number }[] };
  omurluKart: number;
  olcumluCihaz: number;
  esikler: { kritik: number; yakinda: number; ufuk: number; eskiOlcum: number; hizPenceresi: number };
  yonetici: boolean;
}

export default function ParcaOmruPage() {
  const t = useT();
  const b = useBicim();
  const p = t.parcaOmru;
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState(false);
  const [tumu, setTumu] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback((hepsi: boolean) => {
    setYukleniyor(true);
    fetch(`/api/parca-omru${hepsi ? '?tumu=1' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Veri) => { setVeri(d); setHata(false); })
      .catch(() => setHata(true))
      .finally(() => setYukleniyor(false));
  }, []);
  useEffect(() => { yukle(tumu); }, [yukle, tumu]);

  const e = veri?.esikler;
  const ufuk = e?.ufuk ?? 30;

  return (
    <div style={{ padding: '1.25rem 1rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="text-2xl font-extrabold text-gray-900">{p.baslik}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">{p.alt}</p>

      {yukleniyor && !veri && <p className="mt-6 text-gray-500">{t.genel.yukleniyor}</p>}
      {hata && <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{p.hata}</p>}

      {veri && veri.ozet.satir === 0 && (
        // ── BOŞ: ne işe yaradığı + verinin nereden geleceği ──────────────
        <section className="card mt-5">
          <h2 className="text-lg font-bold text-gray-900">{p.bosBaslik}</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{p.bosAlt}</p>
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(15rem,1fr))' }}>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="font-semibold text-gray-900">{p.bosYol1Baslik}</p>
              <p className="mt-1 text-sm text-gray-500">{p.bosYol1}</p>
              {veri.yonetici && <Link href="/sayac-tarayici" className="btn-secondary mt-3" style={{ minHeight: 44 }}>{p.bosYol1Link}</Link>}
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="font-semibold text-gray-900">{p.bosYol2Baslik}</p>
              <p className="mt-1 text-sm text-gray-500">{p.bosYol2}</p>
              <Link href="/inventory" className="btn-secondary mt-3" style={{ minHeight: 44 }}>{p.bosYol2Link}</Link>
            </div>
          </div>
        </section>
      )}

      {veri && veri.ozet.satir > 0 && (
        <>
          {/* ── TEPEDE TEK SAYI ─────────────────────────────────────────── */}
          <section className="card mt-5" style={{ borderLeft: `4px solid ${veri.ozet.ufukta ? '#D64545' : '#0E9F6E'}` }}>
            {veri.ozet.ufukta > 0 ? (
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-extrabold tabular-nums" style={{ color: '#0F2253' }}>{b.sayi(veri.ozet.ufukta)}</span>
                <span className="text-lg font-bold text-gray-900">{doldur(p.ozetEtiket, { n: veri.ozet.ufukta, gun: ufuk })}</span>
              </p>
            ) : (
              <p className="text-lg font-bold text-gray-900">{doldur(p.ozetSifir, { gun: ufuk })}</p>
            )}
            {(veri.ozet.doldu > 0 || veri.ozet.ufuktaGunsuz > 0) && (
              <p className="mt-1 text-sm text-gray-600">
                {[
                  veri.ozet.doldu > 0 ? doldur(p.ozetDoldu, { n: veri.ozet.doldu }) : null,
                  veri.ozet.ufuktaGunsuz > 0 ? doldur(p.ozetGunsuz, { k: veri.ozet.ufuktaGunsuz, esik: b.yuzde(e?.kritik ?? 10) }) : null,
                ].filter(Boolean).join(' ')}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              {doldur(p.izlenen, { n: veri.ozet.satir, c: veri.ozet.cihazdan, s: veri.ozet.sayactan })}
            </p>
          </section>

          {/* ── LİSTE (en acil önce) ────────────────────────────────────── */}
          <section className="card mt-4" style={{ padding: '0.25rem 1rem' }}>
            <ul className="divide-y divide-gray-100">
              {veri.satirlar.map((s) => <ParcaOmruSatiri key={s.anahtar} s={s} t={t} b={b} />)}
            </ul>
            {veri.toplamSatir > veri.satirlar.length && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-3">
                <span className="text-xs text-gray-500">{doldur(p.ilkGosteriliyor, { n: veri.satirlar.length, toplam: veri.toplamSatir })}</span>
                <button type="button" onClick={() => setTumu(true)} disabled={yukleniyor} className="btn-secondary" style={{ minHeight: 44 }}>
                  {doldur(p.tumunuGoster, { n: veri.toplamSatir })}
                </button>
              </div>
            )}
          </section>

          {/* ── STOK İHTİYACI ───────────────────────────────────────────── */}
          <section className="card mt-4">
            <h2 className="text-base font-bold text-gray-900">{doldur(p.stokBaslik, { gun: ufuk })}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{p.stokAlt}</p>
            {veri.stok.kalemler.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">{doldur(p.stokBos, { gun: ufuk })}</p>
            ) : (
              <div className="mt-3" style={{ overflowX: 'auto' }}>
                <table className="w-full text-sm" style={{ minWidth: '30rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="text-left text-xs text-gray-500" style={{ borderBottom: '1px solid #E4E9F1' }}>
                      <th className="py-2 pr-3">{p.sutunParca}</th>
                      <th className="py-2 pr-3 text-right">{p.sutunGereken}</th>
                      <th className="py-2 pr-3 text-right">{p.sutunStok}</th>
                      <th className="py-2 pr-3 text-right">{p.sutunEksik}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {veri.stok.kalemler.map((k) => (
                      <tr key={k.partId} style={{ borderBottom: '1px solid #F1F4F9' }}>
                        <td className="py-2 pr-3 font-medium text-gray-900">{k.ad}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.sayi(k.gereken)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.sayi(k.stok)}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums" style={{ color: k.eksik > 0 ? '#B93333' : '#096847' }}>
                          {k.eksik > 0 ? b.sayi(k.eksik) : p.stokYeterli}
                        </td>
                        <td className="py-2 text-right">
                          {k.eksik > 0 && veri.yonetici && (
                            <Link href="/siparis" className="btn-primary" style={{ minHeight: 44 }}>{p.siparisEt}</Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {veri.stok.kartsiz.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{p.kartsizBaslik}</p>
                <p className="mt-0.5 text-xs text-gray-500">{p.kartsizAlt}</p>
                <ul className="mt-2 text-sm text-gray-700">
                  {veri.stok.kartsiz.map((k) => <li key={k.ad}>{doldur(p.kartsizSatir, { ad: k.ad || p.adsizParca, n: k.adet })}</li>)}
                </ul>
              </div>
            )}
          </section>

          {/* ── NASIL HESAPLANIYOR ──────────────────────────────────────── */}
          <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-900">{p.notBaslik}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
              <li>{p.not1}</li>
              <li>{p.not2}</li>
              <li>{doldur(p.not3, { n: e?.hizPenceresi ?? 90 })}</li>
              <li>{doldur(p.not4, { k: b.yuzde(e?.kritik ?? 10), y: b.yuzde(e?.yakinda ?? 20), gun: ufuk })}</li>
              <li>{doldur(p.not5, { k: b.yuzde(e?.kritik ?? 10), gun: ufuk })}</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
