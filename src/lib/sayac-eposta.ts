/**
 * Bayinin sayaç e-postası adresi — TEK KAYNAK.
 *
 * Adresin İKİ parçası da koda gömülmez:
 *   SAYAC_EPOSTA_KULLANICI  varsayılan 'sayac'
 *   SAYAC_EPOSTA_ALANADI    varsayılan 'nextusservis.com'
 *
 * Kullanıcı kısmı niye ayarlanabilir: kendi alan adı alınana kadar kanal
 * Gmail üzerinden yürüyebiliyor (Gmail artı-adreslemeyi destekler, bayi kodu
 * şeması aynen çalışır). O kurulumda yerel kısım hesabın kendi adıdır —
 * 'sayac' değil. Alan adı gelince iki değişken değişir, kod değişmez.
 *
 * KANAL KAPALIYSA ADRES GÖSTERİLMEZ. SAYAC_EPOSTA_SECRET tanımlı değilken uç
 * 503 döner, yani o adrese giden her e-posta sessizce kaybolur. Bayiye
 * "cihazlarına şunu gir" demek, tutulamayacak bir söz vermektir; kart hiç
 * çıkmasın, bayi eski yöntemle devam etsin.
 */
export function sayacAdresi(kod: string | null | undefined): string | null {
  if (!kod) return null;
  if (!process.env.SAYAC_EPOSTA_SECRET) return null;
  const kullanici = (process.env.SAYAC_EPOSTA_KULLANICI || 'sayac').trim().replace(/[^a-z0-9._-]/gi, '');
  return `${kullanici}+${kod}@${sayacAlanAdi()}`;
}

/** Adresin alan adı kısmı — kurma ve çözme aynı değeri kullansın diye ayrı. */
export function sayacAlanAdi(): string {
  return (process.env.SAYAC_EPOSTA_ALANADI || 'nextusservis.com').trim().replace(/^@/, '');
}

/**
 * Bir `To:` başlığındaki OLASI bayi kodları — adres çözme, adres kurmanın tersi.
 *
 * Neden çoğul: saha kuralı "cihazdaki mevcut alıcıyı SİLME, yanına EKLE".
 * Yani gerçek başlık çok alıcılıdır ve bizim adres genelde EN SONDADIR:
 *   `muhasebe@firma.com, bt@firma.com, sayac+xc3vwwqb@nextusservis.com`
 *
 * Tek kalıbın ilk eşleşmesine güvenmek iki türlü kırılıyordu:
 *   • düz biçim dizgeye çapalanırsa (/^…/) çok alıcılı başlıkta hiç tutmaz;
 *   • alakasız bir etiketli adres (`muhasebe+fatura@firma.com`) ilk eşleşmeyi
 *     kapıp geçerli raporu yanlış koda düşürür.
 * Bu yüzden BÜTÜN adaylar döndürülür; hangisinin gerçek bayi olduğuna
 * veritabanı karar verir.
 *
 * Düz biçim (`kod@alanadi`) YALNIZ kendi alan adımızda aranır — yoksa her
 * `muhasebe@firma.com` bir bayi kodu sanılırdı.
 */
export function bayiKodAdaylari(to: string | null | undefined): string[] {
  if (!to) return [];
  const kacir = (m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const artili = to.matchAll(/\+([a-z0-9]{4,32})@/gi);
  const duz = to.matchAll(new RegExp(`(?:^|[\\s<,;:])([a-z0-9]{4,32})@${kacir(sayacAlanAdi())}`, 'gi'));
  return [...new Set([...artili, ...duz].map((m) => m[1].toLowerCase()))];
}
