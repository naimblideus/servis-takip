import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { kurulumListesi, type KurulumSatiri } from '@/lib/kurulum-veri';
import { kurulumMetni, saglikCumlesi, type KurulumMetni } from '@/lib/kurulum-metin';
import { ortanca, gunBasi } from '@/lib/kurulum';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

/**
 * KURULUM VE BAŞARI — ekibin bütün bayileri tek listede gördüğü ekran.
 *
 * Tek bakışta üç soru: kurulum nerede (n/5 çubuğu), sıradaki iş ne (tek cümle),
 * bugün kimi arayacağım (varsayılan sekme). Liste veriden dolar; ekip yalnız
 * sorumlu, sonraki temas ve not yazar (ayrıntı ekranında).
 *
 * Telefonda da açılıyor (saha ziyaretinde): satırlar tablo değil, sarılan
 * kart; dokunma hedefleri en az 44 px.
 */
type Sekme = 'bugun' | 'kurulumda' | 'kullanimda' | 'hepsi';
const SEKMELER: Sekme[] = ['bugun', 'kurulumda', 'kullanimda', 'hepsi'];

export default async function KurulumSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; benim?: string }>;
}) {
  const admin = await getSuperAdminSession();
  if (!admin) redirect('/super-admin/login');

  const { s, benim } = await searchParams;
  const sekme: Sekme = SEKMELER.includes(s as Sekme) ? (s as Sekme) : 'bugun';
  const benimki = benim === '1';
  const dil = await sunucuDili();
  const m = kurulumMetni(dil);
  const simdi = new Date();
  const hepsi = await kurulumListesi({ simdi });

  const kurulumda = hepsi.filter((x) => !x.kurulum.hazir);
  const hazir = hepsi.filter((x) => x.kurulum.hazir);
  const hazirGun = ortanca(hazir.map((x) => x.kurulum.hazirGunu).filter((n): n is number => n != null));
  const aranacak = hepsi.filter((x) => x.bugunAranacak);

  const kapsam = benimki ? hepsi.filter((x) => x.sorumluId === admin.id) : hepsi;
  const liste =
    sekme === 'bugun'
      ? kapsam.filter((x) => x.bugunAranacak)
      : sekme === 'kurulumda'
        ? kapsam.filter((x) => !x.kurulum.hazir)
        : sekme === 'kullanimda'
          ? kapsam.filter((x) => x.kurulum.hazir)
          : kapsam;

  const adres = (yeni: Sekme, b: boolean) =>
    `/super-admin/kurulum?${new URLSearchParams({ s: yeni, ...(b ? { benim: '1' } : {}) })}`;
  const cip = (aktif: boolean) =>
    `inline-flex min-h-11 items-center rounded-xl border px-3 text-sm ${aktif ? 'border-violet-400/60 bg-violet-600/30 text-white' : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10'}`;
  const yerel = dil === 'en' ? 'en-GB' : 'tr-TR';

  return (
    <div className="min-h-full">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-900/40 to-purple-900/40 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">{m.baslik}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">{m.alt}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Üç sayı: ekibin sabah baktığı tek özet. */}
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Sayi ad={m.kurulumda} deger={kurulumda.length} />
          <Sayi
            ad={m.hazir}
            deger={hazir.length}
            alt={hazirGun == null ? m.ortancaYok : doldur(m.ortancaGun, { n: hazirGun })}
          />
          <Sayi ad={m.bugunAranacak} deger={aranacak.length} vurgu />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {SEKMELER.map((k) => (
            <Link key={k} href={adres(k, benimki)} className={cip(sekme === k)}>
              {m.sekme[k]}
            </Link>
          ))}
          <Link href={adres(sekme, !benimki)} className={cip(benimki)}>
            {m.benim}
          </Link>
        </div>

        {liste.length === 0 ? (
          <p className="text-gray-400">{m.bos}</p>
        ) : (
          <ul className="space-y-2">
            {liste.map((x) => (
              <Satir key={x.tenantId} x={x} m={m} simdi={simdi} yerel={yerel} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Sayi({ ad, deger, alt, vurgu }: { ad: string; deger: number; alt?: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${vurgu ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
      <div className="text-xs uppercase tracking-wide text-gray-400">{ad}</div>
      <div className="text-2xl font-bold">{deger}</div>
      {alt && <div className="text-xs text-gray-400">{alt}</div>}
    </div>
  );
}

const ROZET: Record<string, string> = {
  KIRMIZI: 'bg-red-500/20 text-red-200 border-red-400/40',
  SARI: 'bg-amber-500/20 text-amber-100 border-amber-400/40',
  YESIL: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
};

function Satir({ x, m, simdi, yerel }: { x: KurulumSatiri; m: KurulumMetni; simdi: Date; yerel: string }) {
  const k = x.kurulum;
  const ilkNeden = x.saglik.nedenler[0];
  const tarih = (d: Date) => d.toLocaleDateString(yerel, { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' });
  const bugunBasi = gunBasi(simdi).getTime();
  const temas = x.sonrakiTemas;
  const temasMetni = !temas
    ? m.tarihYok
    : temas.getTime() < bugunBasi
      ? `${m.gecti} · ${tarih(temas)}`
      : temas.getTime() < bugunBasi + 86_400_000
        ? m.bugun
        : tarih(temas);

  return (
    <li className={`rounded-2xl border px-4 py-3 ${x.saglik.renk === 'KIRMIZI' ? 'border-red-400/40 bg-red-500/5' : 'border-white/10 bg-white/5'}`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <div className="break-words font-semibold">{x.firma}</div>
          <div className="text-xs text-gray-400">
            {[x.il, doldur(m.cihazSayisi, { n: x.cihaz })].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Zorunlu adım çubuğu: 5 parça, biten (ya da gerekmeyen) dolu. */}
        <div className="basis-28">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{m.sutun.kurulum}</div>
          <div className="mt-1 flex items-center gap-1" aria-label={doldur(m.zorunluSayi, { n: k.zorunluTamam, t: k.zorunluToplam })}>
            {k.adimlar
              .filter((a) => a.zorunlu)
              .map((a) => (
                <span
                  key={a.kod}
                  title={`${m.ad[a.kod]}: ${m.durum[a.durum]}`}
                  className={`h-2.5 w-5 rounded-full ${a.durum === 'TAMAM' || a.durum === 'UYGULANMAZ' ? 'bg-emerald-400' : a.durum === 'KISMEN' ? 'bg-amber-400' : 'bg-white/15'}`}
                />
              ))}
            <span className="ml-1 text-xs text-gray-300">{doldur(m.zorunluSayi, { n: k.zorunluTamam, t: k.zorunluToplam })}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 basis-60 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{m.sutun.sirada}</div>
          <div>{k.sonrakiAdim ? m.sirada[k.sonrakiAdim.kod] : m.hepsiTamam}</div>
        </div>

        <div className="min-w-0 flex-1 basis-48 text-sm">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${ROZET[x.saglik.renk]}`}>
            {m.renk[x.saglik.renk]}
          </span>
          {ilkNeden && <div className="mt-1 text-xs text-gray-300">{saglikCumlesi(m, ilkNeden)}</div>}
        </div>

        <div className="grid basis-52 grid-cols-3 gap-2 text-xs text-gray-300">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.sutun.sorumlu}</div>
            <div className="break-words">{x.sorumluAd ?? m.sorumluYok}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.sutun.sonNot}</div>
            <div>{x.sonNot ? tarih(x.sonNot) : m.notYok}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.sutun.sonrakiTemas}</div>
            <div className={temas && temas.getTime() < bugunBasi ? 'text-red-300' : ''}>{temasMetni}</div>
          </div>
        </div>

        <Link
          href={`/super-admin/kurulum/${x.tenantId}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10"
        >
          {m.ayrinti}
        </Link>
      </div>
    </li>
  );
}
