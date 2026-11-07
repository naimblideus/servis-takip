import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { istemciIp } from '@/lib/istemci-ip';
import { rateLimit } from '@/lib/rate-limit';
import { davetiKullan } from '@/lib/kullanici-davet';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/davet { jeton, sifre } — davet bağlantısıyla şifre belirleme.
 *
 * Oturumsuz uç: kimliği jetonun kendisi taşır (tek kullanımlık, 7 gün).
 * Başarıda giriş adı döner; giriş istemcide yeni şifreyle yapılır.
 * Geçersiz jetonun nedeni söylenmez. IP başına 15 dakikada 10 deneme.
 */
export async function POST(req: Request) {
  const ip = istemciIp(req) ?? 'bilinmiyor';
  if (!rateLimit(`davet:${ip}`, 10, 15 * 60_000).ok) return ucHatasi('COK_FAZLA_ISTEK_LUTFEN_BIRAZ', 429);

  const govde = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const s = await davetiKullan(govde?.jeton, govde?.sifre);
  if (!s.ok) return s.hata === 'SIFRE_KISA' ? ucHatasi('KAYIT_SIFRE_KISA', 400) : ucHatasi('DAVET_GECERSIZ', 400);

  await writeAudit({
    tenantId: s.bilgi.tenantId,
    userId: s.bilgi.userId,
    action: 'DAVET_KULLANILDI',
    entityType: 'User',
    entityId: s.bilgi.userId,
    newValue: { giris: s.bilgi.giris },
    ipAddress: ip,
  });
  return NextResponse.json({ ok: true, giris: s.bilgi.giris });
}
