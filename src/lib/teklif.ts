/**
 * TEKLİF MOTORU — aday müşterinin filosunu değerlendirip fiyat çıkarmak.
 *
 * ── NEDEN BU DOSYA ───────────────────────────────────────────────────────
 * Sektörde teklif hâlâ çok sayfalı Excel'lerle kuruluyor. Oysa teklifin
 * doğru kurulması için gereken iki sayı bu sistemde artık ÖLÇÜLÜ duruyor:
 *
 *   1. Sayfa başı gerçek toner maliyeti — ölçülen verimden (verim-ogrenme)
 *      ve ağırlıklı ortalama alıştan (stok-maliyet).
 *   2. Bayinin hedef marjı (sozlesme-karlilik).
 *
 * Teklif o iki sayıdan çıkıyor, pazarlık hissinden değil. Bayi masaya
 * "bu fiyatı verebilirim çünkü maliyetim şu" diyerek oturuyor.
 *
 * ── UYDURMUYORUZ ─────────────────────────────────────────────────────────
 *  · Ölçülmemiş modelde sayfa maliyeti hesaplanmıyor; o satır için fiyat
 *    ÖNERİLMİYOR ve bayi elle yazıyor. Uydurma maliyetten çıkan bir fiyat,
 *    zarar eden bir sözleşmenin ta kendisi olurdu.
 *  · Müşterinin şu an ne ödediği bilinmiyorsa TASARRUF HESAPLANMIYOR.
 *    "Yılda ₺40.000 kazandırıyoruz" cümlesi, müşterinin faturası elde
 *    olmadan kurulamaz.
 *  · Servis/işçilik maliyeti bu hesapta YOK ve bu açıkça yazılıyor —
 *    yalnız sarf maliyeti. Servisi de dahil etmek, ziyaret sıklığını
 *    tahmin etmeyi gerektirirdi.
 */

import { modelAnahtari } from '@/lib/toner-verimi';

export type TeklifSatirGirdisi = {
  marka: string;
  model: string;
  adet: number;
  aylikSayfaSb: number;
  aylikSayfaRenkli: number;
  mevcutAylikTutar: number | null;
  onerilenKira: number | null;
  onerilenSayfaSb: number | null;
  onerilenSayfaRenkli: number | null;
};

/** Model başına ölçülmüş sayfa maliyeti (TL/sayfa). Ölçüm yoksa alan yok. */
export type SayfaMaliyetleri = Map<string, { sb: number | null; renkli: number | null; gozlem: number }>;

export type SatirHesabi = {
  marka: string;
  model: string;
  adet: number;
  aylikSayfa: number;

  /** Müşterinin şu anki sayfa başı maliyeti. Ödediği bilinmiyorsa null. */
  mevcutSayfaMaliyeti: number | null;
  mevcutAylik: number | null;

  /** Bizim sarf maliyetimiz (aylık). Ölçüm yoksa null. */
  bizimAylikMaliyet: number | null;
  maliyetOlculdu: boolean;
  gozlem: number;

  /** Teklif — elle girilmişse o, yoksa hedef marjdan hesaplanan. */
  teklifAylik: number | null;
  teklifKaynagi: 'ELLE' | 'HESAPLANDI' | null;
  teklifKira: number | null;
  teklifSayfaSb: number | null;
  teklifSayfaRenkli: number | null;

  /** Bu satırda aylık tasarruf (pozitif = müşteri kazanıyor). */
  aylikTasarruf: number | null;
  /** Bizim bu satırdaki marjımız — MÜŞTERİYE GÖSTERİLMEZ. */
  bizimMarj: number | null;
};

