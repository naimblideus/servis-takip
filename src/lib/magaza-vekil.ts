/**
 * MAĞAZA VEKİLİ KAPISI — Servis'in /api/magaza/{ayarlar,logo,siparisler}
 * uçları mağazanın /api/servis/* uçlarına vekildir ve kapıları aynıdır:
 * oturum → yönetici → (yazmada) demo değil + hız sınırı.
 *
 * Yalnız yönetici: ayar mağazanın yasal yüzünü, onay stoğu ve cariyi
 * değiştirir. DEMO okur ama yazamaz: herkese açık demodan canlı bir mağaza
 * değişmesin. Bayinin kimliği oturumdan gelir; istemci başka bayinin
 * kimliğini gönderemez.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

type Kullanici = NonNullable<Awaited<ReturnType<typeof oturumKullanicisi>>>;
type Kapi = { user: Kullanici; hata?: undefined } | { user?: undefined; hata: NextResponse };

const ret = (kod: string, durum: number) => ({ hata: NextResponse.json({ ok: false, kod }, { status: durum }) });

/** `yazma` verilirse demo kapısı ve hız sınırı (kova başına, 10 dakikada `adet`). */
export async function magazaYoneticisi(yazma?: { kova: string; adet: number }): Promise<Kapi> {
  const session = await auth();
  if (!session) return ret('OTURUM', 401);
  const user = await oturumKullanicisi(session);
  if (!user) return ret('OTURUM', 401);
  if (!yoneticiMi(user)) return ret('YETKI', 403);
  if (yazma) {
    const t = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { demo: true } });
    if (!t) return ret('OTURUM', 401);
    if (t.demo) return ret('DEMO', 403);
    if (!rateLimit(`${yazma.kova}:${user.tenantId}`, yazma.adet, 10 * 60_000).ok) return ret('SINIR', 429);
  }
  return { user };
}

/** Mağazanın cevabı (lib/magaza-ayar → magazaYanitiCevir) istemciye. */
export const vekilYaniti = (r: { kod: number; govde: Record<string, unknown> }) =>
  NextResponse.json(r.govde, { status: r.kod, headers: { 'Cache-Control': 'no-store' } });
