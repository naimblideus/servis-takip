import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { son10 } from '@/lib/whatsapp-inbound';

/**
 * GET /api/whatsapp/gonderilen — bayinin gönderdiği WhatsApp hatırlatmaları
 * (otomatik vade/sayaç + elle toplu) ve Meta'nın bildirdiği durumları:
 * gönderildi → teslim edildi → okundu, ya da iletilemedi (okunur sebep).
 * "Kime ne gitti, ulaştı mı" sorusunun tek cevabı.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    const kayitlar = await prisma.notificationLog.findMany({
      where: { tenantId, channel: 'WHATSAPP' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, recipient: true, message: true, status: true, error: true, createdAt: true, sentAt: true, teslimAt: true, okunduAt: true },
    });
    // Alıcının adı: müşterinin telefonu son 10 haneyle (biçim farkı eşleşmeyi bozmasın).
    const musteriler = kayitlar.length
      ? await prisma.$queryRaw<{ name: string; s10: string }[]>`
          SELECT "name", right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) AS s10
          FROM "Customer" WHERE "tenantId" = ${tenantId}`
      : [];
    const ad = new Map(musteriler.map((m) => [m.s10, m.name]));
    return NextResponse.json({
      items: kayitlar.map((k) => ({
        id: k.id,
        alici: ad.get(son10(k.recipient)) ?? null,
        telefon: k.recipient,
        // Kayıt metni "Borç hatırlatma — Ad · Tutar": ekranda tür + özet olarak gösterilir.
        ozet: k.message,
        durum: k.status === 'FAILED' ? 'hata' : k.status === 'PENDING' ? 'bekliyor' : k.okunduAt ? 'okundu' : k.teslimAt ? 'teslim' : 'gonderildi',
        hata: k.status === 'FAILED' ? k.error : null,
        zaman: (k.sentAt ?? k.createdAt).toISOString(),
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
