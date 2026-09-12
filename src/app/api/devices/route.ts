import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizeBrandModel } from '@/lib/device-brands';
import { oturumKullanicisi } from '@/lib/api-auth';

function generatePublicCode() {
  return 'DEV-' + randomBytes(3).toString('hex').toUpperCase();
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  // Müşteri süzgeci: seçtiren ekranlar bütün cihazları çekip tarayıcıda
  // elemesin. Süzgeç TENANT KOŞULUNA EK — tek başına kimlik değil.
  const customerId = new URL(req.url).searchParams.get('customerId');
  const devices = await prisma.device.findMany({
    where: { tenantId: user!.tenantId, ...(customerId ? { customerId } : {}) },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(devices);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    // Marka/model ters girilmişse düzelt, yazımı kanonikleştir ("canon" -> "Canon").
    // Marka tanınmıyorsa dokunulmaz.
    const nz = normalizeBrandModel(body.brand, body.model);
    const device = await prisma.device.create({
      data: {
        tenantId: user.tenantId,
        customerId: body.customerId,
        brand: nz.brand,
        model: nz.model,
        serialNo: body.serialNo,
        barcode: body.barcode?.trim() || null,
        location: body.location || null,
        // Cihaz yaşı — geriye dönük telafi edilemez, bu yüzden ilk kayıtta yakalanır
        installedAt: body.installedAt ? new Date(body.installedAt) : null,
        manufacturedAt: body.manufacturedAt ? new Date(body.manufacturedAt) : null,
        isRental: body.isRental || false,
        monthlyRent: body.isRental ? (parseFloat(body.monthlyRent) || 0) : 0,
        pricePerBlack: body.isRental && body.pricePerBlack ? parseFloat(body.pricePerBlack) : null,
        pricePerColor: body.isRental && body.pricePerColor ? parseFloat(body.pricePerColor) : null,
        includedBlack: body.isRental ? (parseInt(body.includedBlack) || 0) : 0,
        includedColor: body.isRental ? (parseInt(body.includedColor) || 0) : 0,
        overagePriceBlack: body.isRental && body.overagePriceBlack ? parseFloat(body.overagePriceBlack) : null,
        overagePriceColor: body.isRental && body.overagePriceColor ? parseFloat(body.overagePriceColor) : null,
        counterBlack: body.counterBlack ? parseInt(body.counterBlack) : null,
        counterColor: body.counterColor ? parseInt(body.counterColor) : null,
        qrTokenHash: randomBytes(32).toString('hex'),
        publicCode: generatePublicCode(),
      },
    });

    // ── BAŞLANGIÇ OKUMASI ─────────────────────────────────────────────
    // Formda girilen devir sayacı YALNIZCA cihaz kartına yazılıyordu, okuma
    // kaydı üretmiyordu. Sonuç sessiz kayıp: kartta 48.210 yazıyor, ilk
    // gerçek okuma 52.410 geldiğinde zincirin başı orası sayılıyor ve
    // aradaki 4.200 sayfa hiçbir yere düşmüyordu — ne faturaya, ne geçmişe.
    // Ölçüldü: telefondan cihaz eklenip sayaç girildiğinde ilk okumanın
    // farkı 0, cihaz kartındaki devir değeri ise üzerine yazılıyor.
    //
    // Aynı hata içe aktarma yolunda zaten bulunup düzeltilmişti (bkz.
    // api/import/sheet: bir bayide 552 cihazda 69,7 milyon sayfa yazılıydı
    // ve okuma sayısı sıfırdı). Elle ekleme yolu o düzeltmenin dışında
    // kalmış. Bayi cihazları tek tek eklerken de aynı şey oluyordu.
    //
    // Zincirin başı: delta 0 — devredilen sayaç bu ayın kullanımı değildir —
    // ve billed:true ile kapalı, yani faturaya asla girmez. Bundan sonraki
    // ilk gerçek okuma farkı doğru hesaplar.
    if (device.counterBlack != null || device.counterColor != null) {
      await prisma.counterReading.create({
        data: {
          tenantId: user.tenantId, deviceId: device.id,
          counterBlack: device.counterBlack ?? 0,
          counterColor: device.counterColor ?? 0,
          deltaBlack: 0, deltaColor: 0, calculatedCost: 0,
          billed: true, source: 'ELLE',
        },
      });
    }

    return NextResponse.json(device);
  } catch (e: any) {
    console.error('DEVICE CREATE ERROR:', e.message);
    if (e.code === 'P2002') {
      const f = (e.meta?.target || []).join(',');
      return NextResponse.json({ error: f.includes('barcode') ? 'Bu barkod başka bir cihaza atanmış (model-bazlı barkod olabilir; seri no kullanın)' : 'Bu seri no zaten kayıtlı' }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
