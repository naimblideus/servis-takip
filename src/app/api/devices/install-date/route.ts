import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';

/**
 * Cihaz yaşı — toplu giriş, kanıt sınırı ve KEŞİF.
 *
 * Tasarım tezi: kalıcı motivasyon rozetten değil, GERÇEK ve DEĞİŞKEN keşiften gelir.
 * 20 cihazın yaşı girilince 17'sinde bir şey olmaz, 3'ünde "7 yaşında, son 12 ayda
 * 5 arıza — yenileme adayı" çıkar. Beklenmedik ama gerçek bulgu, sahte ödülün
 * asla veremeyeceği şeyi verir: para kokusu.
 *
 * Ayrıca 552 cihaz göstermek moral kırar — bitirilebilir 20'lik parti sunulur.
 */

const PARTI = 20;                 // bitirilebilir iş büyüklüğü
const YAS_ESIGI_AY = 60;          // 5 yıl
const ARIZA_ESIGI = 3;            // son 12 ayda

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const customerId = searchParams.get('customerId') || undefined;

  const [toplam, dolu, bilinmeyen] = await Promise.all([
    prisma.device.count({ where: { tenantId: user.tenantId } }),
    prisma.device.count({ where: { tenantId: user.tenantId, installedAt: { not: null } } }),
    prisma.device.count({ where: { tenantId: user.tenantId, installDateUnknown: true } }),
  ]);

  const devices = await prisma.device.findMany({
    where: {
      tenantId: user.tenantId,
      installedAt: null,
      installDateUnknown: false,            // "bilmiyorum" denenler bir daha sorulmaz
      ...(customerId ? { customerId } : {}),
      ...(q ? {
        OR: [
          { brand: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { serialNo: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true, brand: true, model: true, serialNo: true, customerId: true,
      customer: { select: { name: true } },
      // Kanıt: ilk servis kaydı => cihaz EN GEÇ o tarihte kuruluydu.
      // Bu bir üst sınırdır, kurulum tarihi DEĞİLDİR — arayüz böyle sunar.
      // Çöpe atılmış fiş kanıt sayılmaz: silinmiş bir fiş en eskiyse cihaz
      // olduğundan yaşlı görünüyor ve Yenileme raporu yanlış aday üretiyordu.
      serviceTickets: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { createdAt: true } },
    },
    orderBy: [{ customerId: 'asc' }, { brand: 'asc' }],
    take: PARTI,
  });

  // Aynı müşterinin kaç cihazı daha bekliyor (toplu uygulama teklifi için)
  const grupSayilari: Record<string, number> = {};
  if (devices.length) {
    const gr = await prisma.device.groupBy({
      by: ['customerId'],
      where: {
        tenantId: user.tenantId, installedAt: null, installDateUnknown: false,
        customerId: { in: [...new Set(devices.map(d => d.customerId))] },
      },
      _count: true,
    });
    gr.forEach(g => { grupSayilari[g.customerId] = g._count; });
  }

  return NextResponse.json({
    toplam, dolu, bilinmeyen,
    kalan: toplam - dolu - bilinmeyen,
    parti: PARTI,
    devices: devices.map(d => ({
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo,
      customerId: d.customerId,
      customerName: d.customer?.name || null,
      musterideBekleyen: grupSayilari[d.customerId] || 1,
      // en geç bu tarihte kuruluydu (kanıt)
      enGecKurulum: d.serviceTickets[0]?.createdAt ?? null,
    })),
  });
}

/**
 * PATCH — { ids, year?, month?, unknown? }
 * Yıl gönderilir (gün değil): bayi günü hatırlamaz. Hassasiyet ayrıca saklanır.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : [];
    if (!ids.length) return NextResponse.json({ error: 'Cihaz seçilmedi' }, { status: 400 });

    // "Bilmiyorum" — soruldu, cevap yok. Tarih UYDURULMAZ, sadece işaretlenir.
    if (body.unknown) {
      const r = await prisma.device.updateMany({
        where: { id: { in: ids }, tenantId: user.tenantId },
        data: { installDateUnknown: true, installedAt: null, installedAtPrecision: null },
      });
      const sayac = await sayimlar(user.tenantId);
      return NextResponse.json({ guncellenen: r.count, kesifler: [], ...sayac });
    }

    const year = parseInt(body.year);
    if (!year || year < 1990 || year > new Date().getFullYear()) {
      return NextResponse.json({ error: 'Geçersiz yıl' }, { status: 400 });
    }
    const month = body.month ? Math.min(Math.max(parseInt(body.month), 1), 12) : null;
    const tarih = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
    if (tarih.getTime() > Date.now()) {
      return NextResponse.json({ error: 'Kurulum tarihi gelecekte olamaz' }, { status: 400 });
    }

    const res = await prisma.device.updateMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
      data: {
        installedAt: tarih,
        installedAtPrecision: month ? 'MONTH' : 'YEAR',
        installDateUnknown: false,
      },
    });

    // ── KEŞİF: yaş girildiği anda ortaya çıkan gerçek bulgular ──
    // Uydurma yok: yalnızca yaş + son 12 ayın arıza sayısı.
    const kesifler = await bulKesifler(user.tenantId, ids, tarih);
    const sayac = await sayimlar(user.tenantId);
    return NextResponse.json({ guncellenen: res.count, kesifler, ...sayac });
  } catch (e: any) {
    console.error('INSTALL DATE PATCH ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function sayimlar(tenantId: string) {
  const [toplam, dolu, bilinmeyen] = await Promise.all([
    prisma.device.count({ where: { tenantId } }),
    prisma.device.count({ where: { tenantId, installedAt: { not: null } } }),
    prisma.device.count({ where: { tenantId, installDateUnknown: true } }),
  ]);
  return { toplam, dolu, bilinmeyen, kalan: toplam - dolu - bilinmeyen };
}

/** Yaşı yeni öğrenilen cihazlardan "yenileme adayı" çıkanlar. */
async function bulKesifler(tenantId: string, ids: string[], tarih: Date) {
  const yasAy = Math.floor((Date.now() - tarih.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (yasAy < YAS_ESIGI_AY) return [];

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const devices = await prisma.device.findMany({
    where: { id: { in: ids }, tenantId },
    select: {
      id: true, brand: true, model: true,
      customer: { select: { name: true } },
      _count: { select: { serviceTickets: { where: { deletedAt: null, createdAt: { gte: since } } } } },
    },
  });

  return devices
    .filter(d => d._count.serviceTickets >= ARIZA_ESIGI)
    .map(d => ({
      deviceId: d.id,
      baslik: `${d.brand} ${d.model}`,
      musteri: d.customer?.name || null,
      yasAy,
      arizaSayisi: d._count.serviceTickets,
    }));
}
