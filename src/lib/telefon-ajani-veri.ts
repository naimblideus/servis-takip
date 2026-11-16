/**
 * TELEFON AJANI — VERİ KATMANI.
 *
 * Kurallar lib/telefon-ajani.ts'te (saf, testli); burası onları veritabanına
 * bağlar. Her fonksiyon `tenantId` alır ve her sorgu `{ id, tenantId }` ile
 * yapılır: bir bayinin kimliğiyle başka bir bayinin taslağına dokunulamaz.
 *
 * FİŞ YAZAN TEK YER `taslakOnayla` — bayinin "Fişe çevir" tıkı. Ajanın
 * araçları ve WhatsApp yolu yalnız TASLAK yazar (kaynak bekçisi testi:
 * scripts/test-telefon-ajani.mjs).
 *
 * SICAK YOL: araçlar arayan hatta beklerken çalışır. Orada ağır iş yok;
 * teknisyen önerisi bile bayi taslağı açınca hesaplanır.
 */
import { randomBytes } from 'crypto';
import { Prisma, type FaultCategory, type Priority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { writeAudit, type ActorType } from '@/lib/audit';
import { kaydetAsama } from '@/lib/ticket-asama';
import { fisNumarasiylaOlustur } from '@/lib/ticket-number';
import { faultCategoryFromLegacyText, parseFaultCategory } from '@/lib/fault-categories';
import { takvimKur } from '@/lib/sla-veri';
import { sendText, waOutConfigured, looksLikeFaultReport } from '@/lib/whatsapp-out';
import { numaraninBayileri, paylasimliWhatsappAcik } from '@/lib/whatsapp-inbound';
import { disariyaMesajKapali } from '@/lib/demo-koruma';
import { MIN_CONFIDENCE, type Suggestion } from '@/lib/whatsapp-suggest';
// Alan bilmeyen ortak kısım (kimlik, kiracı, gelen arama, Retell) — ses-cekirdek/.
import {
  e164TR, gelenAramaYaniti, hatNumarasiSade, kiraciEtkin as bayiEtkin, kiraciKarari, sinirlayici, son10,
  type AracCevabi,
} from '@/lib/ses-cekirdek/cagri';
import {
  ajanGovdesi, aracTabani, asistanAdiTemizle, kurulumKapisi, type KurulumKodu, type KurulumOrtami,
} from '@/lib/ses-cekirdek/retell-govde';
import { ajanGuncelle, ajanOlustur, hattiBagla, hattiCoz, type LlmIcerigi } from '@/lib/ses-cekirdek/retell-istemci';
import type { SesUyarlayici } from '@/lib/ses-cekirdek/uc';
// Servis'e özgü kurallar (fiş, cihaz, WhatsApp, teknisyen, komut metni).
import {
  CUMLE, FIS_SORGU_SINIRI, WA_PENCERE_MS,
  aktarmaAcilisi, aktarmaAraclari, aktarmaPromptu, acilisCumlesi, ajanPromptu,
  ayBasi, cihazBulCevabi, cihazEsle, cihazEsleMetin,
  devirCevabi, fisNoCikar, hataCevabi, hazirlikListesi,
  mesaideMi, notrCevap, sade, sayacTopla, servisAraclari, sesDurumCumlesi,
  taslakBirlestir, teknisyenSec, waDurumCumlesi, waKarari,
  type CihazAday, type CihazNeden,
  type OneriVerisi, type TaslakAlanlari, type TaslakSayaci, type TeknisyenOnerisi, type WaArizaKarari,
} from '@/lib/telefon-ajani';
import { ajanMetni, doldurMetin, numaraGoster } from '@/lib/telefon-ajani-metin';

const GUN_MS = 86_400_000;
const BAYI_SECIM = { isActive: true, isSuspended: true, deletedAt: true } as const;

export type AjanHataKodu =
  | 'BULUNAMADI'
  | 'TASLAK_ZATEN_ISLENDI'
  | 'CIHAZ_SECILMEDI'
  | 'CIHAZ_BULUNAMADI'
  | 'ATANAN_KISI_GECERSIZ'
  | 'BU_MESAJDAN_ZATEN_FIS_ACILMIS';

export class AjanHatasi extends Error {
  constructor(public kod: AjanHataKodu, public durum: number) {
    super(kod);
  }
}

const metin = (v: unknown, n: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;

const benzersizHatasi = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

// ─────────────────────────────────────────────────────────────────────────
// ORTAK
// ─────────────────────────────────────────────────────────────────────────

/** Ajan bu bayide çalışıyor mu: açık VE bayi etkin (kapalı/askıda/silinmiş değil). */
export async function ajanAcikMi(tenantId: string): Promise<boolean> {
  const a = await prisma.telefonAjani.findUnique({
    where: { tenantId },
    select: { acik: true, tenant: { select: BAYI_SECIM } },
  });
  return Boolean(a?.acik && bayiEtkin(a.tenant));
}

/**
 * Numaranın son 10 hanesiyle eşleşen BÜTÜN müşteriler (en eski önce).
 * Aynı numara iki müşteride farklı biçimde yazılmış olabilir; tek kayıt
 * dönen ve sırası belirsiz bir arama, kimliği rastgele seçmek olurdu.
 */
export async function numaraninMusterileri(tenantId: string, s10: string): Promise<{ id: string; name: string }[]> {
  if (!/^\d{10}$/.test(s10)) return [];
  return prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "Customer"
    WHERE "tenantId" = ${tenantId}
      AND right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) = ${s10}
    ORDER BY "createdAt" ASC
    LIMIT 20`;
}

async function musteriCihazlari(tenantId: string, musteriIdleri: string[]): Promise<CihazAday[]> {
  if (!musteriIdleri.length) return [];
  return prisma.device.findMany({
    where: { tenantId, customerId: { in: musteriIdleri } },
    select: { id: true, brand: true, model: true, serialNo: true },
    take: 300,
  });
}

/** Tanınmayan arayan: bayinin bütün cihazlarında YALNIZ tam seri (boşluk/tire/harf büyüklüğü yok sayılır). */
async function seriyleBayiCihazi(tenantId: string, seri: string): Promise<{ id: string } | null> {
  const s = sade(seri);
  if (s.length < 4) return null;
  const satir = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Device"
    WHERE "tenantId" = ${tenantId}
      AND regexp_replace(lower("serialNo"), '[^a-z0-9]', '', 'g') = ${s}
    LIMIT 2`;
  return satir.length === 1 ? satir[0] : null;
}

const fisNumaralari = (no: string) => [`SF-${no}`, `TSK-${no}`];

// ─────────────────────────────────────────────────────────────────────────
// SESLİ KANAL — konuşma sırasında çağrılan araçlar
// ─────────────────────────────────────────────────────────────────────────

export interface AracBaglami {
  tenantId: string;
  callId: string | null;
  /** Retell çağrı kaydından (call.from_number). '' = tanınmadı/gizli. */
  arayanSon10: string;
  acik: boolean;
}

/** Bir çağrıda en çok FIS_SORGU_SINIRI fiş sorgusu (fiş numaraları sıralı; tahmin zorlaşsın). */
const fisSorgusuSerbest = sinirlayici(FIS_SORGU_SINIRI, 30 * 60_000);

/**
 * Araç çağrısının kiracısı — YALNIZ ajan kimliğinden (kurulumda bizim
 * yazdığımız). Bilinmeyen kimlik → null; numaraya bakıp tahmin yapılmaz.
 */
export async function aracKiracisi(agentId: string | null): Promise<{ tenantId: string; acik: boolean } | null> {
  if (!agentId) return null;
  const a = await prisma.telefonAjani.findUnique({
    where: { retellAgentId: agentId },
    select: { tenantId: true, acik: true, tenant: { select: BAYI_SECIM } },
  });
  const k = kiraciKarari(agentId, a ? { tenantId: a.tenantId, acik: a.acik, kiraciEtkin: bayiEtkin(a.tenant) } : null);
  return k.tur === 'RED' ? null : { tenantId: k.tenantId, acik: k.tur === 'ACIK' };
}

export async function aracCalistir(b: AracBaglami, ad: string | null, args: Record<string, unknown>): Promise<AracCevabi> {
  // Ajan kapalıysa (ya da bayi kapalı/askıda) hangi araç çağrılırsa çağrılsın aktar.
  // Asıl koruma gelen arama yönlendirmesi; bu ikinci kat.
  if (!b.acik) return devirCevabi();
  switch (ad) {
    case 'musteri_tani':
      return musteriTani(b);
    case 'cihaz_bul':
      return cihazBul(b, args);
    case 'taslak_ac':
      return taslakAc(b, args);
    case 'fis_durumu':
      return fisDurumu(b, args);
    case 'insana_devret':
      return insanaDevret(b);
    default:
      return hataCevabi();
  }
}

/** Yalnız "tanındı mı" — ad, cihaz, borç gibi hiçbir bilgi dönmez (numara taklit edilebilir). */
async function musteriTani(b: AracBaglami): Promise<AracCevabi> {
  const m = b.arayanSon10 ? await numaraninMusterileri(b.tenantId, b.arayanSon10) : [];
  return m.length
    ? { ok: true, tanindi: true, soyle: CUMLE.TANINDI }
    : { ok: true, tanindi: false, soyle: CUMLE.TANINMADI };
}

async function cihazBul(b: AracBaglami, args: Record<string, unknown>): Promise<AracCevabi> {
  const seri = metin(args.seri_no, 60);
  const model = metin(args.model, 80);
  let tekil = false;
  if ((seri || model) && b.arayanSon10) {
    const m = await numaraninMusterileri(b.tenantId, b.arayanSon10);
    if (m.length) {
      const e = cihazEsle({ seriNo: seri, model }, await musteriCihazlari(b.tenantId, m.map((x) => x.id)));
      tekil = e.deviceId !== null && e.neden !== 'TEK_CIHAZ';
    }
  }
  return cihazBulCevabi({ seriVerdi: sade(seri).length >= 4, modelVerdi: Boolean(model), tekilEslesme: tekil });
}

/**
 * TASLAK AÇ — fiş DEĞİL. Aynı çağrıda ikinci kez çağrılırsa (ya da Retell
 * aynı isteği yinelerse) yeni taslak açılmaz, var olan BEKLEYEN taslağa
 * eklenir; onaylanmış/reddedilmiş taslağın üzerine yazılmaz.
 */
async function taslakAc(b: AracBaglami, args: Record<string, unknown>): Promise<AracCevabi> {
  const ariza = metin(args.ariza, 1000);
  if (!ariza) return { ok: true, soyle: CUMLE.ARIZA_SOR };
  if (!b.callId) return hataCevabi();

  const seri = metin(args.seri_no, 60);
  const model = metin(args.model, 80);
  const yeni: TaslakAlanlari = {
    arizaMetni: ariza,
    soylenenSeriNo: seri,
    soylenenModel: model,
    arayanAdi: metin(args.ad, 80),
    firmaAdi: metin(args.firma, 120),
    acil: args.acil === true,
    faultCategory: faultCategoryFromLegacyText(ariza),
  };

  const musteriler = b.arayanSon10 ? await numaraninMusterileri(b.tenantId, b.arayanSon10) : [];
  let deviceId: string | null = null;
  let cihazNeden: CihazNeden | null = null;
  if (musteriler.length) {
    const e = cihazEsle({ seriNo: seri, model }, await musteriCihazlari(b.tenantId, musteriler.map((x) => x.id)));
    if (e.deviceId) {
      deviceId = e.deviceId;
      cihazNeden = e.neden;
    }
  } else if (seri) {
    // Tanınmayan arayan: eşleşme bayiye gösterilir, arayana SÖYLENMEZ.
    const d = await seriyleBayiCihazi(b.tenantId, seri);
    if (d) {
      deviceId = d.id;
      cihazNeden = 'SERI';
    }
  }
  const customerId = musteriler.length === 1 ? musteriler[0].id : null;

  try {
    await prisma.ajanTaslagi.create({
      data: {
        tenantId: b.tenantId,
        kanal: 'TELEFON',
        kaynakKimlik: b.callId,
        arayanSon10: b.arayanSon10,
        customerId,
        deviceId,
        cihazNeden,
        soylenenSeriNo: yeni.soylenenSeriNo,
        soylenenModel: yeni.soylenenModel,
        arizaMetni: ariza,
        faultCategory: yeni.faultCategory as FaultCategory | null,
        arayanAdi: yeni.arayanAdi,
        firmaAdi: yeni.firmaAdi,
        acil: Boolean(yeni.acil),
      },
    });
    return { ok: true, soyle: CUMLE.TASLAK_ALINDI };
  } catch (e) {
    if (!benzersizHatasi(e)) throw e;
  }

  const eski = await prisma.ajanTaslagi.findUnique({
    where: { tenantId_kanal_kaynakKimlik: { tenantId: b.tenantId, kanal: 'TELEFON', kaynakKimlik: b.callId } },
  });
  if (!eski || eski.durum !== 'BEKLIYOR') return { ok: true, soyle: CUMLE.TASLAK_ISLENMIS };
  const bir = taslakBirlestir(eski, yeni);
  await prisma.ajanTaslagi.updateMany({
    where: { id: eski.id, tenantId: b.tenantId, durum: 'BEKLIYOR' },
    data: {
      arizaMetni: bir.arizaMetni ?? eski.arizaMetni,
      soylenenSeriNo: bir.soylenenSeriNo,
      soylenenModel: bir.soylenenModel,
      arayanAdi: bir.arayanAdi,
      firmaAdi: bir.firmaAdi,
      acil: Boolean(bir.acil),
      faultCategory: bir.faultCategory as FaultCategory | null,
      customerId: customerId ?? eski.customerId,
      deviceId: deviceId ?? eski.deviceId,
      cihazNeden: deviceId ? cihazNeden : eski.cihazNeden,
    },
  });
  return { ok: true, soyle: CUMLE.TASLAK_ALINDI };
}

/**
 * FİŞ DURUMU (ses). Fiş hem bu bayinin hem bu numaranın müşterisinin
 * (`ServiceTicket.customerId` — cihaz başka müşteriye geçmiş olabilir).
 * Bulunamadı / başkasının / tanınmadı / sorgu sınırı aşıldı: HEPSİ AYNI cevap.
 * Seste yalnız durum söylenir; marka/model/yer yok.
 */
async function fisDurumu(b: AracBaglami, args: Record<string, unknown>): Promise<AracCevabi> {
  if (!fisSorgusuSerbest(b.callId)) return notrCevap();
  const no = fisNoCikar(metin(args.fis_no, 40), { niyetsiz: true });
  if (!no || !b.arayanSon10) return notrCevap();
  const m = await numaraninMusterileri(b.tenantId, b.arayanSon10);
  if (!m.length) return notrCevap();
  const fis = await prisma.serviceTicket.findFirst({
    where: {
      tenantId: b.tenantId,
      deletedAt: null,
      customerId: { in: m.map((x) => x.id) },
      ticketNumber: { in: fisNumaralari(no) },
    },
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true, status: true },
  });
  return fis ? { ok: true, soyle: sesDurumCumlesi(fis.ticketNumber, fis.status) } : notrCevap();
}

