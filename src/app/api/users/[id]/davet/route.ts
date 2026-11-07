import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { oturumKullanicisi } from '@/lib/api-auth';
import { davetOlustur } from '@/lib/kullanici-davet';
import { writeAudit } from '@/lib/audit';

/**
 * POST /api/users/[id]/davet — daveti yeniden gönder.
 *
 * Kişi bağlantıyı kaybettiyse ya da 7 gün geçtiyse yönetici yeni bağlantı
 * üretir; eski bağlantılar ölür. Yalnız yönetici, yalnız kendi bayisindeki ve
 * şifresini henüz belirlememiş (davetBekliyor) kişi için. Şifresi olan kişinin
 * şifresini bu uç değiştiremez: o iş kullanıcı düzenlemede.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await oturumKullanicisi(session);
  if (!me || me.role !== 'ADMIN') return ucHatasi('SADECE_YONETICILER_KULLANICI_EKLEYEBILIR', 403);

  const { id } = await params;
  const [hedef, bayi] = await Promise.all([
    prisma.user.findFirst({ where: { id, tenantId: me.tenantId }, select: { id: true, name: true, email: true, isActive: true, davetBekliyor: true } }),
    prisma.tenant.findUnique({ where: { id: me.tenantId }, select: { name: true, demo: true } }),
  ]);
  if (!hedef || !hedef.isActive) return ucHatasi('KULLANICI_BULUNAMADI', 404);
  if (bayi?.demo) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
  if (!hedef.davetBekliyor) return ucHatasi('DAVET_BEKLEYEN_YOK', 409);

  const d = await davetOlustur({ tenantId: me.tenantId, userId: hedef.id, olusturanAd: me.name });
  await writeAudit({
    tenantId: me.tenantId,
    userId: me.id,
    action: 'DAVET_YENIDEN_GONDERILDI',
    entityType: 'User',
    entityId: hedef.id,
    newValue: { ad: hedef.name, giris: hedef.email, bitis: d.bitis.toISOString() },
  });
  return NextResponse.json({ ok: true, ad: hedef.name, giris: hedef.email, baglanti: d.baglanti, bitis: d.bitis.toISOString(), firma: bayi?.name ?? '' });
}
