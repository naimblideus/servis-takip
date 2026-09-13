/**
 * KDV ÖZETİ — bayinin her ay başka bir program açma sebebi.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * "Bu ay ne kadar KDV ödeyeceğim?" sorusu ön muhasebe programının aylık
 * açılma sebebi. Gider kayıtlarımız yalnız TOPLAM tutar tutuyordu, KDV
 * ayrılmıyordu; bu yüzden soru bizde cevaplanamıyordu ve bayi rakamları
 * ikinci bir programa elle giriyordu.
 *
 * ── NE DEĞİL ─────────────────────────────────────────────────────────────
 * Bu bir BEYANNAME DEĞİL, özet. Muhasebeciye verilecek rakamı üretiyor;
 * tevkifat, istisna, devreden KDV mahsubu gibi kalemler burada yok ve
 * uydurulmuyor. Ekran neyin kapsam dışı kaldığını açıkça yazıyor.
 *
 * ── TAHAKKUK ESASI ───────────────────────────────────────────────────────
 * KDV, tahsilata değil FATURA TARİHİNE bağlı. Defterimiz nakit esaslı
 * (gelir tahsilatta yazılıyor) ama KDV özeti fatura tarihini kullanıyor.
 * İkisini karıştırmak, tahsil edilmemiş faturanın KDV'sini yok saymak
 * olurdu.
 */

const yuvarla = (n: number) => Math.round(n * 100) / 100;

export type KdvFaturasi = {
  invoiceNumber: string;
  invoiceDate: Date;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
};

export type KdvGideri = {
  description: string;
  date: Date;
  /** KDV DAHİL toplam — bayi fişteki rakamı yazıyor. */
  amount: number;
  vatRate: number | null;
  vatAmount: number | null;
};

/**
 * KDV dahil tutardan KDV'yi ayırır.
 *   1.180 ₺ ve %18 → 180 ₺
 *
 * Bayi fişteki TOPLAM rakamı yazıyor, ikinci bir hesap yapmıyor. Oranı da
 * yazmadıysa ayırma yapılmıyor: %20 varsayıp uydurmak, yanlış KDV
 * beyanına giden bir rakam üretmek demek.
 */
export function kdvAyir(dahilTutar: number, oran: number | null | undefined): number | null {
  if (oran === null || oran === undefined || !Number.isFinite(Number(oran))) return null;
  const o = Number(oran);
  if (o < 0 || o > 100) return null;
  if (o === 0) return 0;
  if (!Number.isFinite(dahilTutar)) return null;
  return yuvarla(dahilTutar - dahilTutar / (1 + o / 100));
}

export type KdvOzeti = {
  donem: string;
  satis: { matrah: number; kdv: number; toplam: number; adet: number };
  alis: { matrah: number; kdv: number; toplam: number; adet: number };
  /** Pozitif = ödenecek, negatif = devreden. */
  fark: number;
  odenecek: number;
  devreden: number;
  /** Oran oran ayrışma — beyanname satırlarına karşılık geliyor. */
  satisOranlari: { oran: number; matrah: number; kdv: number }[];
  /** KDV'si girilmemiş gider: özete GİRMİYOR, ama sayısı söyleniyor. */
  kdvsizGider: { adet: number; tutar: number };
};

/**
 * Dönemin KDV özeti.
 *
 * KDV'si girilmemiş giderler toplama GİRMİYOR ve bu sessizce yapılmıyor:
 * adedi ve tutarı ayrıca dönüyor. Sessizce dışarıda bırakmak, bayiye
 * olduğundan yüksek bir "ödenecek KDV" göstermek demekti.
 */
export function kdvOzeti(
  donem: string,
  faturalar: KdvFaturasi[],
  giderler: KdvGideri[],
): KdvOzeti {
  const oranlar = new Map<number, { matrah: number; kdv: number }>();
  let sMatrah = 0, sKdv = 0, sToplam = 0;
  for (const f of faturalar) {
    const matrah = Number(f.subtotal) || 0;
    const kdv = Number(f.vatAmount) || 0;
    sMatrah += matrah; sKdv += kdv; sToplam += Number(f.totalAmount) || 0;
    const o = Number(f.vatRate) || 0;
    const g = oranlar.get(o) ?? { matrah: 0, kdv: 0 };
    oranlar.set(o, { matrah: yuvarla(g.matrah + matrah), kdv: yuvarla(g.kdv + kdv) });
  }

  let aMatrah = 0, aKdv = 0, aToplam = 0, aAdet = 0;
  let ksAdet = 0, ksTutar = 0;
  for (const g of giderler) {
    const tutar = Number(g.amount) || 0;
    // Kayıtta KDV yazılıysa onu kullan; yalnız oran varsa dahil tutardan ayır.
    const kdv = g.vatAmount !== null && g.vatAmount !== undefined
      ? Number(g.vatAmount)
      : kdvAyir(tutar, g.vatRate);
    if (kdv === null) { ksAdet++; ksTutar = yuvarla(ksTutar + tutar); continue; }
    aKdv += kdv; aToplam += tutar; aMatrah += tutar - kdv; aAdet++;
  }

  const satisKdv = yuvarla(sKdv);
  const alisKdv = yuvarla(aKdv);
  const fark = yuvarla(satisKdv - alisKdv);

  return {
    donem,
    satis: { matrah: yuvarla(sMatrah), kdv: satisKdv, toplam: yuvarla(sToplam), adet: faturalar.length },
    alis: { matrah: yuvarla(aMatrah), kdv: alisKdv, toplam: yuvarla(aToplam), adet: aAdet },
    fark,
    odenecek: fark > 0 ? fark : 0,
    devreden: fark < 0 ? yuvarla(-fark) : 0,
    satisOranlari: [...oranlar.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([oran, v]) => ({ oran, matrah: v.matrah, kdv: v.kdv })),
    kdvsizGider: { adet: ksAdet, tutar: ksTutar },
  };
}
