/**
 * EXCEL / CSV AKTARMA ÇEKİRDEĞİ — müşteri + cihaz + kiralık şartları.
 *
 * İki kapı aynı kuralı çağırır:
 *   · bayinin kendi ekranı ......... api/import/sheet (oturum + yönetici)
 *   · Nextus kurulum ekibi ......... api/super-admin/kurulum/[tenantId]/ice-aktar
 * Yetki kapılarda denetlenir; burası yalnız "bu kiracıya bu dosyayı yaz" der.
 * Kural tek yerde olmazsa iki kapı ayrışır: bayinin yüklediği dosyayla bizim
 * yüklediğimiz dosya farklı sonuç verir ve kimse fark etmez.
 *
 *   { csv, mapping?, dryRun }  → dryRun = ÖNİZLEME (hiçbir şey yazılmaz)
 * Tekilleştirme: müşteri (kiracı + telefon), cihaz (kiracı + seri no) →
 * aynı dosyayı tekrar yüklemek GÜVENLİ (günceller, çoğaltmaz).
 */
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  parseCSV, detectDelimiter, autoMap, trNumber, trInt, trBool, normalizePhone,
  donemCoz, kurulumTarihiCoz, type FieldKey, type TarihHassasiyeti,
} from '@/lib/sheet-import';
import { normalizeBrandModel } from '@/lib/device-brands';
import { donemOf } from '@/lib/fatura-donemi';
import { GOC_KAYNAGI } from '@/lib/kurulum';
import { kiraSartiEksik } from '@/lib/kira-sarti';
import { cihazAyriliyor } from '@/lib/okuma-sahibi';
import type { UcHataKodu } from '@/lib/uc-hata';

export const AKTARIM_AZAMI_SATIR = 5000;

export type AktarimGirdisi = {
  tenantId: string;
  csv: unknown;
  mapping?: unknown;
  dryRun?: unknown;
  simdi?: Date;
};

export type AktarimSonucu =
  | { ok: true; govde: Record<string, unknown> }
  | { ok: false; hata: UcHataKodu; durum: number; ek?: Record<string, unknown>; deger?: Record<string, string | number> };

export type Uyari = { kod: string; n: number; ornek?: string; isimler?: string };

type Satir = {
  row: number; customerName: string; phone: string; address: string; taxNo: string;
  legalName: string; taxOffice: string; city: string; district: string;
  brand: string; model: string; serialNo: string; location: string;
  counterBlack: number | null; counterColor: number | null;
  isRental: boolean; monthlyRent: number | null; pricePerBlack: number | null; pricePerColor: number | null;
  /** Dosya bu satır için kiralık olup olmadığını SÖYLÜYOR mu (kiralık kolonu dolu ya da kira yazılı). */
  kiralikBelirtildi: boolean;
  includedBlack: number | null; includedColor: number | null;
  overagePriceBlack: number | null; overagePriceColor: number | null;
  installedAt: string | null; installedAtPrecision: TarihHassasiyeti | null;
  lastInvoicedPeriod: string | null;
  errors: string[];
};

/** Aylık kira özeti: bayinin bildiği kira geliriyle karşılaştırmak için. */
export type KiraOzeti = {
  toplam: number;
  cihaz: number;
  /** Kiralık işaretli ama kirası boş cihaz (sayfa fiyatı olsa da sabit gelir yok). */
  kirasiz: number;
  /** En yüksek kira toplamlı ilk 10 müşteri. */
  musteriler: { ad: string; cihaz: number; toplam: number }[];
};

const kes = (s: string, n: number) => (s.length > n ? s.slice(0, n).trim() : s);
const pozitif = (n: number | null) => (n != null && n > 0 ? n : null);
const sayfaAdedi = (n: number | null) => (n != null && n >= 0 ? n : null);

/**
 * BAŞLIK SATIRI NEREDE — bayi dosyalarının çoğunda 1. satır değil.
 * Üstte firma adı, "2026 Kiralık Listesi" ya da boş satır oluyor; eskiden
 * 1. satır başlık sayılınca hiçbir kolon tanınmıyordu. İlk 15 satırda en çok
 * kolonu tanınan satır başlıktır (eşitlikte üstteki). Hiçbiri tanınmazsa 1.
 */
