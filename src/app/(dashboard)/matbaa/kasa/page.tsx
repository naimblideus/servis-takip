import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { gunAraligi, isNo, ODEME_YOLLARI } from '@/lib/baski-is';

export const dynamic = 'force-dynamic';

/**
 * KASA — günün alınan parası: nakit / kart / havale toplamları ve satır
 * satır ödemeler; ayrıca o gün cariye yazılarak teslim edilen işler.
 * Gün sonu kapanışı Faz C. Operatör para görmez.
 */
type Arama = Promise<Record<string, string | string[] | undefined>>;

export default async function Kasa({ searchParams }: { searchParams: Arama }) {
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
  const istenen = (await searchParams).gun;
  const { bas, bit, gun } = gunAraligi(tz, new Date(), typeof istenen === 'string' ? istenen : null);

  const [odemeler, cariIsler] = await Promise.all([
    prisma.baskiOdeme.findMany({
      where: { tenantId, tarih: { gte: bas, lte: bit } },
      select: { id: true, tutar: true, yol: true, tarih: true, aliciAd: true, is: { select: { id: true, no: true } } },
      orderBy: { tarih: 'asc' },
    }),
    prisma.baskiIsi.findMany({
      where: { tenantId, durum: 'TESLIM', odemeYolu: 'CARI', teslimAt: { gte: bas, lte: bit } },
      select: { toplam: true, odenen: true },
    }),
  ]);
  const toplam = odemeler.reduce((s, o) => s + o.tutar, 0);
  const yolToplam = Object.fromEntries(ODEME_YOLLARI.map((y) => [y, odemeler.filter((o) => o.yol === y).reduce((s, o) => s + o.tutar, 0)]));
  const cari = cariIsler.reduce((s, i) => s + Math.max(0, i.toplam - i.odenen), 0);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{m.kasaBaslik}</h1>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="gun" className="text-gray-600">{m.kasaGun}</label>
          <input id="gun" name="gun" type="date" defaultValue={gun} className="rounded-lg border border-gray-300 px-2 py-1.5" />
          <button type="submit" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold">→</button>
        </form>
      </div>
      <p className="mt-3 text-lg font-semibold text-gray-800">{doldur(m.kasaToplam, { tutar: b.para(tl(toplam)) })}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ODEME_YOLLARI.map((y) => (
          <div key={y} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">{m.yol[y]}</div>
            <div className="text-lg font-bold text-gray-900">{b.para(tl(yolToplam[y]))}</div>
          </div>
        ))}
      </div>
      {cari > 0 && <p className="mt-3 text-sm text-blue-800">{doldur(m.kasaCari, { tutar: b.para(tl(cari)) })}</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        {odemeler.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">{m.kasaBos}</p> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr><th className="px-3 py-2">{m.saatSutun}</th><th className="px-3 py-2">{m.isSutun}</th><th className="px-3 py-2">{m.odeme}</th><th className="px-3 py-2">{m.alanSutun}</th><th className="px-3 py-2 text-right">{m.tutar}</th></tr>
            </thead>
            <tbody>
              {odemeler.map((o) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-600">{saatYaz(o.tarih, dil, tz)}</td>
                  <td className="px-3 py-2"><Link href={`/matbaa/isler/${o.is.id}`} className="font-mono font-semibold hover:underline">{isNo(o.is.no)}</Link></td>
                  <td className="px-3 py-2">{m.yol[o.yol as keyof typeof m.yol] ?? o.yol}</td>
                  <td className="px-3 py-2 text-gray-600">{o.aliciAd ?? ''}</td>
                  <td className="px-3 py-2 text-right font-semibold">{b.para(tl(o.tutar))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
