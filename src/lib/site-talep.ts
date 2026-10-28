/**
 * MAĞAZA SİTESİNDEN SERVİS TALEBİ — saf kurallar (uç: api/shop/talep).
 * Testte doğrudan derlenir: veritabanı yok.
 */

const sade = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşöçı]/g, '');

/**
 * Yazılan model müşterinin hangi cihazı? Yalnız TEK adaya oturursa bağlanır;
 * model yazılmadıysa ve müşterinin tek cihazı varsa o. Belirsizse cihazsız
 * kalır: yanlış cihaza arıza yazmaktansa bayi onaylarken seçer.
 */
export function cihazSec(cihazlar: { id: string; brand: string | null; model: string | null }[], model: string): string | null {
  const m = sade(model);
  if (!m) return cihazlar.length === 1 ? cihazlar[0].id : null;
  const adaylar = cihazlar.filter((c) => {
    const tam = sade(`${c.brand ?? ''}${c.model ?? ''}`);
    const yalniz = sade(c.model ?? '');
    return (tam && tam.includes(m)) || (yalniz.length >= 3 && m.includes(yalniz));
  });
  return adaylar.length === 1 ? adaylar[0].id : null;
}

/** Talebin kuyruktaki açıklaması; son satır talep kimliği (aynı talep ikinci kez açılmasın). */
export function talepAciklamasi(t: { talepId: string; ad: string; telefon: string; model: string; mesaj: string }): string {
  return [`Siteden servis talebi · ${t.ad} · ${t.telefon}`, t.model ? `Cihaz: ${t.model}` : null, t.mesaj || null, talepEtiketi(t.talepId)]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
}

export const talepEtiketi = (talepId: string) => `[site:${talepId}]`;
