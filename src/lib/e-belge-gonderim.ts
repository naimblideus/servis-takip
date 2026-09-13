import { prisma } from '@/lib/prisma';
import {
  eBelgeUret, belgeEksikleri, ettnUret, gibNumarasiUret, saticiEksikleri,
  type BelgeSaticisi, type BelgeDurumu,
} from '@/lib/fatura-belgesi';
import { entegratorBul } from '@/lib/entegrator';
import { sirCoz } from '@/lib/sir';

/**
 * e-BELGE GÖNDERİMİ.
 *
 * ── EN TEHLİKELİ İKİ ŞEY ─────────────────────────────────────────────────
 *
 * 1. NUMARA YAKMAK. GİB belge sırasında BOŞLUK OLAMAZ. Numara atanıp
 *    gönderim başarısız olursa o numara O FATURAYA AİT kalmalı ve tekrar
 *    denemede AYNI numara kullanılmalı. Her denemede yeni numara almak
 *    sırada delik açar ve delik sonradan kapatılamaz.
 *
 * 2. ÇİFT GÖNDERİM. Aynı fatura iki kez gönderilirse müşteriye iki kez
 *    fatura gider. Zaten gönderilmiş belge tekrar gönderilmiyor; durum
 *    kontrolü atamayla AYNI işlemin içinde yapılıyor ki eş zamanlı iki
 *    istek ikisini birden geçiremesin.
 *
 * ── SIRA ─────────────────────────────────────────────────────────────────
 * İşlem içinde: kilit al → durumu kontrol et → numara ata → GONDERILIYOR.
 * İşlem dışında: entegratöre git (ağ işi, işlemi kilitli tutmamalı).
 * Sonra: sonucu yaz. Hata olsa bile NUMARA DURUYOR.
 */

export type GonderimCevabi = {
  ok: boolean;
  durum: BelgeDurumu | null;
  gibNo: string | null;
  ettn: string | null;
  hata?: string;
  eksikler?: string[];
  tekrarDenenebilir?: boolean;
  testModu?: boolean;
};

const SATICI_ALANLARI = {
  name: true, taxNumber: true, taxOffice: true, address: true,
  city: true, district: true, phone: true, email: true,
  eFaturaOnEk: true, eFaturaSeq: true, eFaturaSeqYil: true, eFaturaEtiket: true,
  eFaturaSaglayici: true, eFaturaKullanici: true, eFaturaParola: true, eFaturaTestModu: true,
} as const;

const ALICI_ALANLARI = {
  name: true, legalName: true, taxNo: true, taxOffice: true,
  address: true, city: true, district: true, email: true, eInvoiceUser: true,
} as const;

function saticiyaCevir(t: any): BelgeSaticisi {
  return { ...t, eFaturaEtiket: t.eFaturaEtiket || t.eFaturaOnEk };
}

/** Tekrar gönderilebilir durumlar. KABUL/RED nihai — dokunulmuyor. */
const TEKRAR_GONDERILEBILIR: (BelgeDurumu | null)[] = [null, 'HAZIR', 'HATA'];

