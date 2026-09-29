// BİZİM HESAP AKTARIMI — saf eşleyici ve cevap okuyucu (ağ yok, veritabanı yok).
//
// NEDEN: Bayilerin bir kısmı muhasebeyi Bizim Hesap'ta tutuyor (sahada ilk
// müşteri adayı böyle). "Bizim Hesap yerinde kalsın, servis ve kira tarafı
// Nextus'ta" diyebilmek için Nextus'un kestiği kira/sayaç/servis faturası
// Bizim Hesap'a satış faturası olarak düşmeli; muhasebeci iki programdan
// elle birleştirmesin.
//
// KAYNAK: Bizim Hesap'ın herkese açık B2B API belgesi
//   https://apidocs.bizimhesap.com/addinvoice
// ve sahada kullanılan açık kaynak istemci (github.com/tcgunel/bizimhesap-b2b):
//   • POST https://bizimhesap.com/api/b2b/addinvoice, JSON gövde, "token"
//     başlığında FirmID; gövdede de firmId.
//   • Başarı: { error: "", guid, url }. Hata üç biçimde gelebiliyor:
//     { error: "…" } · { resultCode: 0, errorText: "…" } · { Message: "…" }.
//   • İptal: POST /cancelinvoice { FirmId, Guid } → { status: "0" } başarı.
//   • Okuma: GET /customers (token başlığı) — bağlantı denemesi bununla,
//     fatura yazmadan.
// TAHSİLAT UCU YOK: API tahsilat almıyor. Tahsilatlar Bizim Hesap'a gitmez;
// bunu ekran açıkça söylüyor.
//
// TUTAR TEK KAYNAKTAN: satırlar faturanın kendi kalemlerinden kuruluyor ve
// toplam faturanın kendi toplamıyla kuruşu kuruşuna TUTMAZSA gönderim
// yapılmıyor. Müşteriye giden fatura ile muhasebedeki kayıt farklı olamaz.

export const BIZIMHESAP_KOK = 'https://bizimhesap.com/api/b2b';

export type FaturaKalemi = {
  id: string;
  kind: 'COUNTER' | 'RENTAL' | 'PART' | 'LABOR' | 'OTHER' | string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vatRate: number | null;
  partId?: string | null;
};

export type AktarimFaturasi = {
  invoiceNumber: string;
  gibNo: string | null;
  period: string;
  invoiceDate: Date;
  dueDate: Date;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  notes: string | null;
};

export type AktarimMusterisi = {
  id: string;
  name: string;
  legalName: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  taxOffice: string | null;
  taxNo: string | null;
  email: string | null;
  phone: string | null;
};

export type BizimHesapFaturasi = {
  firmId: string;
  invoiceNo: string;
  invoiceType: 3;
  note: string;
  dates: { invoiceDate: string; dueDate: string; deliveryDate: string };
  customer: { customerId: string; title: string; address: string; taxOffice: string; taxNo: string; email: string; phone: string };
  amounts: { currency: 'TL'; gross: number; discount: number; net: number; tax: number; total: number };
  details: {
    productId: string; productName: string; note: string; barcode: string;
    taxRate: number; quantity: number; unitPrice: number; grossPrice: number;
    discount: number; net: number; tax: number; total: number;
  }[];
};

const yuvarla = (n: number) => Math.round(n * 100) / 100;

/**
 * Türkiye saatiyle ISO 8601 ("2026-09-29T14:05:00.000+03:00"). Türkiye
 * 2016'dan beri yaz/kış saati uygulamıyor: sabit +03:00.
 */
export function bizimHesapTarihi(d: Date): string {
  return new Date(d.getTime() + 3 * 3_600_000).toISOString().replace('Z', '+03:00');
}

/** Telefon: Bizim Hesap yerel 10 haneyi bekliyor (5321234567). */
export function yerelTelefon(v: string | null | undefined): string {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? d : '';
}

/**
 * Ürün kimliği. Bizim Hesap bilmediği ürünü kendisi AÇIYOR: her fatura
 * satırı ayrı ürün olsaydı bayinin stok listesi bir ayda yüzlerce "Kyocera
 * 2553 Eylül sayacı" ürünüyle dolardı. Kalem TÜRÜNE göre sabit birkaç
 * hizmet ürünü kullanılıyor; ayrıntı (cihaz, seri, dönem) satır notunda.
 * Parça gerçek bir stok kalemi: onun kendi kimliği var.
 */
export function urunKimligi(k: Pick<FaturaKalemi, 'kind' | 'partId'>): { id: string; ad: string } {
  switch (k.kind) {
    case 'COUNTER': return { id: 'NXS-SAYAC', ad: 'Sayaç (baskı) bedeli' };
    case 'RENTAL': return { id: 'NXS-KIRA', ad: 'Cihaz kira bedeli' };
    case 'LABOR': return { id: 'NXS-ISCILIK', ad: 'Servis işçiliği' };
    case 'PART': return k.partId ? { id: `NXS-PARCA-${k.partId}`, ad: 'Yedek parça' } : { id: 'NXS-PARCA', ad: 'Yedek parça' };
    default: return { id: 'NXS-HIZMET', ad: 'Hizmet' };
  }
}

export type EslemeHatasi = 'SATIR_YOK' | 'TUTAR_TUTMUYOR' | 'FIRMID_YOK';

