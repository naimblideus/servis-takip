/**
 * Bayi abonelik fiyatlandırması — TEK KAYNAK.
 *
 * Model: taban ücret + pakete DAHİL cihaz + üstü için cihaz başına aşım,
 * AYLIK TAVANLA sınırlı.
 *
 * Sayılan şey FATURASI KESİLEN cihazdır: kiralık cihaz + kopya başı anlaşmalı
 * müşteri makinesi (lib/invoicing sayfaUcretliMi / SAYFA_UCRETLI_CIHAZ).
 * Anlaşmasız tamir makinesi ve satılmış cihaz sayılmaz. Eskiden yalnız
 * kiralık sayılıyordu: kopya başı çalışan servis bayisi 500 makineyle de
 * taban ücreti ödüyordu.
 *
 * TAVAN (2026-09-30, kurucu kararı): büyük bayi daha çok öder ama sınırsız
 * değil — "10-20 bin TL/ay civarı". Profesyonel ₺9.999, Kurumsal ₺19.999.
 * Tavanlar merdiveni korur: her cihaz sayısında Başlangıç < Profesyonel ≤
 * Kurumsal (test-paketler kilitli).
 *
 * ⚠️ DEĞİŞMEZ KURAL: perDevice ÜÇ PAKETTE DE AYNI olmalı.
 * Farklı yapılırsa (denendi: 25/28/22) belirli bir cihaz sayısının üstünde üst paket
 * alt paketten UCUZA düşer ve fiyat merdiveni ters döner. Aynı tutulduğunda paketler
 * arası fark her ölçekte sabit kalır.
 *
 * Landing (src/app/_landing/Landing.tsx, data-m/data-inc/data-per) bu değerlerle
 * AYNI olmak zorundadır — biri değişirse diğeri de değişmeli.
 */

export interface PlanPricing {
  base: number;            // aylık taban ücret (₺, KDV hariç)
  includedDevices: number; // bu sayıya kadar faturalı cihaz taban ücrete dahil
  perDevice: number;       // dahil sayının üstündeki her faturalı cihaz için (₺)
  ceiling: number;         // aylık tavan (₺, KDV hariç) — tutar bunu geçmez
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  starter:      { base: 1749, includedDevices: 20,  perDevice: 25, ceiling: 7499 },
  professional: { base: 2099, includedDevices: 25,  perDevice: 25, ceiling: 9999 },
  enterprise:   { base: 5249, includedDevices: 100, perDevice: 25, ceiling: 19999 },
};

export const VAT_RATE = 0.20;

export interface AmountBreakdown {
  base: number;
  includedDevices: number;
  deviceCount: number;
  billableDevices: number; // dahil sayıyı aşan cihaz adedi
  perDevice: number;
  overage: number;         // aşımdan gelen tutar (tavan uygulanmadan)
  ceiling: number;         // paketin aylık tavanı
  capped: boolean;         // tutar tavana takıldı mı
  amount: number;          // KDV hariç toplam (tavan uygulanmış)
  vatAmount: number;
  totalAmount: number;
}

/**
 * Bir bayinin aylık abonelik tutarını hesapla.
 * Bilinmeyen plan → starter'a düşer (fatura hiç kesilmemesindense taban ücret kesilsin).
 */
export function monthlyAmount(plan: string | null | undefined, billedDeviceCount: number): AmountBreakdown {
  const p = PLAN_PRICING[plan || ''] ?? PLAN_PRICING.starter;
  const deviceCount = Math.max(0, Math.floor(billedDeviceCount || 0));
  const billableDevices = Math.max(0, deviceCount - p.includedDevices);
  const overage = billableDevices * p.perDevice;
  const capped = p.base + overage > p.ceiling;
  const amount = capped ? p.ceiling : p.base + overage;
  const vatAmount = Math.round(amount * VAT_RATE * 100) / 100;
  return {
    base: p.base,
    includedDevices: p.includedDevices,
    deviceCount,
    billableDevices,
    perDevice: p.perDevice,
    overage,
    ceiling: p.ceiling,
    capped,
    amount,
    vatAmount,
    totalAmount: Math.round((amount + vatAmount) * 100) / 100,
  };
}

/** Fatura satırında gösterilecek insan-okur açıklama. */
export function amountNote(b: AmountBreakdown): string {
  const tl = (n: number) => `₺${n.toLocaleString('tr-TR')}`;
  if (b.billableDevices === 0) {
    return `Taban ${tl(b.base)} — ${b.deviceCount} faturalı cihaz (${b.includedDevices} cihaza kadar dahil)`;
  }
  const hesap = `Taban ${tl(b.base)} + ${b.billableDevices} × ${tl(b.perDevice)} aşım — toplam ${b.deviceCount} faturalı cihaz (${b.includedDevices} dahil)`;
  return b.capped ? `${hesap}; aylık tavan ${tl(b.ceiling)} uygulandı` : hesap;
}
