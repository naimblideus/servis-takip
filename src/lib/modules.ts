// Modül / paket yetkilendirme — "Gelişmiş" özellikler satılabilir eklenti olarak açılır/kapanır.
// Çekirdek (CORE) özellikler her zaman açıktır ve burada YER ALMAZ:
//   tickets, customers, devices, inventory, satis, etiket, accounting (Muhasebe/Cari).
// Eklenti modüller plan'a göre varsayılan açılır; süper-admin bayi bazında override edebilir.

export type ModuleKey = 'INVOICING' | 'ROUTE' | 'TRACKING' | 'REVENUE_RISK' | 'REPORTS' | 'MARKETPLACE' | 'PORTAL' | 'SHOP' | 'SLA';

// MODÜL ADI VE AÇIKLAMASI BURADA DEĞİL: sz.modul.ad[k] / sz.modul.aciklama[k].
// Eskiden burada Türkçe sabitti ve İngilizce panelde "Raporlar — not in your
// plan" gibi yarım cümleler çıkıyordu. Burada yalnız YOL eşlemesi kalır;
// yollar çevrilmez, çünkü URL'dir.
export const MODULES: Record<ModuleKey, { hrefs: string[] }> = {
  INVOICING:    { hrefs: ['/invoices', '/collections'] },
  ROUTE:        { hrefs: ['/rota'] },
  TRACKING:     { hrefs: ['/takip'] },
  REVENUE_RISK: { hrefs: ['/kacan-gelir'] },
  REPORTS:      { hrefs: ['/reports'] },
  MARKETPLACE:  { hrefs: ['/market'] },
  PORTAL:       { hrefs: ['/musteri-bildirimleri'] },
  // SLA — sözleşmedeki müdahale/çözüm süresinin ölçümü. Büyük müşterinin
  // denetlediği rapor budur; küçük bayide karşılığı yok, Profesyonel'den
  // itibaren açılır.
  // SLA ve periyodik bakım aynı işin iki yüzü: bakımı planlayamayan bayi
  // müdahale süresini de tutturamaz. Aynı modül anahtarında duruyorlar.
  SLA:          { hrefs: ['/sla', '/bakim'] },
  // Nextus Mağaza — bayinin kendi stoğundan beslenen e-ticaret vitrini.
  // Ayrı uygulamada çalışır (nextus-magaza); burada YALNIZ yetki anahtarı
  // tutulur: mağaza açılırken bayinin bu modülü var mı diye bakılır.
  SHOP:         { hrefs: ['/magaza'] },
};

export const ALL_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

// Plan → varsayılan açık modüller (bayiye özel `modules` boşsa bu geçerli)
export const PLAN_MODULES: Record<string, ModuleKey[]> = {
  trial:        ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP', 'SLA'], // denemede her şey görünsün
  // NOT: Bayi Pazarı BİLEREK her planda açık — pazar yeri ancak HERKES içindeyse likidite/ağ etkisi kazanır.
  starter:      ['MARKETPLACE'],                                          // Başlangıç: çekirdek + Pazar
  // Pro: Kaçan Gelir BİLEREK burada. Satışın ana kancası o panel; denemede görüp
  // Pro alan bayi onu kaybederse güven kazası olur. Kurumsal'ın farkı Raporlar'da kalır.
  // Müşteri Paneli Pro'dan itibaren: değeri müşteri sayısıyla büyür, Başlangıç
  // paketindeki küçük bayide karşılığı yok. Satışta net bir yükseltme sebebi.
  professional: ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'MARKETPLACE', 'PORTAL', 'SLA'],
  // Mağaza Kurumsal'dan itibaren: vitrin, alan adı ve yasal sorumluluk taşır;
  // Başlangıç paketindeki bayide karşılığı yok. Satışta net bir yükseltme sebebi.
  enterprise:   ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP', 'SLA'], // Premium
};

// href → modül (CORE href'ler haritada yok = her zaman erişilebilir)
const HREF_TO_MODULE: Record<string, ModuleKey> = {};
for (const k of ALL_MODULE_KEYS) for (const h of MODULES[k].hrefs) HREF_TO_MODULE[h] = k;

/** Bir sidebar/sayfa href'i hangi modüle ait? CORE ise null. */
export function moduleForHref(href: string): ModuleKey | null {
  if (HREF_TO_MODULE[href]) return HREF_TO_MODULE[href];
  // alt yollar: /market/yeni → /market
  for (const base of Object.keys(HREF_TO_MODULE)) {
    if (href === base || href.startsWith(base + '/')) return HREF_TO_MODULE[base];
  }
  return null;
}

export interface TenantModuleLike {
  plan?: string | null;
  modules?: string[] | null;
  marketEnabled?: boolean | null;
}

/**
 * Bayinin EFEKTİF açık modülleri.
 * - `modules` doluysa = mutlak override (süper-admin'in seçtiği tam liste).
 * - boşsa = plan varsayılanı.
 * - marketEnabled (eski bayrak) açıksa MARKETPLACE geriye-uyumlu eklenir.
 */
export function effectiveModules(t: TenantModuleLike): Set<ModuleKey> {
  const explicit = Array.isArray(t.modules) ? t.modules.filter((m): m is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(m)) : [];
  // TANINMAYAN PAKET BOŞ KÜMEYE DÜŞMEZ.
  // Eskiden `?? []` yazıyordu ve bu, veritabanında ölçülen gerçek bir arızaydı:
  // "basic" paketindeki üç bayinin bütün eklenti modülleri sessizce kapalıydı.
  // Ne hata çıkıyordu ne uyarı; bayi sadece ekranların yokluğunu görüyordu.
  // Artık en düşük ÜCRETLİ pakete düşüyor — yanlış olabilir ama sessizce
  // her şeyi kapatmaktan iyidir. Adlar 20260917030000 göçüyle düzeltildi.
  const base = explicit.length ? explicit : (PLAN_MODULES[t.plan || 'trial'] ?? PLAN_MODULES.starter);
  const set = new Set<ModuleKey>(base);
  if (t.marketEnabled) set.add('MARKETPLACE');
  return set;
}

export function hasModule(t: TenantModuleLike, key: ModuleKey): boolean {
  return effectiveModules(t).has(key);
}

/** Sidebar/sayfa için: bu href bu bayide erişilebilir mi? (CORE → her zaman true) */
export function canAccessHref(t: TenantModuleLike, href: string): boolean {
  const mod = moduleForHref(href);
  if (!mod) return true;
  return hasModule(t, mod);
}
