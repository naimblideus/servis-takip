import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rota/teslimatlar — mağazada "Teknisyen getirsin" denmiş, henüz
 * teslim edilmemiş siparişler. Rota ekranı bunları "araca yüklenecek" diye
 * gösterir; teknisyen aynı yola çıkarken siparişi de götürür.
 *
 * Servis fişi AÇILMAZ: fiş bir cihaza bağlı olmak zorunda ve siparişin stoğu
 * mağaza onayında zaten düşüldü (ikinci düşüm olmasın). Sipariş mağaza
 * şemasından okunur (bkz. lib/magaza-baglanti — aynı veritabanı).
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const satirlar = await prisma.$queryRaw<
      { no: string; customer_id: string | null; alici: string; ad: string; adet: number }[]
    >`
      SELECT o.no, o."customerId" AS customer_id, o."aliciAd" AS alici, l.ad, l.adet
      FROM shop."ShopOrder" o
      JOIN shop."ShopSettings" s ON s."tenantId" = o."tenantId"
      JOIN shop."ShopOrderLine" l ON l."orderId" = o.id
      WHERE s."servisTenantId" = ${user.tenantId}
        AND o.teslimat = 'TEKNISYEN'
        AND o.durum IN ('YENI', 'ONAY_KUYRUKTA', 'ONAYLANDI', 'HAZIRLANIYOR', 'STOK_BEKLIYOR')
      ORDER BY o."createdAt" ASC
      LIMIT 500
    `;
    const siparisler = new Map<string, { no: string; musteriId: string | null; alici: string; kalemler: { ad: string; adet: number }[] }>();
    for (const r of satirlar) {
      if (!siparisler.has(r.no)) siparisler.set(r.no, { no: r.no, musteriId: r.customer_id, alici: r.alici, kalemler: [] });
      siparisler.get(r.no)!.kalemler.push({ ad: r.ad, adet: r.adet });
    }
    return NextResponse.json([...siparisler.values()]);
  } catch {
    // Mağaza şeması yoksa (mağazasız bayi) liste boş.
    return NextResponse.json([]);
  }
}
