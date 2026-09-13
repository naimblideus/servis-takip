import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { sirla, sirCoz, sirMaskesi, sirAnahtariVarMi, SirAnahtariYok } from '@/lib/sir';
import { SAGLAYICILAR, entegratorBul } from '@/lib/entegrator';

/**
 * GET  /api/settings/e-fatura → sağlayıcı ayarları (PAROLA DÖNMEZ)
 * POST /api/settings/e-fatura → ayarları kaydet
 *
 * ── PAROLA GERİ OKUNMUYOR ────────────────────────────────────────────────
 * Okuma ucu parolayı ASLA döndürmüyor, yalnız maskesini. Bir kez ekrana
 * düşen parola tarayıcı geçmişine, ekran görüntüsüne ve hata raporuna
 * girer. Bayi parolayı unuttuysa yenisini yazar.
 *
 * ── ANAHTAR YOKSA KAYDEDİLMİYOR ──────────────────────────────────────────
 * Şifreleme anahtarı tanımlı değilse parola düz metne DÜŞMÜYOR, kayıt
 * reddediliyor ve sebebi söyleniyor.
 */

export async function GET() {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        eFaturaSaglayici: true, eFaturaKullanici: true, eFaturaParola: true,
        eFaturaTestModu: true, eFaturaOnEk: true, eFaturaEtiket: true,
        eFaturaSeq: true, eFaturaSeqYil: true,
      },
    });
    if (!t) return NextResponse.json({ error: 'Bayi bulunamadı' }, { status: 404 });

    const cozulen = sirCoz(t.eFaturaParola);
    return NextResponse.json({
      saglayici: t.eFaturaSaglayici,
      saglayicilar: SAGLAYICILAR,
      kullanici: t.eFaturaKullanici,
      // Parolanın kendisi DEĞİL, yalnız maskesi.
      parolaMaske: sirMaskesi(cozulen),
      // Kayıt var ama çözülemiyorsa anahtar değişmiş demektir — bayi
      // "parola girili" sanıp gönderim hatası almasın.
      parolaOkunamiyor: !!t.eFaturaParola && cozulen === null,
      testModu: t.eFaturaTestModu,
      onEk: t.eFaturaOnEk,
      etiket: t.eFaturaEtiket,
      sonSira: t.eFaturaSeq,
      sonSiraYil: t.eFaturaSeqYil,
      anahtarVar: sirAnahtariVarMi(),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const b = await req.json();
    const d: any = {};

    if (b.saglayici !== undefined) {
      const v = (b.saglayici || '').trim().toUpperCase();
      // Bilinmeyen sağlayıcı kabul edilmiyor: kaydedilseydi gönderim anında
      // patlar ve bayi sebebini ayarlarda değil faturada arardı.
      if (v && !entegratorBul(v)) {
        return NextResponse.json(
          { error: `Tanımlı olmayan sağlayıcı: ${v}. Seçenekler: ${SAGLAYICILAR.join(', ')}` },
          { status: 400 },
        );
      }
      d.eFaturaSaglayici = v || null;
    }
    if (b.kullanici !== undefined) d.eFaturaKullanici = (b.kullanici || '').trim() || null;
    if (b.testModu !== undefined) d.eFaturaTestModu = !!b.testModu;
    if (b.onEk !== undefined) {
      const h = (b.onEk || '').toLocaleUpperCase('tr-TR').replace(/[^A-Z]/g, '');
      if (h && h.length !== 3) {
        return NextResponse.json({ error: 'e-Fatura ön eki tam 3 harf olmalı' }, { status: 400 });
      }
      d.eFaturaOnEk = h || null;
    }
    if (b.etiket !== undefined) d.eFaturaEtiket = (b.etiket || '').trim() || null;

    // Parola: boş gelirse DOKUNULMUYOR (form her kaydedişte yeniden
    // yazdırmasın). Açıkça temizlemek için `parolaSil: true`.
    if (b.parolaSil) {
      d.eFaturaParola = null;
    } else if (typeof b.parola === 'string' && b.parola.trim()) {
      try {
        d.eFaturaParola = sirla(b.parola.trim());
      } catch (e) {
        if (e instanceof SirAnahtariYok) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }
    }

    // GİB SIRA SAYACI DIŞARIDAN YAZILAMAZ: geri alınırsa aynı numaradan
    // iki belge çıkar, ileri alınırsa sırada boşluk kalır.
    delete b.eFaturaSeq;
    delete b.eFaturaSeqYil;

    await prisma.tenant.update({ where: { id: tenantId }, data: d });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
