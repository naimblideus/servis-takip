import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopServisYetkili } from '@/lib/shop-auth';
import { createReading, ReadingError } from '@/lib/readings';

/**
 * POST /api/shop/sayac — müşterinin mağazadan girdiği sayaç okuması.
 *
 * ── NEDEN BU UÇ VAR ───────────────────────────────────────────────────
 * Toner tükenme tahmini de baskı aboneliği de SAYAÇ GEÇMİŞİ istiyor ve o
 * geçmiş yok. Ölçüldü (Saygılı, 2026-09-02): 854 cihaz, 86'sında okuma,
 * toplam 112 okuma. Yani iki özellik de veri yokluğundan kapalı.
 *
 * Okumayı bugün yalnız teknisyen giriyor — yani ancak servise gidildiğinde.
 * Oysa yazıcının üstünde QR var ve toner bitince biri zaten onun başında
 * duruyor. Ekrandaki sayacı okuyup yazmak on saniye; karşılığında "kaç gün
 * kaldı" tahmini açılıyor. Veriyi üreten ile ondan faydalanan aynı kişi.
 *
 * ── NEDEN MAĞAZA DOĞRUDAN YAZMIYOR ────────────────────────────────────
 * `shop-auth.ts`'in anlattığı kural: mağaza servis veritabanına YAZMAZ.
 * Sayaç okuması sıradan bir kayıt değil — kiralık cihazda FATURAYA giriyor
 * (`createReading` içinde `counterOverage`). İki uygulamanın aynı satırlara
 * yazması bu projede zaten bir kez düzeltilmiş bir hata sınıfı.
 *
 * Bütün korumalar `createReading`'in içinde ve olduğu gibi geçerli:
 * kiracı kapsamlı cihaz araması (IDOR), sayaç düşüşünün reddi, olağandışı
 * artış uyarısı, dönem içi kümülatif dahil paket hesabı.
 *
 * ── KAYNAK 'PORTAL' ───────────────────────────────────────────────────
 * Okumanın kanıt ağırlığı kaynağına bağlı (bkz. `OkumaKaynagi`). Müşterinin
 * kendi girdiği değer teknisyen fotoğrafıyla aynı ağırlıkta değildir ve
 * öyleymiş gibi kaydedilmemeli — bir fatura tartışmasında bu ayrım her şeyi
 * belirler.
 */
export async function POST(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  let body: {
    tenantId?: string;
    publicCode?: string;
    counterBlack?: number;
    counterColor?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { tenantId, publicCode, counterBlack, counterColor } = body;
  if (!tenantId || !publicCode) {
    return NextResponse.json({ error: 'tenantId ve publicCode zorunlu' }, { status: 400 });
  }
  if (!Number.isFinite(counterBlack) || (counterBlack as number) < 0) {
    return NextResponse.json({ error: 'Siyah sayaç değeri geçersiz' }, { status: 400 });
  }

  /**
   * Cihaz KODLA ve KİRACI KAPSAMINDA bulunuyor. Mağaza `deviceId`
   * göndermiyor: gönderseydi, mağazanın gördüğü bir kimliği doğrudan yazma
   * yoluna sokmuş olurduk. Kod zaten müşterinin elindeki etikette yazıyor
   * ve `publicCode` benzersiz — ama yine de kiracıyla birlikte aranıyor.
   */
  const device = await prisma.device.findFirst({
    where: { tenantId, publicCode },
    select: { id: true, counterColor: true },
  });
  if (!device) {
    return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });
  }

  /**
   * Renkli sayaç GÖNDERİLMEDİYSE son bilinen değer korunur, 0 YAZILMAZ.
   * Sıfır yazmak renkli sayacı geriletir; `createReading` bunu düşüş sayıp
   * reddeder ve mono makinesi olan müşteri hiçbir şey kaydedemez.
   */
  const renkli = Number.isFinite(counterColor) && (counterColor as number) >= 0
    ? (counterColor as number)
    : (device.counterColor ?? 0);

  try {
    const sonuc = await createReading({
      tenantId,
      deviceId: device.id,
      counterBlack: counterBlack as number,
      counterColor: renkli,
      source: 'PORTAL',
    });
    return NextResponse.json({ ok: true, uyari: sonuc.warning, deltaSb: sonuc.deltaBlack });
  } catch (e) {
    if (e instanceof ReadingError) {
      // Sayaç düşüşü bir HATA değil, bir SORU: cihaz sıfırlanmış olabilir.
      // Mağaza bunu müşteriye anlaşılır bir cümleyle gösteriyor.
      return NextResponse.json({ error: e.message, kod: e.code }, { status: e.status ?? 400 });
    }
    console.error('[shop/sayac]', e);
    return NextResponse.json({ error: 'Okuma kaydedilemedi' }, { status: 500 });
  }
}
