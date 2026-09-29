// MENÜ AİLELERİ — yan menünün, sayfa üstü sekme çubuğunun ve teknisyen
// menüsünün TEK kaynağı.
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Menü 40 düz öğeye çıkmıştı ve aynı iş beş ekrana dağılmıştı: sayaç
// girişi, geciken sayaç, cihazdan gelen sayaç ve portal bildirimi ayrı
// ayrı menü öğesiydi. Ayın en önemli işi (sayaç → fatura → tahsilat) menüde
// üç farklı yerde duruyordu, faturalar ise varsayılan KAPALI "Gelişmiş"
// klasöründeydi.
//
// Artık her menü öğesi bir AİLE: aynı işin ekranları tek başlık altında,
// sayfanın üstünde sekme olarak durur. Hiçbir ekran silinmedi, hiçbir adres
// değişmedi; eski bağlantılar ve yer imleri çalışmaya devam eder.
//
// ── KURAL TEK YERDE ──────────────────────────────────────────────────────
// Bir ekranın kime görüneceği (rol, ülke, paket, kanal kurulu mu) yalnız
// `hrefErisilir` ile karar verilir. Yan menü ile sekme çubuğu ayrı karar
// verseydi, menüde gizli bir ekran sekmede görünürdü.
//
// Bu dosya React'e ve veritabanına dokunmaz; testte doğrudan derlenir.

import { moduleForHref } from './modules';

export type Bolum = 'GUNLUK' | 'MUSTERI' | 'PARA' | 'STOK' | 'ANALIZ' | 'SISTEM';

export const BOLUM_SIRASI: readonly Bolum[] = ['GUNLUK', 'MUSTERI', 'PARA', 'STOK', 'ANALIZ', 'SISTEM'];

export interface Aile {
  /** Sözlük anahtarı (sz.menuAile). Tek üyeli ailede ekranın kendi adı kullanılır. */
  anahtar: string;
  bolum: Bolum;
  /** Sekme sırası. Yan menü bağlantısı, erişilebilir İLK üyedir. */
  uyeler: readonly string[];
}

export const AILELER: readonly Aile[] = [
  { anahtar: 'panel',      bolum: 'GUNLUK',  uyeler: ['/dashboard'] },
  { anahtar: 'fisler',     bolum: 'GUNLUK',  uyeler: ['/tickets'] },
  { anahtar: 'whatsapp',   bolum: 'GUNLUK',  uyeler: ['/whatsapp'] },
  { anahtar: 'rota',       bolum: 'GUNLUK',  uyeler: ['/rota'] },

  { anahtar: 'musteriler', bolum: 'MUSTERI', uyeler: ['/customers'] },
  // Toplu işlemler cihaz listesinin yanında: ikisi de "çok cihaza yaz,
  // önizle, onayla" ve ikisi de cihaz listesinden başlar.
  { anahtar: 'cihazlar',   bolum: 'MUSTERI', uyeler: ['/devices', '/toplu-ayar', '/toplu-zam'] },
  // Erişimi açan ekran ile gelenleri gösteren ekran aynı özelliğin iki yüzü.
  { anahtar: 'portal',     bolum: 'MUSTERI', uyeler: ['/musteri-portali', '/musteri-bildirimleri'] },

  // Paranın kaynağı. Sayaç okunmazsa fatura kesilmez; bu yüzden faturadan önce.
  // Ağ Tarayıcı sonda: kurulum ekranı, günlük iş değil.
  { anahtar: 'sayaclar',   bolum: 'PARA',    uyeler: ['/sayac-turu', '/takip', '/sayac-eposta', '/sayac-tarayici'] },
  // Ay sonu zinciri: kes → e-fatura dosyası → tahsil et.
  { anahtar: 'faturalama', bolum: 'PARA',    uyeler: ['/invoices', '/e-fatura', '/collections'] },
  { anahtar: 'sozlesme',   bolum: 'PARA',    uyeler: ['/sozlesmeler', '/teklifler'] },
  { anahtar: 'muhasebe',   bolum: 'PARA',    uyeler: ['/accounting', '/kdv'] },

  // Toner verimi sarfın ön koşulu: beklenen verim orada tanımlanır.
  { anahtar: 'stok',       bolum: 'STOK',    uyeler: ['/inventory', '/sarf', '/toner-verimi', '/satis', '/etiket'] },
  { anahtar: 'pazar',      bolum: 'STOK',    uyeler: ['/market'] },
  { anahtar: 'magaza',     bolum: 'STOK',    uyeler: ['/magaza'] },

  // Tek soru: hangi makine ya da müşteri para kaybettiriyor.
  { anahtar: 'kar',        bolum: 'ANALIZ',  uyeler: ['/kacan-gelir', '/cihaz-karlilik', '/filo', '/reports'] },
  // Büyük müşterinin denetlediği ekranlar.
  { anahtar: 'kurumsal',   bolum: 'ANALIZ',  uyeler: ['/bakim', '/sla', '/teknisyen', '/kurumsal'] },

  { anahtar: 'ayarlar',    bolum: 'SISTEM',  uyeler: ['/settings', '/users', '/import'] },
  { anahtar: 'yardim',     bolum: 'SISTEM',  uyeler: ['/yardim'] },
  { anahtar: 'admin',      bolum: 'SISTEM',  uyeler: ['/admin'] },
];

