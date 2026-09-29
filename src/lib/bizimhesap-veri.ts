// BİZİM HESAP AKTARIMI — veritabanı ve ağ katmanı.
//
// Kural: bir fatura Bizim Hesap'a BİR KEZ gider. Gönderim başlamadan önce
// fatura atomik olarak "GONDERILIYOR" diye işaretlenir; aynı anda gelen
// ikinci istek işareti alamaz ve hiç istek atmaz. Takılı kalan işaret
// (sunucu gönderim ortasında düştüyse) 10 dakika sonra tekrar alınabilir.
//
// Cevap gelmeden süre dolduysa fatura Bizim Hesap'ta OLUŞMUŞ olabilir.
// Bu durumda sessizce tekrar denenmez: hata "ZAMAN_ASIMI" yazılır ve ekran
// bayiye önce Bizim Hesap'ta bakmasını söyler. Tekrar göndermek bayinin
// kararıdır.

import { prisma } from '@/lib/prisma';
import { sirla, sirCoz, sirMaskesi, sirAnahtariVarMi } from '@/lib/sir';
import { BIZIMHESAP_KOK, bizimHesapFaturasi, cevapHatasi } from '@/lib/bizimhesap';

const kok = () => (process.env.BIZIMHESAP_API_URL || BIZIMHESAP_KOK).replace(/\/+$/, '');
const KILIT_SURESI_MS = 10 * 60_000;
// Test sahte sunucuyla zaman aşımını kısa tutabilsin diye ortamdan okunabilir.
const istekSuresi = () => Number(process.env.BIZIMHESAP_ZAMAN_ASIMI_MS) || 20_000;

/** Bizim Hesap'ın verdiği FirmID: harf/rakam (örnekte 32 onaltılık karakter). */
export function firmIdGecerli(v: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(v.trim());
}

async function firmIdOku(tenantId: string): Promise<string | null> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { bizimHesapFirmId: true } });
  return sirCoz(t?.bizimHesapFirmId);
}

export async function ayarDurumu(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { bizimHesapFirmId: true } });
  const cozulen = sirCoz(t?.bizimHesapFirmId);
  return {
    kurulu: !!t?.bizimHesapFirmId,
    // FirmID'nin kendisi DEĞİL, yalnız maskesi — ekrana düşen anahtar
    // tarayıcı geçmişine ve ekran görüntüsüne girer.
    maske: sirMaskesi(cozulen),
    okunamiyor: !!t?.bizimHesapFirmId && cozulen === null,
    anahtarVar: sirAnahtariVarMi(),
  };
}

/** FirmID kaydet (null → bağlantıyı kaldır). Şifreleme anahtarı yoksa SirAnahtariYok fırlatır. */
export async function ayarKaydet(tenantId: string, firmId: string | null) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { bizimHesapFirmId: firmId ? sirla(firmId.trim()) : null },
  });
}

type HttpSonucu = { ok: true; govde: Record<string, unknown> } | { ok: false; hata: string; belirsiz: boolean };

