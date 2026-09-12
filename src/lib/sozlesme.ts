/**
 * SÖZLEŞME KURALLARI — sözleşmede yazanla sistemde olanı karşılaştırır.
 *
 * ── NEDEN BU DOSYA ───────────────────────────────────────────────────────
 * Sözleşmeyi dosya olarak saklamak bir dosya dolabıdır: bayi onu bir kez
 * yükler, bir daha açmaz, hiçbir şey değişmez. İşe yarayan şey sözleşmenin
 * ŞARTLARINI biliyor olmak ve gerçeği ona karşı ölçmek:
 *
 *   "Sözleşmede ayda ₺1.500 + 1.000 sayfa dahil yazıyor. Sistemde bu cihaz
 *    ₺1.200 + 500 sayfa dahil kayıtlı. Ayda ₺300 eksik faturalıyorsun."
 *
 * ── HER İKİ YÖN DE SÖYLENİR ──────────────────────────────────────────────
 * Yalnız "az faturalıyorsun" demek kolaycılık olurdu. Fazla faturalama da
 * bildiriliyor: müşteri bir gün fark ederse bayi parayı geri verir ve
 * güveni kaybeder. Hangisinin hangisi olduğu açıkça yazıyor.
 *
 * ── ₺ KARŞILIĞI UYDURULMUYOR ─────────────────────────────────────────────
 * Kira farkının aylık karşılığı doğrudan bellidir. Sayfa/dahil-paket
 * farkının parası ise cihazın GERÇEK aylık hacmine bağlı; hacim
 * bilinmiyorsa tutar yazılmıyor, fark yine de gösteriliyor. Tahmin edilmiş
 * bir rakam, rakam olmamasından kötüdür.
 */

export type SozlesmeSartlari = {
  monthlyRent?: number | null;
  includedBlack?: number | null;
  includedColor?: number | null;
  pricePerBlack?: number | null;
  pricePerColor?: number | null;
  overagePriceBlack?: number | null;
  overagePriceColor?: number | null;
};

/** Cihazın SİSTEMDEKİ efektif şartları (bayi varsayılanları çözülmüş hâlde). */
export type CihazSartlari = SozlesmeSartlari;

export type FarkYonu = 'EKSIK_FATURALAMA' | 'FAZLA_FATURALAMA';

export type Fark = {
  alan: keyof SozlesmeSartlari;
  ad: string;
  sozlesmede: number;
  sistemde: number;
  yon: FarkYonu;
  /** Aylık ₺ etkisi — hesaplanamıyorsa null (tahmin YAZILMAZ). */
  aylikEtki: number | null;
  aciklama: string;
};

const ALAN_ADI: Record<keyof SozlesmeSartlari, string> = {
  monthlyRent: 'Aylık kira',
  includedBlack: 'Dahil sayfa (S/B)',
  includedColor: 'Dahil sayfa (Renkli)',
  pricePerBlack: 'Sayfa fiyatı (S/B)',
  pricePerColor: 'Sayfa fiyatı (Renkli)',
  overagePriceBlack: 'Aşım fiyatı (S/B)',
  overagePriceColor: 'Aşım fiyatı (Renkli)',
};

const yuvarla = (n: number) => Math.round(n * 100) / 100;
const sayi = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

/** Kuruş altı farklar gürültüdür; fiyat alanları 4 haneye kadar anlamlı. */
function farkliMi(a: number, b: number, hassas: boolean): boolean {
  return Math.abs(a - b) > (hassas ? 0.00005 : 0.005);
}

/**
 * Sözleşme ile cihazın mevcut ayarları arasındaki farklar.
 *
 * `aylikSayfaSB` / `aylikSayfaRenkli`: cihazın gerçek aylık hacmi (okuma
 * geçmişinden). Verilmezse sayfa bazlı farkların ₺ karşılığı yazılmaz.
 */
