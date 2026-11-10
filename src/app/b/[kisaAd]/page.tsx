import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { jetonGecerli } from '@/lib/matbaa-ayar';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { matbaaDili } from '@/lib/baski-musteri-uc';
import { fiyatliMi, urunTanimi } from '@/lib/baski-fiyat';
import { waGecerliMi, waUrl } from '@/lib/share';
import { r2Ayarli } from '@/lib/r2';
import SiparisFormu, { type SiparisKalemi } from '@/components/matbaa/SiparisFormu';

/**
 * SİPARİŞ SAYFASI — /b/<kısa-ad>
 *
 * Matbaanın müşterisi WhatsApp karşılama mesajındaki bağlantıdan gelir:
 * ürünü seçer, fiyatı hemen görür, dosyasını gönderir. Giriş yok.
 * Fiyatı girilmemiş ya da sipariş sayfasına kapalı ürün burada GÖRÜNMEZ.
 * Arama motoruna açık: matbaanın vitrini.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ kisaAd: string }> }): Promise<Metadata> {
  const { kisaAd } = await params;
  const m = await kisaAddanMatbaa(kisaAd);
  return m ? { title: `${m.tenant.name} · ${musteriMetni(matbaaDili(m.tenant.locale)).siparisBaslik}` } : { robots: { index: false } };
}

export default async function SiparisSayfasi({ params, searchParams }: { params: Promise<{ kisaAd: string }>; searchParams: Promise<{ tekrar?: string }> }) {
  const { kisaAd } = await params;
  const mat = await kisaAddanMatbaa(kisaAd);
  if (!mat) notFound();
  const { tenant, ayar } = mat;
  const dil = matbaaDili(tenant.locale);
  const m = musteriMetni(dil);

  const satirlar = ayar.siparisAcik
    ? await prisma.baskiUrunu.findMany({ where: { tenantId: tenant.id, aktif: true, online: true }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }] })
    : [];
  const urunler = satirlar.map((s) => ({ id: s.id, teslimSaat: s.teslimSaat, tanim: urunTanimi(s) })).filter((u) => fiyatliMi(u.tanim));
  const acik = ayar.siparisAcik && urunler.length > 0;

  // "Aynısını tekrar": eski işin kalemleri forma hazır gelir. Yalnız hâlâ satışta olan ürünler.
  const { tekrar } = await searchParams;
  let ilkKalemler: SiparisKalemi[] | null = null;
  let ilkAd = '';
  if (acik && jetonGecerli(tekrar)) {
    const eski = await prisma.baskiIsi.findFirst({
      where: { jeton: tekrar, tenantId: tenant.id },
      select: { musteriAd: true, kalemler: { select: { urunId: true, adet: true, sayfa: true, enCm: true, boyCm: true, secimler: true }, orderBy: { sira: 'asc' } } },
    });
    const gecerli = (eski?.kalemler ?? []).filter((k) => urunler.some((u) => u.id === k.urunId));
    if (gecerli.length) {
      ilkKalemler = gecerli.map((k) => ({
        urunId: k.urunId!, adet: String(k.adet), sayfa: k.sayfa ? String(k.sayfa) : '', en: k.enCm ? String(k.enCm) : '', boy: k.boyCm ? String(k.boyCm) : '',
        secimler: (k.secimler ?? {}) as Record<string, string>,
      }));
      ilkAd = eski?.musteriAd ?? '';
    }
  }

  const telHref = tenant.phone ? `tel:${tenant.phone.replace(/[^\d+]/g, '')}` : null;
  const waHref = waGecerliMi(tenant.phone) ? waUrl(tenant.phone, '') : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{m.siparisBaslik}</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{tenant.name}</h1>
          {(tenant.address || ayar.calismaSaatleri) && (
            <p className="mt-1 text-sm text-slate-500">{[tenant.address, ayar.calismaSaatleri].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">
        {acik ? (
          <SiparisFormu
            kisaAd={ayar.kisaAd!} dil={dil} birim={tenant.currency} urunler={urunler}
            havale={ayar.havaleKabul && !!tenant.odemeIban} dosyaAcik={r2Ayarli()} saklamaGun={ayar.saklamaGun}
            hazirlamaSaat={ayar.hazirlamaSaat} ilkKalemler={ilkKalemler} ilkAd={ilkAd}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-lg font-bold">{m.siparisKapali}</p>
            <p className="mt-1 text-sm text-slate-600">{m.siparisKapaliAlt}</p>
            <div className="mt-4 flex justify-center gap-2">
              {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{m.whatsapp}</a>}
              {telHref && <a href={telHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{m.ara}</a>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
