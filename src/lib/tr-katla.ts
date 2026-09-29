/**
 * TÜRKÇE GÜVENLİ KATLAMA — arama ve eşleştirme için.
 *
 * Önce tr-TR küçült (İ→i, I→ı), SONRA ASCII'ye indir. Sıra önemli: düz
 * toLowerCase() ya da `/i` bayrağı "İ"yi "i̇" (i + birleşik nokta) yapar;
 * "ADLİYE" hiçbir zaman "adliye" aramasıyla bulunmaz. Katlanmış iki metin
 * karşılaştırılınca kullanıcı "sisli" yazsa da "ŞİŞLİ"yi bulur.
 *
 * Bağımlılığı yok; hem sunucuda hem tarayıcıda çalışır.
 */
export function katla(s: string | null | undefined): string {
  return (s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** `metin` içinde `aranan` geçiyor mu — ikisi de katlanarak. */
export function icerir(metin: string | null | undefined, aranan: string | null | undefined): boolean {
  return katla(metin).includes(katla(aranan).trim());
}
