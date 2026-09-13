import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { degisimKaydet } from '@/lib/verim-ogrenme';

// POST /api/devices/[id]/toner — toner verimini ayarla ve/veya "toner değişti" referansını kaydet.
// body: { tonerYieldBlack?, tonerYieldColor?, markChangedBlack?, markChangedColor?, markChanged? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR: cihaz bu tenant'a mı ait?
    const device = await prisma.device.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

    const body = await req.json();
    const data: any = {};

    if (body.tonerYieldBlack !== undefined)
      data.tonerYieldBlack = body.tonerYieldBlack === '' || body.tonerYieldBlack === null ? null : Math.max(0, parseInt(body.tonerYieldBlack) || 0) || null;
    if (body.tonerYieldColor !== undefined)
      data.tonerYieldColor = body.tonerYieldColor === '' || body.tonerYieldColor === null ? null : Math.max(0, parseInt(body.tonerYieldColor) || 0) || null;

    const changeBlack = body.markChanged === true || body.markChangedBlack === true;
    const changeColor = body.markChanged === true || body.markChangedColor === true;

    // Verim alanları önce yazılıyor; değişim kaydı cihazın reset
    // alanlarını kendisi güncelliyor (ikisi aynı kayıtta ayrışmasın).
    if (Object.keys(data).length) await prisma.device.update({ where: { id }, data });

    // ── DEĞİŞİM GEÇMİŞİ ────────────────────────────────────────────
    // Eskiden yalnız SON değişim saklanıyordu ve bir öncekinin üstüne
    // yazılıyordu. Oysa iki değişim arasındaki sayfa farkı, o modelin
    // sahada ÖLÇÜLMÜŞ verimi — her seferinde kaybediliyordu ve bunun
    // yerine bayiden 854 cihaz için elle verim girmesi bekleniyordu.
    const olcum: { kanal: string; verim: number | null }[] = [];
    if (changeBlack) {
      const r = await degisimKaydet({
        tenantId: user.tenantId, deviceId: id, channel: 'BLACK',
        counterValue: device.counterBlack ?? 0, source: 'ELLE',
      });
      olcum.push({ kanal: 'BLACK', verim: r.observedYield });
    }
    if (changeColor) {
      const r = await degisimKaydet({
        tenantId: user.tenantId, deviceId: id, channel: 'COLOR',
        counterValue: device.counterColor ?? 0, source: 'ELLE',
      });
      olcum.push({ kanal: 'COLOR', verim: r.observedYield });
    }

    const updated = await prisma.device.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({
      ok: true,
      tonerYieldBlack: updated.tonerYieldBlack,
      tonerYieldColor: updated.tonerYieldColor,
      tonerResetBlack: updated.tonerResetBlack,
      tonerResetColor: updated.tonerResetColor,
      tonerChangedAt: updated.tonerChangedAt,
      // Bu değişimle ÖLÇÜLEN verim (ilk değişimde null). Ekran bunu
      // "2.150 sayfa ölçüldü" diye gösteriyor: bayi sistemin bir şey
      // öğrendiğini görsün, yoksa geçmişin tutulduğunu bilemez.
      olcum,
    });
  } catch (e: any) {
    console.error('TONER UPDATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
