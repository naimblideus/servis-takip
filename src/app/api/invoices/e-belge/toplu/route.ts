import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { eBelgeGonder } from '@/lib/e-belge-gonderim';
import { ESKI_SISTEM } from '@/lib/fatura-belgesi';

/**
 * POST /api/invoices/e-belge/toplu  { ids?: string[], donem?: 'YYYY-MM' }
 *
 * ── NİÇİN VAR ────────────────────────────────────────────────────────────
 * Ay sonunda 40-50 kira faturası kesiliyor. Tek tek göndermek bu özelliği
 * kullanılamaz yapıyordu; bayi ya hiç göndermez ya yarısını unutur.
 *
 * ── NİÇİN TEK TEK VE SIRAYLA ─────────────────────────────────────────────
 * Paralel gönderim GİB sıra sayacında yarış yaratır. Sırayla gidiyor;
 * yavaş ama numara sırası kesintisiz kalıyor — hız için bozulacak şey
 * değil.
 *
 * ── BİR HATA DİĞERLERİNİ DURDURMUYOR ─────────────────────────────────────
 * Her fatura bağımsız: biri reddedilirse kalanlar yine gidiyor. Ama
 * HİÇBİRİ SESSİZ DEĞİL — her faturanın sonucu tek tek dönüyor.
 */

/** Tek seferde gönderilecek en fazla belge. */
const TAVAN = 100;

export async function POST(req: NextRequest) {
  // Geri alınamaz ve toplu: yalnız yönetici.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const { ids, donem } = await req.json();

    let hedefler: string[];
    if (Array.isArray(ids) && ids.length) {
      hedefler = ids.map(String).slice(0, TAVAN);
    } else if (typeof donem === 'string' && /^\d{4}-\d{2}$/.test(donem)) {
      // Dönem verildiyse: o dönemin HENÜZ GÖNDERİLMEMİŞ faturaları.
      // Göçte aktarılanlar ve iptaller dışarıda.
      const [y, m] = donem.split('-').map(Number);
      const liste = await prisma.customerInvoice.findMany({
        where: {
          tenantId, deletedAt: null,
          status: { not: 'CANCELLED' },
          invoiceDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
          OR: [
            { eBelgeDurum: null },
            { eBelgeDurum: { in: ['HAZIR', 'HATA'] } },
          ],
          NOT: { eBelgeDurum: ESKI_SISTEM },
        },
        select: { id: true },
        orderBy: { invoiceDate: 'asc' },
        take: TAVAN + 1,
      });
      if (liste.length > TAVAN) {
        return NextResponse.json({
          error: `Bu dönemde ${liste.length}+ gönderilecek fatura var; tek seferde en fazla ${TAVAN}. `
            + 'Listeden seçerek parça parça gönderin.',
        }, { status: 400 });
      }
      hedefler = liste.map((x) => x.id);
    } else {
      return NextResponse.json({ error: 'Gönderilecek fatura seçilmedi' }, { status: 400 });
    }

    if (!hedefler.length) {
      return NextResponse.json({ toplam: 0, gonderilen: 0, basarisiz: 0, sonuclar: [] });
    }

    // SIRAYLA: paralel gitmek GİB sıra sayacında yarış yaratır.
    const sonuclar: any[] = [];
    for (const id of hedefler) {
      const fatura = await prisma.customerInvoice.findFirst({
        where: { id, tenantId },
        select: { invoiceNumber: true, customer: { select: { name: true } } },
      });
      const r = await eBelgeGonder(tenantId, id);
      sonuclar.push({
        id,
        invoiceNumber: fatura?.invoiceNumber ?? id,
        musteri: fatura?.customer?.name ?? '—',
        ok: r.ok,
        durum: r.durum,
        gibNo: r.gibNo,
        hata: r.hata ?? null,
        eksikler: r.eksikler ?? null,
        tekrarDenenebilir: r.tekrarDenenebilir ?? null,
      });
    }

    const gonderilen = sonuclar.filter((x) => x.ok).length;
    return NextResponse.json({
      toplam: sonuclar.length,
      gonderilen,
      basarisiz: sonuclar.length - gonderilen,
      sonuclar,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
