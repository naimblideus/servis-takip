import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';

// GET /api/market/messages?listingId=..&buyer=..  — bir konuşmadaki mesajlar (yalnız taraflar)
export async function GET(req: Request) {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get('listingId');
  if (!listingId) return NextResponse.json({ error: 'listingId zorunlu' }, { status: 400 });

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId }, select: { id: true, sellerTenantId: true, title: true } });
  if (!listing) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  const isSeller = listing.sellerTenantId === me;
  // Satıcıysam hangi alıcı thread'i; alıcıysam thread = kendi tenantım
  const buyerTenantId = isSeller ? (searchParams.get('buyer') || '') : me;
  if (isSeller && !buyerTenantId) return NextResponse.json({ messages: [], listingTitle: listing.title });

  // ERİŞİM: yalnız bu thread'in tarafları (satıcı veya o alıcı)
  if (!isSeller && buyerTenantId !== me) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

  const messages = await prisma.marketMessage.findMany({
    where: { listingId, sellerTenantId: listing.sellerTenantId, buyerTenantId },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  return NextResponse.json({
    listingTitle: listing.title,
    messages: messages.map((m) => ({ id: m.id, body: m.body, senderName: m.senderName, mine: m.senderTenantId === me, createdAt: m.createdAt })),
  });
}

// POST /api/market/messages  { listingId, body, toTenantId? }  — mesaj gönder
export async function POST(req: Request) {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }
  const listingId = b.listingId;
  const text = (b.body || '').trim();
  if (!listingId || !text) return NextResponse.json({ error: 'listingId ve mesaj zorunlu' }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: 'Mesaj çok uzun' }, { status: 400 });

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId }, select: { id: true, sellerTenantId: true, status: true } });
  if (!listing) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  const isSeller = listing.sellerTenantId === me;
  let buyerTenantId: string;
  if (isSeller) {
    buyerTenantId = (b.toTenantId || '').trim();
    if (!buyerTenantId) return NextResponse.json({ error: 'Alıcı belirtilmeli' }, { status: 400 });
    // Satıcı yalnız var olan bir thread'e yanıt verebilir (rastgele tenant'a mesaj atamaz)
    const exists = await prisma.marketMessage.findFirst({ where: { listingId, sellerTenantId: me, buyerTenantId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: 'Bu alıcıyla konuşma bulunamadı' }, { status: 404 });
  } else {
    // Alıcı: yeni konuşma yalnız ACTIVE ilanda başlatılabilir
    const hasThread = await prisma.marketMessage.findFirst({ where: { listingId, buyerTenantId: me }, select: { id: true } });
    if (!hasThread && listing.status !== 'ACTIVE') return NextResponse.json({ error: 'İlan aktif değil' }, { status: 400 });
    buyerTenantId = me;
  }

  await prisma.marketMessage.create({
    data: { listingId, sellerTenantId: listing.sellerTenantId, buyerTenantId, senderTenantId: me, senderName: a.user!.name, body: text.slice(0, 2000) },
  });
  return NextResponse.json({ ok: true });
}
