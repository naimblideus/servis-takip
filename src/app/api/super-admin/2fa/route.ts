import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import {
  generateSecret, verifyTOTP, otpauthURI, generateRecoveryCodes, hashRecoveryCode,
} from '@/lib/totp';

/**
 * Süper admin iki adımlı doğrulama.
 *
 * Kullanıcı tarafındaki /api/auth/2fa ile aynı desen; ayrı tutulmasının sebebi
 * süper admin'in ayrı bir tablo ve ayrı bir oturum mekanizması kullanması.
 *
 * setup   → gizli anahtar + QR üretir (HENÜZ açmaz)
 * enable  → kodu doğrular, açar, kurtarma kodlarını BİR KEZ döndürür
 * disable → şifre + güncel kod ister
 */
export async function GET() {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await (prisma as any).superAdmin.findUnique({ where: { id: sa.id } });
  return NextResponse.json({
    enabled: !!admin?.totpEnabled,
    recoveryLeft: (admin?.recoveryCodes || []).length,
  });
}

export async function POST(req: NextRequest) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, code, password } = await req.json();
  const admin = await (prisma as any).superAdmin.findUnique({ where: { id: sa.id } });
  if (!admin) return ucHatasi('HESAP_BULUNAMADI', 404);

  if (action === 'setup') {
    // Anahtar üretilir ama totpEnabled AÇILMAZ: kod doğrulanana kadar kullanıcı
    // kilitlenmemeli (yanlış kurulumda hesaba giremez hale gelmesin).
    const secret = generateSecret();
    await (prisma as any).superAdmin.update({
      where: { id: admin.id }, data: { totpSecret: secret },
    });
    const uri = otpauthURI({ secret, account: admin.email, issuer: 'Nextus Servis — Süper Admin' });
    return NextResponse.json({ secret, qr: await QRCode.toDataURL(uri) });
  }

  if (action === 'enable') {
    if (!admin.totpSecret) return ucHatasi('ONCE_KURULUM_YAPIN', 400);
    if (verifyTOTP(admin.totpSecret, String(code || '')) === null) {
      return ucHatasi('KOD_DOGRULANAMADI', 400);
    }
    // Kurtarma kodları YALNIZCA burada, bir kez döner; veritabanında hash tutulur.
    const codes = generateRecoveryCodes();
    await (prisma as any).superAdmin.update({
      where: { id: admin.id },
      data: { totpEnabled: true, recoveryCodes: codes.map(hashRecoveryCode) },
    });
    return NextResponse.json({ ok: true, recoveryCodes: codes });
  }

  if (action === 'disable') {
    // Kapatmak açmaktan daha tehlikeli: şifre VE güncel kod birlikte istenir.
    if (!(await bcrypt.compare(String(password || ''), admin.password))) {
      return ucHatasi('SIFRE_HATALI', 400);
    }
    if (!admin.totpSecret || verifyTOTP(admin.totpSecret, String(code || '')) === null) {
      return ucHatasi('KOD_DOGRULANAMADI', 400);
    }
    await (prisma as any).superAdmin.update({
      where: { id: admin.id },
      data: { totpEnabled: false, totpSecret: null, totpLastCounter: null, recoveryCodes: [] },
    });
    return NextResponse.json({ ok: true });
  }

  return ucHatasi('BILINMEYEN_ISLEM', 400);
}
