// Fatura Sayaç Eki — faturanın SAYAÇ satırlarını "önceki → yeni sayaç" dökümüyle açıklar.
// Amaç: "Bu ay niye 4.300, geçen ay 3.100'dü?" telefonunu bitirmek.
// Tek kaynak: hem authed yazdırma hem müşteriye giden public belge bunu kullanır.
import { prisma } from '@/lib/prisma';

export interface CounterAppendixRow {
  device: string;
  location: string | null;
  channel: 'BLACK' | 'COLOR';
  prev: number | null;   // dönem başındaki sayaç
  current: number | null; // dönem sonundaki sayaç
  pages: number;          // dönemde çekilen toplam sayfa
  included: number;       // kiraya dahil sayfa
  billed: number;         // faturalanan (aşım) adet
  unitPrice: number;
  lineTotal: number;
  lastReadAt: Date | null;
}

export interface CounterAppendix {
  rows: CounterAppendixRow[];
  totalPages: number;
  totalBilled: number;
  totalAmount: number;
  hasIncluded: boolean; // hiçbir cihazda dahil paket yoksa "Dahil/Aşım" sütunları gizlenir
}

function periodRange(period: string) {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(y, m - 1, 1, 0, 0, 0, 0), end: new Date(y, m, 1, 0, 0, 0, 0) };
}

/**
 * Faturanın COUNTER satırlarını, o dönemdeki sayaç okumalarıyla zenginleştirir.
 * Satırlar faturadan geldiği için ek TOPLAMI faturanın sayaç kısmıyla BİREBİR aynıdır.
 */
export async function buildCounterAppendix(
  tenantId: string,
  invoice: {
    period: string;
    customerId: string;
    lines: { kind: string; description: string; deviceId?: string | null; quantity: any; unitPrice: any; lineTotal: any }[];
  },
): Promise<CounterAppendix | null> {
  const counterLines = invoice.lines.filter((l) => l.kind === 'COUNTER' && l.deviceId);
  if (counterLines.length === 0) return null;

  const { start, end } = periodRange(invoice.period);
  const deviceIds = Array.from(new Set(counterLines.map((l) => l.deviceId!)));

  const [devices, readings] = await Promise.all([
    prisma.device.findMany({
      where: { tenantId, id: { in: deviceIds } },
      select: { id: true, brand: true, model: true, location: true, includedBlack: true, includedColor: true },
    }),
    prisma.counterReading.findMany({
      where: { tenantId, deviceId: { in: deviceIds }, readingDate: { gte: start, lt: end } },
      orderBy: { readingDate: 'asc' },
      select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true, deltaBlack: true, deltaColor: true },
    }),
  ]);

  const devMap = new Map(devices.map((d) => [d.id, d]));
  const byDevice = new Map<string, typeof readings>();
  for (const r of readings) {
    const list = byDevice.get(r.deviceId) || [];
    list.push(r);
    byDevice.set(r.deviceId, list);
  }

  const rows: CounterAppendixRow[] = [];

  for (const line of counterLines) {
    const dev = devMap.get(line.deviceId!);
    if (!dev) continue;
    // Kanal: satır açıklaması bizim ürettiğimiz metin ("Sayaç (Renkli) — ...")
    const channel: 'BLACK' | 'COLOR' = /renkli/i.test(line.description) ? 'COLOR' : 'BLACK';
    const list = byDevice.get(line.deviceId!) || [];

    let prev: number | null = null;
    let current: number | null = null;
    let pages = 0;
    let lastReadAt: Date | null = null;

    if (list.length) {
      const first = list[0];
      const last = list[list.length - 1];
      lastReadAt = last.readingDate;
      if (channel === 'BLACK') {
        prev = first.counterBlack - first.deltaBlack;
        current = last.counterBlack;
        pages = list.reduce((s, r) => s + r.deltaBlack, 0);
      } else {
        prev = first.counterColor - first.deltaColor;
        current = last.counterColor;
        pages = list.reduce((s, r) => s + r.deltaColor, 0);
      }
    }

    rows.push({
      device: `${dev.brand} ${dev.model}`,
      location: dev.location || null,
      channel,
      prev,
      current,
      pages,
      included: (channel === 'BLACK' ? dev.includedBlack : dev.includedColor) ?? 0,
      billed: Number(line.quantity) || 0,
      unitPrice: Number(line.unitPrice) || 0,
      lineTotal: Number(line.lineTotal) || 0,
      lastReadAt,
    });
  }

  // Yer → cihaz → kanal sırası (dökümle aynı mantık)
  const coll = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
  rows.sort((a, b) => {
    const la = a.location || '', lb = b.location || '';
    if (!la && lb) return 1;
    if (la && !lb) return -1;
    const byLoc = coll.compare(la, lb);
    if (byLoc !== 0) return byLoc;
    const byDev = coll.compare(a.device, b.device);
    return byDev !== 0 ? byDev : (a.channel === b.channel ? 0 : a.channel === 'BLACK' ? -1 : 1);
  });

  return {
    rows,
    totalPages: rows.reduce((s, r) => s + r.pages, 0),
    totalBilled: rows.reduce((s, r) => s + r.billed, 0),
    totalAmount: Math.round(rows.reduce((s, r) => s + r.lineTotal, 0) * 100) / 100,
    hasIncluded: rows.some((r) => r.included > 0),
  };
}
