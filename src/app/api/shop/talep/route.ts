import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { shopServisYetkili } from '@/lib/shop-auth';
import { cihazSec, talepAciklamasi, talepEtiketi } from '@/lib/site-talep';
import { findCustomerByPhone } from '@/lib/whatsapp-inbound';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shop/talep — mağaza sitesindeki SERVİS talebi
 * (nextus-magaza lib/talep.ts → servisTalebiIlet).
 *
 * Sözleşme: { tenantId, talepId, tur, ad, telefon, mesaj, model? }
 *        → { ok, musteri, fisNo? }   (mağaza: fisNo → "fiş açıldı",
 *          musteri → "arıza kaydı açıldı", değilse "servis müşterisi değil")
 *
 * Talebi sitede kimliği doğrulanmamış biri yazdı; müşteri paneli talebiyle
 * AYNI kural (api/portal/[token]/talep): doğrudan fiş AÇILMAZ. Telefon bir
 * servis müşterisiyle eşleşirse "müşteri talepleri" kuyruğuna düşer
 * (PortalRequest ARIZA, BEKLIYOR), bayi onaylayınca fiş olur. Cihaz kuralı:
 * lib/site-talep.ts. Eşleşme yoksa kayıt açılmaz — talep mağazada durur,
 * bayi WhatsApp'tan yazar; yabancı formdan müşteri kartı açılmaz. Mağaza aynı
 * talebi yeniden gönderirse ikinci kayıt açılmaz.
 */
const metin = (v: unknown, azami: number) => (typeof v === 'string' ? v.trim().slice(0, azami) : '');

export async function POST(req: Request) {
  if (!shopServisYetkili(req)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return NextResponse.json({ ok: false, hata: 'İstek gövdesi okunamadı.' }, { status: 400 });

  const tenantId = metin(g.tenantId, 64);
  const talepId = metin(g.talepId, 64);
  const ad = metin(g.ad, 120);
  const telefon = metin(g.telefon, 24).replace(/[^0-9]/g, '');
  const mesaj = metin(g.mesaj, 800);
  const model = metin(g.model, 120);
  if (!tenantId || !/^[a-z0-9]{8,40}$/.test(talepId) || !ad || telefon.length < 10)
    return NextResponse.json({ ok: false, hata: 'Talep bilgisi eksik.' }, { status: 400 });

  // Yalnız servis talebi Servis'e kayıt açar; kiralama/teklif mağazada kalır.
  if (g.tur !== 'SERVIS') return NextResponse.json({ ok: true, musteri: false });

  if (!rateLimit(`shop-talep:${tenantId}`, 60, 10 * 60_000).ok)
    return NextResponse.json({ ok: false, hata: 'Çok sık.' }, { status: 429 });

  const bayi = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!bayi) return NextResponse.json({ ok: false, hata: 'Bayi bulunamadı.' }, { status: 404 });

  const musteri = await findCustomerByPhone(tenantId, telefon);
  if (!musteri) return NextResponse.json({ ok: true, musteri: false });

  const onceki = await prisma.portalRequest.findFirst({
    where: { tenantId, customerId: musteri.id, aciklama: { contains: talepEtiketi(talepId) } },
    select: { id: true },
  });
  if (onceki) return NextResponse.json({ ok: true, musteri: true });

  const cihazlar = await prisma.device.findMany({
    where: { tenantId, customerId: musteri.id },
    select: { id: true, brand: true, model: true },
    take: 500,
  });
  await prisma.portalRequest.create({
    data: {
      tenantId,
      customerId: musteri.id,
      deviceId: cihazSec(cihazlar, model),
      tur: 'ARIZA',
      aciklama: talepAciklamasi({ talepId, ad, telefon, model, mesaj }),
    },
  });
  return NextResponse.json({ ok: true, musteri: true });
}
