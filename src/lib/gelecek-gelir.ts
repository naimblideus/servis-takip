/**
 * GELECEK GELİR — SAF HESAP.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Kiralama bayisinin değeri bugünkü kasası değil, önündeki aylarda
 * SÖZLEŞMEYLE bağlanmış gelirdir: kredi, ortaklık, devir görüşmesi bu
 * soruyla başlar. Rakiplerdeki "5 yıllık öngörülen gelir" grafiği her
 * cihazı sonsuza dek kirada sayıyor; üç ay sonra biten sözleşmeyle beş
 * yıllık sözleşmeyi aynı renge boyuyor. Bu hesap üç şeyi AYIRIR:
 *   · Sözleşmeli  — sözleşme bitişine kadar (kira kesin, sayfa tahmin),
 *   · Yenilenirse — bitişten sonrası, yalnız kendiliğinden yenilenen sözleşmede,
 *   · Sözleşmesiz — sözleşmeye bağlı olmayan cihazın bugünkü aylık geliri.
 *
 * ── HESAP ────────────────────────────────────────────────────────────────
 * Cihazın aylık geliri = kira + sayfa geliri. Sayfa geliri son 3 ayın
 * ortalama sayfasıyla ve FATURANIN KULLANDIĞI işlevle (invoicing.ts
 * counterOverage + fiyatTabani + sayfaUcretliMi) hesaplanır: dahil paket,
 * aşım fiyatı, bayi varsayılanı aynı kuraldan. İkinci bir fiyat hesabı
 * yazmak, bu ekranla faturanın aynı cihaz için farklı rakam söylemesi demekti.
 *
 * ── UYDURMADIKLARIMIZ ───────────────────────────────────────────────────
 * · Zam: yalnız sözleşmede ORAN ve ARALIK yazılıysa, gelecekteki zam
 *   tarihinden sonraki ilk tam aydan itibaren. Zamanı gelmiş ama yapılmamış
 *   zam eklenmez (bayinin işi, yapılacağını bilmiyoruz).
 * · Kur ve enflasyon yok; ekranda tek cümleyle yazar.
 * · Para birimleri toplanmaz: her birimin kendi toplamı var, dönüştürme yok.
 * · Sayfa geçmişi yetmeyen cihazın sayfa geliri tahmin EDİLMEZ: dışarıda
 *   kalır ve kaç cihaz olduğu yazılır.
 *
 * Veritabanına dokunmaz (veri katmanı gelecek-gelir-veri.ts). invoicing.ts'ten
 * yalnız saf fiyat işlevleri alınır.
 */
import { counterOverage, fiyatTabani, sayfaUcretliMi } from '@/lib/invoicing';
import { sozlesmeTakvimi } from '@/lib/sozlesme';

const GUN = 86_400_000;

/** Ekrandaki ufuk seçenekleri (ay). Hesap en uzununa göre bir kez yapılır. */
export const UFUKLAR = [12, 24, 60] as const;
export const EN_UZUN_UFUK = 60;
/** Riskteki gelir: bu kadar gün içinde biten (ya da süresi geçmiş) sözleşmeler. */
export const RISK_GUN = 180;
/** Ortalama ay uzunluğu (gün): 365,25 / 12. */
export const AY_GUN = 30.4375;
/** Sayfa ortalaması için bakılan geçmiş (ay). */
export const SAYFA_PENCERE_AY = 3;
/** Ortalama kurmak için okumalar arasında gereken en kısa süre (gün). */
export const EN_AZ_ARALIK_GUN = 25;

const yuvarla = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Yerel takvim günü (saat atılır) — sözleşme tarihleri yerel gece yarısı yazılıyor. */
const gunu = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// ─────────────────────────────────────────────────────────────────────────
// Aylık sayfa ve aylık gelir
// ─────────────────────────────────────────────────────────────────────────

export interface OkumaOzeti {
  /** Penceredeki okumaların fark toplamı (fark zaten sıfırlama/değişim korumalı). */
  siyah: number;
  renkli: number;
  /** Penceredeki ilk ve son okuma anı. */
  ilk: Date;
  son: Date;
  /** Pencereden ÖNCEKİ son okuma — ilk farkın başladığı an. Yoksa null. */
  onceki: Date | null;
}

