import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { normalHizBul } from '@/lib/sayac-anomali';
import { sartFarklari, aylikNetEtki, sozlesmeTakvimi, zamDurumu } from '@/lib/sozlesme';

/**
 * GET  /api/sozlesmeler  → sözleşmeler + sözleşme/sistem farkları
 * POST /api/sozlesmeler  → yeni sözleşme
 *
 * ── NİÇİN ────────────────────────────────────────────────────────────────
 * Sözleşmeyi saklamak bir dosya dolabı. Bu uç, sözleşmede YAZANLA sistemde
 * OLANI karşılaştırıyor ve farkın aylık ₺ karşılığını veriyor. Bayinin
 * sözleşme ekranını açma sebebi bu olmalı; yoksa açmaz.
 *
 * ── HACİM UYDURULMUYOR ───────────────────────────────────────────────────
 * Sayfa farkının parası cihazın GERÇEK aylık hacmine bağlı. Hacim, okuma
 * geçmişinin ORTANCA günlük hızından çıkıyor (lib/sayac-anomali.ts'teki
 * normalHizBul — anomali tespitinde kullanılan, testli fonksiyonun aynısı).
 * Geçmiş yetmiyorsa tutar YAZILMIYOR, fark yine gösteriliyor.
 */

const GUN = 86400000;
/** Hız için bakılan geçmiş. Kısa tutmak mevsimsel dalgayı dışarıda bırakır. */
const GECMIS_GUN = 180;

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
const s = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function GET(req: NextRequest) {
  // Sözleşme = fiyat = mali veri. Yalnız yönetici.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const bugun = new Date();
    const musteriId = req.nextUrl.searchParams.get('musteri');

    const [tenant, sozlesmeler] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { pricePerBlack: true, pricePerColor: true } }),
      prisma.contract.findMany({
        where: { tenantId, ...(musteriId ? { customerId: musteriId } : {}) },
        orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          devices: {
            include: {
              device: {
                select: {
                  id: true, brand: true, model: true, serialNo: true, location: true,
                  monthlyRent: true, includedBlack: true, includedColor: true,
                  pricePerBlack: true, pricePerColor: true,
                  overagePriceBlack: true, overagePriceColor: true,
                },
              },
            },
          },
        },
      }),
    ]);
    if (!tenant) return NextResponse.json({ error: 'Bayi bulunamadı' }, { status: 404 });

    // ── CİHAZLARIN GERÇEK AYLIK HACMİ ───────────────────────────────────
    const cihazIdleri = [...new Set(sozlesmeler.flatMap((k) => k.devices.map((d) => d.deviceId)))];
    const hacim = new Map<string, { sb: number | null; renkli: number | null }>();
    if (cihazIdleri.length) {
      const okumalar = await prisma.counterReading.findMany({
        where: {
          tenantId, deviceId: { in: cihazIdleri },
          readingDate: { gte: new Date(bugun.getTime() - GECMIS_GUN * GUN) },
        },
        orderBy: { readingDate: 'asc' },
        select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true },
      });
      const grup = new Map<string, typeof okumalar>();
      for (const o of okumalar) grup.set(o.deviceId, [...(grup.get(o.deviceId) ?? []), o]);
      for (const [id, liste] of grup) {
        // normalHizBul siyah+renkli TOPLAMININ hızını veriyor; ikisini ayrı
        // istediğimiz için diğerini sıfırlayıp iki kez çağırıyoruz. Aynı
        // ortanca mantığı, ikinci bir uygulama yazılmadı.
        const hizSB = normalHizBul(liste.map((o) => ({ readingDate: o.readingDate, counterBlack: o.counterBlack ?? 0, counterColor: 0 })));
        const hizR = normalHizBul(liste.map((o) => ({ readingDate: o.readingDate, counterBlack: 0, counterColor: o.counterColor ?? 0 })));
        hacim.set(id, {
          sb: hizSB === null ? null : Math.round(hizSB * 30),
          renkli: hizR === null ? null : Math.round(hizR * 30),
        });
      }
    }

    // ── SÖZLEŞME BAŞINA DEĞERLENDİRME ───────────────────────────────────
    const sonuc = sozlesmeler.map((k) => {
      const takvim = sozlesmeTakvimi(
        { endDate: k.endDate, noticeDays: k.noticeDays, autoRenew: k.autoRenew }, bugun,
      );
      const sozlesmeKira = k.devices.reduce((t, d) => t + (s(d.monthlyRent) ?? 0), 0);
      const zam = zamDurumu(
        {
          startDate: k.startDate, escalationMonths: k.escalationMonths,
          escalationRate: s(k.escalationRate), lastEscalationAt: k.lastEscalationAt,
        },
        sozlesmeKira > 0 ? sozlesmeKira : null,
        bugun,
      );

      const cihazlar = k.devices.map((kd) => {
        const d = kd.device;
        const h = hacim.get(d.id) ?? { sb: null, renkli: null };
        // Cihazın EFEKTİF şartları: boş fiyat alanları bayi varsayılanına
        // düşüyor — faturalama da öyle yapıyor, karşılaştırma faturayla
        // aynı rakamı görmeli.
        const sistem = {
          monthlyRent: s(d.monthlyRent),
          includedBlack: d.includedBlack, includedColor: d.includedColor,
          pricePerBlack: s(d.pricePerBlack) ?? s(tenant.pricePerBlack),
          pricePerColor: s(d.pricePerColor) ?? s(tenant.pricePerColor),
          overagePriceBlack: s(d.overagePriceBlack) ?? s(d.pricePerBlack) ?? s(tenant.pricePerBlack),
          overagePriceColor: s(d.overagePriceColor) ?? s(d.pricePerColor) ?? s(tenant.pricePerColor),
        };
        const sozlesmede = {
          monthlyRent: s(kd.monthlyRent),
          includedBlack: kd.includedBlack, includedColor: kd.includedColor,
          pricePerBlack: s(kd.pricePerBlack), pricePerColor: s(kd.pricePerColor),
          overagePriceBlack: s(kd.overagePriceBlack), overagePriceColor: s(kd.overagePriceColor),
        };
        const farklar = sartFarklari(sozlesmede, sistem, h.sb, h.renkli);
        return {
          contractDeviceId: kd.id,
          deviceId: d.id,
          cihaz: [d.brand, d.model].filter(Boolean).join(' '),
          serialNo: d.serialNo, konum: d.location,
          aylikSayfaSB: h.sb, aylikSayfaRenkli: h.renkli,
          sozlesmede, sistemde: sistem,
          farklar, etki: aylikNetEtki(farklar),
        };
      });

      const tumFarklar = cihazlar.flatMap((c) => c.farklar);
      return {
        id: k.id,
        contractNo: k.contractNo,
        musteri: k.customer,
        startDate: k.startDate, endDate: k.endDate,
        noticeDays: k.noticeDays, autoRenew: k.autoRenew, renewMonths: k.renewMonths,
        escalationMonths: k.escalationMonths, escalationRate: s(k.escalationRate),
        lastEscalationAt: k.lastEscalationAt,
        fileUrl: k.fileUrl, notes: k.notes, status: k.status,
        takvim, zam,
        cihazSayisi: k.devices.length,
        sozlesmeKira,
        farkSayisi: tumFarklar.length,
        etki: aylikNetEtki(tumFarklar),
        cihazlar,
      };
    });

    // ── KAPSAM DIŞI CİHAZLAR ────────────────────────────────────────────
    // Müşteride duran ama hiçbir AKTİF sözleşmede geçmeyen kiralık cihaz.
    // Ya unutulmuş bir makine ya da anlaşmasız bırakılmış bir kalem;
    // ikisi de para.
    const kapsanan = new Set(
      sozlesmeler.filter((k) => k.status === 'AKTIF').flatMap((k) => k.devices.map((d) => d.deviceId)),
    );
    const sozlesmeliMusteriler = [...new Set(sozlesmeler.filter((k) => k.status === 'AKTIF').map((k) => k.customerId))];
    const kapsamDisi = sozlesmeliMusteriler.length
      ? (await prisma.device.findMany({
          where: { tenantId, isRental: true, customerId: { in: sozlesmeliMusteriler } },
          select: {
            id: true, brand: true, model: true, serialNo: true, monthlyRent: true,
            customer: { select: { id: true, name: true } },
          },
        })).filter((d) => !kapsanan.has(d.id))
      : [];

    const aktif = sonuc.filter((k) => k.status === 'AKTIF');
    return NextResponse.json({
      toplam: sonuc.length,
      aktif: aktif.length,
      ozet: {
        farkliSozlesme: aktif.filter((k) => k.farkSayisi > 0).length,
        aylikEksik: Math.round(aktif.reduce((t, k) => t + k.etki.eksik, 0) * 100) / 100,
        aylikFazla: Math.round(aktif.reduce((t, k) => t + k.etki.fazla, 0) * 100) / 100,
        zamZamani: aktif.filter((k) => k.zam.zamani).length,
        zamKaybi: Math.round(aktif.reduce((t, k) => t + (k.zam.aylikKayip ?? 0), 0) * 100) / 100,
        ihbarKacan: aktif.filter((k) => k.takvim.ihbarKacti).length,
        bitiyor: aktif.filter((k) => !k.takvim.bitmis && k.takvim.bitimeGun <= 60).length,
        bitmis: aktif.filter((k) => k.takvim.bitmis).length,
        kapsamDisi: kapsamDisi.length,
      },
      sozlesmeler: sonuc,
      kapsamDisi: kapsamDisi.map((d) => ({
        deviceId: d.id, cihaz: [d.brand, d.model].filter(Boolean).join(' '),
        serialNo: d.serialNo, musteri: d.customer?.name, musteriId: d.customer?.id,
        aylikKira: s(d.monthlyRent),
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const b = await req.json();

    const musteri = await prisma.customer.findFirst({
      where: { id: String(b.customerId || ''), tenantId }, select: { id: true },
    });
    if (!musteri) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    const bas = yerelTarih(b.startDate);
    const bit = yerelTarih(b.endDate);
    if (!bas || isNaN(bas.getTime())) return NextResponse.json({ error: 'Başlangıç tarihi gerekli' }, { status: 400 });
    if (!bit || isNaN(bit.getTime())) return NextResponse.json({ error: 'Bitiş tarihi gerekli' }, { status: 400 });
    if (bit <= bas) return NextResponse.json({ error: 'Bitiş tarihi başlangıçtan sonra olmalı' }, { status: 400 });

    const ihbar = Number(b.noticeDays ?? 0) || 0;
    // İhbar süresi sözleşmeden uzun olamaz: öyle olsaydı ihbar günü
    // sözleşme başlamadan önceye düşer ve ekran anlamsız bir şey söylerdi.
    const sure = Math.round((bit.getTime() - bas.getTime()) / GUN);
    if (ihbar < 0 || ihbar >= sure) {
      return NextResponse.json({ error: `İhbar süresi 0 ile ${sure - 1} gün arasında olmalı` }, { status: 400 });
    }

    const k = await prisma.contract.create({
      data: {
        tenantId, customerId: musteri.id,
        contractNo: (b.contractNo || '').trim() || null,
        startDate: bas, endDate: bit,
        noticeDays: ihbar,
        autoRenew: !!b.autoRenew,
        renewMonths: Number(b.renewMonths ?? 12) || 12,
        escalationMonths: b.escalationMonths ? Number(b.escalationMonths) : null,
        escalationRate: b.escalationRate !== undefined && b.escalationRate !== null && b.escalationRate !== ''
          ? Number(b.escalationRate) : null,
        lastEscalationAt: yerelTarih(b.lastEscalationAt),
        fileUrl: (b.fileUrl || '').trim() || null,
        notes: (b.notes || '').trim() || null,
        status: 'AKTIF',
      },
    });

    // Cihazlar verildiyse ŞARTLARI CİHAZIN MEVCUT AYARINDAN dolduruyoruz.
    // Bayi sözleşmeyi kaydettiği anda "her şey uyuyor" görüyor ve yalnız
    // kâğıttan FARKLI olan kalemleri düzeltiyor — sıfırdan yedi alan
    // doldurtmak bu ekranı kullanılmaz yapardı.
    const idler: string[] = Array.isArray(b.deviceIds) ? b.deviceIds.map(String) : [];
    if (idler.length) {
      const cihazlar = await prisma.device.findMany({
        where: { id: { in: idler }, tenantId, customerId: musteri.id },
        select: {
          id: true, monthlyRent: true, includedBlack: true, includedColor: true,
          pricePerBlack: true, pricePerColor: true, overagePriceBlack: true, overagePriceColor: true,
        },
      });
      if (cihazlar.length) {
        await prisma.contractDevice.createMany({
          data: cihazlar.map((d) => ({
            tenantId, contractId: k.id, deviceId: d.id,
            monthlyRent: d.monthlyRent, includedBlack: d.includedBlack, includedColor: d.includedColor,
            pricePerBlack: d.pricePerBlack, pricePerColor: d.pricePerColor,
            overagePriceBlack: d.overagePriceBlack, overagePriceColor: d.overagePriceColor,
          })),
        });
      }
    }

    return NextResponse.json({ id: k.id });
  } catch (e) {
    return authErrorResponse(e);
  }
}
