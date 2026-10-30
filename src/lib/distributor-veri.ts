/**
 * DİSTRİBÜTÖR PANELİ — veri katmanı. Kurallar saf dosyada (distributor.ts).
 *
 * ── KAPSAM ───────────────────────────────────────────────────────────────
 * Yalnız üretici veri paylaşımı açık (oemDataSharing — varsayılan açık, bayi
 * Ayarlar'dan kapatır), aktif, silinmemiş ve DEMO OLMAYAN bayiler. Demo bayilerin tohum verisi sahadan
 * gelmiyor; distribütöre "sahada böyle" diye gösterilemez.
 *
 * ── 5.000 BAYİ ───────────────────────────────────────────────────────────
 * Bayi başına sorgu YOK. Her tablo bir kez okunur:
 *   1. kapsamdaki marka/model çiftleri (groupBy — yalnız farklı çiftler),
 *   2. markanın cihazları (çift listesiyle, tek sorgu),
 *   3. bu cihazların bayileri,
 *   4–7. pencerelerin ilk/son sayaç okuması (DISTINCT ON, lib/toner dailyRate
 *        da yalnız uçlara bakar),
 *   8. toner değişimleri, 9–11. parça/sevk/kaynağı bilinmeyen değişim
 *      (GROUP BY), 12. parça kartları, 13–15. model güvenilirliği
 *      (reliability.modelStats, yalnız bu cihazlar).
 * Marka eşleşmesi SQL'de değil (ters kaydedilmiş marka/model, Türkçe İ):
 * önce farklı çiftler çekilir, eşleşme JS'te (device-brands) yapılır, sonra
 * eşleşen çiftlerin cihazları tek sorguyla gelir.
 *
 * ── DIŞARI ÇIKMAYANLAR ───────────────────────────────────────────────────
 * Müşteri adı, adresi, seri no, cihaz kimliği, parça fiyatı. Bayi adı/il/
 * iletişim yalnız markaAdIzni açık bayilerde.
 */
import { prisma } from '@/lib/prisma';
import {
  K_ANONIM, TALEP_GUN, SAYFA_PENCERESI_GUN, TONER_HIZ_GUN, OLCUM_GECERLI_GUN, PAY_PENCERESI_GUN,
  kAnonim, farkGuvenli, kSuz, markaEslesir, markaYazimi, markaAnahtari, parcaOrijinalMi, payHesapla,
  mtbfGun, ortanca, bayiDuyurulari, paylasimSonrasi,
  type Sayi, type Pay, type DuyuruGirdisi, type Paylasim,
} from '@/lib/distributor';
import { normalizeBrandModel } from '@/lib/device-brands';
import { modelAnahtari, verimGecerliMi } from '@/lib/toner-verimi';
import { gozlemler, ozetle, verimSec, tonerMu, EN_AZ_GOZLEM, EN_AZ_GOZLEM_CIHAZ, type VerimOzeti } from '@/lib/verim-ogrenme';
import { dailyRate, forecastChannel, olcumleBirlestir, type TonerReadingPoint } from '@/lib/toner';
import { onerilenParca, enSik } from '@/lib/toner-sevk';
import { TONER_KRITIK } from '@/lib/sayac-tarama';
import { cihazKalemleri, cihazdanHesap, ufuktaMi, yuvaBul, ESKI_OLCUM_GUN } from '@/lib/parca-omru';
import { modelStats } from '@/lib/reliability';

const GUN = 86_400_000;
/** Kapsam: rıza veren, aktif, silinmemiş, demo olmayan bayi. */
export const KAPSAM = { oemDataSharing: true, isActive: true, deletedAt: null, demo: false } as const;
/** Sarf sayılan stok grupları (toner payı). Grubu boş kart adından tanınır (tonerMu). */
const SARF_GRUPLARI = ['TONER', 'INK', 'DRUM'];
const MODEL_SATIR = 10;
const GUVENILIRLIK_SATIR = 20;

type Kanal = 'BLACK' | 'COLOR';

interface HamCihaz {
  id: string; tenantId: string; brand: string; model: string;
  tonerYieldBlack: number | null; tonerYieldColor: number | null;
  tonerResetBlack: number | null; tonerResetColor: number | null;
  counterBlack: number | null; counterColor: number | null;
  olcumAt: Date | null; olcumSiyah: number | null; olcumRenkli: number | null;
  olcumParca: number | null; olcumSarf: unknown;
}
interface HamOkuma { deviceId: string; readingDate: Date; counterBlack: number; counterColor: number }
interface HamDegisim { tenantId: string; deviceId: string; channel: string; counterValue: number; changedAt: Date; partId: string | null }

