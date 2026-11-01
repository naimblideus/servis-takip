import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { matbaaYaniti } from '@/lib/matbaa-uc';
import { findCustomerByPhone } from '@/lib/whatsapp-inbound';

export const dynamic = 'force-dynamic';

/** GET /api/matbaa/musteri?tel= — tezgahta telefonla kayıtlı müşteri önerisi (son 10 hane). */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const tel = (new URL(req.url).searchParams.get('tel') ?? '').replace(/\D/g, '');
    const musteri = tel.length >= 10 ? await findCustomerByPhone(tenantId, tel) : null;
    return NextResponse.json({ musteri });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
