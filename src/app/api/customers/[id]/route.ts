import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiDegilse } from '@/lib/api-auth';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        // IDOR koruması: müşteri bu tenant'a mı ait?
        const existing = await prisma.customer.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return ucHatasi('BULUNAMADI', 404);

        const body = await req.json();
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.address !== undefined) updateData.address = body.address || null;
        if (body.taxNo !== undefined) updateData.taxNo = body.taxNo || null;
        if (body.email !== undefined) updateData.email = body.email || null;
        // ── FATURA KİMLİĞİ ────────────────────────────────────────────
        // Faturaya yazılan ad, vergi dairesi ve il/ilçe defterdeki
        // bilgiden ayrı tutuluyor (bkz. lib/fatura-kimlik.ts).
        if (body.legalName !== undefined) updateData.legalName = body.legalName || null;
        if (body.taxOffice !== undefined) updateData.taxOffice = body.taxOffice || null;
        if (body.city !== undefined) updateData.city = body.city || null;
        if (body.district !== undefined) updateData.district = body.district || null;
        // ÜÇ DEĞERLİ: '' = hiç sorulmadı, 'evet'/'hayir' = soruldu.
        // Boşu false'a çevirseydik sorulmamışla mükellef-değil aynı şey
        // olur, mükellef bir müşteriye yanlış belge kesilirdi.
        if (body.eInvoiceUser !== undefined) {
            const v = String(body.eInvoiceUser ?? '').trim();
            if (v === 'evet' || v === 'hayir') {
                updateData.eInvoiceUser = v === 'evet';
                updateData.eInvoiceCheckedAt = new Date();
            } else {
                updateData.eInvoiceUser = null;
                updateData.eInvoiceCheckedAt = null;
            }
        }
        // Sözleşme bitiş tarihi: "" -> null (temizle), "YYYY-MM-DD" -> tarih
        if (body.contractEndDate !== undefined) {
            const v = String(body.contractEndDate || '').trim();
            if (!v) updateData.contractEndDate = null;
            else {
                const [y, m, d] = v.split('-').map(Number);
                const dt = new Date(y, (m || 1) - 1, d || 1);
                if (isNaN(dt.getTime())) return ucHatasi('GECERSIZ_SOZLESME_TARIHI', 400);
                updateData.contractEndDate = dt;
            }
        }

        const customer = await prisma.customer.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(customer);
    } catch (e: any) {
        console.error('CUSTOMER UPDATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // ── NEDEN YÖNETİCİ ŞART ──────────────────────────────────────────
        // Müşteri silmek zincirleme (cascade) olarak AccountEntry ve
        // CustomerInvoice kayıtlarını da siler — yani o müşterinin BÜTÜN
        // MALİ GEÇMİŞİNİ. Bu yetki her role açıktı: teknisyen tek istekle
        // yılların cari hesabını yok edebiliyordu.
        const yetki = yoneticiDegilse(user);
        if (yetki) return yetki;

        const tenantId = user.tenantId;
        const musteri = await prisma.customer.findFirst({
            where: { id, tenantId }, select: { id: true, name: true },
        });
        if (!musteri) return ucHatasi('BULUNAMADI', 404);

        // ── NEDEN MALİ GEÇMİŞİ OLAN MÜŞTERİ SİLİNEMİYOR ──────────────────
        // Silme geri alınamaz ve fatura/cari kaydı vergi açısından tutulması
        // gereken veridir. "Yanlış girilmiş müşteriyi sil" ihtiyacı gerçek,
        // ama o müşterinin hareketi yoktur. Hareketi olan kayıt silinmez;
        // kullanıcıya ne engellediği SAYIYLA söylenir, tahmin ettirilmez.
        const [cari, fatura, tahsilat, kasa, fis, cihaz] = await Promise.all([
            prisma.accountEntry.count({ where: { tenantId, customerId: id } }),
            prisma.customerInvoice.count({ where: { tenantId, customerId: id } }),
            prisma.payment.count({ where: { tenantId, customerId: id } }),
            prisma.financialTransaction.count({ where: { tenantId, customerId: id } }),
            prisma.serviceTicket.count({ where: { tenantId, customerId: id } }),
            prisma.device.count({ where: { tenantId, customerId: id } }),
        ]);
        const mali = cari + fatura + tahsilat + kasa;
        if (mali > 0 || fis > 0 || cihaz > 0) {
            const parca: string[] = [];
            if (cari) parca.push(`${cari} cari hareket`);
            if (fatura) parca.push(`${fatura} fatura`);
            if (tahsilat) parca.push(`${tahsilat} tahsilat`);
            if (kasa) parca.push(`${kasa} kasa hareketi`);
            if (fis) parca.push(`${fis} servis fişi`);
            if (cihaz) parca.push(`${cihaz} cihaz`);
            return ucHatasi('SILINEMEZ_BAGLI', 409, {
                deger: { p1: musteri.name, p2: parca.join(', ') },
                ek: { engel: { cari, fatura, tahsilat, kasa, fis, cihaz } },
            });
        }

        const res = await prisma.customer.deleteMany({ where: { id, tenantId } });
        if (res.count === 0) return ucHatasi('BULUNAMADI', 404);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