export interface AdliBayi { ad: string; il: string | null; telefon: string | null; eposta: string | null; cihaz: number | null }

export interface DistributorOzeti {
  marka: string;
  esik: number;
  uretildi: string;
  ag: {
    bayi: Sayi;
    adIzinli: Sayi;
    adli: AdliBayi[];
    /** Adlı bayilerin cihaz sayısı fark saldırısına açık olduğu için yazılmadı. */
    adliSayiGizli: boolean;
  };
  park: {
    cihaz: Sayi;
    aylikSayfa: Sayi;
    sayfaOlculenCihaz: Sayi;
    modeller: { model: string; cihaz: number }[];
    gizliModel: number;
    iller: { il: string | null; cihaz: number }[];
    gizliIl: number;
  };
  toner: { pay: Pay | null; gun: number };
  talep: {
    gun: number;
    toner: { model: string; kanal: Kanal; kod: string | null; adet: number }[];
    parca: { model: string; tur: string; adet: number }[];
    gizli: number;
    tonerToplam: Sayi;
    parcaToplam: Sayi;
  };
  guvenilirlik: {
    pencereAy: number;
    satirlar: {
      model: string; cihaz: number; arizaYil: number | null; mtbfGun: number | null;
      gercekVerim: number | null; gozlem: number; kutuVerimi: number | null;
    }[];
    gizli: number;
  };
}

const ekle = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };

/** Markanın kapsamdaki cihazları (müşteri/seri bilgisi seçilmez). */
async function markaCihazlari(marka: string): Promise<HamCihaz[]> {
  const ciftler = await prisma.device.groupBy({ by: ['brand', 'model'], where: { tenant: KAPSAM } });
  const eslesen = ciftler.filter((c) => markaEslesir(c.brand, c.model, marka));
  if (!eslesen.length) return [];
  const markalar = eslesen.map((c) => c.brand);
  const modeller = eslesen.map((c) => c.model);
  return prisma.$queryRaw<HamCihaz[]>`
    SELECT d."id", d."tenantId", d."brand", d."model",
           d."tonerYieldBlack", d."tonerYieldColor", d."tonerResetBlack", d."tonerResetColor",
           d."counterBlack", d."counterColor", d."olcumAt", d."olcumSiyah", d."olcumRenkli",
           d."olcumParca", d."olcumSarf"
    FROM "Device" d
    JOIN "Tenant" t ON t."id" = d."tenantId"
    WHERE t."oemDataSharing" = true AND t."isActive" = true AND t."deletedAt" IS NULL AND t."demo" = false
      AND (d."brand", d."model") IN (SELECT * FROM unnest(${markalar}::text[], ${modeller}::text[]))`;
}

/** Pencerenin ilk ya da son okuması, cihaz başına bir satır. */
function uctakiOkuma(ids: string[], bas: Date, yon: 'ilk' | 'son'): Promise<HamOkuma[]> {
  const iso = bas.toISOString();
  return yon === 'ilk'
    ? prisma.$queryRaw<HamOkuma[]>`
        SELECT DISTINCT ON ("deviceId") "deviceId", "readingDate", "counterBlack", "counterColor"
        FROM "CounterReading" WHERE "deviceId" = ANY(${ids}::text[]) AND "readingDate" >= ${iso}::timestamp
        ORDER BY "deviceId", "readingDate" ASC`
    : prisma.$queryRaw<HamOkuma[]>`
        SELECT DISTINCT ON ("deviceId") "deviceId", "readingDate", "counterBlack", "counterColor"
        FROM "CounterReading" WHERE "deviceId" = ANY(${ids}::text[]) AND "readingDate" >= ${iso}::timestamp
        ORDER BY "deviceId", "readingDate" DESC`;
}

const noktalar = (ilk: HamOkuma | undefined, son: HamOkuma | undefined): TonerReadingPoint[] =>
  [ilk, son].filter((x): x is HamOkuma => !!x)
    .map((o) => ({ readingDate: o.readingDate, counterBlack: Number(o.counterBlack), counterColor: Number(o.counterColor) }));

