import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';

/**
 * Cihazın son 12 aylık arıza geçmişi — kategoriye göre özet.
 *
 * Neden var: teknisyen kategoriyi seçtiği anda "bu cihazda bu 3. kez oluyor"
 * bilgisini görsün. Böylece kategori bir zorunluluk olmaktan çıkıp TEŞHİS ARACI
 * olur — ve doğru seçmek teknisyenin kendi işine yarar.
 *
 * Cihaz seçilince BİR kez çekilir; kategori değiştikçe yeniden istek atılmaz
 * (anında görünsün, akışı yavaşlatmasın).
 */
const WINDOW_DAYS = 365;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR koruması: cihaz bu tenant'a ait olmalı
    const device = await prisma.device.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, installedAt: true },
    });
    if (!device) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const tickets = await prisma.serviceTicket.findMany({
      where: {
        tenantId: user.tenantId,
        deviceId: id,
        deletedAt: null,
        createdAt: { gte: since },
      },
      select: { faultCategory: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Kategori bazında say + en son ne zaman görüldüğünü tut
    const byCategory: Record<string, { count: number; lastAt: string }> = {};
    for (const t of tickets) {
      if (!t.faultCategory) continue; // taksonomi öncesi kayıtlar sayılmaz (uydurma yok)
      const key = t.faultCategory;
      if (!byCategory[key]) byCategory[key] = { count: 0, lastAt: t.createdAt.toISOString() };
      byCategory[key].count += 1;
    }

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      total: tickets.length,
      // Kategorisi bilinen kayıt sayısı — arayüz, kapsam düşükse yorum yapmamalı
      categorized: tickets.filter((t) => t.faultCategory).length,
      byCategory,
      installedAt: device.installedAt,
    });
  } catch (e: any) {
    console.error('FAULT HISTORY ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
