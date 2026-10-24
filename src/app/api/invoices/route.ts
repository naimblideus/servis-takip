import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { donemFaturasiHazirla } from '@/lib/invoicing';
import { gecerliDonem, kesimGunu, varsayilanElleDonem } from '@/lib/fatura-donemi';
import { kosuDonemiKapatir, kosuyuKaydet } from '@/lib/fatura-turu';
import { docToken } from '@/lib/doc-token';
import { oturumKullanicisi, requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Faturalaması şu an süren bayiler. Doğruluk buna DAYANMIYOR: aynı müşteri
 * için iki fatura işlemi veritabanı kilidiyle sıraya giriyor ve ikincisi
 * boş çıkıyor (lib/invoicing). Bu küme yalnız ikinci basışa hemen "şu an
 * çalışıyor" demek için: yoksa ikinci istek bütün müşterileri bir daha
 * dolaşır ve "0 fatura" der — bayi faturaların kesilmediğini sanar.
 * Oturum düzeyli veritabanı kilidi kullanılmadı: Prisma bağlantı havuzunda
 * kilidin alındığı ve bırakıldığı bağlantının aynı olacağı garanti değil.
 * Canlıda tek Node süreci var (Coolify); globalThis, Next rotaları ayrı
 * paketlese de tek kopya kalsın diye.
 */
const FATURALAMA_SURUYOR: Set<string> =
  ((globalThis as { __faturalamaSuruyor?: Set<string> }).__faturalamaSuruyor ??= new Set());

// GET /api/invoices — Müşteri faturaları listesi + özet
export async function GET(req: Request) {
  // MALI VERI: yalniz yonetici. Menude gizlemek yetkilendirme degildir;
  // teknisyen adresi elle yazip butun musterilerin borcunu okuyabiliyordu.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const period = searchParams.get('period');

  const where: any = { tenantId: user.tenantId, deletedAt: null };
  if (status && status !== 'all') where.status = status;
  if (period) where.period = period;
  if (search?.trim()) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.customerInvoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    take: 200,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: true,
    },
  });

  const all = await prisma.customerInvoice.findMany({
    where: { tenantId: user.tenantId, deletedAt: null, status: { not: 'CANCELLED' } },
    select: { totalAmount: true, paidAmount: true, status: true },
  });
  const summary = {
    count: all.length,
    total: round2(all.reduce((s, i) => s + Number(i.totalAmount), 0)),
    open: round2(all.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0)),
    overdue: round2(
      all.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0)
    ),
    paidCount: all.filter((i) => i.status === 'PAID').length,
  };

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      docToken: docToken('fatura', i.id),
      invoiceNumber: i.invoiceNumber,
      period: i.period,
      invoiceDate: i.invoiceDate.toISOString(),
      dueDate: i.dueDate.toISOString(),
      status: i.status,
      source: i.source,
      customer: i.customer,
      subtotal: Number(i.subtotal),
      vatAmount: Number(i.vatAmount),
      totalAmount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      openAmount: round2(Number(i.totalAmount) - Number(i.paidAmount)),
      lines: i.lines.map((l) => ({
        kind: l.kind,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    })),
    summary,
  });
}

// POST /api/invoices — Bu tenant için dönem faturalarını manuel üret (idempotent)
export async function POST(req: Request) {
  // MALI VERI: yalniz yonetici. Menude gizlemek yetkilendirme degildir;
  // teknisyen adresi elle yazip butun musterilerin borcunu okuyabiliyordu.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* boş */
  }
  // DÖNEM. Eskiden varsayılan BUGÜNÜN ayıydı: ayın 2'sinde basan bayi yeni
  // ayı (neredeyse boş) kesiyor, kapanan ayı kesmiyordu. Varsayılan artık
  // lib/fatura-donemi varsayilanElleDonem (ayın ilk yarısı → kapanan ay,
  // ikinci yarısı → bu ay); ekran dönemi açıkça gönderiyor.
  if (body.period && !gecerliDonem(body.period)) return ucHatasi('GECERSIZ_DONEM', 400);
  const tenantId = user.tenantId;
  const ayar = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { invoiceDayOfMonth: true } });
  const kesim = kesimGunu(ayar?.invoiceDayOfMonth);
  const period: string = body.period || varsayilanElleDonem(new Date(), kesim);

  // Aynı bayide faturalama zaten sürüyorsa ikinciyi başlatma (bkz. FATURALAMA_SURUYOR).
  // Denetleme ile ekleme arasında await YOK: iki istek aynı anda giremez.
  if (FATURALAMA_SURUYOR.has(tenantId)) return ucHatasi('FATURALAMA_SURUYOR', 409);
  FATURALAMA_SURUYOR.add(tenantId);
  try {
    const customers = await prisma.customer.findMany({
      where: { tenantId },
      select: { id: true },
    });

    let created = 0;
    let total = 0;
    let bekleyen = 0;
    const hatalar: { customerId: string; hata: string }[] = [];
    for (const c of customers) {
      try {
        // Şüpheli / şoklu fatura (ya da bayi onayı açıksa hepsi) taslakta bekler.
        const s = await donemFaturasiHazirla(tenantId, c.id, period, { source: 'AUTO_MONTHLY' });
        if (s?.tur === 'KESILDI') {
          created++;
          total += Number(s.invoice.totalAmount);
        } else if (s?.tur === 'TASLAK') bekleyen++;
      } catch (e: any) {
        hatalar.push({ customerId: c.id, hata: String(e?.message ?? e).slice(0, 300) });
        console.error('INVOICE MANUAL ERROR:', e?.message);
      }
    }

    // Kapanmış ayı faturalamak dönemi kapatır (geç okumalar sonraki aya kayar);
    // açık ayı ayın ortasında faturalamak ara faturadır, dönem açık kalır.
    try {
      await kosuyuKaydet(tenantId, period, 'ELLE',
        { faturaSayisi: created, toplam: round2(total), hataSayisi: hatalar.length, hatalar },
        kosuDonemiKapatir(period, kesim));
    } catch (e: any) {
      console.error('FATURA TURU KAYIT HATASI:', e?.message);
    }

    return NextResponse.json({ ok: true, period, created, total: round2(total), errors: hatalar.length, bekleyen });
  } finally {
    FATURALAMA_SURUYOR.delete(tenantId);
  }
}