function bosOzet(marka: string, simdi: Date): DistributorOzeti {
  return {
    marka, esik: K_ANONIM, uretildi: simdi.toISOString(),
    ag: { bayi: null, adIzinli: null, adli: [], adliSayiGizli: false },
    park: { cihaz: null, aylikSayfa: null, sayfaOlculenCihaz: null, modeller: [], gizliModel: 0, iller: [], gizliIl: 0 },
    toner: { pay: null, gun: PAY_PENCERESI_GUN },
    talep: { gun: TALEP_GUN, toner: [], parca: [], gizli: 0, tonerToplam: null, parcaToplam: null },
    guvenilirlik: { pencereAy: 12, satirlar: [], gizli: 0 },
  };
}

/** Distribütör panelinin bütün bölümleri, tek markada. */
export async function distributorOzeti(marka: string, simdi = new Date()): Promise<DistributorOzeti> {
  const cihazlar = await markaCihazlari(marka);
  if (!cihazlar.length) return bosOzet(marka, simdi);

  const ids = cihazlar.map((c) => c.id);
  const bayiIdleri = [...new Set(cihazlar.map((c) => c.tenantId))];
  const sayfaBas = new Date(simdi.getTime() - SAYFA_PENCERESI_GUN * GUN);
  const hizBas = new Date(simdi.getTime() - TONER_HIZ_GUN * GUN);
  const payBas = new Date(simdi.getTime() - PAY_PENCERESI_GUN * GUN).toISOString();

  const [bayiler, sayfaIlk, sayfaSon, hizIlk, hizSon, degisimler, fisParcalari, sevkler, bilinmeyenler, guven] = await Promise.all([
    prisma.tenant.findMany({
      where: { ...KAPSAM, id: { in: bayiIdleri } },
      select: { id: true, name: true, city: true, phone: true, email: true, markaAdIzni: true },
    }),
    uctakiOkuma(ids, sayfaBas, 'ilk'),
    uctakiOkuma(ids, sayfaBas, 'son'),
    uctakiOkuma(ids, hizBas, 'ilk'),
    uctakiOkuma(ids, hizBas, 'son'),
    prisma.$queryRaw<HamDegisim[]>`
      SELECT "tenantId", "deviceId", "channel", "counterValue", "changedAt", "partId"
      FROM "TonerChange" WHERE "deviceId" = ANY(${ids}::text[])`,
    prisma.$queryRaw<{ tenantId: string; partId: string; adet: number }[]>`
      SELECT tp."tenantId", tp."partId", SUM(tp."quantity")::int AS "adet"
      FROM "TicketPart" tp JOIN "ServiceTicket" s ON s."id" = tp."ticketId"
      WHERE s."deviceId" = ANY(${ids}::text[]) AND s."deletedAt" IS NULL AND s."status" <> 'CANCELLED'
        AND s."createdAt" >= ${payBas}::timestamp
      GROUP BY tp."tenantId", tp."partId"`,
    prisma.$queryRaw<{ tenantId: string; partId: string; adet: number }[]>`
      SELECT "tenantId", "partId", SUM("adet")::int AS "adet"
      FROM "TonerSevki"
      WHERE "deviceId" = ANY(${ids}::text[]) AND "durum" <> 'IPTAL' AND "partId" IS NOT NULL
        AND "gonderildiAt" >= ${payBas}::timestamp
      GROUP BY "tenantId", "partId"`,
    // Kaçan toner adayı (lib/kacan-toner): tarayıcı değişimi gördü, bayinin
    // kaydında parça yok, "bizden aldı" işaretlenmemiş.
    prisma.$queryRaw<{ tenantId: string; adet: number }[]>`
      SELECT "tenantId", COUNT(*)::int AS "adet"
      FROM "TonerChange"
      WHERE "deviceId" = ANY(${ids}::text[]) AND "source" = 'TARAYICI' AND "partId" IS NULL
        AND "bizdenAlindi" = false AND "changedAt" >= ${payBas}::timestamp
      GROUP BY "tenantId"`,
    modelStats(bayiIdleri, {
      months: 12, deviceIds: ids,
      grupla: (b, m) => { const n = normalizeBrandModel(b, m); return { anahtar: modelAnahtari(b, m), brand: n.brand, model: n.model }; },
    }),
  ]);

  // Kapsam dışına düşmüş bayi (sorgular arasında rıza kapandı) hiçbir sayıya girmez.
  const bayiMap = new Map(bayiler.map((b) => [b.id, b]));
  const kapsamda = cihazlar.filter((c) => bayiMap.has(c.tenantId));
  const anahtar = new Map(kapsamda.map((c) => [c.id, modelAnahtari(c.brand, c.model)]));
  const modelAdi = new Map<string, string>();
  for (const c of kapsamda) {
    const k = anahtar.get(c.id)!;
    if (!modelAdi.has(k)) modelAdi.set(k, normalizeBrandModel(c.brand, c.model).model || '—');
  }

  // ── 1. BAYİ AĞI ───────────────────────────────────────────────────
  const bayiCihaz = new Map<string, number>();
  for (const c of kapsamda) bayiCihaz.set(c.tenantId, (bayiCihaz.get(c.tenantId) ?? 0) + 1);
  const toplamBayi = bayiCihaz.size;
  const adliBayiler = bayiler.filter((b) => b.markaAdIzni && bayiCihaz.has(b.id));
  // Toplam sayılar gösterilecekse ve adsız kalan 1–2 bayi varsa, adlıların
  // cihaz sayısı yazılmaz: toplamdan çıkarınca adsızın sayısı açığa çıkardı.
  const toplamGorunur = toplamBayi >= K_ANONIM;
  const adliSayiGoster = !toplamGorunur || farkGuvenli(toplamBayi, adliBayiler.length);
  const adli: AdliBayi[] = adliBayiler
    .map((b) => ({ ad: b.name, il: b.city, telefon: b.phone, eposta: b.email, cihaz: adliSayiGoster ? bayiCihaz.get(b.id) ?? 0 : null }))
    .sort((a, b) => (b.cihaz ?? 0) - (a.cihaz ?? 0) || a.ad.localeCompare(b.ad, 'tr'));

  // ── 2. MARKA PARKI ────────────────────────────────────────────────
  const modelGrup = new Map<string, { cihaz: number; bayiler: Set<string> }>();
  const ilGrup = new Map<string, { il: string | null; cihaz: number; bayiler: Set<string>; adli: Set<string> }>();
  for (const c of kapsamda) {
    const k = anahtar.get(c.id)!;
    const m = modelGrup.get(k) ?? modelGrup.set(k, { cihaz: 0, bayiler: new Set() }).get(k)!;
    m.cihaz++; m.bayiler.add(c.tenantId);
    const b = bayiMap.get(c.tenantId)!;
    const ilAd = b.city?.trim() || null;
    const ilK = ilAd ? markaAnahtari(ilAd) : '';
    const g = ilGrup.get(ilK) ?? ilGrup.set(ilK, { il: ilAd, cihaz: 0, bayiler: new Set(), adli: new Set() }).get(ilK)!;
    g.cihaz++; g.bayiler.add(c.tenantId);
    if (b.markaAdIzni) g.adli.add(c.tenantId);
  }
  const modelSuz = kSuz([...modelGrup.entries()].map(([k, v]) => ({ k, ...v })));
  const modeller = modelSuz.gosterilen.sort((a, b) => b.cihaz - a.cihaz).slice(0, MODEL_SATIR)
    .map((m) => ({ model: modelAdi.get(m.k) ?? '—', cihaz: m.cihaz }));
  // İl satırı: en az K bayi; adlıların cihaz sayısı yazılıyorsa o ildeki
  // adsız bayiler de fark saldırısına karşı ya 0 ya en az K olmalı.
  const ilSatirlari = [...ilGrup.values()];
  const ilGosterilen = ilSatirlari.filter((g) => g.bayiler.size >= K_ANONIM && (!adliSayiGoster || farkGuvenli(g.bayiler.size, g.adli.size)));
  const iller = ilGosterilen.sort((a, b) => b.cihaz - a.cihaz).map((g) => ({ il: g.il, cihaz: g.cihaz }));

  // Aylık sayfa: son 35 günün ilk ve son okuması (lib/toner dailyRate,
  // parca-omru gunlukSayfa gibi siyah+renkli toplam).
  const ilk35 = new Map(sayfaIlk.map((o) => [o.deviceId, o]));
  const son35 = new Map(sayfaSon.map((o) => [o.deviceId, o]));
  let gunlukToplam = 0;
  let olculen = 0;
  const sayfaBayileri = new Set<string>();
  for (const c of kapsamda) {
    const n = noktalar(ilk35.get(c.id), son35.get(c.id)).map((p) => ({ readingDate: p.readingDate, counterBlack: p.counterBlack + p.counterColor, counterColor: 0 }));
    const hiz = dailyRate(n, 'black');
    if (hiz === null) continue;
    gunlukToplam += hiz; olculen++; sayfaBayileri.add(c.tenantId);
  }

  // ── 3. ORİJİNAL TONER PAYI ────────────────────────────────────────
  const degisimParcalari = degisimler.map((d) => d.partId).filter((x): x is string => !!x);
  const parcaIdleri = [...new Set([...fisParcalari.map((p) => p.partId), ...sevkler.map((s) => s.partId), ...degisimParcalari])];
  const parcalar = parcaIdleri.length
    ? await prisma.part.findMany({ where: { id: { in: parcaIdleri } }, select: { id: true, name: true, group: true, oemBrand: true, oemCode: true } })
    : [];
  const parcaMap = new Map(parcalar.map((p) => [p.id, p]));
  const sarfMi = (p: { group: string | null; name: string }) => (p.group ? SARF_GRUPLARI.includes(p.group) : tonerMu({ group: p.group, name: p.name }));
  const adet = { orijinal: 0, uyumlu: 0, bilinmeyen: 0 };
  const payBayileri = new Set<string>();
  for (const r of [...fisParcalari, ...sevkler]) {
    const p = parcaMap.get(r.partId);
    if (!p || !sarfMi(p) || !bayiMap.has(r.tenantId)) continue;
    const n = Number(r.adet) || 0;
    if (n <= 0) continue;
    if (parcaOrijinalMi(p, marka)) adet.orijinal += n; else adet.uyumlu += n;
    payBayileri.add(r.tenantId);
  }
  for (const r of bilinmeyenler) {
    if (!bayiMap.has(r.tenantId) || !(Number(r.adet) > 0)) continue;
    adet.bilinmeyen += Number(r.adet);
    payBayileri.add(r.tenantId);
  }

  // ── VERİM: elle → cihaz → aynı bayide model → popülasyon ─────────
  // verim-ogrenme'deki sıra ve eşikler; popülasyon yalnız bu kapsamdan
  // (rıza + demo değil) ve en az K bayiden.
  const cihazDegisim = new Map<string, HamDegisim[]>();
  for (const d of degisimler) if (bayiMap.has(d.tenantId)) ekle(cihazDegisim, `${d.deviceId}|${d.channel}`, d);
  const cihazVerim = new Map<string, VerimOzeti>();
  const bayiModelGozlem = new Map<string, number[]>();
  const populasyonGozlem = new Map<string, { gozlem: number[]; bayiler: Set<string> }>();
  const cihazBilgi = new Map(kapsamda.map((c) => [c.id, c]));
  for (const [k, v] of cihazDegisim) {
    const [deviceId, kanal] = k.split('|');
    const c = cihazBilgi.get(deviceId);
    if (!c) continue;
    const g = gozlemler(v);
    const o = ozetle(g);
    if (o && o.gozlem >= EN_AZ_GOZLEM_CIHAZ) cihazVerim.set(k, o);
    if (!g.length) continue;
    const mk = `${anahtar.get(deviceId)}|${kanal}`;
    const bk = `${c.tenantId}|${mk}`;
    (bayiModelGozlem.get(bk) ?? bayiModelGozlem.set(bk, []).get(bk)!).push(...g);
    const pop = populasyonGozlem.get(mk) ?? populasyonGozlem.set(mk, { gozlem: [], bayiler: new Set() }).get(mk)!;
    pop.gozlem.push(...g); pop.bayiler.add(c.tenantId);
  }
  const bayiModelVerim = new Map<string, VerimOzeti>();
  for (const [k, g] of bayiModelGozlem) { const o = ozetle(g); if (o && o.gozlem >= EN_AZ_GOZLEM) bayiModelVerim.set(k, o); }
  const populasyon = new Map<string, VerimOzeti>();
  for (const [k, v] of populasyonGozlem) {
    if (v.bayiler.size < K_ANONIM) continue;
    const o = ozetle(v.gozlem);
    if (o && o.gozlem >= EN_AZ_GOZLEM) populasyon.set(k, o);
  }

  // ── 4. 30 GÜNLÜK TALEP ────────────────────────────────────────────
  // Toner: toner-veri ile aynı hesap (forecastChannel + cihazın kendi
  // ölçümü), ihtiyaç kuralı toner-sevk ihtiyacSebebi'nin 30 güne açılmışı.
  // Kod: o cihaza son takılan tonerin üretici kodu → modelde en sık kod
  // (toner-sevk onerilenParca). Bayinin kendi stok kodu/adı dışarı çıkmaz.
  const ilk120 = new Map(hizIlk.map((o) => [o.deviceId, o]));
  const son120 = new Map(hizSon.map((o) => [o.deviceId, o]));
  const sonKod = new Map<string, string>();
  const modelKodlari = new Map<string, string[]>();
  for (const d of [...degisimler].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())) {
    const kod = d.partId ? parcaMap.get(d.partId)?.oemCode?.trim() : null;
    if (!kod) continue;
    sonKod.set(`${d.deviceId}|${d.channel}`, kod);
    const mk = anahtar.get(d.deviceId);
    if (mk) ekle(modelKodlari, `${mk}|${d.channel}`, kod);
  }
  const olcumSiniri = simdi.getTime() - OLCUM_GECERLI_GUN * GUN;
  const parcaOlcumSiniri = simdi.getTime() - ESKI_OLCUM_GUN * GUN;
  const tonerGrup = new Map<string, { model: string; kanal: Kanal; kod: string | null; adet: number; bayiler: Set<string> }>();
  const parcaGrup = new Map<string, { model: string; tur: string; adet: number; bayiler: Set<string> }>();
  const tonerBayileri = new Set<string>();
  const parcaBayileri = new Set<string>();
  let tonerToplam = 0;
  let parcaToplam = 0;
  for (const c of kapsamda) {
    const mk = anahtar.get(c.id)!;
    const pts = noktalar(ilk120.get(c.id), son120.get(c.id));
    const taze = c.olcumAt !== null && new Date(c.olcumAt).getTime() >= olcumSiniri;
    for (const kanal of ['BLACK', 'COLOR'] as const) {
      const ch = kanal === 'BLACK' ? 'black' : 'color';
      const verim = verimSec({
        elle: kanal === 'BLACK' ? c.tonerYieldBlack : c.tonerYieldColor,
        cihaz: cihazVerim.get(`${c.id}|${kanal}`),
        model: bayiModelVerim.get(`${c.tenantId}|${mk}|${kanal}`),
        populasyon: populasyon.get(`${mk}|${kanal}`),
      });
      const hiz = dailyRate(pts, ch);
      const sayac = kanal === 'BLACK' ? c.counterBlack : c.counterColor;
      const f = olcumleBirlestir({
        tahmin: forecastChannel({ yieldPages: verim.deger, reset: kanal === 'BLACK' ? c.tonerResetBlack : c.tonerResetColor, current: sayac, rate: hiz, channel: ch }),
        olcum: taze ? (kanal === 'BLACK' ? c.olcumSiyah : c.olcumRenkli) : null,
        yieldPages: verim.deger, current: sayac, rate: hiz, channel: ch,
      });
      if (!f || f.needsSetup) continue;
      const lazim = (f.olculdu && f.remainingPct !== null && f.remainingPct <= TONER_KRITIK) || (f.daysLeft !== null && f.daysLeft <= TALEP_GUN);
      if (!lazim) continue;
      const kod = onerilenParca({ sonTakilan: sonKod.get(`${c.id}|${kanal}`) ?? null, sonFis: null, modelEnSik: enSik(modelKodlari.get(`${mk}|${kanal}`) ?? []) })?.partId ?? null;
      const gk = `${mk}|${kanal}|${kod ?? ''}`;
      const g = tonerGrup.get(gk) ?? tonerGrup.set(gk, { model: modelAdi.get(mk) ?? '—', kanal, kod, adet: 0, bayiler: new Set() }).get(gk)!;
      g.adet++; g.bayiler.add(c.tenantId);
      tonerToplam++; tonerBayileri.add(c.tenantId);
    }
    // Parça: cihazın kendi bildirdiği kalemler (parca-omru CİHAZ satırı).
    if (c.olcumAt !== null && new Date(c.olcumAt).getTime() >= parcaOlcumSiniri) {
      for (const kalem of cihazKalemleri(c.olcumSarf, c.olcumParca)) {
        const h = cihazdanHesap({ yuzde: kalem.yuzde, omurSayfa: null, gunluk: null });
        if (!ufuktaMi(h)) continue;
        const tur = yuvaBul(kalem.ad).tur ?? 'DIGER';
        const gk = `${mk}|${tur}`;
        const g = parcaGrup.get(gk) ?? parcaGrup.set(gk, { model: modelAdi.get(mk) ?? '—', tur, adet: 0, bayiler: new Set() }).get(gk)!;
        g.adet++; g.bayiler.add(c.tenantId);
        parcaToplam++; parcaBayileri.add(c.tenantId);
      }
    }
  }
  const tonerSuz = kSuz([...tonerGrup.values()]);
  const parcaSuz = kSuz([...parcaGrup.values()]);

  // ── 5. MODEL GÜVENİLİRLİĞİ + GERÇEK VERİM ─────────────────────────
  const kutu = new Map<string, { degerler: number[]; bayiler: Set<string> }>();
  for (const c of kapsamda) {
    if (!verimGecerliMi(c.tonerYieldBlack)) continue;
    const k = anahtar.get(c.id)!;
    const v = kutu.get(k) ?? kutu.set(k, { degerler: [], bayiler: new Set() }).get(k)!;
    v.degerler.push(c.tonerYieldBlack); v.bayiler.add(c.tenantId);
  }
  const guvenSatir = guven.models.filter((m) => m.bayiSayisi >= K_ANONIM);
  const satirlar = guvenSatir.sort((a, b) => b.deviceCount - a.deviceCount).slice(0, GUVENILIRLIK_SATIR).map((m) => {
    const k = modelAnahtari(m.brand, m.model);
    const pop = populasyon.get(`${k}|BLACK`);
    const kv = kutu.get(k);
    return {
      model: m.model || '—',
      cihaz: m.deviceCount,
      arizaYil: m.failuresPerDeviceYear,
      mtbfGun: mtbfGun(m.failuresPerDeviceYear),
      gercekVerim: pop?.deger ?? null,
      gozlem: pop?.gozlem ?? 0,
      kutuVerimi: kv && kv.bayiler.size >= K_ANONIM ? ortanca(kv.degerler) : null,
    };
  });

  return {
    marka,
    esik: K_ANONIM,
    uretildi: simdi.toISOString(),
    ag: {
      bayi: kAnonim(toplamBayi, toplamBayi),
      adIzinli: kAnonim(toplamBayi, adliBayiler.length),
      adli,
      adliSayiGizli: !adliSayiGoster,
    },
    park: {
      cihaz: kAnonim(toplamBayi, kapsamda.length),
      aylikSayfa: kAnonim(sayfaBayileri.size, Math.round(gunlukToplam * 30)),
      sayfaOlculenCihaz: kAnonim(sayfaBayileri.size, olculen),
      modeller,
      gizliModel: modelSuz.gizli,
      iller,
      gizliIl: ilSatirlari.length - ilGosterilen.length,
    },
    toner: { pay: kAnonim(payBayileri.size, payHesapla(adet)), gun: PAY_PENCERESI_GUN },
    talep: {
      gun: TALEP_GUN,
      toner: tonerSuz.gosterilen.sort((a, b) => b.adet - a.adet).map(({ model, kanal, kod, adet: n }) => ({ model, kanal, kod, adet: n })),
      parca: parcaSuz.gosterilen.sort((a, b) => b.adet - a.adet).map(({ model, tur, adet: n }) => ({ model, tur, adet: n })),
      gizli: tonerSuz.gizli + parcaSuz.gizli,
      tonerToplam: kAnonim(tonerBayileri.size, tonerToplam),
      parcaToplam: kAnonim(parcaBayileri.size, parcaToplam),
    },
    guvenilirlik: { pencereAy: guven.months, satirlar, gizli: guven.models.length - guvenSatir.length },
  };
}

