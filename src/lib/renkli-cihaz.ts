// RENKLİ Mİ? — sayaç girişinde renkli alanın sorulup sorulmayacağı.
//
// NEDEN (ölçülmüş engel): cihaz sayfasındaki sayaç girişi renkli sayacı da
// ZORUNLU tutuyordu. Pantum modellerinin çoğu siyah-beyaz; teknisyen renkli
// kutusuna ne yazacağını bilemiyor, boş bırakınca "Ekle" düğmesi hiç açılmıyordu.
// Sayaç Turu (api/readings/bulk) bu soruyu zaten soruyor ve renkli sütunu yalnız
// renkli kanıtı olan cihazda gösteriyor; burada AYNI ölçüt kullanılıyor ki iki
// ekran aynı cihaza farklı davranmasın.

export interface RenkliKanit {
  includedColor?: number | null;      // sözleşmede renkli sayfa paketi
  pricePerColor?: number | null;      // cihaza özel renkli fiyat
  overagePriceColor?: number | null;  // renkli aşım fiyatı
  counterColor?: number | null;       // bilinen renkli sayaç
}

/** api/readings/bulk ile aynı kural: renkli paket/fiyat tanımlı ya da renkli sayaç sıfırdan büyük. */
export function renkliMi(d: RenkliKanit): boolean {
  return (d.includedColor ?? 0) > 0 || d.pricePerColor != null || d.overagePriceColor != null || (d.counterColor ?? 0) > 0;
}

/** "Ekle/Kaydet" ne zaman açılır: siyah her zaman; renkli yalnız renkli cihazda. */
export function sayacGirisiTamam(renkli: boolean, siyah: string, renk: string): boolean {
  if (siyah.trim() === '') return false;
  return renkli ? renk.trim() !== '' : true;
}

/**
 * Sunucuya gidecek renkli sayaç. Siyah-beyaz cihazda kutu yok: cihazın BİLİNEN
 * renkli sayacı aynen gönderilir (genelde 0). 0'a çekmek "sayaç düştü" uyarısı,
 * boş göndermek uçta "zorunlu alan" hatası olurdu.
 */
export function gonderilecekRenkli(renkli: boolean, girilen: string, mevcut: number | null | undefined): number {
  if (renkli) return parseInt(girilen, 10);
  return Math.max(0, Math.trunc(Number(mevcut ?? 0)) || 0);
}
