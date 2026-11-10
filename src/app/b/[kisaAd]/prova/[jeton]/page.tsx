import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { provaVerisi } from '@/lib/baski-prova';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { takipYolu } from '@/lib/matbaa-ayar';
import { doldur } from '@/lib/i18n/sozluk';
import ProvaYaniti from '@/components/matbaa/ProvaYaniti';

/**
 * PROVA ONAYI — /b/<kısa-ad>/prova/<jeton>
 *
 * Müşteri provaya bakar ve iki düğmeden birine basar. Bağlantı süreli ve tek
 * kullanımlık: yanıtlandıktan ya da süresi dolduktan sonra yalnız durumu
 * gösterir. Dosya adresi 5 dakikalık imzalıdır; sayfa her açılışta yenisini üretir.
 */
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true }, title: 'Prova' };
export const dynamic = 'force-dynamic';

export default async function ProvaSayfasi({ params }: { params: Promise<{ kisaAd: string; jeton: string }> }) {
  const { kisaAd, jeton } = await params;
  const v = await provaVerisi(kisaAd, jeton);
  if (!v) notFound();
  const m = musteriMetni(v.dil);
  const kapaliMetin = v.durum === 'ONAYLANDI' ? m.provaOnaylandi : v.durum === 'DUZELTME' ? m.provaDuzeltmeAlindi : m.provaSuresiDoldu;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{m.provaBaslik}</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{v.firma.ad}</h1>
          <p className="mt-1 text-sm text-slate-500">{doldur(m.provaAlt, { no: v.isNo })}</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        {v.dosya && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            {v.dosya.gorsel && (
              // Görsel 5 dakikalık imzalı adresten gelir; boyutu bilinmediği için next/image kullanılamaz.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.dosya.url} alt={v.dosya.ad} className="mx-auto max-h-[70vh] w-auto rounded-lg border border-slate-200" />
            )}
            <a href={v.dosya.url} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{m.provaAc}</a>
            <p className="mt-2 break-all text-xs text-slate-500">{v.dosya.ad}</p>
          </section>
        )}
        {v.yanitlanir
          ? <ProvaYaniti kisaAd={v.kisaAd} jeton={jeton} dil={v.dil} />
          : <p className={`rounded-2xl border p-5 font-semibold ${v.durum === 'ONAYLANDI' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white'}`}>{kapaliMetin}</p>}
        <Link href={takipYolu(v.kisaAd, v.isJeton)} className="inline-block text-sm font-semibold text-[#0f2253] underline">{m.isTakibi}</Link>
      </main>
    </div>
  );
}