const yuvarla = (n: number) => Math.round(n * 100) / 100;
const kurus4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Gruplama anahtarı — maliyet haritasıyla AYNI FONKSİYONDAN.
 *
 * Bu anahtar bir kopya olarak yazılmıştı ve iki yer ayrışıyordu:
 * `modelAnahtari` önce markayı kanonikleştiriyor ("RICOH"/"ricoh" →
 * "Ricoh"), buradaki kopya kanonikleştirmiyordu. Sonuç: teklifte "RICOH"
 * yazılınca ölçülmüş maliyet BULUNAMIYOR ve satır "maliyeti
 * ölçülmedi" görünüyordu — elde ölçüm olduğu hâlde.
 *
 * Artık tek kaynak var. Türkçe büyükharf tuzağı da orada tek yerde
 * duruyor ('Ricoh' → 'RİCOH', 'RICOH' → 'RICOH' — marka kanonikleştirmesi
 * ikisini de aynı yazıma çekiyor).
 */
export function satirAnahtari(marka: string, model: string): string {
  return modelAnahtari(marka, model);
}

/**
 * Tek satırın hesabı.
 *
 * Fiyat, MALİYETİN ÜSTÜNE YÜZDE EKLEYEREK değil maliyeti (1 - marj)'a
 * bölerek bulunuyor. Yaygın hata birincisi ve hedef marjı hiç tutturmuyor:
 * ₺750 maliyete %25 eklemek ₺937,50 verir, o fiyatta marj %20'dir.
 */
export function satirHesapla(
  satir: TeklifSatirGirdisi,
  maliyet: { sb: number | null; renkli: number | null; gozlem: number } | undefined,
  hedefMarj: number,
): SatirHesabi {
  const adet = Math.max(1, satir.adet || 1);
  const sbSayfa = Math.max(0, satir.aylikSayfaSb || 0);
  const renkliSayfa = Math.max(0, satir.aylikSayfaRenkli || 0);
  const toplamSayfa = (sbSayfa + renkliSayfa) * adet;

  // ── MÜŞTERİNİN BUGÜNÜ ──
  const mevcutAylik = satir.mevcutAylikTutar != null && satir.mevcutAylikTutar > 0
    ? satir.mevcutAylikTutar : null;
  const mevcutSayfaMaliyeti = mevcutAylik !== null && toplamSayfa > 0
    ? kurus4(mevcutAylik / toplamSayfa) : null;

  // ── BİZİM MALİYETİMİZ ──
  // Renkli sayfanın maliyeti ölçülmemişse o kısım hesaba GİRMİYOR ve
  // satır "ölçülmedi" sayılıyor: eksik maliyetle fiyat çıkarmak, zarar
  // eden bir teklif üretmenin en kolay yolu.
  const sbBilinir = maliyet?.sb != null && maliyet.sb > 0;
  const renkliBilinir = maliyet?.renkli != null && maliyet.renkli > 0;
  const renkliGerekli = renkliSayfa > 0;
  const olculdu = sbBilinir && (!renkliGerekli || renkliBilinir);

  const bizimAylikMaliyet = olculdu
    ? yuvarla((sbSayfa * (maliyet!.sb as number) + renkliSayfa * (renkliBilinir ? (maliyet!.renkli as number) : 0)) * adet)
    : null;

  // ── TEKLİF ──
  const elleKira = satir.onerilenKira != null && satir.onerilenKira > 0 ? satir.onerilenKira : null;
  const elleSb = satir.onerilenSayfaSb != null && satir.onerilenSayfaSb > 0 ? satir.onerilenSayfaSb : null;
  const elleRenkli = satir.onerilenSayfaRenkli != null && satir.onerilenSayfaRenkli > 0 ? satir.onerilenSayfaRenkli : null;

  let teklifAylik: number | null = null;
  let teklifKaynagi: SatirHesabi['teklifKaynagi'] = null;
  let teklifKira = elleKira;
  let teklifSayfaSb = elleSb;
  let teklifSayfaRenkli = elleRenkli;

  if (elleKira !== null || elleSb !== null || elleRenkli !== null) {
    teklifAylik = yuvarla(
      (elleKira ?? 0) * adet
      + (elleSb ?? 0) * sbSayfa * adet
      + (elleRenkli ?? 0) * renkliSayfa * adet,
    );
    teklifKaynagi = 'ELLE';
  } else if (bizimAylikMaliyet !== null && hedefMarj >= 0 && hedefMarj < 1) {
    teklifAylik = yuvarla(bizimAylikMaliyet / (1 - hedefMarj));
    teklifKaynagi = 'HESAPLANDI';
    // Hesaplanan tutar SAYFA FİYATINA yazılıyor, kiraya değil: aday
    // müşteride kira beklentisi bilinmiyor ve sayfa fiyatı sektörün
    // konuştuğu birim. Bayi isterse elle kiraya çevirebiliyor.
    if (toplamSayfa > 0) {
      const birim = kurus4(teklifAylik / toplamSayfa);
      teklifSayfaSb = birim;
      teklifSayfaRenkli = renkliSayfa > 0 ? birim : null;
    }
  }

  return {
    marka: satir.marka, model: satir.model, adet,
    aylikSayfa: toplamSayfa,
    mevcutSayfaMaliyeti, mevcutAylik,
    bizimAylikMaliyet, maliyetOlculdu: olculdu, gozlem: maliyet?.gozlem ?? 0,
    teklifAylik, teklifKaynagi, teklifKira, teklifSayfaSb, teklifSayfaRenkli,
    aylikTasarruf: mevcutAylik !== null && teklifAylik !== null ? yuvarla(mevcutAylik - teklifAylik) : null,
    bizimMarj: teklifAylik !== null && teklifAylik > 0 && bizimAylikMaliyet !== null
      ? (teklifAylik - bizimAylikMaliyet) / teklifAylik : null,
  };
}

