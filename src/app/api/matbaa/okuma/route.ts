import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { rateLimit } from '@/lib/rate-limit';
import { belgeGirdisiOku, okumaKapisi } from '@/lib/belge-okuyucu-sunucu';
import { OKUYUCU_KAPATMA } from '@/lib/baski-okuyucu';
import { OKUMA_SAATLIK, okumaYap } from '@/lib/baski-okuyucu-kayit';

export const dynamic = 'force-dynamic';
// Okuma model tarafında 10–60 sn sürebilir.
export const maxDuration = 120;

/**
 * POST /api/matbaa/okuma — multipart: `dosya` (JPG/PNG/WEBP/GIF/PDF) ve/veya
 * `metin` (yazılı sipariş ya da fotoğrafın açıklaması). Sipariş okunur,
 * TASLAK kaydedilir: { id, taslak }. İş AÇILMAZ; onay ayrı uçta.
 *
 * Belge okuyucu çekirdeği (lib/belge-okuyucu-sunucu): okuyucu kapalıysa ya da
 * gövde 8 MB'ı aşıyorsa gövde OKUNMADAN döner (middleware 10 MB'ta keser);
 * dosya yalnız bellekte durur, base64'e çevrilip modele gider, sonra atılır.
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const kapi = okumaKapisi(req, OKUYUCU_KAPATMA);
    if (kapi) return baskiHatasi(kapi);
    if (!rateLimit(`okuyucu:${tenantId}`, OKUMA_SAATLIK, 3_600_000).ok) return baskiHatasi('OKUMA_SINIR');

    const g = await belgeGirdisiOku(req);
    if (!g.ok) return baskiHatasi(g.kod);
    const r = await okumaYap(tenantId, g.girdi, user, g.meta);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, id: r.id, taslak: r.taslak }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
