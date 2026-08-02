import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { prisma } from '@/lib/prisma';
import { modelStats, MIN_TENANTS_FOR_OEM, MIN_DEVICES_FOR_MODEL } from '@/lib/reliability';
import { faultLabel } from '@/lib/fault-categories';

/**
 * ÜRETİCİ VERİ ÜRÜNÜ — Canon / Konica Minolta / Pantum'a sunulacak katman.
 *
 * Üreticinin sahip OLMADIĞI tek şey: bağımsız bayilerin sahasındaki gerçek
 * davranış verisi. Garanti kayıtları gecikmeli ve yanlıdır; burada gerçek
 * servis kayıtları var.
 *
 * ⚠️ GÜVEN SINIRLARI — bunlar pazarlık konusu değildir:
 *  - Hiçbir bayi, müşteri, seri no veya kişi bilgisi DIŞARI ÇIKMAZ.
 *  - Bir satır ancak EN AZ ${MIN_TENANTS_FOR_OEM} farklı bayiden veri içeriyorsa gösterilir
 *    (k-anonimlik). Altındaki hücreler bastırılır — tek bayinin verisi
 *    "sektör verisi" diye sunulamaz.
 *  - Yetersiz cihaz sayısında SAYI ÜRETİLMEZ, sebebi yazılır.
 *  - Erişim yalnızca süper-admin; kiracı kullanıcıları bu uca ulaşamaz.
 *
 * Bayilerin verisi kendilerinindir. Bu uç, sözleşmede açıkça izin verilmiş
 * toplulaştırılmış kullanım içindir — teknik olarak da tekil veri sızdıramaz.
 */
export async function GET(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const months = Math.min(36, Math.max(6, Number(sp.get('months')) || 12));
    const brandFilter = (sp.get('brand') || '').trim();

    // Kapsamdaki bayiler
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);

    // Model bazlı toplu istatistik (kimlik yok)
    const { models } = await modelStats(tenantIds, { months });

    // Her model kaç FARKLI bayide görülüyor? — k-anonimlik ölçütü
    const devs = await prisma.device.findMany({
      select: { brand: true, model: true, tenantId: true },
    });
    const bayiSayisi = new Map<string, Set<string>>();
    for (const d of devs) {
      const k = `${d.brand}|||${d.model}`;
      if (!bayiSayisi.has(k)) bayiSayisi.set(k, new Set());
      bayiSayisi.get(k)!.add(d.tenantId);
    }

    const satirlar = models
      .filter((m) => !brandFilter || m.brand.toLocaleLowerCase('tr') === brandFilter.toLocaleLowerCase('tr'))
      .map((m) => {
        const k = `${m.brand}|||${m.model}`;
        const nBayi = bayiSayisi.get(k)?.size ?? 0;
        const kAnonimOk = nBayi >= MIN_TENANTS_FOR_OEM;

        // Bastırma: yeterli bayi yoksa sayılar GİZLENİR (kimliği çözülebilir olurdu)
        if (!kAnonimOk) {
          return {
            brand: m.brand, model: m.model,
            bayiSayisi: nBayi,
            gizlendi: true,
            sebep: `Yalnızca ${nBayi} bayide görülüyor — en az ${MIN_TENANTS_FOR_OEM} bayi gerekir (anonimlik)`,
          };
        }
        return {
          brand: m.brand,
          model: m.model,
          bayiSayisi: nBayi,
          gizlendi: false,
          cihazSayisi: m.deviceCount,
          yasiBilinenCihaz: m.withAge,
          ortalamaYasAy: m.avgAgeMonths,
          cihazYiliBasinaAriza: m.failuresPerDeviceYear,
          toplamAriza: m.totalFailures,
          planliZiyaret: m.totalPlanned,
          enSikArizalar: m.topFaults.map((f) => ({ kod: f.code, etiket: faultLabel(f.code), adet: f.count })),
          ortalamaParcaMaliyeti: m.avgPartsCost,
          guvenilir: m.reliable,
          not: m.note,
        };
      });

    const gosterilen = satirlar.filter((s) => !s.gizlendi);
    return NextResponse.json({
      uretilme: 'toplulastirilmis',
      pencereAy: months,
      kapsam: {
        bayiSayisi: tenantIds.length,
        toplamCihaz: devs.length,
        modelSayisi: models.length,
        gosterilebilenModel: gosterilen.length,
        kAnonimlikEsigi: MIN_TENANTS_FOR_OEM,
        modelIcinMinCihaz: MIN_DEVICES_FOR_MODEL,
      },
      // Dürüstlük notu yanıtın içinde taşınır; rapor bunu olduğu gibi gösterir
      sinirlar: [
        'Bayi, müşteri, seri no ve kişi bilgisi içermez.',
        `Bir satır en az ${MIN_TENANTS_FOR_OEM} farklı bayiden veri içermiyorsa bastırılır.`,
        'Yaşı bilinmeyen cihazlar yaş hesaplarına dahil edilmez.',
        'Periyodik bakım ve kurulum ziyaretleri arıza sayılmaz.',
      ],
      satirlar,
    });
  } catch (e: any) {
    console.error('OEM RELIABILITY ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
