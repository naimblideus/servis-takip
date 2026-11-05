// BASKI İŞİ — veritabanı tarafı: iş açma, durum, ödeme, cari.
// Kurallar saf dosyalarda (baski-is, baski-fiyat, baski-cari); burası onları
// uygular. Bütün yazmalar kiracıya kapsamlı: her sorguda tenantId.
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  gecisIzinli, isHesapla, isDurumu, kanal as kanalNormal, odemeGecerli, sonrakiNo,
  type GecisHatasi, type IsDurumu, type IsHesapHatasi, type KalemGirdisi, type OdemeHatasi,
} from '@/lib/baski-is';
import { cariPlani, planBosMu } from '@/lib/baski-cari';
import { mesajTuru } from '@/lib/baski-mesaj';

export interface Kullanici { id: string; name?: string | null; role: string }

// ── İŞ NUMARASI (lib/ticket-number kalıbı) ───────────────────────────────
// Aynı anda açılan iki iş aynı numarayı almasın: bu süreçte verilen numara
// kısa süre akılda tutulur; başka süreç yine de alırsa (tenantId, no)
// benzersizliğine takılan yazma yeni numarayla tekrar dener.

type Ayrilan = { no: number; zaman: number };
const AYRILAN: Map<string, Ayrilan> =
  ((globalThis as { __baskiNoAyrilan?: Map<string, Ayrilan> }).__baskiNoAyrilan ??= new Map());
const AYIRMA_SURESI_MS = 30_000;
const DENEME = 6;

async function siradakiNo(tenantId: string): Promise<number> {
  const r = await prisma.baskiIsi.aggregate({ where: { tenantId }, _max: { no: true } });
  const simdi = Date.now();
  const onceki = AYRILAN.get(tenantId);
  const akilda = onceki && simdi - onceki.zaman < AYIRMA_SURESI_MS ? onceki.no : 0;
  const no = Math.max(sonrakiNo(r._max.no), akilda + 1);
  AYRILAN.set(tenantId, { no, zaman: simdi });
  return no;
}

/** Hata (tenantId, no) benzersizliğine takılan bir iş numarası mı? */
export function isNoCakismasi(e: unknown): boolean {
  const h = e as { code?: string; meta?: { target?: unknown } } | null;
  if (h?.code !== 'P2002') return false;
  const hedef = h.meta?.target;
  const has = (x: string) => (Array.isArray(hedef) ? hedef.includes(x) : String(hedef ?? '').includes(x));
  return has('no') && !has('jeton');
}

export async function isNumarasiylaOlustur<T>(tenantId: string, olustur: (no: number) => Promise<T>): Promise<T> {
  for (let deneme = 1; ; deneme++) {
    const no = await siradakiNo(tenantId);
    try {
      return await olustur(no);
    } catch (e) {
      if (!isNoCakismasi(e)) {
        const o = AYRILAN.get(tenantId);
        if (o && o.no === no) AYRILAN.set(tenantId, { no: no - 1, zaman: o.zaman });
        throw e;
      }
      if (deneme >= DENEME) throw e;
      await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 20 * deneme)));
    }
  }
}

/** Takip bağlantısı jetonu: 144 bit, adreste kullanılabilir. */
export function yeniJeton(): string {
  return randomBytes(18).toString('base64url');
}

// ── İŞ AÇMA ──────────────────────────────────────────────────────────────

export interface YeniIs {
  kanal?: string;
  customerId?: string | null;
  musteriAd?: string;
  telefon?: string;
  firma?: string;
  vergiNo?: string;
  not?: string;
  sozVerilenAt?: string | Date | null;
  acil?: boolean;
  odemeYolu?: string | null;
  kalemler: KalemGirdisi[];
  /** Tezgahta "şimdi öde": iş açılırken alınan ödeme (kuruş). */
  odeme?: { tutar: number; yol: string } | null;
}

export type IsAcmaHatasi = IsHesapHatasi | { ok: false; kod: 'MUSTERI_YOK' } | { ok: false; kod: OdemeHatasi };

const metin = (x: unknown, azami: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, azami) : null);
const tarih = (x: unknown) => { if (!x) return null; const d = new Date(x as string); return Number.isNaN(+d) ? null : d; };

/**
 * İş açar: fiyat listesinden hesaplar, numara alır, kalemleri ve ilk olayı
 * (varsa ilk ödemeyi) tek yazmada kaydeder, cariye yansıtır.
 * `personel` false ise iş müşteriden gelmiştir (sipariş sayfası): GELEN'de
 * başlar ve fiyatı tahmini olabilir.
 */
