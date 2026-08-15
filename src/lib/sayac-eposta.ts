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
  const alanAdi = (process.env.SAYAC_EPOSTA_ALANADI || 'nextusservis.com').trim().replace(/^@/, '');
  return `${kullanici}+${kod}@${alanAdi}`;
}
