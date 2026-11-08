import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ucHatasi } from '@/lib/uc-hata';
import { oturumKullanicisi } from '@/lib/api-auth';
import { writeAudit } from '@/lib/audit';
import { musterileriEkle, TOPLU_AZAMI } from '@/lib/musteri-ekle';

/**
 * POST /api/customers/toplu — telefon rehberinden seçilen kişileri müşteri yapar.
 *   { kisiler: [{ ad, telefon, yetkili? }] }  (en çok 500)
 *
 * Kaydı olmayan bayinin "listesi" telefonunun rehberidir. Rehber dosyası
 * tarayıcıda okunur; buraya yalnız bayinin İŞARETLEDİĞİ kişiler gelir.
 * Numarası kayıtlı olan atlanır (tekrar göndermek güvenli). Teknisyen
 * müşteri listesini toptan değiştiremez: yönetici ve ön büro.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await oturumKullanicisi(session);
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (me.role !== 'ADMIN' && me.role !== 'FRONT_DESK') return ucHatasi('BU_ISLEM_ICIN_YETKIN_YOK', 403);

  const body = await req.json().catch(() => null);
  const kisiler = Array.isArray(body?.kisiler) ? body.kisiler : null;
  if (!kisiler || kisiler.length === 0) return ucHatasi('GECERSIZ_ISTEK', 400);
  if (kisiler.length > TOPLU_AZAMI) return ucHatasi('TEK_SEFERDE_EN_FAZLA_SATIR', 400, { deger: { p1: TOPLU_AZAMI, p2: kisiler.length } });

  const sonuc = await musterileriEkle(me.tenantId, kisiler.map((k: any) => ({ ad: k?.ad, telefon: k?.telefon, yetkili: k?.yetkili })));
  if (sonuc.eklenen > 0) {
    // Kişi verisi denetime yazılmaz: yalnız sayılar.
    await writeAudit({
      tenantId: me.tenantId, userId: me.id, action: 'REHBERDEN_MUSTERI_EKLENDI',
      entityType: 'Customer', entityId: me.tenantId, newValue: sonuc,
    });
  }
  return NextResponse.json(sonuc);
}
