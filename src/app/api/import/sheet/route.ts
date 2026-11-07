import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { sayfaIceAktar } from '@/lib/sayfa-ice-aktar';

// POST /api/import/sheet
//   { csv, mapping?, dryRun }  → dryRun:true = ÖNİZLEME (hiçbir şey yazılmaz)
// Excel'den CSV olarak kaydedilmiş müşteri/cihaz listesini içeri alır.
// Kural lib/sayfa-ice-aktar.ts'te: Nextus kurulum ekibinin bayi adına yüklediği
// dosya (api/super-admin/kurulum/[tenantId]/ice-aktar) AYNI kuraldan geçer.
export async function POST(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return ucHatasi('VERI_AKTARMAK_ICIN_YONETICI_YETKISI', 403, { ek: { kod: 'YETKI' } });
    }

    const { csv, mapping, dryRun } = await req.json();
    const s = await sayfaIceAktar({ tenantId, csv, mapping, dryRun });
    if (!s.ok) return ucHatasi(s.hata, s.durum, { ek: s.ek, deger: s.deger });
    return NextResponse.json(s.govde);
  } catch (e) {
    return authErrorResponse(e);
  }
}
