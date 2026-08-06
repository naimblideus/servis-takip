/**
 * WhatsApp Cloud API — GELEN mesaj katmanı.
 *
 * Bayinin WhatsApp Business uygulaması aynen çalışmaya devam eder (Meta Coexistence,
 * Mayıs 2025). Burası ikinci bir gelen kutusu değil; amacı gelen numarayı sistemdeki
 * müşteriyle eşleştirip bayiye bağlam vermek.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

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
        const media = m.image || m.document || m.audio || m.video || null;
        out.push({
          waMessageId: m.id,
          fromPhone: String(m.from).replace(/\D/g, ''),
          contactName: names.get(m.from),
          // Metin dışı tiplerde caption varsa onu al; yoksa boş bırak.
          text: m.text?.body ?? media?.caption ?? undefined,
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
      AND right(regexp_replace("phone", '\D', '', 'g'), 10) = ${last10}
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
