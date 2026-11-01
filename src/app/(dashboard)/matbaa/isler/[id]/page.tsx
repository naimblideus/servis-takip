import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { AKIS, gecisIzinli, isDurumu, isNo, kalan, odemeDurumu, sonrakiDurum, type IsDurumu } from '@/lib/baski-is';
import IsAdimi from '@/components/matbaa/IsAdimi';
import IsEylemleri from '@/components/matbaa/IsEylemleri';

export const dynamic = 'force-dynamic';

/**
 * İŞ AYRINTISI — kalemler, para, tek "sonraki adım", ödeme al, geri al,
 * iptal ve geçmiş. Düğmeler yalnız kural izin veriyorsa çizilir (rol,
 * para kapısı); operatör tutar görmez.
 */
export default async function IsAyrintisi({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { id } = await params;
  const { dil, b } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const is = await prisma.baskiIsi.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      kalemler: { orderBy: { sira: 'asc' } },
      olaylar: { orderBy: { createdAt: 'desc' }, take: 50 },
      odemeler: { orderBy: { tarih: 'asc' } },
      customer: { select: { id: true, name: true } },
      tenant: { select: { workTimezone: true } },
    },
  });
  if (!is) notFound();
  const tz = is.tenant.workTimezone || 'Europe/Istanbul';
  const operator = user.role === 'TECHNICIAN';
  const durum = isDurumu(is.durum) ?? 'SIRADA';
  const cari = !!is.customerId && is.odemeYolu === 'CARI';
  const bag = { rol: user.role, toplam: is.toplam, odenen: is.odenen, cari, bitisGerekli: is.bitisGerekli, tahmini: is.tahmini };

  const sonra = sonrakiDurum(durum, is.bitisGerekli);
  const ileri = sonra && gecisIzinli(durum, sonra, bag).ok ? sonra : null;
  // Geri: bir adım (Hazır'dan, bitiş yoksa Baskıda'ya).
  const i = AKIS.indexOf(durum);
  // İptal edilmiş iş yöneticide Sırada'ya döner.
  const geriAday: IsDurumu | null = durum === 'IPTAL' ? 'SIRADA' : durum === 'HAZIR' && !is.bitisGerekli ? 'BASKIDA' : i > 1 ? AKIS[i - 1] : null;
  const geri = geriAday && gecisIzinli(durum, geriAday, bag).ok ? geriAday : null;
  const iptalEdilir = gecisIzinli(durum, 'IPTAL', bag).ok;
  const kalanTutar = kalan(is.toplam, is.odenen);
  const odemeAlinir = !operator && durum !== 'IPTAL' && kalanTutar > 0;
  const od = odemeDurumu(is.toplam, is.odenen, cari);
  const durumAdi = (d: string | null) => (d ? (m.durum as Record<string, string>)[d] ?? d : '');
  // Ödeme olayının metni "YOL KURUŞ" (lib/baski-is-kayit odemeEkle).
  const odemeOlayi = (metin: string | null) => {
    const [yol, tutar] = (metin ?? '').split(' ');
    return doldur(m.olayOdeme, { tutar: b.para(tl(Number(tutar) || 0)), yol: m.yol[yol as keyof typeof m.yol] ?? yol });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <div>
        <Link href="/matbaa/isler" className="text-sm text-gray-500 hover:underline">← {m.panoBaslik}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-gray-900">{isNo(is.no)}</h1>
          <span className="rounded-full bg-[#0f2253] px-3 py-1 text-sm font-bold text-white">{m.durum[durum]}</span>
          {is.acil && <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{m.acil}</span>}
          <span className="text-sm text-gray-500">{m.kanal[is.kanal as keyof typeof m.kanal] ?? is.kanal}</span>
        </div>
        <p className="mt-2 text-gray-800">
          {is.customer ? <Link href={`/customers/${is.customer.id}`} className="font-semibold hover:underline">{is.customer.name}</Link> : (is.musteriAd || is.firma || m.musteriYok)}
          {is.telefon && <span className="ml-2 text-gray-500">{is.telefon}</span>}
        </p>
        {is.sozVerilenAt && <p className="text-sm text-gray-600">{doldur(m.saat, { saat: saatYaz(is.sozVerilenAt, dil, tz) })}</p>}
        {is.not && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{is.not}</p>}
        {is.tahmini && durum === 'GELEN' && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{m.tahminiUyari}</p>}
      </div>

      {/* Tek ana eylem */}
      {(ileri || geri) && (
        <div className="flex flex-wrap items-start gap-3">
          {ileri && <IsAdimi id={is.id} sonra={ileri} etiket={m.adim[ileri as keyof typeof m.adim]} />}
          {geri && <IsAdimi id={is.id} sonra={geri} etiket={`${m.geriAl} (${m.durum[geri]})`} ikincil />}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-2 text-sm font-bold text-gray-700">{m.kalemler}</h2>
        {is.kalemler.map((k) => (
          <div key={k.id} className="flex justify-between gap-3 border-b border-gray-100 px-4 py-2 text-sm last:border-b-0">
            <span className="text-gray-800">{k.ozet}</span>
            {!operator && <span className="shrink-0 font-semibold">{b.para(tl(k.tutar))}</span>}
          </div>
        ))}
        {!operator && (
          <div className="space-y-1 border-t border-gray-200 px-4 py-3 text-sm">
            <div className="flex justify-between font-bold"><span>{m.toplam} <span className="font-normal text-gray-500">({m.kdvDahil})</span></span><span>{b.para(tl(is.toplam))}</span></div>
            <div className="flex justify-between text-gray-600"><span>{m.odenen}</span><span>{b.para(tl(is.odenen))}</span></div>
            <div className="flex justify-between"><span>{m.kalan}</span><span className="font-semibold">{b.para(tl(kalanTutar))} · {m.odemeDurumu[od]}</span></div>
          </div>
        )}
      </section>

      {!operator && (
        // key: ödeme sonrası kalan değişince tutar kutusu yeni kalanla açılsın.
        <IsEylemleri key={kalanTutar} id={is.id} kalan={kalanTutar} odemeAlinir={odemeAlinir} iptalEdilir={iptalEdilir} />
      )}

      {!operator && is.odemeler.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-2 text-sm font-bold text-gray-700">{m.odemeler}</h2>
          {is.odemeler.map((o) => (
            <div key={o.id} className="flex justify-between px-4 py-2 text-sm">
              <span className="text-gray-600">{saatYaz(o.tarih, dil, tz)} · {m.yol[o.yol as keyof typeof m.yol] ?? o.yol}{o.aliciAd ? ` · ${o.aliciAd}` : ''}</span>
              <span className="font-semibold">{b.para(tl(o.tutar))}</span>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-2 text-sm font-bold text-gray-700">{m.gecmis}</h2>
        {is.olaylar.map((o) => (
          <div key={o.id} className="flex justify-between gap-3 px-4 py-2 text-sm">
            <span className="text-gray-800">
              {o.tur === 'DURUM' ? (o.durumOnce ? doldur(m.olayDurum, { once: durumAdi(o.durumOnce), sonra: durumAdi(o.durumSonra) }) : m.olayIlk)
                : o.tur === 'ODEME' ? odemeOlayi(o.metin) : o.tur}
              {o.metin && o.tur !== 'ODEME' ? ` — ${o.metin}` : ''}
            </span>
            <span className="shrink-0 text-gray-500">{saatYaz(o.createdAt, dil, tz)}{o.kullaniciAd ? ` · ${o.kullaniciAd}` : ''}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
