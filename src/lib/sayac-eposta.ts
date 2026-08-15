/**
 * Bayinin sayaç e-postası adresi — TEK KAYNAK.
 *
 * Alan adı koda gömülmez: kurulum `nextusservis.com` dışında bir alan adına
 * (ya da geçici bir alt alan adına) oturabilir. Gömülü olsaydı bayi ekranda
 * gerçekte posta almayan bir adres görürdü.
 *
 * KANAL KAPALIYSA ADRES GÖSTERİLMEZ. SAYAC_EPOSTA_SECRET tanımlı değilken uç
 * 503 döner, yani o adrese giden her e-posta sessizce kaybolur. Bayiye
 * "cihazlarına şunu gir" demek, tutulamayacak bir söz vermektir; kart hiç
 * çıkmasın, bayi eski yöntemle devam etsin.
 */
export function sayacAdresi(kod: string | null | undefined): string | null {
  if (!kod) return null;
  if (!process.env.SAYAC_EPOSTA_SECRET) return null;
  const alanAdi = (process.env.SAYAC_EPOSTA_ALANADI || 'nextusservis.com').trim().replace(/^@/, '');
  return `sayac+${kod}@${alanAdi}`;
}
