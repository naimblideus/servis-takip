import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// POST /api/auth/2fa/check  { email, password } -> { needsTotp: boolean }
// Giriş ekranı, kod alanını göstermesi GEREKİP gerekmediğini buradan öğrenir.
// GÜVENLİK: şifre doğrulanmadan asla bilgi vermez (hesap var mı sızdırmaz) ve oturum AÇMAZ.
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ needsTotp: false });
    const eposta = String(email).trim().toLowerCase().slice(0, 200);

    // IP + e-posta: toplantı salonunda herkes aynı otel IP'sinde; yalnız IP'ye
    // bağlı sınır dakikada 10 kişiden sonra 2FA sorusunu atlatıyordu.
    const rl = rateLimit(`2fa-check:${clientIp(req)}:${eposta}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json(tooMany(rl.retryAfter), { status: 429 });

    // Giriş (lib/auth) ile aynı eşleşme: büyük/küçük harf duyarsız, ILIKE değil.
    const satir = await prisma.$queryRaw<{ passwordHash: string; totpEnabled: boolean }[]>`
      SELECT "passwordHash", "totpEnabled" FROM "User" WHERE lower("email") = ${eposta} AND "isActive" = true LIMIT 1`;
    const user = satir[0];
    // Kullanıcı yoksa da aynı cevabı ver — hesap varlığı sızmasın
    if (!user) return NextResponse.json({ needsTotp: false });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return NextResponse.json({ needsTotp: false });

    return NextResponse.json({ needsTotp: !!user.totpEnabled });
  } catch {
    return NextResponse.json({ needsTotp: false });
  }
}
