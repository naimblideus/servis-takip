/**
 * MEMNUNİYET — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/memnuniyet.ts'te; burası anketi açar, cevabı yazar ve
 * yönetici panosunun verisini toplar.
 *
 * ── BAĞLANTI ANAHTARI ────────────────────────────────────────────────────
 * Müşteri anketi girişsiz açar: /anket/<fiş>?t=<docToken('anket', fiş)>.
 * Anahtar imzalı ve durumsuz (lib/doc-token.ts) — veritabanında saklanmaz,
 * tahmin edilemez, başka bir fişe taşınamaz. Bayi kimliği adreste YOK: fiş
 * zaten tek bir bayiye ait, bayi fişten okunur. Böylece "yanlış bayiye cevap"
 * diye bir yol hiç açılmaz.
 *
 * ── FİŞ BAŞINA TEK ANKET, TEK CEVAP ──────────────────────────────────────
 * ticketId @unique. İkinci cevap ilkini EZMEZ: yazım `puan: null` şartıyla
 * yapılır (updateMany), aynı anda gelen iki cevaptan yalnız biri tutar.
 * İkinciye hata değil "zaten cevaplandı" durumu döner — müşteri ikinci kez
 * bastı diye ona hata göstermek, iyi niyetini cezalandırmaktır.
 */
import { prisma } from '@/lib/prisma';
import { docToken, verifyDocToken } from '@/lib/doc-token';
import {
  anketlenebilir, puanOku, yorumOku, donemKarsilastir, cevapOrani, teknisyeneGore,
  DONEM_GUN, type AnketKanali, type DonemKarsilastirma, type CevapOrani, type TavsiyeOzeti,
} from '@/lib/memnuniyet';

const ANAHTAR_TURU = 'anket';
const GUN_MS = 86_400_000;

/** Girişsiz anket sayfasının yolu. Mutlak adresi istemci kendi kökünden kurar. */
export function anketYolu(ticketId: string): string {
  return `/anket/${encodeURIComponent(ticketId)}?t=${docToken(ANAHTAR_TURU, ticketId)}`;
}

export function anketAnahtariGecerli(ticketId: string, anahtar: unknown): boolean {
  return verifyDocToken(ANAHTAR_TURU, ticketId, typeof anahtar === 'string' ? anahtar : null);
}

/** Aynı anda iki istek aynı satırı açmaya çalıştı (ticketId @unique). */
function benzersizIhlali(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'P2002';
}

export interface AnketKaydi {
  id: string;
  puan: number | null;
  yorum: string | null;
  kanal: string | null;
  gonderildiAt: Date;
  cevaplandiAt: Date | null;
}

const KAYIT_ALANLARI = { id: true, puan: true, yorum: true, kanal: true, gonderildiAt: true, cevaplandiAt: true } as const;

export type GonderSonucu =
  | { durum: 'TAMAM'; anket: AnketKaydi }
  | { durum: 'FIS_YOK' }
  | { durum: 'DURUM_UYGUN_DEGIL' };

/**
 * Anket müşteriye gösterildi/gönderildi: satır puansız açılır, cevap oranı
 * bununla ölçülür. Tekrar çağrı yeni satır açmaz; cevaplanmamışsa son
 * kullanılan kanal yazılır (ilk QR okutulmadı, sonra WhatsApp'tan gitti).
 * `kanal` null = bağlantı kopyalandı, nereye yapıştırıldığı bilinmiyor.
 */
