import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { istemciIp } from '@/lib/istemci-ip';
import { kayitDogrula, denemeDurumu, kayitAc, etkinlikBul, etkinlikKodu, ETKINLIK_CEREZI, sinirdaTalep, etkinlikHesapSayisi, type Etkinlik, type KayitVerisi } from '@/lib/kayit';

export const dynamic = 'force-dynamic';

/** Satış WhatsApp'ı ayarlı değilse ana sayfadaki numara. */
const VARSAYILAN_WHATSAPP = '905526961703';


/** GET /api/kayit[?k=kod] — kayıt açık mı, kapalıysa hangi WhatsApp'a yazılacak, kod hangi etkinliğin. */
export async function GET(req: Request) {
  const ayar = await prisma.platformSettings.findFirst({ select: { kayitAcik: true, satisWhatsapp: true } });
  // Kodsuz istek (demo ekranı, giriş sayfası) etkinlik çerezine bakar: /pantum'dan gelen bayi teklifini görür.
  const etk = etkinlikBul(etkinlikKodu(new URL(req.url).searchParams.get('k'), (await cookies()).get(ETKINLIK_CEREZI)?.value));
  return NextResponse.json({
    acik: ayar ? ayar.kayitAcik : true,
    whatsapp: (ayar?.satisWhatsapp ?? '').replace(/\D/g, '') || VARSAYILAN_WHATSAPP,
    etkinlik: etk?.ad ?? null,
    // Etkinliğe özel deneme: sayfadaki "30 gün ücretsiz · 5 kullanıcı" satırı.
    ...(etk ? { denemeGun: etk.denemeGun, kullanici: etk.kullanici, hesap: await etkinlikHesapSayisi(etk) } : {}),
  });
}

/**
 * Sınıra takılan gerçek kişi: hesap yerine talep (lib/kayit sinirdaTalep).
 * sebep: 'ag' = bu ağdan bugün çok hesap açıldı; 'yogun' = sitede son bir
 * saatte çok kayıt var. Ekran ikisine ayrı cümle kurar.
 */
async function talebeCevir(veri: KayitVerisi, etk: Etkinlik | null, sebep: 'ag' | 'yogun') {
  try {
    await sinirdaTalep(veri, etk);
    return NextResponse.json({ ok: false, talep: true, sebep }, { status: 202 });
  } catch (e) {
    console.error('[kayit] sınırda talep yazılamadı:', e instanceof Error ? e.message : e);
    return ucHatasi('KAYIT_SINIR', 429);
  }
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
  const ip = istemciIp(req);
  const etk = etkinlikBul(etkinlikKodu(govde && typeof govde === 'object' ? (govde as Record<string, unknown>).kod : null, (await cookies()).get(ETKINLIK_CEREZI)?.value));
  const izin = ip ? denemeDurumu(ip, Date.now(), etk) : 'TAMAM';
  if (izin === 'DENEME') return ucHatasi('KAYIT_SINIR', 429);

  const d = kayitDogrula(govde);
  if (!d.ok) return ucHatasi(d.kod, 400);
  if (izin === 'GUNLUK') return talebeCevir(d.veri, etk, 'ag');

  try {
    const sonuc = await kayitAc(d.veri, ip, etk);
    if (sonuc.durum === 'KAPALI') return ucHatasi('KAYIT_KAPALI', 403);
    if (sonuc.durum === 'YOGUN') return talebeCevir(d.veri, etk, 'yogun');
    if (sonuc.durum === 'EPOSTA_VAR') return ucHatasi('KAYIT_EPOSTA_VAR', 409);
    return NextResponse.json({ ok: true, eposta: d.veri.eposta });
  } catch (e) {
    // Beklenmeyen hata: bayinin bilgisi kaybolmasın, satış ekibi açsın (talep).
    console.error('[kayit] hesap açılamadı:', e instanceof Error ? e.message : e);
    return talebeCevir(d.veri, etk, 'yogun');
  }
}
