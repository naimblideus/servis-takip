// Matbaa ekranlarında saat: bugünse "14:30", değilse "03.11 14:30".
// Bayinin saat diliminde; sunucu UTC'de çalışıyor.
export function saatYaz(d: Date | string | null | undefined, dil: string, tz: string, simdi = new Date()): string {
  if (!d) return '';
  const t = new Date(d);
  const yer = dil === 'en' ? 'en-GB' : 'tr-TR';
  const gun = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(x);
  const saat = new Intl.DateTimeFormat(yer, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(t);
  if (gun(t) === gun(simdi)) return saat;
  const tarih = new Intl.DateTimeFormat(yer, { timeZone: tz, day: '2-digit', month: '2-digit' }).format(t);
  return `${tarih} ${saat}`;
}

/** Kuruş → para metni için TL sayısı. */
export const tl = (kurus: number) => kurus / 100;
