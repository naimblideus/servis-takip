/**
 * NEXTUS MAĞAZA BAĞLANTISI.
 *
 * Mağaza ayrı bir uygulamada (nextus-magaza) çalışır ve kendi tablolarını
 * `shop` şemasında tutar. Buradan yalnız OKUNUR ve yalnız bir şey için:
 * bayinin mağazasının adresini bulmak.
 *
 * ── SINIR HANGİ YÖNDE ────────────────────────────────────────────────
 * Kural "mağaza servis-takip'e YAZMAZ" idi; okuma tersi yönde ve zararsız.
 * Yine de tek dosyada toplandı: yarın mağaza kaldırılsa, bu dosyayı silmek
 * yeterli olsun. Sorgu shop şeması yoksa da patlamaz (to_regclass kontrolü) —
 * mağaza modülü kurulu olmayan bayide servis sistemi çalışmaya devam etmeli.
 */
import { prisma } from '@/lib/prisma';

export interface MagazaBilgi {
  slug: string;
  domain: string | null;
  aktif: boolean;
  /** Vitrin kök adresi — https://magaza.bayi.com veya https://<slug>.<taban> */
  url: string;
}

function tabanUrl(slug: string, domain: string | null): string {
  if (domain) return `https://${domain}`;
  const taban = process.env.SHOP_BASE_DOMAIN;
  if (taban) return `https://${slug}.${taban}`;
  // Geliştirme yedeği; üretimde SHOP_BASE_DOMAIN tanımlı olmalı.
  return process.env.SHOP_URL ?? 'http://localhost:3060';
}

/**
 * ── İKİ AYRI KİMLİK VAR, KARIŞTIRMA ───────────────────────────────────
 * Mağaza kendi kiracı kimliğini üretiyor (`bgz_…`) ve servis bağını AYRI bir
 * alanda tutuyor: `ShopSettings.servisTenantId`.
 *
 * Buradaki sorgular servis kimliğini doğrudan `ShopSettings."tenantId"` ile
 * eşleştiriyordu. Kimlik ayrımından sonra bu HİÇBİR ŞEY döndürmüyor —
 * ölçüldü: servis kimliğiyle 0 ürün, doğru eşleşmeyle 519. Yani bayinin
 * kendi servis sistemi "mağazan yok" diyordu, mağaza canlıdayken.
 *
 * Belirti masum: sıfır. "Henüz kurmamışım" diye okunur ve kimse aramaz.
 *
 * Bu eşleme TEK YERDE duruyor; her sorgunun kendi JOIN'ini yazması aynı
 * hatanın yeniden doğmasının yolu.
 */
export async function magazaKiraciId(servisTenantId: string): Promise<string | null> {
  try {
    const r = await prisma.$queryRaw<{ tenantId: string }[]>`
      SELECT "tenantId" FROM shop."ShopSettings"
      WHERE "servisTenantId" = ${servisTenantId}
      LIMIT 1
    `;
    return r[0]?.tenantId ?? null;
  } catch {
    // shop şeması yok (mağaza hiç kurulmamış) — bu bir hata değil.
    return null;
  }
}

/** Bayinin mağazası var mı? Yoksa null (mağaza modülü kapalı ya da hiç kurulmamış). */
export async function bayiMagazasi(servisTenantId: string): Promise<MagazaBilgi | null> {
  try {
    const r = await prisma.$queryRaw<{ slug: string; domain: string | null; aktif: boolean }[]>`
      SELECT slug, domain, aktif
      FROM shop."ShopSettings"
      WHERE "servisTenantId" = ${servisTenantId}
      LIMIT 1
    `;
    if (!r[0]) return null;
    return { ...r[0], url: tabanUrl(r[0].slug, r[0].domain) };
  } catch {
    return null;
  }
}

/**
 * Müşteriye gönderilecek mağaza bağlantısı.
 *
 * Jeton müşteri panelinin jetonudur; mağaza da AYNI jetonu kabul eder
 * (nextus-magaza/src/lib/oturum.ts). Müşteri ikinci bir parola yönetmez,
 * tek bağlantıyla hem panelini hem mağazasını açar.
 *
 * Portal kapalıysa null döner: jetonsuz bir "cihazlarım" bağlantısı,
 * müşteriyi giriş ekranına düşüren kırık bir bağlantıdır.
 */
export function musteriMagazaLinki(
  magaza: MagazaBilgi | null,
  portalToken: string | null,
  portalEnabled: boolean
): string | null {
  if (!magaza || !magaza.aktif) return null;
  if (!portalToken || !portalEnabled) return null;
  return `${magaza.url}/giris?j=${portalToken}&devam=/cihazlarim`;
}

/**
 * Onay bekleyen mağaza siparişi sayısı.
 *
 * Mağaza kurulu değilse ya da shop şeması yoksa 0 — bu bir hata değil,
 * "mağazası yok" demek ve rozet görünmemeli.
 */
export async function magazaSiparisSayisi(servisTenantId: string): Promise<number> {
  try {
    const r = await prisma.$queryRaw<{ c: number }[]>`
      SELECT count(*)::int c
      FROM shop."ShopOrder" o
      JOIN shop."ShopSettings" s ON s."tenantId" = o."tenantId"
      WHERE s."servisTenantId" = ${servisTenantId}
        AND o.durum IN ('YENI', 'ONAY_KUYRUKTA')
    `;
    return r[0]?.c ?? 0;
  } catch {
    return 0;
  }
}
