import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { generateSecret, otpauthURI, verifyTOTP, generateRecoveryCodes, hashRecoveryCode } from '@/lib/totp';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

// GET /api/auth/2fa — mevcut durum
export async function GET() {
  try {
    const { user } = await requireTenantUser();
    return NextResponse.json({
      enabled: user.totpEnabled,
      recoveryLeft: (user.recoveryCodes || []).length,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// POST /api/auth/2fa — { action: 'setup' | 'enable' | 'disable' }
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireTenantUser();
    const body = await req.json();
    const action = body?.action;

    // ── 1) KURULUM: gizli anahtar üret + QR döndür (HENÜZ etkin değil) ──
    if (action === 'setup') {
      if (user.totpEnabled) {
        return NextResponse.json({ error: 'İki adımlı doğrulama zaten açık' }, { status: 400 });
      }
      const secret = generateSecret();
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
      const uri = otpauthURI({
        secret,
        account: user.email,
        issuer: `Nexus Servis${tenant?.name ? ` (${tenant.name})` : ''}`,
      });
      // Anahtarı sakla ama ETKİNLEŞTİRME — kullanıcı kodu doğrulayınca açılır
      await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });
      const qr = await QRCode.toDataURL(uri, { width: 260, margin: 1 });
      return NextResponse.json({ qr, secret, uri });
    }

    // ── 2) ETKİNLEŞTİR: kodu doğrula, kurtarma kodlarını üret ──
    if (action === 'enable') {
      if (!user.totpSecret) {
        return NextResponse.json({ error: 'Önce kurulumu başlatın' }, { status: 400 });
      }
      const counter = verifyTOTP(user.totpSecret, body?.code, { lastCounter: user.totpLastCounter });
      if (counter == null) {
        return NextResponse.json({ error: 'Kod doğrulanamadı. Uygulamadaki güncel kodu girin.' }, { status: 400 });
      }
      const codes = generateRecoveryCodes(8);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totpEnabled: true,
          totpLastCounter: counter,
          recoveryCodes: codes.map(hashRecoveryCode),
        },
      });
      // Kurtarma kodları YALNIZ BU YANITTA açık gösterilir (veritabanında yalnız özeti var)
      return NextResponse.json({ ok: true, recoveryCodes: codes });
    }

    // ── 3) KAPAT: şifre + güncel kod ister (çalınan oturum kapatamasın) ──
    if (action === 'disable') {
      if (!user.totpEnabled) return NextResponse.json({ error: 'Zaten kapalı' }, { status: 400 });
      const okPass = await bcrypt.compare(String(body?.password || ''), user.passwordHash);
      if (!okPass) return NextResponse.json({ error: 'Şifre hatalı' }, { status: 400 });
      const counter = verifyTOTP(user.totpSecret || '', body?.code, { lastCounter: user.totpLastCounter });
      if (counter == null) return NextResponse.json({ error: 'Kod doğrulanamadı' }, { status: 400 });

      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null, totpLastCounter: null, recoveryCodes: [] },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
