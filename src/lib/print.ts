// Yazdırılabilir bir sayfayı aç.
// Kurulu PWA'da (standalone) window.open('_blank') engellenir (özellikle iOS) → hiçbir şey açılmaz.
// Bu yüzden standalone'da AYNI pencerede aç (print sayfalarında "← geri" bağlantısı var).
// Normal tarayıcıda yeni sekme; popup engellenirse aynı pencereye düş.
export function openPrintable(url: string) {
  if (typeof window === 'undefined') return;
  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as any).standalone === true;
  if (standalone) {
    window.location.href = url;
  } else {
    const w = window.open(url, '_blank');
    if (!w) window.location.href = url;
  }
}
