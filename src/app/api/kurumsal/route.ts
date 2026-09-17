import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import {
  grupListesi, grupRaporu, bostakiMusteriler,
  grupOlustur, grupGuncelle, grupSil, subeEkle, subeCikar,
} from '@/lib/kurumsal-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kurumsal
 *   (parametresiz)                  → grup listesi
 *   ?grup=<id>&donem=YYYY-MM        → grubun dönem raporu
 *   ?grup=<id>&ara=<metin>          → gruba eklenebilecek müşteriler
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const sp = new URL(req.url).searchParams;
    const grupId = sp.get('grup');

    if (grupId && sp.has('ara')) {
      return NextResponse.json({ musteriler: await bostakiMusteriler(tenantId, grupId, sp.get('ara') ?? '') });
    }

    const gruplar = await grupListesi(tenantId);
    if (!grupId) return NextResponse.json({ gruplar });

    const simdi = new Date();
    const donem = sp.get('donem')
      || `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(donem)) return ucHatasi('GECERSIZ_DONEM', 400);

    const rapor = await grupRaporu(tenantId, grupId, donem);
    if (!rapor) return ucHatasi('KAYIT_BULUNAMADI', 404);
    return NextResponse.json({ gruplar, ...rapor });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/kurumsal
 *   { islem: 'grup-ac',   ad, not? }
 *   { islem: 'grup-duzelt', grupId, ad?, not? }
 *   { islem: 'grup-sil',  grupId }      → şubeler silinmez, çatı kalkar
 *   { islem: 'sube-ekle', grupId, musteriId }
 *   { islem: 'sube-cikar', musteriId }
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const b = await req.json().catch(() => ({}));
    const islem = String(b?.islem || '');

    if (islem === 'grup-ac') {
      const ad = String(b?.ad ?? '').trim();
      if (!ad) return ucHatasi('AD_GEREKLI', 400);
      const grup = await grupOlustur(tenantId, ad, b?.not);
      // Aynı ad zaten varsa ikinci grup açılmaz: iki "X Bank" çatısı,
      // raporun hangisinde olduğunu kimsenin bilememesi demek.
      if (!grup) return ucHatasi('AYNI_AD_VAR', 409);
      return NextResponse.json({ ok: true, grup });
    }

    if (islem === 'grup-duzelt') {
      const grupId = String(b?.grupId ?? '');
      if (!grupId) return ucHatasi('KAYIT_BULUNAMADI', 400);
      const sonuc = await grupGuncelle(tenantId, grupId, b?.ad, b?.not);
      if (!sonuc) return ucHatasi('AYNI_AD_VAR', 409);
      return NextResponse.json({ ok: true });
    }

    if (islem === 'grup-sil') {
      const grupId = String(b?.grupId ?? '');
      if (!grupId) return ucHatasi('KAYIT_BULUNAMADI', 400);
      const sonuc = await grupSil(tenantId, grupId);
      if (!sonuc) return ucHatasi('KAYIT_BULUNAMADI', 404);
      return NextResponse.json({ ok: true });
    }

    if (islem === 'sube-ekle') {
      const grupId = String(b?.grupId ?? '');
      const musteriId = String(b?.musteriId ?? '');
      if (!grupId || !musteriId) return ucHatasi('KAYIT_BULUNAMADI', 400);
      const sonuc = await subeEkle(tenantId, grupId, musteriId);
      if (!sonuc) return ucHatasi('KAYIT_BULUNAMADI', 404);
      return NextResponse.json({ ok: true });
    }

    if (islem === 'sube-cikar') {
      const musteriId = String(b?.musteriId ?? '');
      if (!musteriId) return ucHatasi('KAYIT_BULUNAMADI', 400);
      const sonuc = await subeCikar(tenantId, musteriId);
      if (!sonuc) return ucHatasi('KAYIT_BULUNAMADI', 404);
      return NextResponse.json({ ok: true });
    }

    return ucHatasi('BILINMEYEN_ISLEM', 400);
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
