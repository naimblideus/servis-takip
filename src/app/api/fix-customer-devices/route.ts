// ═══════════════════════════════════════
// GET /api/fix-customer-devices
// Müşteri adına göre cihazların doğru müşteriye bağlanıp bağlanmadığını kontrol eder.
// Servis fişindeki müşteri ile cihazın müşterisi uyuşmuyorsa cihazı doğru müşteriye taşır.
// Sadece ADMIN - bir seferlik çalıştır
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

        const user = await prisma.user.findFirst({
            where: { email: session.user?.email! },
        });
        if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'ADMIN yetkisi gerekli' }, { status: 403 });
        }

        const tenantId = user.tenantId;

        // Tüm servis fişlerini al (her fişin hem müşterisi hem cihazı var)
        const tickets = await prisma.serviceTicket.findMany({
            where: { tenantId },
            include: {
                device: { select: { id: true, customerId: true, brand: true, model: true, serialNo: true } },
                // customerId on ticket = the intended customer
            },
        });

        const fixes: { ticketId: string; deviceId: string; oldCustomerId: string; newCustomerId: string; reason: string }[] = [];
        let fixedCount = 0;

        for (const ticket of tickets) {
            const device = ticket.device;
            // Eğer cihazın müşterisi, fişin müşterisiyle uyuşmuyorsa → taşı
            if (device.customerId !== ticket.customerId) {
                // Hedef müşteri var mı kontrol et
                const targetCustomer = await prisma.customer.findUnique({
                    where: { id: ticket.customerId },
                    select: { id: true, name: true },
                });

                if (targetCustomer) {
                    // Cihazı hedef müşteriye taşı
                    try {
                        await prisma.device.update({
                            where: { id: device.id },
                            data: { customerId: ticket.customerId },
                        });
                        fixes.push({
                            ticketId: ticket.id,
                            deviceId: device.id,
                            oldCustomerId: device.customerId,
                            newCustomerId: ticket.customerId,
                            reason: `${device.brand} ${device.model} (${device.serialNo}) → ${targetCustomer.name}`,
                        });
                        fixedCount++;
                    } catch (e: any) {
                        // Cihaz zaten başka bir servis fişiyle bu müşteriye bağlıysa skip
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            totalTicketsChecked: tickets.length,
            fixedDevices: fixedCount,
            details: fixes,
        });
    } catch (e: any) {
        console.error('FIX CUSTOMER DEVICES ERROR:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
