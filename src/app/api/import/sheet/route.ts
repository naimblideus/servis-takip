import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import {
  parseCSV, detectDelimiter, autoMap, trNumber, trInt, trBool, normalizePhone,
  type FieldKey,
} from '@/lib/sheet-import';
import crypto from 'crypto';

// POST /api/import/sheet
//   { csv, mapping?, dryRun }  → dryRun:true = ÖNİZLEME (hiçbir şey yazılmaz)
// Excel'den CSV olarak kaydedilmiş müşteri/cihaz listesini içeri alır.
// Tekilleştirme: müşteri (tenant+telefon), cihaz (tenant+seriNo) → tekrar çalıştırmak GÜVENLİ (günceller, çoğaltmaz).

const MAX_ROWS = 5000;

export async function POST(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Veri aktarmak için yönetici yetkisi gerekir' }, { status: 403 });
    }

    const { csv, mapping: userMapping, dryRun } = await req.json();
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ error: 'Dosya boş görünüyor' }, { status: 400 });
    }

    const delimiter = detectDelimiter(csv);
    const rows = parseCSV(csv, delimiter);
    if (rows.length < 2) {
      return NextResponse.json({ error: 'Dosyada başlık satırı + en az 1 veri satırı olmalı' }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);
    if (dataRows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Tek seferde en fazla ${MAX_ROWS} satır (dosyada ${dataRows.length})` }, { status: 400 });
    }

    // Eşleme: kullanıcı düzelttiyse onu kullan, yoksa otomatik tahmin
    const mapping: (FieldKey | null)[] = Array.isArray(userMapping) && userMapping.length === headers.length
      ? userMapping
      : autoMap(headers);

    const idx = (k: FieldKey) => mapping.indexOf(k);
    const get = (r: string[], k: FieldKey) => {
      const i = idx(k);
      return i >= 0 ? (r[i] ?? '').trim() : '';
    };

    const hasCustomer = idx('customerName') >= 0;
    const hasDevice = idx('serialNo') >= 0 || idx('model') >= 0 || idx('brand') >= 0;
    if (!hasCustomer && !hasDevice) {
      return NextResponse.json({
        error: 'Kolonlar tanınamadı. En azından "Müşteri" ya da "Marka/Model/Seri No" kolonu gerekli.',
        headers, mapping,
      }, { status: 400 });
    }

    // ── Satırları çöz ──
    type Parsed = {
      row: number; customerName: string; phone: string; address: string; taxNo: string;
      brand: string; model: string; serialNo: string; location: string;
      counterBlack: number | null; counterColor: number | null;
      isRental: boolean; monthlyRent: number | null; pricePerBlack: number | null; pricePerColor: number | null;
      errors: string[];
    };
    // Aşırı uzun hücreler DB hatası vermesin — sınırla (Excel'de kazara birleşmiş metinler olur)
    const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trim() : s);

    const parsed: Parsed[] = dataRows.map((r, i) => {
      const p: Parsed = {
        row: i + 2, // Excel satır numarası (başlık 1. satır)
        customerName: cut(get(r, 'customerName'), 160),
        phone: normalizePhone(get(r, 'phone')),
        address: cut(get(r, 'address'), 400),
        taxNo: cut(get(r, 'taxNo'), 40),
        brand: cut(get(r, 'brand'), 80),
        model: cut(get(r, 'model'), 120),
        serialNo: cut(get(r, 'serialNo'), 80),
        location: cut(get(r, 'location'), 120),
        counterBlack: trInt(get(r, 'counterBlack')),
        counterColor: trInt(get(r, 'counterColor')),
        isRental: idx('isRental') >= 0 ? trBool(get(r, 'isRental')) : (trNumber(get(r, 'monthlyRent')) || 0) > 0,
        monthlyRent: trNumber(get(r, 'monthlyRent')),
        pricePerBlack: trNumber(get(r, 'pricePerBlack')),
        pricePerColor: trNumber(get(r, 'pricePerColor')),
        errors: [],
      };
      if (hasCustomer && !p.customerName) p.errors.push('Müşteri adı boş');
      if (hasCustomer && !p.phone) p.errors.push('Telefon boş (müşteri telefonla eşleştiriliyor)');
      if (hasDevice && !p.serialNo && !(p.brand || p.model)) p.errors.push('Cihaz bilgisi yok');
      return p;
    });

    const valid = parsed.filter((p) => p.errors.length === 0);
    const invalid = parsed.filter((p) => p.errors.length > 0);

    // ── ÇAKIŞMA UYARILARI (aktarımı durdurmaz; kullanıcı önceden bilsin) ──
    // Sistem müşteriyi TELEFONLA, cihazı SERİ NO ile eşleştirir. Dosyada aynı telefon farklı
    // isimlerde geçiyorsa o kayıtlar TEK müşteride birleşir — bu sürpriz olmamalı.
    const warnings: string[] = [];
    const namesByPhone = new Map<string, Set<string>>();
    const custBySerial = new Map<string, Set<string>>();
    for (const p of valid) {
      if (p.phone && p.customerName) {
        if (!namesByPhone.has(p.phone)) namesByPhone.set(p.phone, new Set());
        namesByPhone.get(p.phone)!.add(p.customerName.toLocaleUpperCase('tr'));
      }
      if (p.serialNo && p.customerName) {
        if (!custBySerial.has(p.serialNo)) custBySerial.set(p.serialNo, new Set());
        custBySerial.get(p.serialNo)!.add(p.customerName.toLocaleUpperCase('tr'));
      }
    }
    const phoneClashes = [...namesByPhone.entries()].filter(([, names]) => names.size > 1);
    const serialClashes = [...custBySerial.entries()].filter(([, c]) => c.size > 1);
    if (phoneClashes.length) {
      warnings.push(
        `${phoneClashes.length} telefon numarası birden fazla farklı isimle geçiyor — bunlar TEK müşteride birleşecek ` +
        `(ör. ${phoneClashes[0][0]}: ${[...phoneClashes[0][1]].slice(0, 2).join(' / ')}).`,
      );
    }
    if (serialClashes.length) {
      warnings.push(
        `${serialClashes.length} seri no farklı müşterilerde geçiyor — cihaz son satırdaki müşteriye bağlanacak ` +
        `(ör. ${serialClashes[0][0]}).`,
      );
    }
    const noSerial = valid.filter((p) => (p.brand || p.model) && !p.serialNo).length;
    if (noSerial > 0) {
      warnings.push(`${noSerial} cihazda seri no yok — otomatik geçici seri no üretilecek (sonra düzeltebilirsiniz).`);
    }

    // ── ÖNİZLEME ──
    if (dryRun) {
      return NextResponse.json({
        headers, mapping, delimiter,
        totalRows: dataRows.length,
        validRows: valid.length,
        invalidRows: invalid.length,
        willCreateCustomers: new Set(valid.filter((p) => p.customerName && p.phone).map((p) => p.phone)).size,
        willCreateDevices: valid.filter((p) => p.serialNo || p.brand || p.model).length,
        warnings,
        sample: parsed.slice(0, 8),
        errorsSample: invalid.slice(0, 10),
      });
    }

    if (valid.length === 0) {
      return NextResponse.json({ error: 'Aktarılabilecek geçerli satır yok', invalidRows: invalid.length }, { status: 400 });
    }

    // ── AKTAR ──
    let customersCreated = 0, customersUpdated = 0, devicesCreated = 0, devicesUpdated = 0;
    const failures: { row: number; error: string }[] = [];
    const custIdByPhone = new Map<string, string>();

    for (const p of valid) {
      try {
        // 1) Müşteri (tenant+telefon tekil) — varsa güncelle, yoksa oluştur
        let customerId: string | null = null;
        if (p.customerName && p.phone) {
          customerId = custIdByPhone.get(p.phone) || null;
          if (!customerId) {
            const existing = await prisma.customer.findFirst({
              where: { tenantId, phone: p.phone },
              select: { id: true },
            });
            if (existing) {
              customerId = existing.id;
              const upd: any = {};
              if (p.address) upd.address = p.address;
              if (p.taxNo) upd.taxNo = p.taxNo;
              if (Object.keys(upd).length) {
                await prisma.customer.update({ where: { id: existing.id }, data: upd });
                customersUpdated++;
              }
            } else {
              const c = await prisma.customer.create({
                data: {
                  tenantId, name: p.customerName, phone: p.phone,
                  address: p.address || null, taxNo: p.taxNo || null,
                },
              });
              customerId = c.id;
              customersCreated++;
            }
            custIdByPhone.set(p.phone, customerId);
          }
        }

        // 2) Cihaz (tenant+seriNo tekil)
        const wantsDevice = !!(p.serialNo || p.brand || p.model);
        if (wantsDevice) {
          if (!customerId) { failures.push({ row: p.row, error: 'Cihaz için müşteri bulunamadı' }); continue; }

          const serial = p.serialNo || `IMP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          const existing = await prisma.device.findFirst({
            where: { tenantId, serialNo: serial },
            select: { id: true },
          });

          const base: any = {
            brand: p.brand || 'Bilinmiyor',
            model: p.model || 'Bilinmiyor',
            location: p.location || null,
            isRental: p.isRental,
          };
          if (p.counterBlack != null) base.counterBlack = p.counterBlack;
          if (p.counterColor != null) base.counterColor = p.counterColor;
          if (p.monthlyRent != null) base.monthlyRent = p.monthlyRent;
          if (p.pricePerBlack != null) base.pricePerBlack = p.pricePerBlack;
          if (p.pricePerColor != null) base.pricePerColor = p.pricePerColor;

          if (existing) {
            await prisma.device.update({ where: { id: existing.id }, data: { ...base, customerId } });
            devicesUpdated++;
          } else {
            await prisma.device.create({
              data: {
                ...base,
                tenantId, customerId, serialNo: serial,
                publicCode: `DEV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                qrTokenHash: crypto.randomBytes(16).toString('hex'),
              },
            });
            devicesCreated++;
          }
        }
      } catch (e: any) {
        failures.push({ row: p.row, error: e?.message?.slice(0, 160) || 'Bilinmeyen hata' });
      }
    }

    return NextResponse.json({
      ok: true,
      customersCreated, customersUpdated, devicesCreated, devicesUpdated,
      skippedInvalid: invalid.length,
      failed: failures.length,
      failures: failures.slice(0, 20),
      invalidSample: invalid.slice(0, 10),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
