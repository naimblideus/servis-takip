import { NextResponse } from 'next/server';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';
import { magazaYoneticisi, vekilYaniti } from '@/lib/magaza-vekil';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * /api/magaza/logo — mağaza logosu, Servis'in "Mağaza ayarları" ekranından.
 * POST (multipart: dosya) yükler, DELETE kaldırır. Mağazanın /api/servis/logo
 * ucuna vekil; dosya kuralları (PNG/JPG, 8 MB) mağazada. Kapı: lib/magaza-vekil.
 */
const yazabilir = () => magazaYoneticisi({ kova: 'magaza-logo', adet: 10 });

export async function POST(req: Request) {
  const k = await yazabilir();
  if (k.hata) return k.hata;
  const gelen = await req.formData().catch(() => null);
  const dosya = gelen?.get('dosya');
  if (!(dosya instanceof File)) return NextResponse.json({ ok: false, hata: null, kod: 'DOSYA' }, { status: 400 });
  const form = new FormData();
  form.set('tenantId', k.user.tenantId);
  form.set('dosya', dosya, dosya.name);
  const y = await magazaIstegi('/api/servis/logo', { method: 'POST', form, zamanAsimiMs: 60_000 });
  return vekilYaniti(magazaYanitiCevir(y));
}

export async function DELETE() {
  const k = await yazabilir();
  if (k.hata) return k.hata;
  const y = await magazaIstegi(`/api/servis/logo?tenantId=${encodeURIComponent(k.user.tenantId)}`, { method: 'DELETE' });
  return vekilYaniti(magazaYanitiCevir(y));
}
