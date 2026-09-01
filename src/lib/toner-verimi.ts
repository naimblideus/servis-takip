/**
 * TONER VERİMİ — model bazında toplu doldurma.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────
 * Toner tükenme tahmini bu ürünün en güçlü özelliği ve şu an ÇALIŞMIYOR.
 * Sebep tek bir alan: `Device.tonerYieldBlack`. `forecastChannel` verim
 * yoksa `null` dönüyor — yani takip tamamen kapalı, "veri yetersiz" bile
 * demiyor.
 *
 * Ölçüldü (Saygılı Fotokopi, 2026-09-01):
 *   854 cihaz · sayaç değeri olan 724 · SB verimi tanımlı olan 1
 *
 * Yani 853 cihazda özellik kilitli ve kimse bunu bilmiyor.
 *
 * ── NEDEN MODEL BAZINDA ───────────────────────────────────────────────
 * Verim cihazın değil MODELİN özelliği: aynı yazıcıya takılan toner hep
 * aynı sayfayı basar. 854 kaydı tek tek açmak kimsenin yapmayacağı bir iş
 * (portal erişiminde aynısı yaşandı: 305 kart, 0 açılmış). Model bazında
 * 401 satır var ama dağılım eşit değil — ilk 20 model 250 cihazı, ilk 50
 * model 391 cihazı kapsıyor. Bayi istediği yerde durabiliyor ve durduğu
 * yere kadar yaptığı iş en çok cihazı açmış oluyor.
 *
 * ── MODEL KODU BİLEREK BİRLEŞTİRİLMİYOR ───────────────────────────────
 * Kayıtlarda "HP P2035" ve "HP 2035" ayrı satır olarak duruyor ve aslında
 * aynı yazıcı. Bunları otomatik birleştirmek cazip ama tehlikeli: aynı
 * kuralla "MS410" ile "MS410DN" ya da "M404" ile "M404DW" de birleşir ve
 * bunlar FARKLI verimde olabilir. Yanlış verim, yanlış tahmin üretir ve
 * yanlış tahmin bu üründe en pahalı hatadır — bayi müşteriye "toneri
 * bitmek üzere" der, değildir.
 *
 * Marka kanonikleştiriliyor (`normalizeBrandModel`, ters kayıtları da
 * düzeltiyor), model kodu yalnız boşluk/noktalama temizliğinden geçiyor.
 * İki yazım ayrı satır kalıyor ama yan yana sıralanıyor — bayi görüp
 * ikisini de dolduruyor.
 */
import { prisma } from '@/lib/prisma';
import { normalizeBrandModel } from '@/lib/device-brands';

/**
 * Makul verim aralığı.
 *
 * Alt sınır 100: daha küçük bir sayı yazım hatasıdır ve "toner her gün
 * bitiyor" diyen bir tahmin üretir. Üst sınır 200.000: en yüksek verimli
 * endüstriyel toner bile bunun altında; üstü fazladan basılmış sıfır
 * demektir ve tahmini sonsuza iter. İki uçta da sonuç aynı: bayi ekrandaki
 * sayıya bir daha güvenmez.
 */
export const VERIM_ALT = 100;
export const VERIM_UST = 200_000;

export function verimGecerliMi(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= VERIM_ALT && n <= VERIM_UST;
}

/** Gruplama anahtarı. Marka kanonik, model yalnız sadeleştirilmiş. */
export function modelAnahtari(brandIn: unknown, modelIn: unknown): string {
  const { brand, model } = normalizeBrandModel(brandIn, modelIn);
  const sade = (s: string) =>
    s.replace(/[\s._/-]+/g, ' ').trim().toLocaleUpperCase('tr');
  return `${sade(brand) || '?'}|${sade(model) || '?'}`;
}

export interface VerimGrubu {
  anahtar: string;
  marka: string;
  model: string;
  /** Bu modeldeki toplam cihaz */
  cihaz: number;
  /** S/B verimi tanımlı olan cihaz sayısı */
  verimli: number;
  /** Sayaç değeri olan cihaz — verim girilince tahmin bunlarda anlam kazanır */
  sayacli: number;
  /**
   * Bu modelde daha önce girilmiş verim (varsa) — forma varsayılan olarak
   * konur. ÖNERİ ÜRETİLMİYOR: elimizde model→verim sözlüğü yok ve uydurmak
   * yanlış tahmin demek. Yalnız bayinin kendi girdiği değer hatırlanıyor.
   */
  mevcutSb: number | null;
  mevcutRenkli: number | null;
}

