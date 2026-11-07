import type { Metadata } from 'next';
import Link from 'next/link';
import { davetBul } from '@/lib/kullanici-davet';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { sozluk, doldur } from '@/lib/i18n/sozluk';
import DilSecici from '@/components/DilSecici';
import Monogram from '@/components/Monogram';
import DavetFormu from './DavetFormu';

export const dynamic = 'force-dynamic';

// Adres çubuğunda tek kullanımlık jeton var: başka siteye "nereden geldim"
// bilgisiyle gitmesin, arama motoruna da girmesin (sifre-yenile ile aynı).
export const metadata: Metadata = {
  title: 'Nextus Servis',
  referrer: 'no-referrer',
  robots: { index: false },
};

/**
 * DAVET — yöneticinin eklediği kişi şifresini kendisi belirler.
 *
 * Bağlantı geçersizse (yok, süresi geçmiş, kullanılmış) NEDENİ söylenmez ve
 * form gösterilmez. Geçerliyse yalnız firma adı, kişinin adı ve giriş adı
 * görünür; başka hiçbir bayi verisi bu sayfaya gelmez.
 */
export default async function DavetSayfasi({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const k = sozluk(await sunucuDili()).davet;
  const d = await davetBul(jeton);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-6 top-6 sm:right-12"><DilSecici /></div>
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex items-center gap-3">
            <Monogram />
            <span className="text-[19px] font-bold tracking-tight">Nextus Servis</span>
          </Link>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            {d ? `${k.baslik}, ${d.ad.trim().split(/\s+/)[0] ?? ''}` : k.baslik}
          </h1>
          {d ? (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-white/45">{doldur(k.alt, { firma: d.firma })}</p>
              <DavetFormu jeton={jeton} giris={d.giris} />
            </>
          ) : (
            <div role="alert" className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[15px] text-white/80">{k.gecersiz}</p>
            </div>
          )}
          <Link href="/login" className="mt-8 block text-center text-[14px] text-white/50 transition hover:text-white/80">{k.girise}</Link>
        </div>
      </div>
    </div>
  );
}
