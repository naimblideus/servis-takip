import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';

// GET /api/backup — Bayinin KENDİ verisinin tam yedeği (JSON dosya indirir).
// Yalnız ADMIN. Sadece kendi tenant'ının verisi (cross-tenant sızıntı yok).
// Fotoğraflar VARSAYILAN OLARAK HARİÇ (base64, dosyayı yüzlerce MB yapar) — ?photos=1 ile dahil edilir.
export async function GET(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yedek almak için yönetici yetkisi gerekir' }, { status: 403 });
    }
    const withPhotos = new URL(req.url).searchParams.get('photos') === '1';

    const [
      tenant, customers, devices, tickets, ticketParts, readings,
      parts, accountEntries, payments, invoices, invoiceLines, users,
    ] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, phone: true, address: true, taxOffice: true, taxNumber: true, pricePerBlack: true, pricePerColor: true },
      }),
      prisma.customer.findMany({ where: { tenantId } }),
      prisma.device.findMany({ where: { tenantId } }),
      prisma.serviceTicket.findMany({ where: { tenantId } }),
      prisma.ticketPart.findMany({ where: { tenantId } }),
      prisma.counterReading.findMany({
        where: { tenantId },
        ...(withPhotos ? {} : {
          select: {
            id: true, tenantId: true, deviceId: true, ticketId: true, readingDate: true,
            counterBlack: true, counterColor: true, deltaBlack: true, deltaColor: true,
            calculatedCost: true, monthlyRent: true, billed: true, createdAt: true,
          },
        }),
      }),
      prisma.part.findMany({ where: { tenantId } }),
      prisma.accountEntry.findMany({ where: { tenantId } }),
      prisma.payment.findMany({ where: { tenantId } }),
      prisma.customerInvoice.findMany({ where: { tenantId } }),
      prisma.invoiceLine.findMany({ where: { tenantId } }),
      prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true, email: true, role: true, isActive: true } }),
    ]);

    const backup = {
      _meta: {
        format: 'nexus-servis-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        tenantName: tenant?.name || '',
        photosIncluded: withPhotos,
        counts: {
          customers: customers.length, devices: devices.length, tickets: tickets.length,
          readings: readings.length, parts: parts.length, accountEntries: accountEntries.length,
          payments: payments.length, invoices: invoices.length,
        },
      },
      tenant, users, customers, devices, tickets, ticketParts, readings,
      parts, accountEntries, payments, invoices, invoiceLines,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (tenant?.name || 'yedek').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

    // DENETİM: veri dışa aktarımı izlenmesi gereken bir olaydır — tüm müşteri,
    // cihaz ve muhasebe kaydı tek dosyada dışarı çıkıyor. Kurumsal denetimde
    // "verinizi kim indirdi" sorulur.
    await writeAudit({
      tenantId,
      userId: user.id,
      action: 'YEDEK_INDIRILDI',
      entityType: 'Tenant',
      entityId: tenantId,
      newValue: {
        musteri: customers.length, cihaz: devices.length, fis: tickets.length,
        fotografDahil: new URL(req.url).searchParams.get('photos') === '1',
      },
      ipAddress: istekIp(req),
      actorType: 'USER',
      actorName: user.name ?? user.email,
    });

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="nextus-servis-yedek-${safeName}-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
