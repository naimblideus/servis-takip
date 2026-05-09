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
    
    // 1. En çok müşterisi olan firmayı bul (Gerçek hesabı garantilemek için)
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { customers: true }
        }
      }
    });

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ error: 'Hiç firma bulunamadı!' }, { status: 404 });
    }

    const realTenant = tenants.reduce((prev, current) => {
      return (prev._count.customers > current._count.customers) ? prev : current;
    });

    // 2. Çakışmayı önlemek için, bu firma HARİCİNDEKİ tüm "admin@demo.com" kullanıcılarının mailini değiştir
    await prisma.user.updateMany({
      where: { 
        email: 'admin@demo.com',
        NOT: { tenantId: realTenant.id }
      },
      data: { email: 'eski-demo-admin@demo.com' }
    });

    // 3. Asıl firma için yetkili Admin'i bul
    let adminUser = await prisma.user.findFirst({
      where: { tenantId: realTenant.id, role: 'ADMIN' }
    });

    if (!adminUser) {
      adminUser = await prisma.user.findFirst({
         where: { tenantId: realTenant.id }
      });
    }

    if (adminUser) {
      // Bilgilerini admin@demo.com ve şifresini admin170305 yap
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { email: 'admin@demo.com', passwordHash: hash, isActive: true, role: 'ADMIN' }
      });
      return NextResponse.json({ 
        success: true, 
        message: `Harika! En çok müşterisi olan hesap (${realTenant.name}) için giriş bilgileri admin@demo.com ve şifresi admin170305 olarak güncellendi. Artık giriş yapabilirsiniz!` 
      });
    }

    return NextResponse.json({ success: false, error: "Firmaya ait hiçbir kullanıcı bulunamadı." });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
