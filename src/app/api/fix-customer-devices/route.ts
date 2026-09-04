// ═══════════════════════════════════════
// GET /api/fix-customer-devices
// Servis fişindeki müşteri ile cihazın müşterisi uyuşmuyorsa cihazı taşır.
// Sadece ADMIN - bir seferlik çalıştır
//
// ── GET ARTIK YAZMIYOR (ÖNİZLEME) ────────────────────────────────────────
// Bu uç GET ile veri DEĞİŞTİRİYORDU. Oturum çerezi SameSite=Lax olduğu için
// üst düzey GET gezinmesinde çereze eşlik eder: yöneticiye gönderilen bir
// bağlantı ya da tarayıcı ön-yüklemesi, kimse istemeden veriyi yeniden
// yazabilirdi. Artık GET yalnız NE DEĞİŞECEĞİNİ söyler; uygulamak için
// POST gerekir.
//
// ── DİKKAT: BU ARAÇ HER ZAMAN "DÜZELTMEZ" ────────────────────────────────
// Cihaz gerçekten el değiştirdiyse (bayi makineyi A müşterisinden alıp B'ye
// verdiyse) ESKİ fişler hâlâ A'yı gösterir ve bu araç cihazı A'ya GERİ
// taşır. Yani meşru bir devri bozabilir. Bu yüzden önizleme varsayılan:
// listeye bakıp gerçekten yanlış bağlanmış cihazları görmeden uygulamayın.
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';

/** GET = ÖNİZLEME (yazmaz) · POST = UYGULA */
export async function GET() { return calistir(false); }
export async function POST() { return calistir(true); }

async function calistir(uygula: boolean) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

        const user = await prisma.user.findFirst({
            where: { email: session.user?.email!, ...bayiSuzgeci(session) },
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
                        if (uygula) {
                            await prisma.device.update({
                                where: { id: device.id },
                                data: { customerId: ticket.customerId },
                            });
                        }
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
            uygulandi: uygula,
            not: uygula
                ? undefined
                : 'Bu bir ÖNİZLEME — hiçbir cihaz taşınmadı. Listeyi kontrol edin; ' +
                  'gerçekten el değiştirmiş cihazlar varsa uygulamayın. Uygulamak için POST gönderin.',
            totalTicketsChecked: tickets.length,
            fixedDevices: fixedCount,
            details: fixes,
        });
    } catch (e: any) {
        console.error('FIX CUSTOMER DEVICES ERROR:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
