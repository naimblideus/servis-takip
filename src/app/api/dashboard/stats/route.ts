import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Duran iş eşiği: durumu bu kadar gündür değişmemiş açık fişler "duruyor" sayılır.
const STUCK_DAYS = 3;
// Sözleşme uyarısı: bu kadar gün içinde bitecek sözleşmeler önceden gösterilir.
const CONTRACT_WARN_DAYS = 45;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tenantId = user.tenantId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * 24 * 3600 * 1000);

  // NOT: Tüm fiş sorgularında deletedAt:null ŞART — çöp kutusundaki fişler sayılara girmemeli
  // (liste sayfası zaten deletedAt:null filtreliyordu; kartlar şişik gösteriyordu).
  const OPEN_STATUSES = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'] as const;

  const [
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue,
    recentTickets,
    lowStockRaw,
    rentalDevices,
    stuckRaw,
    contractRaw,
  ] = await Promise.all([
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, createdAt: { gte: startOfDay } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: 'WAITING_FOR_PART' },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: 'READY' },
    }),
    // ── BU AYIN TAHSİLATI — nakit defterinden ───────────────────────────
    // Eskiden bu, ödenmiş SERVİS FİŞLERİNİN toplamıydı ve iki yönden yanlıştı:
    //   1. Kira ve sayaç faturası tahsilatını HİÇ saymıyordu. Kiralama bayisinin
    //      gelirinin büyük kısmı orada; panel gerçeğin küçük bir dilimini
    //      "ciro" diye gösteriyor, Faturalar/Muhasebe ekranıyla çelişiyordu.
    //   2. Ölçüt `updatedAt`'ti. Eski bir fiş bu ay herhangi bir sebeple
    //      güncellenince (durum değişti, not eklendi) o ayın cirosuna giriyordu.
    // FinancialTransaction sistemdeki TEK nakit defteri: servis tahsilatı,
    // fatura tahsilatı ve cari tahsilat üçü de buraya yazılıyor. Muhasebe
    // ekranı da bunu okuyor — iki ekran artık aynı sayıyı söylüyor.
    prisma.financialTransaction.aggregate({
      where: { tenantId, type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.serviceTicket.findMany({
      where: { tenantId, deletedAt: null },
      include: { device: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.part.findMany({
      where: { tenantId },
      select: { stockQty: true, minStock: true },
    }),
    prisma.device.count({
      where: { tenantId, isRental: true },
    }),
    // DURAN İŞLER: açık ama STUCK_DAYS gündür durumu değişmemiş fişler (en uzun duran önce)
    prisma.serviceTicket.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        statusUpdatedAt: { lt: stuckBefore },
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        statusUpdatedAt: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true, phone: true } } } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { statusUpdatedAt: 'asc' },
      take: 50,
    }),
    // SÖZLEŞME UYARISI: bitmiş ya da CONTRACT_WARN_DAYS içinde bitecek sözleşmeler.
    // Yalnız KİRALIK cihazı olan müşteriler (sözleşme kiralamayla anlamlı).
    prisma.customer.findMany({
      where: {
        tenantId,
        contractEndDate: { not: null, lt: new Date(now.getTime() + CONTRACT_WARN_DAYS * 24 * 3600 * 1000) },
        devices: { some: { isRental: true } },
      },
      select: {
        id: true, name: true, phone: true, contractEndDate: true,
        _count: { select: { devices: true } },
      },
      orderBy: { contractEndDate: 'asc' },
      take: 30,
    }),
  ]);

  const lowStockItems = Array.isArray(lowStockRaw)
    ? lowStockRaw.filter((p: any) => p.stockQty <= p.minStock).length
    : 0;

  const stuckTickets = stuckRaw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status,
    days: Math.floor((now.getTime() - new Date(t.statusUpdatedAt).getTime()) / (24 * 3600 * 1000)),
    customerName: t.device?.customer?.name || '—',
    customerPhone: t.device?.customer?.phone || '',
    device: [t.device?.brand, t.device?.model].filter(Boolean).join(' '),
    technician: t.assignedUser?.name || null,
  }));

  const dayMs = 24 * 3600 * 1000;
  const contractAlerts = contractRaw.map((c) => {
    const end = new Date(c.contractEndDate!);
    // Gün farkı (bugünün başlangıcına göre): negatif = süresi geçmiş
    const days = Math.ceil((end.getTime() - startOfDay.getTime()) / dayMs);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      endDate: end.toISOString(),
      days,
      expired: days < 0,
      deviceCount: c._count.devices,
    };
  });

  // ── SAYACI GELMEYEN KİRALIK CİHAZ ──────────────────────────────────────
  // Bayinin bir numaralı derdi: "ayda 2-3 makinenin sayacı hiç gelmez, o ay
  // o makineden para kazanmam, çoğu zaman fark etmem bile." Faturalama öncesi
  // kontrol (invoices/preflight) bunu yalnız faturalama ANINDA gösteriyor;
  // ay boyu görünür değil. Burada her gün görünür.
  //
  // Ölçüt "bu dönem okunmadı" DEĞİL — ayın 2'sinde her cihaz okunmamış olur,
  // kart 51/51 gösterir, anlamsız. Ölçüt: son okuması 35 günden eski ya da hiç
  // okuması olmayan kiralık cihaz. Bu, düzeni kaçmış cihazı her gün doğru sayar.
  const esik = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const kiralikIdler = (await prisma.device.findMany({
    where: { tenantId, isRental: true }, select: { id: true },
  })).map((d) => d.id);
  let sayaciEksikCihaz = 0;
  if (kiralikIdler.length > 0) {
    const sonOkumalar = await prisma.counterReading.groupBy({
      by: ['deviceId'],
      where: { tenantId, deviceId: { in: kiralikIdler } },
      _max: { readingDate: true },
    });
    const guncel = new Set(
      sonOkumalar.filter((o) => o._max.readingDate && o._max.readingDate >= esik).map((o) => o.deviceId),
    );
    sayaciEksikCihaz = kiralikIdler.filter((id) => !guncel.has(id)).length;
  }

  return NextResponse.json({
    sayaciEksikCihaz,
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue: monthRevenue._sum.amount || 0,
    lowStockItems,
    rentalDevices,
    recentTickets,
    stuckTickets,
    stuckDays: STUCK_DAYS,
    contractAlerts,
  });
}
