// Para tutarı doğrulama — her yazma yolunda ortak kullanılır (negatif/NaN/sonsuz engellenir).
export function validateAmount(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
