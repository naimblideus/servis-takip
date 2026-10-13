import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { istemciIp } from '@/lib/istemci-ip';
import { baglantiGecerli, sifreYenile } from '@/lib/sifre-sifirlama';

export const dynamic = 'force-dynamic';

/** GET /api/sifre/yenile?t=… — bağlantı hâlâ geçerli mi (form açılmadan önce). */
export async function GET(req: Request) {
  return NextResponse.json({ gecerli: await baglantiGecerli(new URL(req.url).searchParams.get('t')) });
}

/**
 * POST /api/sifre/yenile { t, sifre } — tek kullanımlık bağlantıyla yeni şifre.
 * Başarıda e-posta döner; giriş istemcide yeni şifreyle yapılır.
 */
export async function POST(req: Request) {
  const govde = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sonuc = await sifreYenile(govde?.t, govde?.sifre, istemciIp(req));
  if (sonuc.durum === 'SIFRE_KISA') return ucHatasi('KAYIT_SIFRE_KISA', 400);
  if (sonuc.durum === 'GECERSIZ') return ucHatasi('SIFRE_BAGLANTI_GECERSIZ', 400);
  return NextResponse.json({ ok: true, eposta: sonuc.eposta });
}
