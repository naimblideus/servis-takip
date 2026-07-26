import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// POST /api/auth/2fa/check  { email, password } -> { needsTotp: boolean }
// Giriş ekranı, kod alanını göstermesi GEREKİP gerekmediğini buradan öğrenir.
// GÜVENLİK: şifre doğrulanmadan asla bilgi vermez (hesap var mı sızdırmaz) ve oturum AÇMAZ.
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`2fa-check:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json(tooMany(rl.retryAfter), { status: 429 });

    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ needsTotp: false });

    const user = await prisma.user.findFirst({
      where: { email: String(email), isActive: true },
      select: { passwordHash: true, totpEnabled: true },
    });
    // Kullanıcı yoksa da aynı cevabı ver — hesap varlığı sızmasın
    if (!user) return NextResponse.json({ needsTotp: false });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return NextResponse.json({ needsTotp: false });

    return NextResponse.json({ needsTotp: !!user.totpEnabled });
  } catch {
    return NextResponse.json({ needsTotp: false });
  }
}