export async function isOlustur(tenantId: string, girdi: YeniIs, kim: Kullanici | null, o: { personel: boolean }) {
  const kanal = o.personel ? kanalNormal(girdi.kanal) : 'ONLINE';
  const urunler = await prisma.baskiUrunu.findMany({
    where: { tenantId, id: { in: (girdi.kalemler ?? []).map((k) => String(k?.urunId ?? '')) }, aktif: true },
  });
  const h = isHesapla(urunler, girdi.kalemler, { personel: o.personel });
  if (!h.ok) return h;

  let customerId: string | null = null;
  if (girdi.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: girdi.customerId, tenantId }, select: { id: true } });
    if (!c) return { ok: false as const, kod: 'MUSTERI_YOK' as const };
    customerId = c.id;
  }
  const durum: IsDurumu = kanal === 'ONLINE' ? 'GELEN' : 'SIRADA';
  let odeme: { tutar: number; yol: string } | null = null;
  if (girdi.odeme && o.personel) {
    const v = odemeGecerli(girdi.odeme, { toplam: h.toplam, odenen: 0, durum });
    if (!v.ok) return v;
    odeme = { tutar: v.tutar, yol: v.yol };
  }
  const odemeYolu = ['NAKIT', 'KART', 'HAVALE', 'CARI'].includes(String(girdi.odemeYolu)) ? String(girdi.odemeYolu) : null;

  const is = await isNumarasiylaOlustur(tenantId, (no) => prisma.baskiIsi.create({
    data: {
      tenantId, no, kanal, durum,
      acil: girdi.acil === true,
      bitisGerekli: h.bitisGerekli,
      customerId,
      musteriAd: metin(girdi.musteriAd, 120),
      telefon: metin(girdi.telefon, 30),
      firma: metin(girdi.firma, 160),
      vergiNo: metin(girdi.vergiNo, 20),
      not: metin(girdi.not, 2000),
      sozVerilenAt: tarih(girdi.sozVerilenAt),
      kdvHaric: h.kdvHaric, kdv: h.kdv, toplam: h.toplam, tahmini: h.tahmini,
      odemeYolu: odeme ? odeme.yol : odemeYolu,
      odenen: odeme?.tutar ?? 0,
      jeton: yeniJeton(),
      olusturanId: kim?.id ?? null,
      olusturanAd: kim?.name ?? null,
      kalemler: { create: h.kalemler.map((k) => ({ ...k, dokum: k.dokum as unknown as Prisma.InputJsonValue })) },
      olaylar: { create: [{ tenantId, tur: 'DURUM', durumSonra: durum, kullaniciId: kim?.id ?? null, kullaniciAd: kim?.name ?? null }] },
      ...(odeme ? { odemeler: { create: [{ tenantId, tutar: odeme.tutar, yol: odeme.yol, aliciId: kim?.id ?? null, aliciAd: kim?.name ?? null }] } } : {}),
    },
  }));
  await baskiIsiCariEsitle(is.id, tenantId);
  return { ok: true as const, is };
}

// ── DURUM ────────────────────────────────────────────────────────────────

export type DurumHatasi = { ok: false; kod: GecisHatasi | 'IS_YOK' | 'DURUM_GECERSIZ' | 'DEGISTI' };

/**
 * Durumu değiştirir. Aynı anda iki kişi aynı kartın düğmesine basarsa
 * ikincisi DEGISTI alır (koşullu yazma), iş iki adım atlamaz.
 */
