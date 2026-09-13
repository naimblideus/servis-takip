/**
 * SÖZLEŞME KÂRLILIĞI VE FİYAT KARARI.
 *
 * ── NEDEN SÖZLEŞME BAZINDA ───────────────────────────────────────────────
 * Kârlılık şimdiye kadar CİHAZ bazında hesaplanıyordu. Ama bayi cihaz
 * yenilemiyor, SÖZLEŞME yeniliyor: masaya "bu sözleşme bana ne kazandırıyor"
 * sorusuyla oturuyor. Cihaz başına altı satır, o sorunun cevabı değil.
 *
 * ── NEDEN FİYAT ÖNERİSİ ──────────────────────────────────────────────────
 * Yenileme görüşmesinde "zam lazım" demek ile "bu sözleşme %8 marjla
 * çalışıyor, %25 için kira ₺1.500 → ₺2.180 olmalı" demek aynı şey değil.
 * İkincisi bir rakam ve müşteriye gösterilebiliyor.
 *
 * ── UYDURMUYORUZ ─────────────────────────────────────────────────────────
 * Üç yerde bilerek SAYI ÜRETMİYORUZ:
 *
 *  1. Pencerede hiç fatura yoksa marj hesaplanmıyor. Sıfır gelirde marj
 *     "-%100" değil, ÖLÇÜLEMEZ.
 *  2. Hiç servis fişi yoksa maliyet sıfır çıkar ve marj %100 görünür. Bu
 *     kârlılık değil KAYIT EKSİKLİĞİ; ayrıca işaretleniyor.
 *  3. İşçilik maliyeti sistemde YOK. Bayi ziyaret başı maliyetini
 *     girmediyse hesaba katılmıyor ve "işçilik hariç" diye yazıyor —
 *     saat ücreti uydurmak bütün marjı yanlış yapardı.
 */

export type Pencere = { ay: number };

/** Kâr marjı (0–1). Gelir yoksa ÖLÇÜLEMEZ: null. */
export function marj(gelir: number, maliyet: number): number | null {
  if (!(gelir > 0)) return null;
  return (gelir - maliyet) / gelir;
}

/**
 * Hedef marj için gereken gelir.
 *
 * hedef 1'e eşit ya da büyükse sonsuz gelir gerekir — o yüzden null.
 * Maliyet sıfırsa her gelir hedefi tutturur; öneri üretmenin anlamı yok.
 */
export function hedefIcinGelir(maliyet: number, hedefMarj: number): number | null {
  if (!(hedefMarj >= 0) || hedefMarj >= 1) return null;
  if (!(maliyet > 0)) return null;
  return maliyet / (1 - hedefMarj);
}

/**
 * Sayfa başı toner maliyeti.
 *
 * Verim ÖLÇÜLMÜŞ olmak zorunda (bkz. verim-ogrenme.ts). Kutunun üstündeki
 * sayıyla hesaplasaydık, gerçekte %5 doluluk varsayımına göre yazılmış bir
 * rakamı sahadaki kapsamaya karıştırmış olurduk.
 */
export function sayfaMaliyeti(tonerAlisFiyati: number | null, verim: number | null): number | null {
  if (!(tonerAlisFiyati && tonerAlisFiyati > 0)) return null;
  if (!(verim && verim > 0)) return null;
  return tonerAlisFiyati / verim;
}

export type Oneri = {
  hedefMarj: number;
  /** Hedefe ulaşmak için gereken aylık gelir. */
  gerekenAylikGelir: number;
  /** Bugünkü gelirle arasındaki fark (negatifse zam gerekmiyor). */
  eksikAylik: number;
  /** Mevcut aylık kira biliniyorsa: kira bu olmalı. */
  onerilenKira: number | null;
  mevcutKira: number | null;
  /** Zam yüzdesi — mevcut kira biliniyorsa. */
  artisYuzde: number | null;
  /** Hedef zaten tutuyorsa true; öneri "zam gerekmiyor" demek. */
  zatenYeterli: boolean;
};

