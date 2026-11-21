import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';
import { syncTicketToCari } from '@/lib/ticket-cari';

async function yonetici() {
  const session = await auth();
  if (!session) return { hata: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const user = await prisma.user.findFirst({ where: { email: session.user?.email!, ...bayiSuzgeci(session) }, select: { tenantId: true, role: true } });
  if (!user) return { hata: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  if (user.role !== 'ADMIN') return { hata: ucHatasi('BU_ISLEM_ICIN_YONETICI_YETKISI', 403) };
  return { tenantId: user.tenantId };
}

// Aktarıma giren fişler: iptal/silinmemiş, tutarı > 0 (customerId şemada zorunlu).
const aktarilacak = (tenantId: string) => ({ tenantId, deletedAt: null, status: { not: 'CANCELLED' as const }, totalCost: { gt: 0 } });

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/tickets/backfill-cari — ÖNCE ÖZET (2026-11-21, yanlış basma koruması).
// Hiçbir şey yazmaz. Düğmeye basınca bayi "kaç fiş, kaç TL cariye borç olarak
// düşecek" görür; çıplak "emin misiniz" yerine neyi onayladığını bilir.
export async function GET() {
  const y = await yonetici();
  if ('hata' in y) return y.hata;

  const fisler = await prisma.serviceTicket.findMany({
    where: aktarilacak(y.tenantId),
    select: { id: true, totalCost: true, invoiceId: true },
  });
  const satislar = await prisma.accountEntry.findMany({
    where: { tenantId: y.tenantId, type: 'SALE', ticketId: { in: fisler.map((f) => f.id) } },
    select: { ticketId: true, amount: true },
  });
  const cariTutar = new Map(satislar.map((s) => [s.ticketId, Number(s.amount)]));

  let yeni = 0, yeniTutar = 0, degisen = 0, fark = 0, faturali = 0;
  for (const f of fisler) {
    const tutar = Number(f.totalCost) || 0;
    const cari = cariTutar.get(f.id);
    if (cari === undefined) {
      yeni++; yeniTutar += tutar;
      // Kira/sayaç faturasına parça satırı olarak girmiş fiş: cariye de
      // yazılırsa aynı tutar iki yerde borç görünebilir. Bayi bunu bilsin.
      if (f.invoiceId) faturali++;
    } else if (Math.abs(cari - tutar) > 0.005) {
      degisen++; fark += tutar - cari;
    }
  }
  return NextResponse.json({ toplam: fisler.length, yeni, yeniTutar: r2(yeniTutar), degisen, fark: r2(fark), faturali });
}

// POST /api/tickets/backfill-cari — Açık (iptal/silinmemiş, tutarı>0, müşterili) tüm servis fişlerini
// Muhasebe/Cari'ye işle. İdempotent (syncTicketToCari uzlaştırıcı). Yalnız ADMIN.
export async function POST() {
  const y = await yonetici();
  if ('hata' in y) return y.hata;

  const tickets = await prisma.serviceTicket.findMany({
    where: aktarilacak(y.tenantId),
    select: { id: true },
  });

  let synced = 0;
  for (const t of tickets) {
    try { const r = await syncTicketToCari(t.id, y.tenantId); if (r.synced) synced++; }
    catch (e: any) { console.error('BACKFILL CARI ERROR', t.id, e?.message); }
  }

  return NextResponse.json({ ok: true, processed: tickets.length, synced });
}
