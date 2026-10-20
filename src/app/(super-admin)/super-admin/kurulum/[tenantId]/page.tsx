import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { kurulumAyrintisi } from '@/lib/kurulum-veri';
import { kurulumMetni, kanitCumlesi, saglikCumlesi, mesajMetni, type KurulumMetni } from '@/lib/kurulum-metin';
import { waAdresi, gunMetni, NOT_EN_UZUN, type Adim } from '@/lib/kurulum';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';
import TakipFormu from './TakipFormu';
import NotFormu from './NotFormu';

export const dynamic = 'force-dynamic';

/**
 * KURULUM AYRINTISI — tek bayi: iletişim, bütün adımlar (kanıtıyla ve "nasıl"ıyla),
 * sağlık nedenleri, takip (sorumlu + sonraki temas) ve notlar.
 *
 * WhatsApp mesajı sıradaki adıma göre hazır gelir ama TEK TEK açılır; ekip
 * göndermeden okur. Toplu gönderim bilerek yok (az kullanılmış numaradan toplu
 * mesaj numarayı yaktırır, kişisel olmayan mesaj da okunmaz).
 */
const ROZET: Record<string, string> = {
  KIRMIZI: 'bg-red-500/20 text-red-200 border-red-400/40',
  SARI: 'bg-amber-500/20 text-amber-100 border-amber-400/40',
  YESIL: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
};
const kart = 'rounded-2xl border border-white/10 bg-white/5 p-4';
const altBaslik = 'mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400';

