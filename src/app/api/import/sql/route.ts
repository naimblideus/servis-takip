// ═══════════════════════════════════════
// POST /api/import/sql
// SQL dump dosyasından veri içe aktarma
// ═══════════════════════════════════════

// Next.js App Router: Büyük dosya yükleme için body limit kapat
export const maxDuration = 300; // 5 dakika (vercel için)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    parseSQLDump,
    cleanPhone,
    isEmptyPhone,
    parseTurkishDecimal,
    parseDate,
    mapStatus,
    fixEncoding,
    parseCounter,
    type MySQLMusteri,
    type MySQLServis,
    type MySQLServisUrun,
    type MySQLUrun,
    type MySQLKasa,
} from '@/lib/import-parser';
import { createEmptyResult, type ImportResult, type ImportError } from '@/lib/import-reporter';
import crypto from 'crypto';
import { TransactionType, TransactionCategory, PaymentMethod, Priority, PaymentStatus } from '@prisma/client';

// ── Yardımcı: Public code üret ──
function generatePublicCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'DEV-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ── Yardımcı: QR token hash ──
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Yardımcı: Benzersiz telefon üret (okunabilir format) ──
function generateFallbackPhone(name: string, id: number): string {
    return `BOS-${String(id).padStart(6, '0')}`;
}

// ── Yardımcı: Benzersiz public code bul ──
async function findUniquePublicCode(tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < 100; attempt++) {
        const code = generatePublicCode();
        const existing = await prisma.device.findUnique({ where: { publicCode: code } });
        if (!existing) return code;
    }
    return `DEV-${Date.now().toString(36).toUpperCase()}`;
}

