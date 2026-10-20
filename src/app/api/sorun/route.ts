import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { rateLimit } from '@/lib/rate-limit';
import { sorunDogrula, sorunSiniri, EKRAN_EN_COK_KARAKTER } from '@/lib/sorun';
import { sorunOlustur, kendiSorunlari } from '@/lib/sorun-veri';

/**
 * SORUN BİLDİR — ürün içinden bildirim (components/SorunBildir).
 *
 * POST: bildirim yazar. Kim, hangi bayi, hangi rol ve demo mu OTURUMDAN
 *       gelir; gövdeden gelen hiçbir kimlik bilgisine bakılmaz.
 * GET:  "Önceki bildirimleriniz" — yönetici bayinin hepsini, diğerleri
 *       kendisininkini görür. Görüntü verisi ve iç not dönmez.
 *
 * DEMODA AÇIK (lib/demo-yazma.ts öneklerinde YOK, bilerek): demoyu deneyen
 * birinin "şurada takıldım" demesi en değerli geri bildirim. Kayıt demo
 * bayrağıyla yazılır, süper admin'de varsayılan süzgeç dışında kalır;
 * kalabalığa karşı istek sınırı korur.
 */

// Gövde üst sınırı: görüntü sınırı + metinler için pay. JSON ayrıştırmadan
// önce bakılıyor; aksi hâlde biri belleğe megabaytlar yükleyebilirdi.
const GOVDE_EN_COK = EKRAN_EN_COK_KARAKTER + 20_000;

export async function POST(req: NextRequest) {
  try {
    const { user, tenantId, session } = await requireTenantUser();

    const uzunluk = Number(req.headers.get('content-length') ?? 0);
    if (uzunluk > GOVDE_EN_COK) return ucHatasi('SORUN_EKRAN_BUYUK', 413);
    const ham = await req.text();
    if (ham.length > GOVDE_EN_COK) return ucHatasi('SORUN_EKRAN_BUYUK', 413);
    let govde: Record<string, unknown>;
    try {
      govde = JSON.parse(ham);
    } catch {
      return ucHatasi('SORUN_GECERSIZ_ISTEK', 400);
    }

    const d = sorunDogrula(govde);
    if (!d.ok) return ucHatasi(d.kod, d.kod === 'SORUN_EKRAN_BUYUK' ? 413 : 400);

    // Sınır doğrulamadan SONRA: yazım hatası yüzünden reddedilen deneme
    // kullanıcının saatlik hakkından düşmesin.
    const sinir = sorunSiniri(rateLimit, user.id, tenantId);
    if (!sinir.ok) {
      const yanit = await ucHatasi('SORUN_COK_SIK', 429);
      yanit.headers.set('Retry-After', String(sinir.retryAfter));
      return yanit;
    }

    const kayit = await sorunOlustur({
      ...d.veri,
      tenantId,
      kullaniciId: user.id,
      kullaniciAd: user.name ?? null,
      rol: user.role ?? null,
      demo: Boolean((session?.user as { demo?: boolean } | undefined)?.demo),
    });
    return NextResponse.json({ ok: true, id: kayit.id }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function GET() {
  try {
    const { user } = await requireTenantUser();
    const liste = await kendiSorunlari(user);
    return NextResponse.json({ liste }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return authErrorResponse(e);
  }
}
