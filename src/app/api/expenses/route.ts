import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/expenses — Gider listesi
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM formatında

    const where: any = { tenantId: user.tenantId };
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = {
        gte: new Date(y, m - 1, 1),
        lt: new Date(y, m, 1),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return NextResponse.json({ expenses, totalExpense });
  } catch (e: any) {
    if (e.message?.includes('does not exist')) {
      return NextResponse.json({ expenses: [], totalExpense: 0 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/expenses — Yeni gider ekle
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    const { category, description, amount, date, payee, method, notes } = body;
    if (!description || !amount) {
      return NextResponse.json({ error: 'description ve amount zorunlu' }, { status: 400 });
    }
    const expense = await prisma.expense.create({
      data: {
        tenantId: user.tenantId,
        category: category || 'GENEL',
        description,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        payee: payee || null,
        method: method || 'CASH',
        notes: notes || null,
      },
    });
    return NextResponse.json(expense);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/expenses — Gider güncelle
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });
    const ex = await prisma.expense.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!ex) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.category && { category: data.category }),
        ...(data.description && { description: data.description }),
        ...(data.amount !== undefined && { amount: parseFloat(data.amount) }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.payee !== undefined && { payee: data.payee || null }),
        ...(data.method && { method: data.method }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/expenses?id=X
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });
    await prisma.expense.deleteMany({ where: { id, tenantId: user.tenantId } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
