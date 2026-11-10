import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { takipVerisi } from '@/lib/baski-takip';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { provaYolu, siparisYolu } from '@/lib/matbaa-ayar';
import { sozluk, doldur } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';
import { saatYaz, tl } from '@/lib/matbaa-bicim';
import { waGecerliMi, waUrl } from '@/lib/share';
import OdemeKarti from '@/app/m/[token]/OdemeKarti';
import DosyaYukle from '@/components/matbaa/DosyaYukle';
import { DOSYA_AZAMI } from '@/lib/baski-dosya';

/**
 * İŞ TAKİBİ — /b/<kısa-ad>/is/<jeton>
 *
 * Matbaanın müşterisi buraya WhatsApp'tan ya da fişteki QR'dan gelir. Şifre
 * yok. Ne görüneceğine bu sayfa KARAR VERMEZ: karar lib/baski-takip'te.
 * "Hazır mı?" sorusunun cevabı en üstte, tek cümle.
 */
export const dynamic = 'force-dynamic';

// Başlık ve sayfa aynı veriyi ister: istek başına tek sorgu.
const veri = cache(takipVerisi);

// Arama motorlarına KAPALI: özel bağlantı Google'a düşerse özel olmaktan çıkar.
export async function generateMetadata({ params }: { params: Promise<{ kisaAd: string; jeton: string }> }): Promise<Metadata> {
  const { kisaAd, jeton } = await params;
  const v = await veri(kisaAd, jeton);
  return { robots: { index: false, follow: false, nocache: true }, title: v ? `${v.is.no} · ${v.firma.ad}` : undefined };
}

