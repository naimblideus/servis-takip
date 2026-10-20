/**
 * SORUN BİLDİR — veritabanı işleri. Kurallar sorun.ts'te; burada yalnız
 * sorgu. Uçlar (api/sorun, api/super-admin/sorunlar) ve süper admin sayfası
 * bunu kullanır.
 *
 * GİZLİLİK: ekran görüntüsü listelerde HİÇ seçilmez (yalnız var/yok).
 * Görüntü yalnız süper admin'in tek kayıt ucundan, tıklayınca gelir: hem
 * liste hafif kalır hem müşterinin ekranı gereksiz yere dolaşmaz.
 */
import { prisma } from '@/lib/prisma';
import { gorunenDurum, listeKapsami, type SorunGirdisi } from '@/lib/sorun';

/**
 * Görüntüsü olan kayıtlar. Prisma "boş mu" bilgisini veriyi çekmeden
 * seçemiyor; görüntüyü listeye taşımamak için ayrı, yalnız kimlik dönen
 * sorgu: `ekranGoruntusu IS NOT NULL`.
 */
async function ekranliKimlikler(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const r = await prisma.sorunBildirimi.findMany({ where: { id: { in: ids }, ekranGoruntusu: { not: null } }, select: { id: true } });
  return new Set(r.map((s) => s.id));
}

export async function sorunOlustur(input: SorunGirdisi & {
  tenantId: string; kullaniciId: string | null; kullaniciAd: string | null; rol: string | null; demo: boolean;
}) {
  return prisma.sorunBildirimi.create({
    data: input,
    select: { id: true, durum: true, createdAt: true },
  });
}

/**
 * Ürün tarafı: "Önceki bildirimleriniz". Son 20. İç not, görüntü verisi ve
 * KAPANDI/COZULDU farkı dışarı çıkmaz.
 */
export async function kendiSorunlari(user: { id: string; tenantId: string; role?: string | null }) {
  const satirlar = await prisma.sorunBildirimi.findMany({
    where: listeKapsami(user),
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, tur: true, neOldu: true, durum: true, createdAt: true, cozulduAt: true, kullaniciAd: true,
    },
  });
  const ekranli = await ekranliKimlikler(satirlar.map((s) => s.id));
  return satirlar.map((s) => ({
    id: s.id,
    tur: s.tur,
    neOldu: s.neOldu,
    durum: gorunenDurum(s.durum),
    createdAt: s.createdAt,
    cozulduAt: s.cozulduAt,
    kullaniciAd: s.kullaniciAd,
    ekranVar: ekranli.has(s.id),
  }));
}

/** Süper admin listesi: süzgeçle, yenisi üstte. Görüntü verisi YOK. */
export async function sorunListesi(where: Record<string, unknown>, take = 300) {
  const satirlar = await prisma.sorunBildirimi.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true, tenantId: true, kullaniciId: true, kullaniciAd: true, rol: true, tur: true, neYapiyordu: true,
      neOldu: true, sayfa: true, ekran: true, tarayici: true, demo: true, durum: true, kutu: true,
      yoneticiNotu: true, cozulduAt: true, bildirildiAt: true, createdAt: true,
      tenant: { select: { name: true, phone: true, ownerName: true } },
    },
  });
  const ekranli = await ekranliKimlikler(satirlar.map((s) => s.id));
  return satirlar.map(({ tenant, ...s }) => ({ ...s, bayi: tenant.name, telefon: tenant.phone, yetkili: tenant.ownerName, ekranVar: ekranli.has(s.id) }));
}

export type SorunSatiri = Awaited<ReturnType<typeof sorunListesi>>[number];

/** Durum sayıları (süzgeçteki demo kuralıyla aynı: demo varsayılan hariç). */
export async function durumSayilari(demoDahil: boolean) {
  const gruplar = await prisma.sorunBildirimi.groupBy({
    by: ['durum'],
    where: demoDahil ? {} : { demo: false },
    _count: { _all: true },
  });
  const out: Record<string, number> = { YENI: 0, INCELENIYOR: 0, COZULDU: 0, KAPANDI: 0 };
  for (const g of gruplar) out[g.durum] = g._count._all;
  return out;
}

export async function sorunBul(id: string) {
  return prisma.sorunBildirimi.findUnique({
    where: { id },
    select: { id: true, tenantId: true, durum: true, kutu: true, yoneticiNotu: true, cozulduAt: true, bildirildiAt: true },
  });
}

export async function sorunGuncelle(id: string, data: Record<string, unknown>) {
  return prisma.sorunBildirimi.update({
    where: { id },
    data,
    select: { id: true, tenantId: true, durum: true, kutu: true, yoneticiNotu: true, cozulduAt: true, bildirildiAt: true },
  });
}

export async function sorunEkrani(id: string) {
  const s = await prisma.sorunBildirimi.findUnique({ where: { id }, select: { ekranGoruntusu: true } });
  return s?.ekranGoruntusu ?? null;
}