// ═══ BATCH SIZE ═══
const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
    try {
        // 1. Session kontrolü (sadece ADMIN)
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });
        }

        const currentUser = await prisma.user.findFirst({
            where: { email: session.user?.email! },
        });
        if (!currentUser) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }
        if (currentUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Bu işlem için ADMIN yetkisi gerekli' }, { status: 403 });
        }

        const tenantId = currentUser.tenantId;

        // 2. Dosyayı oku (multipart form)
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'SQL dosyası bulunamadı' }, { status: 400 });
        }

        // Max 50MB kontrolü
        if (file.size > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'Dosya boyutu 50MB\'ı aşamaz' }, { status: 400 });
        }

        const fileName = file.name || 'import.sql';
        const sqlContent = await file.text();

        // 3. ImportSession oluştur
        const importSession = await prisma.importSession.create({
            data: {
                tenantId,
                fileName,
                status: 'PROCESSING',
            },
        });

        // 4. SQL parse et
        let parsed;
        try {
            parsed = parseSQLDump(sqlContent);
        } catch (parseError: any) {
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: {
                    status: 'FAILED',
                    errors: [{ row: 0, table: 'SQL', error: `Parse hatası: ${parseError.message}` }],
                    completedAt: new Date(),
                },
            });
            return NextResponse.json({
                error: 'SQL dosyası parse edilemedi',
                sessionId: importSession.id,
                detail: parseError.message,
            }, { status: 400 });
        }

        const result = createEmptyResult();

        // Toplam satır sayılarını güncelle
        result.totalRows.musteriler = parsed.musteriler.length;
        result.totalRows.servisler = parsed.servisler.length;
        result.totalRows.cihazlar = parsed.servisler.length; // Her servis = 1 cihaz
        result.totalRows.urunler = parsed.urunler.length;
        result.totalRows.servisurunler = parsed.servisurunler.length;
        result.totalRows.kasa = parsed.kasa.length;
        result.totalRows.firma = parsed.firma ? 1 : 0;

        // Session güncelle - processing başladı
        await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
                totalRows: result.totalRows as any,
                status: 'PROCESSING',
            },
        });

        // ═══════════════════════════════════════
        // 5. SIRASYLA IMPORT ET
        // ═══════════════════════════════════════

        // ── A: Firma → Tenant güncelle ──
        if (parsed.firma) {
            try {
                const firma = parsed.firma;
                const phone = cleanPhone(firma.Tel) || cleanPhone(firma.Gsm);
                await prisma.tenant.update({
                    where: { id: tenantId },
                    data: {
                        name: firma.Firma || undefined,
                        address: firma.Adres || undefined,
                        phone: phone || undefined,
                    },
                });
                result.importedRows.firma = 1;
            } catch (e: any) {
                result.failedRows.firma = 1;
                result.errors.push({ row: 1, table: 'Firma', error: e.message });
            }
        }

        // ── B: Ürünler → Part'ları upsert et ──
        const partMap = new Map<string, string>(); // UrunKod → partId
        for (let i = 0; i < parsed.urunler.length; i += BATCH_SIZE) {
            const batch = parsed.urunler.slice(i, i + BATCH_SIZE);
            for (const urun of batch) {
                try {
                    const sku = (urun.UrunKod || '').trim();
                    if (!sku) {
                        result.failedRows.urunler++;
                        result.errors.push({ row: urun.ID, table: 'Ürünler', error: 'Ürün kodu boş' });
                        continue;
                    }

                    const buyPrice = parseTurkishDecimal(urun.AlisFiyat);
                    const sellPrice = parseTurkishDecimal(urun.SatisFiyat);

                    const part = await prisma.part.upsert({
                        where: { tenantId_sku: { tenantId, sku } },
                        update: {
                            name: fixEncoding(urun.UrunAd || sku),
                            buyPrice,
                            sellPrice,
                            stockQty: urun.Stok || 0,
                        },
                        create: {
                            tenantId,
                            sku,
                            name: fixEncoding(urun.UrunAd || sku),
                            buyPrice,
                            sellPrice,
                            stockQty: urun.Stok || 0,
                        },
                    });
                    partMap.set(sku, part.id);
                    result.importedRows.urunler++;
                } catch (e: any) {
                    result.failedRows.urunler++;
                    result.errors.push({ row: urun.ID, table: 'Ürünler', error: e.message });
                }
            }

            // Ara güncelleme
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: { importedRows: result.importedRows as any, failedRows: result.failedRows as any },
            });
        }

        // ── C: Müşteriler → Customer upsert et ──
        const customerMap = new Map<number, string>(); // eski ID → yeni customerId
        for (let i = 0; i < parsed.musteriler.length; i += BATCH_SIZE) {
            const batch = parsed.musteriler.slice(i, i + BATCH_SIZE);
            for (const musteri of batch) {
                try {
                    const name = fixEncoding(musteri.Musteri || '').trim();
                    if (!name) {
                        result.failedRows.musteriler++;
                        result.errors.push({ row: musteri.ID, table: 'Müşteriler', error: 'Müşteri adı boş' });
                        continue;
                    }

                    // Telefon: Gsm tercih et, yoksa Tel, yoksa ID-bazlı fallback
                    // Not: BOS- prefix'i ile sabit ID bazlı fallback kullan (yeniden import'ta aynı kalır)
                    let phone = cleanPhone(musteri.Gsm) || cleanPhone(musteri.Tel);
                    if (!phone) {
                        phone = generateFallbackPhone(name, musteri.ID);
                    }

                    // Adres birleştir
                    const addressParts = [
                        fixEncoding(musteri.Adres || ''),
                        fixEncoding(musteri.ilce || ''),
                        fixEncoding(musteri.il || ''),
                    ].filter(Boolean);
                    const address = addressParts.join(', ') || null;

                    // E-posta
                    const email = (musteri.Mail || '').trim() || null;

                    // Yetkili
                    const contactPerson = fixEncoding(musteri.Yetkili || '').trim() || null;

                    let customer;
                    try {
                        customer = await prisma.customer.upsert({
                            where: { tenantId_phone: { tenantId, phone } },
                            update: {
                                name,
                                address: address || undefined,
                                email: email || undefined,
                                contactPerson: contactPerson || undefined,
                            },
                            create: {
                                tenantId,
                                name,
                                phone,
                                address,
                                email,
                                contactPerson,
                            },
                        });
                    } catch (upsertError: any) {
                        // Unique constraint ihlali: telefon numarası başka müşteriyle çakışıyor
                        // → ID bazlı benzersiz fallback ile yeniden dene
                        const fallbackPhone = `BOS-${String(musteri.ID).padStart(6, '0')}`;
                        const existing = await prisma.customer.findFirst({
                            where: { tenantId, phone: fallbackPhone },
                        });
                        if (existing) {
                            customer = existing;
                        } else {
                            customer = await prisma.customer.create({
                                data: {
                                    tenantId,
                                    name,
                                    phone: fallbackPhone,
                                    address,
                                    email,
                                    contactPerson,
                                },
                            });
                        }
                    }

                    customerMap.set(musteri.ID, customer.id);
                    result.importedRows.musteriler++;
                } catch (e: any) {
                    result.failedRows.musteriler++;
                    result.errors.push({ row: musteri.ID, table: 'Müşteriler', error: e.message });
                }
            }

            // Ara güncelleme
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: { importedRows: result.importedRows as any, failedRows: result.failedRows as any },
            });
        }


        // ── D: Servisler → Device + ServiceTicket oluştur ──
        const ticketMap = new Map<number, string>(); // ServisNo → ticketId
        for (let i = 0; i < parsed.servisler.length; i += BATCH_SIZE) {
            const batch = parsed.servisler.slice(i, i + BATCH_SIZE);
            for (const servis of batch) {
                try {
                    // MusteriID 0 veya null olan satırları atla (geçersiz)
                    if (!servis.MusteriID) {
                        result.failedRows.servisler++;
                        result.failedRows.cihazlar++;
                        result.errors.push({
                            row: servis.ID,
                            table: 'Servisler',
                            error: `Müşteri bulunamadı (MusteriID: ${servis.MusteriID})`,
                        });
                        continue;
                    }

                    // Müşteri eşleştir
                    const customerId = customerMap.get(servis.MusteriID || 0);
                    if (!customerId) {
                        result.failedRows.servisler++;
                        result.failedRows.cihazlar++;
                        result.errors.push({
                            row: servis.ID,
                            table: 'Servisler',
                            error: `Müşteri bulunamadı (MusteriID: ${servis.MusteriID})`,
                        });
                        continue;
                    }

                    // Device bul veya oluştur
                    const brand = fixEncoding(servis.Marka || 'Bilinmiyor');
                    const model = fixEncoding(servis.Cihaz || 'Bilinmiyor');
                    const serialNo = (servis.SeriNo || '').trim() || `IMPORT-${servis.ID}`;

                    let device = await prisma.device.findFirst({
                        where: { tenantId, serialNo },
                    });

                    if (!device) {
                        const publicCode = await findUniquePublicCode(tenantId);
                        const qrToken = crypto.randomBytes(32).toString('hex');
                        // Sayaç verisini Aksesuar alanından parse et
                        const counter = parseCounter(servis.Aksesuar);
                        device = await prisma.device.create({
                            data: {
                                tenantId,
                                customerId,
                                brand,
                                model,
                                serialNo,
                                publicCode,
                                qrTokenHash: hashToken(qrToken),
                                counterBlack: counter.black || null,
                                counterColor: counter.color || null,
                            },
                        });
                        result.importedRows.cihazlar++;
                    } else {
                        // Mevcut cihazın sayaç bilgisini güncelle (yoksa veya daha yüksekse)
                        const counter = parseCounter(servis.Aksesuar);
                        if (counter.black > 0 || counter.color > 0) {
                            const updateData: any = {};
                            if (counter.black > (device.counterBlack || 0)) updateData.counterBlack = counter.black;
                            if (counter.color > (device.counterColor || 0)) updateData.counterColor = counter.color;
                            if (Object.keys(updateData).length > 0) {
                                await prisma.device.update({ where: { id: device.id }, data: updateData });
                            }
                        }
                        result.importedRows.cihazlar++; // Mevcut cihaz kullanıldı
                    }

                    // Teknisyen eşleştir
                    const assignedUserId = await findTechnician(servis.Teknisyen, tenantId, currentUser.id);

                    // Tarihler
                    const createdAt = parseDate(servis.FisTarih) || new Date();
                    const statusUpdatedAt = parseDate(servis.TeslimTarih) || createdAt;

                    // Durum
                    const status = mapStatus(servis.islemdurumu);

                    // Toplam tutar
                    const totalCost = parseTurkishDecimal(servis.GToplam);

                    // Not birleştir
                    const noteParts: string[] = [];
                    if (servis.FisNot) noteParts.push(servis.FisNot);
                    if (servis.Aksesuar) noteParts.push(`Aksesuar: ${servis.Aksesuar}`);
                    if (servis.Bakim) noteParts.push(`Bakım: ${servis.Bakim}`);
                    if (servis.Tahsilat) noteParts.push(`Tahsilat: ${servis.Tahsilat}`);
                    const notes = noteParts.join('\n') || null;

                    // Ödeme durumu
                    const tahsilat = parseTurkishDecimal(servis.Tahsilat);
                    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID';
                    if (totalCost > 0 && tahsilat >= totalCost) paymentStatus = 'PAID';
                    else if (tahsilat > 0) paymentStatus = 'PARTIAL';

                    // ticketNumber çakışma kontrolü → mevcut varsa güncelle (upsert)
                    const ticketNumber = `TSK-${servis.ServisNo}`;
                    const existingTicket = await prisma.serviceTicket.findFirst({
                        where: { tenantId, ticketNumber },
                    });

                    let ticket;
                    if (existingTicket) {
                        // Mevcut fişi güncelle
                        ticket = await prisma.serviceTicket.update({
                            where: { id: existingTicket.id },
                            data: {
                                deviceId: device.id,
                                customerId,
                                status,
                                assignedUserId,
                                issueText: fixEncoding(servis.Ariza || 'İçe aktarılmış kayıt'),
                                actionText: fixEncoding(servis.Rapor || '') || null,
                                notes,
                                totalCost,
                                paymentStatus,
                                statusUpdatedAt,
                            },
                        });
                    } else {
                        ticket = await prisma.serviceTicket.create({
                            data: {
                                tenantId,
                                deviceId: device.id,
                                customerId,
                                ticketNumber,
                                status,
                                priority: 'NORMAL' as Priority,
                                assignedUserId,
                                createdByUserId: currentUser.id,
                                issueText: fixEncoding(servis.Ariza || 'İçe aktarılmış kayıt'),
                                actionText: fixEncoding(servis.Rapor || '') || null,
                                notes,
                                totalCost,
                                paymentStatus,
                                statusUpdatedAt,
                                createdAt,
                            },
                        });
                    }

                    ticketMap.set(servis.ServisNo, ticket.id);
                    result.importedRows.servisler++;
                } catch (e: any) {
                    result.failedRows.servisler++;
                    result.failedRows.cihazlar++;
                    result.errors.push({ row: servis.ID, table: 'Servisler', error: e.message });
                }
            }

            // Ara güncelleme
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: { importedRows: result.importedRows as any, failedRows: result.failedRows as any },
            });

        }

        // ── E: Servis Ürünleri → TicketPart bağla ──
        for (let i = 0; i < parsed.servisurunler.length; i += BATCH_SIZE) {
            const batch = parsed.servisurunler.slice(i, i + BATCH_SIZE);
            for (const su of batch) {
                try {
                    // Boş satırları atla (eski sistem her servis için 10 placeholder satır açıyor, çoğu boş)
                    const suSku = (su.UrunKod || '').trim();
                    const suAd = (su.UrunAd || '').trim();
                    if (!suSku && !suAd) {
                        result.totalRows.servisurunler--;  // Sayıya dahil etme
                        continue;
                    }

                    const ticketId = ticketMap.get(su.ServisNo);
                    if (!ticketId) {
                        result.failedRows.servisurunler++;
                        result.errors.push({
                            row: su.ID,
                            table: 'Servis Ürünleri',
                            error: `Servis kaydı bulunamadı (ServisNo: ${su.ServisNo})`,
                        });
                        continue;
                    }

                    // Ürünü bul veya oluştur
                    let partId = suSku ? partMap.get(suSku) : undefined;

                    if (!partId && suSku) {
                        // Ürün grubu eşleştirme
                        const groupRaw = fixEncoding(su.Grup || '').trim();
                        const partGroup = groupRaw || null;
                        const part = await prisma.part.upsert({
                            where: { tenantId_sku: { tenantId, sku: suSku } },
                            update: { group: partGroup || undefined },
                            create: {
                                tenantId,
                                sku: suSku,
                                name: fixEncoding(suAd || suSku),
                                buyPrice: parseTurkishDecimal(su.Maliyet),
                                sellPrice: parseTurkishDecimal(su.Fiyat),
                                group: partGroup,
                            },
                        });
                        partId = part.id;
                        partMap.set(suSku, partId);
                    }

                    if (!partId) {
                        result.failedRows.servisurunler++;
                        result.errors.push({
                            row: su.ID,
                            table: 'Servis Ürünleri',
                            error: 'Ürün kodu boş, parça oluşturulamadı',
                        });
                        continue;
                    }

                    await prisma.ticketPart.create({
                        data: {
                            tenantId,
                            ticketId,
                            partId,
                            quantity: su.Adet || 1,
                            unitPrice: parseTurkishDecimal(su.Fiyat),
                        },
                    });

                    result.importedRows.servisurunler++;
                } catch (e: any) {
                    result.failedRows.servisurunler++;
                    result.errors.push({ row: su.ID, table: 'Servis Ürünleri', error: e.message });
                }
            }

            // Ara güncelleme
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: { importedRows: result.importedRows as any, failedRows: result.failedRows as any },
            });
        }

        // ── F: Kasa → FinancialTransaction oluştur ──
        for (let i = 0; i < parsed.kasa.length; i += BATCH_SIZE) {
            const batch = parsed.kasa.slice(i, i + BATCH_SIZE);
            for (const kasa of batch) {
                try {
                    // Gelir mi Gider mi: tutar alanına göre belirle, Tur alanına güvenme
                    const gelir = parseTurkishDecimal(kasa.GelirTutar);
                    const gider = parseTurkishDecimal(kasa.GiderTutar);
                    const isIncome = gelir > 0;
                    const amount = isIncome ? gelir : gider;

                    if (amount === 0) {
                        result.failedRows.kasa++;
                        result.errors.push({ row: kasa.ID, table: 'Kasa', error: 'Tutar sıfır' });
                        continue;
                    }

                    // Tarih + saat birleştir
                    let transDate = parseDate(kasa.Tarih);
                    if (transDate && kasa.Saat) {
                        const timeParts = kasa.Saat.split(':');
                        if (timeParts.length >= 2) {
                            transDate.setHours(parseInt(timeParts[0]) || 0, parseInt(timeParts[1]) || 0);
                        }
                    }

                    await prisma.financialTransaction.create({
                        data: {
                            tenantId,
                            type: (isIncome ? 'INCOME' : 'EXPENSE') as TransactionType,
                            category: (isIncome ? 'OTHER_INCOME' : 'OTHER_EXPENSE') as TransactionCategory,
                            amount,
                            description: fixEncoding(kasa.Aciklama || (isIncome ? 'İçe aktarılmış gelir' : 'İçe aktarılmış gider')),
                            date: transDate || new Date(),
                            method: 'CASH' as PaymentMethod,
                        },
                    });

                    result.importedRows.kasa++;
                } catch (e: any) {
                    result.failedRows.kasa++;
                    result.errors.push({ row: kasa.ID, table: 'Kasa', error: e.message });
                }
            }

            // Ara güncelleme
            await prisma.importSession.update({
                where: { id: importSession.id },
                data: { importedRows: result.importedRows as any, failedRows: result.failedRows as any },
            });
        }

        // ═══════════════════════════════════════
        // 6. SONUÇLANDIR
        // ═══════════════════════════════════════

        const totalImported = Object.values(result.importedRows).reduce((a, b) => a + b, 0);
        const totalFailed = Object.values(result.failedRows).reduce((a, b) => a + b, 0);
        const finalStatus = totalFailed === 0 ? 'COMPLETED' : (totalImported === 0 ? 'FAILED' : 'COMPLETED');

        await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
                status: finalStatus,
                importedRows: result.importedRows as any,
                failedRows: result.failedRows as any,
                errors: result.errors.slice(0, 500) as any, // Max 500 hata kaydet
                completedAt: new Date(),
            },
        });

        // AuditLog kaydı
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: currentUser.id,
                action: 'DATA_IMPORT',
                entityType: 'ImportSession',
                entityId: importSession.id,
                newValue: JSON.stringify({
                    fileName,
                    totalImported,
                    totalFailed,
                    duration: Date.now() - importSession.startedAt.getTime(),
                }),
            },
        });

        return NextResponse.json({
            success: true,
            sessionId: importSession.id,
            status: finalStatus,
            totalRows: result.totalRows,
            importedRows: result.importedRows,
            failedRows: result.failedRows,
            errorCount: result.errors.length,
            errors: result.errors.slice(0, 50), // İlk 50 hatayı döndür
        });
    } catch (e: any) {
        console.error('IMPORT ERROR:', e);
        return NextResponse.json({ error: e.message || 'İçe aktarma hatası' }, { status: 500 });
    }
}

// ═══ Teknisyen eşleştirme ═══
async function findTechnician(
    name: string | null | undefined,
    tenantId: string,
    adminUserId: string
): Promise<string> {
    if (!name || name.trim() === '') return adminUserId;

    const user = await prisma.user.findFirst({
        where: {
            tenantId,
            name: { contains: name.trim(), mode: 'insensitive' },
        },
    });

    return user?.id ?? adminUserId;
}
