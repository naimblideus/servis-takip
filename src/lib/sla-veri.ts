/**
 * SLA ÖLÇÜMÜ — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/sla.ts'te; burası yalnız veriyi toplayıp oraya veriyor.
 * Ayrı durmalarının sebebi: hesabın testi veritabanı istemesin. SLA raporu
 * müşteriye gösterilen bir belge; hesabın doğruluğu tartışmaya açık olamaz.
 */
import { prisma } from '@/lib/prisma';
import {
  calismaDakikasi, olaylariCikar, slaOlcumu, slaOzeti,
  type CalismaTakvimi, type SlaHedefi, type SlaOlcum, type SlaOzeti,
} from '@/lib/sla';

/** Bayinin çalışma takvimini kaydından kurar. */
export function takvimKur(bayi: {
  workTimezone?: string | null;
  workDays?: string | null;
  workStartMin?: number | null;
  workEndMin?: number | null;
  workHolidays?: string | null;
}): CalismaTakvimi {
  const gunler = String(bayi.workDays ?? '1,2,3,4,5')
    .split(',').map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return {
    zamanDilimi: bayi.workTimezone || 'Europe/Istanbul',
    gunler: gunler.length ? gunler : [1, 2, 3, 4, 5],
    baslangicDk: bayi.workStartMin ?? 540,
    bitisDk: bayi.workEndMin ?? 1080,
    tatiller: String(bayi.workHolidays ?? '')
      .split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
  };
}

export interface SlaFisi {
  id: string;
  ticketNumber: string;
  musteriId: string;
  musteri: string;
  cihaz: string;
  acilis: string;
  /** Sözleşmenin hedefi — fişin hangi söze göre ölçüldüğü raporda görünsün. */
  hedefMudahaleDk: number | null;
  hedefCozumDk: number | null;
  parcaDurdurur: boolean;
  olcum: SlaOlcum;
}

export interface SlaMusteri {
  musteriId: string;
  musteri: string;
  hedefMudahaleDk: number | null;
  hedefCozumDk: number | null;
  ozet: SlaOzeti;
}

export interface SlaSonuc {
  ozet: SlaOzeti;
  musteriler: SlaMusteri[];
  fisler: SlaFisi[];
  takvim: CalismaTakvimi;
  /** Takvim bozuk kurulmuşsa ölçüm yapılamaz — ekran bunu söylemeli. */
  takvimSorunlu: boolean;
  /** Hiç SLA hedefi tanımlanmamışsa ekran "önce sözleşmeye yaz" der. */
  hedefliSozlesme: number;
}

/**
 * Dönem içinde AÇILMIŞ fişleri ölçer.
 *
 * Neden açılışa göre: SLA sözü "bildirimden itibaren" işler. Kapanışa göre
 * süzmek, ayın sonunda hâlâ açık duran gecikmiş fişi rapordan düşürürdü —
 * yani raporun en önemli satırını gizlerdi.
 */