export function sartFarklari(
  sozlesme: SozlesmeSartlari,
  cihaz: CihazSartlari,
  aylikSayfaSB?: number | null,
  aylikSayfaRenkli?: number | null,
): Fark[] {
  const farklar: Fark[] = [];

  const ekle = (
    alan: keyof SozlesmeSartlari,
    yon: FarkYonu,
    s: number,
    c: number,
    aylikEtki: number | null,
    aciklama: string,
  ) => farklar.push({ alan, ad: ALAN_ADI[alan], sozlesmede: s, sistemde: c, yon, aylikEtki, aciklama });

  // ── KİRA ──────────────────────────────────────────────────────────────
  // Tek doğrudan hesaplanabilen kalem: farkın kendisi aylık etkidir.
  {
    const s = sayi(sozlesme.monthlyRent), c = sayi(cihaz.monthlyRent);
    if (s !== null && c !== null && farkliMi(s, c, false)) {
      const d = yuvarla(s - c);
      ekle('monthlyRent', d > 0 ? 'EKSIK_FATURALAMA' : 'FAZLA_FATURALAMA', s, c, Math.abs(d),
        d > 0
          ? `Sözleşmede ₺${s} yazıyor, sistemde ₺${c} kayıtlı — ayda ₺${Math.abs(d)} eksik faturalıyorsun.`
          : `Sözleşmede ₺${s} yazıyor, sistemde ₺${c} kayıtlı — ayda ₺${Math.abs(d)} fazla faturalıyorsun.`);
    }
  }

  // ── SAYFA VE AŞIM FİYATLARI ───────────────────────────────────────────
  // ₺ etkisi ancak AŞAN sayfa adedi bilinirse hesaplanabilir; dahil paketin
  // içindeki sayfalar zaten ücretsiz.
  const fiyatAlanlari: {
    alan: keyof SozlesmeSartlari; hacim?: number | null; dahilS?: number | null; renkli: boolean;
  }[] = [
    { alan: 'pricePerBlack', hacim: aylikSayfaSB, dahilS: sayi(cihaz.includedBlack) ?? 0, renkli: false },
    { alan: 'pricePerColor', hacim: aylikSayfaRenkli, dahilS: sayi(cihaz.includedColor) ?? 0, renkli: true },
    { alan: 'overagePriceBlack', hacim: aylikSayfaSB, dahilS: sayi(cihaz.includedBlack) ?? 0, renkli: false },
    { alan: 'overagePriceColor', hacim: aylikSayfaRenkli, dahilS: sayi(cihaz.includedColor) ?? 0, renkli: true },
  ];
  for (const { alan, hacim, dahilS } of fiyatAlanlari) {
    const s = sayi(sozlesme[alan]), c = sayi(cihaz[alan]);
    if (s === null || c === null || !farkliMi(s, c, true)) continue;
    const d = s - c;
    const asan = hacim !== null && hacim !== undefined ? Math.max(0, hacim - (dahilS ?? 0)) : null;
    const etki = asan === null ? null : yuvarla(Math.abs(d) * asan);
    ekle(alan, d > 0 ? 'EKSIK_FATURALAMA' : 'FAZLA_FATURALAMA', s, c, etki,
      etki === null
        ? `Sözleşmede ₺${s}, sistemde ₺${c}. Aylık etkisi için cihazın sayfa geçmişi yeterli değil.`
        : `Sözleşmede ₺${s}, sistemde ₺${c}. Ayda ~${asan} aşan sayfada ₺${etki} ${d > 0 ? 'eksik' : 'fazla'}.`);
  }

  // ── DAHİL PAKET ───────────────────────────────────────────────────────
  // Dahil paket BÜYÜDÜKÇE müşteri daha az öder. Sözleşmede yazan paket
  // sistemdekinden büyükse müşteriden fazla alıyoruz (hak ettiğinden az
  // ücretsiz sayfa veriyoruz) — yönü bu yüzden ters.
  const dahilAlanlari: { alan: keyof SozlesmeSartlari; hacim?: number | null; fiyatAlani: keyof SozlesmeSartlari }[] = [
    { alan: 'includedBlack', hacim: aylikSayfaSB, fiyatAlani: 'overagePriceBlack' },
    { alan: 'includedColor', hacim: aylikSayfaRenkli, fiyatAlani: 'overagePriceColor' },
  ];
  for (const { alan, hacim, fiyatAlani } of dahilAlanlari) {
    const s = sayi(sozlesme[alan]), c = sayi(cihaz[alan]);
    if (s === null || c === null || s === c) continue;
    const birim = sayi(cihaz[fiyatAlani])
      ?? sayi(cihaz[fiyatAlani === 'overagePriceBlack' ? 'pricePerBlack' : 'pricePerColor']);
    let etki: number | null = null;
    if (hacim !== null && hacim !== undefined && birim !== null) {
      // Fark yalnız GERÇEKTEN faturalanan sayfalarda para eder: hacim iki
      // paketin de altındaysa zaten hiç aşım yok, etki sıfır.
      const asanS = Math.max(0, hacim - s);
      const asanC = Math.max(0, hacim - c);
      etki = yuvarla(Math.abs(asanS - asanC) * birim);
    }
    ekle(alan, s > c ? 'FAZLA_FATURALAMA' : 'EKSIK_FATURALAMA', s, c, etki,
      etki === null
        ? `Sözleşmede ${s} sayfa dahil, sistemde ${c}. Aylık etkisi için cihazın sayfa geçmişi yeterli değil.`
        : s > c
          ? `Sözleşmede ${s} sayfa dahil ama sistemde ${c} — ayda ₺${etki} FAZLA faturalıyorsun.`
          : `Sözleşmede ${s} sayfa dahil ama sistemde ${c} — ayda ₺${etki} eksik faturalıyorsun.`);
  }

  return farklar;
}