/**
 * Son 3 ayın ortalama AYLIK sayfası.
 *
 * Farklar toplamı, ölçtüğü sürenin (önceki okumadan son okumaya) gün sayısına
 * bölünüp ortalama aya çevrilir. Okuma günleri her ay kayıyor ve bazı aylar
 * atlanıyor; "ay başına bir okuma" saymak bu yüzden yanlış olurdu. Pencerede
 * okuma yoksa ya da ölçülen süre bir aydan kısaysa null: tahmin edilmez.
 */
export function aylikSayfa(o: OkumaOzeti | null | undefined): { siyah: number; renkli: number } | null {
  if (!o) return null;
  const bas = o.onceki ?? o.ilk;
  const gun = (o.son.getTime() - bas.getTime()) / GUN;
  if (!(gun >= EN_AZ_ARALIK_GUN)) return null;
  const k = AY_GUN / gun;
  return {
    siyah: Math.round(Math.max(0, Number(o.siyah) || 0) * k),
    renkli: Math.round(Math.max(0, Number(o.renkli) || 0) * k),
  };
}

export interface CihazFiyati {
  isRental: boolean;
  monthlyRent: unknown;
  pricePerBlack: unknown;
  pricePerColor: unknown;
  includedBlack?: number | null;
  includedColor?: number | null;
  overagePriceBlack?: unknown;
  overagePriceColor?: unknown;
}

/**
 * Cihazın BUGÜNKÜ aylık geliri: kira + o hacimdeki sayfa ücreti.
 *
 * Sayfa ücreti faturanın tek dönemlik hesabıyla aynıdır (dahil paket ayda
 * bir kez). Kira, faturadaki gibi yalnız kiralık cihazda. Sayfa başı ücretli
 * olmayan cihazın sayfa geliri sıfırdır (bilinmiyor değil); sayfa ücretli
 * cihazda hacim bilinmiyorsa null.
 */
export function aylikGelir(
  cihaz: CihazFiyati,
  bayi: { pricePerBlack: unknown; pricePerColor: unknown },
  hacim: { siyah: number; renkli: number } | null,
): { kira: number; sayfa: number | null } {
  const kiraHam = Number(cihaz.monthlyRent);
  const kira = cihaz.isRental && kiraHam > 0 ? yuvarla(kiraHam) : 0;
  if (!sayfaUcretliMi(cihaz)) return { kira, sayfa: 0 };
  if (!hacim) return { kira, sayfa: null };
  return { kira, sayfa: counterOverage(cihaz, hacim.siyah, hacim.renkli, fiyatTabani(cihaz, bayi)).total };
}

// ─────────────────────────────────────────────────────────────────────────
// Aylara yayma
// ─────────────────────────────────────────────────────────────────────────

export interface ZamMaddesi {
  /** Yüzde (25 = %25). */
  oran: number;
  /** Kaç ayda bir. */
  ay: number;
  /** Son zam ya da (hiç yapılmadıysa) sözleşme başlangıcı. */
  taban: Date;
}

export interface SozlesmeBagi {
  id: string;
  bitis: Date;
  otomatikYenileme: boolean;
  zam: ZamMaddesi | null;
}

export interface GelirKalemi {
  cihazId: string;
  birim: string;
  kira: number;
  /** null = sayfa geçmişi yetersiz; hesaba katılmadı. */
  sayfa: number | null;
  /** Cihazın bağlı olduğu AKTİF sözleşme (yoksa null). */
  sozlesme: SozlesmeBagi | null;
}

export interface AyDilimi {
  /** 'YYYY-AA' (yerel takvim). */
  ay: string;
  sozlesmeli: number;
  /** Sözleşmeli'nin sayfa ücretinden gelen kısmı — tahmin olan kısım. */
  sozlesmeliSayfa: number;
  yenilenirse: number;
  sozlesmesiz: number;
}

