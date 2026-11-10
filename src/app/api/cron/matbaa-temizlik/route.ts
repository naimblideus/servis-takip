import { NextRequest, NextResponse } from 'next/server';
import { tekSeferlik } from '@/lib/zamanlanmis-is';
import { dosyaTemizligi } from '@/lib/baski-dosya-kayit';

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

/**
 * BASKI DOSYALARININ SAKLAMA SÜRESİ — KVKK veri minimizasyonu.
 *
 * Müşterinin gönderdiği dosya (tez, kimlik fotokopisi, sözleşme) iş bitince
 * bizde durmamalı. Teslim ya da iptalden sonra matbaanın ayarındaki gün
 * (varsayılan 30) dolunca içerik depodan silinir; kaydı "silindi" olarak
 * kalır. Sipariş sayfası müşteriye bu süreyi söylüyor: söz burada tutuluyor.
 * Bir günden eski yarım yüklemeler de atılır. Depo bağlı değilse iş yapmaz.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return tekSeferlik(req, 'matbaa-temizlik', 'gunluk', async () => {
    try {
      return NextResponse.json({ ok: true, ...(await dosyaTemizligi()) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Hata' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
