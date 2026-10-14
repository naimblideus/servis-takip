import { prisma } from '@/lib/prisma';

/**
 * Bayi bazında sıradaki fiş numarası.
 *
 * Rota dosyasından buraya taşındı: portaldan gelen arıza bildirimi onaylanınca
 * da fiş açılıyor ve numaralandırmanın TEK bir yerde olması şart — iki ayrı
 * uygulama er ya da geç aynı numarayı iki fişe verir.
 *
 * TSK- (eski) ve SF- (yeni) ön ekleri birlikte taranır: numara sırası
 * bayinin geçmişiyle sürekli kalsın.
 *
 * ── AYNI ANDA AÇILAN FİŞLER ──────────────────────────────────────────────
 * Eskiden "en büyük + 1" kilitsiz hesaplanıyordu: aynı bayide aynı anda
 * açılan 8 fişin hepsi aynı numarayı alıyor, 6'sı benzersizlik kuralına
 * takılıp 500 dönüyordu (ham Prisma mesajı kullanıcıya uyarı olarak çıktı).
 * İki katman var:
 *   1. Bu süreçte verilen numara kısa süre AKILDA tutulur: aynı anda gelen
 *      istekler birbirinin numarasını almaz (canlıda tek Node süreci).
 *   2. Başka bir süreç aynı numarayı yine de alırsa fisNumarasiylaOlustur()
 *      yeni numarayla tekrar dener.
 *
 * Ayrıca her fiş açılışında bayinin BÜTÜN fişleri belleğe çekiliyordu
 * (10.000 fişlik bayide her "Fiş Aç" 10.000 satır). Artık en büyük numarayı
 * veritabanı hesaplıyor, tek satır dönüyor.
 */

/** Verilen son numara, bayi başına. Next rotaları ayrı paketleyebildiği için globalThis'te. */
type Ayrilan = { no: number; zaman: number };
const AYRILAN: Map<string, Ayrilan> =
  ((globalThis as { __fisNumarasiAyrilan?: Map<string, Ayrilan> }).__fisNumarasiAyrilan ??= new Map());

/**
 * Ayrılan numara yalnız bu süre boyunca hesaba katılır. Fişin yazılması
 * milisaniyeler sürer; sonrasında veritabanındaki en büyük numara onu zaten
 * içerir. Süre, fişler silindikten sonra eski yüksek bir numaranın akılda
 * kalıp sırayı sebepsiz ileri atmasını önler.
 */
const AYIRMA_SURESI_MS = 30_000;

/** Bayinin şu ana kadarki en büyük SF-/TSK- numarası (yoksa 0). */
async function enBuyukNumara(tenantId: string): Promise<number> {
  // $queryRaw şablonunda ters bölü düşer ('\d' → 'd'): rakam için [0-9] yazılır.
  // {1,18}: BIGINT'e her zaman sığsın — absürt uzun bir numara sorguyu düşürmesin.
  const satir = await prisma.$queryRaw<{ enbuyuk: bigint | number | null }[]>`
    SELECT MAX(CAST(substring("ticketNumber" from '[0-9]+$') AS BIGINT)) AS enbuyuk
    FROM "ServiceTicket"
    WHERE "tenantId" = ${tenantId}
      AND "ticketNumber" ~ '^(TSK|SF)-[0-9]{1,18}$'`;
  const n = Number(satir[0]?.enbuyuk ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const vt = await enBuyukNumara(tenantId);
  // await'ten SONRA araya başka iş girmeden oku-yaz: eşzamanlı çağrılar ardışık numara alır.
  const simdi = Date.now();
  const onceki = AYRILAN.get(tenantId);
  const akilda = onceki && simdi - onceki.zaman < AYIRMA_SURESI_MS ? onceki.no : 0;
  const no = Math.max(vt, akilda) + 1;
  AYRILAN.set(tenantId, { no, zaman: simdi });
  return `SF-${no}`;
}

/** Fiş yazılamadıysa numarayı geri bırak: ardından kimse numara almadıysa sırada boşluk kalmaz. */
function numarayiBirak(tenantId: string, numara: string) {
  const no = Number(numara.slice(3));
  const onceki = AYRILAN.get(tenantId);
  if (onceki && onceki.no === no) AYRILAN.set(tenantId, { no: no - 1, zaman: onceki.zaman });
}

/** Hata, (tenantId, ticketNumber) benzersizlik kuralına takılan bir fiş numarası mı? */
export function fisNumarasiCakismasi(e: unknown): boolean {
  // instanceof yerine kod: Prisma istemcisinin iki kopyası yüklendiğinde de doğru çalışsın.
  const h = e as { code?: string; meta?: { target?: unknown } } | null;
  if (h?.code !== 'P2002') return false;
  const hedef = h.meta?.target;
  return Array.isArray(hedef) ? hedef.includes('ticketNumber') : String(hedef ?? '').includes('ticketNumber');
}

const DENEME = 6;

/**
 * Numara alıp fişi yazar; numara bu arada başkasına geçtiyse (P2002) yeni
 * numarayla tekrar dener. Fiş açan HER yer bunu kullanmalı:
 *
 *   const fis = await fisNumarasiylaOlustur(tenantId, (ticketNumber) =>
 *     prisma.serviceTicket.create({ data: { ...alanlar, ticketNumber } }));
 *
 * `olustur` her denemede YENİ numarayla çağrılır. Numara çakışması dışındaki
 * hatalar olduğu gibi fırlatılır; DENEME kez çakışırsa son çakışma fırlatılır
 * (çağıran fisNumarasiCakismasi ile tanıyıp 409 döner).
 */
export async function fisNumarasiylaOlustur<T>(
  tenantId: string,
  olustur: (ticketNumber: string) => Promise<T>,
): Promise<T> {
  for (let deneme = 1; ; deneme++) {
    const numara = await generateTicketNumber(tenantId);
    try {
      return await olustur(numara);
    } catch (e) {
      if (!fisNumarasiCakismasi(e)) {
        numarayiBirak(tenantId, numara);
        throw e;
      }
      if (deneme >= DENEME) throw e;
      // Küçük rastgele bekleme: yarışan istekler aynı anda yine çarpışmasın.
      await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 20 * deneme)));
    }
  }
}
