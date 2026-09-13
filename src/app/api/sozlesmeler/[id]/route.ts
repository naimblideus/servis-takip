import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';

/**
 * PATCH  /api/sozlesmeler/[id]  → sözleşmeyi ya da bir cihazın şartlarını güncelle
 * DELETE /api/sozlesmeler/[id]  → sözleşmeyi sil
 *
 * Cihaz şartları da buradan güncelleniyor ({ cihazSartlari: {...} }) çünkü
 * bayi için ikisi tek bir iş: "sözleşmede ne yazıyorsa onu gireyim".
 */

const GUN = 86400000;
/**
 * "YYYY-AA-GG" metnini YEREL gece yarısına çevirir.
 *
 * new Date('2026-10-03') UTC gece yarısı demek; depodaki diğer tarihler
 * (müşteri sözleşme bitişi, devir tarihi) yerel gece yarısı yazılıyor.
 * İkisi karışınca "kaç gün kaldı" saat dilimi kadar kayıyor — UTC+3'te
 * 20 gün 21 görünüyordu. Tek biçim: yerel.
 */
function yerelTarih(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
const sayi = (v: unknown) =>
  v === null || v === undefined || v === '' ? null : Number(v);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;
    const b = await req.json();

    const mevcut = await prisma.contract.findFirst({ where: { id, tenantId } });
    if (!mevcut) return NextResponse.json({ error: 'Sözleşme bulunamadı' }, { status: 404 });

    // ── CİHAZ ŞARTLARI ──────────────────────────────────────────────────
    if (b.cihazSartlari && typeof b.cihazSartlari === 'object') {
      const cd = await prisma.contractDevice.findFirst({
        where: { id: String(b.cihazSartlari.id || ''), contractId: id, tenantId },
        select: { id: true },
      });
      if (!cd) return NextResponse.json({ error: 'Sözleşme cihazı bulunamadı' }, { status: 404 });
      const v = b.cihazSartlari;
      await prisma.contractDevice.update({
        where: { id: cd.id },
        data: {
          monthlyRent: sayi(v.monthlyRent), includedBlack: sayi(v.includedBlack),
          includedColor: sayi(v.includedColor), pricePerBlack: sayi(v.pricePerBlack),
          pricePerColor: sayi(v.pricePerColor), overagePriceBlack: sayi(v.overagePriceBlack),
          overagePriceColor: sayi(v.overagePriceColor),
        },
      });
      return NextResponse.json({ ok: true });
    }

    // ── SİSTEMİ SÖZLEŞMEYE UYDUR ────────────────────────────────────────
    // Farkı görmek yetmiyor; asıl iş cihazın ayarını sözleşmedeki hâline
    // getirmek. Bu düğme olmadan bayi farkı okuyup cihaz kartına gidiyor,
    // yedi alanı elle kopyalıyor, birini yanlış yazıyor.
    //
    // YALNIZ SÖZLEŞMEDE YAZAN ALANLAR taşınıyor: sözleşmede konuşulmamış
    // (null) bir kalem cihazın ayarını SİLMEMELİ.
    if (b.sistemeUygula) {
      const cd = await prisma.contractDevice.findFirst({
        where: { id: String(b.sistemeUygula), contractId: id, tenantId },
      });
      if (!cd) return NextResponse.json({ error: 'Sözleşme cihazı bulunamadı' }, { status: 404 });

      const d: any = {};
      if (cd.monthlyRent !== null) d.monthlyRent = cd.monthlyRent;
      if (cd.includedBlack !== null) d.includedBlack = cd.includedBlack;
      if (cd.includedColor !== null) d.includedColor = cd.includedColor;
      if (cd.pricePerBlack !== null) d.pricePerBlack = cd.pricePerBlack;
      if (cd.pricePerColor !== null) d.pricePerColor = cd.pricePerColor;
      if (cd.overagePriceBlack !== null) d.overagePriceBlack = cd.overagePriceBlack;
      if (cd.overagePriceColor !== null) d.overagePriceColor = cd.overagePriceColor;
      if (!Object.keys(d).length) {
        return NextResponse.json({ error: 'Sözleşmede taşınacak şart yok' }, { status: 400 });
      }
      await prisma.device.update({ where: { id: cd.deviceId }, data: d });
      return NextResponse.json({ ok: true, uygulanan: Object.keys(d) });
    }

    // ── CİHAZ EKLE / ÇIKAR ──────────────────────────────────────────────
    if (b.cihazEkle) {
      const d = await prisma.device.findFirst({
        where: { id: String(b.cihazEkle), tenantId, customerId: mevcut.customerId },
        select: {
          id: true, monthlyRent: true, includedBlack: true, includedColor: true,
          pricePerBlack: true, pricePerColor: true, overagePriceBlack: true, overagePriceColor: true,
        },
      });
      // Başka müşterinin cihazı bu sözleşmeye giremez.
      if (!d) return NextResponse.json({ error: 'Cihaz bu müşteride bulunamadı' }, { status: 404 });
      await prisma.contractDevice.upsert({
        where: { contractId_deviceId: { contractId: id, deviceId: d.id } },
        create: {
          tenantId, contractId: id, deviceId: d.id,
          // Mevcut ayardan doldur: bayi yalnız kâğıttan FARKLI olanı düzeltsin.
          monthlyRent: d.monthlyRent, includedBlack: d.includedBlack, includedColor: d.includedColor,
          pricePerBlack: d.pricePerBlack, pricePerColor: d.pricePerColor,
          overagePriceBlack: d.overagePriceBlack, overagePriceColor: d.overagePriceColor,
        },
        update: {},
      });
      return NextResponse.json({ ok: true });
    }
    if (b.cihazCikar) {
      await prisma.contractDevice.deleteMany({
        where: { id: String(b.cihazCikar), contractId: id, tenantId },
      });
      return NextResponse.json({ ok: true });
    }

    // ── SÖZLEŞMENİN KENDİSİ ─────────────────────────────────────────────
    const d: any = {};
    if (b.contractNo !== undefined) d.contractNo = (b.contractNo || '').trim() || null;
    if (b.startDate !== undefined) d.startDate = yerelTarih(b.startDate);
    if (b.endDate !== undefined) d.endDate = yerelTarih(b.endDate);
    if (b.autoRenew !== undefined) d.autoRenew = !!b.autoRenew;
    if (b.renewMonths !== undefined) d.renewMonths = Number(b.renewMonths) || 12;
    if (b.escalationMonths !== undefined) d.escalationMonths = sayi(b.escalationMonths);
    if (b.escalationRate !== undefined) d.escalationRate = sayi(b.escalationRate);
    if (b.lastEscalationAt !== undefined) d.lastEscalationAt = yerelTarih(b.lastEscalationAt);
    if (b.fileUrl !== undefined) d.fileUrl = (b.fileUrl || '').trim() || null;
    if (b.notes !== undefined) d.notes = (b.notes || '').trim() || null;
    if (b.status !== undefined) {
      if (!['AKTIF', 'BITTI', 'FESIH'].includes(b.status)) {
        return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
      }
      d.status = b.status;
    }
    if (b.noticeDays !== undefined) d.noticeDays = Number(b.noticeDays) || 0;

    const bas = d.startDate ?? mevcut.startDate;
    const bit = d.endDate ?? mevcut.endDate;
    if (isNaN(new Date(bas).getTime()) || isNaN(new Date(bit).getTime())) {
      return NextResponse.json({ error: 'Tarih okunamadı' }, { status: 400 });
    }
    if (new Date(bit) <= new Date(bas)) {
      return NextResponse.json({ error: 'Bitiş tarihi başlangıçtan sonra olmalı' }, { status: 400 });
    }
    const ihbar = d.noticeDays ?? mevcut.noticeDays;
    const sure = Math.round((new Date(bit).getTime() - new Date(bas).getTime()) / GUN);
    if (ihbar < 0 || ihbar >= sure) {
      return NextResponse.json({ error: `İhbar süresi 0 ile ${sure - 1} gün arasında olmalı` }, { status: 400 });
    }

    await prisma.contract.update({ where: { id }, data: d });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;
    const n = await prisma.contract.deleteMany({ where: { id, tenantId } });
    if (!n.count) return NextResponse.json({ error: 'Sözleşme bulunamadı' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
