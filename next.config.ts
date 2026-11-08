import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Docker deployment için standalone output (Coolify)
  output: 'standalone',
  // TypeScript hataları build'i engellemesin (Prisma client Docker'da generate ediliyor)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Not: Next 16 yerleşik ESLint-build entegrasyonunu kaldırdı; `eslint` config anahtarı yok.
  // Büyük dosya yükleme desteği (SQL importu için, 50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: ['bcryptjs'],
  // Paylaşılan kısa adresler → public/ altındaki düz sayfalar (oturum istemez).
  async rewrites() {
    return [
      { source: '/ucretsiz-tarama', destination: '/ucretsiz-tarama.html' },
      { source: '/gizlilik', destination: '/gizlilik.html' },
      // Etkinlik sayfası: basılı el ilanındaki QR buraya gelir (Pantum bayi toplantısı, Ekim 2026).
      { source: '/pantum', destination: '/pantum.html' },
    ];
  },
  // Satış ekibinin WhatsApp'tan bıraktığı kısa adres: herkese açık demo
  // (giriş sayfası demo bilgileriyle dolu açılır).
  async redirects() {
    return [{ source: '/demo', destination: '/login?demo=1', permanent: false }];
  },
  // "Bu adrese hep https ile gel" (HSTS) — YALNIZ gerçek alan adında; sslip ve
  // yerel adreslerde gönderilmez. includeSubDomains yok: alt alan adları etkilenmez.
  async headers() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: '(www\\.)?nextusservis\\.com' }],
      headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }],
    }, {
      // Eğitim videoları: ikinci izleyiş telefonun önbelleğinden açılsın, yeniden inmesin.
      // Güvenli, çünkü adreste dosyanın içerik özeti var (?v=, lib/egitim-videolari
      // egitimDosyaAdresi): video değişince adres değişir, eskisi gösterilmez.
      source: '/egitim/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
};
export default nextConfig;