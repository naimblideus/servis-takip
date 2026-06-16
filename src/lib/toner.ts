// Toner/sarf tükenme tahmini — sayaç hızından "kaç gün sonra toner lazım" hesaplar.
// Saf fonksiyonlar (server + client'ta kullanılabilir).

export interface TonerReadingPoint {
  readingDate: Date | string;
  counterBlack: number;
  counterColor: number;
}

export interface TonerForecast {
  channel: 'black' | 'color';
  yield: number;
  reset: number | null;
  current: number;
  pagesUsed: number | null;
  remaining: number | null;
  remainingPct: number | null;
  dailyRate: number | null;
  daysLeft: number | null;
  needsSetup: boolean; // yield tanımlı ama "toner değişti" referansı yok
}

/** Son okumalardan günlük ortalama baskı hızı (sayfa/gün). Yetersiz veri → null. */
export function dailyRate(points: TonerReadingPoint[], channel: 'black' | 'color'): number | null {
  if (!points || points.length < 2) return null;
  const sorted = [...points].sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime()
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const val = (p: TonerReadingPoint) => (channel === 'black' ? p.counterBlack : p.counterColor);
  const days = (new Date(last.readingDate).getTime() - new Date(first.readingDate).getTime()) / 86400000;
  if (days < 0.5) return null; // aynı gün — anlamlı hız yok
  const delta = val(last) - val(first);
  if (delta <= 0) return null;
  return delta / days;
}

/** Bir kanal (S/B veya renkli) için tükenme tahmini. yield yoksa null (takip kapalı). */
export function forecastChannel(opts: {
  yieldPages: number | null;
  reset: number | null;
  current: number | null;
  rate: number | null;
  channel: 'black' | 'color';
}): TonerForecast | null {
  const { yieldPages, reset, current, rate, channel } = opts;
  if (!yieldPages || yieldPages <= 0) return null; // bu kanal için toner takibi yok
  const cur = current ?? 0;
  if (reset == null) {
    return {
      channel, yield: yieldPages, reset: null, current: cur,
      pagesUsed: null, remaining: null, remainingPct: null,
      dailyRate: rate, daysLeft: null, needsSetup: true,
    };
  }
  const pagesUsed = Math.max(0, cur - reset);
  const remaining = Math.max(0, yieldPages - pagesUsed); // toner verimini aşınca negatif olmasın
  const remainingPct = Math.max(0, Math.round((remaining / yieldPages) * 100));
  const daysLeft = rate && rate > 0 ? Math.max(0, Math.floor(remaining / rate)) : null;
  return {
    channel, yield: yieldPages, reset, current: cur,
    pagesUsed, remaining, remainingPct, dailyRate: rate, daysLeft, needsSetup: false,
  };
}

/** Cihazın en acil kanalına göre kalan gün (sıralama için). Veri yoksa null. */
export function soonestDaysLeft(forecasts: (TonerForecast | null)[]): number | null {
  const days = forecasts.filter((f): f is TonerForecast => !!f && f.daysLeft != null).map((f) => f.daysLeft as number);
  return days.length ? Math.min(...days) : null;
}