export async function anketGonder(
  tenantId: string,
  ticketId: string,
  kanal: AnketKanali | null,
  simdi: Date = new Date(),
): Promise<GonderSonucu> {
  const fis = await prisma.serviceTicket.findFirst({
    where: { id: ticketId, tenantId, deletedAt: null },
    select: { id: true, customerId: true, deviceId: true, assignedUserId: true, status: true },
  });
  if (!fis) return { durum: 'FIS_YOK' };
  if (!anketlenebilir(fis.status)) return { durum: 'DURUM_UYGUN_DEGIL' };

  const mevcut = await prisma.memnuniyetAnketi.findUnique({ where: { ticketId }, select: { ...KAYIT_ALANLARI, tenantId: true } });
  if (mevcut) {
    // Olamaz (fiş bu bayinin), ama olursa başka bayinin satırını göstermeyiz.
    if (mevcut.tenantId !== tenantId) return { durum: 'FIS_YOK' };
    const anket: AnketKaydi = {
      id: mevcut.id, puan: mevcut.puan, yorum: mevcut.yorum, kanal: mevcut.kanal,
      gonderildiAt: mevcut.gonderildiAt, cevaplandiAt: mevcut.cevaplandiAt,
    };
    if (anket.puan === null && kanal && anket.kanal !== kanal) {
      return {
        durum: 'TAMAM',
        anket: await prisma.memnuniyetAnketi.update({ where: { id: anket.id }, data: { kanal }, select: KAYIT_ALANLARI }),
      };
    }
    return { durum: 'TAMAM', anket };
  }

  try {
    const anket = await prisma.memnuniyetAnketi.create({
      data: {
        tenantId, ticketId, customerId: fis.customerId, deviceId: fis.deviceId,
        // İşi kim yaptıysa: anketin cevabı onun karnesine yazılır.
        teknisyenId: fis.assignedUserId, kanal, gonderildiAt: simdi,
      },
      select: KAYIT_ALANLARI,
    });
    return { durum: 'TAMAM', anket };
  } catch (e) {
    if (!benzersizIhlali(e)) throw e;
    const k = await prisma.memnuniyetAnketi.findUnique({ where: { ticketId }, select: KAYIT_ALANLARI });
    if (k) return { durum: 'TAMAM', anket: k };
    throw e;
  }
}

export interface AnketBayisi {
  ad: string;
  logo: string | null;
  telefon: string | null;
  dil: string | null;
}

export type SayfaSonucu =
  | { durum: 'GECERSIZ' }
  | { durum: 'ACIK' | 'KAPALI' | 'CEVAPLANDI'; bayi: AnketBayisi; cihaz: string };

/**
 * Girişsiz sayfanın ne göstereceği. CEVAPLANDI, KAPALI'dan önce gelir:
 * cevap verdikten sonra fiş yeniden açılsa bile müşteri "teşekkürler" görür.
 * Silinmiş (çöp kutusundaki) fiş GEÇERSİZ sayılır.
 */
export async function anketSayfasi(ticketId: string, anahtar: unknown): Promise<SayfaSonucu> {
  if (!anketAnahtariGecerli(ticketId, anahtar)) return { durum: 'GECERSIZ' };
  const fis = await prisma.serviceTicket.findUnique({
    where: { id: ticketId },
    select: {
      status: true, deletedAt: true,
      device: { select: { brand: true, model: true } },
      tenant: { select: { name: true, logo: true, phone: true, locale: true } },
    },
  });
  if (!fis || fis.deletedAt) return { durum: 'GECERSIZ' };
  const bayi: AnketBayisi = { ad: fis.tenant.name, logo: fis.tenant.logo, telefon: fis.tenant.phone, dil: fis.tenant.locale };
  const cihaz = [fis.device?.brand, fis.device?.model].filter(Boolean).join(' ');
  const anket = await prisma.memnuniyetAnketi.findUnique({ where: { ticketId }, select: { puan: true } });
  if (anket && anket.puan !== null) return { durum: 'CEVAPLANDI', bayi, cihaz };
  if (!anketlenebilir(fis.status)) return { durum: 'KAPALI', bayi, cihaz };
  return { durum: 'ACIK', bayi, cihaz };
}

export type CevapSonucu =
  | { durum: 'GECERSIZ' }
  | { durum: 'KAPALI' | 'PUAN_GECERSIZ' | 'YORUM_UZUN' | 'KAYDEDILDI' | 'ZATEN'; dil: string | null };

/**
 * Müşterinin cevabı. Sıra bilerek böyle:
 *   anahtar → fiş → zaten cevaplandı mı → fiş açık mı → puan → yorum → yaz.
 * "Zaten" doğrulamadan önce: ikinci kez gönderen müşteri, ilk cevabının
 * durduğunu görsün; bozuk ikinci istek ona hata göstermesin.
 */