export interface UfukOzeti {
  sozlesmeli: number;
  sozlesmeliKira: number;
  sozlesmeliSayfa: number;
  yenilenirse: number;
  sozlesmesizToplam: number;
}

export interface BirimTahmini {
  birim: string;
  aylar: AyDilimi[];
  /** Bugünkü aylık sözleşmesiz gelir (zamsız, sabit). */
  sozlesmesizAylik: number;
  /** Ufuk → özet (12/24/60). */
  ozet: Record<string, UfukOzeti>;
  cihaz: {
    toplam: number;
    sozlesmeli: number;
    /** Sözleşmesi bitmiş ama kendiliğinden yenilenen: geliri "Yenilenirse"de. */
    suresiGecmis: number;
    sozlesmesiz: number;
    sayfasiBilinmeyen: number;
  };
}

/** Tahmin ayları: ÖNÜMÜZDEKİ aydan başlar (içinde bulunulan ay yarım kalmış bir aydır). */
export function tahminAylari(simdi: Date, ufuk: number): { bas: Date; son: Date; anahtar: string }[] {
  const out: { bas: Date; son: Date; anahtar: string }[] = [];
  for (let i = 1; i <= ufuk; i++) {
    const bas = new Date(simdi.getFullYear(), simdi.getMonth() + i, 1);
    const son = new Date(simdi.getFullYear(), simdi.getMonth() + i + 1, 1);
    out.push({ bas, son, anahtar: `${bas.getFullYear()}-${String(bas.getMonth() + 1).padStart(2, '0')}` });
  }
  return out;
}

/**
 * Ayın ne kadarı sözleşme içinde (0–1). Bitiş günü DAHİL. Sözleşme ayın
 * ortasında bitiyorsa o ay gün oranıyla bölünür; yaz saati geçişindeki
 * 23/25 saatlik gün yuvarlamayla düzelir.
 */
export function kapsananOran(bitis: Date, ayBas: Date, aySon: Date): number {
  const gunSayisi = Math.round((aySon.getTime() - ayBas.getTime()) / GUN);
  const kapsanan = Math.round((gunu(bitis).getTime() - ayBas.getTime()) / GUN) + 1;
  return Math.min(1, Math.max(0, kapsanan / gunSayisi));
}

/**
 * Her tahmin ayının zam çarpanı.
 *
 * Zam tarihleri taban + k × aralık (k ≥ 1), sozlesme.ts zamDurumu ile aynı
 * takvim aritmetiği. Yalnız BUGÜNDEN SONRA gelen tarihler işlenir; zam,
 * tarihinden sonraki ilk TAM aydan (tarih ayın 1'iyse o aydan) itibaren
 * geçerlidir. Oran ya da aralık yoksa çarpan hep 1: zam uydurulmaz.
 */
export function zamCarpanlari(zam: ZamMaddesi | null, simdi: Date, aylar: readonly { bas: Date }[]): number[] {
  const carpan = aylar.map(() => 1);
  if (!zam || !(zam.oran > 0) || !(zam.ay >= 1) || !aylar.length) return carpan;
  const bugun = gunu(simdi).getTime();
  const sonAy = aylar[aylar.length - 1].bas.getTime();
  const f = 1 + zam.oran / 100;
  for (let k = 1; k < 2000; k++) {
    const t = new Date(zam.taban);
    t.setMonth(t.getMonth() + k * Math.round(zam.ay));
    const gun = gunu(t);
    if (gun.getTime() <= bugun) continue;
    const etkin = gun.getDate() === 1 ? gun : new Date(gun.getFullYear(), gun.getMonth() + 1, 1);
    if (etkin.getTime() > sonAy) break;
    for (let i = 0; i < aylar.length; i++) if (aylar[i].bas.getTime() >= etkin.getTime()) carpan[i] *= f;
  }
  return carpan;
}

