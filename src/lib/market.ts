// Bayi Pazarı ortak yardımcıları — kimlik + "pazara katıldı mı" kapısı + güvenli satıcı görünümü.
// ÇAPRAZ-TENANT KURAL: yalnız bu modülün kullanıldığı /api/market/* uçları çapraz-tenant okur.
// Satıcının iç verisi (müşteri/maliyet/cari) ASLA dışarı verilmez — sadece görünen ad + şehir.
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasModule } from '@/lib/modules';

export interface MarketAuth {
  error: string | null;
  status: number;
  user: { id: string; tenantId: string; name: string; role: string } | null;
  tenant: { id: string; name: string; marketEnabled: boolean; marketDisplayName: string | null; marketCity: string | null; marketContactPhone: string | null } | null;
}

export async function marketAuth(requireEnabled = true): Promise<MarketAuth> {
  const session = await auth();
  if (!session) return { error: 'Unauthorized', status: 401, user: null, tenant: null };
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! }, select: { id: true, tenantId: true, name: true, role: true } });
  if (!user) return { error: 'User not found', status: 404, user: null, tenant: null };
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, marketEnabled: true, marketDisplayName: true, marketCity: true, marketContactPhone: true, plan: true, modules: true },
  });
  if (!tenant) return { error: 'Tenant not found', status: 404, user, tenant: null };
  // Modül kapısı: Bayi Pazarı MARKETPLACE modülü açık mı? (marketEnabled eski bayrak geriye-uyumlu)
  if (requireEnabled && !hasModule(tenant, 'MARKETPLACE')) return { error: 'Bayi Pazarı paketinizde yok', status: 403, user, tenant };
  return { error: null, status: 200, user, tenant };
}

/** Satıcı tenant'ları için yalnız PUBLİK görünen bilgi (ad + şehir). İç veri sızdırmaz. */
export async function sellerDisplayMap(tenantIds: string[]) {
  const ids = Array.from(new Set(tenantIds.filter(Boolean)));
  const m = new Map<string, { name: string; city: string | null }>();
  if (!ids.length) return m;
  const ts = await prisma.tenant.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, marketDisplayName: true, marketCity: true },
  });
  ts.forEach((t) => m.set(t.id, { name: t.marketDisplayName || t.name, city: t.marketCity || null }));
  return m;
}

/** Satıcı puan ortalaması + adedi (Faz 3). */
export async function sellerRatings(tenantIds: string[]) {
  const ids = Array.from(new Set(tenantIds.filter(Boolean)));
  const m = new Map<string, { rating: number; count: number }>();
  if (!ids.length) return m;
  const grouped = await prisma.marketReview.groupBy({ by: ['ratedTenantId'], where: { ratedTenantId: { in: ids } }, _avg: { score: true }, _count: true });
  grouped.forEach((g) => m.set(g.ratedTenantId, { rating: g._avg.score ? Math.round(g._avg.score * 10) / 10 : 0, count: g._count }));
  return m;
}

/** İlanı güvenli (publik) DTO'ya çevir — iç alan sızdırmaz. listMode=true ise yalnız ilk foto (vitrin yükü düşsün). */
export function publicListing(l: any, seller?: { name: string; city: string | null; rating?: number; count?: number }, isOwner = false, listMode = false) {
  const photos = Array.isArray(l.photos) ? l.photos : [];
  return {
    id: l.id, kind: l.kind, title: l.title, description: l.description ?? null,
    brand: l.brand ?? null, model: l.model ?? null, condition: l.condition ?? null, category: l.category ?? null,
    price: Number(l.price), currency: l.currency, quantity: l.quantity, unit: l.unit ?? null,
    city: l.city ?? seller?.city ?? null, photos: listMode ? photos.slice(0, 1) : photos,
    status: l.status, createdAt: l.createdAt,
    sellerName: seller?.name ?? null,
    sellerRating: seller?.rating ?? null,
    sellerRatingCount: seller?.count ?? 0,
    isOwner,
    // sourceKind/sourceId yalnız sahibine
    ...(isOwner ? { sourceKind: l.sourceKind ?? null, sourceId: l.sourceId ?? null } : {}),
  };
}
