import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import './mobil.css';
import { Providers } from './providers';
import ServiceWorkerKurulum from '@/components/ServiceWorkerKurulum';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { LocaleProvider } from '@/lib/i18n/client';

// Sekme başlığı ve paylaşım önizlemesi kullanıcının dilinde (İngilizce bakan Pantum misafiri).
export async function generateMetadata(): Promise<Metadata> {
  const en = (await sunucuDili()) === 'en';
  return {
    title: en ? 'Nextus Servis - Printer Service Management' : 'Nextus Servis - Yazıcı Servis Yönetimi',
    description: en ? 'Service tracking for printer and copier dealers' : 'Yazıcı ve fotokopi servis takip sistemi',
    applicationName: 'Nextus Servis',
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nextus Servis' },
    icons: { icon: '/icon-512.png', apple: '/apple-touch-icon.png' },
  };
}

// iPHONE'DA GİRİŞ ALANI YAKINLAŞTIRMASI. iOS, yazısı 16 px'ten küçük bir
// alana dokunulunca sayfayı büyütüyor ve geri küçültmüyor: sayfa yana kayıyor,
// alt menü ekrandan çıkıyor. Ölçüldü: 32 ekranın 32'sinde 16 px altı alan var
// (filtreler, sayaç kutuları). maximum-scale=1 bu otomatik büyütmeyi kapatır;
// iOS 10'dan beri parmakla yakınlaştırmayı KAPATMAZ (erişilebilirlik korunur).
// Android'de bu ayar parmakla yakınlaştırmayı da kapattığı için yalnız iOS'a.
export async function generateViewport(): Promise<Viewport> {
  const ua = (await headers()).get('user-agent') ?? '';
  const ios = /iPhone|iPad|iPod/.test(ua);
  return {
    themeColor: '#0F2253',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    ...(ios ? { maximumScale: 1 } : {}),
  };
}

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
