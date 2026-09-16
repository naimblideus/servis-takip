import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { deviceMetrics } from '@/lib/reliability';
import { csvMetni, csvSayi, csvBasliklari, csvDosyaAdi } from '@/lib/csv';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { yenilemeSebebi } from '@/lib/rapor-metin';

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
    const { user, tenantId } = await requireTenantUser();
    const months = Math.min(24, Math.max(3, Number(new URL(req.url).searchParams.get('months')) || 12));
    const { devices } = await deviceMetrics(tenantId, { months });

    const adaylar = [];
    let yasEksik = 0;

    // Gerekçe METNİ değil, gerekçenin KENDİSİ dönüyor: sayılar ayrı alanda,
    // cümleyi ekran (ve CSV) kendi dilinde kuruyor.
    type Sebep =
      | { kod: 'YASLI_SIK'; yil: number; ay: number; ziyaret: number; kategorili: number; kategorisiz: number }
      | { kod: 'COK_SERVIS'; ay: number; ziyaret: number; kategorili: number; kategorisiz: number }
      | { kod: 'ZARAR'; maliyet: number; gelir: number };

    for (const d of devices) {
      const sebepler: Sebep[] = [];
      let skor = 0;

      // Yenileme kararında önemli olan "hangi arıza" değil, KAÇ KEZ SERVİS GEREKTİĞİ.
      // Bu yüzden kategorisi girilmemiş fişler de sayılır (planlı bakım hariç).
      // Kategori kapsamı ayrıca raporlanır — sayı şişirmiyoruz, kaynağını yazıyoruz.
      const ziyaret = d.failures + d.uncategorized;

      // 1) Yaşlı + sık servis
      if (d.ageMonths !== null && d.ageMonths >= YAS_ESIGI_AY && ziyaret >= ARIZA_ESIGI) {
        sebepler.push({
          kod: 'YASLI_SIK', yil: Math.floor(d.ageMonths / 12), ay: months,
          ziyaret, kategorili: d.failures, kategorisiz: d.uncategorized,
        });
        skor += ziyaret * 2 + Math.floor(d.ageMonths / 12);
      }
      // 2) Çok servis (yaştan bağımsız — cihaz sorunlu)
      else if (ziyaret >= COK_ARIZA) {
        sebepler.push({
          kod: 'COK_SERVIS', ay: months,
          ziyaret, kategorili: d.failures, kategorisiz: d.uncategorized,
        });
        skor += ziyaret * 2;
      }

      // 3) Zarar ettiriyor: parça maliyeti geliri aşmış (yalnızca ikisi de biliniyorsa)
      if (d.isRental && d.revenue > 0 && d.partsCost > d.revenue) {
        sebepler.push({ kod: 'ZARAR', maliyet: Math.round(d.partsCost), gelir: Math.round(d.revenue) });
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

    // CSV: ekrandaki tabloyla aynı satırlar, aynı sırada (skora göre).
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      // CSV'yi indiren KULLANICI: başlıklar ve gerekçeler onun dilinde.
      const { sz, b } = await sunucuBicimi(user);
      const metin = csvMetni(
        [
          sz.yenileme.csvMarkaModel, sz.yenileme.csvSeriNo, sz.yenileme.csvMusteri,
          sz.yenileme.csvYasAy, sz.yenileme.csvYasKesin, sz.yenileme.csvAriza, sz.yenileme.csvPlanli,
          doldur(sz.yenileme.csvParcaMaliyeti, { s: b.simge }),
          doldur(sz.yenileme.csvKiraGeliri, { s: b.simge }),
          sz.yenileme.csvSkor, sz.yenileme.csvGerekceler,
        ],
        adaylar.map((a) => [
          a.baslik, a.serialNo, a.musteri,
          a.yasAy ?? '', a.yasAy === null ? '' : (a.yasBelirsiz ? sz.yenileme.csvYalnizYil : sz.yenileme.csvEvet),
          a.ariza, a.planli, csvSayi(a.parcaMaliyet), csvSayi(a.gelir), a.skor,
          // Gerekçeler tek hücrede; ayıraç olarak " · " kullanıyoruz ki
          // noktalı virgül sütun kaydırmasın (kütüphane zaten kaçırıyor).
          a.sebepler.map((s) => yenilemeSebebi(sz, b, s)).join(' · '),
        ]),
      );
      return new NextResponse(metin, { headers: csvBasliklari(csvDosyaAdi('yenileme-firsatlari', String(months) + 'ay')) });
    }

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
