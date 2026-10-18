import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopServisYetkili } from '@/lib/shop-auth';
import { sendText, waOutConfigured } from '@/lib/whatsapp-out';
import { waApiPhone } from '@/lib/whatsapp';
import { metaPost, metaGet } from '@/lib/whatsapp-graph';
import { retliMi } from '@/lib/whatsapp-inbound';
import {
  MAGAZA_SABLONLARI,
  magazaSablonu,
  degiskenSayisi,
  degiskenTemizle,
  sablonMetni,
  GOVDE_AZAMI,
} from '@/lib/whatsapp-sablon-magaza';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shop/bildirim — Nextus Mağaza adına WhatsApp mesajı gönderir.
 *
 * NEDEN BURADA: WhatsApp numarası, phone_number_id ve Meta onayları
 * servis-takip'e bağlı. Mağazanın kendi entegrasyonunu kurması ikinci bir
 * onay süreci ve ikinci bir kırılma noktası demek olurdu.
 *
 * ── ŞABLON (asıl yol) ───────────────────────────────────────────────────
 * Gövde: { tenantId, telefon, sablon, parametreler[] }. Şablon yalnız
 * MAGAZA_SABLONLARI'ndan (lib/whatsapp-sablon-magaza); değişken sayısı metinden
 * sayılır, değerler tek satıra indirilir. Mesajlar tek platform numarasından
 * gidiyor ve alıcıların hiçbiri o numarayla yazışmıyor: 24 saat penceresi hep
 * kapalı, serbest metin Meta'da önce kabul edilip sonra düşüyordu (#131047).
 *
 * ── METİN (yalnız geriye uyum) ──────────────────────────────────────────
 * { metin } eski mağaza sürümünün gövdesi. Mağaza yeniden yayınlanana kadar
 * kırılmasın diye duruyor; pencere açık değilse Meta yine düşürür.
 *
 * ── GÖNDERMEDEN ÖNCE ────────────────────────────────────────────────────
 *  · demo bayi → 403 (herkese açık demo mağazadan rastgele numaraya mesaj
 *    gitmesin; platform numarasının kalitesi bütün bayilerin);
 *  · alıcı "DUR" yazmış → 409 (lib/whatsapp-inbound retliMi);
 *  · aynı alıcıya bu bayiden 24 saatte 10 mesaj → 429 (döngü ya da kötüye
 *    kullanım tek numarayı yakmasın).
 *
 * ── KAYIT ───────────────────────────────────────────────────────────────
 * Her deneme NotificationLog'a düşer: alıcı tek biçimde (90…), Meta mesaj
 * kimliği (waMessageId) ile. Meta'nın SONRADAN gönderdiği teslim/okundu/
 * iletilemedi bildirimi bu kimlikle kayda işlenir (whatsapp-inbound durumIsle)
 * ve mağaza alıcısının cevabı bu kayıttan doğru bayiye yönlenir
 * (numaraninBayileri: son 30 günde bu numaraya WHATSAPP/SENT yazan bayi).
 *
 * ── YAN ETKİSİZ YOKLAMA ─────────────────────────────────────────────────
 * Mağaza kanalın açık olup olmadığını { tenantId } gövdesiyle sorar: önce
 * yapılandırma (503), sonra gövde (400). Bu sıra bilerek: 400 "kanal açık".
 */
const GUNLUK_SINIR = 10;

/**
 * Hata yanıtı: { error, kod }. Bu ucu yalnız mağaza SUNUCUSU çağırıyor ve
 * cümleyi bayinin paneline Türkçe yazıyor; ucHatasi'nin dil çerezi burada yok
 * (istek bir tarayıcıdan gelmiyor). Kodlar eskisiyle aynı.
 */
const hata = (durum: number, error: string, kod: string) => NextResponse.json({ error, kod }, { status: durum });

type Govde = { tenantId?: unknown; telefon?: unknown; sablon?: unknown; parametreler?: unknown; metin?: unknown };

