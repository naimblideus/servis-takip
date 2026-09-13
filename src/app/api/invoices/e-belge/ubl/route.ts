import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { eBelgeUbl } from '@/lib/e-belge-gonderim';
import { zipUret } from '@/lib/zip';

/**
 * GET /api/invoices/e-belge/ubl?id=...        → tek faturanın UBL XML'i
 * GET /api/invoices/e-belge/ubl?ids=a,b,c     → hepsi tek ZIP içinde
 *
 * ── NE İŞE YARIYOR ───────────────────────────────────────────────────────
 * Entegratör bağlantısı kurulmamış olsa bile bayi faturasını yasal olarak
 * kesebiliyor: bu dosyayı indirip kendi entegratör portalına yüklüyor.
 * "Entegrasyon gelene kadar eski programda kalayım" gerekçesini ortadan
 * kaldıran şey bu.
 *
 * Belge numarası OLMAYAN fatura için dosya üretilmiyor — numara yalnız
 * gönderimde atanıyor ve sıra boşluksuz olmak zorunda.
 */

const TAVAN = 200;

export async function GET(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const q = req.nextUrl.searchParams;
    const tek = q.get('id');
    const cok = (q.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean);

    // ── TEK DOSYA ───────────────────────────────────────────────────────
    if (tek) {
      const c = await eBelgeUbl(tenantId, tek);
      if (!c.ok) return NextResponse.json({ error: c.hata }, { status: 400 });
      return new NextResponse(c.xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${c.dosyaAdi}"`,
        },
      });
    }

    if (!cok.length) return NextResponse.json({ error: 'Fatura seçilmedi' }, { status: 400 });
    if (cok.length > TAVAN) {
      return NextResponse.json({ error: `Tek seferde en fazla ${TAVAN} fatura indirilebilir.` }, { status: 400 });
    }

    // ── ZIP ─────────────────────────────────────────────────────────────
    // Numarası olmayan/üretilemeyen faturalar arşive KONMUYOR ve kaç tane
    // olduğu başlıkta bildiriliyor: bayi eksik arşivi tam sanmasın.
    const girdiler = [];
    const atlanan: string[] = [];
    for (const id of cok) {
      const c = await eBelgeUbl(tenantId, id);
      if (c.ok) girdiler.push({ ad: c.dosyaAdi, icerik: c.xml });
      else atlanan.push(id);
    }
    if (!girdiler.length) {
      return NextResponse.json({ error: 'Seçilenlerin hiçbirinin belge numarası yok. Önce gönderin.' }, { status: 400 });
    }

    const zip = zipUret(girdiler);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="e-fatura-ubl.zip"',
        'X-Belge-Sayisi': String(girdiler.length),
        'X-Atlanan-Sayisi': String(atlanan.length),
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