export async function eBelgeGonder(tenantId: string, invoiceId: string): Promise<GonderimCevabi> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: SATICI_ALANLARI });
  if (!tenant) return { ok: false, durum: null, gibNo: null, ettn: null, hata: 'Bayi bulunamadı' };

  const satici = saticiyaCevir(tenant);
  const sEksik = saticiEksikleri(satici);
  if (sEksik.length) {
    return { ok: false, durum: null, gibNo: null, ettn: null, eksikler: sEksik.map((x) => `Satıcı: ${x}`), hata: 'Bayi bilgileri eksik' };
  }

  // ── ENTEGRATÖR ────────────────────────────────────────────────────────
  const entegrator = entegratorBul(tenant.eFaturaSaglayici);
  if (!entegrator) {
    return {
      ok: false, durum: null, gibNo: null, ettn: null,
      hata: tenant.eFaturaSaglayici
        ? `Tanımlı olmayan sağlayıcı: ${tenant.eFaturaSaglayici}`
        : 'e-Fatura sağlayıcısı seçilmemiş (Ayarlar → e-Fatura)',
    };
  }
  const parola = sirCoz(tenant.eFaturaParola);
  if (!tenant.eFaturaKullanici || parola === null) {
    return {
      ok: false, durum: null, gibNo: null, ettn: null,
      hata: 'Sağlayıcı kullanıcı adı/parolası okunamadı. Ayarlar → e-Fatura\'dan yeniden girin.',
    };
  }

  // ── İŞLEM: DURUM KONTROLÜ + NUMARA ATAMA ──────────────────────────────
  // İkisi AYNI işlemde: eş zamanlı iki istek ikisini birden geçemesin.
  let hazirlik: { ettn: string; gibNo: string; yeniAtandi: boolean } | null = null;
  let hazirlikHatasi: GonderimCevabi | null = null;

  await prisma.$transaction(async (tx) => {
    const f = await tx.customerInvoice.findFirst({
      where: { id: invoiceId, tenantId, deletedAt: null },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, notes: true,
        subtotal: true, vatRate: true, vatAmount: true, totalAmount: true,
        ettn: true, gibNo: true, eBelgeDurum: true, status: true,
        customer: { select: ALICI_ALANLARI },
        lines: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true, vatRate: true } },
      },
    });
    if (!f) { hazirlikHatasi = { ok: false, durum: null, gibNo: null, ettn: null, hata: 'Fatura bulunamadı' }; return; }
    if (f.status === 'CANCELLED') {
      hazirlikHatasi = { ok: false, durum: null, gibNo: null, ettn: null, hata: 'İptal edilmiş fatura gönderilemez' };
      return;
    }

    const durum = f.eBelgeDurum as BelgeDurumu | null;
    if (!TEKRAR_GONDERILEBILIR.includes(durum)) {
      // Zaten gönderilmiş: ÇİFT FATURA olmasın.
      hazirlikHatasi = {
        ok: false, durum, gibNo: f.gibNo, ettn: f.ettn,
        hata: durum === 'GONDERILIYOR'
          ? 'Bu belge şu anda gönderiliyor — bitmesini bekleyin.'
          : `Bu belge zaten gönderildi (${durum}). Tekrar gönderilemez.`,
      };
      return;
    }

    const satirlar = f.lines.map((l) => ({
      aciklama: l.description, miktar: Number(l.quantity),
      birimFiyat: Number(l.unitPrice), tutar: Number(l.lineTotal),
      kdvOrani: l.vatRate === null ? null : Number(l.vatRate),
    }));
    const fatura = {
      invoiceNumber: f.invoiceNumber, invoiceDate: f.invoiceDate, notes: f.notes,
      subtotal: Number(f.subtotal), vatRate: Number(f.vatRate),
      vatAmount: Number(f.vatAmount), totalAmount: Number(f.totalAmount),
    };
    const eksik = belgeEksikleri(satici, f.customer, fatura, satirlar);
    if (eksik.length) {
      hazirlikHatasi = { ok: false, durum, gibNo: f.gibNo, ettn: f.ettn, eksikler: eksik, hata: 'Belge eksik bilgiyle gönderilemez' };
      return;
    }

    // NUMARA: zaten varsa TEKRAR ATANMIYOR. Önceki deneme başarısız olduysa
    // o numara bu faturaya ait; yeni numara almak sırada delik açar.
    let ettn = f.ettn;
    let gibNo = f.gibNo;
    let yeniAtandi = false;
    if (!ettn || !gibNo) {
      const yil = new Date().getFullYear();
      const t = await tx.tenant.findUnique({
        where: { id: tenantId }, select: { eFaturaOnEk: true, eFaturaSeq: true, eFaturaSeqYil: true },
      });
      let uretilen;
      try {
        uretilen = gibNumarasiUret(t!.eFaturaOnEk, yil, t!.eFaturaSeq, t!.eFaturaSeqYil);
      } catch (e) {
        hazirlikHatasi = { ok: false, durum, gibNo: null, ettn: null, hata: e instanceof Error ? e.message : String(e) };
        return;
      }
      ettn = ettn ?? ettnUret();
      gibNo = uretilen.no;
      await tx.tenant.update({
        where: { id: tenantId },
        data: { eFaturaSeq: uretilen.sira, eFaturaSeqYil: uretilen.yil },
      });
      yeniAtandi = true;
    }

    await tx.customerInvoice.update({
      where: { id: invoiceId },
      data: {
        ettn, gibNo,
        senaryo: f.customer.eInvoiceUser ? 'TEMELFATURA' : 'EARSIVFATURA',
        faturaTipi: 'SATIS',
        eBelgeDurum: 'GONDERILIYOR',
        eBelgeDurumAt: new Date(),
        eBelgeNot: null,
      },
    });
    hazirlik = { ettn: ettn!, gibNo: gibNo!, yeniAtandi };
  });

  if (hazirlikHatasi) return hazirlikHatasi;
  if (!hazirlik) return { ok: false, durum: null, gibNo: null, ettn: null, hata: 'Hazırlık tamamlanamadı' };
  const h: { ettn: string; gibNo: string; yeniAtandi: boolean } = hazirlik;

  // ── İŞLEM DIŞINDA: AĞ ─────────────────────────────────────────────────
  // Veritabanı işlemi ağ beklemesi boyunca kilitli tutulmuyor.
  const f2 = await prisma.customerInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      invoiceNumber: true, invoiceDate: true, notes: true,
      subtotal: true, vatRate: true, vatAmount: true, totalAmount: true,
      customer: { select: ALICI_ALANLARI },
      lines: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true, vatRate: true } },
    },
  });
  const belge = eBelgeUret({
    satici, alici: f2!.customer,
    fatura: {
      invoiceNumber: f2!.invoiceNumber, invoiceDate: f2!.invoiceDate, notes: f2!.notes,
      subtotal: Number(f2!.subtotal), vatRate: Number(f2!.vatRate),
      vatAmount: Number(f2!.vatAmount), totalAmount: Number(f2!.totalAmount),
    },
    satirlar: f2!.lines.map((l) => ({
      aciklama: l.description, miktar: Number(l.quantity),
      birimFiyat: Number(l.unitPrice), tutar: Number(l.lineTotal),
      kdvOrani: l.vatRate === null ? null : Number(l.vatRate),
    })),
    ettn: h.ettn, gibNo: h.gibNo,
  });

  let sonuc;
  try {
    sonuc = await entegrator.gonder(belge, {
      kullanici: tenant.eFaturaKullanici, parola, test: tenant.eFaturaTestModu,
    });
  } catch (e) {
    // Beklenmeyen hata da TEKRAR DENENEBİLİR sayılıyor: ağ kopması yüzünden
    // belgeyi kalıcı hatalı işaretlemek, gönderilebilir bir faturayı
    // gönderilemez hâle getirirdi.
    sonuc = { ok: false as const, hata: e instanceof Error ? e.message : String(e), tekrarDenenebilir: true };
  }

  // ── SONUÇ ─────────────────────────────────────────────────────────────
  // Hata olsa bile NUMARA DURUYOR: tekrar denemede aynı numara kullanılır.
  const durum: BelgeDurumu = sonuc.ok ? 'GONDERILDI' : 'HATA';
  await prisma.customerInvoice.update({
    where: { id: invoiceId },
    data: {
      eBelgeDurum: durum,
      eBelgeDurumAt: new Date(),
      eBelgeNot: sonuc.ok
        ? [sonuc.referans ? `Referans: ${sonuc.referans}` : null, sonuc.not].filter(Boolean).join(' · ') || null
        : sonuc.hata,
    },
  });

  return sonuc.ok
    ? { ok: true, durum, gibNo: h.gibNo, ettn: h.ettn, testModu: tenant.eFaturaTestModu }
    : {
        ok: false, durum, gibNo: h.gibNo, ettn: h.ettn,
        hata: sonuc.hata, tekrarDenenebilir: sonuc.tekrarDenenebilir,
        testModu: tenant.eFaturaTestModu,
      };
}

