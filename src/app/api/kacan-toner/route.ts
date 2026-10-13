import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { kacanTonerler } from '@/lib/kacan-toner';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

async function yonetici() {
  const session = await auth();
  if (!session) return { hata: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const user = await oturumKullanicisi(session);
  if (!user) return { hata: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  // YALNIZ YÖNETİCİ: kaçan satışı tutarıyla gösteriyor (Kaçan Gelir ile aynı kural).
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return { hata: ucHatasi('BU_EKRAN_ICIN_YONETICI_YETKISI', 403) };
  return { user };
}

/** GET /api/kacan-toner — tarayıcının gördüğü ama bayinin vermediği toner değişimleri (lib/kacan-toner.ts). */
export async function GET() {
  const y = await yonetici();
  if (y.hata) return y.hata;
  return NextResponse.json(await kacanTonerler(y.user.tenantId));
}

/**
 * POST /api/kacan-toner { id } — "bizden aldı, kaydı eksikti": değişim
 * listeden düşer. Yalnız bu bayinin tarayıcı kaydı işaretlenebilir.
 */
export async function POST(req: Request) {
  const y = await yonetici();
  if (y.hata) return y.hata;
  const govde = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof govde?.id === 'string' ? govde.id : '';
  const r = await prisma.tonerChange.updateMany({
    where: { id, tenantId: y.user.tenantId, source: 'TARAYICI' },
    data: { bizdenAlindi: true },
  });
  if (r.count !== 1) return ucHatasi('BULUNAMADI', 404);
  await writeAudit({
    tenantId: y.user.tenantId, userId: y.user.id, action: 'TONER_BIZDEN_ALINDI', entityType: 'TonerChange', entityId: id,
    newValue: { bizdenAlindi: true },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