export type TeklifOzeti = {
  satirlar: SatirHesabi[];
  makineSayisi: number;
  aylikSayfa: number;
  /** Müşterinin bugünkü toplam aylık ödemesi — tamamı biliniyorsa. */
  mevcutAylik: number | null;
  /** Bilinmeyen satır sayısı: tasarruf iddiası bunlar varken kurulamaz. */
  mevcutBilinmeyenSatir: number;
  teklifAylik: number | null;
  teklifsizSatir: number;
  aylikTasarruf: number | null;
  yillikTasarruf: number | null;
  tasarrufYuzde: number | null;
  /** Bizim toplam marjımız — MÜŞTERİYE GÖSTERİLMEZ. */
  bizimMarj: number | null;
  olculmeyenSatir: number;
};

export function teklifOzeti(hesaplar: SatirHesabi[]): TeklifOzeti {
  const makineSayisi = hesaplar.reduce((a, s) => a + s.adet, 0);
  const aylikSayfa = hesaplar.reduce((a, s) => a + s.aylikSayfa, 0);

  const mevcutBilinmeyenSatir = hesaplar.filter((s) => s.mevcutAylik === null).length;
  // TASARRUF İDDİASI TAM VERİ İSTİYOR: bir makinenin bugünkü bedeli
  // bilinmiyorsa toplam tasarruf da bilinmiyor. Eksik toplamı "tasarruf"
  // diye göstermek, müşteriye tutulamayacak bir söz vermek olurdu.
  const mevcutAylik = mevcutBilinmeyenSatir === 0
    ? yuvarla(hesaplar.reduce((a, s) => a + (s.mevcutAylik ?? 0), 0)) : null;

  const teklifsizSatir = hesaplar.filter((s) => s.teklifAylik === null).length;
  const teklifAylik = teklifsizSatir === 0
    ? yuvarla(hesaplar.reduce((a, s) => a + (s.teklifAylik ?? 0), 0)) : null;

  const aylikTasarruf = mevcutAylik !== null && teklifAylik !== null
    ? yuvarla(mevcutAylik - teklifAylik) : null;

  const maliyetToplam = hesaplar.every((s) => s.bizimAylikMaliyet !== null)
    ? hesaplar.reduce((a, s) => a + (s.bizimAylikMaliyet ?? 0), 0) : null;

  return {
    satirlar: hesaplar,
    makineSayisi, aylikSayfa,
    mevcutAylik, mevcutBilinmeyenSatir,
    teklifAylik, teklifsizSatir,
    aylikTasarruf,
    yillikTasarruf: aylikTasarruf === null ? null : yuvarla(aylikTasarruf * 12),
    tasarrufYuzde: aylikTasarruf !== null && mevcutAylik !== null && mevcutAylik > 0
      ? aylikTasarruf / mevcutAylik : null,
    bizimMarj: teklifAylik !== null && teklifAylik > 0 && maliyetToplam !== null
      ? (teklifAylik - maliyetToplam) / teklifAylik : null,
    olculmeyenSatir: hesaplar.filter((s) => !s.maliyetOlculdu).length,
  };
}

