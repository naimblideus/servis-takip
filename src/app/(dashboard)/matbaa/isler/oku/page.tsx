import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz } from '@/lib/matbaa-bicim';
import { OKUYUCU_KAPATMA, enCokDuzeltilen, kayitliOkuma, okumaOrani, taslakGorunumu } from '@/lib/baski-okuyucu';
import { okuyucuAcik } from '@/lib/belge-okuyucu';
import { bekleyenTaslaklar, fiyatliUrunler, okumaSayilari } from '@/lib/baski-okuyucu-kayit';
import OkuyucuEkrani from '@/components/matbaa/OkuyucuEkrani';

export const dynamic = 'force-dynamic';

/**
 * SİPARİŞİ OKU — WhatsApp'tan gelen sipariş → iş taslağı → onay.
 * Altta onay bekleyen taslaklar ve okuyucunun ölçüsü: son 30 günde okunan
 * siparişlerin kaçı hiç düzeltilmeden onaylandı, en çok ne düzeltildi.
 * Operatör bu ekranı görmez (iş açamaz).
 */
export default async function SiparisOku() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (user.role === 'TECHNICIAN') redirect('/matbaa/isler');
  const { dil } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const o = m.okuyucu;
  const tenantId = user.tenantId;
  const acik = okuyucuAcik(process.env, OKUYUCU_KAPATMA);

  const [{ urunler, fiyatsiz }, bekleyen, sayilar, tenant] = await Promise.all([
    fiyatliUrunler(tenantId),
    bekleyenTaslaklar(tenantId),
    okumaSayilari(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { workTimezone: true } }),
  ]);
  const tz = tenant?.workTimezone || 'Europe/Istanbul';
  const simdi = new Date();
  const oran = okumaOrani(sayilar);
  const enCok = enCokDuzeltilen(sayilar.degisenler);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{o.baslik}</h1>
        <Link href="/matbaa/isler" className="text-sm font-semibold text-[#0f2253]">← {m.panoBaslik}</Link>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">{o.alt}</p>

      {acik ? (
        <OkuyucuEkrani urunler={urunler} fiyatsizVar={fiyatsiz > 0} yonetici={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'} />
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">{o.kapali}</p>
          <p className="mt-1">{o.kapaliNeden}</p>
          <p className="mt-1">{o.kapaliElle} <Link href="/matbaa/isler/yeni" className="font-semibold underline">{m.yeniBaslik}</Link></p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">{o.bekleyenBaslik}</h2>
          {bekleyen.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{o.bekleyenBos}</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {bekleyen.map((b) => {
                const g = taslakGorunumu(kayitliOkuma(b.okunan, urunler));
                const kim = g.form.musteriAd || g.form.firma || g.form.telefon || o.adsiz;
                return (
                  <li key={b.id}>
                    <Link href={`/matbaa/isler/oku/${b.id}`} className="flex items-start justify-between gap-3 py-2 hover:bg-gray-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-900">{kim}</span>
                        <span className="block truncate text-xs text-gray-600">{g.ipuclari.filter(Boolean)[0] ?? ''}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-gray-500">
                        <span className="block">{o.kaynak[b.kaynak as keyof typeof o.kaynak] ?? b.kaynak} · {saatYaz(b.createdAt, dil, tz, simdi)}</span>
                        {b.belirsizSayisi > 0 && <span className="block font-semibold text-amber-700">{doldur(o.belirsizSayisi, { n: b.belirsizSayisi })}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">{o.oranBaslik}</h2>
          {oran.okunan === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{o.oranBos}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-800">{doldur(o.oranSatiri, { okunan: oran.okunan, onaylanan: oran.onaylanan, duzeltmesiz: oran.duzeltmesiz })}</p>
              {oran.duzeltmesizYuzde !== null && <p className="mt-1 text-2xl font-bold text-gray-900">%{oran.duzeltmesizYuzde}</p>}
              {oran.duzeltmesizYuzde !== null && <p className="text-xs text-gray-600">{doldur(o.oranYuzde, { yuzde: oran.duzeltmesizYuzde })}</p>}
              {enCok.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  {doldur(o.enCok, { liste: enCok.map((e) => `${o.alan[e.alan] ?? e.alan} (${e.n})`).join(', ') })}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
