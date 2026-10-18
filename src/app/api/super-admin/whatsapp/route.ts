import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { metaGet, metaPost, GRAPH_SURUM } from '@/lib/whatsapp-graph';
import { SABLONLAR } from '@/lib/whatsapp-sablon';
import { MAGAZA_SABLONLARI } from '@/lib/whatsapp-sablon-magaza';
import { waApiPhone } from '@/lib/whatsapp';
import { sendText } from '@/lib/whatsapp-out';
import { saglikListesi, genelDurum, maskele, type MetaSablon } from '@/lib/whatsapp-saglik';
import { rateLimit } from '@/lib/rate-limit';
import { ucHatasi } from '@/lib/uc-hata';

/**
 * WHATSAPP KURULUM DURUMU — süper admin.
 *
 * GET  → kontrol listesi + gizli olmayan gerçekler (numara adı, kalite, şablon durumları).
 * POST → tek test mesajı (hello_world / borc / sayac / metin).
 *
 * ⚠️ Jeton, uygulama sırrı ve doğrulama jetonunun DEĞERİ hiçbir cevaba ve
 * günlüğe girmez — yalnız var/yok (!!). Numara ve WABA kimliği gizli değil
 * ama yine de son 4 hanesiyle döner. test-whatsapp-saglik kaynakta bunu sınar.
 */
export const dynamic = 'force-dynamic';

const TELEFON_ALANLARI = 'display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type,throughput';
const SABLON_ALANLARI = 'name,status,language,category,components,rejected_reason';