export const BASLIK_ARAMA_SATIRI = 15;
export function baslikSatiriBul(rows: string[][]): number {
  let enIyi = 0, skor = 0;
  for (let i = 0; i < Math.min(BASLIK_ARAMA_SATIRI, rows.length - 1); i++) {
    const s = autoMap(rows[i].map((h) => h.trim())).filter(Boolean).length;
    if (s > skor) { skor = s; enIyi = i; }
  }
  return enIyi;
}

/** Ad eşleşmesi için: Türkçe küçük harf, noktalama ve fazla boşluk yok. */
export function adAnahtari(ad: string): string {
  return ad.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Telefonu olmayan müşterinin yer tutucusu. Müşteri bayi içinde telefonla
 * tekil ve telefon zorunlu; SQL aktarımı yıllardır "BOS-…" yazıyor ve
 * WhatsApp/SMS yolları bunu numara saymıyor (lib/share waPhone). Addan
 * türetildiği için aynı dosya ikinci kez yüklenince aynı kimlik çıkar.
 */
export function telefonsuzKimlik(ad: string): string {
  return 'BOS-' + crypto.createHash('sha1').update(adAnahtari(ad)).digest('hex').slice(0, 8).toUpperCase();
}

export async function sayfaIceAktar(g: AktarimGirdisi): Promise<AktarimSonucu> {
  const { tenantId } = g;
  const simdi = g.simdi ?? new Date();
  const csv = g.csv;
  if (typeof csv !== 'string' || !csv.trim()) {
    return { ok: false, hata: 'DOSYA_BOS_GORUNUYOR', durum: 400, ek: { kod: 'BOS_DOSYA' } };
  }

  const delimiter = detectDelimiter(csv);
  const rows = parseCSV(csv, delimiter);
  if (rows.length < 2) {
    return { ok: false, hata: 'DOSYADA_BASLIK_SATIRI_EN_AZ', durum: 400, ek: { kod: 'SATIR_YOK' } };
  }

  const baslikNo = baslikSatiriBul(rows);
  const headers = rows[baslikNo].map((h) => h.trim());
  // Tamamen boş satırlar atılır ama Excel satır numarası korunur.
  const dataRows = rows.slice(baslikNo + 1)
    .map((r, i) => ({ r, satirNo: baslikNo + i + 2 }))
    .filter(({ r }) => r.some((h) => h.trim() !== ''));
  if (dataRows.length > AKTARIM_AZAMI_SATIR) {
    return { ok: false, hata: 'TEK_SEFERDE_EN_FAZLA_SATIR', durum: 400, deger: { p1: AKTARIM_AZAMI_SATIR, p2: dataRows.length } };
  }

  // Eşleme: kullanıcı düzelttiyse onu kullan, yoksa otomatik tahmin
  const mapping: (FieldKey | null)[] = Array.isArray(g.mapping) && g.mapping.length === headers.length
    ? (g.mapping as (FieldKey | null)[])
    : autoMap(headers);

  const idx = (k: FieldKey) => mapping.indexOf(k);
  const get = (r: string[], k: FieldKey) => {
    const i = idx(k);
    return i >= 0 ? (r[i] ?? '').trim() : '';
  };

  const hasCustomer = idx('customerName') >= 0 || idx('legalName') >= 0;
  const hasDevice = idx('serialNo') >= 0 || idx('model') >= 0 || idx('brand') >= 0;
  if (!hasCustomer && !hasDevice) {
    return { ok: false, hata: 'KOLONLAR_TANINAMADI_EN_AZINDAN_MUSTERI', durum: 400, ek: { kod: 'KOLON_TANINMADI', headers, mapping } };
  }

  // Okunamayan tarih/dönem tahmin edilmez; sayılır ve önizlemede söylenir.
  const okunamayan = { tarih: 0, tarihOrnek: '', donem: 0, donemOrnek: '', gelecek: 0, gelecekOrnek: '' };
  const buAy = donemOf(simdi);

  // ── Boş müşteri hücresi üst satırdan ──
  // Aynı müşterinin 2. ve sonraki cihaz satırlarında müşteri hücresi çoğu
  // zaman boş: birleştirilmiş hücre ya da "üsttekiyle aynı" diye boş
  // bırakılmış. Eskiden bu satırlar "müşteri adı boş" diye düşüyordu. Yalnız
  // satırda cihaz bilgisi varsa ve müşteri kolonlarının HEPSİ boşsa alınır.
  const musteriKolonlari = (['customerName', 'legalName', 'phone'] as FieldKey[]).map(idx).filter((i) => i >= 0);
  let usttenAlinan = 0;
  if (hasCustomer && hasDevice) {
    let onceki: string[] | null = null;
    for (const d of dataRows) {
      const musteriBos = musteriKolonlari.every((i) => !(d.r[i] ?? '').trim());
      const cihazVar = !!(get(d.r, 'serialNo') || get(d.r, 'brand') || get(d.r, 'model'));
      if (!musteriBos) { onceki = d.r; continue; }
      if (cihazVar && onceki) {
        const kopya = [...d.r];
        for (const i of musteriKolonlari) kopya[i] = onceki[i] ?? '';
        d.r = kopya;
        usttenAlinan++;
      }
    }
  }

  // ── Satırları çöz ──
  const parsed: Satir[] = dataRows.map(({ r, satirNo }) => {
    const hamTarih = get(r, 'installedAt');
    const tarih = hamTarih ? kurulumTarihiCoz(hamTarih, simdi) : null;
    if (hamTarih && !tarih) { okunamayan.tarih++; okunamayan.tarihOrnek ||= kes(hamTarih, 30); }

    const hamDonem = get(r, 'lastInvoicedPeriod');
    let donem = hamDonem ? donemCoz(hamDonem) : null;
    if (hamDonem && !donem) { okunamayan.donem++; okunamayan.donemOrnek ||= kes(hamDonem, 30); }
    // Gelecek ay "kirası kesildi" sayılamaz: o ayın kirası hiç kesilmezdi.
    if (donem && donem > buAy) { okunamayan.gelecek++; okunamayan.gelecekOrnek ||= donem; donem = null; }

    const p: Satir = {
      row: satirNo, // Excel satır numarası (başlık satırı atlanmış üst satırlar dahil)
      // Tek ad kolonu "Ünvan" ise defterdeki ad da o olur: aksi hâlde
      // dosya dolu olduğu hâlde her satır "müşteri adı boş" derdi.
      customerName: kes(get(r, 'customerName') || get(r, 'legalName'), 160),
      legalName: kes(get(r, 'legalName'), 160),
      taxOffice: kes(get(r, 'taxOffice'), 80),
      city: kes(get(r, 'city'), 60),
      district: kes(get(r, 'district'), 60),
      phone: normalizePhone(get(r, 'phone')),
      address: kes(get(r, 'address'), 400),
      taxNo: kes(get(r, 'taxNo'), 40),
      brand: kes(get(r, 'brand'), 80),
      model: kes(get(r, 'model'), 120),
      serialNo: kes(get(r, 'serialNo'), 80),
      location: kes(get(r, 'location'), 120),
      counterBlack: trInt(get(r, 'counterBlack')),
      counterColor: trInt(get(r, 'counterColor')),
      isRental: idx('isRental') >= 0 ? trBool(get(r, 'isRental')) : (trNumber(get(r, 'monthlyRent')) || 0) > 0,
      kiralikBelirtildi: idx('isRental') >= 0 ? !!get(r, 'isRental').trim() : trNumber(get(r, 'monthlyRent')) != null,
      monthlyRent: trNumber(get(r, 'monthlyRent')),
      pricePerBlack: trNumber(get(r, 'pricePerBlack')),
      pricePerColor: trNumber(get(r, 'pricePerColor')),
      includedBlack: sayfaAdedi(trInt(get(r, 'includedBlack'))),
      includedColor: sayfaAdedi(trInt(get(r, 'includedColor'))),
      overagePriceBlack: pozitif(trNumber(get(r, 'overagePriceBlack'))),
      overagePriceColor: pozitif(trNumber(get(r, 'overagePriceColor'))),
      installedAt: tarih ? tarih.tarih.toISOString() : null,
      installedAtPrecision: tarih ? tarih.hassasiyet : null,
      lastInvoicedPeriod: donem,
      errors: [],
    };
    // Kod dönüyor, cümle değil: ekran bunu kullanıcının dilinde yazıyor.
    if (hasCustomer && !p.customerName) p.errors.push('MUSTERI_ADI_BOS');
    // Telefon artık şart değil: kiralık cihaz listelerinde çoğu zaman yok.
    // Telefonsuz müşteri adla eşleşir (aşağıda, AKTAR).
    if (hasDevice && !p.serialNo && !(p.brand || p.model)) p.errors.push('CIHAZ_BILGISI_YOK');
    return p;
  });

  const valid = parsed.filter((p) => p.errors.length === 0);
  const invalid = parsed.filter((p) => p.errors.length > 0);
  const cihazli = (p: Satir) => !!(p.serialNo || p.brand || p.model);

  // ── ÇAKIŞMA UYARILARI (aktarımı durdurmaz; kullanıcı önceden bilsin) ──
  // Sistem müşteriyi TELEFONLA, cihazı SERİ NO ile eşleştirir. Dosyada aynı telefon farklı
  // isimlerde geçiyorsa o kayıtlar TEK müşteride birleşir — bu sürpriz olmamalı.
  // Uyarılar da yapısal: sayı ve örnek ayrı alanlarda, cümle ekranda kuruluyor.
  const warnings: Uyari[] = [];
  const namesByPhone = new Map<string, Set<string>>();
  const custBySerial = new Map<string, Set<string>>();
  for (const p of valid) {
    if (p.phone && p.customerName) {
      if (!namesByPhone.has(p.phone)) namesByPhone.set(p.phone, new Set());
      namesByPhone.get(p.phone)!.add(p.customerName.toLocaleUpperCase('tr'));
    }
    if (p.serialNo && p.customerName) {
      if (!custBySerial.has(p.serialNo)) custBySerial.set(p.serialNo, new Set());
      custBySerial.get(p.serialNo)!.add(p.customerName.toLocaleUpperCase('tr'));
    }
  }
  const phoneClashes = [...namesByPhone.entries()].filter(([, names]) => names.size > 1);
  const serialClashes = [...custBySerial.entries()].filter(([, c]) => c.size > 1);
  if (phoneClashes.length) {
    warnings.push({
      kod: 'TELEFON_CAKISMASI',
      n: phoneClashes.length,
      ornek: phoneClashes[0][0],
      isimler: [...phoneClashes[0][1]].slice(0, 2).join(' / '),
    });
  }
  if (serialClashes.length) {
    warnings.push({ kod: 'SERI_CAKISMASI', n: serialClashes.length, ornek: serialClashes[0][0] });
  }
  const noSerial = valid.filter((p) => (p.brand || p.model) && !p.serialNo).length;
  if (noSerial > 0) warnings.push({ kod: 'SERI_NO_YOK', n: noSerial });

  // ── KİRALIK ŞARTI UYARILARI ──
  // Kiralık ama kira da sayfa fiyatı da boş: bu cihazdan fatura çıkmaz.
  const kiralikCihaz = valid.filter((p) => cihazli(p) && p.isRental);
  // Kural tek yerde (lib/kira-sarti): fatura öncesi kontrol de aynısını sorar.
  const sartsiz = kiralikCihaz.filter((p) => kiraSartiEksik(p));
  if (sartsiz.length) warnings.push({ kod: 'KIRA_YOK', n: sartsiz.length, ornek: sartsiz[0].serialNo || sartsiz[0].customerName });
  // Dahil sayfa var, aşım ya da sayfa fiyatı yok: aşan sayfa bayinin varsayılan fiyatından gider.
  const dahilFiyatsiz = kiralikCihaz.filter((p) =>
    ((p.includedBlack ?? 0) > 0 && !p.overagePriceBlack && !pozitif(p.pricePerBlack)) ||
    ((p.includedColor ?? 0) > 0 && !p.overagePriceColor && !pozitif(p.pricePerColor)));
  if (dahilFiyatsiz.length) warnings.push({ kod: 'DAHIL_FIYATSIZ', n: dahilFiyatsiz.length, ornek: dahilFiyatsiz[0].serialNo || dahilFiyatsiz[0].customerName });
  if (okunamayan.tarih) warnings.push({ kod: 'TARIH_OKUNAMADI', n: okunamayan.tarih, ornek: okunamayan.tarihOrnek });
  if (okunamayan.donem) warnings.push({ kod: 'DONEM_OKUNAMADI', n: okunamayan.donem, ornek: okunamayan.donemOrnek });
  if (okunamayan.gelecek) warnings.push({ kod: 'DONEM_GELECEK', n: okunamayan.gelecek, ornek: okunamayan.gelecekOrnek });
  // Dosyanın nasıl okunduğu: bayi "neden 1. satır yok" diye sormasın.
  if (baslikNo > 0) warnings.push({ kod: 'BASLIK_ASAGIDA', n: baslikNo, ornek: kes(headers.filter(Boolean).slice(0, 3).join(', '), 60) });
  if (usttenAlinan) warnings.push({ kod: 'MUSTERI_USTTEN', n: usttenAlinan });
  const telefonsuz = new Set(valid.filter((p) => p.customerName && !p.phone).map((p) => adAnahtari(p.customerName)));
  if (telefonsuz.size) warnings.push({ kod: 'TELEFON_YOK', n: telefonsuz.size, ornek: valid.find((p) => p.customerName && !p.phone)?.customerName });

  // ── AYLIK KİRA ÖZETİ ──
  // Kurulumu biz yaptığımızda bayiye sorulan tek soru: "aylık kira geliriniz
  // aşağı yukarı bu mu?" Tutmazsa kolon yanlış eşlenmiştir; ilk fatura
  // kesilmeden yakalanır.
  const musteriKira = new Map<string, { ad: string; cihaz: number; toplam: number }>();
  let kiraToplam = 0, kiraCihaz = 0;
  for (const p of kiralikCihaz) {
    const kira = pozitif(p.monthlyRent);
    if (!kira) continue;
    kiraToplam += kira; kiraCihaz++;
    const anahtar = p.phone || p.customerName;
    const m = musteriKira.get(anahtar) ?? { ad: p.customerName, cihaz: 0, toplam: 0 };
    m.cihaz++; m.toplam += kira;
    musteriKira.set(anahtar, m);
  }
  const kiraOzeti: KiraOzeti = {
    toplam: Math.round(kiraToplam * 100) / 100,
    cihaz: kiraCihaz,
    kirasiz: kiralikCihaz.filter((p) => !pozitif(p.monthlyRent)).length,
    musteriler: [...musteriKira.values()]
      .sort((a, b) => b.toplam - a.toplam)
      .slice(0, 10)
      .map((m) => ({ ...m, toplam: Math.round(m.toplam * 100) / 100 })),
  };

  // ── ÖNİZLEME ──
  if (g.dryRun) {
    return {
      ok: true,
      govde: {
        headers, mapping, delimiter,
        totalRows: dataRows.length,
        validRows: valid.length,
        invalidRows: invalid.length,
        willCreateCustomers: new Set(valid.filter((p) => p.customerName).map((p) => p.phone || `ad:${adAnahtari(p.customerName)}`)).size,
        willCreateDevices: valid.filter(cihazli).length,
        warnings,
        kiraOzeti,
        sample: parsed.slice(0, 8),
        errorsSample: invalid.slice(0, 10),
      },
    };
  }

  if (valid.length === 0) {
    return { ok: false, hata: 'AKTARILABILECEK_GECERLI_SATIR_YOK', durum: 400, ek: { kod: 'GECERLI_SATIR_YOK', invalidRows: invalid.length } };
  }

  // ── AKTAR ──
  let customersCreated = 0, customersUpdated = 0, devicesCreated = 0, devicesUpdated = 0;
  // Seri no'su olmayan cihazlar: kimlikleri satır içeriğinden türetiliyor, o
  // yüzden çoğalmıyorlar — ama SAYAÇ E-POSTASI seri numarasıyla eşleştiği
  // için bu cihazların sayacı otomatik işlenemez. Bayi bunu bilmeli.
  let seriNosuz = 0;
  // Devredilen sayac icin yazilan acilis okumasi sayisi (faturalanmaz).
  let baslangicOkumasi = 0;
  const failures: { row: number; error: string; kod?: string }[] = [];
  // Dosya içi eşleşme: telefon varsa telefon, yoksa "ad:<adAnahtari>".
  const custIdByPhone = new Map<string, string>();

  // Ada göre eşleşme için bayinin müşterileri BİR KEZ okunur (Türkçe harf
  // ve noktalama farkı burada, JS'te yok sayılıyor; veritabanında ILIKE
  // joker karakterleri yüzünden kullanılmıyor). Yalnız gerekiyorsa.
  const adlaGerekli = valid.some((p) => p.customerName && !p.phone);
  const adIndeksi = new Map<string, { id: string; phone: string }>();
  let adIndeksiKuruldu = false;
  const adIndeksiniKur = async () => {
    if (adIndeksiKuruldu) return;
    adIndeksiKuruldu = true;
    const hepsi = await prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true, phone: true }, orderBy: { createdAt: 'asc' } });
    for (const c of hepsi) { const k = adAnahtari(c.name); if (k && !adIndeksi.has(k)) adIndeksi.set(k, { id: c.id, phone: c.phone }); }
  };
  if (adlaGerekli) await adIndeksiniKur();

  for (const p of valid) {
    try {
      // 1) Müşteri — telefonla (yoksa adla) bulunur; varsa güncellenir, yoksa açılır.
      let customerId: string | null = null;
      const dosyaAnahtari = p.phone || `ad:${adAnahtari(p.customerName)}`;
      if (p.customerName) {
        customerId = custIdByPhone.get(dosyaAnahtari) || null;
        if (!customerId) {
          let existing: { id: string } | null = null;
          if (p.phone) {
            existing = await prisma.customer.findFirst({ where: { tenantId, phone: p.phone }, select: { id: true } });
            if (!existing) {
              // Daha önce telefonsuz (yer tutuculu) açılmış aynı adlı müşteri
              // varsa telefon şimdi ona yazılır; ikinci müşteri açılmaz.
              await adIndeksiniKur();
              const ayni = adIndeksi.get(adAnahtari(p.customerName));
              if (ayni && ayni.phone.startsWith('BOS-')) {
                await prisma.customer.update({ where: { id: ayni.id }, data: { phone: p.phone } });
                ayni.phone = p.phone;
                existing = { id: ayni.id };
              }
            }
          } else {
            const ayni = adIndeksi.get(adAnahtari(p.customerName));
            if (ayni) existing = { id: ayni.id };
          }
          if (existing) {
            customerId = existing.id;
            // Yalnız DOLU gelen alanlar yazılıyor: eski dosyada boş olan
            // bir kolon, sistemde zaten girilmiş bilgiyi silmemeli.
            const upd: Record<string, string> = {};
            if (p.address) upd.address = p.address;
            if (p.taxNo) upd.taxNo = p.taxNo;
            if (p.legalName) upd.legalName = p.legalName;
            if (p.taxOffice) upd.taxOffice = p.taxOffice;
            if (p.city) upd.city = p.city;
            if (p.district) upd.district = p.district;
            if (Object.keys(upd).length) {
              await prisma.customer.update({ where: { id: existing.id }, data: upd });
              customersUpdated++;
            }
          } else {
            const c = await prisma.customer.create({
              data: {
                tenantId, name: p.customerName, phone: p.phone || telefonsuzKimlik(p.customerName),
                address: p.address || null, taxNo: p.taxNo || null,
                legalName: p.legalName || null, taxOffice: p.taxOffice || null,
                city: p.city || null, district: p.district || null,
              },
            });
            customerId = c.id;
            customersCreated++;
            const k = adAnahtari(p.customerName);
            if (k && !adIndeksi.has(k)) adIndeksi.set(k, { id: c.id, phone: c.phone });
          }
          custIdByPhone.set(dosyaAnahtari, customerId);
        }
      }

      // 2) Cihaz (tenant+seriNo tekil)
      if (!cihazli(p)) continue;
      if (!customerId) { failures.push({ row: p.row, error: 'Cihaz için müşteri bulunamadı', kod: 'MUSTERI_BULUNAMADI' }); continue; }

      // ── SERİ NO YOKSA: RASTGELE DEĞİL, DETERMİNİSTİK KİMLİK ─────────
      // Eskiden `crypto.randomBytes` ile RASTGELE seri üretiliyordu. Rastgele
      // seri hiçbir zaman mevcut kayıtla eşleşmez: bayi aynı dosyayı ikinci
      // kez yüklediğinde (ki eşleme kolonunu düzeltip tekrar yüklemek çok
      // olağan) seri no'suz her cihaz YENİDEN oluşuyordu. Kiralıksa kirası
      // iki kez faturalanıyordu.
      //
      // Artık kimlik, satırın kendi içeriğinden türetiliyor: aynı satır
      // ikinci kez yüklenince AYNI kimliği üretir ve eşleşir, çoğalmaz.
      const seriYok = !p.serialNo;
      const serial = p.serialNo || `IMP-${crypto
        .createHash('sha1')
        .update([customerId, p.brand || '', p.model || '', p.location || ''].join('|').toLocaleLowerCase('tr-TR'))
        .digest('hex')
        .slice(0, 10)
        .toUpperCase()}`;
      if (seriYok) seriNosuz++;
      const existing = await prisma.device.findFirst({
        where: { tenantId, serialNo: serial },
        select: { id: true, lastInvoicedPeriod: true, customerId: true },
      });

      // Marka/model sütunları sık sık ters doldurulmuş geliyor (bir bayide %97).
      // Tek yerde düzeltiliyor ki hata sisteme birikmesin.
      // Tanınmayan marka olduğu gibi bırakılır — tahmin YAZILMAZ.
      const nz = normalizeBrandModel(p.brand, p.model);
      const base: Prisma.DeviceUncheckedUpdateInput & { brand: string; model: string } = {
        brand: nz.brand || 'Bilinmiyor',
        model: nz.model || 'Bilinmiyor',
        location: p.location || null,
      };
      // KİRALIK İŞARETİ SİLİNMEZ: dosyada kiralık/kira kolonu yoksa (ya da bu
      // satırda boşsa) mevcut cihazın işaretine dokunulmaz. Eskiden koşulsuz
      // yazılıyordu: yalnız "Müşteri | Seri No | Sayaç" içeren bir güncelleme
      // dosyası bütün kiralık cihazları kiralık olmaktan çıkarıyor, kira ve
      // sayfa faturası sessizce duruyordu. Yeni cihazda dosyanın dediği geçer.
      if (!existing || p.kiralikBelirtildi) base.isRental = p.isRental;
      // SAYAÇ: zinciri olan cihazda kartı dosyadan ezmeyiz — fatura farkı son
      // OKUMAYA göre hesaplanır; kart başka bir sayı gösterirse bayi ile fatura
      // iki ayrı sayıya bakar. Okuması olmayan cihazda dosyadaki sayaç
      // başlangıç okuması olur (aşağıda).
      const okumasiVar = existing ? (await prisma.counterReading.count({ where: { tenantId, deviceId: existing.id } })) > 0 : false;
      const sayacYaz = !okumasiVar && (p.counterBlack != null || p.counterColor != null);
      if (sayacYaz && p.counterBlack != null) base.counterBlack = p.counterBlack;
      if (sayacYaz && p.counterColor != null) base.counterColor = p.counterColor;
      if (p.monthlyRent != null) base.monthlyRent = p.monthlyRent;
      if (p.pricePerBlack != null) base.pricePerBlack = p.pricePerBlack;
      if (p.pricePerColor != null) base.pricePerColor = p.pricePerColor;
      // Kiralık şartları: yalnız DOLU gelen yazılır (boş kolon girilmiş şartı silmez).
      if (p.includedBlack != null) base.includedBlack = p.includedBlack;
      if (p.includedColor != null) base.includedColor = p.includedColor;
      if (p.overagePriceBlack != null) base.overagePriceBlack = p.overagePriceBlack;
      if (p.overagePriceColor != null) base.overagePriceColor = p.overagePriceColor;
      if (p.installedAt) {
        base.installedAt = new Date(p.installedAt);
        base.installedAtPrecision = p.installedAtPrecision;
        base.installDateUnknown = false;
      }
      // SON FATURALANAN AY = kira tabanı (lib/kira-donemi) ve yalnız İLERİ gider.
      // Geri çekilseydi eski sistemde kesilmiş ayların kirası yeniden
      // "kesilmemiş" görünür, ikinci kez faturalanırdı.
      if (p.lastInvoicedPeriod && (!existing?.lastInvoicedPeriod || existing.lastInvoicedPeriod < p.lastInvoicedPeriod)) {
        base.lastInvoicedPeriod = p.lastInvoicedPeriod;
      }

      // Zincirin başı: delta 0, faturaya girmez (aşağıdaki açıklama).
      const baslangicYaz = (deviceId: string) => prisma.counterReading.create({
        data: {
          tenantId, deviceId, customerId,
          counterBlack: p.counterBlack ?? 0,
          counterColor: p.counterColor ?? 0,
          deltaBlack: 0, deltaColor: 0,
          calculatedCost: 0,
          billed: true,
          source: GOC_KAYNAGI,
        },
      });

      if (existing) {
        // Cihaz başka müşteriye geçiyorsa eski müşteride okunmuş sayfalar onda kalsın.
        if (existing.customerId !== customerId) await cihazAyriliyor(prisma, tenantId, existing.id, existing.customerId);
        await prisma.device.update({ where: { id: existing.id }, data: { ...base, customerId } });
        devicesUpdated++;
        // Okuması hiç olmayan mevcut cihaz: dosyadaki sayaç başlangıç okuması
        // olur. Yoksa ilk gerçek okuma zincirin başı sayılır (fark 0) ve o
        // güne kadar basılan sayfalar hiçbir faturaya girmez.
        if (sayacYaz) { await baslangicYaz(existing.id); baslangicOkumasi++; }
      } else {
        const yeniCihaz = await prisma.device.create({
          data: {
            ...base,
            tenantId, customerId, serialNo: serial,
            publicCode: `DEV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            qrTokenHash: crypto.randomBytes(16).toString('hex'),
          } as Prisma.DeviceUncheckedCreateInput,
        });
        devicesCreated++;

        // ── BAŞLANGIÇ OKUMASI ────────────────────────────────────────
        // İçe aktarma sayacı YALNIZCA cihaz kartına yazıyordu; okuma
        // kaydı üretmiyordu. Sonuç: cihazda "142.000 sayfa" yazıyor ama
        // okuma geçmişi boş olduğu için ilk gerçek okumada fark
        // hesaplanamıyor, o cihaz faturalanamıyordu. (Ölçüldü: bir bayide
        // 552 cihazda 69,7 milyon sayfa yazılı, counterReading sayısı 0.)
        //
        // Artık zincirin BAŞI yazılıyor: delta 0 — devredilen sayaç bu
        // ayın kullanımı değildir — ve `billed: true` ile kapalı, yani
        // faturaya asla girmez. Bundan sonraki ilk gerçek okuma farkı
        // doğru hesaplar. Kaynak GOC: kurulum ekranı bunu sayaç toplama saymaz.
        if (p.counterBlack != null || p.counterColor != null) {
          await baslangicYaz(yeniCihaz.id);
          baslangicOkumasi++;
        }
      }
    } catch (e: unknown) {
      const mesaj = e instanceof Error ? e.message : '';
      failures.push({ row: p.row, error: mesaj.slice(0, 160) || 'Bilinmeyen hata' });
    }
  }

  return {
    ok: true,
    govde: {
      ok: true,
      customersCreated, customersUpdated, devicesCreated, devicesUpdated,
      seriNosuz,
      baslangicOkumasi,
      kiraOzeti,
      // Sessiz kalmasın: seri no'suz cihaz sayaç e-postasıyla EŞLEŞEMEZ.
      seriNosuzUyari: seriNosuz > 0
        ? `${seriNosuz} cihazın seri numarası yoktu. Bu cihazlar eklendi ama cihazdan gelen sayaç e-postası seri numarasıyla eşleştiği için sayaçları otomatik işlenemez. Seri numaralarını cihaz kartından girmeniz gerekir.`
        : null,
      skippedInvalid: invalid.length,
      failed: failures.length,
      failures: failures.slice(0, 20),
      invalidSample: invalid.slice(0, 10),
    },
  };
}
