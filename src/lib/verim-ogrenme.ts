import { prisma } from '@/lib/prisma';
import { modelAnahtari, verimGecerliMi, VERIM_ALT, VERIM_UST } from '@/lib/toner-verimi';
import { MIN_TENANTS_FOR_OEM } from '@/lib/reliability';

/**
 * ÖĞRENEN TONER VERİMİ — sormak yerine ölçmek.
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * Tükenme tahmini bu ürünün en güçlü özelliği ve tek bir alan yüzünden
 * kapalı duruyor: `Device.tonerYieldBlack`. Ölçüldü (2026-09-01, Saygılı
 * Fotokopi): 854 cihazın 853'ünde verim boş. Sayaç 724 cihazda var, toner
 * değişimi kaydediliyor, altyapının tamamı hazır. Eksik olan tek şey, hiç
 * kimsenin 854 satır için bir sayı yazmayacak olması.
 *
 * ── ÇÖZÜM ────────────────────────────────────────────────────────────────
 * İki toner değişimi arasında basılan sayfa, O KARTUŞUN GERÇEK VERİMİDİR.
 * Kutunun üstündeki sayı değil — sahada, o müşterinin kapsama oranıyla
 * ölçülmüş olan. Veri zaten akıyordu, yalnız saklanmıyordu.
 *
 * Bu bir TAHMİN DEĞİL GÖZLEM. "HP P1102 → 1.600 olsun" diye bir sayı
 * uydurmuyoruz; hiç ölçüm yoksa alan boş kalıyor ve özellik o cihazda
 * kapalı kalmaya devam ediyor. Uydurma verim, yanlış tahmin üretir; bayi
 * müşteriye "toneriniz bitmek üzere" der ve değildir.
 *
 * ── NEDEN ORTANCA ────────────────────────────────────────────────────────
 * Ortalama değil ORTANCA kullanılıyor. Bir kartuş sıkışma yüzünden erken
 * değişmiş olabilir, bir başkası cihaz değişiminde sayaç sıfırlanmış
 * olabilir. Tek bir uç gözlem ortalamayı bozar, ortancayı bozmaz.
 */

export type Kanal = 'BLACK' | 'COLOR';
export type VerimKaynagi = 'ELLE' | 'CIHAZ' | 'MODEL' | 'POPULASYON';

export type VerimOzeti = {
  deger: number;
  gozlem: number;
  enAz: number;
  enCok: number;
};

export type CihazVerimi = {
  deger: number | null;
  kaynak: VerimKaynagi | null;
  gozlem: number;
  /** Ekranda gösterilecek tek cümle. Kaynağı gizlemiyoruz. */
  aciklama: string;
};

/** Ortanca. Boş dizide null. */
export function ortanca(sayilar: number[]): number | null {
  if (!sayilar.length) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
}

/**
 * Bir cihaz+kanalın değişim geçmişinden gözlemleri çıkarır.
 *
 * Girdi tarihe göre sıralı olmak ZORUNDA DEĞİL: burada sıralanıyor. Sıra
 * yanlış olsaydı fark negatif çıkar ve gözlem sessizce elenirdi.
 */
export function gozlemler(
  kayitlar: { counterValue: number; changedAt: Date | string }[],
): number[] {
  const s = [...kayitlar].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );
  const cikan: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const fark = s[i].counterValue - s[i - 1].counterValue;
    // Aralık dışı olan ölçüm değil ÖLÇÜM HATASI: cihaz değişmiş, sayaç
    // sıfırlanmış ya da toner boşalmadan (sıkışma/deneme) değiştirilmiş.
    // Bunları elemek, yanlış bir verimi doğru sanmaktan iyidir.
    if (verimGecerliMi(fark)) cikan.push(fark);
  }
  return cikan;
}

export function ozetle(gozlem: number[]): VerimOzeti | null {
  const d = ortanca(gozlem);
  if (d === null) return null;
  return { deger: d, gozlem: gozlem.length, enAz: Math.min(...gozlem), enCok: Math.max(...gozlem) };
}

/** En az kaç gözlemle bir modelin verimi "öğrenilmiş" sayılır. */
export const EN_AZ_GOZLEM = 2;
/** Tek cihazın kendi geçmişi için yeterli gözlem — kendi cihazı, kendi kapsaması. */
export const EN_AZ_GOZLEM_CIHAZ = 1;

// ── VERİTABANI ───────────────────────────────────────────────────────────

type HamDegisim = {
  deviceId: string;
  channel: string;
  counterValue: number;
  changedAt: Date;
  device: { brand: string; model: string };
};