export async function slaOlc(
  tenantId: string,
  bas: Date,
  son: Date,
  simdi: Date = new Date(),
): Promise<SlaSonuc> {
  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      workTimezone: true, workDays: true, workStartMin: true,
      workEndMin: true, workHolidays: true,
    },
  });
  const takvim = takvimKur(bayi ?? {});
  const takvimSorunlu = calismaDakikasi(
    new Date(Date.UTC(2026, 0, 5, 0, 0)), new Date(Date.UTC(2026, 0, 9, 23, 0)), takvim,
  ) === null;

  // Yalnız SLA hedefi TANIMLI sözleşmeler. Hedefi olmayan müşteriyi ölçüme
  // katmak, uydurulmuş bir hedefe göre uyum oranı üretmek olurdu.
  const sozlesmeler = await prisma.contract.findMany({
    where: {
      tenantId,
      status: 'AKTIF',
      OR: [{ slaResponseMins: { not: null } }, { slaResolutionMins: { not: null } }],
    },
    select: {
      customerId: true, slaResponseMins: true, slaResolutionMins: true, slaPauseOnPart: true,
      startDate: true, endDate: true,
    },
    orderBy: { startDate: 'desc' },
  });

  // Aynı müşteride birden çok sözleşme olabilir: EN YENİ başlayan geçerlidir.
  const hedefler = new Map<string, SlaHedefi>();
  for (const s of sozlesmeler) {
    if (hedefler.has(s.customerId)) continue;
    hedefler.set(s.customerId, {
      mudahaleDk: s.slaResponseMins ?? null,
      cozumDk: s.slaResolutionMins ?? null,
      parcaDurdurur: s.slaPauseOnPart,
    });
  }

  const fisler = await prisma.serviceTicket.findMany({
    where: { tenantId, deletedAt: null, createdAt: { gte: bas, lte: son } },
    select: {
      id: true, ticketNumber: true, customerId: true, createdAt: true,
      device: { select: { brand: true, model: true, serialNo: true } },
      statusHistory: { select: { status: true, changedAt: true, kaynak: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const musteriAdi = new Map<string, string>();
  if (fisler.length) {
    const kayitlar = await prisma.customer.findMany({
      where: { tenantId, id: { in: [...new Set(fisler.map((f) => f.customerId))] } },
      select: { id: true, name: true },
    });
    for (const m of kayitlar) musteriAdi.set(m.id, m.name);
  }

  const cikti: SlaFisi[] = [];
  for (const f of fisler) {
    const hedef = hedefler.get(f.customerId);
    // Hedefi olmayan müşterinin fişi "HEDEF_YOK" olarak kaydedilir; sayısı
    // raporda görünür, uyum oranını bozmaz.
    const kullanilanHedef: SlaHedefi = hedef ?? { mudahaleDk: null, cozumDk: null, parcaDurdurur: false };
    const olay = olaylariCikar(
      f.statusHistory.map((s) => ({ status: String(s.status), changedAt: s.changedAt, kaynak: s.kaynak })),
      f.createdAt,
    );
    cikti.push({
      id: f.id,
      ticketNumber: f.ticketNumber,
      musteriId: f.customerId,
      musteri: musteriAdi.get(f.customerId) ?? '—',
      cihaz: [f.device?.brand, f.device?.model, f.device?.serialNo].filter(Boolean).join(' '),
      acilis: olay.acilis.toISOString(),
      hedefMudahaleDk: kullanilanHedef.mudahaleDk,
      hedefCozumDk: kullanilanHedef.cozumDk,
      parcaDurdurur: kullanilanHedef.parcaDurdurur,
      olcum: slaOlcumu(olay, kullanilanHedef, takvim, simdi),
    });
  }

  // Müşteri kırılımı — büyük müşteri raporu bu satırdan çıkar.
  const grup = new Map<string, SlaFisi[]>();
  for (const f of cikti) {
    if (!grup.has(f.musteriId)) grup.set(f.musteriId, []);
    grup.get(f.musteriId)!.push(f);
  }
  const musteriler: SlaMusteri[] = [...grup.entries()]
    .map(([id, liste]) => ({
      musteriId: id,
      musteri: liste[0].musteri,
      hedefMudahaleDk: liste[0].hedefMudahaleDk,
      hedefCozumDk: liste[0].hedefCozumDk,
      ozet: slaOzeti(liste.map((x) => x.olcum)),
    }))
    .filter((m) => m.ozet.olculen > 0)
    // En çok ihlali olan üstte: rapora bakan kişi önce sorunu görsün.
    .sort((a, b) => (b.ozet.mudahaleIhlal + b.ozet.cozumIhlal) - (a.ozet.mudahaleIhlal + a.ozet.cozumIhlal));

  return {
    ozet: slaOzeti(cikti.map((x) => x.olcum)),
    musteriler,
    fisler: cikti,
    takvim,
    takvimSorunlu,
    hedefliSozlesme: hedefler.size,
  };
}