/**
 * Fiyat önerisi.
 *
 * Eksik gelirin TAMAMI kiraya yazılıyor, sayfa fiyatına değil. Sebep:
 * kira öngörülebilir, sayfa fiyatı hacme bağlı. Hacim tahminine dayalı bir
 * zam, hacim düşünce hedefi yine tutturmaz — ve müşteriye açıklaması da
 * zordur ("sayfa fiyatını artırdım ama az bastınız diye yine zarardayım").
 */
export function fiyatOnerisi(args: {
  aylikGelir: number;
  aylikMaliyet: number;
  hedefMarj: number;
  mevcutKira?: number | null;
}): Oneri | null {
  const { aylikGelir, aylikMaliyet, hedefMarj } = args;
  const gereken = hedefIcinGelir(aylikMaliyet, hedefMarj);
  if (gereken === null) return null;

  const eksik = gereken - aylikGelir;
  const mevcutKira = args.mevcutKira && args.mevcutKira > 0 ? args.mevcutKira : null;
  const onerilenKira = mevcutKira === null ? null : Math.max(0, mevcutKira + eksik);
  return {
    hedefMarj,
    gerekenAylikGelir: gereken,
    eksikAylik: eksik,
    onerilenKira,
    mevcutKira,
    artisYuzde: mevcutKira && onerilenKira !== null ? (onerilenKira - mevcutKira) / mevcutKira : null,
    zatenYeterli: eksik <= 0,
  };
}

// ── ÖLÇÜM KALİTESİ ───────────────────────────────────────────────────────

export type Uyari =
  | 'FATURA_YOK'
  | 'SERVIS_KAYDI_YOK'
  | 'MALIYET_YOK'
  | 'ISCILIK_HARIC'
  | 'PENCERE_KISA'
  | 'ALIS_FIYATI_EKSIK';

export const UYARI_METNI: Record<Uyari, string> = {
  FATURA_YOK: 'Bu dönemde hiç fatura kesilmemiş — marj hesaplanamıyor.',
  SERVIS_KAYDI_YOK: 'Hiç servis fişi yok. Marj yüksek görünüyor ama bu kârlılık değil, kayıt eksikliği olabilir.',
  MALIYET_YOK: 'Bu dönemde hiç maliyet kaydı yok — %100 marj kârlılık değil, kayıt eksikliğidir.',
  ISCILIK_HARIC: 'İşçilik hariç. Ayarlardan ziyaret başı maliyeti girersen hesaba katılır.',
  PENCERE_KISA: 'Dönemin tamamı faturalanmamış; aylık rakamlar faturalanan aya bölündü.',
  ALIS_FIYATI_EKSIK: 'Kullanılan parçaların bir kısmında alış fiyatı girilmemiş — maliyet olduğundan düşük görünüyor.',
};

/**
 * Ölçümün ne kadar güvenilir olduğunu söyleyen bayraklar.
 *
 * Bunları gizleseydik ekran her sözleşme için kesin bir yüzde gösterirdi ve
 * bayi o yüzdeye dayanarak fiyat konuşurdu. En pahalı hata bu olurdu:
 * kayıt eksikliğinden doğan sahte kâr.
 */
export function uyarilar(args: {
  gelir: number;
  fisSayisi: number;
  ziyaretMaliyetiTanimli: boolean;
  alisFiyatiEksikParca: number;
  kapsananAy: number;
  pencereAy: number;
  toplamMaliyet?: number;
}): Uyari[] {
  const u: Uyari[] = [];
  if (!(args.gelir > 0)) u.push('FATURA_YOK');
  if (args.fisSayisi === 0) u.push('SERVIS_KAYDI_YOK');
  // Gelir var ama HİÇ maliyet yoksa marj %100 çıkıyor. Bu bir sözleşmenin
  // gerçekten bedavaya çalıştığı anlamına gelmez; parça kaydı girilmemiş
  // demektir. Rakamı gizlemiyoruz ama yanında ne olduğunu yazıyoruz.
  if (args.gelir > 0 && args.toplamMaliyet !== undefined && !(args.toplamMaliyet > 0)) u.push('MALIYET_YOK');
  if (!args.ziyaretMaliyetiTanimli) u.push('ISCILIK_HARIC');
  if (args.alisFiyatiEksikParca > 0) u.push('ALIS_FIYATI_EKSIK');
  if (args.kapsananAy < args.pencereAy) u.push('PENCERE_KISA');
  return u;
}

