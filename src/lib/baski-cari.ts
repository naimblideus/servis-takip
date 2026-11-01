// BASKI İŞİ → CARİ (AccountEntry). syncTicketToCari (lib/ticket-cari) kalıbı.
//
// Tek kaynak + idempotent: her çağrıda işin cari kayıtları (SATIŞ + TAHSİLAT)
// işin gerçek durumuna göre yeniden uzlaştırılır. Kaç kez çağrılırsa
// çağrılsın sonuç aynı; iki kez çağrılınca borç ikiye katlanmaz.
//
// Böylece ekstre (lib/musteri-bakiye) ve tahsilat dağıtımı (allocatePayment)
// baskı işini ayrıca bilmeden olduğu gibi çalışır.
//
// Kural:
//   · Kayıtlı müşterisi olan, tutarı > 0, kabul edilmiş (GELEN değil) ve
//     iptal edilmemiş iş cariye SATIŞ (borç) olarak yazılır.
//   · Alınan ödemelerin toplamı TAHSİLAT olarak düşülür.
//   · İptal, müşterisiz ya da henüz kabul edilmemiş işin cari kaydı silinir.
//
// Plan saf (cariPlani, testte derlenir); uygulama veritabanında, tek işlemde.

/** Cari tutarları TL (Decimal), iş tutarları kuruş. */
const tl = (kurus: number) => Math.round(kurus) / 100;

/** BaskiOdeme yolu → AccountEntry yöntemi (PaymentMethod adları). */
export const CARI_YONTEM: Readonly<Record<string, string>> = { NAKIT: 'CASH', KART: 'CARD', HAVALE: 'TRANSFER' };

export interface CariIs {
  id: string;
  no: number;
  durum: string;
  toplam: number;
  customerId: string | null;
  createdAt: Date;
  odemeler: { tutar: number; yol: string; tarih: Date }[];
  kim: string | null;
}

export interface CariKayit {
  id: string;
  type: 'SALE' | 'PAYMENT' | string;
  amount: number;
  product: string | null;
  date: Date;
  method: string;
  customerId: string;
}

type Yeni = { type: 'SALE' | 'PAYMENT'; amount: number; product: string | null; date: Date; method: string; notes: string };
export interface CariPlan {
  sil: string[];
  guncelle: { id: string; data: Partial<Yeni> & { customerId?: string } }[];
  olustur: Yeni[];
}

/** Mevcut kayıtları işin durumuna getirmek için gereken değişiklikler. Boş plan = uzlaşık. */
export function cariPlani(is: CariIs, mevcut: readonly CariKayit[]): CariPlan {
  const plan: CariPlan = { sil: [], guncelle: [], olustur: [] };
  const olmali = is.durum !== 'IPTAL' && is.durum !== 'GELEN' && is.toplam > 0 && !!is.customerId;
  if (!olmali) {
    plan.sil = mevcut.map((e) => e.id);
    return plan;
  }
  const urun = `Baskı B-${is.no}`;
  const satislar = mevcut.filter((e) => e.type === 'SALE');
  const tahsilatlar = mevcut.filter((e) => e.type === 'PAYMENT');
  // Fazla kayıt (elle çoğaltılmış, yarım kalmış eski uzlaştırma) silinir.
  plan.sil.push(...satislar.slice(1).map((e) => e.id), ...tahsilatlar.slice(1).map((e) => e.id));

  const satis = satislar[0];
  const tutar = tl(is.toplam);
  if (!satis) {
    plan.olustur.push({ type: 'SALE', amount: tutar, product: urun, date: is.createdAt, method: 'OPEN_ACCOUNT', notes: 'Baskı işi' });
  } else if (Number(satis.amount) !== tutar || satis.product !== urun || +new Date(satis.date) !== +is.createdAt || satis.customerId !== is.customerId) {
    plan.guncelle.push({ id: satis.id, data: { amount: tutar, product: urun, date: is.createdAt, customerId: is.customerId! } });
  }

  const odenen = is.odemeler.reduce((t, o) => t + o.tutar, 0);
  const tahsilat = tahsilatlar[0];
  if (odenen > 0) {
    const son = is.odemeler.reduce((m, o) => (+o.tarih > +m.tarih ? o : m), is.odemeler[0]);
    const yontem = CARI_YONTEM[son.yol] ?? 'OTHER';
    const tarih = son.tarih;
    if (!tahsilat) {
      plan.olustur.push({ type: 'PAYMENT', amount: tl(odenen), product: null, date: tarih, method: yontem, notes: 'Baskı tahsilatı' });
    } else if (Number(tahsilat.amount) !== tl(odenen) || +new Date(tahsilat.date) !== +tarih || tahsilat.method !== yontem || tahsilat.customerId !== is.customerId) {
      plan.guncelle.push({ id: tahsilat.id, data: { amount: tl(odenen), date: tarih, method: yontem, customerId: is.customerId! } });
    }
  } else if (tahsilat) {
    plan.sil.push(tahsilat.id);
  }
  return plan;
}

export function planBosMu(p: CariPlan): boolean {
  return !p.sil.length && !p.guncelle.length && !p.olustur.length;
}