export default async function KurulumAyrintiSayfasi({ params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await getSuperAdminSession();
  if (!admin) redirect('/super-admin/login');

  const { tenantId } = await params;
  const dil = await sunucuDili();
  const m = kurulumMetni(dil);
  const veri = await kurulumAyrintisi(tenantId);
  if (!veri) notFound();
  const { satir: x, notlar, ekip } = veri;
  const yerel = dil === 'en' ? 'en-GB' : 'tr-TR';
  const tarih = (d: Date) => d.toLocaleDateString(yerel, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' });
  const saat = (d: Date) => d.toLocaleString(yerel, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

  const sonraki = x.kurulum.sonrakiAdim;
  const mesaj = mesajMetni(m, { yetkili: x.yetkili, firma: x.firma, sonraki: sonraki?.kod ?? null });
  const wa = waAdresi(x.telefon, mesaj);
  const tel = x.telefon ? `tel:${x.telefon.replace(/[^\d+]/g, '')}` : null;
  const zorunlu = x.kurulum.adimlar.filter((a) => a.zorunlu);
  const istege = x.kurulum.adimlar.filter((a) => !a.zorunlu);

  return (
    <div className="min-h-full">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-900/40 to-purple-900/40 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/super-admin/kurulum" className="inline-flex min-h-11 items-center text-sm text-violet-200 hover:underline">
            {m.geri}
          </Link>
          <h1 className="break-words text-2xl font-bold">{x.firma}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ROZET[x.saglik.renk]}`}>{m.renk[x.saglik.renk]}</span>
            <span className="text-gray-300">
              {m.sutun.kurulum} {doldur(m.zorunluSayi, { n: x.kurulum.zorunluTamam, t: x.kurulum.zorunluToplam })}
            </span>
            <span className="text-gray-300">· {sonraki ? m.sirada[sonraki.kod] : m.hepsiTamam}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className={kart}>
            <h2 className={altBaslik}>{m.adimlar}</h2>
            <AdimListesi baslik={m.zorunlu} adimlar={zorunlu} m={m} />
            <div className="h-4" />
            <AdimListesi baslik={m.istegeBagli} adimlar={istege} m={m} />
          </section>

          <section className={kart}>
            <h2 className={altBaslik}>{m.notlar}</h2>
            <NotFormu
              tenantId={x.tenantId}
              enUzun={NOT_EN_UZUN}
              m={{
                yeniNot: m.yeniNot,
                notTuru: m.notTuru,
                notYer: m.notYer,
                notUyari: m.notUyari,
                notKaydet: m.notKaydet,
                karakter: m.karakter,
                hata: m.hata,
              }}
            />
            {notlar.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">{m.notlarBos}</p>
            ) : (
              <ol className="mt-4 space-y-3 border-l border-white/10 pl-4">
                {notlar.map((n) => (
                  <li key={n.id}>
                    <div className="text-xs text-gray-400">
                      {saat(n.createdAt)} · {m.notTuru[n.tur as keyof typeof m.notTuru] ?? n.tur} · {n.yazanAd}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{n.metin}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className={kart}>
            <h2 className={altBaslik}>{m.iletisim}</h2>
            <dl className="space-y-2 text-sm">
              <Satir ad={m.yetkili} deger={x.yetkili ?? m.bilinmiyor} />
              <Satir ad={m.telefon} deger={x.telefon ?? m.bilinmiyor} />
              <Satir ad={m.eposta} deger={x.eposta ?? m.bilinmiyor} />
              <Satir ad={m.il} deger={x.il ?? m.bilinmiyor} />
              <Satir ad={m.acilis} deger={tarih(x.acilis)} />
            </dl>
            {x.kurulum.hazirGunu != null && <p className="mt-2 text-sm text-emerald-200">{doldur(m.hazirOldu, { n: x.kurulum.hazirGunu })}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-500">
                  {m.whatsapp}
                </a>
              )}
              {tel && (
                <a href={tel} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm hover:bg-white/10">
                  {m.ara}
                </a>
              )}
              {x.eposta && (
                <a href={`mailto:${x.eposta}`} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm hover:bg-white/10">
                  {m.eposta}
                </a>
              )}
            </div>
            {wa ? (
              <>
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-gray-300">{mesaj}</p>
                <p className="mt-1 text-xs text-gray-500">{m.mesajNotu}</p>
              </>
            ) : (
              <p className="mt-3 text-xs text-gray-500">{m.whatsappYok}</p>
            )}
          </section>

          <section className={kart}>
            <h2 className={altBaslik}>{m.saglikBaslik}</h2>
            {x.saglik.nedenler.length === 0 ? (
              <p className="text-sm text-gray-300">{m.saglikYesil}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {x.saglik.nedenler.map((n) => (
                  <li key={n.kod} className="flex items-start gap-2">
                    <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${n.renk === 'KIRMIZI' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span>{saglikCumlesi(m, n)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-white/10 pt-3 text-sm">
              <p className="text-gray-300">{x.acikSorun > 0 ? doldur(m.sorunlar, { n: x.acikSorun }) : m.sorunYok}</p>
              <Link
                href={`/super-admin/sorunlar?bayi=${encodeURIComponent(x.tenantId)}`}
                className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm hover:bg-white/10"
              >
                {m.sorunlaraGit}
              </Link>
            </div>
          </section>

          <section className={kart}>
            <h2 className={altBaslik}>{m.takip}</h2>
            <TakipFormu
              tenantId={x.tenantId}
              ekip={ekip}
              sorumluId={x.sorumluId}
              sonrakiTemas={x.sonrakiTemas ? gunMetni(x.sonrakiTemas) : ''}
              m={{ sorumlu: m.sorumlu, sorumluYok: m.sorumluYok, sonrakiTemas: m.sonrakiTemas, kaydet: m.kaydet, kaydedildi: m.kaydedildi, hata: m.hata }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function Satir({ ad, deger }: { ad: string; deger: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt className="text-gray-400">{ad}</dt>
      <dd className="min-w-0 break-words text-right">{deger}</dd>
    </div>
  );
}

const ISARET: Record<Adim['durum'], { simge: string; renk: string }> = {
  TAMAM: { simge: '✓', renk: 'bg-emerald-500/20 text-emerald-200' },
  UYGULANMAZ: { simge: '–', renk: 'bg-white/10 text-gray-300' },
  KISMEN: { simge: '◐', renk: 'bg-amber-500/20 text-amber-100' },
  EKSIK: { simge: '✗', renk: 'bg-red-500/20 text-red-200' },
};

function AdimListesi({ baslik, adimlar, m }: { baslik: string; adimlar: Adim[]; m: KurulumMetni }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-gray-300">{baslik}</h3>
      <ul className="space-y-2">
        {adimlar.map((a) => (
          <li key={a.kod} className="flex items-start gap-3 rounded-xl bg-black/20 p-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ISARET[a.durum].renk}`} aria-label={m.durum[a.durum]}>
              {ISARET[a.durum].simge}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <b>{m.ad[a.kod]}</b>
                <span className="text-xs text-gray-400">{m.durum[a.durum]}</span>
              </div>
              <div className="text-gray-300">{kanitCumlesi(m, a)}</div>
              {a.durum !== 'TAMAM' && a.durum !== 'UYGULANMAZ' && (
                <div className="mt-1 text-xs text-gray-400">
                  <span className="font-semibold text-gray-300">{m.nasilBaslik}: </span>
                  {m.nasil[a.kod]}{' '}
                  <span className="break-all">
                    {m.sayfa}: <code className="rounded bg-white/10 px-1">{a.yol}</code>
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