/**
 * ÖLÇÜM PENCERESİ — kaç ay gerçekten FATURALANMIŞ.
 *
 * Bu düzeltme gerçek veride bulundu: demo bayide sözleşme kirası aylık
 * ₺2.455 ama ekran "aylık gelir ₺456" diyordu ve sözleşme %78 zararda
 * görünüyordu. Sebep, 12 aylık gelirin 12 aya bölünmesiydi — oysa
 * elde yalnız 2 ayın faturası vardı. Yeni taşınmış ya da yeni kurulmuş
 * her bayide aynı şey olurdu ve bayi ekranın tamamına güvenmezdi.
 *
 * Doğru bölen, ilk faturadan son faturaya kadar geçen AY SAYISI. O
 * aralıkta atlanmış bir ay varsa gerçekten gelir kaybıdır ve marja
 * yansıması doğrudur.
 */
export function faturaliAy(tarihler: Date[]): number {
  if (!tarihler.length) return 0;
  const aylar = tarihler.map((t) => t.getFullYear() * 12 + t.getMonth());
  return Math.max(...aylar) - Math.min(...aylar) + 1;
}

/** Faturaların kapsadığı aralığın başı — maliyet de aynı aralıktan sayılır. */
export function olcumBasi(tarihler: Date[]): Date | null {
  if (!tarihler.length) return null;
  const enEski = tarihler.reduce((a, b) => (a < b ? a : b));
  return new Date(enEski.getFullYear(), enEski.getMonth(), 1);
}

/**
 * Sözleşmenin pencerede KAÇ AY yürürlükte olduğu.
 *
 * Üç ay önce başlamış bir sözleşmeyi 12 aya bölmek aylık geliri dörtte bire
 * düşürür ve sözleşme zarar ediyor gibi görünür. Kapsanan ay, gerçekten
 * yürürlükte olunan ay.
 */
export function kapsananAy(
  baslangic: Date,
  bitis: Date,
  pencereBasi: Date,
  bugun: Date,
): number {
  const bas = Math.max(baslangic.getTime(), pencereBasi.getTime());
  const son = Math.min(bitis.getTime(), bugun.getTime());
  if (son <= bas) return 0;
  const ay = (son - bas) / (1000 * 60 * 60 * 24 * 30.44);
  // En az bir ay: yeni başlamış sözleşmede aylık rakam sonsuza gitmesin.
  return Math.max(1, Math.round(ay * 10) / 10);
}

// ── VERİTABANI ───────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { verimleriOgren, type VerimOzeti } from '@/lib/verim-ogrenme';
import { modelAnahtari } from '@/lib/toner-verimi';
import { kullanimMaliyeti } from '@/lib/stok-maliyet';

export const VARSAYILAN_HEDEF_MARJ = 0.25;

export type SozlesmeKarlilik = {
  contractId: string;
  contractNo: string | null;
  musteri: string;
  customerId: string;
  durum: string;
  bitis: string;
  cihazSayisi: number;
  kapsananAy: number;

  gelir: number;
  parcaMaliyeti: number;
  iscilikMaliyeti: number;
  toplamMaliyet: number;

  aylikGelir: number;
  aylikMaliyet: number;
  aylikKar: number;
  marj: number | null;

  fisSayisi: number;
  sozlesmeKira: number | null;
  /** Sayfa başı toner maliyeti — ölçülen verimden. Bilinmiyorsa null. */
  sayfaMaliyetiSb: number | null;
  /** Müşteriden alınan sayfa fiyatı (sözleşmede yazan). */
  sayfaFiyatiSb: number | null;
  /** Sayfa başı toner maliyeti alınan fiyatı AŞIYOR mu — sessiz zarar. */
  sayfaZarariVar: boolean;

  oneri: Oneri | null;
  uyarilar: Uyari[];
};

