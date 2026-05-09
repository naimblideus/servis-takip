import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Güvenlik için basit bir token kontrolü
  const { searchParams } = new URL(req.url);
  if (searchParams.get('token') !== '170305') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hash = await bcrypt.hash('admin170305', 10);
    
    // 1. "SAYGILI FOTOKOPİ" firmasını bul
    const saygiliTenant = await prisma.tenant.findFirst({
      where: { name: { contains: "SAYGILI FOTOKOPİ" } }
    });

    if (!saygiliTenant) {
      return NextResponse.json({ error: 'SAYGILI FOTOKOPİ firması veritabanında bulunamadı.' }, { status: 404 });
    }

    // 2. Çakışmayı önlemek için, SAYGILI FOTOKOPİ HARİCİNDEKİ tüm "admin@demo.com" kullanıcılarının mailini değiştir
    await prisma.user.updateMany({
      where: { 
        email: 'admin@demo.com',
        NOT: { tenantId: saygiliTenant.id }
      },
      data: { email: 'eski-demo-admin@demo.com' }
    });

    // 3. SAYGILI FOTOKOPİ için yetkili Admin'i bul
    const adminUser = await prisma.user.findFirst({
      where: { tenantId: saygiliTenant.id, role: 'ADMIN' }
    });

    if (adminUser) {
      // Bilgilerini admin@demo.com ve şifresini admin170305 yap
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { email: 'admin@demo.com', passwordHash: hash, isActive: true }
      });
      return NextResponse.json({ 
        success: true, 
        message: "Harika! SAYGILI FOTOKOPİ hesabının giriş bilgileri admin@demo.com ve şifresi admin170305 olarak güncellendi." 
      });
    }

    return NextResponse.json({ success: false, error: "Firmaya ait Admin kullanıcısı bulunamadı." });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