/**
 * Önümüzdeki aylara yayılmış gelir, para birimi başına.
 *
 * Cihaz başına:
 *   · Sözleşme yok → Sözleşmesiz, her ay bugünkü tutar (zam yok).
 *   · Sözleşme bitmemiş → bitişe kadar Sözleşmeli (zamlı); bitişten sonra
 *     kendiliğinden yenileniyorsa Yenilenirse, yenilenmiyorsa SIFIR.
 *   · Sözleşme bitmiş ama kendiliğinden yenileniyor → her ay Yenilenirse
 *     (yenilendiği kayda geçmemiş; kesin sayılmaz).
 *   · Sözleşme bitmiş ve yenilenmiyor ama cihaz hâlâ kirada → Sözleşmesiz:
 *     fiilen aylık devam ediyor.
 */
export function gelecekGelir(
  kalemler: readonly GelirKalemi[],
  simdi: Date,
  ufuk: number = EN_UZUN_UFUK,
): BirimTahmini[] {
  const aylar = tahminAylari(simdi, ufuk);
  const bugun = gunu(simdi).getTime();
  const birimler = new Map<string, BirimTahmini>();

  for (const k of kalemler) {
    let b = birimler.get(k.birim);
    if (!b) {
      b = {
        birim: k.birim,
        aylar: aylar.map((a) => ({ ay: a.anahtar, sozlesmeli: 0, sozlesmeliSayfa: 0, yenilenirse: 0, sozlesmesiz: 0 })),
        sozlesmesizAylik: 0, ozet: {},
        cihaz: { toplam: 0, sozlesmeli: 0, suresiGecmis: 0, sozlesmesiz: 0, sayfasiBilinmeyen: 0 },
      };
      birimler.set(k.birim, b);
    }
    const sayfa = k.sayfa ?? 0;
    const taban = (Number(k.kira) || 0) + sayfa;
    b.cihaz.toplam++;
    if (k.sayfa === null) b.cihaz.sayfasiBilinmeyen++;

    const s = k.sozlesme;
    const bitmis = s !== null && gunu(s.bitis).getTime() < bugun;
    if (!s || (bitmis && !s.otomatikYenileme)) {
      b.cihaz.sozlesmesiz++;
      b.sozlesmesizAylik += taban;
      for (const a of b.aylar) a.sozlesmesiz += taban;
      continue;
    }
    if (bitmis) b.cihaz.suresiGecmis++; else b.cihaz.sozlesmeli++;
    const carpan = zamCarpanlari(s.zam, simdi, aylar);
    for (let i = 0; i < aylar.length; i++) {
      const oran = bitmis ? 0 : kapsananOran(s.bitis, aylar[i].bas, aylar[i].son);
      const gelir = taban * carpan[i];
      b.aylar[i].sozlesmeli += gelir * oran;
      b.aylar[i].sozlesmeliSayfa += sayfa * carpan[i] * oran;
      if (s.otomatikYenileme) b.aylar[i].yenilenirse += gelir * (1 - oran);
    }
  }

  const sonuc = [...birimler.values()].sort((a, b) => a.birim.localeCompare(b.birim));
  for (const b of sonuc) {
    for (const a of b.aylar) {
      a.sozlesmeli = yuvarla(a.sozlesmeli);
      a.sozlesmeliSayfa = yuvarla(a.sozlesmeliSayfa);
      a.yenilenirse = yuvarla(a.yenilenirse);
      a.sozlesmesiz = yuvarla(a.sozlesmesiz);
    }
    b.sozlesmesizAylik = yuvarla(b.sozlesmesizAylik);
    for (const u of UFUKLAR) if (u <= b.aylar.length) b.ozet[String(u)] = ufukOzeti(b.aylar, u);
  }
  return sonuc;
}

