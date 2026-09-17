import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { ALL_MODULE_KEYS, effectiveModules } from '@/lib/modules';

// POST /api/super-admin/tenants/[id]/modules { modules: string[] }
// Bayinin açık modüllerini AYARLAR (mutlak override). Boş dizi = plan varsayılanına dön.
// marketEnabled (eski bayrak) efektif duruma göre senkronlanır. (middleware super-admin'i korur.)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return ucHatasi('GECERSIZ_ISTEK', 400); }

  const incoming: string[] = Array.isArray(body.modules) ? body.modules : [];
  const modules = Array.from(new Set(incoming.filter((m) => (ALL_MODULE_KEYS as string[]).includes(m))));

  const t = await prisma.tenant.findUnique({ where: { id }, select: { plan: true } });
  if (!t) return ucHatasi('ISLETME_BULUNAMADI', 404);

  // Efektif durumu hesapla (boşsa plan varsayılanı) → eski marketEnabled bayrağını ona göre senkronla
  const eff = effectiveModules({ plan: t.plan, modules });
  await prisma.tenant.update({
    where: { id },
    data: { modules, marketEnabled: eff.has('MARKETPLACE') },
  });

  return NextResponse.json({ ok: true, modules, effective: Array.from(eff) });
}
