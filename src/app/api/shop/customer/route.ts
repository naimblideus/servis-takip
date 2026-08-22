import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopServisYetkili } from '@/lib/shop-auth';

/**
 * POST /api/shop/customer — mağazadan gelen misafir siparişi için müşteri bul/oluştur.
 *
 * Telefon numarası doğal anahtardır: Customer'da zaten @@unique([tenantId, phone])
 * var. Aynı ofis ikinci kez sipariş verdiğinde ikinci bir cari kaydı açılmaz;
 * mükerrer cari, bakiyeyi ikiye bölerek muhasebeyi sessizce bozar.
 *
 * KVKK: `consent` alanı yalnız ALICI SİPARİŞ FORMUNU ONAYLADIĞI için true
 * yazılır ve bu, ticari ileti izni DEĞİLDİR — sözleşmenin ifası için verilen
 * veridir. Pazarlama izni ayrı alınır; burada varsayılmaz.
 *
 * MEVCUT MÜŞTERİNİN VERİSİ EZİLMEZ. Bayi cari kartını elle düzenlemiş olabilir
 * (yetkili adı, adres, vergi no). Mağazadan gelen form onları üzerine yazarsa
 * bayinin işi bozulur. Yalnız BOŞ alanlar doldurulur.
 */
export async function POST(req: Request) {
  if (!shopServisYetkili(req)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  let body: {
    tenantId?: string;
    ad?: string;
    telefon?: string;
    eposta?: string;
    adres?: string;
    vergiNo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { tenantId } = body;
  const ad = (body.ad ?? '').trim();
  // Telefon tek biçime indirgenir: "0532 111 22 33" ve "05321112233" aynı
  // müşteridir. Normalize etmeden mükerrer cari kaçınılmazdır.
  const telefon = (body.telefon ?? '').replace(/\D/g, '');

  if (!tenantId || !ad || telefon.length < 10)
    return NextResponse.json({ error: 'tenantId, ad ve geçerli telefon zorunlu' }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, isActive: true, isSuspended: false, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Bayi bulunamadı veya askıda' }, { status: 404 });

  const mevcut = await prisma.customer.findFirst({ where: { tenantId, phone: telefon } });

  if (mevcut) {
    const doldur: Record<string, string> = {};
    if (!mevcut.email && body.eposta?.trim()) doldur.email = body.eposta.trim().slice(0, 160);
    if (!mevcut.address && body.adres?.trim()) doldur.address = body.adres.trim().slice(0, 800);
    if (!mevcut.taxNo && body.vergiNo?.trim()) doldur.taxNo = body.vergiNo.trim().slice(0, 20);

    if (Object.keys(doldur).length) {
      await prisma.customer.update({ where: { id: mevcut.id }, data: doldur });
    }
    return NextResponse.json({ ok: true, customerId: mevcut.id, yeni: false });
  }

  const yeni = await prisma.customer.create({
    data: {
      tenantId,
      name: ad.slice(0, 160),
      phone: telefon,
      email: body.eposta?.trim().slice(0, 160) || null,
      address: body.adres?.trim().slice(0, 800) || null,
      taxNo: body.vergiNo?.trim().slice(0, 20) || null,
      consent: true,
    },
  });

  return NextResponse.json({ ok: true, customerId: yeni.id, yeni: true });
}
