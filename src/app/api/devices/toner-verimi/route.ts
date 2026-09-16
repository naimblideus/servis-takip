import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { verimGruplari, verimUygula } from '@/lib/toner-verimi';
import { verimleriOgren } from '@/lib/verim-ogrenme';
import { modelSayfaMaliyetleri } from '@/lib/teklif';
import { karneSatiri, karneSirasi, karneOzeti } from '@/lib/verim-karnesi';
import { writeAudit, istekIp } from '@/lib/audit';

/**
 * TONER VERİMİ — model bazında listeleme ve toplu uygulama.
 *
 * Gruplama ve yazma AYNI fonksiyondan (`toner-verimi.ts`) geçiyor. İkisi
 * ayrı yazılsaydı listedeki "25 cihaz" ile yazmanın bulduğu cihaz kümesi
 * ayrışırdı ve bayi bastığı düğmenin ne yaptığını bilemezdi.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    // Sahada ölçülmüş verimler burada üretilip tabloya veriliyor.
    // toner-verimi.ts bunu kendisi çağırsaydı iki modül birbirini içe
    // aktarırdı ve o döngü bir gün sebebi bulunamayan bir hata olurdu.
    const ogrenilen = await verimleriOgren(tenantId);
    const gruplar = await verimGruplari(tenantId, ogrenilen.model);

    const cihaz = gruplar.reduce((a, g) => a + g.cihaz, 0);
    const verimli = gruplar.reduce((a, g) => a + g.verimli, 0);
    // ── KAPSANAN ≠ ELLE GİRİLEN ──────────────────────────────────────
    // Bu özet yalnız ELLE girilmiş verimi sayıyordu ve ölçüm motoru
    // geldikten sonra yanlış oldu: sistem 41 cihazın verimini sahadan
    // ölçtüğü hâlde ekran "41 cihazda verim eksik" diyordu. Ölçülmüş bir
    // model, o modeldeki bütün cihazları kapsıyor.
    const kapsanan = gruplar.reduce(
      (a, g) => a + (g.olculenSb || g.olculenRenkli ? g.cihaz : g.verimli), 0,
    );

    // ── KARNE ────────────────────────────────────────────────────────
    // Ölçülen verim tek başına bir sayı; anlamı SAYFA MALİYETİNDE ortaya
    // çıkıyor. O hesap (kartuş fiyatı ÷ gerçek verim) teklif motorunda
    // zaten vardı ama yalnız teklif ekranında görünüyordu — bayi kendi
    // maliyetini göremiyordu. Aynı kaynaktan besleniyor ki iki ekran
    // ayrı sayı söylemesin.
    const maliyetler = await modelSayfaMaliyetleri(tenantId);
    const satirlar = gruplar
      .map((g) => {
        const m = maliyetler.get(g.anahtar);
        return karneSatiri({
          anahtar: g.anahtar, marka: g.marka, model: g.model, cihaz: g.cihaz,
          kutuSb: g.mevcutSb, kutuRenkli: g.mevcutRenkli,
          olculenSb: g.olculenSb, olculenRenkli: g.olculenRenkli,
          gozlemSb: g.gozlemSb, gozlemRenkli: g.gozlemRenkli,
          maliyetSb: m?.sb ?? null, maliyetRenkli: m?.renkli ?? null,
        });
      })
      .sort(karneSirasi);

    return NextResponse.json({
      gruplar,
      satirlar,
      karne: karneOzeti(satirlar),
      ozet: {
        model: gruplar.length, cihaz, verimli,
        kapsanan, eksik: cihaz - kapsanan,
        // Kaç modelin verimi ELLE GİRİLMEDEN, sahadan öğrenildi.
        olculenModel: gruplar.filter((g) => g.olculenSb || g.olculenRenkli).length,
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const govde = await req.json().catch(() => ({}));

    const anahtar = typeof govde?.anahtar === 'string' ? govde.anahtar : '';
    if (!anahtar) return NextResponse.json({ error: 'Model seçilmedi' }, { status: 400 });

    /** Boş dize "temizle" değil "dokunma" demek — alan hiç gönderilmemiş sayılır. */
    const sayi = (v: unknown): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    };

    const sonuc = await verimUygula(tenantId, anahtar, {
      sb: sayi(govde.sb),
      renkli: sayi(govde.renkli),
      ezme: govde.ezme === true,
    });

    if (sonuc.hata) return NextResponse.json({ error: sonuc.hata }, { status: 400 });

    /**
     * DENETİM: toplu verim yazmak, sonradan üretilecek her tahmini
     * etkiliyor. Yanlış bir değer girildiğinde "bunu kim, ne zaman, hangi
     * modele yazdı" sorusunun cevabı olmalı.
     */
    if (sonuc.guncellenen > 0)
      await writeAudit({
        tenantId,
        userId: user.id,
        action: 'TONER_VERIMI_TOPLU_YAZILDI',
        entityType: 'Device',
        entityId: tenantId,
        newValue: { anahtar, sb: sayi(govde.sb), renkli: sayi(govde.renkli), guncellenen: sonuc.guncellenen, ezme: govde.ezme === true },
        ipAddress: istekIp(req),
      });

    return NextResponse.json({ ok: true, ...sonuc });
  } catch (e) {
    return authErrorResponse(e);
  }
}
