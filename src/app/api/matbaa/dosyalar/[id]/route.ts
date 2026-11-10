import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { dosyaAdresi, dosyaKaldir } from '@/lib/baski-dosya-kayit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/matbaa/dosyalar/:id — dosyayı indirir. Dosya herkese açık bir
 * adreste durmaz: oturum ve kiracı denetlenir, sonra 5 dakikalık imzalı
 * adrese yönlendirilir. `?gor=1` tarayıcıda açar (prova, görsel).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireMatbaaUser();
    const { id } = await params;
    const r = await dosyaAdresi(tenantId, id, new URL(req.url).searchParams.get('gor') === '1');
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.redirect(r.url, { status: 302, headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return matbaaYaniti(e);
  }
}

/** DELETE /api/matbaa/dosyalar/:id — yanlış dosyayı kaldırır. Operatör kaldıramaz. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const r = await dosyaKaldir(tenantId, id, user.name);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
