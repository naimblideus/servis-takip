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
  // KÂR ANALİZİ — anahtar adı tarihsel (veritabanındaki bayi listelerinde
  // böyle duruyor), içeriği genişledi: kaçan gelir, cihaz kârlılığı, filo.
  // Üçü de aynı soruya cevap veriyor: hangi makine para kaybettiriyor.
  REVENUE_RISK: { hrefs: ['/kacan-gelir', '/cihaz-karlilik', '/filo'] },
  REPORTS:      { hrefs: ['/reports'] },
  MARKETPLACE:  { hrefs: ['/market'] },
  // Eskiden yalnız gelen bildirimler kapılıydı, erişimi açan ekran değil:
  // paketi olmayan bayi portalı açabiliyor ama gelenleri göremiyordu.
  PORTAL:       { hrefs: ['/musteri-portali', '/musteri-bildirimleri'] },
  // KURUMSAL PAKET — anahtar adı tarihsel ('SLA'), veritabanındaki bayi
  // listelerinde böyle duruyor. Büyük müşterinin denetlediği dört ekran:
  // SLA uyumu, periyodik bakım, teknisyen karnesi, kurumsal gruplar.
  // SLA ve bakım aynı işin iki yüzü: bakımı planlayamayan bayi müdahale
  // süresini de tutturamaz. Filo buradan Kâr analizine taşındı.
  SLA:          { hrefs: ['/sla', '/bakim', '/teknisyen', '/kurumsal'] },
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
  //
  // ── MERDİVEN: YEM → HEDEF → ÇAPA ──────────────────────────────────────
  // Başlangıç BİLEREK zayıf (2026-07-17 kararı). Kiralık bayinin asıl işi
  // sayaç faturası; fatura Başlangıç'ta olmadığı için her kiralık bayi
  // Profesyonel'den girer ve orada KAÇAN GELİR'i görür — ürünün değerini
  // kanıtlayan ekran. Başlangıç'a fatura eklemek denendi (2026-09-29):
  // bayi ₺350 ucuz diye Başlangıç'ı seçip kancayı hiç görmüyordu. Geri
  // alındı. Başlangıç'ın gerçek alıcısı kiralaması olmayan tamirci.
  //
  // Kurumsal = çapa. Farkı (her ölçekte +₺1.275) boş kalmasın diye büyük
  // müşterinin denetlediği ekranlar yalnız burada: SLA, periyodik bakım,
  // teknisyen karnesi, kurumsal gruplar (SLA anahtarı) + model raporları.
  starter:      ['MARKETPLACE'],
  // Kaçan Gelir BİLEREK Profesyonel'de: satışın ana kancası o panel; denemede
  // görüp Pro alan bayi onu kaybederse güven kazası olur.
  professional: ['INVOICING', 'TRACKING', 'MARKETPLACE', 'ROUTE', 'REVENUE_RISK', 'PORTAL'],
  // Mağaza Kurumsal'dan itibaren: vitrin, alan adı ve yasal sorumluluk taşır.
  enterprise:   ['INVOICING', 'TRACKING', 'MARKETPLACE', 'ROUTE', 'REVENUE_RISK', 'PORTAL', 'REPORTS', 'SLA', 'SHOP'],
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
