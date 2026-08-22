import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopServisYetkili } from '@/lib/shop-auth';
import { sendText, waOutConfigured } from '@/lib/whatsapp-out';
import { waApiPhone } from '@/lib/whatsapp';

/**
 * POST /api/shop/bildirim — Nextus Mağaza adına WhatsApp mesajı gönderir.
 *
 * NEDEN BURADA: WhatsApp numarası, phone_number_id ve Meta onayları
 * servis-takip'e bağlı. Mağazanın kendi entegrasyonunu kurması ikinci bir
 * onay süreci ve ikinci bir kırılma noktası demek olurdu.
 *
 * ── 24 SAAT PENCERESİ ────────────────────────────────────────────────
 * Serbest metin yalnız müşterinin son 24 saatte bize yazdığı durumda gider
 * (Meta kuralı) ve o pencerede ÜCRETSİZDİR. Pencere kapalıysa Meta hata
 * döner; bu bir arıza değil, beklenen durumdur. Çağıran (mağaza) hatayı
 * yutmaz, siparişe not düşer — "gönderdim sanıyordum" en pahalı hatadır.
 *
 * Bayinin kendi numarasına giden bildirimlerde pencere sorunu genelde
 * yaşanmaz: bayi zaten kendi hattıyla yazışıyordur.
 */
export async function POST(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  if (!waOutConfigured()) {
    return NextResponse.json(
      { error: 'WhatsApp giden ayarlı değil (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)' },
      { status: 503 }
    );
  }

  let body: { tenantId?: string; telefon?: string; metin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { tenantId, telefon, metin } = body;
  if (!tenantId || !telefon || !metin?.trim())
    return NextResponse.json({ error: 'tenantId, telefon ve metin zorunlu' }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, isActive: true, isSuspended: false, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Bayi bulunamadı veya askıda' }, { status: 404 });

  // Numara tek biçime indirgenir: "0532 111 22 33" ve "+90 532 111 2233"
  // aynı hattır. Meta yalnız 90XXXXXXXXXX biçimini kabul eder.
  const hedef = waApiPhone(telefon);
  if (!hedef) return NextResponse.json({ error: 'Geçersiz telefon numarası' }, { status: 400 });

  const r = await sendText(hedef, metin.trim());

  // Gönderim izi servis-takip'in kendi bildirim günlüğüne düşer: bayi
  // "mağaza bana haber verdi mi" sorusunu tek yerden yanıtlayabilsin.
  await prisma.notificationLog
    .create({
      data: {
        tenantId,
        channel: 'WHATSAPP',
        status: r.ok ? 'SENT' : 'FAILED',
        sentAt: r.ok ? new Date() : null,
        recipient: hedef,
        message: metin.trim().slice(0, 1000),
        error: r.ok ? null : (r.error ?? '').slice(0, 500),
      },
    })
    .catch(() => {
      /* günlük yazılamazsa gönderim yine de geçerlidir; sessiz geç */
    });

  if (!r.ok) return NextResponse.json({ error: r.error ?? 'Gönderilemedi' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
