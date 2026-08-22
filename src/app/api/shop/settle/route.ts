import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopServisYetkili } from '@/lib/shop-auth';

/**
 * POST /api/shop/settle — Nextus Mağaza siparişinin KAPANIŞI.
 *
 * Bu uç nokta, /api/sales'teki barkodlu satışın aynısını yapar: atomik stok
 * düşümü + cari kaydı. Kod kopyalanmadı, DESEN kopyalandı ve aynı değişmezler
 * korundu:
 *
 *   · Koşullu updateMany ile düşüm  → yarış koşulunda bile negatif stok imkânsız
 *   · Yetersiz stokta THROW         → tüm transaction geri alınır, sahte satış olmaz
 *   · Peşin ise PAYMENT da yazılır  → cari borç net sıfır kalır
 *
 * MAĞAZA BU İŞLEMİ KENDİ YAPAMAZ ve yapmamalı: stok ve cari servis-takip'in
 * verisidir; iki uygulamanın aynı satırlara yazması, sessiz çift düşüm demektir.
 *
 * ÇİFT KAPANIŞ: mağaza tarafında ShopOrder.settledAt koşullu claim ile
 * alınır; burada da idempotencyKey (sipariş no) ile aynı siparişin ikinci
 * çağrısı REDDEDİLİR. İki taraflı kilit, tek taraflı kilitten daha güvenlidir:
 * biri atlanırsa diğeri tutar.
 */

interface Kalem {
  kind: 'PART' | 'PRINTER';
  id: string;
  qty: number;
  unitPrice: number;
  name?: string;
}

export async function POST(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  let body: {
    tenantId?: string;
    customerId?: string;
    siparisNo?: string;
    paid?: boolean;
    method?: string;
    items?: Kalem[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { tenantId, customerId, siparisNo, paid, method } = body;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!tenantId || !customerId || !siparisNo)
    return NextResponse.json({ error: 'tenantId, customerId ve siparisNo zorunlu' }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: 'Kalem yok' }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, isActive: true, isSuspended: false, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Bayi bulunamadı veya askıda' }, { status: 404 });

  // Müşteri bu bayiye mi ait (IDOR)? Mağaza doğru gönderse bile burada
  // yeniden kontrol edilir: sınırın iki tarafında da kontrol olmalı.
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

  // İDEMPOTENSİ: aynı sipariş daha önce kapandıysa yeniden stok düşme.
  // Notlarda sipariş numarası tutulur; bu, ayrı bir tablo eklemeden
  // servis-takip'in mevcut kayıt yapısıyla çalışan en yalın kilit.
  const not = `Mağaza siparişi ${siparisNo}`;
  const oncekiler = await prisma.accountEntry.findFirst({
    where: { tenantId, customerId, notes: not, type: 'SALE' },
    select: { id: true },
  });
  if (oncekiler) {
    return NextResponse.json({ ok: true, zatenIslendi: true }, { status: 200 });
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const when = new Date();
  const saleMethod = paid ? (method || 'CASH') : 'OPEN_ACCOUNT';

  try {
    const sonuc = await prisma.$transaction(
      async (tx) => {
        let total = 0;
        const lines: { name: string; qty: number; amount: number }[] = [];

        for (const it of items) {
          const qty = Math.max(1, Math.floor(it.qty) || 1);
          const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
          const amount = round2(qty * unitPrice);

          if (it.kind === 'PART') {
            const part = await tx.part.findFirst({ where: { id: it.id, tenantId } });
            if (!part) throw new Error(`Parça bulunamadı: ${it.name || it.id}`);
            const dec = await tx.part.updateMany({
              where: { id: part.id, tenantId, stockQty: { gte: qty } },
              data: { stockQty: { decrement: qty } },
            });
            if (dec.count === 0)
              throw new Error(`YETERSIZ_STOK: ${part.name} (mevcut ${part.stockQty}, istenen ${qty})`);
            lines.push({ name: part.name, qty, amount });
            total += amount;
          } else if (it.kind === 'PRINTER') {
            const ps = await tx.printerStock.findFirst({ where: { id: it.id, tenantId } });
            if (!ps) throw new Error(`Stok bulunamadı: ${it.name || it.id}`);
            const psName = [ps.brand, ps.model, ps.color].filter(Boolean).join(' ');
            const dec = await tx.printerStock.updateMany({
              where: { id: ps.id, tenantId, quantity: { gte: qty } },
              data: { quantity: { decrement: qty } },
            });
            if (dec.count === 0)
              throw new Error(`YETERSIZ_STOK: ${psName} (mevcut ${ps.quantity}, istenen ${qty})`);
            const after = await tx.printerStock.findFirst({
              where: { id: ps.id },
              select: { quantity: true },
            });
            if (after && after.quantity <= 0)
              await tx.printerStock.update({
                where: { id: ps.id },
                data: { soldAt: when, soldTo: customer.name },
              });
            lines.push({ name: psName, qty, amount });
            total += amount;
          } else {
            throw new Error('Geçersiz ürün türü');
          }
        }

        total = round2(total);

        for (const l of lines) {
          await tx.accountEntry.create({
            data: {
              tenantId,
              customerId,
              type: 'SALE',
              product: l.qty > 1 ? `${l.name} ×${l.qty}` : l.name,
              amount: l.amount,
              method: saleMethod,
              notes: not,
              createdByName: 'Nextus Mağaza',
              date: when,
            },
          });
        }

        if (paid) {
          await tx.accountEntry.create({
            data: {
              tenantId,
              customerId,
              type: 'PAYMENT',
              product: null,
              amount: total,
              method: method || 'CASH',
              notes: `${not} — tahsilat`,
              createdByName: 'Nextus Mağaza',
              date: when,
            },
          });
        }

        return { total, count: lines.length };
      },
      { timeout: 20000, maxWait: 10000 }
    );

    return NextResponse.json({ ok: true, ...sonuc });
  } catch (e: unknown) {
    const mesaj = e instanceof Error ? e.message : 'Kapanış başarısız';
    // Yetersiz stok, hata değil DURUMDUR: mağaza siparişi STOK_BEKLIYOR'a
    // alır ve bayiyi uyarır. Diğer hatalardan ayırt edilebilmesi gerekir.
    const stokSorunu = mesaj.startsWith('YETERSIZ_STOK');
    return NextResponse.json(
      { error: mesaj, kod: stokSorunu ? 'YETERSIZ_STOK' : 'HATA' },
      { status: stokSorunu ? 409 : 400 }
    );
  }
}
