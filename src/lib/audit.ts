/**
 * DENETİM KAYDI — "kim, ne zaman, neyi değiştirdi".
 *
 * Şema (prevHash/hash alanları dahil) daha önce kurulmuştu ama yazan kod yoktu;
 * yani tablo boştu. Bu dosya o boşluğu dolduruyor.
 *
 * ── HASH ZİNCİRİ ─────────────────────────────────────────────────────────
 * Her kayıt, bir öncekinin hash'ini içerir. Böylece geçmişteki bir satır
 * sonradan değiştirilirse ya da silinirse zincir kırılır ve bu TESPİT EDİLEBİLİR.
 * Kurumsal denetimde sorulan "kayıtlarınız sonradan düzenlenebilir mi" sorusunun
 * cevabı budur: düzenlenebilir ama gizlenemez.
 *
 * ── DENETİM İŞ AKIŞINI DURDURMAZ ─────────────────────────────────────────
 * writeAudit HİÇBİR ZAMAN hata fırlatmaz. Denetim kaydı yazılamadı diye bir
 * fatura kesilememesi ya da fiş kapanamaması kabul edilemez; kayıt kaybı
 * loglanır, işlem devam eder.
 *
 * ── BİLİNEN SINIR ────────────────────────────────────────────────────────
 * Zincir kiracı bazındadır ve prevHash okuması ile yazma arasında dar bir
 * yarış penceresi vardır: tam aynı anda iki kayıt yazılırsa ikisi de aynı
 * prevHash'i alabilir. Bu, doğrulamada "dallanma" olarak görünür — veri kaybı
 * değildir. Tek sunucu ve bu iş hacminde pratikte gerçekleşmesi çok düşük;
 * kesin çözüm kiracı bazlı kilit gerektirir ve şu ölçekte gereksizdir.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export type ActorType = 'USER' | 'SUPER_ADMIN' | 'SYSTEM';

export interface AuditInput {
  tenantId: string;
  action: string;        // BÜYÜK_HARF_ALTÇİZGİ — ör. FIYAT_TOPLU_GUNCELLENDI
  entityType: string;    // ör. 'Device', 'Tenant', 'CustomerInvoice'
  entityId: string;
  userId?: string | null;
  oldValue?: unknown;    // JSON'a çevrilir
  newValue?: unknown;
  ipAddress?: string | null;
  actorType?: ActorType;
  actorName?: string | null;
}

/** Alan sırasından bağımsız, kararlı JSON — hash'in tekrar üretilebilir olması için. */
function canonical(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = (x: any): any =>
    Array.isArray(x) ? x.map(s)
      : x && typeof x === 'object'
        ? Object.keys(x).sort().reduce((o: any, k) => { o[k] = s(x[k]); return o; }, {})
        : x;
  try { return JSON.stringify(s(v)); } catch { return String(v); }
}

const kirp = (s: unknown, n = 4000): string | null => {
  const t = canonical(s);
  return t ? t.slice(0, n) : null;
};

/**
 * Denetim kaydı yaz. Hata fırlatmaz.
 * @returns yazılan kaydın id'si, yazılamadıysa null
 */
export async function writeAudit(input: AuditInput): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const onceki = await tx.auditLog.findFirst({
        where: { tenantId: input.tenantId },
        orderBy: { createdAt: 'desc' },
        select: { hash: true },
      });
      const prevHash = onceki?.hash ?? null;

      const oldValue = kirp(input.oldValue);
      const newValue = kirp(input.newValue);

      // Hash'e giren alanlar SABİT sırada; doğrulama tarafı da aynısını üretir.
      const govde = [
        input.tenantId, input.userId ?? '', input.action, input.entityType, input.entityId,
        oldValue ?? '', newValue ?? '', input.actorType ?? 'USER', input.actorName ?? '',
        prevHash ?? '',
      ].join('|');
      const hash = crypto.createHash('sha256').update(govde, 'utf8').digest('hex');

      const kayit = await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValue, newValue,
          ipAddress: input.ipAddress ?? null,
          actorType: input.actorType ?? 'USER',
          actorName: input.actorName ?? null,
          prevHash, hash,
        },
        select: { id: true },
      });
      return kayit.id;
    });
  } catch (e: any) {
    // Denetim kaydı iş akışını DURDURMAZ — sadece kaybı bildir.
    console.error('[audit] kayıt yazılamadı:', input.action, e?.message);
    return null;
  }
}

export interface ZincirSonuc {
  saglam: boolean;
  incelenen: number;
  ilkBozukId?: string;
  sebep?: string;
}

/**
 * Zinciri doğrula — "kayıtlar sonradan değiştirilmiş mi?"
 * Denetçiye gösterilecek cevap budur.
 */
export async function verifyAuditChain(tenantId: string, limit = 5000): Promise<ZincirSonuc> {
  const kayitlar = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let beklenenPrev: string | null = null;
  for (const k of kayitlar) {
    if ((k.prevHash ?? null) !== beklenenPrev) {
      return { saglam: false, incelenen: kayitlar.length, ilkBozukId: k.id, sebep: 'Zincir kopuk — araya kayıt eklenmiş ya da silinmiş olabilir' };
    }
    const govde = [
      k.tenantId, k.userId ?? '', k.action, k.entityType, k.entityId,
      k.oldValue ?? '', k.newValue ?? '', k.actorType ?? 'USER', k.actorName ?? '',
      k.prevHash ?? '',
    ].join('|');
    const beklenen = crypto.createHash('sha256').update(govde, 'utf8').digest('hex');
    if (beklenen !== k.hash) {
      return { saglam: false, incelenen: kayitlar.length, ilkBozukId: k.id, sebep: 'Kayıt içeriği hash ile uyuşmuyor — satır sonradan değiştirilmiş' };
    }
    beklenenPrev = k.hash;
  }
  return { saglam: true, incelenen: kayitlar.length };
}

/** İstekten IP çıkar (ters vekil arkasında X-Forwarded-For ilk değeri). */
export function istekIp(req: { headers: { get(n: string): string | null } }): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 60);
  return req.headers.get('x-real-ip')?.slice(0, 60) ?? null;
}
