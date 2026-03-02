import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Docker deployment için standalone output (Coolify)
  output: 'standalone',
  // Büyük dosya yükleme desteği (SQL importu için, 50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