/**
 * Bütün sözleşmelerin kârlılığı.
 *
 * Gelir FATURA SATIRLARINDAN geliyor (kira + sayaç), maliyet fişlerde
 * kullanılan parçaların ALIŞ fiyatından. İkisi de tahmin değil kayıt.
 */
export async function sozlesmeKarliliklari(
  tenantId: string,
  opts: { ay?: number; hedefMarj?: number } = {},
): Promise<{ ay: number; hedefMarj: number; ziyaretMaliyeti: number | null; sozlesmeler: SozlesmeKarlilik[] }> {
  const ay = Math.min(36, Math.max(1, opts.ay ?? 12));
  const bugun = new Date();
  const pencereBasi = new Date(bugun.getTime() - ay * 30.44 * 24 * 3600 * 1000);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { ziyaretMaliyeti: true, hedefMarj: true },
  });
  const ziyaretMaliyeti = tenant?.ziyaretMaliyeti == null ? null : Number(tenant.ziyaretMaliyeti);
  const hedefMarj = opts.hedefMarj ?? (tenant?.hedefMarj == null ? VARSAYILAN_HEDEF_MARJ : Number(tenant.hedefMarj));

  const sozlesmeler = await prisma.contract.findMany({
    where: { tenantId },
    orderBy: { endDate: 'asc' },
    select: {
      id: true, contractNo: true, status: true, startDate: true, endDate: true,
      customerId: true, customer: { select: { name: true } },
      devices: {
        select: {
          deviceId: true, monthlyRent: true, pricePerBlack: true,
          device: { select: { brand: true, model: true, monthlyRent: true } },
        },
      },
    },
  });

  const cihazIdleri = [...new Set(sozlesmeler.flatMap((s) => s.devices.map((d) => d.deviceId)))];
  if (!cihazIdleri.length) return { ay, hedefMarj, ziyaretMaliyeti, sozlesmeler: [] };

  // ── GELİR ── kira + sayaç fatura satırları
  // Tarihler de çekiliyor: aylık rakamı KAÇ AY FATURALANDIĞINA bölmek
  // için gerekiyor (bkz. faturaliAy).
  const gelirSatirlari = await prisma.invoiceLine.findMany({
    where: {
      tenantId, deviceId: { in: cihazIdleri }, kind: { in: ['RENTAL', 'COUNTER'] },
      invoice: { deletedAt: null, invoiceDate: { gte: pencereBasi } },
    },
    select: { deviceId: true, lineTotal: true, invoice: { select: { invoiceDate: true } } },
  });
  const gelirHaritasi = new Map<string, number>();
  const tarihHaritasi = new Map<string, Date[]>();
  for (const g of gelirSatirlari) {
    if (!g.deviceId) continue;
    gelirHaritasi.set(g.deviceId, (gelirHaritasi.get(g.deviceId) || 0) + Number(g.lineTotal || 0));
    const d = g.invoice?.invoiceDate;
    if (d) {
      const dizi = tarihHaritasi.get(g.deviceId) ?? tarihHaritasi.set(g.deviceId, []).get(g.deviceId)!;
      dizi.push(d);
    }
  }

  // ── MALİYET ── fişlerde kullanılan parçalar, ALIŞ fiyatı
  const parcalar = await prisma.ticketPart.findMany({
    where: { tenantId, ticket: { deviceId: { in: cihazIdleri }, deletedAt: null, createdAt: { gte: pencereBasi } } },
    select: {
      quantity: true, unitCost: true,
      ticket: { select: { deviceId: true, createdAt: true } },
      part: { select: { buyPrice: true, avgCost: true } },
    },
  });
  const maliyetHaritasi = new Map<string, { tutar: number; tarih: Date }[]>();
  const eksikFiyatHaritasi = new Map<string, number>();
  for (const p of parcalar) {
    const did = p.ticket?.deviceId;
    if (!did) continue;
    // Maliyet KULLANIM ANINDAN: dondurulmuş unitCost varsa o, yoksa
    // parçanın bugünkü ağırlıklı ortalaması.
    const m = kullanimMaliyeti(
      { unitCost: p.unitCost === null ? null : Number(p.unitCost), quantity: p.quantity },
      { avgCost: p.part?.avgCost === null ? null : Number(p.part?.avgCost), buyPrice: Number(p.part?.buyPrice || 0) },
    );
    // Maliyeti hiç bilinmeyen parça sessizce SIFIR sayılmıyor; sayılıyor ve
    // uyarı olarak bildiriliyor. Aksi hâlde marj şişerdi.
    if (m.bilinmiyor) eksikFiyatHaritasi.set(did, (eksikFiyatHaritasi.get(did) || 0) + 1);
    const dizi = maliyetHaritasi.get(did) ?? maliyetHaritasi.set(did, []).get(did)!;
    dizi.push({ tutar: m.tutar, tarih: p.ticket!.createdAt });
  }

  // ── ZİYARET SAYISI ── işçilik için (maliyeti bayi giriyor)
  const fisler = await prisma.serviceTicket.findMany({
    where: { tenantId, deviceId: { in: cihazIdleri }, deletedAt: null, createdAt: { gte: pencereBasi } },
    select: { deviceId: true, createdAt: true },
  });
  const fisHaritasi = new Map<string, Date[]>();
  for (const f of fisler) {
    const dizi = fisHaritasi.get(f.deviceId) ?? fisHaritasi.set(f.deviceId, []).get(f.deviceId)!;
    dizi.push(f.createdAt);
  }

  // ── SAYFA BAŞI TONER MALİYETİ ── Motor 1'in ölçtüğü verimden
  const ogrenilen = await verimleriOgren(tenantId);
  const tonerFiyatlari = await tonerAlisFiyatlari(tenantId);

  return {
    ay, hedefMarj, ziyaretMaliyeti,
    sozlesmeler: sozlesmeler.map((s) => {
      const yurumeAyi = kapsananAy(s.startDate, s.endDate, pencereBasi, bugun);

      // ÖLÇÜM PENCERESİ: faturaların kapsadığı aralık. Gelir ve maliyet
      // AYNI aralıktan sayılıyor; farklı aralıklar marjı uydurma yapardı.
      const tumTarihler = s.devices.flatMap((cd) => tarihHaritasi.get(cd.deviceId) ?? []);
      const ayAdedi = faturaliAy(tumTarihler);
      const basi = olcumBasi(tumTarihler);
      const kapsanan = ayAdedi > 0 ? ayAdedi : yurumeAyi;

      let gelir = 0, parca = 0, fis = 0, eksikFiyat = 0, kira = 0, kiraVar = false;
      let sayfaFiyati: number | null = null;
      let sayfaMaliyetToplam = 0, sayfaMaliyetAdet = 0;

      for (const cd of s.devices) {
        gelir += gelirHaritasi.get(cd.deviceId) || 0;
        // Maliyet, faturaların kapsadığı aralıktan sayılıyor. Hiç fatura
        // yoksa pencerenin tamamı alınıyor (marj zaten hesaplanmıyor).
        for (const m of maliyetHaritasi.get(cd.deviceId) ?? []) {
          if (!basi || m.tarih >= basi) parca += m.tutar;
        }
        for (const d of fisHaritasi.get(cd.deviceId) ?? []) {
          if (!basi || d >= basi) fis++;
        }
        eksikFiyat += eksikFiyatHaritasi.get(cd.deviceId) || 0;

        // Kira: sözleşmede yazan varsa o, yoksa cihazın kendi kirası.
        const k = cd.monthlyRent ?? cd.device?.monthlyRent;
        if (k != null) { kira += Number(k); kiraVar = true; }
        if (cd.pricePerBlack != null && sayfaFiyati === null) sayfaFiyati = Number(cd.pricePerBlack);

        const anahtar = modelAnahtari(cd.device?.brand, cd.device?.model);
        const verim: VerimOzeti | undefined = ogrenilen.model.get(`${anahtar}|BLACK`);
        const sm = sayfaMaliyeti(tonerFiyatlari.get(anahtar) ?? null, verim?.deger ?? null);
        if (sm !== null) { sayfaMaliyetToplam += sm; sayfaMaliyetAdet++; }
      }

      const iscilik = ziyaretMaliyeti === null ? 0 : ziyaretMaliyeti * fis;
      const toplamMaliyet = parca + iscilik;
      const aylikGelir = gelir / kapsanan;
      const aylikMaliyet = toplamMaliyet / kapsanan;
      const sayfaMaliyetiSb = sayfaMaliyetAdet ? sayfaMaliyetToplam / sayfaMaliyetAdet : null;

      return {
        contractId: s.id,
        contractNo: s.contractNo,
        musteri: s.customer?.name ?? '—',
        customerId: s.customerId,
        durum: s.status,
        bitis: s.endDate.toISOString(),
        cihazSayisi: s.devices.length,
        kapsananAy: kapsanan,
        gelir, parcaMaliyeti: parca, iscilikMaliyeti: iscilik, toplamMaliyet,
        aylikGelir, aylikMaliyet,
        aylikKar: aylikGelir - aylikMaliyet,
        marj: marj(gelir, toplamMaliyet),
        fisSayisi: fis,
        sozlesmeKira: kiraVar ? kira : null,
        sayfaMaliyetiSb,
        sayfaFiyatiSb: sayfaFiyati,
        sayfaZarariVar: sayfaMaliyetiSb !== null && sayfaFiyati !== null && sayfaMaliyetiSb > sayfaFiyati,
        oneri: gelir > 0
          ? fiyatOnerisi({ aylikGelir, aylikMaliyet, hedefMarj, mevcutKira: kiraVar ? kira : null })
          : null,
        uyarilar: uyarilar({
          gelir, fisSayisi: fis,
          ziyaretMaliyetiTanimli: ziyaretMaliyeti !== null,
          alisFiyatiEksikParca: eksikFiyat,
          kapsananAy: kapsanan, pencereAy: Math.min(ay, Math.ceil(yurumeAyi)),
          toplamMaliyet,
        }),
      };
    }),
  };
}

