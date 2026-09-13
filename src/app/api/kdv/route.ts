import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { kdvOzeti } from '@/lib/kdv';
import { periodOf } from '@/lib/invoicing';
import { ESKI_SISTEM } from '@/lib/fatura-belgesi';

/**
 * GET /api/kdv?donem=YYYY-MM
 *
 * ── NİÇİN ────────────────────────────────────────────────────────────────
 * "Bu ay ne kadar KDV ödeyeceğim?" — ön muhasebe programının aylık açılma
 * sebebi. Cevabı burada verebiliyorsak bayinin ikinci bir programa rakam
 * girmesi gerekmiyor.
 *
 * ── TAHAKKUK ESASI ───────────────────────────────────────────────────────
 * Defterimiz nakit esaslı (gelir tahsilatta yazılıyor) ama KDV faturanın
 * TARİHİNE bağlı. Bu yüzden satış tarafı invoiceDate'e göre süzülüyor;
 * tahsil edilip edilmediğine bakılmıyor.
 *
 * ── KAPSAM DIŞI OLANLAR AÇIKÇA SÖYLENİYOR ────────────────────────────────
 * · Faturalanmamış servis işleri (fiş kesilip nakit alınmış, fatura yok)
 * · Göçte aktarılan eski sistem faturaları (orada beyan edildi)
 * · KDV'si girilmemiş giderler
 * Sessizce dışarıda bırakmak, bayiye olduğundan farklı bir rakam
 * göstermek demekti.
 */

export async function GET(req: NextRequest) {
  // Mali veri — yalnız yönetici.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const donem = req.nextUrl.searchParams.get('donem') || periodOf();
    const [y, m] = donem.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Dönem YYYY-AA biçiminde olmalı' }, { status: 400 });
    }
    const bas = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const bit = new Date(y, m, 1, 0, 0, 0, 0);

    const [faturalar, giderler, faturasizFis] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: {
          tenantId, deletedAt: null,
          status: { not: 'CANCELLED' },
          invoiceDate: { gte: bas, lt: bit },
          // GÖÇTE AKTARILANLAR HARİÇ: onlar eski sistemde kesildi ve orada
          // beyan edildi. Buraya katmak aynı KDV'yi iki kez beyan etmek olur.
          OR: [{ eBelgeDurum: null }, { eBelgeDurum: { not: ESKI_SISTEM } }],
        },
        select: {
          invoiceNumber: true, invoiceDate: true,
          subtotal: true, vatRate: true, vatAmount: true, totalAmount: true,
        },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.expense.findMany({
        where: { tenantId, date: { gte: bas, lt: bit } },
        select: { description: true, date: true, amount: true, vatRate: true, vatAmount: true, payee: true, invoiceNo: true },
        orderBy: { date: 'asc' },
      }),
      // Faturası olmayan, ücretli ve teslim edilmiş fişler: KDV'si bu
      // özette YOK. Sayısını söylemezsek bayi eksik rakamı tam sanır.
      prisma.serviceTicket.count({
        where: {
          tenantId, deletedAt: null, invoiceId: null,
          totalCost: { gt: 0 },
          createdAt: { gte: bas, lt: bit },
        },
      }),
    ]);

    const sayi = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const ozet = kdvOzeti(
      donem,
      faturalar.map((f) => ({
        invoiceNumber: f.invoiceNumber, invoiceDate: f.invoiceDate,
        subtotal: Number(f.subtotal), vatRate: Number(f.vatRate),
        vatAmount: Number(f.vatAmount), totalAmount: Number(f.totalAmount),
      })),
      giderler.map((g) => ({
        description: g.description, date: g.date,
        amount: Number(g.amount), vatRate: sayi(g.vatRate), vatAmount: sayi(g.vatAmount),
      })),
    );

    return NextResponse.json({
      ...ozet,
      kapsamDisi: {
        faturasizFis,
        aciklama: 'Bu özet bir beyanname değildir; muhasebecinize verilecek rakamı üretir. '
          + 'Tevkifat, istisna ve devreden KDV mahsubu kapsam dışıdır.',
      },
      faturalar: faturalar.slice(0, 200).map((f) => ({
        no: f.invoiceNumber, tarih: f.invoiceDate,
        matrah: Number(f.subtotal), oran: Number(f.vatRate), kdv: Number(f.vatAmount),
      })),
      giderler: giderler.slice(0, 200).map((g) => ({
        aciklama: g.description, tarih: g.date, satici: g.payee, faturaNo: g.invoiceNo,
        tutar: Number(g.amount), oran: sayi(g.vatRate), kdv: sayi(g.vatAmount),
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
