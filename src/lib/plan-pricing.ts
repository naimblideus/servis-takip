/**
 * Bayi abonelik fiyatlandırması — TEK KAYNAK.
 *
 * Model: taban ücret + pakete DAHİL cihaz + üstü için cihaz başına aşım.
 * Sayılan şey KİRALIK cihazdır (isRental=true); satılmış cihaz abonelik bedelini etkilemez.
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
  includedDevices: number; // bu sayıya kadar kiralık cihaz taban ücrete dahil
  perDevice: number;       // dahil sayının üstündeki her kiralık cihaz için (₺)
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  starter:      { base: 1749, includedDevices: 20,  perDevice: 25 },
  professional: { base: 2099, includedDevices: 25,  perDevice: 25 },
  enterprise:   { base: 5249, includedDevices: 100, perDevice: 25 },
};

export const VAT_RATE = 0.20;

export interface AmountBreakdown {
  base: number;
  includedDevices: number;
  deviceCount: number;
  billableDevices: number; // dahil sayıyı aşan cihaz adedi
  perDevice: number;
  overage: number;         // aşımdan gelen tutar
  amount: number;          // KDV hariç toplam
  vatAmount: number;
  totalAmount: number;
}

/**
 * Bir bayinin aylık abonelik tutarını hesapla.
 * Bilinmeyen plan → starter'a düşer (fatura hiç kesilmemesindense taban ücret kesilsin).
 */
export function monthlyAmount(plan: string | null | undefined, rentalDeviceCount: number): AmountBreakdown {
  const p = PLAN_PRICING[plan || ''] ?? PLAN_PRICING.starter;
  const deviceCount = Math.max(0, Math.floor(rentalDeviceCount || 0));
  const billableDevices = Math.max(0, deviceCount - p.includedDevices);
  const overage = billableDevices * p.perDevice;
  const amount = p.base + overage;
  const vatAmount = Math.round(amount * VAT_RATE * 100) / 100;
  return {
    base: p.base,
    includedDevices: p.includedDevices,
    deviceCount,
    billableDevices,
    perDevice: p.perDevice,
    overage,
    amount,
    vatAmount,
    totalAmount: Math.round((amount + vatAmount) * 100) / 100,
  };
}

/** Fatura satırında gösterilecek insan-okur açıklama. */
export function amountNote(b: AmountBreakdown): string {
  if (b.billableDevices === 0) {
    return `Taban ₺${b.base.toLocaleString('tr-TR')} — ${b.deviceCount} kiralık cihaz (${b.includedDevices} cihaza kadar dahil)`;
  }
  return `Taban ₺${b.base.toLocaleString('tr-TR')} + ${b.billableDevices} × ₺${b.perDevice} aşım — toplam ${b.deviceCount} kiralık cihaz (${b.includedDevices} dahil)`;
}
