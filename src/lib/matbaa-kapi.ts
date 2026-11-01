// MATBAA KAPISI — baskı merkezi uçlarının sunucu denetimi.
//
// Menüde gizlemek yetkilendirme değildir. Bayi modüllerinin çoğu bugün yalnız
// arayüzde gizleniyor; matbaa uçları baştan sunucuda kiracı türüne bakar:
// bayinin bir kullanıcısı adresi elle yazsa da baskı işi açamaz, okuyamaz.
//
// Tür oturum jetonunda DEĞİL (lib/menu-aileleri): her çağrıda kiracı kaydından
// okunur. Süper admin türü değiştirdiğinde eski oturum bir an bile yanlış
// kapıdan geçmez.
import { prisma } from '@/lib/prisma';
import { AuthError, requireTenantUser } from '@/lib/api-auth';
import { hesapTuru, type HesapTuru } from '@/lib/menu-aileleri';

/** Kiracının hesap türü. Kiracı yoksa BAYI (matbaa kapısı kapalı kalır). */
export async function kiraciTuru(tenantId: string | null | undefined): Promise<HesapTuru> {
  if (!tenantId) return 'BAYI';
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { hesapTuru: true } });
  return hesapTuru(t?.hesapTuru);
}

type Rol = 'ADMIN' | 'FRONT_DESK' | 'TECHNICIAN';

/**
 * Oturumdaki kullanıcı bir MATBAA kiracısında mı ve rolü yetiyor mu?
 * Değilse AuthError (403); rota catch'inde authErrorResponse ile döner.
 *
 * `roller` verilmezse matbaanın her personeli geçer. SUPER_ADMIN (destek için
 * giren) her zaman yönetici sayılır.
 */
export async function requireMatbaaUser(roller?: readonly Rol[]) {
  const r = await requireTenantUser();
  if ((await kiraciTuru(r.tenantId)) !== 'MATBAA') {
    throw new AuthError(403, 'Bu uç yalnız baskı merkezi hesabında çalışır.');
  }
  const rol = r.user.role === 'SUPER_ADMIN' ? 'ADMIN' : r.user.role;
  if (roller && !roller.includes(rol as Rol)) {
    throw new AuthError(403, 'Bu işlem için yetkiniz yok.');
  }
  return r;
}
