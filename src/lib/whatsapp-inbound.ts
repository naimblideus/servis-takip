/**
 * WhatsApp Cloud API — GELEN mesaj katmanı.
 *
 * Bayinin WhatsApp Business uygulaması aynen çalışmaya devam eder (Meta Coexistence,
 * Mayıs 2025). Burası ikinci bir gelen kutusu değil; amacı gelen numarayı sistemdeki
 * müşteriyle eşleştirip bayiye bağlam vermek.
 */
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { waHataMetni } from '@/lib/whatsapp-graph';

/** Webhook'un herkese açık olduğu unutulmasın: imza doğrulanmadan HİÇBİR ŞEY yazılmaz. */
export function metaSignatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  // FAIL-CLOSED: sır tanımlı değilse doğrulama yapılamaz → kabul de edilmez.
  if (!secret || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  // Uzunluk farklıysa timingSafeEqual atar; önce uzunluk kontrolü şart.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface InboundMessage {
  waMessageId: string;
  fromPhone: string;      // E.164, ör. 905321234567
  contactName?: string;
  text?: string;
  mediaId?: string;
  mediaType?: string;
  receivedAt: Date;
  phoneNumberId: string;  // hangi işletme numarasına geldi → hangi bayi
}

/**
 * Meta webhook gövdesini düz mesaj listesine çevir.
 * Bilinmeyen/desteklenmeyen tipler atlanır — bozuk payload sistemi düşürmemeli.
 */
export function parseWebhook(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId || !Array.isArray(value?.messages)) continue;

      // contacts[] profil adını taşır — yeni müşteri eklerken ön-doldurmak için
      const names = new Map<string, string>();
      for (const c of value?.contacts ?? []) {
        if (c?.wa_id && c?.profile?.name) names.set(c.wa_id, c.profile.name);
      }

      for (const m of value.messages) {
        if (!m?.id || !m?.from) continue;
        // Tepki (👍) ve sistem bildirimi (numara değişti) gelen kutusuna iş değil.
        if (m.type === 'reaction' || m.type === 'system') continue;
        const media = m.image || m.document || m.audio || m.video || m.sticker || null;
        out.push({
          waMessageId: m.id,
          fromPhone: String(m.from).replace(/\D/g, ''),
          contactName: names.get(m.from),
          text: mesajMetni(m, media),
          mediaId: media?.id ?? undefined,
          mediaType: media ? m.type : undefined,
          receivedAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
          phoneNumberId,
        });
      }
    }
  }
  return out;
}

/**
 * Mesajın gelen kutusunda okunacak metni. Yalnız text.body okunuyordu: şablonun
 * hızlı cevap düğmesine basan, konum ya da kişi kartı gönderen müşterinin mesajı
 * gelen kutusuna boş düşüyordu.
 */
function mesajMetni(m: any, media: any): string | undefined {
  if (m.text?.body) return m.text.body;
  if (media?.caption) return media.caption;
  if (m.button?.text) return m.button.text;                       // şablondaki hızlı cevap düğmesi
  const ic = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
  if (ic) return ic;
  if (m.location) {
    const l = m.location;
    const ad = [l.name, l.address].filter(Boolean).join(' · ');
    return `📍 ${ad ? `${ad} ` : ''}(${l.latitude}, ${l.longitude})`;
  }
  if (Array.isArray(m.contacts) && m.contacts.length) {
    const k = m.contacts[0];
    return `👤 ${k?.name?.formatted_name ?? ''} ${k?.phones?.[0]?.phone ?? ''}`.trim();
  }
  return undefined;
}

// ── DURUM BİLDİRİMİ ── Meta, giden mesaj için sonradan "gönderildi → teslim
// edildi → okundu" ya da "iletilemedi" bildirir. Mesaj kimliği (wamid) gönderim
// anında kaydedilir (NotificationLog / WhatsAppMessage GIDEN); burada eşleşir.
export interface DurumBildirimi {
  waMessageId: string;
  durum: 'sent' | 'delivered' | 'read' | 'failed';
  zaman: Date;
  hataKodu: number | null;
  hata: string | null;
}

export function parseStatuses(body: any): DurumBildirimi[] {
  const out: DurumBildirimi[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const s of change?.value?.statuses ?? []) {
        if (!s?.id || !['sent', 'delivered', 'read', 'failed'].includes(s?.status)) continue;
        const e = Array.isArray(s.errors) ? s.errors[0] : null;
        out.push({
          waMessageId: String(s.id),
          durum: s.status,
          zaman: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
          hataKodu: typeof e?.code === 'number' ? e.code : null,
          hata: e ? waHataMetni(e.code, e?.error_data?.details || e?.message || e?.title) : null,
        });
      }
    }
  }
  return out;
}

const SIRA: Record<string, number> = { gonderildi: 1, teslim: 2, okundu: 3 };