// ── DUYURULAR ────────────────────────────────────────────────────────────

/** Bir markada aynı anda en çok kaç süresi dolmamış duyuru tutulur. */
export const EN_COK_AKTIF_DUYURU = 20;

export interface DuyuruSatiri {
  id: string; kurumAd: string; baslik: string; metin: string; baglanti: string | null;
  bitis: string | null; createdAt: string; aktif: boolean;
}

const duyuruSec = { id: true, marka: true, kurumAd: true, baslik: true, metin: true, baglanti: true, bitis: true, createdAt: true } as const;

/** Markanın duyuruları (süresi dolanlar dahil, en yeni önce). Marka kanonik yazımla saklanır. */
export async function duyuruListesi(marka: string, simdi = new Date()): Promise<DuyuruSatiri[]> {
  const liste = await prisma.markaDuyurusu.findMany({
    where: { marka: markaYazimi(marka) }, orderBy: { createdAt: 'desc' }, take: 50, select: duyuruSec,
  });
  return liste.map((d) => ({
    id: d.id, kurumAd: d.kurumAd, baslik: d.baslik, metin: d.metin, baglanti: d.baglanti,
    bitis: d.bitis ? d.bitis.toISOString() : null, createdAt: d.createdAt.toISOString(),
    aktif: d.bitis === null || d.bitis.getTime() > simdi.getTime(),
  }));
}

