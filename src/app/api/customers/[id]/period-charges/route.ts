import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { previewPeriodCharges, commitPeriodCharges } from '@/lib/period-charges';

async function authCustomer(id: string) {
  const session = await auth();
  if (!session) return { error: 'Unauthorized', status: 401 as const };
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! }, select: { tenantId: true } });
  if (!user) return { error: 'User not found', status: 404 as const };
  const customer = await prisma.customer.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
  if (!customer) return { error: 'Müşteri bulunamadı', status: 404 as const };
  return { tenantId: user.tenantId };
}

// GET — bu dönem kira + sayaç bedelini hesapla (önizleme, cari'ye yazmaz)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authCustomer(id);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const charges = await previewPeriodCharges(a.tenantId, id);
  return NextResponse.json(charges);
}

// POST — hesaplanan kira + sayaç bedelini CARİ'ye ekle (kullanıcı onayıyla)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authCustomer(id);
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const r = await commitPeriodCharges(a.tenantId, id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    console.error('PERIOD CHARGES COMMIT ERROR:', e?.message);
    return NextResponse.json({ error: 'Eklenirken hata oluştu' }, { status: 500 });
  }
}