/** İnsana devir: aktarma numarası ve mesai varsa aktar; mesai dışında söz vermeden kaydı al. */
async function insanaDevret(b: AracBaglami): Promise<AracCevabi> {
  const [a, t] = await Promise.all([
    prisma.telefonAjani.findUnique({ where: { tenantId: b.tenantId }, select: { aktarmaTelefonu: true } }),
    prisma.tenant.findUnique({
      where: { id: b.tenantId },
      select: { workTimezone: true, workDays: true, workStartMin: true, workEndMin: true, workHolidays: true },
    }),
  ]);
  if (!e164TR(a?.aktarmaTelefonu)) return { ok: true, devret: false, soyle: CUMLE.AKTARAMIYORUM };
  if (t && !mesaideMi(new Date(), takvimKur(t))) return { ok: true, devret: false, soyle: CUMLE.MESAI_DISI };
  return devirCevabi();
}

// ─────────────────────────────────────────────────────────────────────────
// GELEN ARAMA — hangi ajan konuşacak
// ─────────────────────────────────────────────────────────────────────────

export async function gelenAramaKarari(arananNumara: unknown) {
  const hat = hatNumarasiSade(typeof arananNumara === 'string' ? arananNumara : '');
  if (!hat) return gelenAramaYaniti(null);
  const a = await prisma.telefonAjani.findUnique({
    where: { hatNumarasi: hat },
    select: { acik: true, retellAgentId: true, retellAktarmaAgentId: true, tenant: { select: BAYI_SECIM } },
  });
  if (!a) return gelenAramaYaniti(null);
  return gelenAramaYaniti({
    acik: a.acik,
    kiraciEtkin: bayiEtkin(a.tenant),
    kiraciSilindi: Boolean(a.tenant.deletedAt),
    asilAgentId: a.retellAgentId,
    aktarmaAgentId: a.retellAktarmaAgentId,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// WHATSAPP
// ─────────────────────────────────────────────────────────────────────────

export interface WaGirdi {
  tenantId: string;
  tenantAdi: string;
  waMessageId: string;
  fromPhone: string;
  metin: string | null;
  /** Webhook'un eşlediği müşteri (giden satırı ona bağlanır). */
  customerId: string | null;
  /** Mesajdan fiş önerisi (lib/whatsapp-suggest) — cihazı oradan alırız. */
  oneri: Suggestion | null;
  /** Mesaj platformun paylaşımlı numarasına geldi: sendText bu numaradan gönderir. */
  platformNumarasina: boolean;
}

/**
 * Ajan açıkken gelen WhatsApp mesajı.
 *
 *  · Tanınmayan numara → HİÇBİR ŞEY (ne cevap ne taslak).
 *  · Cevap yalnız mesaj platform numarasına geldiyse VE numara tek bir bayiye
 *    aitse gider: bayinin kendi numarası varsa cevap başka numaradan gider ve
 *    müşteri tanımaz; numara iki bayide kayıtlıysa hangi bayi adına yazdığımız
 *    tahmin olur. O hâllerde taslak yine açılır, müşteriye soru sorulmaz.
 *  · Medya hiç yorumlanmaz (sayaç fotoğrafından okuma YOK).
 */
export async function waAjanIsle(g: WaGirdi): Promise<{ cevaplandi: boolean; islem: string }> {
  const s10 = son10(g.fromPhone);
  const musteriler = s10 ? await numaraninMusterileri(g.tenantId, s10) : [];
  if (!musteriler.length) return { cevaplandi: false, islem: 'YOK' };
  const idler = musteriler.map((m) => m.id);

  const acik = await prisma.ajanTaslagi.findFirst({
    where: {
      tenantId: g.tenantId,
      kanal: 'WHATSAPP',
      arayanSon10: s10,
      durum: 'BEKLIYOR',
      updatedAt: { gte: new Date(Date.now() - WA_PENCERE_MS) },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, bekledigi: true },
  });

  const karar = waKarari({
    musteriTanindi: true,
    metin: g.metin,
    arizaBildirimi: looksLikeFaultReport(g.metin),
    cihazBekleyenTaslakId: acik?.bekledigi === 'CIHAZ' ? acik.id : null,
    acikTaslakId: acik?.id ?? null,
  });

  let izin: boolean | null = null;
  const gonder = async (govde: string): Promise<boolean> => {
    izin ??= Boolean(
      g.platformNumarasina &&
        waOutConfigured() &&
        !(await disariyaMesajKapali(g.tenantId)) &&
        (await numaraninBayileri(s10)).length === 1,
    );
    if (!izin) return false;
    const yazi = `${govde}\n\n${g.tenantAdi}`;
    const r = await sendText(g.fromPhone, yazi);
    if (!r.ok) return false;
    // Botun yazdığı da sohbette görünsün (gelen kutusunun 'cevap' kalıbı; yazan kişi yok).
    await prisma.whatsAppMessage
      .create({
        data: {
          tenantId: g.tenantId,
          customerId: g.customerId ?? (idler.length === 1 ? idler[0] : null),
          yon: 'GIDEN',
          waMessageId: r.id ?? `ajan-${randomBytes(8).toString('hex')}`,
          fromPhone: g.fromPhone,
          text: yazi,
          receivedAt: new Date(),
          handled: true,
          durum: 'gonderildi',
        },
      })
      .catch((e) => console.error('[telefon-ajani] giden mesaj kaydedilemedi:', (e as Error)?.message));
    return true;
  };

  if (karar.tur === 'TASLAK_TAMAMLA') {
    const e = cihazEsleMetin(g.metin, await musteriCihazlari(g.tenantId, idler));
    const sonuc = await prisma.ajanTaslagi.updateMany({
      where: { id: karar.taslakId, tenantId: g.tenantId, durum: 'BEKLIYOR' },
      data: {
        bekledigi: null,
        mesajKimlikleri: { push: g.waMessageId },
        ...(e.deviceId
          ? { deviceId: e.deviceId, cihazNeden: e.neden }
          : { soylenenSeriNo: (g.metin ?? '').trim().slice(0, 80) }),
      },
    });
    if (!sonuc.count) return { cevaplandi: false, islem: 'YOK' };
    return { cevaplandi: await gonder(CUMLE.WA_TESEKKUR), islem: 'TASLAK_TAMAMLA' };
  }

  if (karar.tur === 'FIS_DURUMU') {
    const fis = await prisma.serviceTicket.findFirst({
      where: {
        tenantId: g.tenantId,
        deletedAt: null,
        customerId: { in: idler },
        ticketNumber: { in: fisNumaralari(karar.fisNo) },
      },
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true, status: true, device: { select: { brand: true, model: true } } },
    });
    if (fis) {
      const ok = await gonder(
        waDurumCumlesi({ ticketNumber: fis.ticketNumber, status: fis.status, brand: fis.device.brand, model: fis.device.model }),
      );
      return { cevaplandi: ok, islem: 'FIS_DURUMU' };
    }
    // Bulunamadı: "böyle bir fiş yok" DENMEZ; mesaj arıza bildirimiyse o akışa düşer.
    return waArizaIsle(g, karar.yoksa, idler, s10, gonder);
  }

  return waArizaIsle(g, karar, idler, s10, gonder);
}

async function waArizaIsle(
  g: WaGirdi,
  karar: WaArizaKarari | { tur: 'YOK' },
  idler: string[],
  s10: string,
  gonder: (govde: string) => Promise<boolean>,
): Promise<{ cevaplandi: boolean; islem: string }> {
  if (karar.tur === 'YOK') return { cevaplandi: false, islem: 'YOK' };

  if (karar.tur === 'TASLAK_EKLE') {
    // Müşteri arızayı birkaç mesajda anlatır: tek taslak, tek onay mesajı.
    const eski = await prisma.ajanTaslagi.findFirst({
      where: { id: karar.taslakId, tenantId: g.tenantId },
      select: { arizaMetni: true },
    });
    await prisma.ajanTaslagi.updateMany({
      where: { id: karar.taslakId, tenantId: g.tenantId, durum: 'BEKLIYOR' },
      data: {
        arizaMetni: taslakBirlestir({ arizaMetni: eski?.arizaMetni }, { arizaMetni: g.metin }).arizaMetni ?? '',
        mesajKimlikleri: { push: g.waMessageId },
      },
    });
    return { cevaplandi: false, islem: 'TASLAK_EKLE' };
  }

  // TASLAK_AC
  const cihazlar = await musteriCihazlari(g.tenantId, idler);
  let deviceId: string | null = null;
  let cihazNeden: CihazNeden | null = null;
  const oneri = g.oneri && g.oneri.confidence >= MIN_CONFIDENCE ? g.oneri : null;
  if (oneri?.deviceId && cihazlar.some((c) => c.id === oneri.deviceId)) {
    deviceId = oneri.deviceId;
    cihazNeden = 'ONERI';
  } else {
    const e = cihazEsleMetin(g.metin, cihazlar);
    if (e.deviceId) {
      deviceId = e.deviceId;
      cihazNeden = e.neden;
    } else if (cihazlar.length === 1) {
      deviceId = cihazlar[0].id;
      cihazNeden = 'TEK_CIHAZ';
    }
  }
  const kategori = (oneri?.faultCategory ?? faultCategoryFromLegacyText(g.metin)) as FaultCategory | null;

  let taslakId: string;
  try {
    const t = await prisma.ajanTaslagi.create({
      data: {
        tenantId: g.tenantId,
        kanal: 'WHATSAPP',
        kaynakKimlik: g.waMessageId,
        mesajKimlikleri: [g.waMessageId],
        arayanSon10: s10,
        customerId: idler.length === 1 ? idler[0] : null,
        deviceId,
        cihazNeden,
        arizaMetni: (g.metin ?? '').trim().slice(0, 2000),
        faultCategory: kategori,
      },
      select: { id: true },
    });
    taslakId = t.id;
  } catch (e) {
    if (benzersizHatasi(e)) return { cevaplandi: false, islem: 'YOK' };
    throw e;
  }

  const cihazSor = !deviceId && cihazlar.length > 1;
  const ok = await gonder(cihazSor ? `${CUMLE.WA_TASLAK}\n\n${CUMLE.WA_CIHAZ_SOR}` : CUMLE.WA_TASLAK);
  // Soru yalnız GERÇEKTEN gittiyse beklenir; yoksa sonraki alakasız mesaj cihaz cevabı sanılırdı.
  if (ok && cihazSor) {
    await prisma.ajanTaslagi.updateMany({
      where: { id: taslakId, tenantId: g.tenantId, durum: 'BEKLIYOR' },
      data: { bekledigi: 'CIHAZ' },
    });
  }
  return { cevaplandi: ok, islem: 'TASLAK_AC' };
}

/**
 * Bayi fişi gelen kutusunda doğrudan MESAJDAN açtıysa bekleyen taslak
 * kapanır (çift fiş olmasın). Kapanış yolu MESAJ: sayaçta ayrı görünür.
 */
export async function taslagiFisleKapat(tenantId: string, waMessageId: string, ticketId: string, userId: string | null) {
  await prisma.ajanTaslagi.updateMany({
    where: { tenantId, kanal: 'WHATSAPP', durum: 'BEKLIYOR', mesajKimlikleri: { has: waMessageId } },
    data: { durum: 'ONAYLANDI', kapanisYolu: 'MESAJ', ticketId, kararVerenId: userId, kararAt: new Date(), bekledigi: null },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// GELEN KUTUSU — liste, ayrıntı, sayaç
// ─────────────────────────────────────────────────────────────────────────

export interface TaslakSatiri {
  id: string;
  kanal: string;
  durum: string;
  kapanisYolu: string | null;
  createdAt: string;
  arayanSon10: string;
  musteri: { id: string; name: string } | null;
  cihaz: { id: string; brand: string; model: string; serialNo: string } | null;
  cihazNeden: string | null;
  soylenenSeriNo: string | null;
  soylenenModel: string | null;
  arizaMetni: string;
  faultCategory: string | null;
  arayanAdi: string | null;
  firmaAdi: string | null;
  acil: boolean;
  fis: { id: string; ticketNumber: string } | null;
  redSebebi: string | null;
}

export async function taslakListesi(tenantId: string, secim: 'BEKLIYOR' | 'HEPSI', limit = 50): Promise<TaslakSatiri[]> {
  const satirlar = await prisma.ajanTaslagi.findMany({
    where: { tenantId, ...(secim === 'BEKLIYOR' ? { durum: 'BEKLIYOR' } : {}) },
    orderBy: secim === 'BEKLIYOR' ? [{ acil: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }],
    take: Math.min(Math.max(limit, 1), 200),
  });
  if (!satirlar.length) return [];

  const cihazIdleri = [...new Set(satirlar.map((s) => s.deviceId).filter(Boolean) as string[])];
  const fisIdleri = [...new Set(satirlar.map((s) => s.ticketId).filter(Boolean) as string[])];
  const cihazlar = cihazIdleri.length
    ? await prisma.device.findMany({
        where: { tenantId, id: { in: cihazIdleri } },
        select: { id: true, brand: true, model: true, serialNo: true, customerId: true },
      })
    : [];
  const musteriIdleri = [
    ...new Set([...satirlar.map((s) => s.customerId), ...cihazlar.map((c) => c.customerId)].filter(Boolean) as string[]),
  ];
  const [musteriler, fisler] = await Promise.all([
    musteriIdleri.length
      ? prisma.customer.findMany({ where: { tenantId, id: { in: musteriIdleri } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    fisIdleri.length
      ? prisma.serviceTicket.findMany({ where: { tenantId, id: { in: fisIdleri } }, select: { id: true, ticketNumber: true } })
      : Promise.resolve([] as { id: string; ticketNumber: string }[]),
  ]);
  const cihazBul = new Map(cihazlar.map((c) => [c.id, c]));
  const musteriBul = new Map(musteriler.map((m) => [m.id, m]));
  const fisBul = new Map(fisler.map((f) => [f.id, f]));

  return satirlar.map((s) => {
    const c = s.deviceId ? cihazBul.get(s.deviceId) ?? null : null;
    const mId = s.customerId ?? c?.customerId ?? null;
    return {
      id: s.id,
      kanal: s.kanal,
      durum: s.durum,
      kapanisYolu: s.kapanisYolu,
      createdAt: s.createdAt.toISOString(),
      arayanSon10: s.arayanSon10,
      musteri: mId ? musteriBul.get(mId) ?? null : null,
      cihaz: c ? { id: c.id, brand: c.brand, model: c.model, serialNo: c.serialNo } : null,
      cihazNeden: s.cihazNeden,
      soylenenSeriNo: s.soylenenSeriNo,
      soylenenModel: s.soylenenModel,
      arizaMetni: s.arizaMetni,
      faultCategory: s.faultCategory,
      arayanAdi: s.arayanAdi,
      firmaAdi: s.firmaAdi,
      acil: s.acil,
      fis: s.ticketId ? fisBul.get(s.ticketId) ?? null : null,
      redSebebi: s.redSebebi,
    };
  });
}

export async function bekleyenTaslakSayisi(tenantId: string): Promise<number> {
  return prisma.ajanTaslagi.count({ where: { tenantId, durum: 'BEKLIYOR' } });
}

/** Ölçü: açılan / onaylanan (taslaktan + mesajdan) / reddedilen / bekleyen — bu ay ve toplam. */
export async function taslakSayaci(
  tenantId: string,
  simdi = new Date(),
): Promise<{ buAy: TaslakSayaci; toplam: TaslakSayaci }> {
  const say = (where: Prisma.AjanTaslagiWhereInput) =>
    prisma.ajanTaslagi.groupBy({ by: ['durum', 'kapanisYolu'], where, _count: { _all: true } });
  const [hepsi, buAy] = await Promise.all([
    say({ tenantId }),
    say({ tenantId, createdAt: { gte: ayBasi(simdi) } }),
  ]);
  const cevir = (r: { durum: string; kapanisYolu: string | null; _count: { _all: number } }[]) =>
    sayacTopla(r.map((x) => ({ durum: x.durum, kapanisYolu: x.kapanisYolu, n: x._count._all })));
  return { buAy: cevir(buAy), toplam: cevir(hepsi) };
}

async function isSayilari(where: Prisma.ServiceTicketWhereInput): Promise<Map<string, number>> {
  const satir = await prisma.serviceTicket.groupBy({ by: ['assignedUserId'], where, _count: { _all: true } });
  const m = new Map<string, number>();
  for (const s of satir) if (s.assignedUserId) m.set(s.assignedUserId, s._count._all);
  return m;
}

/** Teknisyen önerisi — bölge (ilçe/il), marka, kategori, açık iş. Yalnız ÖNERİ. */
async function teknisyenOnerisiHesapla(
  tenantId: string,
  t: { customerId: string | null; deviceId: string | null; faultCategory: FaultCategory | null },
  teknisyenler: { id: string; name: string }[],
): Promise<TeknisyenOnerisi | null> {
  if (!teknisyenler.length) return null;
  const idler = teknisyenler.map((x) => x.id);
  const cihaz = t.deviceId
    ? await prisma.device.findFirst({ where: { id: t.deviceId, tenantId }, select: { brand: true, customerId: true } })
    : null;
  const musteriId = t.customerId ?? cihaz?.customerId ?? null;
  const musteri = musteriId
    ? await prisma.customer.findFirst({ where: { id: musteriId, tenantId }, select: { district: true, city: true } })
    : null;

  const taban: Prisma.ServiceTicketWhereInput = {
    tenantId,
    deletedAt: null,
    assignedUserId: { in: idler },
    createdAt: { gte: new Date(Date.now() - 180 * GUN_MS) },
  };
  const bolge: Prisma.CustomerWhereInput | null = musteri?.district
    ? { district: { equals: musteri.district, mode: 'insensitive' } }
    : musteri?.city
      ? { city: { equals: musteri.city, mode: 'insensitive' } }
      : null;
  const bos = Promise.resolve(new Map<string, number>());
  const [bolgeIs, markaIs, kategoriIs, acikIs] = await Promise.all([
    bolge ? isSayilari({ ...taban, device: { customer: bolge } }) : bos,
    cihaz?.brand ? isSayilari({ ...taban, device: { brand: { equals: cihaz.brand, mode: 'insensitive' } } }) : bos,
    t.faultCategory ? isSayilari({ ...taban, faultCategory: t.faultCategory }) : bos,
    isSayilari({ tenantId, deletedAt: null, assignedUserId: { in: idler }, status: { in: ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'] } }),
  ]);
  return teknisyenSec(
    teknisyenler.map((x) => ({
      id: x.id,
      ad: x.name,
      bolgeIs: bolgeIs.get(x.id) ?? 0,
      markaIs: markaIs.get(x.id) ?? 0,
      kategoriIs: kategoriIs.get(x.id) ?? 0,
      acikIs: acikIs.get(x.id) ?? 0,
    })),
  );
}

/**
 * "Fişe çevir" panelinin verisi: aday cihazlar, teknisyenler, öneri.
 * Öneri BURADA, bir kez hesaplanır ve saklanır (gelen kutusu listesi hafif kalsın).
 */
export async function taslakAyrintisi(tenantId: string, id: string) {
  const t = await prisma.ajanTaslagi.findFirst({ where: { id, tenantId } });
  if (!t) return null;

  let musteriIdleri: string[] = [];
  if (t.customerId) musteriIdleri = [t.customerId];
  else if (t.deviceId) {
    const d = await prisma.device.findFirst({ where: { id: t.deviceId, tenantId }, select: { customerId: true } });
    if (d) musteriIdleri = [d.customerId];
  } else if (t.arayanSon10) {
    musteriIdleri = (await numaraninMusterileri(tenantId, t.arayanSon10)).map((m) => m.id);
  }

  const [musteriler, adaylar, teknisyenler] = await Promise.all([
    musteriIdleri.length
      ? prisma.customer.findMany({ where: { tenantId, id: { in: musteriIdleri } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    musteriIdleri.length
      ? prisma.device.findMany({
          where: { tenantId, customerId: { in: musteriIdleri } },
          select: { id: true, brand: true, model: true, serialNo: true, location: true, customerId: true },
          orderBy: [{ brand: 'asc' }, { model: 'asc' }],
          take: 200,
        })
      : Promise.resolve([] as { id: string; brand: string; model: string; serialNo: string; location: string | null; customerId: string }[]),
    prisma.user.findMany({
      where: { tenantId, role: 'TECHNICIAN', isActive: true, davetBekliyor: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  let oneri: { teknisyenId: string; veri: OneriVerisi } | null = t.onerilenTeknisyenId
    ? { teknisyenId: t.onerilenTeknisyenId, veri: t.oneriVerisi as unknown as OneriVerisi }
    : null;
  if (!t.oneriAt && t.durum === 'BEKLIYOR') {
    const o = await teknisyenOnerisiHesapla(tenantId, t, teknisyenler);
    await prisma.ajanTaslagi.updateMany({
      where: { id, tenantId, durum: 'BEKLIYOR' },
      data: {
        onerilenTeknisyenId: o?.teknisyenId ?? null,
        oneriVerisi: o ? (o.veri as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        oneriAt: new Date(),
      },
    });
    oneri = o ? { teknisyenId: o.teknisyenId, veri: o.veri } : null;
  }

  return {
    taslak: {
      id: t.id,
      durum: t.durum,
      deviceId: t.deviceId,
      arizaMetni: t.arizaMetni,
      faultCategory: t.faultCategory,
      acil: t.acil,
      birdenCokMusteri: !t.customerId && !t.deviceId && musteriIdleri.length > 1,
    },
    musteriler,
    adaylar,
    teknisyenler,
    oneri,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// KARAR — onay (FİŞ YAZAN TEK YER) ve ret
// ─────────────────────────────────────────────────────────────────────────

const ONCELIKLER: readonly Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/**
 * TASLAĞI FİŞE ÇEVİR — bayinin kararı.
 *
 * Tek işlemde: fiş yazılır → taslak BEKLIYOR koşuluyla alınır → bağlı
 * WhatsApp mesajları "fişi yok" koşuluyla alınır. Biri tutmazsa işlem geri
 * alınır: iki kişi aynı anda onaylarsa ya da fiş mesajdan zaten açıldıysa
 * ikinci fiş YAZILMAZ.
 */
export async function taslakOnayla(
  tenantId: string,
  id: string,
  kullanici: { id: string },
  g: { deviceId?: unknown; assignedUserId?: unknown; issueText?: unknown; faultCategory?: unknown; priority?: unknown },
): Promise<{ ticketId: string; ticketNumber: string }> {
  const t = await prisma.ajanTaslagi.findFirst({ where: { id, tenantId } });
  if (!t) throw new AjanHatasi('BULUNAMADI', 404);
  if (t.durum !== 'BEKLIYOR') throw new AjanHatasi('TASLAK_ZATEN_ISLENDI', 409);

  const deviceId = typeof g.deviceId === 'string' ? g.deviceId : '';
  if (!deviceId) throw new AjanHatasi('CIHAZ_SECILMEDI', 400);
  const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { id: true, customerId: true } });
  if (!cihaz) throw new AjanHatasi('CIHAZ_BULUNAMADI', 404);

  let atanan: string | null = null;
  if (typeof g.assignedUserId === 'string' && g.assignedUserId) {
    const u = await prisma.user.findFirst({
      where: { id: g.assignedUserId, tenantId, isActive: true, davetBekliyor: false },
      select: { id: true },
    });
    if (!u) throw new AjanHatasi('ATANAN_KISI_GECERSIZ', 400);
    atanan = u.id;
  }

  const issueText = ((typeof g.issueText === 'string' && g.issueText.trim()) || t.arizaMetni || '-').slice(0, 2000);
  const kategori = parseFaultCategory(g.faultCategory) ?? t.faultCategory ?? faultCategoryFromLegacyText(issueText);
  const oncelik: Priority = ONCELIKLER.includes(g.priority as Priority) ? (g.priority as Priority) : t.acil ? 'HIGH' : 'NORMAL';

  const bayi = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { locale: true } });
  const m = ajanMetni(bayi?.locale);
  const not = doldurMetin(m.fisNotu, {
    kanal: m.kanal[t.kanal] ?? t.kanal,
    numara: t.arayanSon10 ? numaraGoster(t.arayanSon10) : m.numaraGizli,
  });
  const mesajlar = t.kanal === 'WHATSAPP' ? t.mesajKimlikleri : [];

  const fis = await fisNumarasiylaOlustur(tenantId, (ticketNumber) =>
    prisma.$transaction(async (tx) => {
      const yeni = await tx.serviceTicket.create({
        data: {
          tenantId,
          deviceId: cihaz.id,
          customerId: cihaz.customerId,
          ticketNumber,
          faultCategory: kategori,
          issueText,
          notes: not,
          assignedUserId: atanan,
          createdByUserId: kullanici.id,
          priority: oncelik,
        },
        select: { id: true, ticketNumber: true, status: true },
      });
      const al = await tx.ajanTaslagi.updateMany({
        where: { id, tenantId, durum: 'BEKLIYOR' },
        data: {
          durum: 'ONAYLANDI',
          kapanisYolu: 'TASLAK',
          ticketId: yeni.id,
          deviceId: cihaz.id,
          kararVerenId: kullanici.id,
          kararAt: new Date(),
          bekledigi: null,
        },
      });
      if (al.count !== 1) throw new AjanHatasi('TASLAK_ZATEN_ISLENDI', 409);
      if (mesajlar.length) {
        const varolan = await tx.whatsAppMessage.findMany({
          where: { tenantId, waMessageId: { in: mesajlar } },
          select: { id: true, ticketId: true },
        });
        if (varolan.some((x) => x.ticketId)) throw new AjanHatasi('BU_MESAJDAN_ZATEN_FIS_ACILMIS', 409);
        if (varolan.length) {
          const n = await tx.whatsAppMessage.updateMany({
            where: { id: { in: varolan.map((x) => x.id) }, ticketId: null },
            data: { ticketId: yeni.id, handled: true },
          });
          if (n.count !== varolan.length) throw new AjanHatasi('BU_MESAJDAN_ZATEN_FIS_ACILMIS', 409);
        }
      }
      return yeni;
    }),
  );

  await kaydetAsama({
    tenantId,
    ticketId: fis.id,
    status: fis.status,
    changedByUserId: kullanici.id,
    kaynak: 'PANEL',
    notu: m.asamaNotu,
  });
  await writeAudit({
    tenantId,
    userId: kullanici.id,
    action: 'AJAN_TASLAGI_ONAYLANDI',
    entityType: 'AjanTaslagi',
    entityId: id,
    newValue: { ticketId: fis.id, ticketNumber: fis.ticketNumber, kanal: t.kanal },
  });
  return { ticketId: fis.id, ticketNumber: fis.ticketNumber };
}

export async function taslakReddet(tenantId: string, id: string, kullanici: { id: string }, sebep: unknown): Promise<void> {
  const r = await prisma.ajanTaslagi.updateMany({
    where: { id, tenantId, durum: 'BEKLIYOR' },
    data: {
      durum: 'REDDEDILDI',
      kararVerenId: kullanici.id,
      kararAt: new Date(),
      redSebebi: metin(sebep, 300),
      bekledigi: null,
    },
  });
  if (r.count !== 1) {
    const varMi = await prisma.ajanTaslagi.findFirst({ where: { id, tenantId }, select: { id: true } });
    throw varMi ? new AjanHatasi('TASLAK_ZATEN_ISLENDI', 409) : new AjanHatasi('BULUNAMADI', 404);
  }
  await writeAudit({ tenantId, userId: kullanici.id, action: 'AJAN_TASLAGI_REDDEDILDI', entityType: 'AjanTaslagi', entityId: id });
}

// ─────────────────────────────────────────────────────────────────────────
// AYAR, HAZIRLIK, KURULUM
// ─────────────────────────────────────────────────────────────────────────

export async function ajanAyarDurumu(tenantId: string) {
  const [a, t] = await Promise.all([
    prisma.telefonAjani.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { whatsappPhoneId: true } }),
  ]);
  const whatsappKurulu = Boolean(t?.whatsappPhoneId) || paylasimliWhatsappAcik();
  const kurulu = Boolean(a?.retellAgentId && a?.retellAktarmaAgentId && a?.retellSenkronAt);
  const aktarmaTelefonu = a?.aktarmaTelefonu ?? null;
  const hatNumarasi = a?.hatNumarasi ?? null;
  return {
    acik: a?.acik ?? false,
    asistanAdi: a?.asistanAdi ?? 'Deniz',
    aktarmaTelefonu,
    hatNumarasi,
    kurulu,
    retellSenkronAt: a?.retellSenkronAt?.toISOString() ?? null,
    retellHata: a?.retellHata ?? null,
    whatsappKurulu,
    hazirlik: hazirlikListesi(process.env as KurulumOrtami, { aktarmaTelefonu, hatNumarasi, kurulu }, whatsappKurulu),
  };
}

export interface KurulumSonucu {
  ok: boolean;
  kod?: KurulumKodu;
  detay?: string;
  uyarilar: string[];
}

interface Kim {
  userId?: string | null;
  actorType?: ActorType;
  actorName?: string | null;
}

/**
 * Retell'e kur ya da güncelle. İki ajan: ASIL (araçlı) ve YALNIZ AKTARMA
 * (numaranın varsayılanı). `hatBagla`: numarayı aktarma ajanına ve gelen arama
 * ucumuza bağla (yalnız süper admin kurulumunda). `yeniOlustur`: ajan yoksa
 * oluştur (bayinin ayar değişikliği yalnız var olanı günceller).
 *
 * İkinci kez çağrılması güvenli: kayıtlı kimlik varsa yeni ajan açılmaz.
 * Oluşturulan her kimlik HEMEN yazılır; sonraki adım düşerse ajan sahipsiz kalmaz.
 */
export async function ajaniSagla(tenantId: string, kim: Kim, s: { hatBagla: boolean; yeniOlustur: boolean }): Promise<KurulumSonucu> {
  const [a, t] = await Promise.all([
    prisma.telefonAjani.findUnique({ where: { tenantId } }),
    prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { name: true } }),
  ]);
  if (!t) return { ok: false, kod: 'KIRACI_YOK', uyarilar: [] };
  const env = process.env as KurulumOrtami;
  const yeniAjan = !a?.retellAgentId || !a?.retellAktarmaAgentId;
  if (yeniAjan && !s.yeniOlustur) return { ok: true, uyarilar: [] }; // kurulu değil: gönderilecek bir şey yok
  const kapi = kurulumKapisi(
    env,
    { aktarmaTelefonu: a?.aktarmaTelefonu ?? null, hatNumarasi: a?.hatNumarasi ?? null },
    { yeniAjan, hatGerekli: s.hatBagla },
  );
  if (kapi || !a) return { ok: false, kod: kapi ?? 'AKTARMA_YOK', uyarilar: [] };

  const taban = aracTabani(env) as string;
  const sir = env.VOICE_TOOL_SECRET as string;
  const aktarma = e164TR(a.aktarmaTelefonu) as string;
  const webhookUrl = `${taban}/api/voice/webhook`;
  const ayar = ajanGovdesi({ webhookUrl });
  const asil: LlmIcerigi = {
    prompt: ajanPromptu({ bayiAdi: t.name, asistanAdi: a.asistanAdi }),
    araclar: servisAraclari({ url: `${taban}/api/voice/tools`, sir }, aktarma),
    acilis: acilisCumlesi(t.name, a.asistanAdi),
  };
  const aktar: LlmIcerigi = {
    prompt: aktarmaPromptu(t.name),
    araclar: aktarmaAraclari(aktarma),
    acilis: aktarmaAcilisi(t.name),
  };

  try {
    let asilId = a.retellAgentId;
    if (asilId) await ajanGuncelle(asilId, { icerik: asil, ayar });
    else {
      asilId = await ajanOlustur({ ad: `${t.name} — servis hattı`, sesKimligi: env.RETELL_VOICE_ID as string, icerik: asil, ayar });
      await prisma.telefonAjani.update({ where: { tenantId }, data: { retellAgentId: asilId } });
    }
    let aktarId = a.retellAktarmaAgentId;
    if (aktarId) await ajanGuncelle(aktarId, { icerik: aktar, ayar });
    else {
      aktarId = await ajanOlustur({ ad: `${t.name} — aktarma`, sesKimligi: env.RETELL_VOICE_ID as string, icerik: aktar, ayar });
      await prisma.telefonAjani.update({ where: { tenantId }, data: { retellAktarmaAgentId: aktarId } });
    }
    if (s.hatBagla && a.hatNumarasi) await hattiBagla(a.hatNumarasi, { aktarmaAgentId: aktarId, webhookUrl });
    await prisma.telefonAjani.update({ where: { tenantId }, data: { retellSenkronAt: new Date(), retellHata: null } });
    await writeAudit({
      tenantId,
      userId: kim.userId ?? null,
      actorType: kim.actorType,
      actorName: kim.actorName ?? null,
      action: s.hatBagla ? 'TELEFON_AJANI_KURULDU' : 'TELEFON_AJANI_GUNCELLENDI',
      entityType: 'TelefonAjani',
      entityId: tenantId,
      newValue: { asilId, aktarId, hat: Boolean(a.hatNumarasi) },
    });
    return { ok: true, uyarilar: [] };
  } catch (e) {
    // Retell hata metni sırrı yankılarsa ekrana/loga gitmesin.
    const detay = ((e as Error)?.message ?? '').split(sir).join('***').slice(0, 300);
    console.error('[telefon-ajani] Retell kurulumu:', detay);
    await prisma.telefonAjani.update({ where: { tenantId }, data: { retellHata: 'RETELL_HATASI' } }).catch(() => {});
    return { ok: false, kod: 'RETELL_HATASI', detay, uyarilar: [] };
  }
}

/** Bayi asistan adını ya da aktarma numarasını değiştirince var olan ajanları güncelle. */
export function ajaniSenkronla(tenantId: string, kim: Kim): Promise<KurulumSonucu> {
  return ajaniSagla(tenantId, kim, { hatBagla: false, yeniOlustur: false });
}

type AyarHatasi = 'GECERSIZ_TELEFON_NUMARASI';

/**
 * Bayi yöneticisinin ayarı: aç/kapa, asistan adı, aktarma numarası.
 * Aç/kapa Retell'e gitmez: gelen arama ucu her aramada bu satıra bakar,
 * değişiklik ANINDA geçerlidir.
 */
export async function ayarDegistir(
  tenantId: string,
  kullanici: { id: string },
  g: { acik?: unknown; asistanAdi?: unknown; aktarmaTelefonu?: unknown },
): Promise<{ ok: true; senkron: KurulumSonucu | null } | { ok: false; kod: AyarHatasi }> {
  const once = await prisma.telefonAjani.findUnique({ where: { tenantId } });
  const deg: {
    acik?: boolean;
    asistanAdi?: string;
    aktarmaTelefonu?: string | null;
    degistirenId?: string;
    acildiAt?: Date;
    kapandiAt?: Date;
  } = {};
  let retellDegisti = false;

  if (typeof g.acik === 'boolean' && g.acik !== (once?.acik ?? false)) {
    deg.acik = g.acik;
    deg.degistirenId = kullanici.id;
    if (g.acik) deg.acildiAt = new Date();
    else deg.kapandiAt = new Date();
  }
  if (g.asistanAdi !== undefined) {
    const ad = asistanAdiTemizle(g.asistanAdi);
    if (ad !== (once?.asistanAdi ?? 'Deniz')) {
      deg.asistanAdi = ad;
      retellDegisti = true;
    }
  }
  if (g.aktarmaTelefonu !== undefined) {
    const bos = g.aktarmaTelefonu === null || (typeof g.aktarmaTelefonu === 'string' && !g.aktarmaTelefonu.trim());
    const n = bos ? null : e164TR(g.aktarmaTelefonu);
    if (!bos && !n) return { ok: false, kod: 'GECERSIZ_TELEFON_NUMARASI' };
    if (n && once?.hatNumarasi && son10(n) === son10(once.hatNumarasi)) return { ok: false, kod: 'GECERSIZ_TELEFON_NUMARASI' };
    if (n !== (once?.aktarmaTelefonu ?? null)) {
      deg.aktarmaTelefonu = n;
      retellDegisti = true;
    }
  }
  if (!Object.keys(deg).length) return { ok: true, senkron: null };

  await prisma.telefonAjani.upsert({ where: { tenantId }, create: { tenantId, ...deg }, update: deg });
  await writeAudit({
    tenantId,
    userId: kullanici.id,
    action: deg.acik === true ? 'TELEFON_AJANI_ACILDI' : deg.acik === false ? 'TELEFON_AJANI_KAPATILDI' : 'TELEFON_AJANI_AYAR',
    entityType: 'TelefonAjani',
    entityId: tenantId,
    oldValue: once ? { acik: once.acik, asistanAdi: once.asistanAdi, aktarma: Boolean(once.aktarmaTelefonu) } : null,
    newValue: { acik: deg.acik, asistanAdi: deg.asistanAdi, aktarma: deg.aktarmaTelefonu === undefined ? undefined : Boolean(deg.aktarmaTelefonu) },
  });

  const senkron = retellDegisti && once?.retellAgentId ? await ajaniSenkronla(tenantId, { userId: kullanici.id }) : null;
  return { ok: true, senkron };
}

type HatHatasi = 'GECERSIZ_TELEFON_NUMARASI' | 'HAT_BASKA_BAYIDE' | 'BAYI_BULUNAMADI';

/**
 * Süper admin: hat ve aktarma numarası. Hattı YALNIZ platform ekibi atar:
 * Retell hesabı ortak; bayi yöneticisi numara girebilseydi hesaptaki başka
 * bir hattı (başka bayinin ya da başka ürünün) kendi ajanına bağlardı.
 */
export async function hatAyarla(
  tenantId: string,
  g: { hatNumarasi?: unknown; aktarmaTelefonu?: unknown },
): Promise<{ ok: true; uyarilar: string[] } | { ok: false; kod: HatHatasi }> {
  const t = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true } });
  if (!t) return { ok: false, kod: 'BAYI_BULUNAMADI' };
  const once = await prisma.telefonAjani.findUnique({ where: { tenantId } });
  const deg: { hatNumarasi?: string | null; aktarmaTelefonu?: string | null } = {};
  const uyarilar: string[] = [];

  if (g.hatNumarasi !== undefined) {
    const bos = g.hatNumarasi === null || (typeof g.hatNumarasi === 'string' && !g.hatNumarasi.trim());
    const h = bos ? null : hatNumarasiSade(g.hatNumarasi);
    if (!bos && !h) return { ok: false, kod: 'GECERSIZ_TELEFON_NUMARASI' };
    if (h !== (once?.hatNumarasi ?? null)) {
      if (h) {
        const baska = await prisma.telefonAjani.findUnique({ where: { hatNumarasi: h }, select: { tenantId: true } });
        if (baska && baska.tenantId !== tenantId) return { ok: false, kod: 'HAT_BASKA_BAYIDE' };
      }
      deg.hatNumarasi = h;
    }
  }
  if (g.aktarmaTelefonu !== undefined) {
    const bos = g.aktarmaTelefonu === null || (typeof g.aktarmaTelefonu === 'string' && !g.aktarmaTelefonu.trim());
    const n = bos ? null : e164TR(g.aktarmaTelefonu);
    if (!bos && !n) return { ok: false, kod: 'GECERSIZ_TELEFON_NUMARASI' };
    deg.aktarmaTelefonu = n;
  }
  const hat = deg.hatNumarasi !== undefined ? deg.hatNumarasi : once?.hatNumarasi ?? null;
  const aktarma = deg.aktarmaTelefonu !== undefined ? deg.aktarmaTelefonu : once?.aktarmaTelefonu ?? null;
  if (hat && aktarma && son10(hat) === son10(aktarma)) return { ok: false, kod: 'GECERSIZ_TELEFON_NUMARASI' };
  if (!Object.keys(deg).length) return { ok: true, uyarilar };

  try {
    await prisma.telefonAjani.upsert({ where: { tenantId }, create: { tenantId, ...deg }, update: deg });
  } catch (e) {
    if (benzersizHatasi(e)) return { ok: false, kod: 'HAT_BASKA_BAYIDE' };
    throw e;
  }
  // Eski hat artık bu bayinin değil: bağı çözülür (çözülemezse kurulum yine sürer, uyarı düşer).
  if (deg.hatNumarasi !== undefined && once?.hatNumarasi && process.env.RETELL_API_KEY) {
    try {
      await hattiCoz(once.hatNumarasi);
    } catch {
      uyarilar.push('ESKI_HAT_COZULEMEDI');
    }
  }
  return { ok: true, uyarilar };
}

// ─────────────────────────────────────────────────────────────────────────
// SERVİS UYARLAYICISI — ses çekirdeğinin (lib/ses-cekirdek) Servis'e bağlandığı TEK yer
// ─────────────────────────────────────────────────────────────────────────

/**
 * Çekirdek doğrulamayı, kimliği ve kiracı kararını yapar; Servis yalnız
 * bunları verir. Frigora/Klinik kendi uyarlayıcısını yazar, çekirdek aynı kalır.
 */
export const servisSesUyarlayici: SesUyarlayici = {
  kiraciBul: aracKiracisi,
  aracCalistir,
  hataCevabi,
  gelenArama: gelenAramaKarari,
};
