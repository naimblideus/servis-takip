import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz } from '@/lib/matbaa-bicim';
import { gecikiyorMu, isDurumu, isNo, type IsDurumu } from '@/lib/baski-is';
import OtomatikYenile from '@/components/matbaa/OtomatikYenile';

export const dynamic = 'force-dynamic';

/**
 * TV PANOSU — atölyedeki televizyon. Uzaktan okunur: koyu zemin, büyük iş
 * numarası. Sırada / Baskıda / Bitiş / Hazır; geç kalan kırmızı. TUTAR YOK
 * ve müşterinin yalnız adı (soyadı baş harfi): ekran herkese açık bir odada.
 */
const SUTUNLAR: IsDurumu[] = ['SIRADA', 'BASKIDA', 'BITIS', 'HAZIR'];

/** "Ayşe Yılmaz" → "Ayşe Y." */
const kisaAd = (ad: string | null) => {
  if (!ad) return '';
  const p = ad.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

export default async function MatbaaTv() {
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId;
  if (!tenantId) return null;
  const m = matbaaMetni(await sunucuDili());
  const dil = (await sunucuDili()) === 'en' ? 'en' : 'tr';
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, workTimezone: true } });
  const tz = tenant?.workTimezone || 'Europe/Istanbul';
  const simdi = new Date();
  const isler = await prisma.baskiIsi.findMany({
    where: { tenantId, durum: { in: SUTUNLAR } },
    select: { id: true, no: true, durum: true, acil: true, sozVerilenAt: true, musteriAd: true, kalemler: { select: { urunAd: true }, orderBy: { sira: 'asc' }, take: 1 } },
    orderBy: [{ acil: 'desc' }, { sozVerilenAt: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  });
  const gecSayisi = isler.filter((i) => gecikiyorMu({ durum: isDurumu(i.durum) ?? 'SIRADA', sozVerilenAt: i.sozVerilenAt }, simdi)).length;

  return (
    <main className="min-h-screen bg-[#060D22] p-4 text-[#F1F4F9]">
      <OtomatikYenile saniye={20} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">{tenant?.name} · {m.tvBaslik}</h1>
        <div className="flex items-center gap-4">
          {gecSayisi > 0 && <span className="rounded-lg bg-[#2A1020] px-3 py-1 text-lg font-bold text-[#E05555]">{m.tvGecKalan}: {gecSayisi}</span>}
          <span className="text-lg font-semibold text-[#A8B3C7]">{saatYaz(simdi, dil, tz, simdi)}</span>
          <Link href="/matbaa" className="text-sm text-[#7D8BA6] hover:text-white">×</Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {SUTUNLAR.map((d) => {
          const kartlar = isler.filter((i) => i.durum === d);
          return (
            <section key={d} className="rounded-2xl bg-[#0B1533] p-3">
              <h2 className="mb-2 flex justify-between text-lg font-bold text-[#A8B3C7]"><span>{m.durum[d]}</span><span>{kartlar.length}</span></h2>
              {kartlar.length === 0 && <p className="py-4 text-center text-[#7D8BA6]">{m.tvBos}</p>}
              <div className="space-y-2">
                {kartlar.map((is) => {
                  const gec = gecikiyorMu({ durum: d, sozVerilenAt: is.sozVerilenAt }, simdi);
                  return (
                    <div key={is.id} className={`rounded-xl border p-3 ${gec ? 'border-[#E05555] bg-[#2A1020]' : 'border-[#1B2C52]'}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-2xl font-extrabold">{isNo(is.no)}</span>
                        {is.sozVerilenAt && <span className={`text-base font-bold ${gec ? 'text-[#E05555]' : 'text-[#A8B3C7]'}`}>{doldur(m.saat, { saat: saatYaz(is.sozVerilenAt, dil, tz, simdi) })}</span>}
                      </div>
                      <div className="mt-1 truncate text-base text-[#A8B3C7]">
                        {is.acil && <span className="mr-2 rounded bg-[#E05555] px-1.5 text-sm font-bold text-white">{m.acil}</span>}
                        {[kisaAd(is.musteriAd), is.kalemler[0]?.urunAd].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