export async function POST(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  if (!waOutConfigured()) {
    return hata(503, 'WhatsApp giden ayarlı değil (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)', 'WHATSAPP_GIDEN_AYARLI_DEGIL_WHATSAPP');
  }

  let body: Govde;
  try {
    body = (await req.json()) as Govde;
  } catch {
    return hata(400, 'İstek gövdesi okunamadı', 'GECERSIZ_ISTEK');
  }

  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
  const telefon = typeof body.telefon === 'string' ? body.telefon : '';
  if (!tenantId || !telefon)
    return NextResponse.json({ error: 'tenantId ve telefon zorunlu' }, { status: 400 });

  // ── Ne gönderilecek: şablon (asıl) ya da serbest metin (geriye uyum) ──
  let gonderi: { tur: 'sablon'; ad: string; dil: string; degiskenler: string[]; kayit: string } | { tur: 'metin'; metin: string };
  if (body.sablon !== undefined) {
    const sablon = magazaSablonu(body.sablon);
    if (!sablon) return NextResponse.json({ error: 'Bilinmeyen şablon', kod: 'SABLON_BILINMIYOR' }, { status: 400 });
    const beklenen = degiskenSayisi(sablon.metin);
    if (!Array.isArray(body.parametreler) || body.parametreler.length !== beklenen)
      return NextResponse.json(
        { error: `Şablon ${beklenen} değişken bekliyor`, kod: 'DEGISKEN_SAYISI' },
        { status: 400 }
      );
    const degiskenler = body.parametreler.map(degiskenTemizle);
    const kayit = sablonMetni(sablon, degiskenler);
    if (kayit.length > GOVDE_AZAMI)
      return NextResponse.json({ error: 'Mesaj değişkenlerle birlikte çok uzun', kod: 'GOVDE_UZUN' }, { status: 400 });
    gonderi = { tur: 'sablon', ad: sablon.ad, dil: sablon.dil, degiskenler, kayit };
  } else if (typeof body.metin === 'string' && body.metin.trim()) {
    gonderi = { tur: 'metin', metin: body.metin.trim() };
  } else {
    return NextResponse.json({ error: 'sablon ya da metin zorunlu' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, isActive: true, isSuspended: false, deletedAt: null },
    select: { id: true, demo: true },
  });
  if (!tenant) return hata(404, 'Bayi bulunamadı veya askıda', 'BAYI_BULUNAMADI_VEYA_ASKIDA');
  if (tenant.demo) return NextResponse.json({ error: 'Demo hesapta WhatsApp gönderilmez', kod: 'DEMO' }, { status: 403 });

  // Numara tek biçime indirgenir: "0532 111 22 33" ve "+90 532 111 2233"
  // aynı hattır. Meta yalnız 90XXXXXXXXXX biçimini kabul eder.
  const hedef = waApiPhone(telefon);
  if (!hedef) return hata(400, 'Geçersiz telefon numarası', 'GECERSIZ_TELEFON_NUMARASI');

  if (await retliMi(tenant.id, hedef))
    return NextResponse.json({ error: 'Alıcı WhatsApp mesajlarını durdurmuş (DUR)', kod: 'RET' }, { status: 409 });

  const gun = new Date(Date.now() - 86_400_000);
  const bugun = await prisma.notificationLog.count({
    where: { tenantId: tenant.id, channel: 'WHATSAPP', recipient: hedef, createdAt: { gte: gun } },
  });
  if (bugun >= GUNLUK_SINIR)
    return NextResponse.json(
      { error: `Bu numaraya 24 saatte ${GUNLUK_SINIR} mesaj sınırı doldu`, kod: 'SINIR' },
      { status: 429 }
    );

  const r =
    gonderi.tur === 'sablon'
      ? await metaPost(`${process.env.WHATSAPP_PHONE_ID}/messages`, {
          messaging_product: 'whatsapp',
          to: hedef,
          type: 'template',
          template: {
            name: gonderi.ad,
            language: { code: gonderi.dil },
            components: [{ type: 'body', parameters: gonderi.degiskenler.map((text) => ({ type: 'text', text })) }],
          },
        })
      : await sendText(hedef, gonderi.metin);
  const mesajId = r.ok ? (r.id ?? null) : null;

  // Gönderim izi servis-takip'in kendi bildirim günlüğüne düşer: bayi
  // "mağaza bana haber verdi mi" sorusunu tek yerden yanıtlayabilsin.
  await prisma.notificationLog
    .create({
      data: {
        tenantId: tenant.id,
        channel: 'WHATSAPP',
        status: r.ok ? 'SENT' : 'FAILED',
        sentAt: r.ok ? new Date() : null,
        recipient: hedef,
        message: (gonderi.tur === 'sablon' ? `[${gonderi.ad}] ${gonderi.kayit}` : gonderi.metin).slice(0, 1000),
        error: r.ok ? null : (r.error ?? '').slice(0, 500),
        waMessageId: mesajId,
      },
    })
    .catch(() => {
      /* günlük yazılamazsa gönderim yine de geçerlidir; sessiz geç */
    });

  if (!r.ok) return NextResponse.json({ error: r.error ?? 'Gönderilemedi' }, { status: 502 });
  return NextResponse.json({ ok: true, mesajId });
}

