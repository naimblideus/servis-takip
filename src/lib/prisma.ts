import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Üretimde HER sorguyu basmak: log dosyasını şişirir, her isteği yavaşlatır
    // ve sorgu parametreleri (e-posta, telefon, tutar) düz metin olarak loga
    // düşer. Geliştirmede faydalı, üretimde yalnız gerçek hatalar.
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;