import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saglik — dışarıdan izlenecek sağlık ucu.
 *
 * "Sistem çökerse ne kadar sürede haberiniz olur?" sorusunun cevabı bu uçtur:
 * UptimeRobot / Better Stack gibi bir izleyici bunu 1-5 dakikada bir çağırır.
 * Uygulama ayakta ama VERİTABANI ölüyse sayfalar açılıyor gibi görünür ve
 * izleyici bunu kaçırır — bu yüzden burada gerçek bir sorgu atılıyor ve
 * veritabanı yoksa 503 dönüyor. 200'ü "her şey yolunda" diye okuyabilirsiniz.
 *
 * Bilgi sızdırmaz: sürüm, sayı, kiracı adı vermez.
 */
export async function GET() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { durum: 'saglikli', db: 'acik', dbMs: Date.now() - t0 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { durum: 'bozuk', db: 'kapali', dbMs: Date.now() - t0 },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
