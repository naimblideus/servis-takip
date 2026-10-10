/**
 * Sunucu açılışı. Yalnız üretimde ve Node çalışma ortamında uygulama içi
 * zamanlayıcıyı başlatır (lib/zamanlayici.ts). ZAMANLAYICI=kapali ile kapanır.
 *
 * Next bu dosyayı Edge için de derler: Node modülleri (child_process, fs)
 * yalnız NEXT_RUNTIME === 'nodejs' dalındaki dinamik import'la yüklenir —
 * Next'in belgelediği biçim; erken dönüşle yazılırsa Edge derlemesi onları
 * da paketlemeye çalışır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NODE_ENV !== 'production' || process.env.ZAMANLAYICI === 'kapali') return;
    const { zamanlayiciyiBaslat } = await import('./lib/zamanlayici');
    zamanlayiciyiBaslat();
  }
}
