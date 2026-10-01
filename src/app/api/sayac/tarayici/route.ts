import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { dilMi } from '@/lib/i18n/sozluk';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { taramaGovdesiAyikla } from '@/lib/sayac-tarama';
import { anahtarlaBayi, taramaKaydet, sonTaramalar, cihazDurumlari, tarayanBilgisayarlar } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/** Bir müşteri ağındaki taramanın gövdesi için bol bir üst sınır. */
const AZAMI_BOYUT = 2_000_000;
/**
 * Bir bayinin saatte gönderebileceği en fazla tarama. Tarayıcı dosyası
 * müşterinin bilgisayarında duruyor; anahtar sızarsa biri tabloyu
 * doldurmaya çalışabilir. Gerçek kullanım saatte birkaçı geçmez.
 */
const SAATLIK_SINIR = 30;

/**
 * POST /api/sayac/tarayici — tarayıcı taramasını gönderir.
 *
 * Oturum YOK: tarayıcı müşterinin bilgisayarında çalışıyor. Kimlik bayinin
 * tarayıcı anahtarı (Authorization: Bearer nst_…). Anahtarın yalnız özeti
 * veritabanında; eşleşmezse hiçbir şey kaydedilmez.
 *
 * Yanıt KOD taşır, cümle değil (durum: YAZILABILIR, ESLESMEDI...). Cümleyi
 * tarayıcı kendi dilinde kurar; tek istisna hata yanıtı (x-dil başlığı).
 */
export async function POST(req: Request) {
  const istenen = req.headers.get('x-dil');
  const secenek = dilMi(istenen) ? { dil: istenen } : undefined;

  const yetki = req.headers.get('authorization') ?? '';
  const anahtar = yetki.startsWith('Bearer ') ? yetki.slice(7).trim() : null;
  const bayi = await anahtarlaBayi(anahtar);
  if (!bayi) return ucHatasi('TARAYICI_ANAHTARI_GECERSIZ', 401, secenek);
  if (!bayi.isActive || bayi.isSuspended || bayi.deletedAt) return ucHatasi('TARAYICI_BAYI_KAPALI', 403, secenek);

  if (Number(req.headers.get('content-length') ?? 0) > AZAMI_BOYUT) return ucHatasi('TARAMA_GOVDESI_GECERSIZ', 413, secenek);
  const metin = await req.text();
  if (metin.length > AZAMI_BOYUT) return ucHatasi('TARAMA_GOVDESI_GECERSIZ', 413, secenek);

  const sonSaat = await prisma.sayacTaramasi.count({
    where: { tenantId: bayi.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (sonSaat >= SAATLIK_SINIR) return ucHatasi('TARAMA_SINIRI', 429, secenek);

  let ham: unknown;
  try { ham = JSON.parse(metin); } catch { return ucHatasi('TARAMA_GOVDESI_GECERSIZ', 400, secenek); }
  const govde = taramaGovdesiAyikla(ham);
  if (!govde) return ucHatasi('TARAMA_GOVDESI_GECERSIZ', 400, secenek);

  const { id, ozet, sonuclar } = await taramaKaydet(bayi.id, govde, bayi.tarayiciOtomatikYaz);
  return NextResponse.json({
    ok: true,
    tarama: id,
    otomatik: bayi.tarayiciOtomatikYaz,
    ozet,
    cihazlar: sonuclar.map((s) => ({ ip: s.ip, marka: s.marka, model: s.model, seri: s.seri, durum: s.durum, sebep: s.sebep })),
  });
}

/** GET /api/sayac/tarayici — panel: cihaz durumu, tarayan bilgisayarlar, son taramalar (yalnız yönetici). */
export async function GET() {
  try {
    const { tenantId } = await requireAdminUser();
    const [liste, durum, bilgisayarlar] = await Promise.all([
      sonTaramalar(tenantId), cihazDurumlari(tenantId), tarayanBilgisayarlar(tenantId),
    ]);
    return NextResponse.json({ ...liste, durum, bilgisayarlar });
  } catch (e) {
    return authErrorResponse(e);
  }
}
