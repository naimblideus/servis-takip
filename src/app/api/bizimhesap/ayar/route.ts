import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { SirAnahtariYok } from '@/lib/sir';
import { ayarDurumu, ayarKaydet, baglantiDene, firmIdGecerli } from '@/lib/bizimhesap-veri';
import { prisma } from '@/lib/prisma';
import { sirCoz } from '@/lib/sir';

// POST { firmId } — önce DENER, bağlantı kurulursa şifreli kaydeder.
// Yanlış FirmID kaydedilip ay sonunda her faturada hata alınmasın.
export async function POST(req: Request) {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  let govde: { firmId?: unknown };
  try { govde = await req.json(); } catch { return NextResponse.json({ kod: 'GECERSIZ' }, { status: 400 }); }
  const firmId = typeof govde?.firmId === 'string' ? govde.firmId.trim() : '';
  if (!firmIdGecerli(firmId)) return NextResponse.json({ kod: 'FIRMID_GECERSIZ' }, { status: 400 });

  const deneme = await baglantiDene(firmId);
  if (!deneme.ok) return NextResponse.json({ kod: 'BAGLANAMADI', hata: deneme.hata }, { status: 400 });
  try {
    await ayarKaydet(tenantId, firmId);
  } catch (e) {
    if (e instanceof SirAnahtariYok) return NextResponse.json({ kod: 'ANAHTAR_YOK' }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true, musteriSayisi: deneme.musteriSayisi, ayar: await ayarDurumu(tenantId) });
}

// PUT — kayıtlı bağlantıyı fatura yazmadan dener.
export async function PUT() {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { bizimHesapFirmId: true } });
  const firmId = sirCoz(t?.bizimHesapFirmId);
  if (!firmId) return NextResponse.json({ kod: 'AYAR_YOK' }, { status: 400 });
  const deneme = await baglantiDene(firmId);
  if (!deneme.ok) return NextResponse.json({ kod: 'BAGLANAMADI', hata: deneme.hata }, { status: 400 });
  return NextResponse.json({ ok: true, musteriSayisi: deneme.musteriSayisi });
}

// DELETE — bağlantıyı kaldırır. Gönderilmiş faturaların durumu korunur.
export async function DELETE() {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  await ayarKaydet(tenantId, null);
  return NextResponse.json({ ok: true, ayar: await ayarDurumu(tenantId) });
}
