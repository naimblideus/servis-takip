/**
 * MAĞAZAYI KURDUR — servis-takip → Nextus Mağaza.
 *
 * Bayi Servis panelinde "Mağazamı kurun"a basınca mağaza uygulamasının
 * `POST /api/kurulum` ucu çağrılır: mağaza bayinin servis stoğundan katalog,
 * fiyat ve uyumlulukla kurulur, KAPALI doğar (yasal bilgiler bayiden), panel
 * için tek kullanımlık davet döner. Aynı bayi ikinci kez basarsa yeni mağaza
 * açılmaz, yalnız yeni davet döner (uç idempotent).
 *
 * Kimlik: iki uygulamanın zaten paylaştığı SHOP_SERVICE_TOKEN (mağaza servis
 * uçlarını bununla çağırıyor; burada ters yön). Adres: MAGAZA_API_URL —
 * mağaza uygulamasına ulaşan herhangi bir adres (ör. platform adresi).
 * İkisinden biri yoksa kurulum denenmez (`AYAR_YOK`); çağıran yine talep
 * kaydeder ve platform sahibi mağazayı elle kurar. Sessiz başarısızlık yok.
 */
export type KurulumSonucu =
  | {
      ok: true;
      yeni: boolean;
      slug: string;
      /** Mağazanın çalışan adresi; alan adı bağlanmadıysa null. */
      adres: string | null;
      /** Tek kullanımlık panel daveti (tam adres); adres yoksa null. */
      davet: string | null;
      urun: number;
      yayinda: number;
    }
  | { ok: false; kod: 'AYAR_YOK' | 'HATA'; hata: string };

/**
 * Vitrin adı: servis kaydındaki firma adı bazen not taşıyor ("SAYGILI
 * FOTOKOPİ ///// FİYATA KDV DAHİL DEĞİLDİR"). Mağaza adı tahmin etmez,
 * gelen metin vitrin adı ve kısa ad olur; not burada, çift eğik çizgiden
 * itibaren kesilir. Tek eğik çizgi ("Kırtasiye/Fotokopi") addır, kalır.
 */
export function vitrinAdi(ad: string): string {
  const kisa = ad.split(/\s*\/{2,}/)[0].replace(/\s+/g, ' ').trim();
  return kisa || ad.trim();
}

/**
 * Adres gerçekten açılıyor mu? Mağaza `slug.SHOP_BASE_DOMAIN` adresini
 * hesaplar ama joker DNS yoksa o ad çözülmez; bayiye "panelinizi açın"
 * deyip bozuk bağlantı vermektense "adres bağlanıyor" denir. Geliştirmede
 * denetlenmez (yerel adresler https değil).
 */
export async function adresCalisiyor(adres: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    const r = await fetch(`${adres.replace(/\/+$/, '')}/api/saglik`, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function magazaKurdur(o: {
  tenantId: string;
  firma: string;
  sehir?: string | null;
  telefon?: string | null;
  eposta?: string | null;
}): Promise<KurulumSonucu> {
  const taban = (process.env.MAGAZA_API_URL ?? '').replace(/\/+$/, '');
  const jeton = process.env.SHOP_SERVICE_TOKEN ?? '';
  if (!taban || jeton.length < 24) return { ok: false, kod: 'AYAR_YOK', hata: 'MAGAZA_API_URL ya da SHOP_SERVICE_TOKEN tanımlı değil' };

  try {
    const r = await fetch(`${taban}/api/kurulum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(o),
      cache: 'no-store',
      // Katalog aktarımı birkaç yüz üründe on saniyeleri bulabilir.
      signal: AbortSignal.timeout(90_000),
    });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!r.ok || !j || j.ok !== true) {
      return { ok: false, kod: 'HATA', hata: String(j?.hata ?? `Mağaza yanıtı ${r.status}`).slice(0, 300) };
    }
    return {
      ok: true,
      yeni: j.yeni === true,
      slug: String(j.slug ?? ''),
      adres: typeof j.adres === 'string' && j.adres ? j.adres : null,
      davet: typeof j.davet === 'string' && j.davet ? j.davet : null,
      urun: Number(j.urun) || 0,
      yayinda: Number(j.yayinda) || 0,
    };
  } catch (e) {
    return { ok: false, kod: 'HATA', hata: `Mağazaya ulaşılamadı: ${(e as Error).message}`.slice(0, 300) };
  }
}