// ── VERİTABANI ───────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { verimleriOgren, populasyonVerimleri } from '@/lib/verim-ogrenme';
import { sayfaMaliyeti, VARSAYILAN_HEDEF_MARJ } from '@/lib/sozlesme-karlilik';

/**
 * Model başına ölçülmüş sayfa maliyeti.
 *
 * İki ölçümün çarpımı: ağırlıklı ortalama toner alış fiyatı ÷ sahada
 * ölçülen verim. İkisinden biri yoksa o model için maliyet YOK — ve
 * teklifte o satır fiyatsız kalıyor.
 */
export async function modelSayfaMaliyetleri(tenantId: string): Promise<SayfaMaliyetleri> {
  const ogrenilen = await verimleriOgren(tenantId);
  const populasyon = await populasyonVerimleri();

  // Takılan kartuşların ağırlıklı ortalama alış fiyatı, model+kanal başına.
  const kayitlar = await prisma.tonerChange.findMany({
    where: { tenantId, partId: { not: null } },
    select: { partId: true, channel: true, device: { select: { brand: true, model: true } } },
  });
  const parcaIdleri = [...new Set(kayitlar.map((k) => k.partId!))];
  const parcalar = parcaIdleri.length
    ? await prisma.part.findMany({
        where: { tenantId, id: { in: parcaIdleri } },
        select: { id: true, avgCost: true, buyPrice: true },
      })
    : [];
  const fiyat = new Map(parcalar.map((p) => [p.id, Number(p.avgCost ?? 0) || Number(p.buyPrice ?? 0)]));

  const tonerFiyat = new Map<string, number[]>();
  for (const k of kayitlar) {
    const f = fiyat.get(k.partId!) ?? 0;
    if (!(f > 0)) continue;
    const a = `${modelAnahtari(k.device?.brand, k.device?.model)}|${k.channel}`;
    const dizi = tonerFiyat.get(a) ?? tonerFiyat.set(a, []).get(a)!;
    dizi.push(f);
  }
  const ortancaFiyat = (a: string): number | null => {
    const d = tonerFiyat.get(a);
    if (!d || !d.length) return null;
    const s = [...d].sort((x, y) => x - y);
    const o = Math.floor(s.length / 2);
    return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
  };

  const cikan: SayfaMaliyetleri = new Map();
  const anahtarlar = new Set<string>();
  for (const k of ogrenilen.model.keys()) anahtarlar.add(k.slice(0, k.lastIndexOf('|')));
  for (const k of populasyon.keys()) anahtarlar.add(k.slice(0, k.lastIndexOf('|')));

  for (const anahtar of anahtarlar) {
    const verimSb = ogrenilen.model.get(`${anahtar}|BLACK`) ?? populasyon.get(`${anahtar}|BLACK`);
    const verimRenkli = ogrenilen.model.get(`${anahtar}|COLOR`) ?? populasyon.get(`${anahtar}|COLOR`);
    const sb = sayfaMaliyeti(ortancaFiyat(`${anahtar}|BLACK`), verimSb?.deger ?? null);
    const renkli = sayfaMaliyeti(ortancaFiyat(`${anahtar}|COLOR`), verimRenkli?.deger ?? null);
    if (sb === null && renkli === null) continue;
    cikan.set(anahtar, { sb, renkli, gozlem: (verimSb?.gozlem ?? 0) + (verimRenkli?.gozlem ?? 0) });
  }
  return cikan;
}

