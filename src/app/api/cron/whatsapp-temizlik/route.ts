import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

/**
 * WHATSAPP MESAJ SAKLAMA SÜRESİ — KVKK veri minimizasyonu.
 *
 * Bu tablo, bayinin MÜŞTERİLERİNİN yazdığı mesajları tutar. Cihaz/sayaç verisinden
 * farklı bir sorumluluk seviyesidir ve süresiz saklanmamalıdır.
 *
 * ⚠️ VARSAYILAN OLARAK KAPALIDIR — bilerek.
 * Bu mesajlar İŞ KAYDIDIR ("müşteri şunu yazmıştı" bir tartışmada delildir) ve
 * bayinin kendi WhatsApp uygulamasında zaten kalıcı olarak duruyor. Bizdeki kopyayı
 * silmek veriyi ortadan kaldırmaz, yalnızca bayinin sistemini işe yaramaz hâle getirir.
 * Kimsenin istemediği bir silme varsayılan olamaz.
 *
 * Temizlik YALNIZCA WHATSAPP_SAKLAMA_GUN tanımlandığında çalışır. Tanımlıysa
 * iki kademeli ilerler:
 *  1. Fişe ya da sayaç okumasına BAĞLANMAMIŞ eski mesajlar silinir — iş değeri yok.
 *  2. Bağlı olanların yalnızca İÇERİĞİ temizlenir; satır ve bağ korunur. Satırı
 *     silmek fişin geçmişini koparır ve "bu fiş nereden çıktı" sorusunu cevapsız bırakır.
 *
 * Ne zaman açılmalı: bayi sözleşmesinde bir saklama süresi taahhüt edildiyse ya da
 * bayi açıkça istediyse. Öncesinde değil.
 */
async function run() {
  const ayar = process.env.WHATSAPP_SAKLAMA_GUN;
  if (!ayar) {
    return {
      calisti: false,
      sebep: 'WHATSAPP_SAKLAMA_GUN tanımlı değil — temizlik kapalı, hiçbir mesaj silinmedi.',
    };
  }
  const gun = Math.max(30, Number(ayar) || 90);
  const sinir = new Date(Date.now() - gun * 86400000);

  // 1) İş değeri olmayan eski mesajlar: tamamen sil
  const silinen = await prisma.whatsAppMessage.deleteMany({
    where: {
      receivedAt: { lt: sinir },
      ticketId: null,
      readingId: null,
    },
  });

  // 2) Fişe/okumaya bağlı olanlar: yalnızca içeriği temizle, bağı koru.
  //    Zaten temizlenmiş olanları tekrar güncellememek için text: not null süzgeci var
  //    (her gece tüm geçmişi yeniden yazmasın).
  const anonimlestirilen = await prisma.whatsAppMessage.updateMany({
    where: {
      receivedAt: { lt: sinir },
      OR: [{ ticketId: { not: null } }, { readingId: { not: null } }],
      text: { not: null },
    },
    data: { text: null, mediaId: null, mediaType: null, contactName: null },
  });

  return {
    calisti: true,
    saklamaGun: gun,
    sinir: sinir.toISOString().slice(0, 10),
    silinen: silinen.count,
    anonimlestirilen: anonimlestirilen.count,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await run()) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Hata' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
