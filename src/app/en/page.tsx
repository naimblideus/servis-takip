import type { Metadata } from 'next';
import LandingEn from '../_landing/LandingEn';

export const metadata: Metadata = {
  title: 'Nextus Servis — meter reading, rental billing and service software for copier dealers',
  description:
    'For printer and copier rental and service dealers: read the meter and the system raises the rent invoice. Service tickets, barcoded stock, payment tracking and a lost revenue panel in one program. 14 days free, no card.',
  alternates: {
    canonical: '/en',
    languages: { tr: '/', en: '/en', 'x-default': '/' },
  },
};

/**
 * İngilizce tanıtım sayfası (/en).
 *
 * Gövdesi Türkçe kaynaktan ÜRETİLİR: marketing/landing/nextus-servis.html +
 * marketing/landing/en/sozluk.json → node marketing/landing/build-landing.js.
 * LandingEn.tsx elle düzenlenmez; düzenlenirse ilk build'de geri alınır.
 *
 * Türkçe sayfadaki gibi burada da auth() ÇAĞRILMAZ: çerez okumak sayfayı
 * dinamik yapar ve 550 KB'lık pazarlama sayfası her ziyarette sunucuda
 * yeniden üretilirdi. Girişli kullanıcıyı panele gönderme işi middleware'de.
 */
export default function HomePageEn() {
  return <LandingEn />;
}
