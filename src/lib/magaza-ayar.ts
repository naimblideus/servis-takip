/**
 * MAĞAZA AYARLARI — servis-takip → Nextus Mağaza (`/api/servis/*`).
 *
 * Bayi mağaza paneline gitmeden ayar, logo ve kampanyayı Servis'ten yönetir.
 * Kurallar (IBAN, yüzde tavanı, unvansız yayın engeli…) MAĞAZADA: burası
 * yalnız vekil. Mağazanın verdiği mesaj (hata, uyarı) ekrana aynen gider.
 *
 * Kimlik: kurulumla aynı SHOP_SERVICE_TOKEN + MAGAZA_API_URL. Bayinin servis
 * kimliği SUNUCUDA eklenir (oturumdan), istemciden alınmaz.
 *
 * Mağaza henüz bu uçları içermeyen bir sürümdeyse yol 404 döner ve gövde
 * JSON değildir (Next'in sayfa bulunamadı ekranı): o durum "mağaza
 * güncelleniyor" olarak ayrılır, çökme ya da yanlış "mağaza yok" demez.
 */
export type MagazaYaniti =
  | { durum: 'TAMAM'; kod: number; govde: Record<string, unknown> }
  | { durum: 'AYAR_YOK' | 'GUNCELLENIYOR' | 'ULASILAMADI' };

export async function magazaIstegi(
  yol: string,
  init: { method?: string; json?: unknown; form?: FormData; zamanAsimiMs?: number } = {},
): Promise<MagazaYaniti> {
  const taban = (process.env.MAGAZA_API_URL ?? '').replace(/\/+$/, '');
  const jeton = process.env.SHOP_SERVICE_TOKEN ?? '';
  if (!taban || jeton.length < 24) return { durum: 'AYAR_YOK' };

  try {
    const r = await fetch(`${taban}${yol}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${jeton}`,
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
      cache: 'no-store',
      signal: AbortSignal.timeout(init.zamanAsimiMs ?? 20_000),
    });
    const tur = r.headers.get('content-type') ?? '';
    const govde = tur.includes('application/json')
      ? ((await r.json().catch(() => null)) as Record<string, unknown> | null)
      : null;
    // JSON olmayan yanıt: uç bu mağaza sürümünde yok (404 sayfası) ya da ara katman hatası.
    if (!govde) return r.status === 404 || r.status === 405 ? { durum: 'GUNCELLENIYOR' } : { durum: 'ULASILAMADI' };
    return { durum: 'TAMAM', kod: r.status, govde };
  } catch {
    return { durum: 'ULASILAMADI' };
  }
}

/** Servis ucunun istemciye döndüreceği yanıt (kod + gövde). */
export function magazaYanitiCevir(y: MagazaYaniti): { kod: number; govde: Record<string, unknown> } {
  if (y.durum === 'TAMAM') {
    // Mağazanın "bu bayiye bağlı mağaza yok" cevabı ayrı bir kodla.
    if (y.kod === 404 && y.govde.ok === false) return { kod: 404, govde: { ok: false, kod: 'MAGAZA_YOK' } };
    if (y.kod === 401 || y.kod === 503) return { kod: 503, govde: { ok: false, kod: 'AYAR_YOK' } };
    if (y.kod === 429) return { kod: 429, govde: { ok: false, kod: 'SINIR' } };
    return { kod: y.kod, govde: y.govde };
  }
  return { kod: 503, govde: { ok: false, kod: y.durum } };
}