function grupla(kayitlar: HamDegisim[]) {
  const cihazBazli = new Map<string, HamDegisim[]>();
  const modelBazli = new Map<string, HamDegisim[]>();
  for (const k of kayitlar) {
    const c = `${k.deviceId}|${k.channel}`;
    const m = `${modelAnahtari(k.device.brand, k.device.model)}|${k.channel}`;
    (cihazBazli.get(c) ?? cihazBazli.set(c, []).get(c)!).push(k);
    (modelBazli.get(m) ?? modelBazli.set(m, []).get(m)!).push(k);
  }
  return { cihazBazli, modelBazli };
}

export type OgrenilenVerim = {
  /** `${deviceId}|${channel}` → özet */
  cihaz: Map<string, VerimOzeti>;
  /** `${modelAnahtari}|${channel}` → özet */
  model: Map<string, VerimOzeti>;
};

/**
 * Bayinin KENDİ kayıtlarından öğrenilen verimler.
 *
 * Model özeti cihaz bazlı gözlemlerin birleşimi: aynı modelin 6 cihazından
 * birer gözlem, tek cihazdan 6 gözlem kadar bilgi veriyor — hatta daha
 * fazlası, çünkü farklı müşterilerin kapsama oranını da içeriyor.
 */
export async function verimleriOgren(tenantId: string): Promise<OgrenilenVerim> {
  const kayitlar = await prisma.tonerChange.findMany({
    where: { tenantId },
    select: {
      deviceId: true, channel: true, counterValue: true, changedAt: true,
      device: { select: { brand: true, model: true } },
    },
  });

  const { cihazBazli, modelBazli } = grupla(kayitlar);
  const cihaz = new Map<string, VerimOzeti>();
  for (const [k, v] of cihazBazli) {
    const o = ozetle(gozlemler(v));
    if (o && o.gozlem >= EN_AZ_GOZLEM_CIHAZ) cihaz.set(k, o);
  }
  const model = new Map<string, VerimOzeti>();
  for (const [k, v] of modelBazli) {
    // Model özeti CİHAZ BAZINDA çıkarılıyor: tüm kayıtları tek diziye
    // koyup ardışık farkı alsaydık, iki AYRI cihazın sayaçları arasındaki
    // fark verim sanılırdı.
    const cihazlar = new Map<string, HamDegisim[]>();
    for (const k2 of v) (cihazlar.get(k2.deviceId) ?? cihazlar.set(k2.deviceId, []).get(k2.deviceId)!).push(k2);
    const hepsi = [...cihazlar.values()].flatMap((x) => gozlemler(x));
    const o = ozetle(hepsi);
    if (o && o.gozlem >= EN_AZ_GOZLEM) model.set(k, o);
  }
  return { cihaz, model };
}

/**
 * POPÜLASYON — VERİ PAYLAŞIMINA RIZA VEREN bayilerin kayıtlarından.
 *
 * Tek bayide 6 ay sürecek öğrenme, filoyu birleştirince günler alıyor. Ama
 * bir hücre ancak EN AZ {MIN_TENANTS_FOR_OEM} FARKLI BAYİDEN besleniyorsa
 * gösteriliyor: altında kalan sayı, tek bir bayinin kendi verisini "sektör
 * ortalaması" diye geri okuması olurdu.
 *
 * Hiçbir müşteri/cihaz kimliği taşınmıyor — çıkan şey yalnız
 * "marka+model+kanal → kaç sayfa".
 */
