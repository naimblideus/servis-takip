import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getUser(session: any) {
  return prisma.user.findFirst({ where: { email: session.user?.email! } });
}

// Barkod aynı tenant'ta hem Part hem PrinterStock arasında tekil olmalı (yanlış kalem satışını önler).
async function barcodeTaken(tenantId: string, barcode: string, exclude?: { table: 'PART' | 'PRINTER'; id: string }): Promise<boolean> {
  if (!barcode) return false;
  const part = await prisma.part.findFirst({
    where: { tenantId, barcode, ...(exclude?.table === 'PART' ? { id: { not: exclude.id } } : {}) },
    select: { id: true },
  });
  if (part) return true;
  const ps = await prisma.printerStock.findFirst({
    where: { tenantId, barcode, ...(exclude?.table === 'PRINTER' ? { id: { not: exclude.id } } : {}) },
    select: { id: true },
  });
  return !!ps;
}

// GET /api/stock — Part + PrinterStock birleşik liste
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await getUser(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const source = searchParams.get('source'); // PART | PRINTER | null=both

    const items: any[] = [];

    if (!source || source === 'PART') {
      const parts = await prisma.part.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
      });
      for (const p of parts) {
        if (search && !p.name.toLowerCase().includes(search) && !p.sku.toLowerCase().includes(search) && !(p.barcode || '').toLowerCase().includes(search)) continue;
        items.push({
          id: p.id, source: 'PART', name: p.name, sku: p.sku, barcode: p.barcode,
          group: p.group, buyPrice: Number(p.buyPrice), sellPrice: Number(p.sellPrice),
          stockQty: p.stockQty, minStock: p.minStock,
        });
      }
    }

    if (!source || source === 'PRINTER') {
      const printers = await prisma.printerStock.findMany({
        where: { tenantId: user.tenantId, soldAt: null },
        orderBy: { createdAt: 'desc' },
      });
      for (const p of printers) {
        const name = [p.brand, p.model, p.color].filter(Boolean).join(' ');
        if (search && !name.toLowerCase().includes(search) && !p.brand.toLowerCase().includes(search) && !((p as any).barcode || '').toLowerCase().includes(search)) continue;
        items.push({
          id: p.id, source: 'PRINTER', name,
          category: p.category, brand: p.brand, model: p.model,
          color: p.color, condition: p.condition, barcode: (p as any).barcode ?? null,
          buyPrice: Number(p.buyPrice), sellPrice: Number(p.sellPrice),
          stockQty: p.quantity, notes: p.notes,
        });
      }
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/stock — Yeni stok kalemi ekle
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await getUser(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();

    if (body.source === 'PART') {
      const bc = body.barcode?.trim();
      if (bc && await barcodeTaken(user.tenantId, bc)) return NextResponse.json({ error: 'Bu barkod zaten başka bir kalemde kullanılıyor' }, { status: 409 });
      const part = await prisma.part.create({
        data: {
          tenantId: user.tenantId,
          sku: body.sku?.trim() || `SKU-${Date.now()}`,
          name: body.name,
          buyPrice: parseFloat(body.buyPrice) || 0,
          sellPrice: parseFloat(body.sellPrice) || 0,
          stockQty: parseInt(body.stockQty) || 1,
          minStock: parseInt(body.minStock) || 5,
          group: body.group || null,
          barcode: body.barcode?.trim() || null,
        },
      });
      return NextResponse.json({ id: part.id, source: 'PART', name: part.name, sku: part.sku, barcode: part.barcode, group: part.group, buyPrice: Number(part.buyPrice), sellPrice: Number(part.sellPrice), stockQty: part.stockQty, minStock: part.minStock });
    }

    if (body.source === 'PRINTER') {
      const bc = body.barcode?.trim();
      if (bc && await barcodeTaken(user.tenantId, bc)) return NextResponse.json({ error: 'Bu barkod zaten başka bir kalemde kullanılıyor' }, { status: 409 });
      const p = await prisma.printerStock.create({
        data: {
          tenantId: user.tenantId,
          category: body.category || 'TONER',
          brand: body.brand || '',
          model: body.model || '',
          condition: body.condition || 'SIFIR',
          color: body.color || null,
          barcode: body.barcode?.trim() || null,
          quantity: parseInt(body.quantity) || 1,
          buyPrice: parseFloat(body.buyPrice) || 0,
          sellPrice: parseFloat(body.sellPrice) || 0,
          notes: body.notes || null,
        },
      });
      const name = [p.brand, p.model, p.color].filter(Boolean).join(' ');
      return NextResponse.json({ id: p.id, source: 'PRINTER', name, category: p.category, brand: p.brand, model: p.model, color: p.color, condition: p.condition, barcode: (p as any).barcode, buyPrice: Number(p.buyPrice), sellPrice: Number(p.sellPrice), stockQty: p.quantity, notes: p.notes });
    }

    return NextResponse.json({ error: 'source: PART veya PRINTER olmalı' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/stock — Stok kalemi güncelle
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await getUser(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    const { id, source } = body;
    if (!id || !source) return NextResponse.json({ error: 'id ve source zorunlu' }, { status: 400 });

    if (source === 'PART') {
      const ex = await prisma.part.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!ex) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
      const bc = body.barcode !== undefined ? (body.barcode?.trim() || null) : ex.barcode;
      if (bc && await barcodeTaken(user.tenantId, bc, { table: 'PART', id })) return NextResponse.json({ error: 'Bu barkod zaten başka bir kalemde kullanılıyor' }, { status: 409 });
      const updated = await prisma.part.update({
        where: { id },
        data: {
          name: body.name ?? ex.name,
          sku: body.sku ?? ex.sku,
          buyPrice: body.buyPrice !== undefined ? parseFloat(body.buyPrice) : ex.buyPrice,
          sellPrice: body.sellPrice !== undefined ? parseFloat(body.sellPrice) : ex.sellPrice,
          stockQty: body.stockQty !== undefined ? parseInt(body.stockQty) : ex.stockQty,
          minStock: body.minStock !== undefined ? parseInt(body.minStock) : ex.minStock,
          group: body.group !== undefined ? body.group : ex.group,
          barcode: bc,
        },
      });
      return NextResponse.json(updated);
    }

    if (source === 'PRINTER') {
      const ex = await prisma.printerStock.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!ex) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
      const bc = body.barcode !== undefined ? (body.barcode?.trim() || null) : (ex as any).barcode;
      if (bc && await barcodeTaken(user.tenantId, bc, { table: 'PRINTER', id })) return NextResponse.json({ error: 'Bu barkod zaten başka bir kalemde kullanılıyor' }, { status: 409 });
      const updated = await prisma.printerStock.update({
        where: { id },
        data: {
          brand: body.brand ?? ex.brand,
          model: body.model ?? ex.model,
          category: body.category ?? ex.category,
          color: body.color !== undefined ? body.color : ex.color,
          barcode: bc,
          condition: body.condition ?? ex.condition,
          quantity: body.quantity !== undefined ? parseInt(body.quantity) : ex.quantity,
          buyPrice: body.buyPrice !== undefined ? parseFloat(body.buyPrice) : ex.buyPrice,
          sellPrice: body.sellPrice !== undefined ? parseFloat(body.sellPrice) : ex.sellPrice,
          notes: body.notes !== undefined ? body.notes : ex.notes,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'source: PART veya PRINTER olmalı' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/stock?id=X&source=PART|PRINTER
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await getUser(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source');
    if (!id || !source) return NextResponse.json({ error: 'id ve source zorunlu' }, { status: 400 });

    if (source === 'PART') {
      await prisma.part.deleteMany({ where: { id, tenantId: user.tenantId } });
    } else if (source === 'PRINTER') {
      await prisma.printerStock.deleteMany({ where: { id, tenantId: user.tenantId } });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