/**
 * Durumu gönderim kaydına işle. Bildirimler sırasız gelebilir (okundu, teslimden
 * önce): durum geriye gitmez. "İletilemedi" her zaman yazılır.
 */
export async function durumIsle(d: DurumBildirimi): Promise<void> {
  if (d.durum === 'failed') {
    await prisma.notificationLog.updateMany({ where: { waMessageId: d.waMessageId }, data: { status: 'FAILED', error: d.hata ?? 'İletilemedi' } });
    await prisma.whatsAppMessage.updateMany({ where: { waMessageId: d.waMessageId, yon: 'GIDEN' }, data: { durum: 'hata', hata: d.hata ?? 'İletilemedi' } });
    return;
  }
  if (d.durum === 'delivered') {
    await prisma.notificationLog.updateMany({ where: { waMessageId: d.waMessageId, teslimAt: null }, data: { teslimAt: d.zaman } });
  }
  if (d.durum === 'read') {
    await prisma.notificationLog.updateMany({ where: { waMessageId: d.waMessageId, okunduAt: null }, data: { okunduAt: d.zaman } });
    await prisma.notificationLog.updateMany({ where: { waMessageId: d.waMessageId, teslimAt: null }, data: { teslimAt: d.zaman } });
  }
  const yeni = d.durum === 'read' ? 'okundu' : d.durum === 'delivered' ? 'teslim' : 'gonderildi';
  const giden = await prisma.whatsAppMessage.findFirst({ where: { waMessageId: d.waMessageId, yon: 'GIDEN' }, select: { id: true, durum: true } });
  if (giden && giden.durum !== 'hata' && (SIRA[giden.durum ?? ''] ?? 0) < SIRA[yeni]) {
    await prisma.whatsAppMessage.update({ where: { id: giden.id }, data: { durum: yeni } });
  }
}

/**
 * "DUR" / "BAŞLA" — müşteri hatırlatma şablonlarını kendisi kapatıp açar.
 * Yalnız mesajın TAMAMI komutsa (noktalama hariç): "makine durdu" ya da
 * "istemiyorum ama..." komut değildir. Türkçe büyük/küçük harf: tr-TR.
 */
