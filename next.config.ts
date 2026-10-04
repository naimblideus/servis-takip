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
    ];
  },
  // "Bu adrese hep https ile gel" (HSTS) — YALNIZ gerçek alan adında; sslip ve
  // yerel adreslerde gönderilmez. includeSubDomains yok: alt alan adları etkilenmez.
  async headers() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: '(www\\.)?nextusservis\\.com' }],
      headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }],
    }];
  },
};
export default nextConfig;