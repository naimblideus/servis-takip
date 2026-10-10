import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { kayitDogrula, denemeIzni, kayitAc } from '@/lib/kayit';

export const dynamic = 'force-dynamic';

/** Satış WhatsApp'ı ayarlı değilse ana sayfadaki numara. */
const VARSAYILAN_WHATSAPP = '905526961703';

/**
 * İstemci IP'si. Önce vekilin yazdığı X-Real-IP: X-Forwarded-For'un ilk
 * değerini istemci kendisi gönderebilir, hız sınırını öyle atlatırdı.
 */
function ipAdresi(req: Request): string | null {
  const gercek = req.headers.get('x-real-ip');
  if (gercek) return gercek.trim().slice(0, 60);
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',').pop()!.trim().slice(0, 60) : null;
}

/** GET /api/kayit — kayıt açık mı, kapalıysa hangi WhatsApp'a yazılacak. */
export async function GET() {
  const ayar = await prisma.platformSettings.findFirst({ select: { kayitAcik: true, satisWhatsapp: true } });
  return NextResponse.json({
    acik: ayar ? ayar.kayitAcik : true,
    whatsapp: (ayar?.satisWhatsapp ?? '').replace(/\D/g, '') || VARSAYILAN_WHATSAPP,
  });
}

/**
 * POST /api/kayit — oturumsuz; 14 günlük deneme hesabı açar (lib/kayit.ts).
 * Başarıda giriş istemcide, seçilen şifreyle yapılır.
 */
export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  // Bal küpü: insan görmez, bot doldurur. Sessizce "tamam" — bot denemeye devam etmesin.
  if (govde && typeof govde === 'object' && (govde as Record<string, unknown>).web_sitesi) {
    return NextResponse.json({ ok: true });
  }
  const ip = ipAdresi(req);
  if (ip && !denemeIzni(ip)) return ucHatasi('KAYIT_SINIR', 429);

  const d = kayitDogrula(govde);
  if (!d.ok) return ucHatasi(d.kod, 400);

  try {
    const sonuc = await kayitAc(d.veri, ip);
    if (sonuc.durum === 'KAPALI') return ucHatasi('KAYIT_KAPALI', 403);
    if (sonuc.durum === 'YOGUN') return ucHatasi('KAYIT_SINIR', 429);
    if (sonuc.durum === 'EPOSTA_VAR') return ucHatasi('KAYIT_EPOSTA_VAR', 409);
    return NextResponse.json({ ok: true, eposta: d.veri.eposta });
  } catch (e) {
    console.error('[kayit] hesap açılamadı:', e instanceof Error ? e.message : e);
    return ucHatasi('KAYIT_ACILAMADI', 500);
  }
}
