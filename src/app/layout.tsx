import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import ServiceWorkerKurulum from '@/components/ServiceWorkerKurulum';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { LocaleProvider } from '@/lib/i18n/client';

export const metadata: Metadata = {
  title: 'Nextus Servis - Yazıcı Servis Yönetimi',
  description: 'Yazıcı ve fotokopi servis takip sistemi',
  applicationName: 'Nextus Servis',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nextus Servis' },
  icons: { icon: '/icon-512.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#0F2253',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dil KÖKTE okunuyor: giriş sayfası panelin dışında ve Avrupalı bir
  // ziyaretçinin ilk gördüğü ekran orası. Panel kendi sağlayıcısında bayinin
  // para birimini ve ülkesini de ekliyor; içteki kazanıyor.
  const dil = await sunucuDili();
  return (
    <html lang={dil}>
      <body>
        <LocaleProvider dil={dil}>
          <Providers>{children}</Providers>
        </LocaleProvider>
        {/* Çevrimdışı kabuk + yeni sürüm bildirimi. Yalnız üretimde kaydolur. */}
        <ServiceWorkerKurulum />
      </body>
    </html>
  );
}
