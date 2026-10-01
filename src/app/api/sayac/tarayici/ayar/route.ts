import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { tarayiciAyari, anahtarYenile, otomatikAyarla, otomatikFisAyarla } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/** GET — anahtar var mı, otomatik yazma açık mı. Anahtarın kendisi DÖNMEZ. */
export async function GET() {
  try {
    const { tenantId } = await requireAdminUser();
    return NextResponse.json(await tarayiciAyari(tenantId));
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * POST — yeni tarayıcı anahtarı üretir ve BİR KEZ döner.
 *
 * Eski anahtar o anda çalışmayı bırakır: müşterilerde duran eski tarayıcı
 * dosyaları reddedilir. Bu bilerek: anahtarı yenilemenin tek sebebi
 * birinin elinde olmaması gereken bir kopyanın bulunmasıdır.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const onceki = await tarayiciAyari(tenantId);
    const anahtar = await anahtarYenile(tenantId);
    await writeAudit({
      tenantId, userId: user.id,
      action: onceki.anahtarVar ? 'TARAYICI_ANAHTARI_YENILENDI' : 'TARAYICI_ANAHTARI_OLUSTURULDU',
      entityType: 'Tenant', entityId: tenantId,
      ipAddress: istekIp(req),
    });
    return NextResponse.json({ anahtar });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * PATCH { otomatik } — tarama sonucu onaysız sayaç olarak yazılsın mı.
 * PATCH { otomatikFis } — servis uyarısından fiş kendiliğinden açılsın mı.
 */
export async function PATCH(req: Request) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const b = await req.json().catch(() => ({}));
    if (typeof b?.otomatikFis === 'boolean') {
      const onceki = await tarayiciAyari(tenantId);
      await otomatikFisAyarla(tenantId, b.otomatikFis);
      await writeAudit({
        tenantId, userId: user.id,
        action: 'TARAYICI_OTOMATIK_FIS_DEGISTI',
        entityType: 'Tenant', entityId: tenantId,
        oldValue: { otomatikFis: onceki.otomatikFis }, newValue: { otomatikFis: b.otomatikFis },
        ipAddress: istekIp(req),
      });
      return NextResponse.json({ otomatikFis: b.otomatikFis });
    }
    if (typeof b?.otomatik !== 'boolean') return NextResponse.json({ error: 'otomatik: boolean' }, { status: 400 });
    const onceki = await tarayiciAyari(tenantId);
    await otomatikAyarla(tenantId, b.otomatik);
    await writeAudit({
      tenantId, userId: user.id,
      action: 'TARAYICI_OTOMATIK_YAZ_DEGISTI',
      entityType: 'Tenant', entityId: tenantId,
      oldValue: { otomatik: onceki.otomatik }, newValue: { otomatik: b.otomatik },
      ipAddress: istekIp(req),
    });
    return NextResponse.json({ otomatik: b.otomatik });
  } catch (e) {
    return authErrorResponse(e);
  }
}