/**
 * Gönderilmiş belgenin son durumunu sorar (kabul/red).
 *
 * TEMELFATURA 8 gün içinde reddedilebiliyor; "gönderdim, bitti" demek
 * eksik. Reddedilen faturayı bilmeyen bayi tahsilat peşine düşer.
 */
export async function eBelgeDurumGuncelle(tenantId: string, invoiceId: string): Promise<GonderimCevabi> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: SATICI_ALANLARI });
  if (!tenant) return { ok: false, durum: null, gibNo: null, ettn: null, hata: 'Bayi bulunamadı' };

  const f = await prisma.customerInvoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    select: { ettn: true, gibNo: true, eBelgeDurum: true },
  });
  if (!f) return { ok: false, durum: null, gibNo: null, ettn: null, hata: 'Fatura bulunamadı' };
  if (!f.ettn || f.eBelgeDurum !== 'GONDERILDI') {
    return {
      ok: false, durum: f.eBelgeDurum as BelgeDurumu | null, gibNo: f.gibNo, ettn: f.ettn,
      hata: 'Yalnız gönderilmiş belgenin durumu sorulabilir',
    };
  }

  const entegrator = entegratorBul(tenant.eFaturaSaglayici);
  const parola = sirCoz(tenant.eFaturaParola);
  if (!entegrator || !tenant.eFaturaKullanici || parola === null) {
    return { ok: false, durum: f.eBelgeDurum as BelgeDurumu, gibNo: f.gibNo, ettn: f.ettn, hata: 'Sağlayıcı ayarları eksik' };
  }

  let cevap;
  try {
    cevap = await entegrator.durumSor(f.ettn, {
      kullanici: tenant.eFaturaKullanici, parola, test: tenant.eFaturaTestModu,
    });
  } catch (e) {
    return { ok: false, durum: 'GONDERILDI', gibNo: f.gibNo, ettn: f.ettn, hata: e instanceof Error ? e.message : String(e) };
  }
  if (!cevap.ok) {
    // Sorgu başarısız olması belgenin durumunu DEĞİŞTİRMEZ.
    return { ok: false, durum: 'GONDERILDI', gibNo: f.gibNo, ettn: f.ettn, hata: cevap.hata };
  }

  await prisma.customerInvoice.update({
    where: { id: invoiceId },
    data: { eBelgeDurum: cevap.durum, eBelgeDurumAt: new Date(), eBelgeNot: cevap.not ?? null },
  });
  return { ok: true, durum: cevap.durum, gibNo: f.gibNo, ettn: f.ettn };
}