/** Bir fark listesinin aylık net etkisi (eksik − fazla). */
export function aylikNetEtki(farklar: Fark[]): { eksik: number; fazla: number; net: number } {
  let eksik = 0, fazla = 0;
  for (const f of farklar) {
    if (f.aylikEtki === null) continue;
    if (f.yon === 'EKSIK_FATURALAMA') eksik += f.aylikEtki;
    else fazla += f.aylikEtki;
  }
  return { eksik: yuvarla(eksik), fazla: yuvarla(fazla), net: yuvarla(eksik - fazla) };
}

// ── TARİHLER ─────────────────────────────────────────────────────────────

const GUN = 86400000;

/** İki tarih arasındaki TAM gün farkı (saat/dakika gürültüsü olmadan). */
export function gunFarki(a: Date, b: Date): number {
  const g = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((g(b) - g(a)) / GUN);
}

export type SozlesmeTakvimi = {
  bitimeGun: number;
  bitmis: boolean;
  /** Fesih ihbarı için son gün (bitiş − ihbar süresi). İhbar süresi yoksa null. */
  ihbarSonGun: Date | null;
  ihbaraGun: number | null;
  /** İhbar penceresi KAÇTI: artık haber verilemez, sözleşme kendiliğinden uzar. */
  ihbarKacti: boolean;
};

/**
 * Sözleşmenin takvim durumu.
 *
 * İhbar penceresi bitiş tarihinden ayrı bir şey ve asıl para burada: bayi
 * "daha 2 ay var" diye rahatken ihbar süresi çoktan geçmiş olabiliyor ve
 * sözleşme eski fiyattan bir yıl daha uzuyor.
 */
export function sozlesmeTakvimi(
  sozlesme: { endDate: Date; noticeDays?: number | null; autoRenew?: boolean | null },
  bugun: Date = new Date(),
): SozlesmeTakvimi {
  const bitimeGun = gunFarki(bugun, sozlesme.endDate);
  const ihbarGun = sayi(sozlesme.noticeDays) ?? 0;
  let ihbarSonGun: Date | null = null;
  let ihbaraGun: number | null = null;
  if (ihbarGun > 0) {
    ihbarSonGun = new Date(sozlesme.endDate.getTime() - ihbarGun * GUN);
    ihbaraGun = gunFarki(bugun, ihbarSonGun);
  }
  return {
    bitimeGun,
    bitmis: bitimeGun < 0,
    ihbarSonGun,
    ihbaraGun,
    // Pencere yalnız sözleşme HÂLÂ sürerken kaçırılmış sayılır; bitmiş bir
    // sözleşmede "ihbar kaçtı" demek bayiye yanlış iş çıkarır.
    ihbarKacti: ihbaraGun !== null && ihbaraGun < 0 && bitimeGun >= 0,
  };
}

export type ZamDurumu = {
  /** Sözleşmede zam maddesi var mı? */
  maddeVar: boolean;
  sonrakiTarih: Date | null;
  kalanGun: number | null;
  /** Zam zamanı geldi (ya da geçti). */
  zamani: boolean;
  gecikenAy: number;
  /** Oran biliniyorsa aylık kaybedilen tutar. Bilinmiyorsa null. */
  aylikKayip: number | null;
};

/**
 * Zam maddesi ne durumda?
 *
 * Enflasyonlu ortamda zammı unutmak sessiz gelir kaybı: sözleşmede "12 ayda
 * bir artış" yazıyor, bayi 14 aydır zam yapmamış, aradaki fark her ay
 * yanıyor. Oran sözleşmede yazmıyorsa (pazarlıkla belirlenecekse) tutar
 * hesaplanmıyor — uydurmuyoruz, yalnız "zamanı geldi" diyoruz.
 */
export function zamDurumu(
  sozlesme: {
    startDate: Date;
    escalationMonths?: number | null;
    escalationRate?: number | null;
    lastEscalationAt?: Date | null;
  },
  aylikKira: number | null,
  bugun: Date = new Date(),
): ZamDurumu {
  const ay = sayi(sozlesme.escalationMonths);
  if (!ay || ay <= 0) {
    return { maddeVar: false, sonrakiTarih: null, kalanGun: null, zamani: false, gecikenAy: 0, aylikKayip: null };
  }
  // Hiç zam yapılmadıysa sayaç sözleşme başlangıcından işler.
  const baslangic = sozlesme.lastEscalationAt ?? sozlesme.startDate;
  const sonraki = new Date(baslangic);
  sonraki.setMonth(sonraki.getMonth() + ay);

  const kalanGun = gunFarki(bugun, sonraki);
  const zamani = kalanGun <= 0;
  const gecikenAy = zamani
    ? Math.max(0, (bugun.getFullYear() - sonraki.getFullYear()) * 12 + (bugun.getMonth() - sonraki.getMonth()))
    : 0;

  const oran = sayi(sozlesme.escalationRate);
  const aylikKayip = zamani && oran !== null && aylikKira !== null
    ? yuvarla((aylikKira * oran) / 100)
    : null;

  return { maddeVar: true, sonrakiTarih: sonraki, kalanGun, zamani, gecikenAy, aylikKayip };
}
