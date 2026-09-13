import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dailyRate, forecastChannel, soonestDaysLeft, type TonerReadingPoint } from '@/lib/toner';
import { oturumKullanicisi } from '@/lib/api-auth';
import { bayiMagazasi, musteriMagazaLinki } from '@/lib/magaza-baglanti';
import { verimleriOgren, populasyonVerimleri, verimSec } from '@/lib/verim-ogrenme';
import { modelAnahtari } from '@/lib/toner-verimi';

// GET /api/toner — toner takibi açık cihazların tükenme tahmini (proaktif sevkiyat listesi).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // ── HANGİ CİHAZLAR ───────────────────────────────────────────────
  // Eskiden yalnız verimi ELLE GİRİLMİŞ cihazlar listeleniyordu ve
  // ölçüldüğünde 854 cihazın 853'ü dışarıda kalıyordu: özellik
  // kimsenin dolduramayacağı bir alan yüzünden kapalıydı. Artık hepsi
  // çekiliyor ve verimi ÖLÇÜLMÜŞ olanlar da listeye giriyor; hiçbir
  // kaynaktan verim çıkmayan cihaz yine listeye girmiyor (uydurma yok).
  const devices = await prisma.device.findMany({
    where: { tenantId: user.tenantId },
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
  const magaza = await bayiMagazasi(user.tenantId);

  // Ölçülmüş verimler: bu bayinin kendi kayıtları + popülasyon.
  const ogrenilen = await verimleriOgren(user.tenantId);
  const populasyon = await populasyonVerimleri();

  const ids = devices.map((d) => d.id);
  // Son 120 günün okumaları — hız hesabı için (tek sorgu, JS'te grupla)
  const since = new Date(Date.now() - 120 * 86400000);
  const readings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, readingDate: { gte: since } },
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

  const items = devices.map((d) => {
    const pts = byDevice.get(d.id) || [];
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
    const black = forecastChannel({
      yieldPages: verimSb.deger,
      reset: d.tonerResetBlack ?? null,
      current: d.counterBlack ?? null,
      rate: dailyRate(pts, 'black'),
      channel: 'black',
    });
    const color = forecastChannel({
      yieldPages: verimRenkli.deger,
      reset: d.tonerResetColor ?? null,
      current: d.counterColor ?? null,
      rate: dailyRate(pts, 'color'),
      channel: 'color',
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
      // Verimin NEREDEN geldiği ekranda yazıyor: ölçülmüş bir sayıyla
      // elle girilmiş bir sayı aynı güvende değil ve bayi hangisine
      // baktığını bilmeli.
      verimSb, verimRenkli,
    };
  });

  // Sıralama: gün sayısı olanlar (en acil önce) → veri bekleyenler → kurulum bekleyenler
  items.sort((a, b) => {
    const ax = a.soonestDaysLeft, bx = b.soonestDaysLeft;
    if (ax == null && bx == null) return 0;
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
  const urgent = takipli.filter((i) => i.soonestDaysLeft != null && (i.soonestDaysLeft as number) <= 14).length;
  return NextResponse.json({
    items: takipli,
    trackedCount: takipli.length,
    // Verimi hiç bilinmeyen cihaz sayısı — ekranda "ikinci toner
    // değişiminde kendiliğinden açılacak" diye gösteriliyor.
    bilinmeyen: items.length - takipli.length,
    olculen,
    urgent,
  });
}