async function istek(yol: string, firmId: string, govde?: unknown): Promise<HttpSonucu> {
  let res: Response;
  try {
    res = await fetch(`${kok()}${yol}`, {
      method: govde === undefined ? 'GET' : 'POST',
      headers: { token: firmId, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: govde === undefined ? undefined : JSON.stringify(govde),
      signal: AbortSignal.timeout(istekSuresi()),
    });
  } catch (e) {
    // İstek gitmiş ama cevap gelmemiş olabilir (süre doldu): belirsiz.
    const zaman = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
    return { ok: false, hata: zaman ? 'ZAMAN_ASIMI' : 'BAGLANTI', belirsiz: zaman };
  }
  const metin = await res.text().catch(() => '');
  let json: Record<string, unknown> | null = null;
  try { json = metin ? JSON.parse(metin) : null; } catch { json = null; }
  const hata = cevapHatasi(json);
  // Gerçek sunucu tanımadığı FirmID'ye 401 + { Message: "Authorization has
  // been denied for this request." } dönüyor (2026-09-29 denendi). Bayiye
  // İngilizce yetki cümlesi yerine ne yapacağını söyleyen kod gidiyor.
  if (res.status === 401 || /authorization has been denied|token is invalid/i.test(hata)) return { ok: false, hata: 'YETKI_YOK', belirsiz: false };
  if (hata) return { ok: false, hata: hata.slice(0, 500), belirsiz: false };
  if (!res.ok || !json) return { ok: false, hata: `HTTP ${res.status}`, belirsiz: false };
  return { ok: true, govde: json };
}

/** Bağlantıyı fatura yazmadan dener: müşteri listesini okur. */
export async function baglantiDene(firmId: string): Promise<{ ok: true; musteriSayisi: number | null } | { ok: false; hata: string }> {
  const r = await istek('/customers', firmId.trim());
  if (!r.ok) return { ok: false, hata: r.hata };
  const veri = (r.govde.data as Record<string, unknown> | undefined)?.customers ?? r.govde.customers;
  return { ok: true, musteriSayisi: Array.isArray(veri) ? veri.length : null };
}

/** Dönemin faturaları ve Bizim Hesap durumları. */
export async function faturaListesi(tenantId: string, donem: string) {
  const [faturalar, donemler] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { tenantId, period: donem, deletedAt: null, status: { not: 'DRAFT' } },
      orderBy: { invoiceNumber: 'asc' },
      select: {
        id: true, invoiceNumber: true, gibNo: true, period: true, invoiceDate: true, status: true, totalAmount: true,
        bizimHesapDurum: true, bizimHesapUrl: true, bizimHesapAt: true, bizimHesapHata: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.customerInvoice.groupBy({
      by: ['period'],
      where: { tenantId, deletedAt: null, status: { not: 'DRAFT' } },
      orderBy: { period: 'desc' },
      take: 24,
    }),
  ]);
  return {
    donemler: donemler.map((d) => d.period),
    faturalar: faturalar.map((f) => ({
      id: f.id, no: f.invoiceNumber, gibNo: f.gibNo, donem: f.period, tarih: f.invoiceDate.toISOString(),
      durum: f.status, tutar: Number(f.totalAmount), musteriId: f.customer.id, musteri: f.customer.name,
      bhDurum: f.bizimHesapDurum, bhUrl: f.bizimHesapUrl, bhAt: f.bizimHesapAt?.toISOString() ?? null, bhHata: f.bizimHesapHata,
    })),
  };
}

export type GonderimSonucu = {
  id: string;
  durum: 'GONDERILDI' | 'ZATEN' | 'HATA' | 'AYAR_YOK' | 'YOK' | 'GONDERILEMEZ';
  hata?: string;
  url?: string | null;
};

