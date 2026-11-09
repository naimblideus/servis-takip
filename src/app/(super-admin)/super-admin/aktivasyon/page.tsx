import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { aktivasyonListesi, type AktivasyonSatiri, type NedenKodu } from '@/lib/aktivasyon';
import { aktivasyonMetni, type AktivasyonMetni } from '@/lib/aktivasyon-metin';
import { anHesaplari } from '@/lib/aktivasyon-an-veri';
import {
  AZ_ODEYEN,
  VARSAYILAN_AN,
  haftalikOran,
  isKoduMu,
  odeyenlerTablosu,
  sonBitenHafta,
  type HaftaSatiri,
  type IsKodu,
  type OdeyenTablosu,
} from '@/lib/aktivasyon-an';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

/**
 * BUGÜN KİMİ ARAMALI — deneme hesaplarının aktivasyon listesi.
 *
 * Satın alma kararı denemenin sonunda değil, bayinin kendi rakamını gördüğü
 * an veriliyor. Bu ekran her hesabın o ana giden yolda nerede durduğunu ve
 * bugünkü aramanın sebebini tek cümleyle söyler; WhatsApp mesajı sebebe göre
 * hazır gelir (kişisel, tek tek — toplu gönderim yok).
 */
export default async function AktivasyonSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; o?: string; an?: string }>;
}) {
  const admin = await getSuperAdminSession();
  if (!admin) redirect('/super-admin/login');

  const { t, o, an } = await searchParams;
  const sadeceToplanti = t === 'toplanti';
  const odeyenlerDahil = o === '1';
  const elleAn = isKoduMu(an) ? an : null;
  const m = aktivasyonMetni(await sunucuDili());
  const simdi = new Date();
  const [liste, hesaplar] = await Promise.all([aktivasyonListesi({ sadeceToplanti, odeyenlerDahil, simdi }), anHesaplari()]);

  // O an: elle seçilen > tablonun bulduğu > varsayım (sayaç).
  const tablo = odeyenlerTablosu(hesaplar, simdi);
  const seciliAn: IsKodu = elleAn ?? tablo.an ?? VARSAYILAN_AN;
  const anKaynagi = elleAn ? 'secili' : tablo.an ? 'tablo' : 'varsayim';
  const haftalar = haftalikOran(hesaplar, seciliAn, simdi);

  const cip = (aktif: boolean) =>
    `px-3 py-1.5 rounded-xl text-sm border ${aktif ? 'bg-blue-100 border-blue-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`;
  const adres = (yeniT: string | null, yeniO: boolean, yeniAn: IsKodu | null = elleAn) =>
    `/super-admin/aktivasyon?${new URLSearchParams({ ...(yeniT ? { t: yeniT } : {}), ...(yeniO ? { o: '1' } : {}), ...(yeniAn ? { an: yeniAn } : {}) })}`;
  const anAdresi = (yeniAn: IsKodu | null) => adres(sadeceToplanti ? 'toplanti' : null, odeyenlerDahil, yeniAn);

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">{m.baslik}</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-3xl">{m.alt}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={adres(null, odeyenlerDahil)} className={cip(!sadeceToplanti)}>{m.hepsi}</Link>
            <Link href={adres('toplanti', odeyenlerDahil)} className={cip(sadeceToplanti)}>{m.sadeceToplanti}</Link>
            <Link href={adres(sadeceToplanti ? 'toplanti' : null, !odeyenlerDahil)} className={cip(odeyenlerDahil)}>{m.odeyenlerDahil}</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <TekSayi m={m} haftalar={haftalar} an={seciliAn} kaynak={anKaynagi} sifirla={elleAn ? anAdresi(null) : null} />
        <OdeyenlerTablosu m={m} tablo={tablo} seciliAn={seciliAn} acik={!!elleAn} anAdresi={anAdresi} />

        {/* Huni özeti: kaç hesap hangi adımda. */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {m.adimlar.map((ad, i) => (
            <div key={ad} className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{ad}</div>
              <div className="text-xl font-bold">{liste.filter((s) => s.adim >= i).length}</div>
            </div>
          ))}
        </div>

        {liste.length === 0 ? (
          <p className="text-gray-500">{m.bos}</p>
        ) : (
          <ul className="space-y-2">
            {liste.map((s) => (
              <Satir key={s.tenantId} s={s} m={m} simdi={simdi} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Satir({ s, m, simdi }: { s: AktivasyonSatiri; m: AktivasyonMetni; simdi: Date }) {
  const kalan = s.denemeBitis ? Math.ceil((s.denemeBitis.getTime() - simdi.getTime()) / 86_400_000) : null;
  const wa = waBaglantisi(s.telefon, mesaj(s, m, kalan));
  const tel = s.telefon ? `tel:${s.telefon.replace(/[^\d+]/g, '')}` : null;
  const acil = s.oncelik <= 2;

  return (
    <li className={`rounded-2xl border px-4 py-3 ${acil ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/super-admin/tenants/${s.tenantId}`} className="font-semibold hover:underline">
              {s.firma}
            </Link>
            {s.etkinlik && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{m.toplanti}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {[s.yetkili, s.il].filter(Boolean).join(' · ')}
            {s.yetkili || s.il ? ' · ' : ''}
            {doldur(m.sayilar, { m: s.sayilar.musteri, c: s.sayilar.cihaz, s: s.sayilar.okuma, k: s.sayilar.kullanici })}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {kalan == null ? '' : kalan <= 0 ? m.denemeBitti : doldur(m.denemeKalan, { n: kalan })}
            {kalan == null ? '' : ' · '}
            {s.sonHareket ? doldur(m.sonHareket, { t: s.sonHareket.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) }) : m.hareketYok}
          </div>
        </div>

        {/* Adım çubuğu: 6 nokta, ulaşılan adıma kadar dolu. */}
        <div className="flex items-center gap-1 pt-1" title={m.adimlar[s.adim]}>
          {m.adimlar.map((ad, i) => (
            <span
              key={ad}
              title={ad}
              className={`h-2.5 w-6 rounded-full ${i <= s.adim ? (s.adim >= 3 ? 'bg-emerald-500' : 'bg-sky-500') : 'bg-gray-100'}`}
            />
          ))}
        </div>

        <div className="min-w-[240px] flex-1 text-sm">{m.neden[s.neden as NedenKodu]}</div>

        <div className="flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500">
              WhatsApp
            </a>
          )}
          {tel && (
            <a href={tel} className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
              {m.sutunAra}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

const kisaTarih = (gun: string) =>
  new Date(`${gun}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Tepedeki tek sayı: 7 günü dolmuş son haftada açılan hesapların yüzde kaçı
 * ilk 7 günde o ana vardı; yanında son 8 hafta. Kurulumda değiştirdiğimiz
 * her şeyin işe yarayıp yaramadığı burada görünür.
 */
function TekSayi({
  m,
  haftalar,
  an,
  kaynak,
  sifirla,
}: {
  m: AktivasyonMetni;
  haftalar: HaftaSatiri[];
  an: IsKodu;
  kaynak: keyof AktivasyonMetni['anKaynak'];
  sifirla: string | null;
}) {
  const son = sonBitenHafta(haftalar);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
      <h2 className="text-sm font-medium text-gray-600">{m.tekSayiBaslik}</h2>
      <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="min-w-[200px]">
          <div className="text-5xl font-bold tabular-nums">{son?.yuzde != null ? `%${son.yuzde}` : '—'}</div>
          <div className="mt-1 text-sm text-gray-600">
            {son ? doldur(m.tekSayiAlt, { h: kisaTarih(son.hafta), v: son.varan, n: son.acilan, an: m.isler[an] }) : m.tekSayiYok}
          </div>
        </div>
        {/* Son 8 hafta, eskiden yeniye. Açık renk = 7 günü dolmamış hesap var, sayı artabilir. */}
        <div className="flex items-start gap-1.5">
          {haftalar.map((h) => (
            <div key={h.hafta} className="flex w-8 flex-col items-center gap-1">
              <div className="text-[11px] tabular-nums text-gray-700">{h.yuzde == null ? '–' : `%${h.yuzde}`}</div>
              <div className="flex h-14 w-5 items-end overflow-hidden rounded bg-gray-100">
                <div className={`w-full ${h.suruyor ? 'bg-sky-300' : 'bg-emerald-500'}`} style={{ height: `${h.yuzde ?? 0}%` }} />
              </div>
              <div className="text-[10px] leading-tight text-gray-500">{kisaTarih(h.hafta)}</div>
              <div className="text-[10px] leading-tight tabular-nums text-gray-500">
                {h.varan}/{h.acilan}
              </div>
              {h.suruyor && <div className="text-[10px] leading-tight text-sky-800">{m.suruyor}</div>}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{doldur(m.anSatiri, { an: m.isler[an] })}</span> · {m.anKaynak[kaynak]}
        {sifirla && (
          <>
            {' · '}
            <Link href={sifirla} className="text-blue-700 hover:underline">
              {m.anSifirla}
            </Link>
          </>
        )}
      </p>
    </section>
  );
}

/**
 * Ödeyenler ilk 7 günde ne yaptı: her iş için ödeyen ve denemesi bitip
 * ödemeyen hesapların yüzdesi yan yana; en büyük fark o an. Günlük arama
 * listesini aşağı itmesin diye kapalı gelir.
 */
function OdeyenlerTablosu({
  m,
  tablo,
  seciliAn,
  acik,
  anAdresi,
}: {
  m: AktivasyonMetni;
  tablo: OdeyenTablosu;
  seciliAn: IsKodu;
  acik: boolean;
  anAdresi: (an: IsKodu) => string;
}) {
  const karsilastirilir = tablo.odeyenN > 0 && tablo.odemeyenN > 0;
  const yuzde = (x: number | null) => (x == null ? '—' : `%${x}`);
  return (
    <details open={acik} className="mb-6 rounded-2xl border border-gray-200 bg-white">
      <summary className="cursor-pointer px-5 py-3 font-semibold">
        {m.tabloBaslik}
        <span className="ml-2 text-sm font-normal text-gray-500">{doldur(m.tabloOzet, { a: tablo.odeyenN, b: tablo.odemeyenN })}</span>
      </summary>
      <div className="px-5 pb-5">
        <p className="max-w-3xl text-sm text-gray-600">{m.tabloAlt}</p>
        {!karsilastirilir ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{m.karsilastirmaYok}</p>
        ) : (
          tablo.odeyenN < AZ_ODEYEN && (
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{doldur(m.azUyari, { n: tablo.odeyenN })}</p>
          )
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">{m.sutunIs}</th>
                <th className="py-2 pr-3 text-right font-medium">
                  {m.sutunOdeyen} ({tablo.odeyenN})
                </th>
                <th className="py-2 pr-3 text-right font-medium">
                  {m.sutunOdemeyen} ({tablo.odemeyenN})
                </th>
                <th className="py-2 text-right font-medium">{m.sutunFark}</th>
              </tr>
            </thead>
            <tbody>
              {tablo.satirlar.map((s) => (
                <tr key={s.kod} className={`border-b border-gray-100 ${s.kod === seciliAn ? 'bg-emerald-50' : ''}`}>
                  <td className="py-2 pr-3">
                    <Link href={anAdresi(s.kod)} className="hover:underline">
                      {m.isler[s.kod]}
                    </Link>
                    {s.kod === tablo.an && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">{m.anIsareti}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{yuzde(s.odeyen)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{yuzde(s.odemeyen)}</td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${s.fark != null && s.fark > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {s.fark == null ? '—' : s.fark > 0 ? `+${s.fark}` : s.fark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">{m.belirsizNot}</p>
      </div>
    </details>
  );
}

/** Sebebe göre hazır mesaj — kişisel, adıyla. Toplu gönderim yok. */
function mesaj(s: AktivasyonSatiri, m: AktivasyonMetni, kalan: number | null): string {
  const ad = (s.yetkili ?? s.firma).trim().split(/\s+/)[0] ?? '';
  const n = s.neden;
  const sablon =
    n === 'BITIYOR_HAZIR' || n === 'BITIYOR_EKSIK'
      ? m.mesaj.BITIYOR
      : n === 'ODEDI'
        ? m.mesaj.ODEDI
        : n === 'SICAK'
          ? m.mesaj.SICAK
          : s.adim === 0
            ? m.mesaj.GIRIS_YOK
            : s.adim === 1
              ? m.mesaj.CIHAZ_YOK
              : s.adim === 2
                ? m.mesaj.SAYAC_YOK
                : m.mesaj.EKIP_YOK;
  return doldur(sablon, { ad, n: Math.max(0, kalan ?? 0) });
}

function waBaglantisi(telefon: string | null, metin: string): string | null {
  if (!telefon) return null;
  let d = telefon.replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  // Yalnız cep: sabit hatta WhatsApp yok.
  if (!/^905\d{9}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(metin)}`;
}
