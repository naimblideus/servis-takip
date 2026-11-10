// Manuel-tetikli kira + sayaç → CARİ (AccountEntry).
// Kullanıcı butona basınca hesaplanır ve cariye eklenir; OTOMATİK eklenmez (karışıklık önlenir).
//
// HESAP FATURAYLA AYNI FONKSİYONDAN (lib/invoicing faturaHesapla). Eskiden bu
// dosya dahil paketi, aşımı ve kirayı kendi döngüsüyle bir daha hesaplıyordu;
// iki kopya aynı kalsın diye her düzeltme iki yere yazılıyordu ve yazılmadığı
// oldu (KDV, kira işaretindeki NULL tuzağı). Artık tek hesap var; bu yol yalnız
// sonucu fatura yerine cariye yazar. İş emirleri bu yolda yazılmaz (onlar
// cariye fişten işlenir).
//
// MÜKERRER ENGELİ faturalama ile ORTAK ve aynı kilidin içinde:
//   · okuma: billed=false → true (hangi cari kaydının faturaladığı da yazılır)
//   · kira:  KiraDonemi(cihaz, dönem) satırı — tekil dizin (lib/kira-donemi)
// Böylece bu yol ile "Bu Dönemi Faturala" birbirini çift saymaz ve cari kaydı
// silinirse (api/muhasebe) neyin geri açılacağı bilinir.
import { prisma } from '@/lib/prisma';
import { FATURA_ISLEMI, FaturaCakismasi, faturaHesapla, musteriFaturaKilidi, periodOf } from '@/lib/invoicing';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PeriodCharges {
  period: string;
  /** KDV DAHİL kira — cariye yazılan ve kullanıcıya gösterilen tutar. */
  rent: number;
  /** KDV DAHİL sayaç bedeli. */
  counter: number;
  /** KDV hariç tutarlar (dökümde gösterilir). */
  rentNet: number;
  counterNet: number;
  vatRate: number;
  /**
   * Cihaz kırılımı — tutarlar KDV HARİÇ (cihaz kartındaki kira ile aynı
   * rakam, bayi orada ne yazdıysa onu görsün). Üstteki `rent`/`counter`
   * ise KDV DAHİL. Bu diziyi toplayıp `rent` ile karşılaştırmayın; net
   * karşılığı `rentNet`/`counterNet`.
   */
  rentDetail: { device: string; amount: number }[];
  counterDetail: { device: string; amount: number }[];
  readingIds: string[];
  rentDeviceIds: string[];
}

type Hesap = Awaited<ReturnType<typeof faturaHesapla>>;

/** Fatura hesabını cari kalemlerine çevirir (KDV dahil toplamlar + cihaz kırılımı). */
function kalemler(h: Hesap): PeriodCharges {
  const rentDetail: { device: string; amount: number }[] = [];
  const sayac = new Map<string, number>();
  let rent = 0;
  let counter = 0;
  for (const l of h.lines) {
    const ad = (l.deviceId && h.cihazAdlari.get(l.deviceId)) || l.description;
    if (l.kind === 'RENTAL') {
      rent += l.lineTotal;
      rentDetail.push({ device: ad, amount: l.lineTotal });
    } else if (l.kind === 'COUNTER') {
      counter += l.lineTotal;
      sayac.set(ad, round2((sayac.get(ad) ?? 0) + l.lineTotal));
    }
  }
  // ── NEDEN KDV EKLENİYOR ─────────────────────────────────────────────
  // Bu yol ile OTOMATİK FATURALAMA (lib/invoicing) aynı borcu yazmalı.
  // invoicing subtotal + KDV yazıyordu, burası KDV'siz yazıyordu ve
  // lib/musteri-bakiye ikisini AYNI bakiyede topluyor. Sonuç: aynı ₺10.000
  // kira, hangi düğmeye basıldığına göre ₺12.000 ya da ₺10.000 borç
  // üretiyordu — bayinin alacağı yanlış görünüyordu.
  const vatRate = Number(h.tenant.vatRate ?? 0);
  const kdvli = (net: number) => round2(net * (1 + vatRate / 100));
  const rentNet = round2(rent);
  const counterNet = round2(counter);
  return {
    period: h.period,
    rent: kdvli(rentNet),
    counter: kdvli(counterNet),
    rentNet,
    counterNet,
    vatRate,
    rentDetail,
    counterDetail: [...sayac].map(([device, amount]) => ({ device, amount })),
    readingIds: h.readingIdsToBill,
    rentDeviceIds: h.kiralar.map((k) => k.deviceId),
  };
}

