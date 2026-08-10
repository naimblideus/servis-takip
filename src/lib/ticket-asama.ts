/**
 * SERVİS FİŞİ AŞAMA TAKİBİ
 *
 * Müşterinin görmek istediği şey "durum: IN_SERVICE" değil, işin nerede
 * olduğu ve oraya ne zaman geldiği. Bu dosya iki şeyi yapar:
 *   1. Her durum geçişini geçmişe yazar (kaydetAsama)
 *   2. Geçmişi gösterilebilir bir çizelgeye çevirir (zamanCizelgesi)
 *
 * ── ANA HAT ve YAN DURUMLAR ──────────────────────────────────────────────
 * Fişin ana hattı dört adım: Alındı → Serviste → Hazır → Teslim edildi.
 * "Parça bekleniyor" bir adım DEĞİL, servis sırasında girilen bir yan
 * durumdur — ayrı adım yapılsaydı çizelge parça beklemeyen fişlerde hep
 * eksik görünürdü. İptal ise hattan çıkıştır, çizelgenin yerine geçer.
 *
 * ── GEÇMİŞİ OLMAYAN FİŞ ──────────────────────────────────────────────────
 * zamanCizelgesi geçmiş boş gelirse ÇÖKMEZ; fişin kendi createdAt ve
 * statusUpdatedAt alanlarından iki noktalı bir çizelge türetir ve bunu
 * "türetilmiş" olarak işaretler. Bu bilerek bir emniyet ağı: ileride bir
 * yazma yolu atlanırsa müşteri boş ekran görmez.
 */
import { prisma } from '@/lib/prisma';
import type { TicketStatus } from '@prisma/client';

export type AsamaKaynak = 'PANEL' | 'PORTAL' | 'SISTEM' | 'GECMIS';

/** Ana hat — müşteriye çizelge olarak bu sırayla gösterilir. */
export const ANA_HAT: TicketStatus[] = ['NEW', 'IN_SERVICE', 'READY', 'DELIVERED'];

export const ASAMA_ETIKET: Record<TicketStatus, string> = {
  NEW: 'Talebiniz alındı',
  IN_SERVICE: 'Serviste — işlem yapılıyor',
  WAITING_FOR_PART: 'Parça bekleniyor',
  READY: 'Hazır',
  DELIVERED: 'Teslim edildi',
  CANCELLED: 'İptal edildi',
};

/** Bayi tarafında daha kısa etiket (tablo/satır içinde) */
export const ASAMA_KISA: Record<TicketStatus, string> = {
  NEW: 'Alındı',
  IN_SERVICE: 'Serviste',
  WAITING_FOR_PART: 'Parça bekliyor',
  READY: 'Hazır',
  DELIVERED: 'Teslim edildi',
  CANCELLED: 'İptal',
};

/** Yan durum: ana hatta kendi adımı yoktur, "Serviste" adımının üstüne biner. */
export const YAN_DURUM: TicketStatus[] = ['WAITING_FOR_PART'];

/**
 * Aşama geçişini kaydet. HİÇBİR ZAMAN hata fırlatmaz — geçmiş yazılamadı diye
 * fişin durumu değişememesi kabul edilemez (denetim kaydıyla aynı ilke).
 */
export async function kaydetAsama(input: {
  tenantId: string;
  ticketId: string;
  status: TicketStatus;
  oncekiStatus?: TicketStatus | null;
  changedByUserId?: string | null;
  kaynak?: AsamaKaynak;
  notu?: string | null;
}): Promise<void> {
  try {
    await prisma.ticketStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        status: input.status,
        oncekiStatus: input.oncekiStatus ?? null,
        changedByUserId: input.changedByUserId ?? null,
        kaynak: input.kaynak ?? 'PANEL',
        notu: input.notu ?? null,
      },
    });
  } catch (e: any) {
    console.error('[asama] kayıt yazılamadı:', input.ticketId, input.status, e?.message);
  }
}

export interface AsamaSatiri {
  status: TicketStatus;
  etiket: string;
  /** Bu adıma geçildi mi */
  tamam: boolean;
  /** Fişin ŞU ANKİ adımı mı */
  suan: boolean;
  /** Geçiş anı — geçilmediyse null */
  zaman: string | null;
}