export async function verimGruplari(tenantId: string): Promise<VerimGrubu[]> {
  const cihazlar = await prisma.device.findMany({
    where: { tenantId },
    select: {
      brand: true, model: true,
      tonerYieldBlack: true, tonerYieldColor: true, counterBlack: true,
    },
  });

  const harita = new Map<string, VerimGrubu>();
  for (const d of cihazlar) {
    const anahtar = modelAnahtari(d.brand, d.model);
    const { brand, model } = normalizeBrandModel(d.brand, d.model);
    let g = harita.get(anahtar);
    if (!g) {
      g = {
        anahtar, marka: brand || '—', model: model || '—',
        cihaz: 0, verimli: 0, sayacli: 0, mevcutSb: null, mevcutRenkli: null,
      };
      harita.set(anahtar, g);
    }
    g.cihaz++;
    if (d.tonerYieldBlack && d.tonerYieldBlack > 0) {
      g.verimli++;
      g.mevcutSb ??= d.tonerYieldBlack;
    }
    if (d.tonerYieldColor && d.tonerYieldColor > 0) g.mevcutRenkli ??= d.tonerYieldColor;
    if (d.counterBlack && d.counterBlack > 0) g.sayacli++;
  }

  // Çok cihazlı model önce: bayi üstten başlayıp istediği yerde dursun.
  return [...harita.values()].sort(
    (a, b) => b.cihaz - a.cihaz || a.marka.localeCompare(b.marka, 'tr') || a.model.localeCompare(b.model, 'tr')
  );
}

export interface UygulaSonuc {
  guncellenen: number;
  atlanan: number;
  hata?: string;
}

/**
 * Bir modeldeki cihazlara verimi uygular.
 *
 * ── ZATEN DOLU OLANA DOKUNULMAZ ───────────────────────────────────────
 * `ezme` açıkça istenmedikçe yalnız BOŞ alanlar doldurulur. Bayi bir
 * cihaza bilerek farklı verim girmiş olabilir (yüksek kapasiteli toner
 * takılmış olabilir) ve toplu işlemin onu sessizce ezmesi, ancak yanlış
 * tahmin görüldüğünde fark edilirdi.
 */
export async function verimUygula(
  tenantId: string,
  anahtar: string,
  deger: { sb?: number | null; renkli?: number | null; ezme?: boolean }
): Promise<UygulaSonuc> {
  const { sb, renkli, ezme = false } = deger;

  if (sb == null && renkli == null) return { guncellenen: 0, atlanan: 0, hata: 'Verim girilmedi' };
  if (sb != null && !verimGecerliMi(sb))
    return { guncellenen: 0, atlanan: 0, hata: `S/B verimi ${VERIM_ALT}–${VERIM_UST} arasında olmalı` };
  if (renkli != null && !verimGecerliMi(renkli))
    return { guncellenen: 0, atlanan: 0, hata: `Renkli verim ${VERIM_ALT}–${VERIM_UST} arasında olmalı` };

  /**
   * Cihazlar KİMLİKLE güncelleniyor, marka/model filtresiyle değil.
   * Gruplama normalleştirmeden geçiyor (ters kayıtlar, yazım farkları) ve
   * aynı normalleştirmeyi SQL'de tekrarlamak mümkün değil. Kimlikleri
   * burada, kiracı kapsamında hesaplayıp öyle yazıyoruz.
   */
  const adaylar = await prisma.device.findMany({
    where: { tenantId },
    select: { id: true, brand: true, model: true, tonerYieldBlack: true, tonerYieldColor: true },
  });

  const hedefler = adaylar.filter((d) => modelAnahtari(d.brand, d.model) === anahtar);
  if (!hedefler.length) return { guncellenen: 0, atlanan: 0, hata: 'Bu modelde cihaz bulunamadı' };

  const sbIdler = sb == null ? [] : hedefler.filter((d) => ezme || !d.tonerYieldBlack).map((d) => d.id);
  const renkliIdler = renkli == null ? [] : hedefler.filter((d) => ezme || !d.tonerYieldColor).map((d) => d.id);

  if (sbIdler.length)
    await prisma.device.updateMany({
      where: { tenantId, id: { in: sbIdler } },
      data: { tonerYieldBlack: sb },
    });
  if (renkliIdler.length)
    await prisma.device.updateMany({
      where: { tenantId, id: { in: renkliIdler } },
      data: { tonerYieldColor: renkli },
    });

  const dokunulan = new Set([...sbIdler, ...renkliIdler]).size;
  return { guncellenen: dokunulan, atlanan: hedefler.length - dokunulan };
}
