import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { istemciIp } from '@/lib/istemci-ip';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { sifirlamaIste } from '@/lib/sifre-sifirlama';

export const dynamic = 'force-dynamic';

/** Satış WhatsApp'ı ayarlı değilse ana sayfadaki numara. */
const VARSAYILAN_WHATSAPP = '905526961703';

/**
 * POST /api/sifre/unuttum { eposta } — oturumsuz; kayıtlıysa e-postaya
 * tek kullanımlık bağlantı (lib/sifre-sifirlama.ts). Adres kayıtlı olsun
 * olmasın cevap aynı. Gönderim kurulu değilse WhatsApp numarası döner.
 */
export async function POST(req: Request) {
  const govde = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // Bal küpü: insan görmez, bot doldurur.
  if (govde?.web_sitesi) return NextResponse.json({ ok: true });
  const sonuc = await sifirlamaIste(govde?.eposta, istemciIp(req), await sunucuDili());
  if (sonuc.durum === 'GECERSIZ') return ucHatasi('KAYIT_EPOSTA_GECERSIZ', 400);
  // Sınır e-posta gönderimini korur; kişi yine de yardımsız kalmasın: WhatsApp yolu.
  if (sonuc.durum === 'SINIR' || sonuc.durum === 'EPOSTA_KAPALI') {
    const ayar = await prisma.platformSettings.findFirst({ select: { satisWhatsapp: true } });
    return NextResponse.json({ ok: true, kanal: 'whatsapp', whatsapp: (ayar?.satisWhatsapp ?? '').replace(/\D/g, '') || VARSAYILAN_WHATSAPP });
  }
  return NextResponse.json({ ok: true, kanal: 'eposta' });
}