/**
 * GET /api/shop/bildirim?tenantId=… — mağaza panelinin "gitti mi, ulaştı mı"
 * özeti: son 7 günün WhatsApp gönderimleri (teslim ve okundu Meta'nın durum
 * bildiriminden), son 5 hata (alıcı numarası maskeli) ve mağaza şablonlarının
 * Meta'daki onay durumu (WABA kimliği tanımlıysa; 10 dakika saklanır).
 */
export async function GET(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  const tenantId = new URL(req.url).searchParams.get('tenantId') ?? '';
  if (!tenantId) return NextResponse.json({ error: 'tenantId zorunlu' }, { status: 400 });

  const yedi = new Date(Date.now() - 7 * 86_400_000);
  const w = { tenantId, channel: 'WHATSAPP' as const, createdAt: { gte: yedi } };
  const [gonderilen, teslim, okundu, basarisiz, hatalar, sablonlar] = await Promise.all([
    prisma.notificationLog.count({ where: w }),
    prisma.notificationLog.count({ where: { ...w, teslimAt: { not: null } } }),
    prisma.notificationLog.count({ where: { ...w, okunduAt: { not: null } } }),
    prisma.notificationLog.count({ where: { ...w, status: 'FAILED' } }),
    prisma.notificationLog.findMany({
      where: { ...w, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { createdAt: true, recipient: true, error: true },
    }),
    sablonDurumlari(),
  ]);

  return NextResponse.json({
    gonderilen,
    teslim,
    okundu,
    basarisiz,
    sonHatalar: hatalar.map((h) => ({
      zaman: h.createdAt.toISOString(),
      alici: maskele(h.recipient),
      hata: (h.error ?? 'bilinmeyen hata').slice(0, 200),
    })),
    sablonlar,
  });
}

/** "905321234567" → "0532 *** 45 67": panelde kimin olduğu sezilir, numara okunmaz. */
function maskele(no: string): string {
  const d = no.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `0${d.slice(0, 3)} *** ${d.slice(6, 8)} ${d.slice(8)}` : '***';
}

/**
 * MAĞAZA ŞABLONLARININ META DURUMU — ad → APPROVED | PENDING | REJECTED …
 * WABA kimliği yoksa ya da Meta cevap vermezse null ("bilinmiyor"): panel bu
 * durumda şablon uyarısı göstermez, yanlış alarm vermez.
 */
let sablonOnbellek: { zaman: number; veri: Record<string, string> | null } | null = null;
const SABLON_ONBELLEK_MS = 10 * 60_000;

async function sablonDurumlari(): Promise<Record<string, string> | null> {
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!waba || !process.env.WHATSAPP_TOKEN) return null;
  if (sablonOnbellek && Date.now() - sablonOnbellek.zaman < SABLON_ONBELLEK_MS) return sablonOnbellek.veri;
  const adlar = new Set<string>(Object.values(MAGAZA_SABLONLARI).map((s) => s.ad));
  const r = await metaGet(`${encodeURIComponent(waba)}/message_templates?fields=name,status,language&limit=200`);
  let veri: Record<string, string> | null = null;
  if (r.ok) {
    veri = {};
    for (const t of (r.veri?.data ?? []) as { name?: string; status?: string; language?: string }[]) {
      if (t.name && adlar.has(t.name) && (t.language ?? 'tr') === 'tr' && t.status) veri[t.name] = t.status;
    }
  }
  sablonOnbellek = { zaman: Date.now(), veri };
  return veri;
}
