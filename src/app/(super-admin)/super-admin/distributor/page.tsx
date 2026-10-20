import { redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { markaSec, TALEP_GUN, SAYFA_PENCERESI_GUN, type Sayi } from '@/lib/distributor';
import { distributorOzeti, duyuruListesi } from '@/lib/distributor-veri';
import { distributorMetni } from '@/lib/distributor-metin';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';
import DuyuruFormu from './DuyuruFormu';

export const dynamic = 'force-dynamic';

/**
 * DİSTRİBÜTÖR PANELİ — ör. Pantum Türkiye kendi markasının sahadaki toplu
 * verisini görür. Marka OTURUMDAN (lib/distributor markaSec): distribütörde
 * adres çubuğundaki ?marka= yok sayılır; sahip markayı seçer.
 *
 * Telefonda da açılır: tablolar kart gibi sarılır, dokunma hedefleri 44 px.
 * Sayı yetmediğinde 0 değil "yeterli veri yok" yazılır.
 */
export default async function DistributorSayfasi({ searchParams }: { searchParams: Promise<{ marka?: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) redirect('/super-admin/login');
  const dil = await sunucuDili();
  const m = distributorMetni(dil);
  const { marka: istenen } = await searchParams;
  const secim = markaSec({ rol: session.rol, marka: session.marka }, istenen ?? null);
  if (!secim.ok) {
    return <div className="p-4 sm:p-8"><p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{secim.hata === 'MARKA_YOK' ? m.markaYok : m.yetkiYok}</p></div>;
  }
  const marka = secim.marka;
  const [o, duyurular] = await Promise.all([distributorOzeti(marka), duyuruListesi(marka)]);
  const yerel = dil === 'en' ? 'en-GB' : 'tr-TR';
  const sayi = (n: number) => n.toLocaleString(yerel);
  const goster = (n: Sayi) => (n === null ? <span className="text-sm font-normal text-gray-400">{m.yetersiz}</span> : sayi(n));
  const sahip = session.rol === 'SAHIP';

  return (
    <div className="min-h-full">
      <div className="border-b border-white/10 bg-gradient-to-r from-sky-900/40 to-violet-900/40 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold">{session.rol === 'DISTRIBUTOR' && session.kurumAd ? session.kurumAd : m.baslik}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">{doldur(m.alt, { marka, k: o.esik })}</p>
          {sahip && (
            <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-sm text-gray-300">
                <span className="mb-1 block">{m.markaEtiket}</span>
                <input name="marka" defaultValue={marka} maxLength={40}
                  className="min-h-11 w-48 rounded-xl border border-white/10 bg-white/5 px-3 text-base text-white focus:border-violet-400 focus:outline-none" />
              </label>
              <button type="submit" className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500">{m.markaAc}</button>
              <span className="basis-full text-xs text-gray-500">{m.sahipNot}</span>
            </form>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {/* 1. BAYİ AĞI */}
        <Bolum baslik={m.ag.baslik}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Kutu ad={m.ag.bayi}>{goster(o.ag.bayi)}</Kutu>
            <Kutu ad={m.ag.adIzinli}>{goster(o.ag.adIzinli)}</Kutu>
          </div>
          <h3 className="mt-4 mb-2 text-sm font-semibold text-gray-300">{m.ag.liste}</h3>
          {o.ag.adli.length === 0 ? (
            <p className="text-sm text-gray-400">{m.ag.listeBos}</p>
          ) : (
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {o.ag.adli.map((b, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <b className="min-w-0 flex-1 basis-40 text-white">{b.ad}</b>
                  <span className="text-gray-400">{b.il ?? m.park.ilYok}</span>
                  {b.cihaz !== null && <span className="text-gray-300">{sayi(b.cihaz)} {m.sutunCihaz.toLocaleLowerCase(yerel)}</span>}
                  {(b.telefon || b.eposta) && (
                    <span className="flex basis-full flex-wrap gap-x-3 text-xs">
                      {b.telefon && <a href={`tel:${b.telefon.replace(/[^0-9+]/g, '')}`} className="inline-flex min-h-11 items-center text-sky-300 hover:underline">{b.telefon}</a>}
                      {b.eposta && <a href={`mailto:${b.eposta}`} className="inline-flex min-h-11 items-center break-all text-sky-300 hover:underline">{b.eposta}</a>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {o.ag.adliSayiGizli && <p className="mt-2 text-xs text-gray-500">{doldur(m.ag.sayiGizli, { k: o.esik })}</p>}
        </Bolum>

        {/* 2. MARKA PARKI */}
        <Bolum baslik={m.park.baslik}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Kutu ad={m.park.cihaz}>{goster(o.park.cihaz)}</Kutu>
            <Kutu ad={m.park.aylik} alt={o.park.sayfaOlculenCihaz === null ? undefined : doldur(m.park.aylikAlt, { g: SAYFA_PENCERESI_GUN, n: o.park.sayfaOlculenCihaz })}>{goster(o.park.aylikSayfa)}</Kutu>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Liste baslik={m.park.modeller} sutunlar={[m.sutunModel, m.sutunCihaz]} bos={m.yetersiz}
              satirlar={o.park.modeller.map((x) => [x.model, sayi(x.cihaz)])} gizli={o.park.gizliModel} gizliMetin={m.gizliSatir} />
            <Liste baslik={m.park.iller} sutunlar={[m.ag.sutunIl, m.sutunCihaz]} bos={m.yetersiz}
              satirlar={o.park.iller.map((x) => [x.il ?? m.park.ilYok, sayi(x.cihaz)])} gizli={o.park.gizliIl} gizliMetin={m.gizliSatir} />
          </div>
        </Bolum>

        {/* 3. ORİJİNAL TONER PAYI */}
        <Bolum baslik={m.toner.baslik}>
          {o.toner.pay === null ? (
            <p className="text-sm text-gray-400">{m.yetersiz}</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <span className="bg-emerald-500" style={{ width: `${o.toner.pay.orijinal}%` }} />
                <span className="bg-amber-400" style={{ width: `${o.toner.pay.uyumlu}%` }} />
                <span className="bg-gray-500" style={{ width: `${o.toner.pay.bilinmeyen}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Kutu ad={m.toner.orijinal}>{yuzde(o.toner.pay.orijinal, dil)}</Kutu>
                <Kutu ad={m.toner.uyumlu}>{yuzde(o.toner.pay.uyumlu, dil)}</Kutu>
                <Kutu ad={m.toner.bilinmeyen}>{yuzde(o.toner.pay.bilinmeyen, dil)}</Kutu>
              </div>
              <p className="mt-2 text-xs text-gray-400">{doldur(m.toner.toplam, { n: o.toner.pay.toplam })}</p>
            </>
          )}
          <p className="mt-2 text-xs text-gray-500">{doldur(m.toner.kaynak, { g: o.toner.gun })}</p>
        </Bolum>

        {/* 4. 30 GÜNLÜK TALEP */}
        <Bolum baslik={doldur(m.talep.baslik, { g: TALEP_GUN })}>
          <p className="mb-3 text-xs text-gray-500">{m.talep.alt}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Kutu ad={m.talep.tonerToplam}>{goster(o.talep.tonerToplam)}</Kutu>
            <Kutu ad={m.talep.parcaToplam}>{goster(o.talep.parcaToplam)}</Kutu>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Liste baslik={m.talep.toner} sutunlar={[m.sutunModel, m.talep.sutunRenk, m.talep.sutunKod, m.sutunAdet]} bos={m.talep.bos}
              satirlar={o.talep.toner.map((x) => [x.model, x.kanal === 'BLACK' ? m.talep.siyah : m.talep.renkli, x.kod ?? m.talep.kodYok, sayi(x.adet)])} />
            <Liste baslik={m.talep.parca} sutunlar={[m.sutunModel, m.talep.sutunParca, m.sutunAdet]} bos={m.talep.bos}
              satirlar={o.talep.parca.map((x) => [x.model, m.talep.tur[x.tur] ?? m.talep.tur.DIGER, sayi(x.adet)])} />
          </div>
          {o.talep.gizli > 0 && <p className="mt-2 text-xs text-gray-500">{doldur(m.gizliSatir, { n: o.talep.gizli })}</p>}
        </Bolum>

        {/* 5. MODEL GÜVENİLİRLİĞİ + GERÇEK VERİM */}
        <Bolum baslik={m.guven.baslik}>
          <p className="mb-3 text-xs text-gray-500">{doldur(m.guven.alt, { a: o.guvenilirlik.pencereAy })}</p>
          <Liste
            sutunlar={[m.sutunModel, m.sutunCihaz, m.guven.sutunAriza, m.guven.sutunMtbf, m.guven.sutunGercek, m.guven.sutunKutu]}
            bos={doldur(m.guven.bos, { k: o.esik })}
            satirlar={o.guvenilirlik.satirlar.map((x) => [
              x.model,
              sayi(x.cihaz),
              x.arizaYil === null ? m.yetersiz : x.arizaYil.toLocaleString(yerel),
              x.mtbfGun === null ? m.yetersiz : doldur(m.guven.gun, { n: sayi(x.mtbfGun) }),
              x.gercekVerim === null ? m.yetersiz : `${doldur(m.guven.sayfa, { n: sayi(x.gercekVerim) })} · ${doldur(m.guven.gozlem, { n: x.gozlem })}`,
              x.kutuVerimi === null ? m.yetersiz : doldur(m.guven.sayfa, { n: sayi(x.kutuVerimi) }),
            ])}
            gizli={o.guvenilirlik.gizli}
            gizliMetin={m.gizliSatir}
          />
        </Bolum>

        {/* 6. DUYURULAR */}
        <Bolum baslik={m.duyuru.baslik}>
          <p className="mb-3 text-xs text-gray-500">{m.duyuru.alt}</p>
          <DuyuruFormu marka={sahip ? marka : null} duyurular={duyurular} />
        </Bolum>

        <p className="text-xs text-gray-600">{doldur(m.hesaplandi, { t: new Date(o.uretildi).toLocaleString(yerel, { dateStyle: 'short', timeStyle: 'short' }) })}</p>
      </div>
    </div>
  );
}

const yuzde = (n: number, dil: string) => (dil === 'en' ? `${n}%` : `%${n}`);

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <h2 className="mb-3 text-lg font-bold">{baslik}</h2>
      {children}
    </section>
  );
}

function Kutu({ ad, alt, children }: { ad: string; alt?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-xs text-gray-400">{ad}</div>
      <div className="mt-1 text-2xl font-bold text-white">{children}</div>
      {alt && <div className="mt-0.5 text-xs text-gray-500">{alt}</div>}
    </div>
  );
}

function Liste({ baslik, sutunlar, satirlar, bos, gizli = 0, gizliMetin }: {
  baslik?: string; sutunlar: string[]; satirlar: string[][]; bos: string; gizli?: number; gizliMetin?: string;
}) {
  return (
    <div>
      {baslik && <h3 className="mb-2 text-sm font-semibold text-gray-300">{baslik}</h3>}
      {satirlar.length === 0 ? (
        <p className="text-sm text-gray-400">{bos}</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
          {satirlar.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm">
              <b className="min-w-0 flex-1 basis-32 break-words text-white">{s[0]}</b>
              {s.slice(1).map((h, j) => (
                <span key={j} className="text-gray-300">
                  <span className="mr-1 text-xs text-gray-500">{sutunlar[j + 1]}:</span>{h}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {gizli > 0 && gizliMetin && <p className="mt-1.5 text-xs text-gray-500">{doldur(gizliMetin, { n: gizli })}</p>}
    </div>
  );
}