/** Bayinin hedef marjı (teklife özel değer varsa o geçerli). */
export async function hedefMarjBul(tenantId: string, teklifMarj?: number | null): Promise<number> {
  if (teklifMarj != null && teklifMarj >= 0 && teklifMarj < 1) return teklifMarj;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { hedefMarj: true } });
  return t?.hedefMarj == null ? VARSAYILAN_HEDEF_MARJ : Number(t.hedefMarj);
}

/** Bir teklifin tam hesabı — ekran ve çıktı aynı yerden besleniyor. */
export async function teklifHesapla(tenantId: string, teklifId: string) {
  const teklif = await prisma.teklif.findFirst({
    where: { id: teklifId, tenantId },
    include: { satirlar: { orderBy: { createdAt: 'asc' } }, customer: { select: { id: true, name: true } } },
  });
  if (!teklif) return null;

  const maliyetler = await modelSayfaMaliyetleri(tenantId);
  const hedefMarj = await hedefMarjBul(tenantId, teklif.hedefMarj == null ? null : Number(teklif.hedefMarj));

  const hesaplar = teklif.satirlar.map((s) =>
    satirHesapla(
      {
        marka: s.marka, model: s.model, adet: s.adet,
        aylikSayfaSb: s.aylikSayfaSb, aylikSayfaRenkli: s.aylikSayfaRenkli,
        mevcutAylikTutar: s.mevcutAylikTutar == null ? null : Number(s.mevcutAylikTutar),
        onerilenKira: s.onerilenKira == null ? null : Number(s.onerilenKira),
        onerilenSayfaSb: s.onerilenSayfaSb == null ? null : Number(s.onerilenSayfaSb),
        onerilenSayfaRenkli: s.onerilenSayfaRenkli == null ? null : Number(s.onerilenSayfaRenkli),
      },
      maliyetler.get(satirAnahtari(s.marka, s.model)),
      hedefMarj,
    ),
  );

  return {
    teklif: {
      id: teklif.id, teklifNo: teklif.teklifNo, musteriAdi: teklif.musteriAdi,
      customerId: teklif.customerId, musteri: teklif.customer?.name ?? null,
      yetkili: teklif.yetkili, telefon: teklif.telefon, eposta: teklif.eposta,
      durum: teklif.durum, gecerlilikGun: teklif.gecerlilikGun,
      notlar: teklif.notlar, createdAt: teklif.createdAt.toISOString(),
    },
    hedefMarj,
    satirIdleri: teklif.satirlar.map((s) => s.id),
    ozet: teklifOzeti(hesaplar),
  };
}

/**
 * Sıradaki teklif numarası: TKF-2026-0001.
 *
 * Sayaç yok; o yılın en büyük numarasının bir fazlası alınıyor. Teklifte
 * GİB sırası gibi bir zorunluluk olmadığı için boşluk sorun değil — ama
 * aynı numaranın iki teklife verilmemesi için benzersizlik veritabanında
 * kilitli (@@unique).
 */
export async function siradakiTeklifNo(tenantId: string, yil = new Date().getFullYear()): Promise<string> {
  const onEk = `TKF-${yil}-`;
  const son = await prisma.teklif.findFirst({
    where: { tenantId, teklifNo: { startsWith: onEk } },
    orderBy: { teklifNo: 'desc' },
    select: { teklifNo: true },
  });
  const sira = son ? Number(son.teklifNo.slice(onEk.length)) + 1 : 1;
  return `${onEk}${String(sira).padStart(4, '0')}`;
}