/**
 * Faturayı Bizim Hesap gövdesine çevirir. KDV, faturanın kendi yöntemiyle:
 * oran başına matrah toplanır, vergi o toplamdan yuvarlanır; yuvarlama farkı
 * o oranın son satırına yazılır. Böylece satır vergileri toplamı faturadaki
 * KDV'ye eşit çıkar.
 */
export function bizimHesapFaturasi(args: {
  firmId: string;
  fatura: AktarimFaturasi;
  musteri: AktarimMusterisi;
  kalemler: FaturaKalemi[];
}): { ok: true; govde: BizimHesapFaturasi } | { ok: false; hata: EslemeHatasi; fark?: number } {
  const { firmId, fatura, musteri, kalemler } = args;
  if (!firmId.trim()) return { ok: false, hata: 'FIRMID_YOK' };
  if (!kalemler.length) return { ok: false, hata: 'SATIR_YOK' };

  const oranOf = (k: FaturaKalemi) => (k.vatRate === null || k.vatRate === undefined ? Number(fatura.vatRate) : Number(k.vatRate));
  const matrahlar = new Map<number, number>();
  for (const k of kalemler) matrahlar.set(oranOf(k), yuvarla((matrahlar.get(oranOf(k)) ?? 0) + Number(k.lineTotal)));
  const oranVergi = new Map([...matrahlar].map(([oran, matrah]) => [oran, yuvarla((matrah * oran) / 100)]));

  const dagitilan = new Map<number, number>();
  const sonIndeks = new Map<number, number>();
  kalemler.forEach((k, i) => sonIndeks.set(oranOf(k), i));

  const details = kalemler.map((k, i) => {
    const oran = oranOf(k);
    const net = yuvarla(Number(k.lineTotal));
    let tax = yuvarla((net * oran) / 100);
    if (sonIndeks.get(oran) === i) tax = yuvarla((oranVergi.get(oran) ?? 0) - (dagitilan.get(oran) ?? 0));
    dagitilan.set(oran, yuvarla((dagitilan.get(oran) ?? 0) + tax));
    const miktar = Number(k.quantity) || 1;
    const urun = urunKimligi(k);
    return {
      productId: urun.id,
      productName: urun.ad,
      note: (k.description ?? '').slice(0, 250),
      barcode: '',
      taxRate: oran,
      quantity: miktar,
      // Birim fiyat satır tutarından türetiliyor: kalemdeki 4 haneli birim
      // fiyat × miktar kuruş kaydırabiliyordu; satır tutarı ise faturanın
      // kendi rakamı.
      unitPrice: Math.round((net / miktar) * 10000) / 10000,
      grossPrice: net,
      discount: 0,
      net,
      tax,
      total: yuvarla(net + tax),
    };
  });

  const net = yuvarla(details.reduce((s, d) => s + d.net, 0));
  const tax = yuvarla(details.reduce((s, d) => s + d.tax, 0));
  const total = yuvarla(net + tax);
  const fark = yuvarla(total - Number(fatura.totalAmount));
  if (Math.abs(fark) > 0.01) return { ok: false, hata: 'TUTAR_TUTMUYOR', fark };

  const adres = [musteri.address, musteri.district, musteri.city].map((x) => (x ?? '').trim()).filter(Boolean).join(', ');
  const not = [
    `Nextus Servis ${fatura.invoiceNumber}`,
    fatura.gibNo && fatura.gibNo !== fatura.invoiceNumber ? `e-Belge ${fatura.gibNo}` : '',
    fatura.period ? `Dönem ${fatura.period}` : '',
    (fatura.notes ?? '').trim(),
  ].filter(Boolean).join(' · ').slice(0, 250);

  return {
    ok: true,
    govde: {
      firmId: firmId.trim(),
      // Yasal belge numarası e-Belge numarasıdır; e-Belge kesilmediyse Nextus numarası.
      invoiceNo: fatura.gibNo || fatura.invoiceNumber,
      invoiceType: 3,
      note: not,
      dates: {
        invoiceDate: bizimHesapTarihi(fatura.invoiceDate),
        dueDate: bizimHesapTarihi(fatura.dueDate),
        deliveryDate: bizimHesapTarihi(fatura.invoiceDate),
      },
      customer: {
        customerId: musteri.id,
        title: ((musteri.legalName ?? '').trim() || musteri.name).slice(0, 200),
        // Adres zorunlu alan; boşsa "-" gidiyor ki fatura adres yüzünden reddedilmesin.
        address: adres || '-',
        taxOffice: (musteri.taxOffice ?? '').trim(),
        taxNo: (musteri.taxNo ?? '').replace(/\D/g, ''),
        email: (musteri.email ?? '').trim(),
        phone: yerelTelefon(musteri.phone),
      },
      amounts: { currency: 'TL', gross: net, discount: 0, net, tax, total },
      details,
    },
  };
}

/**
 * Bizim Hesap cevabından hata metni. Üç biçim de okunuyor (bkz. üst not).
 * Boş dize = hata yok.
 */
export function cevapHatasi(govde: unknown): string {
  if (!govde || typeof govde !== 'object') return 'Bizim Hesap anlaşılır bir cevap vermedi.';
  const g = govde as Record<string, unknown>;
  if (typeof g.error === 'string' && g.error.trim()) return g.error.trim();
  if (g.resultCode === 0 || g.resultCode === '0') return String(g.errorText ?? '').trim() || 'Bizim Hesap isteği reddetti.';
  if (typeof g.Message === 'string' && g.Message.trim()) return g.Message.trim();
  return '';
}
