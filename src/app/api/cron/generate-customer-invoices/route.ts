import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tekSeferlik } from '@/lib/zamanlanmis-is';
import { donemAraligi, gecerliDonem, kapananDonem, kesimGunu } from '@/lib/fatura-donemi';
import { bitmemisDonemler, donemKapaliMi } from '@/lib/fatura-turu';
import { bayiDoneminiFaturala } from '@/lib/fatura-kosusu';

// Vercel function timeout (saniye) — büyük tenant'lar için
export const maxDuration = 300;

/**
 * KAPANMIŞ dönemi faturala — bugünün dönemini DEĞİL.
 *
 * Cron ayın 1'inde 06:00'da çalışıyor (`0 6 1 * *`). Varsayılan dönem
 * `periodOf()` yani BUGÜNÜN dönemiydi: 1 Ekim'de "2026-10" faturalanıyordu.
 * Fatura ise yalnız `readingDate >= 1 Ekim && < 1 Kasım` aralığındaki
 * okumaları alıyor (invoicing.ts periodRange) — o pencerede daha hiç okuma
 * yok. Sonuç: EYLÜL boyunca okunan bütün sayaçlar `billed:false` kalıyor ve
 * bir sonraki ay da kendi penceresine bakacağı için o gelir BİR DAHA HİÇ
 * faturalanmıyordu. Bayinin ayın tüm sayaç geliri sessizce kayboluyordu.
 *
 * Doğrusu: ay kapandığında KAPANAN ayı faturalamak. Kira da o döneme yazılır,
 * yani fatura "geçen ayın kirası + geçen ayın aşımı" olur — dönem sonu
 * faturalama. Elle tetikte `period` verilirse o kullanılır, bu yalnız
 * varsayılan.
 *
 * Kapanan dönem artık İSTANBUL saatine ve bayinin kesim gününe göre
 * (lib/fatura-donemi kapananDonem); bayi bayi hesaplanır. Koşu bitince
 * FaturaTuru'na yazılır: dönem TAMAM olur, o aya düşen geç okumalar bir
 * sonraki açık döneme kayar (kaybolmasın) ve müşteri başına hatalar sunucu
 * günlüğünde kaybolmaz.
 *
 * GÜNLÜK ÇALIŞIR (2026-10-25): kesim günü 1 olmayan bayide dönem ayın 1'inde
 * kapanmıyor. İş her sabah bayi bayi kapanan döneme bakar; koşusu bitmişse
 * (FaturaTuru TAMAM) atlar — yani dönem başına fiilen bir kez çalışır.
 * Bayi açılmadan önce biten dönem koşulmaz (orada faturalanacak gerçek iş yok;
 * koşulsaydı yeni bayinin teslim edilmiş fişleri "geçen ay faturası" olurdu).
 *
 * Şüpheli okuma ve fatura şoku olan müşteri faturası kesilmez, taslakta
 * bekler (lib/fatura-bekletme); bayi isterse her fatura bekler (faturaOnayi).
 */

// CRON_SECRET ile koruma (Vercel Cron: Authorization: Bearer <secret>)
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET (asla open)
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

// Tüm otomatik-faturalama açık tenant'ların müşterileri için dönem faturası üret (idempotent)
async function run(elleDonem: string | null, tenantId?: string) {
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      autoInvoiceEnabled: true,
      ...(tenantId ? { id: tenantId } : {}),
    },
    select: { id: true, name: true, invoiceDayOfMonth: true, createdAt: true },
  });

  const results: {
    tenantId: string;
    tenantName: string;
    period: string;
    invoices: number;
    total: number;
    errors: number;
    bekleyen: number;
    atlandi?: true;
  }[] = [];

  for (const tenant of tenants) {
    const kesim = kesimGunu(tenant.invoiceDayOfMonth);
    const kapanan = kapananDonem(new Date(), kesim);
    // Koşulacak dönemler: elle verilen dönem; yoksa önce yarım kalmış (hata
    // almış) eski koşular, sonra az önce kapanan dönem. Hata alan müşteri
    // böylece ertesi gün ve ay dönse de yeniden denenir (lib/fatura-kosusu).
    const donemler: string[] = [];
    if (elleDonem) donemler.push(elleDonem);
    else {
      donemler.push(...(await bitmemisDonemler(tenant.id, kapanan)));
      // Bayi açılmadan önce biten dönem koşulmaz; koşusu bitmiş dönem atlanır.
      if (donemAraligi(kapanan).end <= tenant.createdAt || (await donemKapaliMi(tenant.id, kapanan))) {
        if (donemler.length === 0) {
          results.push({ tenantId: tenant.id, tenantName: tenant.name, period: kapanan, invoices: 0, total: 0, errors: 0, bekleyen: 0, atlandi: true });
          continue;
        }
      } else if (!donemler.includes(kapanan)) donemler.push(kapanan);
    }

    for (const period of donemler) {
      const r = await bayiDoneminiFaturala(tenant.id, period, 'CRON', kesim);
      results.push({ tenantId: tenant.id, tenantName: tenant.name, period, invoices: r.invoices, total: r.total, errors: r.errors, bekleyen: r.bekleyen });
    }
  }

  return results;
}

// Vercel Cron GET ile çağırır
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const verilen = new URL(req.url).searchParams.get('period');
  if (verilen && !gecerliDonem(verilen)) return NextResponse.json({ error: 'GECERSIZ_DONEM' }, { status: 400 });
  const elle = verilen || null;
  const calistir = async () => {
    const results = await run(elle);
    return NextResponse.json({ ok: true, period: elle ?? 'kapanan', tenants: results.length, results });
  };
  return elle ? calistir() : tekSeferlik(req, 'faturalar', 'gunluk', calistir);
}

// Manuel tetik (admin) — body: { period?, tenantId? }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* boş body */
  }
  if (body.period && !gecerliDonem(body.period)) return NextResponse.json({ error: 'GECERSIZ_DONEM' }, { status: 400 });
  const results = await run(body.period || null, body.tenantId);
  return NextResponse.json({ ok: true, period: body.period || 'kapanan', tenants: results.length, results });
}