export async function anketCevapla(girdi: {
  ticketId: string;
  anahtar: unknown;
  puan: unknown;
  yorum: unknown;
  simdi?: Date;
}): Promise<CevapSonucu> {
  const { ticketId } = girdi;
  const simdi = girdi.simdi ?? new Date();
  if (!anketAnahtariGecerli(ticketId, girdi.anahtar)) return { durum: 'GECERSIZ' };

  const fis = await prisma.serviceTicket.findUnique({
    where: { id: ticketId },
    select: {
      tenantId: true, customerId: true, deviceId: true, assignedUserId: true, status: true, deletedAt: true,
      tenant: { select: { locale: true } },
    },
  });
  if (!fis || fis.deletedAt) return { durum: 'GECERSIZ' };
  const dil = fis.tenant.locale ?? null;

  const mevcut = await prisma.memnuniyetAnketi.findUnique({
    where: { ticketId },
    select: { id: true, tenantId: true, puan: true, teknisyenId: true },
  });
  if (mevcut && mevcut.puan !== null) return { durum: 'ZATEN', dil };
  if (!anketlenebilir(fis.status)) return { durum: 'KAPALI', dil };

  const puan = puanOku(girdi.puan);
  if (puan === null) return { durum: 'PUAN_GECERSIZ', dil };
  const y = yorumOku(girdi.yorum);
  if (!y.ok) return { durum: 'YORUM_UZUN', dil };

  const cevap = { puan, yorum: y.yorum, cevaplandiAt: simdi };

  if (mevcut) {
    // Satır başka bayininse (olamaz) yazılmaz: şart tenantId'yi de içeriyor.
    const g = await prisma.memnuniyetAnketi.updateMany({
      where: { id: mevcut.id, tenantId: fis.tenantId, puan: null },
      // Anket iş atanmadan açıldıysa cevap anında işi yapan yazılır.
      data: { ...cevap, ...(mevcut.teknisyenId ? {} : { teknisyenId: fis.assignedUserId }) },
    });
    return { durum: g.count ? 'KAYDEDILDI' : 'ZATEN', dil };
  }

  // Satır yok: bağlantı "gönderildi" kaydı düşmeden ulaştı (ör. demoda
  // WhatsApp önizlemesinden kopyalandı). Cevap yine kaybolmaz.
  try {
    await prisma.memnuniyetAnketi.create({
      data: {
        tenantId: fis.tenantId, ticketId, customerId: fis.customerId, deviceId: fis.deviceId,
        teknisyenId: fis.assignedUserId, kanal: null, gonderildiAt: simdi, ...cevap,
      },
    });
    return { durum: 'KAYDEDILDI', dil };
  } catch (e) {
    if (!benzersizIhlali(e)) throw e;
    // Aynı anda iki istek: biri satırı açtı. Hâlâ cevapsızsa bizimki yazılır.
    const g = await prisma.memnuniyetAnketi.updateMany({
      where: { ticketId, tenantId: fis.tenantId, puan: null },
      data: cevap,
    });
    return { durum: g.count ? 'KAYDEDILDI' : 'ZATEN', dil };
  }
}

/** "Aradım": 0–6 veren müşteri arandı. Tekrar basmak saati değiştirmez. */
export async function aradimIsaretle(tenantId: string, anketId: string, simdi: Date = new Date()): Promise<'TAMAM' | 'YOK'> {
  const g = await prisma.memnuniyetAnketi.updateMany({
    where: { id: anketId, tenantId, puan: { lte: 6 }, arandiAt: null },
    data: { arandiAt: simdi },
  });
  if (g.count) return 'TAMAM';
  const var_ = await prisma.memnuniyetAnketi.findFirst({ where: { id: anketId, tenantId, puan: { lte: 6 } }, select: { id: true } });
  return var_ ? 'TAMAM' : 'YOK';
}

export interface PanoSatiri {
  id: string;
  ticketId: string;
  fisNo: string | null;
  puan: number;
  yorum: string | null;
  cevaplandiAt: string | null;
  musteri: string;
  telefon: string | null;
  teknisyen: string | null;
}

export interface PanoTeknisyeni {
  teknisyenId: string | null;
  ad: string | null;
  ozet: TavsiyeOzeti;
}

