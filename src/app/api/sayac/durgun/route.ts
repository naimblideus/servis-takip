import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { durgunlukDegerlendir, dikkatGerektirir, ASGARI_GUN } from '@/lib/sayac-durgunluk';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sayac/durgun — SAYACI GELEN AMA ARTMAYAN kiralık cihazlar.
 *
 * ── `/api/sayac/eksik` İLE FARKI ─────────────────────────────────────────
 * "Eksik" = sayaç HİÇ gelmiyor (kanal kopuk). Bu uç ise tersi: sayaç
 * düzenli geliyor, RAKAM ARTMIYOR. Bayinin sessiz kaybı burada:
 *   • müşteri makineyi kullanmıyor → kira karşılıksız, yenilemede iptal
 *   • makine bozuk/fişte değil → sessiz hizmet ihlali + servis fırsatı
 *   • makine başka ofise taşınmış → fatura yanlış müşteriye gidiyor
 *
 * ── MÜŞTERİYE GÖRE GRUPLU ────────────────────────────────────────────────
 * Bayi "hangi cihaz" diye değil "kimi arayacağım" diye bakar. Aynı
 * müşteride üç durgun cihaz varsa bu ÜÇ telefon değil BİR telefondur.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();

    // Yalnız kiralık: satılmış cihazda sayaç durgunluğu bayinin derdi değil.
    const cihazlar = await prisma.device.findMany({
      where: { tenantId, isRental: true },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true,
        monthlyRent: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (cihazlar.length === 0) {
      return NextResponse.json({ esikGun: ASGARI_GUN, toplam: 0, aylikRiskTutari: 0, musteriler: [] });
    }

    // Okumalar TEK sorguda — 1000 cihazlık filoda N+1 kabul edilemez.
    // Değerlendirme için son ~6 ay yeterli; daha eskisi kararı değiştirmiyor.
    const altiAyOnce = new Date(Date.now() - 190 * 86400000);
    const okumalar = await prisma.counterReading.findMany({
      where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) }, readingDate: { gte: altiAyOnce } },
      select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true },
      orderBy: { readingDate: 'asc' },
    });

    const cihazaGore = new Map<string, { readingDate: Date; counterBlack: number; counterColor: number }[]>();
    for (const o of okumalar) {
      const liste = cihazaGore.get(o.deviceId) ?? [];
      liste.push(o);
      cihazaGore.set(o.deviceId, liste);
    }

    type Satir = {
      id: string; brand: string; model: string; serialNo: string;
      location: string | null; aylikKira: number;
      durum: string; gun: number; aciklama: string;
    };
    const musteriler = new Map<string, { id: string; ad: string; telefon: string; cihazlar: Satir[]; aylikKira: number }>();
    let toplam = 0;
    let aylikRiskTutari = 0;

    for (const c of cihazlar) {
      const sonuc = durgunlukDegerlendir(cihazaGore.get(c.id) ?? []);
      if (!dikkatGerektirir(sonuc)) continue;

      toplam++;
      const kira = Number(c.monthlyRent ?? 0);
      aylikRiskTutari += kira;

      const anahtar = c.customer?.id ?? 'yok';
      const grup = musteriler.get(anahtar) ?? {
        id: c.customer?.id ?? '', ad: c.customer?.name ?? 'Müşterisiz cihaz',
        telefon: c.customer?.phone ?? '', cihazlar: [], aylikKira: 0,
      };
      grup.cihazlar.push({
        id: c.id, brand: c.brand, model: c.model, serialNo: c.serialNo,
        location: c.location, aylikKira: kira,
        durum: sonuc.durum, gun: sonuc.gun, aciklama: sonuc.aciklama,
      });
      grup.aylikKira += kira;
      musteriler.set(anahtar, grup);
    }

    // En çok kira riski olan müşteri önce — bayi sırayla arayacak.
    const liste = [...musteriler.values()].sort((a, b) => b.aylikKira - a.aylikKira);

    return NextResponse.json({
      esikGun: ASGARI_GUN,
      toplam,
      // Bu cihazların aylık kira toplamı: "karşılığı olmayan" gelir.
      // Kaybedilen para DEĞİL — risk altındaki para. Ayrım önemli:
      // müşteri yenilemede bunu fark ederse iptal eder.
      aylikRiskTutari: Math.round(aylikRiskTutari * 100) / 100,
      musteriler: liste,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
