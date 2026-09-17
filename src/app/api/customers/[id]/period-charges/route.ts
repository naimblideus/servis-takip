import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { previewPeriodCharges, commitPeriodCharges } from '@/lib/period-charges';

async function authCustomer(id: string) {
  const session = await auth();
  if (!session) return { error: 'Unauthorized', status: 401 as const };
  // Yalnız e-postayla aramak YANLIŞ BAYİYE bağlayabilir: e-posta bayi
  // bazında benzersiz, global değil (canlı veride görüldü). Oturumdaki
  // tenantId doğru kaynak — bkz. lib/api-auth.ts requireTenantUser.
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  const email = session.user?.email ?? undefined;
  if (!email) return { error: 'Unauthorized', status: 401 as const };
  const user = await prisma.user.findFirst({
    where: tenantId ? { email, tenantId } : { email },
    select: { tenantId: true, role: true },
  });
  if (!user) return { error: 'User not found', status: 404 as const };
  // POST cari'ye PARA yazar; GET bütün dönem bedelini gösterir. Ofis işi.
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    // Cümle değil KOD: yanıtı aşağıda ucHatasi okuyanın dilinde kuruyor.
    return { kod: 'BU_EKRAN_ICIN_YONETICI_YETKISI' as const, status: 403 as const };
  }
  const customer = await prisma.customer.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
  if (!customer) return { kod: 'MUSTERI_BULUNAMADI' as const, status: 404 as const };
  return { tenantId: user.tenantId };
}

// GET — bu dönem kira + sayaç bedelini hesapla (önizleme, cari'ye yazmaz)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authCustomer(id);
  // 'error' hâlâ İngilizce teknik yanıtlar için (Unauthorized); 'kod' bizim
  // çevrilebilir hatalarımız. İkisi de aynı yerden yanıta dönüşüyor.
  if ('kod' in a && a.kod) return ucHatasi(a.kod, a.status);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const charges = await previewPeriodCharges(a.tenantId, id);
  return NextResponse.json(charges);
}

// POST — hesaplanan kira + sayaç bedelini CARİ'ye ekle (kullanıcı onayıyla)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authCustomer(id);
  // 'error' hâlâ İngilizce teknik yanıtlar için (Unauthorized); 'kod' bizim
  // çevrilebilir hatalarımız. İkisi de aynı yerden yanıta dönüşüyor.
  if ('kod' in a && a.kod) return ucHatasi(a.kod, a.status);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const r = await commitPeriodCharges(a.tenantId, id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    console.error('PERIOD CHARGES COMMIT ERROR:', e?.message);
    return ucHatasi('EKLENIRKEN_HATA_OLUSTU', 500);
  }
}