const DUR_KELIMELERI = new Set(['dur', 'durdur', 'stop', 'istemiyorum', 'mesaj istemiyorum', 'hatirlatma istemiyorum', 'hatırlatma istemiyorum', 'abonelikten cik', 'abonelikten çık']);
const BASLA_KELIMELERI = new Set(['başla', 'basla', 'start', 'devam']);
export function retKomutu(metin?: string | null): 'DUR' | 'BASLA' | null {
  if (!metin) return null;
  const t = metin.toLocaleLowerCase('tr-TR').replace(/[.!?,;:'"’“”]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (DUR_KELIMELERI.has(t)) return 'DUR';
  if (BASLA_KELIMELERI.has(t)) return 'BASLA';
  return null;
}

/** Telefonun son 10 hanesi (ülke kodu ve biçim farkı eşleşmeyi bozmasın). */
export const son10 = (telefon: string | null | undefined) => (telefon ?? '').replace(/[^0-9]/g, '').slice(-10);

/**
 * Bu numara hangi bayilerin? Servis müşterisi olarak kayıtlı olduğu bayiler +
 * son 30 günde bu numaraya WhatsApp GÖNDERMİŞ bayiler (mağaza alıcısı servis
 * müşterisi değil ama cevabı ona yazdığı bayiye gitmeli). Demo/kapalı/silinmiş yok.
 */
export async function numaraninBayileri(last10: string): Promise<{ id: string; name: string }[]> {
  if (last10.length < 10) return [];
  const otuzGun = new Date(Date.now() - 30 * 86_400_000);
  return prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT DISTINCT t."id", t."name" FROM "Tenant" t
    WHERE t."demo" = false AND t."isActive" = true AND t."deletedAt" IS NULL AND (
      EXISTS (SELECT 1 FROM "Customer" c WHERE c."tenantId" = t."id"
              AND right(regexp_replace(c."phone", '[^0-9]', '', 'g'), 10) = ${last10})
      OR EXISTS (SELECT 1 FROM "NotificationLog" n WHERE n."tenantId" = t."id"
              AND n."channel" = 'WHATSAPP' AND n."status" = 'SENT' AND n."createdAt" >= ${otuzGun}
              AND right(regexp_replace(n."recipient", '[^0-9]', '', 'g'), 10) = ${last10})
    )
  `;
}

/**
 * RET LİSTESİ — müşteri "DUR" yazdı. Paylaşımlı numarada hangi bayiyi kastettiği
 * belli değilse bu numaraya mesaj atabilecek BÜTÜN bayilerden durdurulur: istemeyen
 * kişiye bir bayinin bile yazmaya devam etmesi şikâyet = numaranın kalitesi herkes için düşer.
 */
export async function retUygula(tenantIds: string[], telefon: string, komut: 'DUR' | 'BASLA'): Promise<void> {
  const s10 = son10(telefon);
  if (s10.length < 10 || !tenantIds.length) return;
  if (komut === 'BASLA') {
    await prisma.whatsAppRet.deleteMany({ where: { tenantId: { in: tenantIds }, son10: s10 } });
    return;
  }
  for (const tenantId of tenantIds) {
    await prisma.whatsAppRet.upsert({ where: { tenantId_son10: { tenantId, son10: s10 } }, create: { tenantId, son10: s10 }, update: {} });
  }
}

/** Bayinin ret listesi (toplu gönderimde tek sorgu). */
export async function retListesi(tenantId: string): Promise<Set<string>> {
  const l = await prisma.whatsAppRet.findMany({ where: { tenantId }, select: { son10: true } });
  return new Set(l.map((r) => r.son10));
}

/** Tek numara için: bu bayiden WhatsApp hatırlatması almak istemiyor mu. */
export async function retliMi(tenantId: string, telefon: string | null | undefined): Promise<boolean> {
  const s10 = son10(telefon);
  if (s10.length < 10) return false;
  return Boolean(await prisma.whatsAppRet.findUnique({ where: { tenantId_son10: { tenantId, son10: s10 } }, select: { id: true } }));
}

/**
 * Numarayı bu bayinin müşterileriyle eşleştir.
 *
 * Telefonlar sistemde tek biçimde durmuyor ("0532 123 45 67", "+905321234567",
 * "5321234567" hepsi var). O yüzden iki tarafta da rakam-dışı karakterler atılıp
 * SON 10 HANE karşılaştırılır — ülke kodu olsa da olmasa da eşleşir.
 */
export async function findCustomerByPhone(
  tenantId: string,
  e164Digits: string,
): Promise<{ id: string; name: string } | null> {
  const last10 = e164Digits.slice(-10);
  if (last10.length < 10) return null;
  const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "Customer"
    WHERE "tenantId" = ${tenantId}
      AND right(regexp_replace("phone", '[^0-9]', '', 'g'), 10) = ${last10}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** phone_number_id → bayi. Eşleşmezse mesaj yok sayılır (başka bir hesabın trafiği). */
export async function findTenantByPhoneNumberId(phoneNumberId: string) {
  return prisma.tenant.findFirst({
    where: { whatsappPhoneId: phoneNumberId },
    select: { id: true, name: true }, // name: otomatik cevabın altındaki imza için
  });
}

/** Platformun paylaşımlı WhatsApp numarası kurulu mu (giden + gelen). */
export function paylasimliWhatsappAcik(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/**
 * PAYLAŞIMLI NUMARA — gelen mesaj hangi bayinin?
 *
 * Bayilerin kendi numarasını bağlamadığı sürece hatırlatmalar platformun TEK
 * numarasından gider (WHATSAPP_PHONE_ID) ve müşterinin cevabı oraya gelir.
 * Bayi, gönderen numaranın hangi bayinin MÜŞTERİSİ olduğundan bulunur:
 *   · tek bayide kayıtlıysa o bayi;
 *   · birden çok bayide kayıtlıysa bu numaraya EN SON WhatsApp GÖNDEREN bayi
 *     (müşteri büyük olasılıkla ona cevap veriyor);
 *   · hiçbir bayide yoksa ya da karar verilemiyorsa NULL — mesaj hiçbir
 *     bayiye düşmez. Yanlış bayiye düşmek, bir bayinin müşterisinin mesajını
 *     başka bayiye göstermek olurdu.
 * Demo, kapalı ve silinmiş bayiler sayılmaz. Bayinin KENDİ numarası tanımlıysa
 * bu fonksiyona hiç gelinmez (findTenantByPhoneNumberId önce bakar).
 */
export async function paylasimliNumaraBayisi(
  phoneNumberId: string,
  e164Digits: string,
): Promise<{ id: string; name: string } | null> {
  const platform = process.env.WHATSAPP_PHONE_ID;
  if (!platform || phoneNumberId !== platform) return null;
  const last10 = e164Digits.slice(-10);
  if (last10.length < 10) return null;
  const adaylar = await numaraninBayileri(last10);
  if (adaylar.length <= 1) return adaylar[0] ?? null;
  const son = await prisma.$queryRaw<{ tenantId: string }[]>`
    SELECT "tenantId" FROM "NotificationLog"
    WHERE "channel" = 'WHATSAPP' AND "status" = 'SENT'
      AND "tenantId" IN (${Prisma.join(adaylar.map((a) => a.id))})
      AND right(regexp_replace("recipient", '[^0-9]', '', 'g'), 10) = ${last10}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return son.length ? adaylar.find((a) => a.id === son[0].tenantId) ?? null : null;
}
