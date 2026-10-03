/**
 * TONER DURUMU — bayinin bütün cihazlarının toner tahmini ve cihazdan
 * ölçülen seviyesi. Sarf Takibi, toner sevki ve tedarikçi siparişi AYNI
 * hesabı kullanır: biri "bitiyor" derken diğeri başka sayı söylemesin.
 */
import { prisma } from '@/lib/prisma';
import { dailyRate, forecastChannel, olcumleBirlestir, soonestDaysLeft, type TonerReadingPoint } from '@/lib/toner';
import { TONER_KRITIK } from '@/lib/sayac-tarama';
import { bayiMagazasi, musteriMagazaLinki } from '@/lib/magaza-baglanti';
import { verimleriOgren, populasyonVerimleri, verimSec } from '@/lib/verim-ogrenme';
import { modelAnahtari } from '@/lib/toner-verimi';

/** Cihazdan okunan toner yüzdesi bu kadar eskiyse artık kullanılmaz. */
export const OLCUM_GECERLI_MS = 7 * 86_400_000;
/** Bu kadar gün içinde bitecek toner "yakında" sayılır. */
export const YAKINDA_GUN = 14;

export async function tonerDurumu(tenantId: string) {
  // ── HANGİ CİHAZLAR ───────────────────────────────────────────────
  // Eskiden yalnız verimi ELLE GİRİLMİŞ cihazlar listeleniyordu ve
  // ölçüldüğünde 854 cihazın 853'ü dışarıda kalıyordu: özellik
  // kimsenin dolduramayacağı bir alan yüzünden kapalıydı. Artık hepsi
  // çekiliyor ve verimi ÖLÇÜLMÜŞ olanlar da listeye giriyor; hiçbir
  // kaynaktan verim çıkmayan cihaz yine listeye girmiyor (uydurma yok).
  const devices = await prisma.device.findMany({
    where: { tenantId },
    include: {
      customer: {
        select: {
          id: true, name: true, phone: true, address: true,
          // Mağaza bağlantısı için: müşteri panelinin jetonu mağazada da geçerli.
          portalToken: true, portalEnabled: true,
        },
      },
    },
  });

  // Bayinin mağazası var mı? Yoksa 'sipariş bağlantısı' düğmesi hiç gösterilmez.
  const magaza = await bayiMagazasi(tenantId);

  // Ölçülmüş verimler: bu bayinin kendi kayıtları + popülasyon.
  const ogrenilen = await verimleriOgren(tenantId);
  const populasyon = await populasyonVerimleri();

  const ids = devices.map((d) => d.id);
  // Son 120 günün okumaları — hız hesabı için (tek sorgu, JS'te grupla)
  const since = new Date(Date.now() - 120 * 86400000);
  const readings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId, deviceId: { in: ids }, readingDate: { gte: since } },
        select: { deviceId: true, counterBlack: true, counterColor: true, readingDate: true },
        orderBy: { readingDate: 'asc' },
      })
    : [];
  const byDevice = new Map<string, TonerReadingPoint[]>();
  for (const r of readings) {
    const arr = byDevice.get(r.deviceId) || [];
    arr.push({ readingDate: r.readingDate, counterBlack: r.counterBlack, counterColor: r.counterColor });
    byDevice.set(r.deviceId, arr);
  }

  const olcumSiniri = Date.now() - OLCUM_GECERLI_MS;
  const items = devices.map((d) => {
    const pts = byDevice.get(d.id) || [];
    // Ağ tarayıcısının cihazdan okuduğu yüzde (taze ise).
    const olcumTaze = d.olcumAt !== null && d.olcumAt.getTime() >= olcumSiniri;
    const mAnahtar = modelAnahtari(d.brand, d.model);
    // Verim SORULMUYOR, ÖLÇÜLÜYOR. Sıra: elle girilen → bu cihazın
    // kendi geçmişi → aynı modelin diğer cihazları → popülasyon.
    const verimSb = verimSec({
      elle: d.tonerYieldBlack,
      cihaz: ogrenilen.cihaz.get(`${d.id}|BLACK`),
      model: ogrenilen.model.get(`${mAnahtar}|BLACK`),
      populasyon: populasyon.get(`${mAnahtar}|BLACK`),
    });
    const verimRenkli = verimSec({
      elle: d.tonerYieldColor,
      cihaz: ogrenilen.cihaz.get(`${d.id}|COLOR`),
      model: ogrenilen.model.get(`${mAnahtar}|COLOR`),
      populasyon: populasyon.get(`${mAnahtar}|COLOR`),
    });
    const hizSb = dailyRate(pts, 'black');
    const hizRenkli = dailyRate(pts, 'color');
    const black = olcumleBirlestir({
      tahmin: forecastChannel({
        yieldPages: verimSb.deger,
        reset: d.tonerResetBlack ?? null,
        current: d.counterBlack ?? null,
        rate: hizSb,
        channel: 'black',
      }),
      olcum: olcumTaze ? d.olcumSiyah : null,
      yieldPages: verimSb.deger, current: d.counterBlack ?? null, rate: hizSb, channel: 'black',
    });
    const color = olcumleBirlestir({
      tahmin: forecastChannel({
        yieldPages: verimRenkli.deger,
        reset: d.tonerResetColor ?? null,
        current: d.counterColor ?? null,
        rate: hizRenkli,
        channel: 'color',
      }),
      olcum: olcumTaze ? d.olcumRenkli : null,
      yieldPages: verimRenkli.deger, current: d.counterColor ?? null, rate: hizRenkli, channel: 'color',
    });
    const soonest = soonestDaysLeft([black, color]);
    const needsSetup = (black?.needsSetup || color?.needsSetup) ?? false;
    // Müşteriye gönderilecek sipariş bağlantısı. Portal kapalıysa null —
    // kırık bağlantı göndermek, hiç göndermemekten kötüdür.
    const magazaLink = musteriMagazaLinki(
      magaza,
      d.customer?.portalToken ?? null,
      d.customer?.portalEnabled ?? false
    );

    return {
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location,
      // portalToken DIŞARI ÇIKMAZ: bağlantının içinde zaten var, ayrıca
      // göndermek jetonu gereksiz yere ikinci bir yere kopyalamak olur.
      customer: d.customer
        ? { id: d.customer.id, name: d.customer.name, phone: d.customer.phone, address: d.customer.address }
        : null,
      magazaLink,
      tonerChangedAt: d.tonerChangedAt ? d.tonerChangedAt.toISOString() : null,
      black, color, soonestDaysLeft: soonest, needsSetup,
      olcumAt: olcumTaze ? d.olcumAt!.toISOString() : null,
      // Cihazın kendi söylediği en düşük yüzde — gün tahmini olmasa da aciliyet.
      enAzYuzde: [black, color].filter((f) => f?.olculdu).reduce<number | null>((m, f) => (m === null ? f!.remainingPct : Math.min(m, f!.remainingPct ?? 100)), null),
      // Verimin NEREDEN geldiği ekranda yazıyor: ölçülmüş bir sayıyla
      // elle girilmiş bir sayı aynı güvende değil ve bayi hangisine
      // baktığını bilmeli.
      verimSb, verimRenkli,
      // Sevk ve sipariş için: hangi tonerin bu cihaza uyduğu model üzerinden de aranır.
      modelAnahtari: mAnahtar,
      counterColor: d.counterColor,
      tonerYieldColor: d.tonerYieldColor,
    };
  });

  // Sıralama: cihazın "bitmek üzere" dediği → gün sayısı olanlar (en acil önce) → veri bekleyenler → kurulum bekleyenler
  const kritik = (i: (typeof items)[number]) => i.enAzYuzde !== null && i.enAzYuzde <= TONER_KRITIK;
  items.sort((a, b) => {
    if (kritik(a) !== kritik(b)) return kritik(a) ? -1 : 1;
    if (kritik(a) && kritik(b)) return (a.enAzYuzde as number) - (b.enAzYuzde as number);
    const ax = a.soonestDaysLeft, bx = b.soonestDaysLeft;
    // Gün tahmini yoksa cihazın ölçtüğü yüzde sıralar (ölçümü olmayan en sonda).
    if (ax == null && bx == null) return (a.enAzYuzde ?? 101) - (b.enAzYuzde ?? 101);
    if (ax == null) return 1;
    if (bx == null) return -1;
    return ax - bx;
  });

  // Verimi hiçbir kaynaktan bilinmeyen cihaz listede görünmüyor: o
  // cihaz için söylenecek bir şey yok ve boş satır listeyi kullanılmaz
  // yapardı. Kaç tane olduğu ayrıca bildiriliyor.
  const takipli = items.filter((i) => i.black || i.color);
  const olculen = takipli.filter(
    (i) => i.verimSb.kaynak && i.verimSb.kaynak !== 'ELLE'
      || i.verimRenkli.kaynak && i.verimRenkli.kaynak !== 'ELLE',
  ).length;
  const urgent = takipli.filter((i) => (i.soonestDaysLeft != null && (i.soonestDaysLeft as number) <= YAKINDA_GUN) || kritik(i)).length;
  // Toner yüzdesi cihazın kendisinden okunan cihaz sayısı (ağ tarayıcısı).
  const canli = takipli.filter((i) => i.olcumAt !== null).length;
  return { takipli, bilinmeyen: items.length - takipli.length, olculen, urgent, canli };
}

export type TonerCihazi = Awaited<ReturnType<typeof tonerDurumu>>['takipli'][number];