/** Yalnız süper yönetici. */
export const YALNIZ_SUPER: readonly string[] = ['/admin'];

/**
 * Yalnız bayi yöneticisi.
 *
 * Para gösteren ekranlar burada: kâr, marj, borç, karne. Teknisyenin ya da
 * ön büronun cihaz başına kârı görmesi bayinin istemediği bir şey. Toplu
 * yazma ekranları da burada; uçları zaten yönetici istiyor, menüde görünüp
 * açılınca 403 vermesi kötü deneyim.
 */
export const YALNIZ_YONETICI: readonly string[] = [
  '/users', '/settings', '/import',
  '/accounting', '/kdv', '/sozlesmeler', '/teklifler',
  '/invoices', '/e-fatura', '/collections',
  '/kacan-gelir', '/cihaz-karlilik', '/filo', '/reports',
  '/teknisyen', '/kurumsal',
  '/satis', '/toplu-ayar', '/toplu-zam',
  // Tarayıcı anahtarını üretmek bayi adına sayaç göndermeye yetki vermek demek.
  '/sayac-tarayici',
];

/**
 * TÜRKİYE'YE ÖZGÜ ekranlar: GİB e-Fatura ve KDV özeti. Avrupalı bayide
 * anlamsız (orada Peppol/XRechnung var, GİB yok).
 */
export const YALNIZ_TR: readonly string[] = ['/e-fatura', '/kdv'];

/**
 * TEKNİSYEN MENÜSÜ — sahadaki adamın telefonunda gördüğü şey.
 *
 * Eskiden teknisyen yöneticiyle aynı menüyü görüyordu: 27 öğe. Sahada
 * gereken üç iş var: işlerime bak, sayacı gir, parçayı bul. Liste bu
 * üç işin ekranlarından ibaret; müşteri ve cihaz yalnız bakmak için.
 */
export const TEKNISYEN_MENUSU: readonly string[] = [
  '/tickets', '/rota',
  '/sayac-turu', '/takip',
  '/customers', '/devices',
  '/inventory', '/sarf',
  '/yardim',
];

export interface Erisim {
  rol: string;
  ulke: string;
  moduller: readonly string[];
  whatsappKurulu: boolean;
}

export function yonetici(rol: string): boolean {
  return rol === 'ADMIN' || rol === 'SUPER_ADMIN';
}

/** Bu ekran bu kullanıcıya menüde/sekmede gösterilir mi? */
export function hrefErisilir(href: string, e: Erisim): boolean {
  if (YALNIZ_SUPER.includes(href) && e.rol !== 'SUPER_ADMIN') return false;
  if (YALNIZ_TR.includes(href) && e.ulke !== 'TR') return false;
  if (YALNIZ_YONETICI.includes(href) && !yonetici(e.rol)) return false;
  if (e.rol === 'TECHNICIAN' && !TEKNISYEN_MENUSU.includes(href)) return false;
  // Paket kapısı: eklenti modüle ait ekran bayide kapalıysa görünmez.
  const mod = moduleForHref(href);
  if (mod && !e.moduller.includes(mod)) return false;
  // Kurulmamış kanal hiç gösterilmez: boş odayı kapatmak da hâlâ oda.
  if (href === '/whatsapp' && !e.whatsappKurulu) return false;
  return true;
}

