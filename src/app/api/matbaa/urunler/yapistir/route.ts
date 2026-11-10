import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { kademeleriNormallestir, urunleriYapistir } from '@/lib/baski-fiyat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/matbaa/urunler/yapistir { metin } — Excel'den yapıştırılan ürün
 * listesi (ad, fiyat). Aynı adlı ürünün İLK kademesinin fiyatı güncellenir
 * (kademe yapısı ve seçenekleri korunur); olmayan ürün "adet başı" eklenir.
 * Metin sunucuda yeniden okunur: ekrandaki önizlemeye güvenilmez.
 */
export async function POST(req: Request) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    const g = ((await req.json().catch(() => null)) ?? {}) as { metin?: unknown };
    const satirlar = urunleriYapistir(typeof g.metin === 'string' ? g.metin.slice(0, 100_000) : '');
    if (!satirlar.length) return baskiHatasi('SATIR_YOK');

    const mevcut = await prisma.baskiUrunu.findMany({ where: { tenantId }, select: { id: true, ad: true, kademeler: true, sira: true } });
    const anahtar = (ad: string) => ad.trim().toLocaleLowerCase('tr-TR');
    let sira = Math.max(0, ...mevcut.map((m) => m.sira));
    let eklenen = 0, guncellenen = 0;
    await prisma.$transaction(async (tx) => {
      for (const s of satirlar) {
        const var_ = mevcut.find((m) => anahtar(m.ad) === anahtar(s.ad));
        if (var_) {
          const k = kademeleriNormallestir(var_.kademeler);
          const yeni = k.length ? [{ ...k[0], fiyat: s.fiyat }, ...k.slice(1)] : [{ min: 1, fiyat: s.fiyat }];
          await tx.baskiUrunu.updateMany({ where: { id: var_.id, tenantId }, data: { kademeler: yeni as unknown as Prisma.InputJsonValue } });
          guncellenen++;
        } else {
          sira += 10;
          await tx.baskiUrunu.create({ data: { tenantId, ad: s.ad, fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: s.fiyat }], sira, dosyaGerekli: false } });
          eklenen++;
        }
      }
    });
    return NextResponse.json({ ok: true, eklenen, guncellenen });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