export async function populasyonVerimleri(): Promise<Map<string, VerimOzeti>> {
  // ── RIZA ŞART ──────────────────────────────────────────────
  // Bu depoda üretici veri ürünü için kural zaten yazılmış: "bayinin
  // verisini başkasına açmak sözleşmesel izin ister; izin varsayılan
  // olamaz." Bir bayinin ölçtüğü verimi BAŞKA bir bayiye göstermek de
  // aynı şey — topluluklaştırılmış olması izni gereksiz kılmıyor.
  //
  // Bu fonksiyon ilk yazıldığında rızayı sormuyordu. Artık yalnız
  // `oemDataSharing` açık, aktif ve silinmemiş bayiler havuza giriyor —
  // ve aynı bayiler havuzdan faydalanmaya da o rızayla hak kazanıyor.
  const rizaliBayiler = await prisma.tenant.findMany({
    where: { deletedAt: null, isActive: true, oemDataSharing: true },
    select: { id: true },
  });
  if (rizaliBayiler.length < MIN_TENANTS_FOR_OEM) return new Map();

  const kayitlar = await prisma.tonerChange.findMany({
    where: { tenantId: { in: rizaliBayiler.map((t) => t.id) } },
    select: {
      tenantId: true, deviceId: true, channel: true, counterValue: true, changedAt: true,
      device: { select: { brand: true, model: true } },
    },
  });

  const modelBazli = new Map<string, { gozlem: number[]; bayiler: Set<string> }>();
  const cihazBazli = new Map<string, HamDegisim[]>();
  const cihazModeli = new Map<string, { anahtar: string; tenantId: string }>();
  for (const k of kayitlar) {
    const c = `${k.deviceId}|${k.channel}`;
    (cihazBazli.get(c) ?? cihazBazli.set(c, []).get(c)!).push(k as HamDegisim);
    cihazModeli.set(c, {
      anahtar: `${modelAnahtari(k.device.brand, k.device.model)}|${k.channel}`,
      tenantId: k.tenantId,
    });
  }
  for (const [c, v] of cihazBazli) {
    const bilgi = cihazModeli.get(c)!;
    const g = gozlemler(v);
    if (!g.length) continue;
    const kayit = modelBazli.get(bilgi.anahtar)
      ?? modelBazli.set(bilgi.anahtar, { gozlem: [], bayiler: new Set() }).get(bilgi.anahtar)!;
    kayit.gozlem.push(...g);
    kayit.bayiler.add(bilgi.tenantId);
  }

  const cikan = new Map<string, VerimOzeti>();
  for (const [k, v] of modelBazli) {
    if (v.bayiler.size < MIN_TENANTS_FOR_OEM) continue;
    const o = ozetle(v.gozlem);
    if (o && o.gozlem >= EN_AZ_GOZLEM) cikan.set(k, o);
  }
  return cikan;
}

/**
 * Bir cihazın bir kanalı için kullanılacak verim ve NEREDEN geldiği.
 *
 * Sıra rastgele değil, GÜVENİLİRLİK sırası:
 *   1. Bayinin elle girdiği değer — açık tercih her şeyi yener.
 *   2. Cihazın KENDİ geçmişi — o müşterinin kendi kapsama oranı.
 *   3. Aynı modelin bu bayideki diğer cihazları.
 *   4. Popülasyon — yeni cihazda ilk günden çalışsın diye.
 */
export function verimSec(args: {
  elle: number | null | undefined;
  cihaz: VerimOzeti | undefined;
  model: VerimOzeti | undefined;
  populasyon?: VerimOzeti | undefined;
}): CihazVerimi {
  const { elle, cihaz, model, populasyon } = args;
  if (verimGecerliMi(elle)) {
    return { deger: elle, kaynak: 'ELLE', gozlem: 0, aciklama: 'Elle girildi' };
  }
  if (cihaz) {
    return {
      deger: cihaz.deger, kaynak: 'CIHAZ', gozlem: cihaz.gozlem,
      aciklama: `Bu cihazda ölçüldü (${cihaz.gozlem} toner)`,
    };
  }
  if (model) {
    return {
      deger: model.deger, kaynak: 'MODEL', gozlem: model.gozlem,
      aciklama: `Aynı modelde ölçüldü (${model.gozlem} toner)`,
    };
  }
  if (populasyon) {
    return {
      deger: populasyon.deger, kaynak: 'POPULASYON', gozlem: populasyon.gozlem,
      aciklama: `Diğer bayilerde ölçüldü (${populasyon.gozlem} toner)`,
    };
  }
  return {
    deger: null, kaynak: null, gozlem: 0,
    aciklama: 'Henüz ölçülmedi — ikinci toner değişiminde kendiliğinden çıkacak',
  };
}

// ── KAYIT ────────────────────────────────────────────────────────────────

export type DegisimGirdisi = {
  tenantId: string;
  deviceId: string;
  channel: Kanal;
  counterValue: number;
  changedAt?: Date;
  partId?: string | null;
  source: 'ELLE' | 'FIS' | 'GOC';
  note?: string | null;
};

export type DegisimSonucu = {
  id: string;
  /** Bu değişimle ÖLÇÜLEN verim. İlk değişimde ya da ölçüm hatalıysa null. */
  observedYield: number | null;
  /** Gözlem neden sayılmadı — bayiye gösterilmiyor, kayıtta duruyor. */
  elenmeSebebi: string | null;
};

/**
 * Toner değişimini kaydeder ve gözlenen verimi hesaplar.
 *
 * Aynı işlemde `Device.tonerReset*` da güncelleniyor: tahmin motoru hâlâ o
 * alanı okuyor ve ikisinin ayrışması, ekranda bir sayı geçmişte başka bir
 * sayı gösterirdi.
 */
