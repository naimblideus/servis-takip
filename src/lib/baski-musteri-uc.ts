// MÜŞTERİYE AÇIK MATBAA UÇLARI (/api/b/*) — ortak kapı.
//
// Bu uçlara giren kişinin oturumu yok. Kim olduğu iki şeyden anlaşılır:
// matbaanın kısa adı (hangi işletme) ve işin jetonu (hangi iş). İkisi de
// her istekte veritabanından doğrulanır; kiracı kimliği ASLA istekten
// okunmaz. Hız sınırı IP başına: jeton denemesi ve depoyu doldurma pahalı olsun.
import type { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { istemciIp } from '@/lib/istemci-ip';
import { dilMi, type Dil } from '@/lib/i18n/sozluk';
import { jetonGecerli } from '@/lib/matbaa-ayar';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { baskiHatasi } from '@/lib/matbaa-uc';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import type { Yukleyen } from '@/lib/baski-dosya-kayit';

export interface Sinir { ad: string; adet: number; dakika: number }

/** IP başına sınır aşıldıysa true. Yerelde IP yoksa sınır uygulanmaz. */
export function sinirAsildi(req: Request, s: Sinir): boolean {
  const ip = istemciIp(req);
  return !!ip && !rateLimit(`b:${s.ad}:${ip}`, s.adet, s.dakika * 60_000).ok;
}

export const matbaaDili = (locale: string | null | undefined): Dil => (dilMi(locale) ? locale : 'tr');

type Red = { ok: false; yanit: Promise<NextResponse> };

/** Kısa ad + jeton → iş. Bulunamazsa, işletme kapalıysa ya da sınır aşıldıysa ret. */
export async function musteriIsi(req: Request, g: { kisaAd?: unknown; jeton?: unknown }, s: Sinir) {
  const m = await kisaAddanMatbaa(String(g.kisaAd ?? ''));
  const dil = matbaaDili(m?.tenant.locale);
  if (sinirAsildi(req, s)) return { ok: false, yanit: baskiHatasi('COK_ISTEK', dil) } satisfies Red;
  if (!m || !jetonGecerli(g.jeton)) return { ok: false, yanit: baskiHatasi('IS_YOK', dil) } satisfies Red;
  const is = await prisma.baskiIsi.findFirst({ where: { jeton: g.jeton, tenantId: m.tenant.id }, select: { id: true, durum: true } });
  if (!is) return { ok: false, yanit: baskiHatasi('IS_YOK', dil) } satisfies Red;
  return { ok: true as const, tenantId: m.tenant.id, isId: is.id, durum: is.durum, dil, matbaa: m };
}

/**
 * Dosya uçlarının çağıranı: gövdede `isId` varsa PERSONEL (oturum ve matbaa
 * kapısı; AuthError rotada yakalanır), yoksa MÜŞTERİ (kısa ad + jeton).
 */
export async function dosyaCagirani(req: Request, g: Record<string, unknown>, s: Sinir):
  Promise<Red | { ok: true; tenantId: string; isId: string; kim: Yukleyen; dil?: Dil }> {
  if (typeof g.isId === 'string' && g.isId) {
    const { user, tenantId } = await requireMatbaaUser();
    return { ok: true, tenantId, isId: g.isId, kim: { tur: 'PERSONEL', ad: user.name } };
  }
  const r = await musteriIsi(req, g, s);
  if (!r.ok) return r;
  return { ok: true, tenantId: r.tenantId, isId: r.isId, kim: { tur: 'MUSTERI' }, dil: r.dil };
}
