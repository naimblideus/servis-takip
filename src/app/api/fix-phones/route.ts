// ═══════════════════════════════════════
// GET/POST /api/fix-phones
// Mevcut bozuk telefon numaralarını (hex, boş vb.) düzelt
// Sadece ADMIN kullanabilir - bir seferlik çalıştır
//
// ── GET ARTIK YAZMIYOR (ÖNİZLEME) ────────────────────────────────────────
// Bu uç GET ile veri DEĞİŞTİRİYORDU. Oturum çerezi SameSite=Lax olduğu için
// üst düzey GET gezinmesinde çereze eşlik eder: yöneticiye gönderilen bir
// bağlantı ya da tarayıcı ön-yüklemesi, kimse istemeden veriyi yeniden
// yazabilirdi. Artık GET yalnız NE DEĞİŞECEĞİNİ söyler; uygulamak için
// POST gerekir.
// ═══════════════════════════════════════

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';
import { cleanPhone } from '@/lib/import-parser';

// Bozuk telefon tespiti: hex karakter içeren, BOS- olmayan, geçersiz formatlı
function isCorruptPhone(phone: string): boolean {
    if (!phone) return true;
    // BOS- fallback'leri koruyoruz (bunlar kasıtlı)
    if (phone.startsWith('BOS-')) return false;
    // Geçerli sadece rakam veya 0 ile başlayan telefon
    if (/^\d{7,15}$/.test(phone)) return false;
    // Başka herhangi bir şey (harf içeren, çok kısa/uzun) → bozuk
    return true;
}

function generateFallbackPhone(id: string, index: number): string {
    return `BOS-${String(index).padStart(6, '0')}`;
}

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

        // Tüm müşterileri çek
        const customers = await prisma.customer.findMany({
            where: { tenantId },
            orderBy: { id: 'asc' },
        });

        const results: { id: string; name: string; oldPhone: string; newPhone: string }[] = [];
        let fixedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const phone = c.phone;

            if (!isCorruptPhone(phone)) {
                skippedCount++;
                continue;
            }

            // Bozuk telefon → fallback oluştur
            const newPhone = generateFallbackPhone(c.id, i + 1);

            try {
                // Çakışma kontrolü
                const existing = await prisma.customer.findFirst({
                    where: { tenantId, phone: newPhone, id: { not: c.id } },
                });
                const finalPhone = existing ? `BOS-${c.id.slice(-6).toUpperCase()}` : newPhone;

                if (uygula) {
                    await prisma.customer.update({
                        where: { id: c.id },
                        data: { phone: finalPhone },
                    });
                }
                results.push({ id: c.id, name: c.name, oldPhone: phone, newPhone: finalPhone });
                fixedCount++;
            } catch (e: any) {
                // Unique constraint ihlali olabilir, ID bazlı fallback dene
                try {
                    const safePhone = `BOS-${c.id.slice(-6).toUpperCase()}`;
                    if (uygula) {
                        await prisma.customer.update({
                            where: { id: c.id },
                            data: { phone: safePhone },
                        });
                    }
                    results.push({ id: c.id, name: c.name, oldPhone: phone, newPhone: safePhone });
                    fixedCount++;
                } catch { /* skip */ }
            }
        }

        return NextResponse.json({
            success: true,
            uygulandi: uygula,
            not: uygula ? undefined : 'Bu bir ÖNİZLEME — hiçbir şey değişmedi. Uygulamak için aynı adrese POST gönderin.',
            total: customers.length,
            fixed: fixedCount,
            skipped: skippedCount,
            details: results,
        });
    } catch (e: any) {
        console.error('FIX PHONES ERROR:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
