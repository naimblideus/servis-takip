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
};
export default nextConfig;