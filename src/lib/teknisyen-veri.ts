/**
 * TEKNİSYEN KARNESİ — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/teknisyen.ts'te; burası veriyi toplayıp oraya veriyor.
 *
 * SÜRELER SLA MOTORUYLA AYNI YERDEN GELİYOR (lib/sla.ts): aynı çalışma
 * takvimi, aynı yaz saati hesabı. İkinci bir süre hesabı yazmak, SLA
 * ekranıyla karnenin aynı fiş için farklı dakika söylemesi demekti.
 *
 * KAPANIŞ ANI İKİ KAYNAKTAN: önce aşama geçmişi (READY/DELIVERED satırı),
 * o yoksa fişin son durum damgası (statusUpdatedAt). İkincisi YAKLAŞIK
 * işaretlenir ve süre ölçümüne girmez; yalnız "geri geldi mi" penceresini
 * kurar. Aktarılmış kayıtlarda geçmiş satırı yoktur ve bu fişleri ölçüden
 * atmak, bayinin bütün tarihini görünmez yapardı.
 *
 * "Açık mı" sorusu da fişin KENDİ durumundan cevaplanır, geçmişinden değil:
 * aşama satırı yazılmamış TESLİM EDİLMİŞ bir fişi "hâlâ açık" göstermek,
 * ekranın söylediği her sayıyı yanlış yapardı.
 *
 * TEK FARK PARÇA BEKLEMESİ. SLA'da bekleme ancak sözleşme öyle diyorsa
 * düşülür — söz müşteriye verilmiştir. Karnede HER ZAMAN düşülür: parçanın
 * depoda olmaması teknisyenin elinde değildir, onu teknisyenin süresine
 * yazmak karneyi satın alma performansının ölçüsü yapardı.
 */
import { prisma } from '@/lib/prisma';
import { isFailure } from '@/lib/fault-categories';
import {
  calismaDakikasi, duraklamaDakikasi, olaylariCikar,
  type CalismaTakvimi,
} from '@/lib/sla';
import { takvimKur } from '@/lib/sla-veri';
import { karneCikar, TEKRAR_GUN, type KarneFisi, type KarneSonucu } from '@/lib/teknisyen';

const GUN_MS = 86_400_000;

export interface KarneVerisi extends KarneSonucu {
  takvim: CalismaTakvimi;
  /** Takvim bozuk kurulmuşsa süre ölçülemez — ekran bunu söylemeli. */
  takvimSorunlu: boolean;
  /** Tekrar penceresi (gün) — ekran açıklamasında geçer. */
  tekrarGun: number;
}

/**
 * Dönemin teknisyen karnesi.
 *
 * Fişler AÇILIŞA göre süzülür. Kapanışa göre süzmek, dönem içinde açılıp
 * hâlâ kapanmamış işleri karneden düşürürdü — yani en uzun sürenleri.
 *
 * Tekrar tespiti için dönem sonundan {TEKRAR_GUN} gün SONRASINA kadar açılan
 * fişler de çekilir; onlar karnede sayılmaz, yalnız "geri geldi mi" sorusunu
 * cevaplar.
 */