/** Önizleme — cari'ye yazmadan hesapla (kullanıcı onayından önce gösterilir). */
export function previewPeriodCharges(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => kalemler(await faturaHesapla(tx, tenantId, customerId, periodOf())), FATURA_ISLEMI);
}

/** Onaydan sonra: kira + sayaç bedelini CARİ'ye SALE olarak ekle + mükerrer işaretlerini koy. */
export async function commitPeriodCharges(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    // Faturalamayla AYNI kilit: ikisi aynı okumayı / aynı kirayı aynı anda göremez.
    await musteriFaturaKilidi(tx, tenantId, customerId);
    const h = await faturaHesapla(tx, tenantId, customerId, periodOf());
    const c = kalemler(h);
    let added = 0;

    let kiraKaydi: string | null = null;
    if (c.rent > 0) {
      const e = await tx.accountEntry.create({
        data: {
          tenantId, customerId, type: 'SALE',
          product: `Aylık Kira — ${c.period}`,
          amount: c.rent,          // KDV DAHİL (faturalama ile aynı)
          method: 'OPEN_ACCOUNT',
          notes: `Kira (elle eklendi) · KDV %${c.vatRate} dahil · net ${c.rentNet.toFixed(2)}`,
          date: new Date(),
        },
      });
      kiraKaydi = e.id;
      added++;
    }
    let sayacKaydi: string | null = null;
    if (c.counter > 0) {
      const e = await tx.accountEntry.create({
        data: {
          tenantId, customerId, type: 'SALE',
          product: `Sayaç — ${c.period}`,
          amount: c.counter,       // KDV DAHİL (faturalama ile aynı)
          method: 'OPEN_ACCOUNT',
          notes: `Sayaç (elle eklendi) · KDV %${c.vatRate} dahil · net ${c.counterNet.toFixed(2)}`,
          date: new Date(),
        },
      });
      sayacKaydi = e.id;
      added++;
    }

    // Sahiplen: sayı tutmazsa hiçbir şey yazılmaz (işlem geri alınır).
    // Paketin içinde kalan okumalar da kapanır (tutar 0); bağlandıkları cari
    // kaydı silinirse geri açılabilsinler diye bir kayda bağlanırlar.
    if (c.readingIds.length) {
      const r = await tx.counterReading.updateMany({
        where: { tenantId, id: { in: c.readingIds }, billed: false },
        data: { billed: true, cariKayitId: sayacKaydi ?? kiraKaydi },
      });
      if (r.count !== c.readingIds.length) throw new FaturaCakismasi(`okuma ${r.count}/${c.readingIds.length}`);
    }
    if (h.kiralar.length)
      await tx.kiraDonemi.createMany({
        data: h.kiralar.map((k) => ({ tenantId, deviceId: k.deviceId, period: c.period, tutar: k.tutar, kaynak: 'CARI', cariKayitId: kiraKaydi })),
      });

    return { period: c.period, rent: c.rent, counter: c.counter, added };
  }, FATURA_ISLEMI);
}

/**
 * Bir cari kaydını siler ve o kaydın kapattıklarını GERİ AÇAR.
 *
 * "Kira + sayaç cariye ekle" ile yazılan kalem okumaları "faturalandı" yapıp
 * dönemin kirasını kesilmiş sayıyordu. Kalem silinince bunlar öyle kalıyordu:
 * bayi kalemi silip düzgün fatura kesmek istediğinde fatura boş çıkıyor, kira
 * ve sayfalar iki defterde de yok oluyordu. Okuma ve kira kaydı hangi cari
 * kaydına bağlı olduğunu taşır (cariKayitId); üçü tek işlemde.
 */
export async function cariKaydiSil(tenantId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const kayit = await tx.accountEntry.findFirst({ where: { id, tenantId }, select: { id: true, customerId: true } });
    if (!kayit) return false;
    // Faturalamayla aynı kilit: geri açılan okumayı o an kesilen bir fatura yarım görmesin.
    await musteriFaturaKilidi(tx, tenantId, kayit.customerId);
    await tx.counterReading.updateMany({ where: { tenantId, cariKayitId: id }, data: { billed: false, cariKayitId: null } });
    await tx.kiraDonemi.deleteMany({ where: { tenantId, cariKayitId: id } });
    await tx.accountEntry.delete({ where: { id } });
    return true;
  }, FATURA_ISLEMI);
}
