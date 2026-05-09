import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Docker deployment için standalone output (Coolify)
  output: 'standalone',
  // TypeScript hataları build'i engellemesin (Prisma client Docker'da generate ediliyor)
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint uyarıları build'i engellemesin
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Büyük dosya yükleme desteği (SQL importu için, 50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
