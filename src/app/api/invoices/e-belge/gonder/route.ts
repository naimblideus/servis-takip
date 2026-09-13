import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { eBelgeGonder, eBelgeDurumGuncelle } from '@/lib/e-belge-gonderim';

/**
 * POST /api/invoices/e-belge/gonder  { id, islem?: 'gonder' | 'durum' }
 *
 * Fatura göndermek GERİ ALINAMAZ bir iş: yalnız yönetici. Bu uç tek
 * fatura gönderiyor; ay sonunun toplu gönderimi ayrı uçta (toplu/) ve
 * orada onay metni kaç faturanın, test mi canlı mı gideceğini yazıyor.
 */
export async function POST(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const { id, islem } = await req.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Fatura seçilmedi' }, { status: 400 });
    }

    const cevap = islem === 'durum'
      ? await eBelgeDurumGuncelle(tenantId, id)
      : await eBelgeGonder(tenantId, id);

    // Hata da 200 dönüyor: gövdedeki `ok` alanı sonucu söylüyor ve ekran
    // hatayı olduğu gibi gösteriyor. 500 dönseydi tarayıcı "bir şeyler ters
    // gitti" derdi ve bayi asıl sebebi görmezdi.
    return NextResponse.json(cevap);
  } catch (e) {
    return authErrorResponse(e);
  }
}
