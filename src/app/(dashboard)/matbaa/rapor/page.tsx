import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { tl } from '@/lib/matbaa-bicim';
import { RAPOR_GUNLERI, raporGunu, raporOzeti, sureYaz } from '@/lib/baski-rapor';

export const dynamic = 'force-dynamic';

/**
 * RAPOR — yalnız sahip. Üstte TEK satır: ciro, iş sayısı, online oranı
 * (sipariş sayfası işe yarıyor mu?). Altında kanal payı, hazırlama süresi,
 * en çok satan beş ürün ve tahsil edilmemiş tutar. Dönem: son 7 / 30 / 90 gün.
 */
type Arama = Promise<Record<string, string | string[] | undefined>>;

export default async function MatbaaRaporu({ searchParams }: { searchParams: Arama }) {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (!yoneticiMi(user)) redirect('/matbaa');
  const { dil, b } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const gun = raporGunu((await searchParams).gun);
  const simdi = new Date();
  const bas = new Date(simdi.getTime() - gun * 86_400_000);
  const satirlar = await prisma.baskiIsi.findMany({
    where: { tenantId: user.tenantId, createdAt: { gte: bas } },
    select: {
      kanal: true, durum: true, toplam: true, odenen: true, createdAt: true,
      kalemler: { select: { urunAd: true, tutar: true } },
      olaylar: { where: { tur: 'DURUM', durumSonra: 'HAZIR' }, select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    take: 5000,
  });
  const o = raporOzeti(satirlar.map((s) => ({ ...s, hazirAt: s.olaylar[0]?.createdAt ?? null })));
  const kart = 'rounded-xl border border-gray-200 bg-white p-4';

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{m.raporBaslik}</h1>
        <div className="flex gap-2">
          {RAPOR_GUNLERI.map((g) => (
            <Link key={g} href={`/matbaa/rapor?gun=${g}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${g === gun ? 'bg-[#0f2253] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{doldur(m.raporGun, { n: g })}</Link>
          ))}
        </div>
      </div>
      <p className="mt-3 text-lg font-semibold text-gray-800">{doldur(m.raporSatiri, { tutar: b.para(tl(o.ciro)), n: o.isSayisi, oran: o.onlineOrani })}</p>

      {o.isSayisi === 0 ? <p className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{m.raporBos}</p> : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={kart}>
              <div className="text-xs text-gray-500">{m.raporHazirlama}</div>
              <div className="text-lg font-bold text-gray-900">{o.hazirlamaDk === null ? '—' : sureYaz(o.hazirlamaDk, dil === 'en' ? 'en' : 'tr')}</div>
            </div>
            <div className={kart}>
              <div className="text-xs text-gray-500">{m.raporAcik}</div>
              <div className="text-lg font-bold text-gray-900">{b.para(tl(o.acik))}</div>
            </div>
          </div>

          <section className={kart}>
            <h2 className="text-sm font-bold text-gray-700">{m.raporKanal}</h2>
            {o.kanallar.map((k) => (
              <div key={k.kanal} className="mt-2">
                <div className="flex justify-between text-sm"><span>{m.kanal[k.kanal]}</span><span className="text-gray-600">{k.adet} · {b.para(tl(k.ciro))}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${k.kanal === 'ONLINE' ? 'bg-emerald-500' : 'bg-[#0f2253]'}`} style={{ width: `${Math.round((k.adet / o.isSayisi) * 100)}%` }} /></div>
              </div>
            ))}
            {o.iptal > 0 && <p className="mt-3 text-xs text-gray-500">{doldur(m.raporIptal, { n: o.iptal })}</p>}
          </section>

          <section className={kart}>
            <h2 className="text-sm font-bold text-gray-700">{m.raporEnCok}</h2>
            {o.enCokSatan.map((u) => (
              <div key={u.ad} className="mt-2 flex justify-between gap-3 text-sm"><span className="min-w-0 truncate">{u.ad}</span><span className="shrink-0 text-gray-600">{u.adet} · {b.para(tl(u.ciro))}</span></div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
