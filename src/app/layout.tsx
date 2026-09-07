import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import ServiceWorkerKurulum from '@/components/ServiceWorkerKurulum';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
        {/* Çevrimdışı kabuk + yeni sürüm bildirimi. Yalnız üretimde kaydolur. */}
        <ServiceWorkerKurulum />
      </body>
    </html>
  );
}