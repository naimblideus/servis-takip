import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { bugunSatirlari, gecikiyorMu, gunAraligi, isDurumu, isNo, KAPALI, type BugunTuru } from '@/lib/baski-is';
import OtomatikYenile from '@/components/matbaa/OtomatikYenile';

export const dynamic = 'force-dynamic';

/**
 * BUGÜN — baskı merkezinin ana sayfası.
 *
 * Üstte TEK sayı satırı: bugün kaç iş, kasaya ne girdi, kaçı geç kalıyor.
 * Altında bugün yapılacak her iş tek satırda, tek düğmeyle (kalıp:
 * magaza/BugunListesi). İş bitince satır kendiliğinden düşer.
 * Operatör buraya gelmez (tutar var): işler panosuna gider.
 */
const RENK: Record<BugunTuru, string> = {
  gelen: 'bg-red-50 text-red-700',
  haber: 'bg-emerald-50 text-emerald-800',
  gec: 'bg-red-50 text-red-700',
  bugun: 'bg-amber-50 text-amber-800',
  odeme: 'bg-blue-50 text-blue-700',
};

export default async function MatbaaBugun() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (user.role === 'TECHNICIAN') redirect('/matbaa/isler');
  const { dil, b } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const tenantId = user.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { workTimezone: true } });
  const tz = tenant?.workTimezone || 'Europe/Istanbul';
  const simdi = new Date();
  const { bas, bit } = gunAraligi(tz, simdi);

  const [acik, bugunAcilan, kasa] = await Promise.all([
    prisma.baskiIsi.findMany({
      where: { tenantId, durum: { notIn: [...KAPALI] } },
      select: { id: true, no: true, durum: true, sozVerilenAt: true, haberVerildiAt: true, toplam: true, odenen: true, customerId: true, odemeYolu: true, musteriAd: true, firma: true, kalemler: { select: { ozet: true }, orderBy: { sira: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    prisma.baskiIsi.count({ where: { tenantId, createdAt: { gte: bas, lte: bit } } }),
    prisma.baskiOdeme.aggregate({ where: { tenantId, tarih: { gte: bas, lte: bit } }, _sum: { tutar: true } }),
  ]);
  const gec = acik.filter((i) => gecikiyorMu({ durum: isDurumu(i.durum) ?? 'SIRADA', sozVerilenAt: i.sozVerilenAt }, simdi)).length;
  const satirlar = bugunSatirlari(acik, simdi, bit);

  const etiket: Record<BugunTuru, string> = { gelen: m.satirGelen, haber: m.satirHaber, gec: m.satirGec, bugun: m.satirBugun, odeme: m.satirOdeme };
  const dugme: Record<BugunTuru, string> = { gelen: m.dugmeKabul, haber: m.dugmeHaber, gec: m.dugmeAc, bugun: m.dugmeAc, odeme: m.dugmeOdeme };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <OtomatikYenile saniye={60} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{m.bugunBaslik}</h1>
        <Link href="/matbaa/isler/yeni" className="rounded-xl bg-[#0f2253] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1a3170]">{m.yeniIs}</Link>
      </div>
      <p className="mt-3 text-lg font-semibold text-gray-800">
        {doldur(m.sayiSatiri, { n: bugunAcilan, tutar: b.para(tl(kasa._sum.tutar ?? 0)), gec })}
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {satirlar.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-gray-800">{m.bugunBos}</p>
            <p className="mt-1 text-sm text-gray-500">{m.bugunBosAlt}</p>
          </div>
        ) : satirlar.map(({ tur, is }) => (
          <div key={is.id} className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${RENK[tur]}`}>{etiket[tur]}</span>
                <span className="font-mono text-sm font-semibold text-gray-900">{isNo(is.no)}</span>
                {is.sozVerilenAt && <span className="text-xs text-gray-500">{saatYaz(is.sozVerilenAt, dil, tz, simdi)}</span>}
              </div>
              <p className="mt-1 truncate text-sm text-gray-700">
                {[is.musteriAd || is.firma, is.kalemler[0]?.ozet].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Link href={`/matbaa/isler/${is.id}`} className="shrink-0 rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1a3170]">
              {dugme[tur]}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