/** Tek faturayı gönderir. Aynı faturaya eşzamanlı ikinci çağrı "ZATEN" döner, istek atmaz. */
export async function faturaGonder(tenantId: string, invoiceId: string): Promise<GonderimSonucu> {
  const firmId = await firmIdOku(tenantId);
  if (!firmId) return { id: invoiceId, durum: 'AYAR_YOK' };

  const f = await prisma.customerInvoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    select: {
      id: true, invoiceNumber: true, gibNo: true, period: true, invoiceDate: true, dueDate: true, status: true,
      vatRate: true, subtotal: true, vatAmount: true, totalAmount: true, notes: true,
      lines: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, description: true, quantity: true, unitPrice: true, lineTotal: true, vatRate: true, partId: true } },
      customer: { select: { id: true, name: true, legalName: true, address: true, district: true, city: true, taxOffice: true, taxNo: true, email: true, phone: true } },
    },
  });
  if (!f) return { id: invoiceId, durum: 'YOK' };
  if (f.status === 'DRAFT' || f.status === 'CANCELLED') return { id: invoiceId, durum: 'GONDERILEMEZ' };

  const esleme = bizimHesapFaturasi({
    firmId,
    fatura: {
      invoiceNumber: f.invoiceNumber, gibNo: f.gibNo, period: f.period, invoiceDate: f.invoiceDate, dueDate: f.dueDate,
      vatRate: Number(f.vatRate), subtotal: Number(f.subtotal), vatAmount: Number(f.vatAmount), totalAmount: Number(f.totalAmount), notes: f.notes,
    },
    musteri: f.customer,
    kalemler: f.lines.map((l) => ({
      id: l.id, kind: l.kind, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal), vatRate: l.vatRate === null ? null : Number(l.vatRate), partId: l.partId,
    })),
  });

  // KİLİT: yalnız gönderilmemiş, hata almış ya da takılı kalmış fatura alınabilir.
  const simdi = new Date();
  const alindi = await prisma.customerInvoice.updateMany({
    where: {
      id: f.id, tenantId,
      OR: [
        { bizimHesapDurum: null },
        { bizimHesapDurum: 'HATA' },
        { bizimHesapDurum: 'GONDERILIYOR', bizimHesapAt: { lt: new Date(simdi.getTime() - KILIT_SURESI_MS) } },
      ],
    },
    data: { bizimHesapDurum: 'GONDERILIYOR', bizimHesapAt: simdi, bizimHesapHata: null },
  });
  if (alindi.count === 0) return { id: f.id, durum: 'ZATEN' };

  const hataYaz = async (hata: string): Promise<GonderimSonucu> => {
    await prisma.customerInvoice.update({ where: { id: f.id }, data: { bizimHesapDurum: 'HATA', bizimHesapHata: hata, bizimHesapAt: new Date() } });
    return { id: f.id, durum: 'HATA', hata };
  };

  if (!esleme.ok) return hataYaz(esleme.hata);

  const r = await istek('/addinvoice', firmId, esleme.govde);
  if (!r.ok) return hataYaz(r.hata);
  const guid = typeof r.govde.guid === 'string' ? r.govde.guid.trim() : '';
  if (!guid) return hataYaz('GUID_YOK');
  const url = typeof r.govde.url === 'string' && /^https:\/\//.test(r.govde.url) ? r.govde.url : null;
  await prisma.customerInvoice.update({
    where: { id: f.id },
    data: { bizimHesapDurum: 'GONDERILDI', bizimHesapGuid: guid, bizimHesapUrl: url, bizimHesapAt: new Date(), bizimHesapHata: null },
  });
  return { id: f.id, durum: 'GONDERILDI', url };
}

/** Birden çok fatura — sırayla; biri hata verirse diğerleri devam eder. */
export async function topluGonder(tenantId: string, ids: string[]): Promise<GonderimSonucu[]> {
  const sonuclar: GonderimSonucu[] = [];
  for (const id of ids) sonuclar.push(await faturaGonder(tenantId, id));
  return sonuclar;
}

/**
 * Nextus'ta iptal edilmiş, Bizim Hesap'a gitmiş faturayı orada da iptal
 * eder. Yalnız İPTAL faturada: yanlışlıkla muhasebedeki geçerli bir faturayı
 * silmek mümkün olmasın.
 */
export async function bizimHesaptaIptal(tenantId: string, invoiceId: string): Promise<{ durum: 'IPTAL' | 'HATA' | 'YOK' | 'GONDERILEMEZ' | 'AYAR_YOK'; hata?: string }> {
  const firmId = await firmIdOku(tenantId);
  if (!firmId) return { durum: 'AYAR_YOK' };
  const f = await prisma.customerInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { id: true, status: true, bizimHesapDurum: true, bizimHesapGuid: true },
  });
  if (!f) return { durum: 'YOK' };
  if (f.status !== 'CANCELLED' || f.bizimHesapDurum !== 'GONDERILDI' || !f.bizimHesapGuid) return { durum: 'GONDERILEMEZ' };
  const r = await istek('/cancelinvoice', firmId, { FirmId: firmId, Guid: f.bizimHesapGuid });
  if (!r.ok) return { durum: 'HATA', hata: r.hata };
  // Açık kaynak istemcinin gözlemi: status "0" başarı, "1" hata.
  if (String(r.govde.status ?? '0') !== '0') return { durum: 'HATA', hata: 'IPTAL_REDDEDILDI' };
  await prisma.customerInvoice.update({ where: { id: f.id }, data: { bizimHesapDurum: 'IPTAL', bizimHesapAt: new Date() } });
  return { durum: 'IPTAL' };
}