export default async function TakipSayfasi({ params }: { params: Promise<{ kisaAd: string; jeton: string }> }) {
  const { kisaAd, jeton } = await params;
  const v = await veri(kisaAd, jeton);
  if (!v) notFound();
  const m = musteriMetni(v.dil);
  const portal = sozluk(v.dil).portal;
  const b = bicimYap(v.dil, v.birim);
  const is = v.is;
  const cumle = is.durum === 'IPTAL' ? m.durumIptal : is.durum === 'GELEN' ? m.durumGelen : is.durum === 'SIRADA' ? m.durumSirada
    : is.durum === 'HAZIR' ? m.durumHazir : is.durum === 'TESLIM' ? m.durumTeslim : m.durumHazirlaniyor;
  const hazir = is.durum === 'HAZIR';
  const telHref = v.firma.telefon ? `tel:${v.firma.telefon.replace(/[^\d+]/g, '')}` : null;
  const waHref = waGecerliMi(v.firma.telefon) ? waUrl(v.firma.telefon, doldur(m.yazMesaj, { no: is.no })) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{m.takipBaslik}</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{v.firma.ad}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{is.no}{is.musteriAd ? ` · ${is.musteriAd}` : ''}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        {/* Tek cümle: müşterinin sorduğu şey. */}
        <section className={`rounded-2xl border p-5 ${is.durum === 'IPTAL' ? 'border-slate-200 bg-white' : hazir ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
          <p className={`text-lg font-bold ${hazir ? 'text-emerald-900' : 'text-slate-900'}`}>{cumle}</p>
          {is.sozVerilenAt && !hazir && is.durum !== 'TESLIM' && is.durum !== 'IPTAL' && (
            <p className="mt-1 text-sm text-slate-600">{doldur(m.sozSaat, { saat: saatYaz(is.sozVerilenAt, v.dil, v.tz) })}</p>
          )}
          {is.cizelge.length > 0 && (
            <ol className="mt-4 grid grid-cols-4 gap-1">
              {is.cizelge.map((a) => (
                <li key={a.adim} className="text-center">
                  <div className={`mx-auto h-2 rounded-full ${a.tamam ? (hazir || is.durum === 'TESLIM' ? 'bg-emerald-500' : 'bg-blue-600') : 'bg-slate-200'}`} />
                  <div className={`mt-1.5 text-xs ${a.simdi ? 'font-bold text-slate-900' : a.tamam ? 'text-slate-600' : 'text-slate-400'}`}>{m.adim[a.adim]}</div>
                  {a.zaman && <div className="text-[11px] text-slate-400">{saatYaz(a.zaman, v.dil, v.tz)}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Prova onayı bekliyorsa en üstte: iş onun cevabını bekliyor. */}
        {v.prova?.jeton && (
          <Link href={provaYolu(v.kisaAd, v.prova.jeton)} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <span className="font-semibold text-amber-900">{m.provaBekliyor}</span>
            <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-bold text-white">{m.provaGit}</span>
          </Link>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-700">{m.kalemler}</h2>
          {is.kalemler.map((k, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-slate-100 px-5 py-2.5 text-sm last:border-b-0">
              <span>{k.ozet}</span>
              <span className="shrink-0 font-semibold tabular-nums">{b.para(tl(k.tutar))}</span>
            </div>
          ))}
          <div className="space-y-1 border-t border-slate-200 px-5 py-3 text-sm">
            <div className="flex justify-between font-bold"><span>{m.toplam} <span className="font-normal text-slate-500">({m.kdvDahil})</span></span><span className="tabular-nums">{b.para(tl(is.toplam))}</span></div>
            {is.odenen > 0 && <div className="flex justify-between text-slate-600"><span>{m.odenen}</span><span className="tabular-nums">{b.para(tl(is.odenen))}</span></div>}
            {is.odenen > 0 && is.kalan > 0 && <div className="flex justify-between font-semibold"><span>{m.kalan}</span><span className="tabular-nums">{b.para(tl(is.kalan))}</span></div>}
            {is.tahmini && <p className="pt-1 text-xs text-amber-800">{m.tahmini}</p>}
          </div>
        </section>

        {v.odeme ? (
          <OdemeKarti
            iban={v.odeme.iban} hesapAdi={v.odeme.hesapAdi} link={null} aciklama={v.odeme.aciklama}
            metin={{
              baslik: portal.odemeBaslik, iban: portal.odemeIban, hesapAdi: portal.odemeHesapAdi, aciklama: portal.odemeAciklama,
              kopyala: portal.kopyala, kopyalandi: portal.kopyalandi, kartlaOde: portal.kartlaOde, kartlaOdeNot: portal.kartlaOdeNot, havaleNot: m.havaleNot,
            }}
          />
        ) : is.kalan > 0 && is.durum !== 'IPTAL' && <p className="px-1 text-sm text-slate-600">{m.odemeTeslimde}</p>}

        {(v.dosyalar.length > 0 || v.dosyaEklenebilir) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-700">{m.dosyalar}</h2>
            {v.dosyalar.map((d) => (
              <div key={d.id} className="mt-2 flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{d.ad}</span>
                <span className="shrink-0 text-slate-500">{d.sayfaSayisi ? doldur(m.sayfaBilgi, { n: d.sayfaSayisi }) : m.yuklendi}</span>
              </div>
            ))}
            {v.dosyaEklenebilir && (
              <div className="mt-3">
                <DosyaYukle hedef={{ tur: 'MUSTERI', kisaAd: v.kisaAd, jeton }} dil={v.dil} azamiMb={Math.round(DOSYA_AZAMI / 1024 / 1024)} yenile />
                <p className="mt-2 text-xs text-slate-500">{doldur(m.dosyaSakla, { gun: v.saklamaGun })}</p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          {v.firma.adres && <p><span className="font-semibold">{m.adres}:</span> {v.firma.adres}</p>}
          {v.firma.calisma && <p className="mt-1"><span className="font-semibold">{m.saatler}:</span> {v.firma.calisma}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">{m.whatsapp}</a>}
            {telHref && <a href={telHref} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{m.ara}</a>}
            {v.siparisAcik && <Link href={`${siparisYolu(v.kisaAd)}?tekrar=${jeton}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{m.tekrar}</Link>}
          </div>
        </section>
      </main>
    </div>
  );
}
