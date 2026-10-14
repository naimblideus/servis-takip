import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { etkinlikBul, etkinlikKodu, ETKINLIK_CEREZI } from '@/lib/kayit';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { sozluk, doldur } from '@/lib/i18n/sozluk';
import KayitFormu from './KayitFormu';

/**
 * /kayit — form istemcide (KayitFormu); burada yalnız basılı QR'ın ?k=kod'u
 * sunucuda çözülür. Böylece ilk HTML ve sekme başlığı etkinliğin kendi
 * süresini söyler, WhatsApp'ta paylaşılan bağlantının önizlemesi de.
 */
type Arama = Promise<Record<string, string | string[] | undefined>>;

// Adresteki kod; yoksa /pantum'un yazdığı etkinlik çerezi (bayi önce demoya girip oradan gelmiş olabilir).
const kodu = async (a: Record<string, string | string[] | undefined>) =>
  etkinlikKodu(typeof a.k === 'string' ? a.k : '', (await cookies()).get(ETKINLIK_CEREZI)?.value);

export async function generateMetadata({ searchParams }: { searchParams: Arama }): Promise<Metadata> {
  const etk = etkinlikBul(await kodu(await searchParams));
  const k = sozluk(await sunucuDili()).kayit;
  const baslik = `${etk ? doldur(k.baslikGun, { gun: etk.denemeGun }) : k.baslik} — Nextus Servis`;
  if (!etk) return { title: baslik };
  return { title: baslik, openGraph: { title: baslik, description: `${etk.ad} · ${doldur(k.etkinlikAvantaj, { gun: etk.denemeGun, kullanici: etk.kullanici })}` } };
}

export default async function KayitSayfasi({ searchParams }: { searchParams: Arama }) {
  const kod = await kodu(await searchParams);
  const etk = etkinlikBul(kod);
  return <KayitFormu ilkKod={etk ? kod : ''} ilk={etk ? { etkinlik: etk.ad, denemeGun: etk.denemeGun, kullanici: etk.kullanici } : null} />;
}