export async function durumDegistir(tenantId: string, isId: string, sonraHam: unknown, kim: Kullanici, ek: { iptalNedeni?: string } = {}): Promise<{ ok: true; durum: IsDurumu } | DurumHatasi> {
  const sonra = isDurumu(sonraHam);
  if (!sonra) return { ok: false, kod: 'DURUM_GECERSIZ' };
  const is = await prisma.baskiIsi.findFirst({ where: { id: isId, tenantId } });
  if (!is) return { ok: false, kod: 'IS_YOK' };
  const once = isDurumu(is.durum) ?? 'SIRADA';
  const izin = gecisIzinli(once, sonra, {
    rol: kim.role, toplam: is.toplam, odenen: is.odenen,
    cari: !!is.customerId && is.odemeYolu === 'CARI',
    bitisGerekli: is.bitisGerekli, tahmini: is.tahmini,
  });
  if (!izin.ok) return izin;

  const simdi = new Date();
  const yazildi = await prisma.$transaction(async (tx) => {
    const r = await tx.baskiIsi.updateMany({
      where: { id: is.id, tenantId, durum: once },
      data: {
        durum: sonra,
        ...(sonra === 'TESLIM' ? { teslimAt: simdi } : once === 'TESLIM' ? { teslimAt: null } : {}),
        ...(sonra === 'IPTAL' ? { iptalAt: simdi, iptalNedeni: metin(ek.iptalNedeni, 500) } : once === 'IPTAL' ? { iptalAt: null, iptalNedeni: null } : {}),
      },
    });
    if (r.count !== 1) return false;
    await tx.baskiOlayi.create({
      data: { isId: is.id, tenantId, tur: 'DURUM', durumOnce: once, durumSonra: sonra, metin: sonra === 'IPTAL' ? metin(ek.iptalNedeni, 500) : null, kullaniciId: kim.id, kullaniciAd: kim.name ?? null },
    });
    return true;
  });
  if (!yazildi) return { ok: false, kod: 'DEGISTI' };
  await baskiIsiCariEsitle(is.id, tenantId);
  return { ok: true, durum: sonra };
}

// ── KABUL ────────────────────────────────────────────────────────────────

/**
 * Online işi personel kabul eder: müşterinin bildirdiği sayfa sayısı onaylanır
 * ya da düzeltilir, tutar fiyat listesinden yeniden hesaplanıp dondurulur, iş
 * Sırada'ya geçer. Tek yazmada: yarım kabul (tutar yeni, durum eski) olmaz.
 */
export async function isKabulEt(tenantId: string, isId: string, sayfalar: Record<string, unknown>, kim: Kullanici):
  Promise<{ ok: true; toplam: number } | { ok: false; kod: IsHesapHatasi['kod'] | 'IS_YOK' | 'GECIS_YOK' | 'YETKI_YOK' | 'DEGISTI' }> {
  if (kim.role === 'TECHNICIAN') return { ok: false, kod: 'YETKI_YOK' };
  const is = await prisma.baskiIsi.findFirst({ where: { id: isId, tenantId }, include: { kalemler: { orderBy: { sira: 'asc' } } } });
  if (!is) return { ok: false, kod: 'IS_YOK' };
  if (is.durum !== 'GELEN') return { ok: false, kod: 'GECIS_YOK' };
  const urunler = await prisma.baskiUrunu.findMany({ where: { tenantId, id: { in: is.kalemler.map((k) => k.urunId ?? '') }, aktif: true } });
  const h = isHesapla(urunler, is.kalemler.map((k) => ({
    urunId: k.urunId ?? '', adet: k.adet, enCm: k.enCm ?? undefined, boyCm: k.boyCm ?? undefined,
    sayfa: k.sayfa === null ? undefined : Number(sayfalar[k.id] ?? k.sayfa),
    secimler: k.secimler as Record<string, string>,
  })), { personel: true });
  if (!h.ok) return { ok: false, kod: h.kod };

  const yazildi = await prisma.$transaction(async (tx) => {
    const r = await tx.baskiIsi.updateMany({
      where: { id: is.id, tenantId, durum: 'GELEN' },
      data: { durum: 'SIRADA', tahmini: false, kdvHaric: h.kdvHaric, kdv: h.kdv, toplam: h.toplam, bitisGerekli: h.bitisGerekli },
    });
    if (r.count !== 1) return false;
    for (let i = 0; i < is.kalemler.length; i++) {
      const y = h.kalemler[i];
      await tx.baskiKalemi.update({
        where: { id: is.kalemler[i].id },
        data: { sayfa: y.sayfa, birimFiyat: y.birimFiyat, tutar: y.tutar, ozet: y.ozet, dokum: y.dokum as unknown as Prisma.InputJsonValue },
      });
    }
    await tx.baskiOlayi.create({ data: { isId: is.id, tenantId, tur: 'DURUM', durumOnce: 'GELEN', durumSonra: 'SIRADA', kullaniciId: kim.id, kullaniciAd: kim.name ?? null } });
    return true;
  });
  if (!yazildi) return { ok: false, kod: 'DEGISTI' };
  await baskiIsiCariEsitle(is.id, tenantId);
  return { ok: true, toplam: h.toplam };
}

// ── ÖDEME ────────────────────────────────────────────────────────────────