export async function degisimKaydet(girdi: DegisimGirdisi): Promise<DegisimSonucu> {
  const { tenantId, deviceId, channel, counterValue, partId, source, note } = girdi;
  const changedAt = girdi.changedAt ?? new Date();

  const onceki = await prisma.tonerChange.findFirst({
    where: { tenantId, deviceId, channel, changedAt: { lt: changedAt } },
    orderBy: { changedAt: 'desc' },
    select: { counterValue: true },
  });

  let observedYield: number | null = null;
  let elenmeSebebi: string | null = null;
  if (onceki) {
    const fark = counterValue - onceki.counterValue;
    if (verimGecerliMi(fark)) observedYield = fark;
    else if (fark <= 0) elenmeSebebi = `sayaç ilerlememiş (${fark})`;
    else if (fark < VERIM_ALT) elenmeSebebi = `çok kısa (${fark} sayfa) — toner boşalmadan değişmiş olabilir`;
    else elenmeSebebi = `çok uzun (${fark} sayfa) — sayaç sıfırlanmış olabilir`;
  }

  const kayit = await prisma.tonerChange.create({
    data: { tenantId, deviceId, channel, counterValue, changedAt, observedYield, partId: partId ?? null, source, note: note ?? null },
    select: { id: true },
  });

  await prisma.device.update({
    where: { id: deviceId },
    data: channel === 'BLACK'
      ? { tonerResetBlack: counterValue, tonerChangedAt: changedAt }
      : { tonerResetColor: counterValue, tonerChangedAt: changedAt },
  });

  return { id: kayit.id, observedYield, elenmeSebebi };
}

export { VERIM_ALT, VERIM_UST };

// ── FİŞTEN OTOMATİK KAYIT ────────────────────────────────────────────────

/**
 * Türkçe katlama. `/i` bayrağı büyük İ'yi i'ye katlamıyor ve bu depoda
 * daha önce sessiz veri kaybına yol açtı ("FOTOKOPİ" eşleşmiyordu):
 * önce tr-TR küçült, SONRA ASCII'ye katla.
 */
const katla = (s: unknown): string =>
  String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

const RENKLI = ['renkli', 'color', 'colour', 'cyan', 'magenta', 'yellow', 'sari', 'kirmizi', 'mavi', 'cmy'];
const SIYAH = ['siyah', 'black', 'mono', ' bk', '-bk', 'bk-'];

/** Parça bir toner mi? Drum ve mürekkep AYRI — verimleri farklı çalışır. */
export function tonerMu(part: { group?: string | null; name?: string | null }): boolean {
  const g = katla(part.group);
  if (g === 'toner') return true;
  if (g && g !== 'diger' && g !== '') return false; // grubu belli ve toner değil
  // Grubu boşsa ada bakılıyor; "drum"/"dram" toner değildir.
  const a = katla(part.name);
  if (/dram|drum/.test(a)) return false;
  return /toner|kartus/.test(a);
}

/**
 * Takılan tonerin hangi kanal olduğu.
 *
 * TAHMİN EDİLMİYOR: ad renk söylemiyorsa ve cihaz renkli basabiliyorsa
 * `null` dönüyor ve teknisyene tek dokunuşluk soru soruluyor. Yanlış kanala
 * yazılan bir değişim, o kanalın verimini kalıcı olarak bozar.
 */
export function kanalKarari(
  part: { group?: string | null; name?: string | null },
  cihaz: { tonerYieldColor?: number | null; counterColor?: number | null },
): { kanal: Kanal | null; sebep: string } {
  if (!tonerMu(part)) return { kanal: null, sebep: 'toner değil' };
  const a = katla(part.name);
  if (RENKLI.some((k) => a.includes(k))) return { kanal: 'COLOR', sebep: 'parça adı renkli diyor' };
  if (SIYAH.some((k) => a.includes(k))) return { kanal: 'BLACK', sebep: 'parça adı siyah diyor' };
  // Cihaz renkli basamıyorsa tek olasılık S/B — burada tahmin değil, çıkarım.
  const renkliBasabilir = (cihaz.tonerYieldColor ?? 0) > 0 || (cihaz.counterColor ?? 0) > 0;
  if (!renkliBasabilir) return { kanal: 'BLACK', sebep: 'cihaz renkli basmıyor' };
  return { kanal: null, sebep: 'renk belirsiz — sorulmalı' };
}
