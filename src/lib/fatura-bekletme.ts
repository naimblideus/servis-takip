/**
 * FATURA BEKLETME — "bu fatura kendiliğinden gitmesin, önce bayi baksın"
 *
 * Gece işi dönem faturasını insansız keser. Sayaç da artık çoğunlukla
 * insansız geliyor (cihaz e-postası, tarayıcı). Yanlış bir sayı zinciri
 * sonuna kadar yürürse müşteri faturayı görünce fark eder ve o an konuşulan
 * şey rakam değil güvendir. Bu yüzden iki durumda fatura KESİLMEZ, gerekçesiyle
 * taslakta bekler (FaturaTaslagi); bayi bakar, "yine de kes" ya da "at" der:
 *
 *   SUPHELI_OKUMA  Dönemin okumalarından biri makinenin kendi hızına göre
 *                  inanılmaz (lib/sayac-anomali; okuma yazılırken işaretlenir).
 *   FATURA_SOKU    Cihaz bu dönem son üç faturalı döneminin ortalamasının iki
 *                  katından fazla basmış VE o cihazın sayaç tutarı en az 400.
 *                  Okunmayan ay varsa ortalama o kadar ayla çarpılır: iki ayın
 *                  sayfası tek okumada gelince şok sayılmaz.
 *
 * Eşikler bilerek dar: yanlış alarm bayiyi her ay taslak onaylamaya iter ve
 * bir süre sonra bakmadan onaylar. Geçmişi iki dönemden kısa cihazda şok
 * aranmaz (ölçüt makinenin kendi geçmişi).
 *
 * Bayi "her faturayı kesmeden önce ben göreyim" diyebilir (Tenant.faturaOnayi
 * = ELLE): o zaman gerekçe olmasa da her fatura taslakta bekler.
 */
import type { Prisma } from '@prisma/client';

export const SOK_KATI = 2;
export const SOK_ASGARI_TUTAR = 400;
export const SOK_GECMIS_DONEM = 3;
export const SOK_ASGARI_GECMIS = 2;

export type Gerekce =
  | { kod: 'SUPHELI_OKUMA'; deviceId: string; cihaz: string; okumaSayisi: number }
  | { kod: 'FATURA_SOKU'; deviceId: string; cihaz: string; sayfa: number; ortalama: number; tutar: number };

/** Faturadaki bir cihazın bu dönemki özeti (lib/invoicing faturaHesapla doldurur). */
export interface CihazOzeti {
  deviceId: string;
  cihaz: string;
  /** Bu dönem faturalanacak sayfa (S/B + renkli) */
  sayfa: number;
  /** Bu cihazın sayaç satırları toplamı (KDV hariç) */
  tutar: number;
  /** Okunmayan ay çarpanı (S/B kanalı) */
  carpan: number;
  /** Dönemdeki şüpheli okuma sayısı */
  supheli: number;
}

/** Saf: bu cihaz fatura şoku mu? gecmis = son faturalı dönemlerin sayfası (yeniden eskiye). */
export function sokMu(c: Pick<CihazOzeti, 'sayfa' | 'tutar' | 'carpan'>, gecmis: number[]): { sok: boolean; ortalama: number } {
  const son = gecmis.slice(0, SOK_GECMIS_DONEM);
  if (son.length < SOK_ASGARI_GECMIS) return { sok: false, ortalama: 0 };
  const ortalama = Math.round(son.reduce((a, b) => a + b, 0) / son.length);
  if (!(ortalama > 0)) return { sok: false, ortalama };
  const sok = c.sayfa > SOK_KATI * ortalama * Math.max(1, c.carpan) && c.tutar >= SOK_ASGARI_TUTAR;
  return { sok, ortalama };
}

/** Saf: cihaz özetleri + geçmiş → gerekçeler. */
export function gerekceleriBul(cihazlar: CihazOzeti[], gecmis: Map<string, number[]>): Gerekce[] {
  const sonuc: Gerekce[] = [];
  for (const c of cihazlar) {
    if (c.supheli > 0) sonuc.push({ kod: 'SUPHELI_OKUMA', deviceId: c.deviceId, cihaz: c.cihaz, okumaSayisi: c.supheli });
    const s = sokMu(c, gecmis.get(c.deviceId) ?? []);
    if (s.sok) sonuc.push({ kod: 'FATURA_SOKU', deviceId: c.deviceId, cihaz: c.cihaz, sayfa: c.sayfa, ortalama: s.ortalama, tutar: c.tutar });
  }
  return sonuc;
}

/**
 * Cihazların bu dönemden ÖNCEKİ faturalı dönem sayfaları — tek sorgu.
 * Dönem kuralı lib/invoicing sayacAyCarpanlari ile aynı (damga, yoksa İstanbul ayı).
 */
export async function gecmisSayfalar(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  tenantId: string,
  deviceIds: string[],
  period: string,
): Promise<Map<string, number[]>> {
  const harita = new Map<string, number[]>();
  if (deviceIds.length === 0) return harita;
  const satirlar = await db.$queryRaw<{ deviceId: string; donem: string; sayfa: number }[]>`
    SELECT "deviceId", donem, SUM("deltaBlack" + "deltaColor")::int AS sayfa
    FROM (
      SELECT "deviceId", "deltaBlack", "deltaColor",
        COALESCE("faturaDonemi", to_char("readingDate" + interval '3 hours', 'YYYY-MM')) AS donem
      FROM "CounterReading"
      WHERE "tenantId" = ${tenantId} AND "deviceId" = ANY(${deviceIds}) AND "billed" = true
        AND "readingDate" > NOW() - interval '400 days'
    ) r
    WHERE donem < ${period}
    GROUP BY "deviceId", donem
    ORDER BY "deviceId", donem DESC
  `;
  for (const s of satirlar) {
    const l = harita.get(s.deviceId) ?? [];
    l.push(Number(s.sayfa));
    harita.set(s.deviceId, l);
  }
  return harita;
}

/** Faturanın bekletme gerekçeleri (boş = kendiliğinden kesilebilir). */
export async function bekletmeGerekceleri(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  tenantId: string,
  period: string,
  cihazlar: CihazOzeti[],
): Promise<Gerekce[]> {
  const sayacli = cihazlar.filter((c) => c.sayfa > 0 || c.supheli > 0);
  if (sayacli.length === 0) return [];
  const gecmis = await gecmisSayfalar(db, tenantId, sayacli.map((c) => c.deviceId), period);
  return gerekceleriBul(sayacli, gecmis);
}
