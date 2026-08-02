import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { deviceMetrics } from '@/lib/reliability';

/**
 * YENİLEME FIRSATLARI — bayinin doğrudan parası.
 *
 * "Hangi cihaz sana kazandırdığından çok masraf çıkarıyor / yaşlandı ve sürekli
 * bozuluyor" sorusuna cevap verir. Cihaz yaşı girildikçe liste zenginleşir —
 * veri girme emeğinin karşılığı budur.
 *
 * DÜRÜSTLÜK: her satırın GEREKÇESİ yazılır. Yaşı bilinmeyen cihaz yaşa bağlı
 * kurallara girmez; bunun yerine "eksik veri" olarak ayrıca raporlanır ki
 * bayi neyi doldurursa ne kazanacağını görsün.
 */
const YAS_ESIGI_AY = 60;     // 5 yıl
const ARIZA_ESIGI = 3;       // 12 ayda
const COK_ARIZA = 5;

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const months = Math.min(24, Math.max(3, Number(new URL(req.url).searchParams.get('months')) || 12));
    const { devices } = await deviceMetrics(tenantId, { months });

    const adaylar = [];
    let yasEksik = 0;

    for (const d of devices) {
      const sebepler: string[] = [];
      let skor = 0;

      // Yenileme kararında önemli olan "hangi arıza" değil, KAÇ KEZ SERVİS GEREKTİĞİ.
      // Bu yüzden kategorisi girilmemiş fişler de sayılır (planlı bakım hariç).
      // Kategori kapsamı ayrıca raporlanır — sayı şişirmiyoruz, kaynağını yazıyoruz.
      const ziyaret = d.failures + d.uncategorized;
      const ziyaretMetni = d.uncategorized > 0
        ? `${ziyaret} servis ziyareti (${d.failures} kategorili arıza, ${d.uncategorized} kategorisiz)`
        : `${ziyaret} arıza`;

      // 1) Yaşlı + sık servis
      if (d.ageMonths !== null && d.ageMonths >= YAS_ESIGI_AY && ziyaret >= ARIZA_ESIGI) {
        const yil = Math.floor(d.ageMonths / 12);
        sebepler.push(`${yil} yaşında ve son ${months} ayda ${ziyaretMetni}`);
        skor += ziyaret * 2 + Math.floor(d.ageMonths / 12);
      }
      // 2) Çok servis (yaştan bağımsız — cihaz sorunlu)
      else if (ziyaret >= COK_ARIZA) {
        sebepler.push(`Son ${months} ayda ${ziyaretMetni}`);
        skor += ziyaret * 2;
      }

      // 3) Zarar ettiriyor: parça maliyeti geliri aşmış (yalnızca ikisi de biliniyorsa)
      if (d.isRental && d.revenue > 0 && d.partsCost > d.revenue) {
        sebepler.push(`Parça maliyeti (${Math.round(d.partsCost)} ₺) kira gelirini (${Math.round(d.revenue)} ₺) aştı`);
        skor += Math.round((d.partsCost - d.revenue) / 100);
      }

      // Yaşı bilinmeyen ama sık servis gören cihazlar: yaş girilirse listeye girebilirler.
      // Bu sayı, veri girmenin somut karşılığıdır — arayüz bunu gösterir.
      if (d.ageMonths === null && ziyaret >= ARIZA_ESIGI && !sebepler.length) yasEksik++;

      if (sebepler.length) {
        adaylar.push({
          id: d.id,
          baslik: `${d.brand} ${d.model}`,
          serialNo: d.serialNo,
          musteri: d.customerName,
          yasAy: d.ageMonths,
          yasBelirsiz: d.agePrecision === 'YEAR',
          ariza: ziyaret,
          planli: d.planned,
          parcaMaliyet: Math.round(d.partsCost),
          gelir: Math.round(d.revenue),
          sebepler,
          skor,
        });
      }
    }

    adaylar.sort((a, b) => b.skor - a.skor);

    const yasiBilinen = devices.filter((d) => d.ageMonths !== null).length;
    return NextResponse.json({
      months,
      toplamCihaz: devices.length,
      yasiBilinen,
      yasKapsamPct: devices.length ? Math.round((yasiBilinen / devices.length) * 100) : 0,
      // Yaş girilirse listeye eklenebilecek muhtemel fırsat sayısı — veri girmenin karşılığı
      yasEksikFirsat: yasEksik,
      adaylar,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
