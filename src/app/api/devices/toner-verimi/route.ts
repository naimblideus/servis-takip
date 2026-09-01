import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { verimGruplari, verimUygula } from '@/lib/toner-verimi';
import { writeAudit, istekIp } from '@/lib/audit';

/**
 * TONER VERİMİ — model bazında listeleme ve toplu uygulama.
 *
 * Gruplama ve yazma AYNI fonksiyondan (`toner-verimi.ts`) geçiyor. İkisi
 * ayrı yazılsaydı listedeki "25 cihaz" ile yazmanın bulduğu cihaz kümesi
 * ayrışırdı ve bayi bastığı düğmenin ne yaptığını bilemezdi.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    const gruplar = await verimGruplari(tenantId);

    const cihaz = gruplar.reduce((a, g) => a + g.cihaz, 0);
    const verimli = gruplar.reduce((a, g) => a + g.verimli, 0);

    return NextResponse.json({
      gruplar,
      ozet: { model: gruplar.length, cihaz, verimli, eksik: cihaz - verimli },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const govde = await req.json().catch(() => ({}));

    const anahtar = typeof govde?.anahtar === 'string' ? govde.anahtar : '';
    if (!anahtar) return NextResponse.json({ error: 'Model seçilmedi' }, { status: 400 });

    /** Boş dize "temizle" değil "dokunma" demek — alan hiç gönderilmemiş sayılır. */
    const sayi = (v: unknown): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    };

    const sonuc = await verimUygula(tenantId, anahtar, {
      sb: sayi(govde.sb),
      renkli: sayi(govde.renkli),
      ezme: govde.ezme === true,
    });

    if (sonuc.hata) return NextResponse.json({ error: sonuc.hata }, { status: 400 });

    /**
     * DENETİM: toplu verim yazmak, sonradan üretilecek her tahmini
     * etkiliyor. Yanlış bir değer girildiğinde "bunu kim, ne zaman, hangi
     * modele yazdı" sorusunun cevabı olmalı.
     */
    if (sonuc.guncellenen > 0)
      await writeAudit({
        tenantId,
        userId: user.id,
        action: 'TONER_VERIMI_TOPLU_YAZILDI',
        entityType: 'Device',
        entityId: tenantId,
        newValue: { anahtar, sb: sayi(govde.sb), renkli: sayi(govde.renkli), guncellenen: sonuc.guncellenen, ezme: govde.ezme === true },
        ipAddress: istekIp(req),
      });

    return NextResponse.json({ ok: true, ...sonuc });
  } catch (e) {
    return authErrorResponse(e);
  }
}
