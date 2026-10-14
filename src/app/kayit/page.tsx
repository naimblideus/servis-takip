import type { Metadata } from 'next';
import { etkinlikBul } from '@/lib/kayit';
import KayitFormu from './KayitFormu';

/**
 * /kayit — form istemcide (KayitFormu); burada yalnız basılı QR'ın ?k=kod'u
 * sunucuda çözülür. Böylece ilk HTML ve sekme başlığı etkinliğin kendi
 * süresini söyler, WhatsApp'ta paylaşılan bağlantının önizlemesi de.
 */
type Arama = Promise<Record<string, string | string[] | undefined>>;

const kodu = (a: Record<string, string | string[] | undefined>) => (typeof a.k === 'string' ? a.k.slice(0, 40) : '');

export async function generateMetadata({ searchParams }: { searchParams: Arama }): Promise<Metadata> {
  const etk = etkinlikBul(kodu(await searchParams));
  if (!etk) return {};
  const baslik = `${etk.denemeGun} gün ücretsiz deneyin — Nextus Servis`;
  return { title: baslik, openGraph: { title: baslik, description: `${etk.ad} · ${etk.denemeGun} gün ücretsiz · ${etk.kullanici} kullanıcı · kurulumu biz yapıyoruz` } };
}

export default async function KayitSayfasi({ searchParams }: { searchParams: Arama }) {
  const kod = kodu(await searchParams);
  const etk = etkinlikBul(kod);
  return <KayitFormu ilkKod={etk ? kod : ''} ilk={etk ? { etkinlik: etk.ad, denemeGun: etk.denemeGun, kullanici: etk.kullanici } : null} />;
}
