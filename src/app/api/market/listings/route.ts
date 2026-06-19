import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth, sellerDisplayMap, publicListing } from '@/lib/market';

const MAX_PHOTOS = 4;
const sanitizePhotos = (v: any): string[] =>
  (Array.isArray(v) ? v : []).filter((p) => typeof p === 'string' && p.startsWith('data:image/') && p.length < 700000).slice(0, MAX_PHOTOS);

// GET /api/market/listings — ÇAPRAZ-TENANT: yalnız ACTIVE ilanlar; filtrelerle
export async function GET(req: Request) {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const kind = searchParams.get('kind');
  const city = (searchParams.get('city') || '').trim();
  const min = parseFloat(searchParams.get('min') || '');
  const max = parseFloat(searchParams.get('max') || '');

  const where: any = { status: 'ACTIVE' };
  if (kind) where.kind = kind;
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (!isNaN(min) || !isNaN(max)) where.price = { ...(!isNaN(min) ? { gte: min } : {}), ...(!isNaN(max) ? { lte: max } : {}) };
  if (q) where.OR = [
    { title: { contains: q, mode: 'insensitive' } },
    { brand: { contains: q, mode: 'insensitive' } },
    { model: { contains: q, mode: 'insensitive' } },
    { description: { contains: q, mode: 'insensitive' } },
  ];

  const listings = await prisma.marketListing.findMany({ where, orderBy: { createdAt: 'desc' }, take: 80 });
  const sellers = await sellerDisplayMap(listings.map((l) => l.sellerTenantId));

  return NextResponse.json({
    listings: listings.map((l) => publicListing(l, sellers.get(l.sellerTenantId), l.sellerTenantId === a.user!.tenantId)),
  });
}

// POST /api/market/listings — kendi bayinin ilanı
export async function POST(req: Request) {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const title = (body.title || '').trim();
  const kind = ['PART', 'PRINTER', 'MACHINE', 'OTHER'].includes(body.kind) ? body.kind : 'OTHER';
  if (!title) return NextResponse.json({ error: 'Başlık zorunlu' }, { status: 400 });
  const price = Math.max(0, parseFloat(body.price) || 0);
  const quantity = Math.max(1, parseInt(body.quantity) || 1);

  const listing = await prisma.marketListing.create({
    data: {
      sellerTenantId: a.user!.tenantId,
      kind,
      title: title.slice(0, 160),
      description: body.description ? String(body.description).slice(0, 2000) : null,
      brand: body.brand ? String(body.brand).slice(0, 80) : null,
      model: body.model ? String(body.model).slice(0, 80) : null,
      condition: ['SIFIR', 'IKINCI_EL'].includes(body.condition) ? body.condition : null,
      category: body.category ? String(body.category).slice(0, 80) : null,
      price,
      currency: 'TRY',
      quantity,
      unit: body.unit ? String(body.unit).slice(0, 20) : null,
      city: body.city ? String(body.city).slice(0, 80) : (a.tenant!.marketCity || null),
      photos: sanitizePhotos(body.photos),
      sourceKind: ['PART', 'PRINTER'].includes(body.sourceKind) ? body.sourceKind : null,
      sourceId: body.sourceId ? String(body.sourceId) : null,
      status: 'ACTIVE',
    },
  });

  return NextResponse.json({ ok: true, id: listing.id });
}