export async function odemeEkle(tenantId: string, isId: string, girdi: { tutar: unknown; yol: unknown; not?: string }, kim: Kullanici):
  Promise<{ ok: true; odenen: number } | { ok: false; kod: OdemeHatasi | 'IS_YOK' | 'DEGISTI' }> {
  const is = await prisma.baskiIsi.findFirst({ where: { id: isId, tenantId }, select: { id: true, toplam: true, odenen: true, durum: true } });
  if (!is) return { ok: false, kod: 'IS_YOK' };
  const v = odemeGecerli(girdi, { toplam: is.toplam, odenen: is.odenen, durum: isDurumu(is.durum) ?? 'SIRADA' });
  if (!v.ok) return v;
  const odenen = is.odenen + v.tutar;
  // Koşullu yazma: aynı anda iki ödeme kalanı birlikte aşmasın.
  const yazildi = await prisma.$transaction(async (tx) => {
    const r = await tx.baskiIsi.updateMany({ where: { id: is.id, tenantId, odenen: is.odenen }, data: { odenen } });
    if (r.count !== 1) return false;
    await tx.baskiOdeme.create({ data: { tenantId, isId: is.id, tutar: v.tutar, yol: v.yol, not: metin(girdi.not, 300), aliciId: kim.id, aliciAd: kim.name ?? null } });
    await tx.baskiOlayi.create({ data: { isId: is.id, tenantId, tur: 'ODEME', metin: `${v.yol} ${v.tutar}`, kullaniciId: kim.id, kullaniciAd: kim.name ?? null } });
    return true;
  });
  if (!yazildi) return { ok: false, kod: 'DEGISTI' };
  await baskiIsiCariEsitle(is.id, tenantId);
  return { ok: true, odenen };
}

// ── MESAJ ────────────────────────────────────────────────────────────────

/**
 * WhatsApp düğmesine dokunuldu: geçmişe yazılır. Hazır işte "hazır" mesajı
 * haberVerildiAt'i de yazar; Bugün'deki "haber verilmedi" satırı buradan kapanır.
 * Mesajın gerçekten gönderildiğini bilemeyiz: gönderen matbaanın WhatsApp'ı.
 */
export async function mesajKaydet(tenantId: string, isId: string, turHam: unknown, kim: Kullanici): Promise<{ ok: true } | { ok: false; kod: 'MESAJ_GECERSIZ' | 'IS_YOK' }> {
  const tur = mesajTuru(turHam);
  if (!tur) return { ok: false, kod: 'MESAJ_GECERSIZ' };
  const is = await prisma.baskiIsi.findFirst({ where: { id: isId, tenantId }, select: { id: true, durum: true } });
  if (!is) return { ok: false, kod: 'IS_YOK' };
  await prisma.$transaction(async (tx) => {
    if (tur === 'HAZIR' && is.durum === 'HAZIR') {
      await tx.baskiIsi.updateMany({ where: { id: is.id, tenantId, haberVerildiAt: null }, data: { haberVerildiAt: new Date() } });
    }
    await tx.baskiOlayi.create({ data: { isId: is.id, tenantId, tur: 'BILDIRIM', metin: tur, kullaniciId: kim.id, kullaniciAd: kim.name ?? null } });
  });
  return { ok: true };
}

// ── CARİ ─────────────────────────────────────────────────────────────────

/** İşin cari kayıtlarını uzlaştırır (lib/baski-cari). İdempotent. */
export async function baskiIsiCariEsitle(isId: string, tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const is = await tx.baskiIsi.findFirst({
      where: { id: isId, tenantId },
      select: { id: true, no: true, durum: true, toplam: true, customerId: true, createdAt: true, olusturanAd: true, odemeler: { select: { tutar: true, yol: true, tarih: true } } },
    });
    if (!is) return;
    const mevcut = await tx.accountEntry.findMany({ where: { tenantId, baskiIsiId: is.id } });
    const plan = cariPlani(
      { ...is, kim: is.olusturanAd },
      mevcut.map((e) => ({ id: e.id, type: e.type, amount: Number(e.amount), product: e.product, date: e.date, method: e.method, customerId: e.customerId })),
    );
    if (planBosMu(plan)) return;
    if (plan.sil.length) await tx.accountEntry.deleteMany({ where: { tenantId, id: { in: plan.sil } } });
    for (const g of plan.guncelle) await tx.accountEntry.update({ where: { id: g.id }, data: g.data });
    for (const y of plan.olustur) {
      await tx.accountEntry.create({ data: { ...y, tenantId, customerId: is.customerId!, baskiIsiId: is.id, createdByName: is.olusturanAd } });
    }
  });
}
