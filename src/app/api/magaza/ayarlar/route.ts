import { NextResponse } from 'next/server';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';
import { magazaYoneticisi, vekilYaniti } from '@/lib/magaza-vekil';

export const dynamic = 'force-dynamic';

/**
 * /api/magaza/ayarlar — "Mağaza ayarları" ekranı (Servis içinde).
 *
 * Mağazanın /api/servis/ayarlar ucuna vekil. Bayinin servis kimliği
 * oturumdan eklenir; istemci başka bir bayinin kimliğini gönderemez.
 * Kapı (yalnız yönetici, demo yazamaz): lib/magaza-vekil.
 */
export async function GET() {
  const k = await magazaYoneticisi();
  if (k.hata) return k.hata;
  const y = await magazaIstegi(`/api/servis/ayarlar?tenantId=${encodeURIComponent(k.user.tenantId)}`);
  return vekilYaniti(magazaYanitiCevir(y));
}

export async function POST(req: Request) {
  const k = await magazaYoneticisi({ kova: 'magaza-ayar', adet: 30 });
  if (k.hata) return k.hata;

  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

  // Yalnız bilinen işlemler ve alanlar geçer; kimlik her zaman oturumdan.
  const islem = g.islem;
  let govde: Record<string, unknown>;
  if (islem === 'KAYDET') govde = { islem, veri: g.veri };
  else if (islem === 'KAMPANYA_BASLAT') govde = { islem, tur: g.tur, yuzde: g.yuzde, gun: g.gun };
  else if (islem === 'KAMPANYA_DURDUR') govde = { islem, id: g.id };
  else return NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

  const y = await magazaIstegi('/api/servis/ayarlar', { method: 'POST', json: { ...govde, tenantId: k.user.tenantId } });
  return vekilYaniti(magazaYanitiCevir(y));
}
