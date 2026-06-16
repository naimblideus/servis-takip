import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Basit in-memory rate limit (tek container; spam/DoS + publicCode brute-force'a karşı) ──
const hits = new Map<string, number[]>();
function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) hits.clear(); // sınırsız büyümeyi önle (kaba ama yeterli)
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  return false;
}

// PUBLIC (oturumsuz) — müşteri, cihazdaki QR'ı okutup arıza bildirir.
// Güvenlik: yalnızca GEÇERLİ publicCode ile çalışır; ticket o cihazın tenant'ına açılır.
// createdByUserId zorunlu olduğu için cihazın tenant'ındaki bir kullanıcıya (tercihen ADMIN) atfedilir.

async function genTicketNumber(tenantId: string): Promise<string> {
  const all = await prisma.serviceTicket.findMany({ where: { tenantId }, select: { ticketNumber: true } });
  let max = 0;
  for (const t of all) {
    const m = t.ticketNumber.match(/^(?:TSK|SF)-(\d+)$/);
    if (m) { const n = parseInt(m[1]); if (n > max) max = n; }
  }
  let next = max + 1;
  for (let i = 0; i < 10; i++) {
    const c = `SF-${next}`;
    const ex = await prisma.serviceTicket.findFirst({ where: { tenantId, ticketNumber: c }, select: { id: true } });
    if (!ex) return c;
    next++;
  }
  return `SF-${Date.now()}`;
}

export async function POST(req: Request) {
  try {
    // Rate limit: IP başına (brute-force/spam) + cihaz başına (tek cihazı bombalamayı önle)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(`ip:${ip}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    const issue = String(body.issue || '').trim();
    if (code && rateLimited(`code:${code}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Bu cihaz için çok fazla bildirim alındı. Lütfen sonra deneyin.' }, { status: 429 });
    }
    const name = String(body.name || '').trim().slice(0, 120);
    const phone = String(body.phone || '').trim().slice(0, 40);

    if (!code) return NextResponse.json({ error: 'Kod gerekli' }, { status: 400 });
    if (issue.length < 5) return NextResponse.json({ error: 'Lütfen arızayı kısaca açıklayın (en az 5 karakter)' }, { status: 400 });
    if (issue.length > 1000) return NextResponse.json({ error: 'Açıklama çok uzun' }, { status: 400 });

    // Cihazı publicCode ile bul (oturumsuz erişimin tek anahtarı bu koddur)
    const device = await prisma.device.findUnique({
      where: { publicCode: code },
      select: { id: true, tenantId: true, customerId: true, brand: true, model: true },
    });
    if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

    // createdByUserId için tenant'ın bir kullanıcısı (tercihen ADMIN)
    const creator = await prisma.user.findFirst({
      where: { tenantId: device.tenantId, isActive: true },
      orderBy: { role: 'asc' }, // ADMIN < FRONT_DESK < SUPER_ADMIN < TECHNICIAN (alfabetik; en azından deterministik)
      select: { id: true },
    });
    if (!creator) return NextResponse.json({ error: 'Bu cihaz için kayıt oluşturulamadı' }, { status: 409 });

    const ticketNumber = await genTicketNumber(device.tenantId);
    const reporter = [name, phone].filter(Boolean).join(' · ') || 'Bilinmiyor';

    const ticket = await prisma.serviceTicket.create({
      data: {
        tenantId: device.tenantId,
        deviceId: device.id,
        customerId: device.customerId,
        ticketNumber,
        status: 'NEW',
        issueText: issue,
        notes: `📱 Müşteri bildirimi (QR) — Bildiren: ${reporter}`,
        createdByUserId: creator.id,
      },
      select: { ticketNumber: true },
    });

    return NextResponse.json({ ok: true, ticketNumber: ticket.ticketNumber, device: `${device.brand} ${device.model}` });
  } catch (e: any) {
    console.error('PUBLIC FAULT REPORT ERROR:', e?.message);
    return NextResponse.json({ error: 'Bildirim kaydedilemedi' }, { status: 500 });
  }
}
