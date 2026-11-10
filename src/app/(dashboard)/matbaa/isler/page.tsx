import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz } from '@/lib/matbaa-bicim';
import { AKIS, gecikiyorMu, gecisIzinli, gunAraligi, isDurumu, isNo, odemeDurumu, sonrakiDurum, type IsDurumu } from '@/lib/baski-is';
import IsAdimi from '@/components/matbaa/IsAdimi';
import OtomatikYenile from '@/components/matbaa/OtomatikYenile';

export const dynamic = 'force-dynamic';

/**
 * İŞLER PANOSU — Gelen → Sırada → Baskıda → Bitiş → Hazır → Teslim.
 *
 * Kartta: iş no, müşteri, ilk kalemin özeti, söz verilen saat (geç kalan
 * kırmızı), ödeme durumu ve TEK düğme: sonraki adım. Düğme yalnız kural
 * izin veriyorsa çizilir; parası eksik işin "Teslim et"i yerine "Ödeme al"
 * ayrıntıya götürür. Teslim sütunu yalnız bugünü gösterir.
 * Operatör (TECHNICIAN) Gelen sütununu ve ödeme durumunu görmez.
 */
type Arama = Promise<Record<string, string | string[] | undefined>>;

export default async function IslerPanosu({ searchParams }: { searchParams: Arama }) {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { dil } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const tenantId = user.tenantId;
  const operator = user.role === 'TECHNICIAN';
  const f = (await searchParams).f;
  const filtre = f === 'bugun' || f === 'acil' ? f : 'hepsi';

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { workTimezone: true } });
  const tz = tenant?.workTimezone || 'Europe/Istanbul';
  const simdi = new Date();
  const { bas, bit } = gunAraligi(tz, simdi);

  const isler = await prisma.baskiIsi.findMany({
    where: {
      tenantId,
      OR: [{ durum: { notIn: ['TESLIM', 'IPTAL'] } }, { durum: 'TESLIM', teslimAt: { gte: bas } }],
      ...(filtre === 'acil' ? { acil: true } : {}),
      ...(filtre === 'bugun' ? { AND: [{ OR: [{ sozVerilenAt: { lte: bit } }, { createdAt: { gte: bas } }] }] } : {}),
    },
    select: {
      id: true, no: true, durum: true, acil: true, bitisGerekli: true, tahmini: true, sozVerilenAt: true,
      toplam: true, odenen: true, customerId: true, odemeYolu: true, musteriAd: true, firma: true,
      kalemler: { select: { ozet: true }, orderBy: { sira: 'asc' } },
      // Karttaki "n dosya": operatör basacağı dosyanın geldiğini panodan görsün.
      _count: { select: { dosyalar: { where: { durum: 'HAZIR', tur: 'BASKI' } } } },
    },
    orderBy: [{ acil: 'desc' }, { sozVerilenAt: 'asc' }, { createdAt: 'asc' }],
    take: 400,
  });

  const sutunlar = AKIS.filter((d) => !(operator && d === 'GELEN'));
  const odemeRenk = { BEKLIYOR: 'text-red-700', KISMI: 'text-amber-700', ODENDI: 'text-emerald-700', CARI: 'text-blue-700' } as const;

  /** Kartın tek düğmesi: kural izin veriyorsa adım, para eksikse ayrıntıya götüren bağlantı. */
  const dugme = (is: (typeof isler)[number]) => {
    const once = isDurumu(is.durum);
    if (!once) return null;
    const sonra = sonrakiDurum(once, is.bitisGerekli);
    if (!sonra) return null;
    const cari = !!is.customerId && is.odemeYolu === 'CARI';
    const izin = gecisIzinli(once, sonra, { rol: user.role, toplam: is.toplam, odenen: is.odenen, cari, bitisGerekli: is.bitisGerekli, tahmini: is.tahmini });
    if (izin.ok) return <IsAdimi id={is.id} sonra={sonra} etiket={m.adim[sonra as Exclude<IsDurumu, 'GELEN' | 'IPTAL'>]} />;
    if (izin.kod === 'ODEME_EKSIK' || izin.kod === 'FIYAT_TAHMINI') {
      return <Link href={`/matbaa/isler/${is.id}`} className="inline-block rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white">{izin.kod === 'ODEME_EKSIK' ? m.dugmeOdeme : m.dugmeKabul}</Link>;
    }
    return null;
  };

  const filtreBag = (k: string, ad: string) => (
    <Link href={k === 'hepsi' ? '/matbaa/isler' : `/matbaa/isler?f=${k}`}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${filtre === k ? 'bg-[#0f2253] text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>{ad}</Link>
  );

  return (
    <div className="p-4 md:p-6">
      <OtomatikYenile saniye={30} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{m.panoBaslik}</h1>
        {!operator && <Link href="/matbaa/isler/yeni" className="rounded-xl bg-[#0f2253] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1a3170]">{m.yeniIs}</Link>}
      </div>
      <div className="mt-3 flex gap-2">
        {filtreBag('hepsi', m.filtreHepsi)}
        {filtreBag('bugun', m.filtreBugun)}
        {filtreBag('acil', m.filtreAcil)}
      </div>

      {/* Telefonda sütunlar yana kayar; her sütun bir ekran genişliğine yakın. */}
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-4">
        {sutunlar.map((d) => {
          const kartlar = isler.filter((i) => i.durum === d);
          return (
            <section key={d} className="w-[85vw] max-w-[300px] shrink-0 snap-start rounded-2xl bg-gray-50 p-2 md:w-[260px]">
              <h2 className="flex items-center justify-between px-2 py-1 text-sm font-bold text-gray-700">
                <span>{m.durum[d]}</span><span className="text-gray-400">{kartlar.length}</span>
              </h2>
              <div className="space-y-2">
                {kartlar.length === 0 && <p className="px-2 py-3 text-center text-sm text-gray-400">{m.sutunBos}</p>}
                {kartlar.map((is) => {
                  const durum = isDurumu(is.durum) ?? 'SIRADA';
                  const gec = gecikiyorMu({ durum, sozVerilenAt: is.sozVerilenAt }, simdi);
                  const od = odemeDurumu(is.toplam, is.odenen, !!is.customerId && is.odemeYolu === 'CARI');
                  return (
                    <article key={is.id} className={`rounded-xl border bg-white p-3 ${gec ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/matbaa/isler/${is.id}`} className="font-mono text-sm font-bold text-gray-900 hover:underline">{isNo(is.no)}</Link>
                        <div className="flex items-center gap-1.5">
                          {is.acil && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{m.acil}</span>}
                          {is.sozVerilenAt && (
                            <span className={`text-xs font-semibold ${gec ? 'text-red-700' : 'text-gray-500'}`}>
                              {gec ? m.gecikti : doldur(m.saat, { saat: saatYaz(is.sozVerilenAt, dil, tz, simdi) })}
                            </span>
                          )}
                        </div>
                      </div>
                      {(is.musteriAd || is.firma) && <p className="mt-1 truncate text-sm font-medium text-gray-800">{is.musteriAd || is.firma}</p>}
                      <p className="mt-0.5 text-sm text-gray-600">
                        {is.kalemler[0]?.ozet}{is.kalemler.length > 1 ? ` +${is.kalemler.length - 1}` : ''}
                        {is._count.dosyalar > 0 && <span className="ml-1 whitespace-nowrap rounded bg-blue-50 px-1.5 text-xs font-semibold text-blue-700">{doldur(m.kartDosya, { n: is._count.dosyalar })}</span>}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        {!operator ? <span className={`text-xs font-semibold ${odemeRenk[od]}`}>{m.odemeDurumu[od]}</span> : <span />}
                        {dugme(is)}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
