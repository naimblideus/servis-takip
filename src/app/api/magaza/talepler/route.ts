import { NextResponse } from 'next/server';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';
import { magazaYoneticisi, vekilYaniti } from '@/lib/magaza-vekil';

export const dynamic = 'force-dynamic';

/**
 * /api/magaza/talepler — siteden gelen talepler (servis, kiralama, teklif)
 * Servis'in "Bugün" listesinde. Mağazanın /api/servis/talepler ucuna vekil;
 * "yazıldı" panelin sabah listesinden de düşürür. Kapı: lib/magaza-vekil.
 */
const DURUMLAR = ['YENI', 'YAZILDI', 'KAPANDI'];
const gecersiz = () => NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

export async function GET() {
  const k = await magazaYoneticisi();
  if (k.hata) return k.hata;
  const y = await magazaIstegi(`/api/servis/talepler?tenantId=${encodeURIComponent(k.user.tenantId)}`);
  return vekilYaniti(magazaYanitiCevir(y));
}

export async function POST(req: Request) {
  const k = await magazaYoneticisi({ kova: 'magaza-talep', adet: 120 });
  if (k.hata) return k.hata;
  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return gecersiz();
  if (typeof g.talepId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(g.talepId)) return gecersiz();
  if (typeof g.durum !== 'string' || !DURUMLAR.includes(g.durum)) return gecersiz();
  const y = await magazaIstegi('/api/servis/talepler', {
    method: 'POST',
    json: { talepId: g.talepId, durum: g.durum, tenantId: k.user.tenantId },
  });
  return vekilYaniti(magazaYanitiCevir(y));
}