export async function duyuruEkle(
  marka: string, kurumAd: string, yazanId: string | null, g: DuyuruGirdisi, simdi = new Date(),
): Promise<{ ok: true; id: string } | { ok: false; hata: 'COK_FAZLA' }> {
  const m = markaYazimi(marka);
  const aktif = await prisma.markaDuyurusu.count({ where: { marka: m, OR: [{ bitis: null }, { bitis: { gt: simdi } }] } });
  if (aktif >= EN_COK_AKTIF_DUYURU) return { ok: false, hata: 'COK_FAZLA' };
  const d = await prisma.markaDuyurusu.create({
    data: { marka: m, kurumAd: kurumAd.trim().slice(0, 80) || m, baslik: g.baslik, metin: g.metin, baglanti: g.baglanti, bitis: g.bitis, yazanId },
    select: { id: true },
  });
  return { ok: true, id: d.id };
}

/** Yalnız KENDİ markasının duyurusu silinir; başka markanın kimliği bilinse bile. */
export async function duyuruSil(marka: string, id: string): Promise<boolean> {
  const r = await prisma.markaDuyurusu.deleteMany({ where: { id, marka: markaYazimi(marka) } });
  return r.count === 1;
}

export interface BayiDuyurusu { id: string; kurumAd: string; baslik: string; metin: string; baglanti: string | null; createdAt: string }

