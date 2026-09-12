/**
 * FATURA KİMLİĞİ — müşteri elektronik faturaya hazır mı?
 *
 * Bayinin defterindeki müşteri kaydıyla faturaya yazılan müşteri aynı şey
 * değil. Defterde "Ahmet Bey Fotokopi" yeter; faturada tescilli unvan,
 * vergi dairesi ve il/ilçe ayrı ayrı isteniyor. Bu dosya ikisi arasındaki
 * farkı TEK YERDE tutuyor: "bu müşteriye fatura kesilebilir mi, kesilemezse
 * tam olarak ne eksik".
 *
 * Neden ayrı bir dosya: aynı kontrol en az üç yerde lazım olacak — müşteri
 * formunda (kaydederken uyar), göç sonrasında (aktarılan müşterilerin kaçı
 * eksik) ve fatura kesilirken (eksikse kesme). Üç yere üç kopya yazmak,
 * kuralın üç farklı cevap vermesi demekti.
 *
 * Entegratörden bağımsız: hangi özel entegratör seçilirse seçilsin bu
 * alanlar isteniyor. Entegratöre özel hiçbir şey burada yok.
 */

export type FaturaMusterisi = {
  name: string;
  legalName?: string | null;
  taxNo?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  email?: string | null;
  eInvoiceUser?: boolean | null;
};

export type VergiKimligi = 'VKN' | 'TCKN' | null;

/**
 * Vergi numarasının türü HANE SAYISINDAN çıkıyor: 10 hane kurum (VKN),
 * 11 hane şahıs (TCKN). Ayrı bir "şahıs mı kurum mu" kutucuğu koymadık —
 * bayi onu yanlış işaretlediğinde numara ile kutucuk çelişir ve hangisinin
 * doğru olduğunu kimse bilemez. Numaranın kendisi zaten söylüyor.
 */
export function vergiKimlikTuru(taxNo?: string | null): VergiKimligi {
  const s = (taxNo ?? '').replace(/\D/g, '');
  if (s.length === 10) return 'VKN';
  if (s.length === 11) return 'TCKN';
  return null;
}

/** Faturaya yazılacak ad: tescilli unvan varsa o, yoksa defterdeki ad. */
export function faturaAdi(m: FaturaMusterisi): string {
  const u = (m.legalName ?? '').trim();
  return u || m.name;
}

/**
 * Faturanın hangi yoldan gideceği.
 *   e-Fatura  → alıcı da mükellef, fatura sistem üzerinden gidiyor
 *   e-Arşiv   → alıcı mükellef değil, fatura ona iletiliyor (e-posta)
 *   null      → HİÇ SORULMADI; hangi yol olduğu bilinmiyor
 *
 * null'ı "mükellef değil" saymıyoruz: sorulmamış bir müşteriye e-Arşiv
 * kesmek, mükellef çıkarsa yanlış belge kesmek demek.
 */
// Yalnız eInvoiceUser okunuyor; tam müşteri istemek, elinde sadece bu alan
// olan çağıranı sahte bir müşteri nesnesi uydurmaya zorluyordu.
export function faturaYolu(m: { eInvoiceUser?: boolean | null }): 'e-Fatura' | 'e-Arşiv' | null {
  if (m.eInvoiceUser === true) return 'e-Fatura';
  if (m.eInvoiceUser === false) return 'e-Arşiv';
  return null;
}

/**
 * Eksik olanlar — bayinin okuyup DOLDURABİLECEĞİ cümlelerle.
 * Sıra önemli: en çok tıkayan eksik başta.
 */
export function faturaEksikleri(m: FaturaMusterisi): string[] {
  const eksik: string[] = [];
  const tur = vergiKimlikTuru(m.taxNo);

  if (!tur) {
    eksik.push((m.taxNo ?? '').trim()
      ? 'Vergi/TC kimlik no 10 hane (kurum) ya da 11 hane (şahıs) olmalı'
      : 'Vergi no ya da TC kimlik no yok');
  }

  // Unvan yalnız KURUM için ayrıca isteniyor. Şahısta faturaya yazılan ad
  // zaten kişinin kendi adı — ikinci bir alan doldurtmak boşuna iş olurdu.
  if (tur === 'VKN') {
    if (!(m.legalName ?? '').trim()) eksik.push('Ticari unvan yok (faturada yazacak ad)');
    if (!(m.taxOffice ?? '').trim()) eksik.push('Vergi dairesi yok');
  }

  if (!(m.address ?? '').trim()) eksik.push('Adres yok');
  if (!(m.city ?? '').trim()) eksik.push('İl yok');
  if (!(m.district ?? '').trim()) eksik.push('İlçe yok');

  if (m.eInvoiceUser === null || m.eInvoiceUser === undefined) {
    eksik.push('e-Fatura mükellefi mi sorgulanmamış');
  } else if (m.eInvoiceUser === false && !(m.email ?? '').trim()) {
    // e-Arşiv müşteriye iletiliyor; iletilecek adres yoksa fatura kesilse
    // bile eline geçmiyor.
    eksik.push('e-Arşiv için e-posta adresi yok');
  }

  return eksik;
}

export function faturaHazir(m: FaturaMusterisi): boolean {
  return faturaEksikleri(m).length === 0;
}

// GİB belge numarası burada DEĞİL, lib/fatura-belgesi.ts'te
// (gibNumarasiUret): numara yıl dönümünde 1'den başlıyor ve bayinin son
// sırasını bilmek gerekiyor — o bilgi belge tarafında. Burada ikinci bir
// kopya durmasın diye kaldırıldı.

/** Bir müşteri listesinde kaçının eksiği var — panel/göç sonrası özet için. */
export function faturaHazirlikOzeti(musteriler: FaturaMusterisi[]) {
  let hazir = 0;
  const eksikSayaci = new Map<string, number>();
  for (const m of musteriler) {
    const e = faturaEksikleri(m);
    if (!e.length) { hazir++; continue; }
    for (const x of e) eksikSayaci.set(x, (eksikSayaci.get(x) ?? 0) + 1);
  }
  return {
    toplam: musteriler.length,
    hazir,
    eksik: musteriler.length - hazir,
    // En çok tekrar eden eksik başta: bayi tek bir işle en çok müşteriyi
    // hazır hâle getirebileceği yeri görsün.
    enSikEksikler: [...eksikSayaci.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([eksik, adet]) => ({ eksik, adet })),
  };
}
