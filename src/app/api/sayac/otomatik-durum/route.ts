import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { cihazDurumu, filoOzeti, siraAnahtari, KAYNAK_CIHAZ } from '@/lib/otomatik-sayac';

/**
 * GET /api/sayac/otomatik-durum — hangi cihaz otomatik sayaç gönderiyor?
 *
 * Ölçüldüğünde 872 cihazlı bayide otomatik gönderen cihaz sayısı SIFIRDI ve
 * bunu hiçbir ekran söylemiyordu: kanal çalışıyor, ekran var, kurulum yönergesi
 * var — ama "kaç cihazda kurulu" sorusunun cevabı yoktu. Kurulum ilerlemesi
 * ölçülemeyen bir iş yapılmıyor demektir.
 *
 * Durum tamamen OKUMA GEÇMİŞİNDEN türetilir (source = CIHAZ_EPOSTA); elle
 * işaretlenen bir "kuruldu" alanı yok, olsaydı cihaz yeniden ayarlandığı an
 * yalan söylemeye başlardı.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();

    // Yalnız KİRALIK cihazlar: satılmış cihazın sayacı bayiyi ilgilendirmez,
    // listeye karışırsa "kurulmadı" sayısı gerçekte olmayan bir işi büyütür.
    const cihazlar = await prisma.device.findMany({
      where: { tenantId, isRental: true },
      select: {
        id: true, serialNo: true, brand: true, model: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { serialNo: 'asc' },
    });

    if (!cihazlar.length) {
      return NextResponse.json({ ozet: filoOzeti([]), cihazlar: [] });
    }

    // Tüm otomatik okumaların tarihleri tek sorguda; cihaz başına sorgu
    // atmak 872 cihazda 872 gidiş-geliş ederdi.
    const okumalar = await prisma.counterReading.findMany({
      where: { tenantId, source: KAYNAK_CIHAZ, deviceId: { in: cihazlar.map((c) => c.id) } },
      select: { deviceId: true, readingDate: true },
      orderBy: { readingDate: 'asc' },
    });

    const tarihler = new Map<string, Date[]>();
    for (const o of okumalar) {
      const liste = tarihler.get(o.deviceId);
      if (liste) liste.push(o.readingDate);
      else tarihler.set(o.deviceId, [o.readingDate]);
    }

    const simdi = new Date();
    const satirlar = cihazlar.map((c) => {
      const d = cihazDurumu(tarihler.get(c.id) ?? [], simdi);
      return {
        deviceId: c.id,
        seri: c.serialNo,
        marka: c.brand,
        model: c.model,
        musteri: c.customer?.name ?? null,
        telefon: c.customer?.phone ?? null,
        musteriId: c.customer?.id ?? null,
        durum: d.durum,
        sonGonderim: d.sonGonderim,
        sessizGun: d.sessizGun,
        araGun: d.araGun,
        gonderimSayisi: d.gonderimSayisi,
        aciklama: d.aciklama,
        _sira: siraAnahtari(d),
      };
    });

    satirlar.sort((a, b) => a._sira - b._sira);

    return NextResponse.json({
      ozet: filoOzeti(satirlar.map((s) => s.durum)),
      cihazlar: satirlar.map(({ _sira, ...r }) => r),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
