import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { downloadMedia } from '@/lib/whatsapp-out';

/**
 * GET /api/whatsapp/media/[id] — mesajdaki fotoğrafı göster.
 *
 * [id] = WhatsAppMessage kaydının id'si (Meta medya kimliği DEĞİL). Böylece
 * medya kimliği dışarı sızmaz ve erişim tenant kontrolünden geçer.
 *
 * Medya SUNUCUYA KAYDEDİLMEZ: Meta'dan o an çekilip doğrudan tarayıcıya aktarılır.
 * Müşteri fotoğrafını kalıcı saklamamak hem KVKK hem disk açısından doğru olan.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;

    // IDOR koruması: mesaj bu bayiye mi ait?
    const msg = await prisma.whatsAppMessage.findFirst({
      where: { id, tenantId },
      select: { mediaId: true },
    });
    if (!msg?.mediaId) return NextResponse.json({ error: 'Bu mesajda medya yok' }, { status: 404 });

    const r = await downloadMedia(msg.mediaId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

    return new NextResponse(new Uint8Array(r.buffer), {
      headers: {
        'Content-Type': r.contentType,
        // Kısa süreli özel önbellek: aynı fotoğrafa arka arkaya bakılırken
        // her seferinde Meta'ya gitmeyelim, ama paylaşımlı önbelleğe düşmesin.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
