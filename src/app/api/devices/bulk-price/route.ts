import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';

// TOPLU ZAM — kiralık cihazların kira ve/veya sayfa fiyatlarını tek işlemde günceller.
// dryRun=true → sadece ÖNİZLEME (eski → yeni), hiçbir şey yazılmaz.
// NOT: ileri tarihli zam ZAMANLAMASI yok (bilerek) — "hangi fiyat geçerli" karmaşası doğurur.

type Field = 'monthlyRent' | 'pricePerBlack' | 'pricePerColor' | 'overagePriceBlack' | 'overagePriceColor';
const FIELDS: Field[] = ['monthlyRent', 'pricePerBlack', 'pricePerColor', 'overagePriceBlack', 'overagePriceColor'];
const LABEL: Record<Field, string> = {
  monthlyRent: 'Aylık kira',
  pricePerBlack: 'Sayfa (S/B)',
  pricePerColor: 'Sayfa (Renkli)',
  overagePriceBlack: 'Aşım (S/B)',
  overagePriceColor: 'Aşım (Renkli)',
};
/** Kira 2 ondalık, sayfa fiyatları 4 ondalık (şemadaki Decimal hassasiyetiyle aynı) */
const dec = (f: Field) => (f === 'monthlyRent' ? 2 : 4);
const roundTo = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const body = await req.json();
    const { customerId, mode, value, fields, dryRun } = body as {
      customerId?: string; mode: 'percent' | 'amount'; value: number; fields: Field[]; dryRun?: boolean;
    };

    const val = Number(value);
    if (!Number.isFinite(val) || val === 0) {
      return NextResponse.json({ error: 'Geçerli bir zam değeri girin' }, { status: 400 });
    }
    if (mode !== 'percent' && mode !== 'amount') {
      return NextResponse.json({ error: 'Geçersiz zam türü' }, { status: 400 });
    }
    const selected = (Array.isArray(fields) ? fields : []).filter((f): f is Field => FIELDS.includes(f));
    if (selected.length === 0) {
      return NextResponse.json({ error: 'En az bir fiyat alanı seçin' }, { status: 400 });
    }

    // Yalnız KİRALIK cihazlar (fiyat bunlarda anlamlı) + tenant guard
    const devices = await prisma.device.findMany({
      where: { tenantId, isRental: true, ...(customerId ? { customerId } : {}) },
      select: {
        id: true, brand: true, model: true, location: true,
        monthlyRent: true, pricePerBlack: true, pricePerColor: true,
        overagePriceBlack: true, overagePriceColor: true,
        customer: { select: { id: true, name: true } },
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { pricePerBlack: true, pricePerColor: true },
    });

    const rows: any[] = [];
    const updates: { id: string; data: Record<string, number> }[] = [];
    let oldMonthly = 0, newMonthly = 0, skippedEmpty = 0;

    for (const d of devices) {
      const changes: Record<string, { old: number | null; next: number }> = {};
      const data: Record<string, number> = {};

      for (const f of selected) {
        const raw = (d as any)[f];
        // Cihazda değer boşsa: kira için 0 kabul (zam yok), sayfa fiyatlarında FİRMA VARSAYILANINI baz al
        let base: number | null = raw == null ? null : Number(raw);
        if (base == null) {
          if (f === 'pricePerBlack' || f === 'overagePriceBlack') base = Number(tenant?.pricePerBlack ?? 0) || null;
          else if (f === 'pricePerColor' || f === 'overagePriceColor') base = Number(tenant?.pricePerColor ?? 0) || null;
        }
        // Baz hâlâ yok/0 ise zam yapılamaz (yoksa ya hiç zam olur ya çift zam) — atla
        if (base == null || base <= 0) { skippedEmpty++; continue; }

        const next = roundTo(mode === 'percent' ? base * (1 + val / 100) : base + val, dec(f));
        if (next <= 0 || next === base) continue;
        changes[f] = { old: raw == null ? null : Number(raw), next };
        data[f] = next;
      }

      if (Object.keys(data).length === 0) continue;

      if (changes.monthlyRent) {
        oldMonthly += changes.monthlyRent.old ?? 0;
        newMonthly += changes.monthlyRent.next;
      }

      rows.push({
        id: d.id,
        device: `${d.brand} ${d.model}`,
        location: d.location || null,
        customerName: d.customer?.name || '—',
        changes,
      });
      updates.push({ id: d.id, data });
    }

    const preview = {
      mode, value: val, fields: selected,
      fieldLabels: selected.map((f) => LABEL[f]),
      deviceCount: rows.length,
      totalScanned: devices.length,
      skippedEmpty,
      oldMonthlyTotal: roundTo(oldMonthly, 2),
      newMonthlyTotal: roundTo(newMonthly, 2),
      monthlyDiff: roundTo(newMonthly - oldMonthly, 2),
      rows,
    };

    if (dryRun) return NextResponse.json({ ...preview, applied: false });

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Güncellenecek cihaz yok' }, { status: 400 });
    }

    // Tek transaction: ya hepsi ya hiçbiri (yarım zam listesi olmasın)
    await prisma.$transaction(
      updates.map((u) =>
        prisma.device.updateMany({ where: { id: u.id, tenantId }, data: u.data as any }),
      ),
    );

    // DENETİM: toplu zam, sistemdeki en yüksek finansal etkili tek işlem.
    // "Fiyatları kim, ne zaman, ne kadar artırdı" sorusunun cevabı burada.
    await writeAudit({
      tenantId,
      userId: user.id,
      action: 'FIYAT_TOPLU_GUNCELLENDI',
      entityType: 'Device',
      entityId: `toplu:${updates.length}`,
      // Satır satır liste BİLEREK yok: denetim kaydı özet tutar, 4000 karakterde
      // kırpılıp anlamsızlaşmasın. Hangi cihazların değiştiği Device tablosunda.
      newValue: {
        cihazSayisi: updates.length, mode, value: val, alanlar: selected,
        eskiAylikToplam: preview.oldMonthlyTotal,
        yeniAylikToplam: preview.newMonthlyTotal,
        fark: preview.monthlyDiff,
      },
      ipAddress: istekIp(req),
      actorType: 'USER',
      actorName: user.name ?? user.email,
    });

    return NextResponse.json({ ...preview, applied: true, updated: updates.length });
  } catch (e) {
    return authErrorResponse(e);
  }
}
