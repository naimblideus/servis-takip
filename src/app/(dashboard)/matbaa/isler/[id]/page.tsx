import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { AKIS, gecisIzinli, isDurumu, isNo, kalan, odemeDurumu, provaGorunum, sonrakiDurum, type IsDurumu } from '@/lib/baski-is';
import IsAdimi from '@/components/matbaa/IsAdimi';
import IsEylemleri from '@/components/matbaa/IsEylemleri';
import MesajDugmesi from '@/components/matbaa/MesajDugmesi';
import KabulFormu from '@/components/matbaa/KabulFormu';
import { mesajYaz, onerilenMesajlar, type MesajTuru } from '@/lib/baski-mesaj';
import { bicimYap } from '@/lib/bicim';
import { waGecerliMi, waUrl } from '@/lib/share';
import { ayarHazirla, siteKoku, takipAdresi } from '@/lib/matbaa-ayar-kayit';
import { provaYolu, tamAdres } from '@/lib/matbaa-ayar';
import { DOSYA_AZAMI, personelYukleyebilir } from '@/lib/baski-dosya';
import { r2Ayarli } from '@/lib/r2';
import DosyaYukle from '@/components/matbaa/DosyaYukle';
import DosyaKaldir from '@/components/matbaa/DosyaKaldir';

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
  const { dil, b, bayiDili } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const is = await prisma.baskiIsi.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      kalemler: { orderBy: { sira: 'asc' } },
      olaylar: { orderBy: { createdAt: 'desc' }, take: 50 },
      odemeler: { orderBy: { tarih: 'asc' } },
      customer: { select: { id: true, name: true } },
      dosyalar: { where: { durum: { in: ['HAZIR', 'SILINDI'] } }, orderBy: { createdAt: 'asc' } },
      provalar: { orderBy: { createdAt: 'desc' }, take: 1 },
      tenant: { select: { name: true, address: true, currency: true, workTimezone: true, odemeIban: true, odemeHesapAdi: true } },
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
  // Müşteriye giden metin BAYİNİN dilinde ve bayinin para biriminde.
  const mb = bicimYap(bayiDili, is.tenant.currency);
  // Tutar kesinleşmeden "iş alındı, tutar şu" denmez: müşteri o tutarı bekler.
  const tahminiKabul = !operator && durum === 'GELEN' && is.tahmini;
  const simdi = new Date();
  const ayar = await ayarHazirla(user.tenantId);
  const takipUrl = takipAdresi(ayar, is.jeton);
  const prova = is.provalar[0] ?? null;
  const provaDurumu = prova ? provaGorunum(prova, simdi) : null;
  const provaUrl = prova && provaDurumu === 'BEKLIYOR' && ayar.kisaAd ? tamAdres(siteKoku(), provaYolu(ayar.kisaAd, prova.jeton)) : null;
  const mesajlar = operator || tahminiKabul ? [] : onerilenMesajlar(durum, { kalan: kalanTutar, ibanVar: !!is.tenant.odemeIban, cari, provaBekliyor: !!provaUrl });
  const dosyaAcik = r2Ayarli();
  const yuklenebilir = dosyaAcik && personelYukleyebilir(durum);
  const azamiMb = Math.round(DOSYA_AZAMI / 1024 / 1024);
  const baskiDosyalari = is.dosyalar.filter((d) => d.tur === 'BASKI');
  const mesajUrl = (tur: MesajTuru) => waUrl(is.telefon, mesajYaz(tur, {
    isNo: isNo(is.no), musteriAd: is.musteriAd, ozet: is.kalemler.map((k) => k.ozet).join('\n'),
    toplam: mb.para(tl(is.toplam)), kalan: kalanTutar > 0 ? mb.para(tl(kalanTutar)) : null,
    saat: saatYaz(is.sozVerilenAt, bayiDili, tz) || null,
    firma: is.tenant.name, adres: is.tenant.address, iban: is.tenant.odemeIban, hesapAdi: is.tenant.odemeHesapAdi,
    takipUrl, provaUrl,
  }, bayiDili));
  // Ödeme olayının metni "YOL KURUŞ" (lib/baski-is-kayit odemeEkle).
  const odemeOlayi = (metin: string | null) => {
    const [yol, tutar] = (metin ?? '').split(' ');
    return doldur(m.olayOdeme, { tutar: b.para(tl(Number(tutar) || 0)), yol: m.yol[yol as keyof typeof m.yol] ?? yol });
  };

  // Prova olayının metni "YUKLENDI", "ONAYLANDI" ya da "DUZELTME: not" (lib/baski-prova).
  const provaOlayi = (metin: string | null) => {
    const [kod, ...not] = (metin ?? '').split(': ');
    if (kod === 'YUKLENDI') return m.olayProvaGonderildi;
    const ad = m.provaDurum[kod as keyof typeof m.provaDurum] ?? kod;
    return doldur(m.olayProva, { durum: ad }) + (not.length ? ` — ${not.join(': ')}` : '');
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
        {!operator && (
          <p className="mt-2 flex flex-wrap gap-4 text-sm">
            <Link href={`/matbaa/isler/${is.id}/fis`} className="font-semibold text-[#0f2253] underline">{m.fisYazdir}</Link>
            {takipUrl && <a href={takipUrl} target="_blank" rel="noreferrer" className="text-gray-600 underline">{m.takipBaglantisi}</a>}
          </p>
        )}
      </div>

      {/* Tahmini fiyatlı online iş: "Kabul et" sayfa sayısıyla birlikte. Operatör kabul etmez. */}
      {tahminiKabul && <KabulFormu id={is.id} kalemler={is.kalemler.filter((k) => k.sayfa !== null).map((k) => ({ id: k.id, ozet: k.ozet, sayfa: k.sayfa as number }))} />}

      {/* Tek ana eylem */}
      {(ileri || geri) && (
        <div className="flex flex-wrap items-start gap-3">
          {ileri && <IsAdimi id={is.id} sonra={ileri} etiket={m.adim[ileri as keyof typeof m.adim]} />}
          {geri && <IsAdimi id={is.id} sonra={geri} etiket={`${m.geriAl} (${m.durum[geri]})`} ikincil />}
        </div>
      )}

      {mesajlar.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">{m.mesajBaslik}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {mesajlar.map((tur, sira) => <MesajDugmesi key={tur} isId={is.id} tur={tur} url={mesajUrl(tur)} etiket={m.mesaj[tur]} ikincil={sira > 0} />)}
          </div>
          {!waGecerliMi(is.telefon) && <p className="mt-2 text-xs text-gray-500">{m.mesajTelefonYok}</p>}
          {is.haberVerildiAt && <p className="mt-2 text-xs text-emerald-800">{doldur(m.haberVerildi, { saat: saatYaz(is.haberVerildiAt, dil, tz) })}</p>}
        </section>
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

      {/* Dosyalar: operatör de indirir (basacak olan o); kaldırmak tezgahın. */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-700">{m.dosyalarBaslik}</h2>
        {baskiDosyalari.length === 0 && <p className="mt-2 text-sm text-gray-500">{m.dosyaYok}</p>}
        {baskiDosyalari.map((d) => (
          <div key={d.id} className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className={`min-w-0 break-all ${d.durum === 'SILINDI' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{d.ad}</span>
            <span className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-gray-500">
              {d.sayfaSayisi ? <span>{doldur(m.dosyaSayfa, { n: d.sayfaSayisi })}</span> : null}
              {d.olcu && <span>{d.olcu}</span>}
              {d.yukleyen === 'MUSTERI' && <span>{m.dosyaMusteriden}</span>}
              {(Array.isArray(d.uyarilar) ? d.uyarilar : []).map((u) => <span key={String(u)} className="rounded bg-amber-100 px-1.5 font-semibold text-amber-800">{m.dosyaUyari[u as keyof typeof m.dosyaUyari] ?? String(u)}</span>)}
              {d.durum === 'SILINDI' ? <span>{m.dosyaSilindi}</span> : (<>
                <a href={`/api/matbaa/dosyalar/${d.id}`} className="rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white">{m.dosyaIndir}</a>
                {!operator && <DosyaKaldir id={d.id} />}
              </>)}
            </span>
          </div>
        ))}
        {yuklenebilir ? <div className="mt-3"><DosyaYukle hedef={{ tur: 'PERSONEL', isId: is.id }} dil={dil} azamiMb={azamiMb} yenile etiket={m.dosyaEkle} /></div>
          : !dosyaAcik && <p className="mt-2 text-xs text-amber-800">{m.dosyaKapaliNot}</p>}
      </section>

      {/* Prova: yüklenince müşteriye süreli onay bağlantısı hazırlanır (WhatsApp düğmesi yukarıda). */}
      {!operator && (prova || yuklenebilir) && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">{m.provaBaslik}</h2>
          {prova && provaDurumu && (
            <div className="mt-2 text-sm">
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${provaDurumu === 'ONAYLANDI' ? 'bg-emerald-50 text-emerald-800' : provaDurumu === 'DUZELTME' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{m.provaDurum[provaDurumu]}</span>
              {provaDurumu === 'BEKLIYOR' && <span className="ml-2 text-xs text-gray-500">{doldur(m.provaSon, { saat: saatYaz(prova.sonTarih, dil, tz) })}</span>}
              {prova.musteriNotu && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-red-900">{prova.musteriNotu}</p>}
              {prova.dosyaId && is.dosyalar.some((d) => d.id === prova.dosyaId && d.durum === 'HAZIR') && <a href={`/api/matbaa/dosyalar/${prova.dosyaId}?gor=1`} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-[#0f2253] underline">{m.dosyaIndir}</a>}
            </div>
          )}
          {yuklenebilir && (
            <div className="mt-3">
              <DosyaYukle hedef={{ tur: 'PERSONEL', isId: is.id, dosyaTuru: 'PROVA' }} dil={dil} azamiMb={azamiMb} yenile etiket={m.provaYukle} />
              <p className="mt-2 text-xs text-gray-500">{m.provaNot}</p>
            </div>
          )}
        </section>
      )}

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
                : o.tur === 'ODEME' ? odemeOlayi(o.metin)
                  : o.tur === 'BILDIRIM' ? doldur(m.olayMesaj, { ad: m.mesaj[o.metin as MesajTuru] ?? o.metin ?? '' })
                    : o.tur === 'DOSYA' ? doldur(m.olayDosya, { ad: o.metin ?? '' })
                      : o.tur === 'PROVA' ? provaOlayi(o.metin) : o.tur}
              {o.metin && o.tur === 'DURUM' ? ` — ${o.metin}` : ''}
            </span>
            <span className="shrink-0 text-gray-500">{saatYaz(o.createdAt, dil, tz)}{o.kullaniciAd ? ` · ${o.kullaniciAd}` : ''}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
