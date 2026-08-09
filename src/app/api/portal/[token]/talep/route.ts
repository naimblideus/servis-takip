import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jetondanMusteri, talepSiniriAsildi } from '@/lib/portal';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/<jeton>/talep — müşterinin arıza ya da sayaç bildirimi.
 *
 * Bu uca kimliği doğrulanmamış biri yazıyor. Bu yüzden:
 *  · Doğrudan fiş/okuma AÇMAZ — BEKLIYOR kuyruğuna düşer, bayi onaylar.
 *  · Cihaz mutlaka o müşterinin cihazı olmalı (başkasının cihazına bildirim yok).
 *  · Saatte 10 talepten sonra durur (yanlışlıkla üst üste basılan düğme).
 *  · Metin kırpılır; sayaç 9 haneyle sınırlı (seri numarası yazılırsa tutmasın).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const musteri = await jetondanMusteri(token);
  if (!musteri) return NextResponse.json({ error: 'Bağlantı geçersiz' }, { status: 404 });

  let govde: any;
  try { govde = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const tur = govde?.tur === 'SAYAC' ? 'SAYAC' : govde?.tur === 'ARIZA' ? 'ARIZA' : null;
  if (!tur) return NextResponse.json({ error: 'Bildirim türü geçersiz' }, { status: 400 });

  if (await talepSiniriAsildi(musteri.id)) {
    return NextResponse.json(
      { error: 'Çok sayıda bildirim gönderildi. Lütfen servisi telefonla arayın.' },
      { status: 429 },
    );
  }

  // Cihaz bu müşteriye mi ait? Değilse bildirim cihazsız kaydedilir; başkasının
  // cihazına bildirim yazdırmayız.
  let deviceId: string | null = null;
  if (typeof govde?.cihazId === 'string' && govde.cihazId) {
    const c = await prisma.device.findFirst({
      where: { id: govde.cihazId, tenantId: musteri.tenantId, customerId: musteri.id },
      select: { id: true },
    });
    if (!c) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });
    deviceId = c.id;
  }

  const sayi = (v: unknown): number | null => {
    const d = String(v ?? '').replace(/\D/g, '');
    if (!d || d.length > 9) return null; // 9 haneden uzun = sayaç değil (seri no vb.)
    const n = Number(d);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  let aciklama: string | null = null;
  let sayacBlack: number | null = null;
  let sayacColor: number | null = null;

  if (tur === 'ARIZA') {
    aciklama = String(govde?.aciklama ?? '').trim().slice(0, 1000);
    if (aciklama.length < 5) return NextResponse.json({ error: 'Lütfen sorunu birkaç kelimeyle yazın' }, { status: 400 });
  } else {
    sayacBlack = sayi(govde?.sayacBlack);
    sayacColor = sayi(govde?.sayacColor);
    if (sayacBlack == null) return NextResponse.json({ error: 'Siyah/beyaz sayaç değerini girin' }, { status: 400 });
    if (!deviceId) return NextResponse.json({ error: 'Sayaç bildirimi için cihaz gerekli' }, { status: 400 });
  }

  await prisma.portalRequest.create({
    data: {
      tenantId: musteri.tenantId,
      customerId: musteri.id,
      deviceId,
      tur, aciklama, sayacBlack, sayacColor,
    },
  });

  return NextResponse.json({
    ok: true,
    mesaj: tur === 'ARIZA'
      ? 'Arıza bildiriminiz servise iletildi.'
      : 'Sayaç bildiriminiz servise iletildi.',
  });
}