export interface MenuAilesi {
  aile: Aile;
  /** Yan menü bağlantısı: erişilebilir ilk üye. */
  giris: string;
  /** Bu kullanıcının görebildiği sekmeler, sırasıyla. */
  sekmeler: string[];
}

export interface MenuBolumu {
  bolum: Bolum;
  aileler: MenuAilesi[];
}

/**
 * Kullanıcının göreceği menü. Hiç sekmesi kalmayan aile, hiç ailesi
 * kalmayan bölüm düşer; boş başlık gösterilmez.
 */
export function menuKur(e: Erisim): MenuBolumu[] {
  const out: MenuBolumu[] = [];
  for (const bolum of BOLUM_SIRASI) {
    const aileler: MenuAilesi[] = [];
    for (const aile of AILELER) {
      if (aile.bolum !== bolum) continue;
      const sekmeler = aile.uyeler.filter((h) => hrefErisilir(h, e));
      if (sekmeler.length) aileler.push({ aile, giris: sekmeler[0], sekmeler });
    }
    if (aileler.length) out.push({ bolum, aileler });
  }
  return out;
}

/** Yol bu ekrana mı, alt sayfasına mı ait? `/devices/123` → `/devices`. */
export function yolEslesir(yol: string, href: string): boolean {
  return yol === href || yol.startsWith(href + '/');
}

/** Yolun ait olduğu aile (alt sayfalar dahil). En uzun eşleşme kazanır. */
export function aileBul(yol: string): Aile | null {
  let bulunan: Aile | null = null;
  let uzunluk = -1;
  for (const aile of AILELER) {
    for (const h of aile.uyeler) {
      if (yolEslesir(yol, h) && h.length > uzunluk) { bulunan = aile; uzunluk = h.length; }
    }
  }
  return bulunan;
}

/**
 * Sekme çubuğu hangi sayfada çizilir? Yalnız ailenin LİSTE ekranlarında.
 * `/devices/abc` gibi bir detay sayfasında sekme gürültüdür: kullanıcı
 * orada tek bir cihaza bakıyor, aile arasında gezinmiyor.
 */
export function sekmeGosterilir(yol: string, e: Erisim): { aile: Aile; sekmeler: string[]; aktif: string } | null {
  const aile = aileBul(yol);
  if (!aile || !aile.uyeler.includes(yol)) return null;
  const sekmeler = aile.uyeler.filter((h) => hrefErisilir(h, e));
  if (sekmeler.length < 2 || !sekmeler.includes(yol)) return null;
  return { aile, sekmeler, aktif: yol };
}

export type RozetAnahtari = 'market' | 'sayacEposta' | 'musteriBildirim' | 'magaza';

/** Bekleyen iş rozeti olan ekranlar → rozet anahtarı. */
export const ROZETLI: Readonly<Record<string, RozetAnahtari>> = {
  '/market': 'market',
  '/sayac-eposta': 'sayacEposta',
  '/musteri-bildirimleri': 'musteriBildirim',
  '/magaza': 'magaza',
};

/** Bir ekranın rozeti. */
export function hrefRozeti(href: string, sayilar: Partial<Record<RozetAnahtari, number>>): number {
  const k = ROZETLI[href];
  return k ? (sayilar[k] ?? 0) : 0;
}

/** Ailenin rozeti: görünen sekmelerinin bekleyen işlerinin toplamı. */
export function aileRozeti(sekmeler: readonly string[], sayilar: Partial<Record<RozetAnahtari, number>>): number {
  let toplam = 0;
  for (const h of sekmeler) toplam += hrefRozeti(h, sayilar);
  return toplam;
}
