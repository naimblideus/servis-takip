// Modül / paket yetkilendirme — "Gelişmiş" özellikler satılabilir eklenti olarak açılır/kapanır.
// Çekirdek (CORE) özellikler her zaman açıktır ve burada YER ALMAZ:
//   tickets, customers, devices, inventory, satis, etiket, accounting (Muhasebe/Cari).
// Eklenti modüller plan'a göre varsayılan açılır; süper-admin bayi bazında override edebilir.

export type ModuleKey = 'INVOICING' | 'ROUTE' | 'TRACKING' | 'REVENUE_RISK' | 'REPORTS' | 'MARKETPLACE' | 'PORTAL' | 'SHOP';

export const MODULES: Record<ModuleKey, { label: string; hrefs: string[] }> = {
  INVOICING:    { label: 'Faturalar & Kira/Sayaç', hrefs: ['/invoices', '/collections'] },
  ROUTE:        { label: 'Rota',                    hrefs: ['/rota'] },
  TRACKING:     { label: 'Takip (geç sayaç)',       hrefs: ['/takip'] },
  REVENUE_RISK: { label: 'Kaçan Gelir',             hrefs: ['/kacan-gelir'] },
  REPORTS:      { label: 'Raporlar',                hrefs: ['/reports'] },
  MARKETPLACE:  { label: 'Bayi Pazarı',             hrefs: ['/market'] },
  PORTAL:       { label: 'Müşteri Paneli',          hrefs: ['/musteri-bildirimleri'] },
  // Nextus Mağaza — bayinin kendi stoğundan beslenen e-ticaret vitrini.
  // Ayrı uygulamada çalışır (nextus-magaza); burada YALNIZ yetki anahtarı
  // tutulur: mağaza açılırken bayinin bu modülü var mı diye bakılır.
  SHOP:         { label: 'Nextus Mağaza',           hrefs: ['/magaza'] },
};

export const ALL_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

// Plan → varsayılan açık modüller (bayiye özel `modules` boşsa bu geçerli)
export const PLAN_MODULES: Record<string, ModuleKey[]> = {
  trial:        ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP'], // denemede her şey görünsün
  // NOT: Bayi Pazarı BİLEREK her planda açık — pazar yeri ancak HERKES içindeyse likidite/ağ etkisi kazanır.
  starter:      ['MARKETPLACE'],                                          // Başlangıç: çekirdek + Pazar
  // Pro: Kaçan Gelir BİLEREK burada. Satışın ana kancası o panel; denemede görüp
  // Pro alan bayi onu kaybederse güven kazası olur. Kurumsal'ın farkı Raporlar'da kalır.
  // Müşteri Paneli Pro'dan itibaren: değeri müşteri sayısıyla büyür, Başlangıç
  // paketindeki küçük bayide karşılığı yok. Satışta net bir yükseltme sebebi.
  professional: ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'MARKETPLACE', 'PORTAL'],
  // Mağaza Kurumsal'dan itibaren: vitrin, alan adı ve yasal sorumluluk taşır;
  // Başlangıç paketindeki bayide karşılığı yok. Satışta net bir yükseltme sebebi.
  enterprise:   ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP'], // Premium
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
  const base = explicit.length ? explicit : (PLAN_MODULES[t.plan || 'trial'] ?? []);
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