/** İlk `ufuk` ayın toplamları. */
export function ufukOzeti(aylar: readonly AyDilimi[], ufuk: number): UfukOzeti {
  const dilim = aylar.slice(0, ufuk);
  const top = (f: (a: AyDilimi) => number) => yuvarla(dilim.reduce((t, a) => t + f(a), 0));
  const sozlesmeli = top((a) => a.sozlesmeli);
  const sozlesmeliSayfa = top((a) => a.sozlesmeliSayfa);
  return {
    sozlesmeli, sozlesmeliSayfa, sozlesmeliKira: yuvarla(sozlesmeli - sozlesmeliSayfa),
    yenilenirse: top((a) => a.yenilenirse), sozlesmesizToplam: top((a) => a.sozlesmesiz),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Riskteki gelir
// ─────────────────────────────────────────────────────────────────────────

export interface RiskSozlesmesi {
  id: string;
  contractNo: string | null;
  musteriId: string;
  musteri: string;
  bitis: Date;
  noticeDays: number;
  otomatikYenileme: boolean;
  cihazIdleri: string[];
}

export interface RiskSatiri {
  id: string;
  contractNo: string | null;
  musteriId: string;
  musteri: string;
  birim: string;
  /** Sözleşmedeki cihazların bugünkü aylık geliri (zamsız). */
  aylik: number;
  cihaz: number;
  sayfasiBilinmeyen: number;
  bitis: string;
  bitimeGun: number;
  bitti: boolean;
  ihbarSonGun: string | null;
  ihbaraGun: number | null;
  ihbarKacti: boolean;
  otomatikYenileme: boolean;
}

/**
 * Süresi geçmiş ya da `gun` gün içinde bitecek aktif sözleşmeler.
 *
 * Sıra "harekete geçilecek son gün"e göre: ihbar süresi varsa ihbar son günü
 * (bitiş − ihbar; sozlesme.ts sozlesmeTakvimi ile aynı hesap), yoksa bitiş.
 * Yenileme görüşmesi ihbar penceresi kapanmadan yapılmalı; kapanınca
 * sözleşme eski fiyattan kendiliğinden uzar.
 */
export function risktekiGelir(
  sozlesmeler: readonly RiskSozlesmesi[],
  kalemler: readonly GelirKalemi[],
  simdi: Date,
  varsayilanBirim: string,
  gun = RISK_GUN,
): RiskSatiri[] {
  const kalem = new Map(kalemler.map((k) => [k.cihazId, k]));
  const out: (RiskSatiri & { sira: number })[] = [];
  for (const s of sozlesmeler) {
    const tk = sozlesmeTakvimi({ endDate: s.bitis, noticeDays: s.noticeDays, autoRenew: s.otomatikYenileme }, simdi);
    if (tk.bitimeGun > gun) continue;
    const gruplar = new Map<string, { aylik: number; cihaz: number; bilinmeyen: number }>();
    for (const id of s.cihazIdleri) {
      const k = kalem.get(id);
      if (!k) continue;
      const g = gruplar.get(k.birim) ?? { aylik: 0, cihaz: 0, bilinmeyen: 0 };
      g.aylik += (Number(k.kira) || 0) + (k.sayfa ?? 0);
      g.cihaz++;
      if (k.sayfa === null) g.bilinmeyen++;
      gruplar.set(k.birim, g);
    }
    if (!gruplar.size) gruplar.set(varsayilanBirim, { aylik: 0, cihaz: 0, bilinmeyen: 0 });
    const sira = (tk.ihbarSonGun ?? s.bitis).getTime();
    for (const [birim, g] of gruplar) {
      out.push({
        id: s.id, contractNo: s.contractNo, musteriId: s.musteriId, musteri: s.musteri,
        birim, aylik: yuvarla(g.aylik), cihaz: g.cihaz, sayfasiBilinmeyen: g.bilinmeyen,
        bitis: s.bitis.toISOString(), bitimeGun: tk.bitimeGun, bitti: tk.bitmis,
        ihbarSonGun: tk.ihbarSonGun ? tk.ihbarSonGun.toISOString() : null,
        ihbaraGun: tk.ihbaraGun, ihbarKacti: tk.ihbarKacti,
        otomatikYenileme: s.otomatikYenileme, sira,
      });
    }
  }
  out.sort((a, b) => a.sira - b.sira || b.aylik - a.aylik);
  return out.map(({ sira: _sira, ...r }) => r);
}

/** Riskteki aylık gelir, para birimi başına. */
export function riskToplami(satirlar: readonly RiskSatiri[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const s of satirlar) t[s.birim] = yuvarla((t[s.birim] ?? 0) + s.aylik);
  return t;
}