export interface MemnuniyetPanosu {
  /** Bayide bugüne kadar açılan anket. 0 ise ekran "nasıl başlanır"ı gösterir. */
  toplam: number;
  donem: DonemKarsilastirma;
  oran: CevapOrani;
  teknisyenler: PanoTeknisyeni[];
  aranacaklar: PanoSatiri[];
  yorumlar: PanoSatiri[];
  donemGun: number;
}

/**
 * Yönetici panosunun bütün verisi. Yalnız bu bayinin satırları: her sorgu
 * tenantId ile süzülür, ad/telefon birleştirmesi de tenantId ile yapılır.
 */
export async function memnuniyetPanosu(tenantId: string, simdi: Date = new Date()): Promise<MemnuniyetPanosu> {
  const bas = new Date(simdi.getTime() - 2 * DONEM_GUN * GUN_MS);
  const [pencere, toplam, aranacakHam, yorumHam] = await Promise.all([
    prisma.memnuniyetAnketi.findMany({
      where: { tenantId, OR: [{ gonderildiAt: { gte: bas } }, { cevaplandiAt: { gte: bas } }] },
      select: { puan: true, gonderildiAt: true, cevaplandiAt: true, teknisyenId: true },
      take: 50_000,
    }),
    prisma.memnuniyetAnketi.count({ where: { tenantId } }),
    // Süre sınırı yok: aranmamış memnun olmayan müşteri eskidi diye listeden düşmez.
    prisma.memnuniyetAnketi.findMany({
      where: { tenantId, puan: { lte: 6 }, arandiAt: null },
      orderBy: { cevaplandiAt: 'desc' },
      take: 50,
    }),
    prisma.memnuniyetAnketi.findMany({
      where: { tenantId, puan: { not: null }, yorum: { not: null } },
      orderBy: { cevaplandiAt: 'desc' },
      take: 10,
    }),
  ]);

  const teknisyenSirasi = teknisyeneGore(pencere, simdi);
  const satirlar = [...aranacakHam, ...yorumHam];
  const musteriIdleri = [...new Set(satirlar.map((s) => s.customerId))];
  const fisIdleri = [...new Set(satirlar.map((s) => s.ticketId))];
  const kisiIdleri = [...new Set([
    ...satirlar.map((s) => s.teknisyenId),
    ...teknisyenSirasi.map((t) => t.teknisyenId),
  ].filter((x): x is string => Boolean(x)))];

  const [musteriler, fisler, kisiler] = await Promise.all([
    musteriIdleri.length
      ? prisma.customer.findMany({ where: { tenantId, id: { in: musteriIdleri } }, select: { id: true, name: true, phone: true } })
      : Promise.resolve([]),
    fisIdleri.length
      ? prisma.serviceTicket.findMany({ where: { tenantId, id: { in: fisIdleri } }, select: { id: true, ticketNumber: true } })
      : Promise.resolve([]),
    kisiIdleri.length
      ? prisma.user.findMany({ where: { tenantId, id: { in: kisiIdleri } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const musteri = new Map(musteriler.map((m) => [m.id, m]));
  const fisNo = new Map(fisler.map((f) => [f.id, f.ticketNumber]));
  const kisi = new Map(kisiler.map((k) => [k.id, k.name]));

  const satir = (s: (typeof satirlar)[number]): PanoSatiri => ({
    id: s.id,
    ticketId: s.ticketId,
    fisNo: fisNo.get(s.ticketId) ?? null,
    puan: s.puan as number,
    yorum: s.yorum,
    cevaplandiAt: s.cevaplandiAt?.toISOString() ?? null,
    musteri: musteri.get(s.customerId)?.name ?? '—',
    telefon: musteri.get(s.customerId)?.phone ?? null,
    teknisyen: s.teknisyenId ? kisi.get(s.teknisyenId) ?? null : null,
  });

  return {
    toplam,
    donem: donemKarsilastir(pencere, simdi),
    oran: cevapOrani(pencere, simdi),
    teknisyenler: teknisyenSirasi.map((t) => ({ ...t, ad: t.teknisyenId ? kisi.get(t.teknisyenId) ?? null : null })),
    aranacaklar: aranacakHam.map(satir),
    yorumlar: yorumHam.map(satir),
    donemGun: DONEM_GUN,
  };
}