export async function GET() {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const env = {
    token: !!process.env.WHATSAPP_TOKEN,
    phoneId: !!process.env.WHATSAPP_PHONE_ID,
    appSecret: !!process.env.WHATSAPP_APP_SECRET,
    verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    wabaId: !!process.env.WHATSAPP_WABA_ID,
    template: process.env.WHATSAPP_TEMPLATE || null,
    templateSayac: process.env.WHATSAPP_TEMPLATE_SAYAC || null,
    lang: process.env.WHATSAPP_LANG || null,
  };
  const phoneId = process.env.WHATSAPP_PHONE_ID || '';
  const wabaId = process.env.WHATSAPP_WABA_ID || '';

  // Meta'ya yalnız jeton + kimlik varsa gidilir; yoksa madde "bekliyor" kalır.
  const [telefon, sablonCevap, sonGelen, sonTeslim, sonOkundu, sonHatalar] = await Promise.all([
    env.token && phoneId ? metaGet(`${encodeURIComponent(phoneId)}?fields=${TELEFON_ALANLARI}`) : Promise.resolve(null),
    env.token && wabaId ? metaGet(`${encodeURIComponent(wabaId)}/message_templates?fields=${SABLON_ALANLARI}&limit=200`) : Promise.resolve(null),
    prisma.whatsAppMessage.findFirst({ where: { yon: 'GELEN' }, orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }),
    prisma.notificationLog.findFirst({ where: { channel: 'WHATSAPP', teslimAt: { not: null } }, orderBy: { teslimAt: 'desc' }, select: { teslimAt: true } }),
    prisma.notificationLog.findFirst({ where: { channel: 'WHATSAPP', okunduAt: { not: null } }, orderBy: { okunduAt: 'desc' }, select: { okunduAt: true } }),
    prisma.notificationLog.findMany({
      where: { channel: 'WHATSAPP', status: 'FAILED', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      orderBy: { createdAt: 'desc' }, take: 20, select: { error: true, createdAt: true },
    }),
  ]);

  const sablonlar = sablonCevap
    ? sablonCevap.ok
      ? { ok: true as const, liste: (Array.isArray(sablonCevap.veri?.data) ? sablonCevap.veri.data : []) as MetaSablon[] }
      : sablonCevap
    : null;
  const durumAnlari = [sonTeslim?.teslimAt, sonOkundu?.okunduAt].filter(Boolean) as Date[];
  const sonDurum = durumAnlari.length ? new Date(Math.max(...durumAnlari.map((d) => d.getTime()))) : null;

  const liste = saglikListesi({
    env, telefon, sablonlar,
    sonGelen: sonGelen?.receivedAt ?? null, sonDurum, sonHatalar,
  });

  // Ekranda gösterilecek gizli olmayan özet (Meta cevabından yalnız seçili alanlar).
  const v: Record<string, any> = telefon && telefon.ok ? telefon.veri : {};
  const bizimAdlar = new Set([
    env.template || SABLONLAR.borc.ad,
    env.templateSayac || SABLONLAR.sayac.ad,
    ...Object.values(MAGAZA_SABLONLARI).map((s) => s.ad),
    'hello_world',
  ]);
  return NextResponse.json({
    genel: genelDurum(liste),
    liste,
    gercekler: {
      env,
      phoneIdMaske: maskele(phoneId),
      wabaIdMaske: maskele(wabaId),
      graphSurum: GRAPH_SURUM,
      numara: telefon && telefon.ok ? {
        gorunen: v.display_phone_number ?? null,
        ad: v.verified_name ?? null,
        kalite: v.quality_rating ?? null,
        kodDogrulama: v.code_verification_status ?? null,
        adDurumu: v.name_status ?? null,
        limit: v.messaging_limit_tier ?? null,
        platform: v.platform_type ?? null,
        hiz: v.throughput?.level ?? null,
      } : null,
      sablonlar: sablonlar && sablonlar.ok
        ? sablonlar.liste.filter((x) => bizimAdlar.has(x.name)).map((x) => ({ ad: x.name, dil: x.language ?? null, durum: x.status ?? null, kategori: x.category ?? null }))
        : null,
      sonGelen: sonGelen?.receivedAt ?? null,
      sonDurum,
      hata24s: sonHatalar.length,
    },
    zaman: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

type TestTuru = 'hello_world' | 'borc' | 'sayac' | 'metin';
const TURLER: TestTuru[] = ['hello_world', 'borc', 'sayac', 'metin'];

export async function POST(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Test numarası günlük sınırlı; elle yanlışlıkla seri gönderim numarayı yakmasın.
  const rl = rateLimit(`sa-wa-test:${admin.id}`, 20, 10 * 60_000);
  // Metin sözlükten (dil): uçlarda gömülü Türkçe cümle olmaz (test-uc-hata).
  if (!rl.ok) return ucHatasi('COK_FAZLA_ISTEK_LUTFEN_BIRAZ', 429, { ek: { retryAfter: rl.retryAfter } });

  const govde = await req.json().catch(() => ({}));
  const tur = TURLER.includes(govde?.tur) ? (govde.tur as TestTuru) : null;
  if (!tur) return NextResponse.json({ ok: false, error: 'tur', kod: null }, { status: 400 });
  const no = waApiPhone(typeof govde?.telefon === 'string' ? govde.telefon : '');
  if (!no) return NextResponse.json({ ok: false, error: 'telefon', kod: null }, { status: 400 });

  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!process.env.WHATSAPP_TOKEN || !phoneId) {
    return NextResponse.json({ ok: false, error: 'env', kod: null }, { status: 400 });
  }

  let sonuc: { ok: boolean; id?: string | null; error?: string; kod?: number | null };
  if (tur === 'metin') {
    const metin = typeof govde?.metin === 'string' ? govde.metin.trim().slice(0, 1000) : '';
    if (!metin) return NextResponse.json({ ok: false, error: 'metin', kod: null }, { status: 400 });
    sonuc = await sendText(no, metin);
  } else {
    // hello_world: Meta'nın her test numarasında hazır, onay gerektirmeyen İngilizce şablon.
    const sablon = tur === 'hello_world'
      ? { name: 'hello_world', dil: 'en_US', degerler: [] as string[] }
      : tur === 'borc'
        ? { name: process.env.WHATSAPP_TEMPLATE || SABLONLAR.borc.ad, dil: process.env.WHATSAPP_LANG || 'tr', degerler: SABLONLAR.borc.ornek }
        : { name: process.env.WHATSAPP_TEMPLATE_SAYAC || SABLONLAR.sayac.ad, dil: process.env.WHATSAPP_LANG || 'tr', degerler: SABLONLAR.sayac.ornek };
    sonuc = await metaPost(`${phoneId}/messages`, {
      messaging_product: 'whatsapp',
      to: no,
      type: 'template',
      template: {
        name: sablon.name,
        language: { code: sablon.dil },
        ...(sablon.degerler.length ? { components: [{ type: 'body', parameters: sablon.degerler.map((text) => ({ type: 'text', text })) }] } : {}),
      },
    });
  }

  return NextResponse.json({
    ok: sonuc.ok,
    id: sonuc.ok ? sonuc.id ?? null : null,
    error: sonuc.ok ? null : sonuc.error ?? null,
    kod: sonuc.ok ? null : sonuc.kod ?? null,
  });
}