export async function karneOlc(
  tenantId: string,
  bas: Date,
  son: Date,
  simdi: Date = new Date(),
): Promise<KarneVerisi> {
  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      workTimezone: true, workDays: true, workStartMin: true,
      workEndMin: true, workHolidays: true,
    },
  });
  const takvim = takvimKur(bayi ?? {});
  // SLA ekranındaki ile aynı sonda: bir haftalık aralık ölçülemiyorsa takvim bozuktur.
  const takvimSorunlu = calismaDakikasi(
    new Date(Date.UTC(2026, 0, 5, 0, 0)), new Date(Date.UTC(2026, 0, 9, 23, 0)), takvim,
  ) === null;

  const izlemeSonu = new Date(son.getTime() + TEKRAR_GUN * GUN_MS);
  const fisler = await prisma.serviceTicket.findMany({
    where: { tenantId, deletedAt: null, createdAt: { gte: bas, lte: izlemeSonu } },
    select: {
      id: true, ticketNumber: true, createdAt: true, deviceId: true, customerId: true,
      assignedUserId: true, faultCategory: true, status: true, statusUpdatedAt: true,
      assignedUser: { select: { name: true } },
      device: { select: { brand: true, model: true, serialNo: true } },
      statusHistory: { select: { status: true, changedAt: true, kaynak: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });

  // ServiceTicket.customerId denormalize alandır, ilişki değil: ad ayrı okunur.
  const musteriAdi = new Map<string, string>();
  if (fisler.length) {
    const kayitlar = await prisma.customer.findMany({
      where: { tenantId, id: { in: [...new Set(fisler.map((f) => f.customerId))] } },
      select: { id: true, name: true },
    });
    for (const m of kayitlar) musteriAdi.set(m.id, m.name);
  }

  const girdiler: KarneFisi[] = fisler.map((f) => {
    const olay = olaylariCikar(
      f.statusHistory.map((s) => ({ status: String(s.status), changedAt: s.changedAt, kaynak: s.kaynak })),
      f.createdAt,
    );
    const sureOlculemez = olay.turetilmis || takvimSorunlu;

    // Açık işin süresi ölçülmez: "şu ana kadar" bir ölçüm değil, bir tahmindir
    // ve ortancayı bitmemiş işlerle aşağı çeker.
    let mudahaleDk: number | null = null;
    if (!sureOlculemez && olay.ilkMudahale) {
      const ham = calismaDakikasi(olay.acilis, olay.ilkMudahale, takvim);
      const dus = duraklamaDakikasi(olay.duraklamalar, olay.acilis, olay.ilkMudahale, takvim);
      mudahaleDk = ham === null ? null : Math.max(0, ham - dus);
    }
    let cozumDk: number | null = null;
    if (!sureOlculemez && olay.cozum) {
      const ham = calismaDakikasi(olay.acilis, olay.cozum, takvim);
      const dus = duraklamaDakikasi(olay.duraklamalar, olay.acilis, olay.cozum, takvim);
      cozumDk = ham === null ? null : Math.max(0, ham - dus);
    }

    // Fişin kendi durumu: kapalı mı, iptal mi.
    const durum = String(f.status);
    const iptal = durum === 'CANCELLED' || olay.iptal;
    const kapali = durum === 'READY' || durum === 'DELIVERED';

    // Kapanış anı: önce aşama geçmişi, o yoksa son durum damgası (yaklaşık).
    // Damga açılıştan önceyse kullanılmaz — bozuk kayıttan tarih üretmeyiz.
    let cozum = olay.cozum;
    let kapanisYaklasik = false;
    if (!cozum && kapali && !iptal && f.statusUpdatedAt >= olay.acilis) {
      cozum = f.statusUpdatedAt;
      kapanisYaklasik = true;
    }

    const kategori = f.faultCategory ? String(f.faultCategory) : null;
    return {
      id: f.id,
      ticketNumber: f.ticketNumber,
      teknisyenId: f.assignedUserId,
      teknisyenAdi: f.assignedUser?.name ?? null,
      cihazId: f.deviceId,
      cihaz: [f.device?.brand, f.device?.model, f.device?.serialNo].filter(Boolean).join(' '),
      musteri: musteriAdi.get(f.customerId) ?? '—',
      kategori,
      arizaMi: isFailure(kategori),
      acilis: olay.acilis,
      cozum,
      acik: !kapali && !iptal,
      kapanisYaklasik,
      iptal,
      sureOlculemez,
      mudahaleDk,
      cozumDk,
      pencerede: f.createdAt >= bas && f.createdAt <= son,
    };
  });

  // Dönemde iş almamış teknisyen de görünsün. Yalnız TECHNICIAN rolü sıfır
  // satırıyla eklenir; sahaya çıkan yönetici zaten fişiyle listeye girer.
  const teknisyenler = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: 'TECHNICIAN' },
    select: { id: true, name: true },
    take: 500,
  });

  return {
    ...karneCikar(girdiler, simdi, teknisyenler.map((t) => ({ id: t.id, ad: t.name }))),
    takvim,
    takvimSorunlu,
    tekrarGun: TEKRAR_GUN,
  };
}
