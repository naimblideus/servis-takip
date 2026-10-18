import { NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { eksikSablonlariOlustur } from '@/lib/whatsapp-sablon-olustur';

export const dynamic = 'force-dynamic';

/**
 * POST /api/super-admin/whatsapp/sablon — eksik şablonları Meta'ya onaya gönderir.
 * Yalnız süper admin; Meta'da olanlara dokunmaz (lib/whatsapp-sablon-olustur).
 * Yanıtta hata METİN değil kod (`env`/`meta`) + Meta'nın kendi cümlesi; ekran
 * kullanıcının dilinde yazar.
 */
export async function POST() {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Meta şablon açmayı saatte sınırlıyor; üst üste basmak sınırı boşa yakar.
  const rl = rateLimit(`sa-wa-sablon:${admin.id}`, 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, kod: 'sinir' }, { status: 429 });

  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!process.env.WHATSAPP_TOKEN || !wabaId) return NextResponse.json({ ok: false, kod: 'env' }, { status: 400 });

  const r = await eksikSablonlariOlustur(wabaId, {
    template: process.env.WHATSAPP_TEMPLATE || null,
    templateSayac: process.env.WHATSAPP_TEMPLATE_SAYAC || null,
  });
  if (!r.ok) return NextResponse.json({ ok: false, kod: 'meta', ayrinti: r.hata }, { status: 502 });
  return NextResponse.json({ ok: true, sonuclar: r.sonuclar }, { headers: { 'Cache-Control': 'no-store' } });
}