/**
 * Model başına toner ALIŞ fiyatı — takılan kartuşların ortancası.
 *
 * `TonerChange.partId` sayesinde hangi cihaza hangi kartuşun takıldığı
 * biliniyor; fiyat o parçanın alış fiyatından geliyor. Ortanca, çünkü aynı
 * modele farklı markalardan farklı fiyatlara toner takılıyor.
 */
async function tonerAlisFiyatlari(tenantId: string): Promise<Map<string, number>> {
  const kayitlar = await prisma.tonerChange.findMany({
    where: { tenantId, partId: { not: null }, channel: 'BLACK' },
    select: { partId: true, device: { select: { brand: true, model: true } } },
  });
  if (!kayitlar.length) return new Map();

  // partId bir ilişki DEĞİL, düz alan: parça silinse bile değişim kaydı
  // durmalı (toner gerçekten değişti). Fiyatlar ayrı sorguyla okunuyor.
  const parcalar = await prisma.part.findMany({
    where: { tenantId, id: { in: [...new Set(kayitlar.map((k) => k.partId!))] } },
    select: { id: true, buyPrice: true },
  });
  const fiyatHaritasi = new Map(parcalar.map((p) => [p.id, Number(p.buyPrice || 0)]));

  const grup = new Map<string, number[]>();
  for (const k of kayitlar) {
    const fiyat = fiyatHaritasi.get(k.partId!) ?? 0;
    if (!(fiyat > 0)) continue;
    const a = modelAnahtari(k.device?.brand, k.device?.model);
    const dizi = grup.get(a) ?? grup.set(a, []).get(a)!;
    dizi.push(fiyat);
  }
  const cikan = new Map<string, number>();
  for (const [a, f] of grup) {
    const s = f.sort((x, y) => x - y);
    const o = Math.floor(s.length / 2);
    cikan.set(a, s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2);
  }
  return cikan;
}
