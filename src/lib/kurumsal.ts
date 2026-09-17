/**
 * KURUMSAL GRUP RAPORU — SAF HESAP.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Büyük hesabın şubeleri bayide ayrı müşteri olarak kayıtlıdır ve bu doğru:
 * fatura şubeye kesilir, servis şubeye gider, cari şubede tutulur. Eksik
 * olan tek şey BİRLEŞTİRME. Genel müdürlüğün yılda bir sorduğu soruların
 * cevabı hiçbir ekranda yoktu:
 *
 *   "Bize toplam kaç makine veriyorsunuz, kaç sayfa bastık, sözünüzü
 *    tuttunuz mu, hangi şubede sorun var?"
 *
 * Bu soruya cevap veremeyen bayi, ihaleyi cevap verebilene kaptırır.
 * Grup bir ÇATIDIR: faturayı, sözleşmeyi, cariyi değiştirmez.
 *
 * ── SLA AĞIRLIKLI BİRLEŞİR ───────────────────────────────────────────────
 * Grubun uyum oranı, şube oranlarının ortalaması DEĞİL: ölçülen fiş
 * sayısıyla ağırlıklandırılır. Tek fişi olan şube ile iki yüz fişi olan
 * şubeyi eşit saymak, kötü giden büyük şubeyi küçük şubelerin arkasına
 * saklardı.
 *
 * ── SIFIR SAYFA İLE OKUNMAMIŞ SAYFA AYNI ŞEY DEĞİL ───────────────────────
 * Dönemde hiç sayaç okunmamış şubenin sayfası "0" değil BİLİNMİYOR'dur.
 * Sıfır yazmak, o şubenin hiç basmadığı anlamına gelir ve kurumsal
 * raporun en kolay yakalanan yalanı budur. Okunan cihaz sayısı her satırda
 * ayrıca duruyor.
 */

export interface SubeSatiri {
  musteriId: string;
  musteri: string;
  /** Şubedeki cihaz sayısı. */
  cihaz: number;
  /** Dönemde EN AZ BİR okuması olan cihaz sayısı. */
  okunanCihaz: number;
  /** Dönem sayfaları. Hiç okuma yoksa null — sıfır DEĞİL. */
  siyah: number | null;
  renkli: number | null;
  /** Dönemde açılan gerçek arıza fişi. */
  ariza: number;
  /** Dönemde açılan planlı ziyaret (bakım/kurulum/sarf). */
  planli: number;
  /** SLA uyumu (0-100). Sözleşmede süre yazmıyorsa null. */
  slaMudahaleYuzde: number | null;
  slaCozumYuzde: number | null;
  /** SLA ölçümüne giren fiş sayısı — ağırlık budur. */
  slaOlculen: number;
  /** Dönemde kesilen fatura toplamı. */
  donemFaturasi: number;
  /** Güncel açık bakiye (dönemden bağımsız — bugünkü borç). */
  bakiye: number;
}

export interface GrupToplami {
  sube: number;
  cihaz: number;
  okunanCihaz: number;
  /** Okuması olmayan cihaz — rapora bakanın görmesi gereken sayı. */
  okunmayanCihaz: number;
  siyah: number | null;
  renkli: number | null;
  toplamSayfa: number | null;
  /** Renkli sayfa payı (0-100). Sayfa yoksa null. */
  renkliPayi: number | null;
  ariza: number;
  planli: number;
  /** Ağırlıklı SLA uyumu (0-100); hiç ölçüm yoksa null. */
  slaMudahaleYuzde: number | null;
  slaCozumYuzde: number | null;
  slaOlculen: number;
  /** Sözleşmesinde süre yazılı şube sayısı — "3/8 şubede söz var". */
  slaSozluSube: number;
  donemFaturasi: number;
  bakiye: number;
  /** Bakiyesi olan şube sayısı. */
  bakiyeliSube: number;
}

/** Ağırlıklı ortalama; ağırlık toplamı sıfırsa null. */
export function agirlikliOrtalama(
  satirlar: { deger: number | null; agirlik: number }[],
): number | null {
  let toplam = 0, agirlik = 0;
  for (const s of satirlar) {
    if (s.deger === null || !(s.agirlik > 0)) continue;
    toplam += s.deger * s.agirlik;
    agirlik += s.agirlik;
  }
  return agirlik > 0 ? toplam / agirlik : null;
}

/** Bir sayı dizisini toplar; hepsi null ise null döner (sıfır değil). */
function topla(degerler: (number | null)[]): number | null {
  const gecerli = degerler.filter((d): d is number => d !== null);
  return gecerli.length ? gecerli.reduce((a, b) => a + b, 0) : null;
}

export function grupToplami(satirlar: SubeSatiri[]): GrupToplami {
  const siyah = topla(satirlar.map((s) => s.siyah));
  const renkli = topla(satirlar.map((s) => s.renkli));
  const toplamSayfa = siyah === null && renkli === null ? null : (siyah ?? 0) + (renkli ?? 0);

  const cihaz = satirlar.reduce((a, s) => a + s.cihaz, 0);
  const okunanCihaz = satirlar.reduce((a, s) => a + s.okunanCihaz, 0);

  return {
    sube: satirlar.length,
    cihaz,
    okunanCihaz,
    okunmayanCihaz: Math.max(0, cihaz - okunanCihaz),
    siyah,
    renkli,
    toplamSayfa,
    renkliPayi: toplamSayfa && toplamSayfa > 0 ? ((renkli ?? 0) / toplamSayfa) * 100 : null,
    ariza: satirlar.reduce((a, s) => a + s.ariza, 0),
    planli: satirlar.reduce((a, s) => a + s.planli, 0),
    slaMudahaleYuzde: agirlikliOrtalama(satirlar.map((s) => ({ deger: s.slaMudahaleYuzde, agirlik: s.slaOlculen }))),
    slaCozumYuzde: agirlikliOrtalama(satirlar.map((s) => ({ deger: s.slaCozumYuzde, agirlik: s.slaOlculen }))),
    slaOlculen: satirlar.reduce((a, s) => a + (s.slaMudahaleYuzde === null && s.slaCozumYuzde === null ? 0 : s.slaOlculen), 0),
    slaSozluSube: satirlar.filter((s) => s.slaMudahaleYuzde !== null || s.slaCozumYuzde !== null).length,
    donemFaturasi: satirlar.reduce((a, s) => a + s.donemFaturasi, 0),
    bakiye: satirlar.reduce((a, s) => a + s.bakiye, 0),
    bakiyeliSube: satirlar.filter((s) => s.bakiye > 0.005).length,
  };
}

/**
 * Şube sıralaması: en çok basan üstte.
 *
 * Bu ekran bir KONSOLİDASYON raporu; okuyan kişi önce hesabın ağırlığını
 * görmek ister. Sorun sütunları (arıza, SLA, bakiye) zaten kendi rengiyle
 * öne çıkıyor. Sayfası bilinmeyen şubeler en alta düşer ama listeden
 * çıkmaz.
 */
export function subeSirala(satirlar: SubeSatiri[]): SubeSatiri[] {
  return [...satirlar].sort((a, b) => {
    const sa = a.siyah === null && a.renkli === null ? -1 : (a.siyah ?? 0) + (a.renkli ?? 0);
    const sb = b.siyah === null && b.renkli === null ? -1 : (b.siyah ?? 0) + (b.renkli ?? 0);
    if (sa !== sb) return sb - sa;
    return a.musteri.localeCompare(b.musteri, 'tr');
  });
}
