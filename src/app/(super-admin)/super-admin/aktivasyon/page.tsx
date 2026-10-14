import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { aktivasyonListesi, type AktivasyonSatiri, type NedenKodu } from '@/lib/aktivasyon';
import { aktivasyonMetni, type AktivasyonMetni } from '@/lib/aktivasyon-metin';
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
  searchParams: Promise<{ t?: string; o?: string }>;
}) {
  const admin = await getSuperAdminSession();
  if (!admin) redirect('/super-admin/login');

  const { t, o } = await searchParams;
  const sadeceToplanti = t === 'toplanti';
  const odeyenlerDahil = o === '1';
  const m = aktivasyonMetni(await sunucuDili());
  const simdi = new Date();
  const liste = await aktivasyonListesi({ sadeceToplanti, odeyenlerDahil, simdi });

  const cip = (aktif: boolean) =>
    `px-3 py-1.5 rounded-xl text-sm border ${aktif ? 'bg-violet-600/30 border-violet-400/60 text-white' : 'bg-white/5 border-white/10 text-white/85 hover:bg-white/10'}`;
  const adres = (yeniT: string | null, yeniO: boolean) =>
    `/super-admin/aktivasyon?${new URLSearchParams({ ...(yeniT ? { t: yeniT } : {}), ...(yeniO ? { o: '1' } : {}) })}`;

  return (
    <div className="min-h-full">
      <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">{m.baslik}</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-3xl">{m.alt}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={adres(null, odeyenlerDahil)} className={cip(!sadeceToplanti)}>{m.hepsi}</Link>
            <Link href={adres('toplanti', odeyenlerDahil)} className={cip(sadeceToplanti)}>{m.sadeceToplanti}</Link>
            <Link href={adres(sadeceToplanti ? 'toplanti' : null, !odeyenlerDahil)} className={cip(odeyenlerDahil)}>{m.odeyenlerDahil}</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Huni özeti: kaç hesap hangi adımda. */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {m.adimlar.map((ad, i) => (
            <div key={ad} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-400">{ad}</div>
              <div className="text-xl font-bold">{liste.filter((s) => s.adim >= i).length}</div>
            </div>
          ))}
        </div>

        {liste.length === 0 ? (
          <p className="text-gray-400">{m.bos}</p>
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
    <li className={`rounded-2xl border px-4 py-3 ${acil ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/super-admin/tenants/${s.tenantId}`} className="font-semibold hover:underline">
              {s.firma}
            </Link>
            {s.etkinlik && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] text-violet-200">{m.toplanti}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
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
              className={`h-2.5 w-6 rounded-full ${i <= s.adim ? (s.adim >= 3 ? 'bg-emerald-400' : 'bg-sky-400') : 'bg-white/10'}`}
            />
          ))}
        </div>

        <div className="min-w-[240px] flex-1 text-sm">{m.neden[s.neden as NedenKodu]}</div>

        <div className="flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500">
              WhatsApp
            </a>
          )}
          {tel && (
            <a href={tel} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10">
              {m.sutunAra}
            </a>
          )}
        </div>
      </div>
    </li>
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