/**
 * Bayinin panelinde görünecek duyurular: yalnız bayinin CİHAZI OLAN
 * markalar, süresi dolmamış, en çok 3. Demo bayide hiç yok.
 * Müşteri paneli bunu çağırmaz (yalnız /api/marka-duyurusu, bayi oturumu).
 */
export async function bayininDuyurulari(tenantId: string, simdi = new Date()): Promise<BayiDuyurusu[]> {
  const bayi = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { demo: true } });
  if (!bayi || bayi.demo) return [];
  const ciftler = await prisma.device.groupBy({ by: ['brand', 'model'], where: { tenantId } });
  const markalar = new Set(ciftler.map((c) => markaAnahtari(normalizeBrandModel(c.brand, c.model).brand)).filter(Boolean));
  if (!markalar.size) return [];
  const aktif = await prisma.markaDuyurusu.findMany({
    where: { OR: [{ bitis: null }, { bitis: { gt: simdi } }] },
    orderBy: { createdAt: 'desc' }, take: 300, select: duyuruSec,
  });
  return bayiDuyurulari(aktif, markalar, simdi).map((d) => ({
    id: d.id, kurumAd: d.kurumAd, baslik: d.baslik, metin: d.metin, baglanti: d.baglanti, createdAt: d.createdAt.toISOString(),
  }));
}

// ── BAYİ AYARI ───────────────────────────────────────────────────────────

export async function paylasimOku(tenantId: string): Promise<Paylasim | null> {
  return prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { oemDataSharing: true, markaAdIzni: true } });
}

/** Ayarı yazar; açılan iznin anı kaydedilir. Önceki ve sonraki durum döner (denetim için). */
export async function paylasimYaz(tenantId: string, istek: Partial<Paylasim>, simdi = new Date()): Promise<{ once: Paylasim; sonra: Paylasim } | null> {
  const once = await paylasimOku(tenantId);
  if (!once) return null;
  const sonra = paylasimSonrasi(once, istek);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      oemDataSharing: sonra.oemDataSharing,
      markaAdIzni: sonra.markaAdIzni,
      ...(sonra.oemDataSharing && !once.oemDataSharing ? { oemDataSharingAt: simdi } : {}),
      ...(sonra.markaAdIzni && !once.markaAdIzni ? { markaAdIzniAt: simdi } : {}),
    },
  });
  return { once, sonra };
}
