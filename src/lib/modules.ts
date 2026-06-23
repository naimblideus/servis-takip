// Modül / paket yetkilendirme — "Gelişmiş" özellikler satılabilir eklenti olarak açılır/kapanır.
// Çekirdek (CORE) özellikler her zaman açıktır ve burada YER ALMAZ:
//   tickets, customers, devices, inventory, satis, etiket, accounting (Muhasebe/Cari).
// Eklenti modüller plan'a göre varsayılan açılır; süper-admin bayi bazında override edebilir.

export type ModuleKey = 'INVOICING' | 'ROUTE' | 'TRACKING' | 'REVENUE_RISK' | 'REPORTS' | 'MARKETPLACE';

export const MODULES: Record<ModuleKey, { label: string; hrefs: string[] }> = {
  INVOICING:    { label: 'Faturalar & Kira/Sayaç', hrefs: ['/invoices', '/collections'] },
  ROUTE:        { label: 'Rota',                    hrefs: ['/rota'] },
  TRACKING:     { label: 'Takip (geç sayaç)',       hrefs: ['/takip'] },
  REVENUE_RISK: { label: 'Kaçan Gelir',             hrefs: ['/kacan-gelir'] },
  REPORTS:      { label: 'Raporlar',                hrefs: ['/reports'] },
  MARKETPLACE:  { label: 'Bayi Pazarı',             hrefs: ['/market'] },
};

export const ALL_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

// Plan → varsayılan açık modüller (bayiye özel `modules` boşsa bu geçerli)
export const PLAN_MODULES: Record<string, ModuleKey[]> = {
  trial:        ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE'], // denemede her şey görünsün
  starter:      [],                                        // Başlangıç: yalnız çekirdek
  professional: ['INVOICING', 'ROUTE', 'TRACKING'],        // Pro
  enterprise:   ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE'], // Premium
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
