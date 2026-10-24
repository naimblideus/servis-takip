import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { donemFaturasiHazirla } from '@/lib/invoicing';
import { bekleyenSayisiniTazele } from '@/lib/fatura-turu';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';

/**
 * TASLAKTA BEKLEYEN DÖNEM FATURALARI (lib/fatura-bekletme).
 *
 * GET  → bekleyen taslaklar (gerekçe + önizleme satırları), en yeni dönem önce.
 * POST { ids, islem: 'KES' | 'AT' }
 *   KES: "yine de kes". Hesap kilit içinde yeniden yapılır; tutar taslaktan
 *        farklıysa kesilmez, taslak güncellenir (degisen) — bayi gördüğünden
 *        başka bir tutarı onaylamış olmasın.
 *   AT:  bu dönem kesilmesin. Okumalar faturalanmamış kalır; bayi dönemi elle
 *        yeniden faturalarsa taslak yeniden hesaplanır.
 */
export async function GET() {
  let user;
  try { ({ user } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  const taslaklar = await prisma.faturaTaslagi.findMany({
    where: { tenantId: user.tenantId, durum: 'BEKLIYOR' },
    orderBy: [{ period: 'desc' }, { toplam: 'desc' }],
    take: 500,
    include: { customer: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    taslaklar: taslaklar.map((t) => ({
      id: t.id,
      period: t.period,
      customer: t.customer,
      gerekceler: t.gerekceler,
      satirlar: t.satirlar,
      araToplam: Number(t.araToplam),
      toplam: Number(t.toplam),
      guncellendi: t.guncellendi.toISOString(),
    })),
    toplam: Math.round(taslaklar.reduce((s, t) => s + Number(t.toplam), 0) * 100) / 100,
  });
}

export async function POST(req: Request) {
  // Demoda kapalı: lib/demo-yazma DEMO_VITRIN (middleware).
  let user;
  try { ({ user } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }

  const body = await req.json().catch(() => ({}));
  const islem = body?.islem;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 500) : [];
  if ((islem !== 'KES' && islem !== 'AT') || ids.length === 0) return ucHatasi('GECERSIZ_ISTEK', 400);

  // Yalnız bu bayinin bekleyen taslakları (IDOR guard).
  const taslaklar = await prisma.faturaTaslagi.findMany({
    where: { id: { in: ids }, tenantId: user.tenantId, durum: 'BEKLIYOR' },
    select: { id: true, customerId: true, period: true },
  });

  let kesilen = 0, degisen = 0, atilan = 0, hata = 0;
  let tutar = 0;
  for (const t of taslaklar) {
    try {
      if (islem === 'AT') {
        const r = await prisma.faturaTaslagi.updateMany({ where: { id: t.id, durum: 'BEKLIYOR' }, data: { durum: 'ATILDI' } });
        atilan += r.count;
        continue;
      }
      const s = await donemFaturasiHazirla(user.tenantId, t.customerId, t.period, { source: 'AUTO_MONTHLY', taslakId: t.id });
      if (s?.tur === 'KESILDI') { kesilen++; tutar += Number(s.invoice.totalAmount); }
      else if (s?.tur === 'DEGISTI') degisen++;
    } catch (e: any) {
      hata++;
      console.error('TASLAK KESME HATASI:', e?.message);
    }
  }
  for (const p of new Set(taslaklar.map((t) => t.period))) {
    await bekleyenSayisiniTazele(user.tenantId, p).catch(() => {});
  }
  return NextResponse.json({ ok: true, kesilen, degisen, atilan, hata, tutar: Math.round(tutar * 100) / 100 });
}
