import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { teklifHesapla } from '@/lib/teklif';

const DURUMLAR = ['TASLAK', 'GONDERILDI', 'KAZANILDI', 'KAYBEDILDI'] as const;

/** Sayı okuma: boş/`null` "girilmemiş" demek, sıfır demek DEĞİL. */
function sayi(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function tamSayi(v: unknown, varsayilan = 0): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : varsayilan;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const sonuc = await teklifHesapla(tenantId, id);
    if (!sonuc) return NextResponse.json({ error: 'Teklif bulunamadı' }, { status: 404 });

    // HAM satırlar da dönüyor: hesap toplam sayfayı adetle çarpılmış
    // veriyor, form ise kullanıcının yazdığı ham değeri geri istiyor.
    // İkisini ayrı uçtan çekmek, formun hesaptan farklı bir ana ait veriyi
    // göstermesine yol açardı.
    const ham = await prisma.teklifSatiri.findMany({
      where: { teklifId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ...sonuc,
      hamSatirlar: ham.map((s) => ({
        id: s.id, marka: s.marka, model: s.model, adet: s.adet,
        aylikSayfaSb: s.aylikSayfaSb, aylikSayfaRenkli: s.aylikSayfaRenkli,
        mevcutAylikTutar: s.mevcutAylikTutar == null ? '' : String(s.mevcutAylikTutar),
        onerilenKira: s.onerilenKira == null ? '' : String(s.onerilenKira),
        onerilenSayfaSb: s.onerilenSayfaSb == null ? '' : String(s.onerilenSayfaSb),
        onerilenSayfaRenkli: s.onerilenSayfaRenkli == null ? '' : String(s.onerilenSayfaRenkli),
      })),
      ozet: {
        ...sonuc.ozet,
        satirlar: sonuc.ozet.satirlar.map((s, i) => ({ ...s, id: sonuc.satirIdleri[i] })),
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * PATCH — başlık ve/veya satırlar.
 *
 * Satırlar verildiğinde TAMAMI değiştiriliyor (sil-yaz). Tek tek güncelleme
 * uçları açmak yerine bu seçildi: ekran zaten tabloyu bütün olarak
 * düzenletiyor ve iki yolun ayrışma riski yok.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const mevcut = await prisma.teklif.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!mevcut) return NextResponse.json({ error: 'Teklif bulunamadı' }, { status: 404 });

    const g = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof g.musteriAdi === 'string') {
      const v = g.musteriAdi.trim();
      if (!v) return NextResponse.json({ error: 'Müşteri adı boş olamaz' }, { status: 400 });
      data.musteriAdi = v;
    }
    for (const alan of ['yetkili', 'telefon', 'eposta', 'notlar'] as const) {
      if (typeof g[alan] === 'string') data[alan] = g[alan].trim() || null;
    }
    if (g.durum !== undefined) {
      if (!DURUMLAR.includes(g.durum)) {
        return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
      }
      data.durum = g.durum;
    }
    if (g.gecerlilikGun !== undefined) data.gecerlilikGun = Math.min(365, Math.max(1, tamSayi(g.gecerlilikGun, 30)));
    if (g.hedefMarj !== undefined) {
      if (g.hedefMarj === '' || g.hedefMarj === null) data.hedefMarj = null;
      else {
        // Ekran YÜZDE gönderiyor (25), veritabanı ORAN tutuyor (0,25).
        const n = Number(g.hedefMarj) / 100;
        if (!Number.isFinite(n) || n < 0 || n >= 1) {
          return NextResponse.json({ error: 'Hedef marj %0 ile %99 arasında olmalı' }, { status: 400 });
        }
        data.hedefMarj = n;
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.teklif.update({ where: { id }, data });

      if (Array.isArray(g.satirlar)) {
        await tx.teklifSatiri.deleteMany({ where: { teklifId: id, tenantId } });
        const temiz = g.satirlar
          .filter((s: any) => (s?.marka || '').trim() || (s?.model || '').trim())
          .slice(0, 200)
          .map((s: any) => ({
            tenantId, teklifId: id,
            marka: String(s.marka || '').trim(),
            model: String(s.model || '').trim(),
            adet: Math.max(1, tamSayi(s.adet, 1)),
            aylikSayfaSb: tamSayi(s.aylikSayfaSb, 0),
            aylikSayfaRenkli: tamSayi(s.aylikSayfaRenkli, 0),
            mevcutAylikTutar: sayi(s.mevcutAylikTutar),
            onerilenKira: sayi(s.onerilenKira),
            onerilenSayfaSb: sayi(s.onerilenSayfaSb),
            onerilenSayfaRenkli: sayi(s.onerilenSayfaRenkli),
          }));
        if (temiz.length) await tx.teklifSatiri.createMany({ data: temiz });
      }
    });

    const sonuc = await teklifHesapla(tenantId, id);
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const mevcut = await prisma.teklif.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!mevcut) return NextResponse.json({ error: 'Teklif bulunamadı' }, { status: 404 });
    await prisma.teklif.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
