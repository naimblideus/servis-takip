import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/devices/[id]/readings/photo?readingId=X — sayaç fotoğrafını görsel olarak döndürür (tenant-scoped).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: deviceId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const readingId = new URL(req.url).searchParams.get('readingId');
  if (!readingId) return NextResponse.json({ error: 'readingId gerekli' }, { status: 400 });

  // IDOR koruması: okuma bu tenant'a ve bu cihaza ait olmalı
  const reading = await prisma.counterReading.findFirst({
    where: { id: readingId, deviceId, tenantId: user.tenantId },
    select: { photo: true },
  });
  if (!reading?.photo) return NextResponse.json({ error: 'Foto yok' }, { status: 404 });

  // Yalnız image/* MIME kabul + bozuk base64'te 400 (500 değil)
  const m = reading.photo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!m) return NextResponse.json({ error: 'Geçersiz foto formatı' }, { status: 400 });
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0) return NextResponse.json({ error: 'Boş foto' }, { status: 400 });
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Foto çözümlenemedi' }, { status: 400 });
  }
}