export interface ZamanCizelgesi {
  /** Ana hat adımları, sırayla */
  adimlar: AsamaSatiri[];
  /** Fiş şu an yan bir durumdaysa (ör. parça bekleniyor) etiketi */
  yanDurum: string | null;
  /** İptal edildiyse çizelge yerine bu gösterilir */
  iptal: { zaman: string | null } | null;
  /** Geçmiş kaydı yoktu, fişin kendi tarihlerinden türetildi */
  turetilmis: boolean;
  /** Devredilen (GECMIS) satır içeriyor → ara aşamalar bilinmiyor */
  araAsamalarEksik: boolean;
}

interface GecmisSatir {
  status: TicketStatus;
  changedAt: Date;
  kaynak: string;
}

/**
 * Geçmişi gösterilebilir çizelgeye çevir.
 *
 * @param fis     fişin şu anki durumu ve tarihleri (geçmiş boşsa gerekli)
 * @param gecmis  changedAt'e göre ARTAN sıralı geçmiş satırları
 */
export function zamanCizelgesi(
  fis: { status: TicketStatus; createdAt: Date; statusUpdatedAt: Date },
  gecmis: GecmisSatir[],
): ZamanCizelgesi {
  let turetilmis = false;
  let satirlar = gecmis;

  // EMNİYET AĞI: geçmiş yoksa fişin kendi tarihlerinden iki nokta üret.
  // Uydurma yok — iki tarih de gerçek; yalnız arası bilinmiyor.
  if (satirlar.length === 0) {
    turetilmis = true;
    satirlar = [{ status: 'NEW', changedAt: fis.createdAt, kaynak: 'GECMIS' }];
    if (fis.status !== 'NEW' && fis.statusUpdatedAt > fis.createdAt) {
      satirlar.push({ status: fis.status, changedAt: fis.statusUpdatedAt, kaynak: 'GECMIS' });
    }
  }

  const araAsamalarEksik = turetilmis || satirlar.some((s) => s.kaynak === 'GECMIS');

  if (fis.status === 'CANCELLED') {
    const iptalSatir = [...satirlar].reverse().find((s) => s.status === 'CANCELLED');
    return {
      adimlar: [], yanDurum: null, turetilmis, araAsamalarEksik,
      iptal: { zaman: (iptalSatir?.changedAt ?? fis.statusUpdatedAt).toISOString() },
    };
  }

  // Her ana-hat adımına İLK geçiş anı (aynı adıma geri dönülürse ilki kalır:
  // "ne zaman ulaştı" sorusunun cevabı ilk varıştır)
  const ilkGecis = new Map<TicketStatus, Date>();
  for (const s of satirlar) {
    if (!ilkGecis.has(s.status)) ilkGecis.set(s.status, s.changedAt);
  }

  // Şu anki adım: yan durumdaysa ana hattaki karşılığı IN_SERVICE
  const suankiAdim: TicketStatus = YAN_DURUM.includes(fis.status) ? 'IN_SERVICE' : fis.status;
  const suankiIndex = ANA_HAT.indexOf(suankiAdim);

  const adimlar: AsamaSatiri[] = ANA_HAT.map((st, i) => {
    const zaman = ilkGecis.get(st) ?? null;
    // Sonraki adıma geçilmişse aradaki adım da tamamlanmış sayılır — geçmişte
    // o satır olmasa bile (atlanan/kaydedilmemiş geçiş). Aksi halde çizelge
    // "Hazır" görünürken "Serviste" boş kalır ve müşteri karışır.
    const tamam = suankiIndex >= 0 && i <= suankiIndex;
    return {
      status: st,
      etiket: ASAMA_ETIKET[st],
      tamam,
      suan: i === suankiIndex,
      // Zaman YALNIZCA ulaşılmış adımda gösterilir. Fiş geri alınmışsa
      // (ör. "Hazır"dan tekrar "Parça bekleniyor"a) o adımın eski tarihi
      // hâlâ kayıtta durur ama müşteriye gösterilirse "hazır" sanır.
      // Kayıt silinmiyor, sadece gösterilmiyor.
      zaman: tamam && zaman ? zaman.toISOString() : null,
    };
  });

  return {
    adimlar,
    yanDurum: YAN_DURUM.includes(fis.status) ? ASAMA_ETIKET[fis.status] : null,
    iptal: null,
    turetilmis,
    araAsamalarEksik,
  };
}
