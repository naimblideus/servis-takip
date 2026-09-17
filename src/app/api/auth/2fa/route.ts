import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
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
        return ucHatasi('IKI_ADIMLI_DOGRULAMA_ZATEN_ACIK', 400);
      }
      const secret = generateSecret();
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
      const uri = otpauthURI({
        secret,
        account: user.email,
        issuer: `Nextus Servis${tenant?.name ? ` (${tenant.name})` : ''}`,
      });
      // Anahtarı sakla ama ETKİNLEŞTİRME — kullanıcı kodu doğrulayınca açılır
      await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });
      const qr = await QRCode.toDataURL(uri, { width: 260, margin: 1 });
      return NextResponse.json({ qr, secret, uri });
    }

    // ── 2) ETKİNLEŞTİR: kodu doğrula, kurtarma kodlarını üret ──
    if (action === 'enable') {
      if (!user.totpSecret) {
        return ucHatasi('ONCE_KURULUMU_BASLATIN', 400);
      }
      const counter = verifyTOTP(user.totpSecret, body?.code, { lastCounter: user.totpLastCounter });
      if (counter == null) {
        return ucHatasi('KOD_DOGRULANAMADI_UYGULAMADAKI_GUNCEL_KODU', 400);
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
      if (!user.totpEnabled) return ucHatasi('ZATEN_KAPALI', 400);
      const okPass = await bcrypt.compare(String(body?.password || ''), user.passwordHash);
      if (!okPass) return ucHatasi('SIFRE_HATALI', 400);
      const counter = verifyTOTP(user.totpSecret || '', body?.code, { lastCounter: user.totpLastCounter });
      if (counter == null) return ucHatasi('KOD_DOGRULANAMADI', 400);

      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null, totpLastCounter: null, recoveryCodes: [] },
      });
      return NextResponse.json({ ok: true });
    }

    return ucHatasi('GECERSIZ_ISLEM', 400);
  } catch (e) {
    return authErrorResponse(e);
  }
}
