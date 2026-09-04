/**
 * YEDEKTEN GERİ YÜKLEME — /api/backup çıktısındaki JSON'u geri yazar.
 *
 * "Yedeğiniz var mı?" kolay soru. Kurumsal alıcının sorduğu asıl soru
 * "geri yükleme denendi mi?" — çünkü denenmemiş yedek yedek değildir.
 * Bu dosya saf (veritabanısız) dönüşüm mantığını tutar; böylece
 * scripts/test-backup-restore.mjs onu gerçek veri kaybı riski olmadan test eder.
 *
 * ── ÖNEMLİ SINIRLAR (bilerek) ────────────────────────────────────────────
 * 1. Yedekte ŞİFRE ÖZETİ YOK. İndirilebilir bir dosyaya parola özeti koymak
 *    güvenlik açığıdır. Bu yüzden eksik kullanıcılar PASİF ve girilemez
 *    şifreyle oluşturulur; yöneticinin şifre ataması gerekir.
 * 2. ServiceTicket.createdByUserId ZORUNLU bir kullanıcı bağıdır. Bu yüzden
 *    kullanıcıların önce oluşturulması şart — yoksa fişler geri yüklenemez.
 * 3. Firma ADI geri yüklenmez (başka bir bayiye yüklenirse adı ezmesin);
 *    fiyat/vergi/adres ayarları geri yüklenir.
 */

export const YEDEK_FORMAT = 'nexus-servis-backup';

/** FK'ye güvenli yazma sırası. Ters çevrilmiş hâli silme sırasıdır. */
export const YAZMA_SIRASI = [
  'customers',    // → tenant
  'parts',        // → tenant
  'expenses',     // → tenant  (GİDER DEFTERİ — "tam yedek"te hiç yoktu)
  'printerStock', // → tenant  (yazıcı stoğu)
  'counterEmails', // → tenant (sayaç e-posta kuyruğu; deviceId FK değil)
  'devices',      // → customer
  'invoices',     // → customer
  'invoiceLines', // → invoice
  'tickets',      // → device, customer, user, invoice?
  'ticketParts',  // → ticket, part
  'readings',     // → device, ticket?
  'accountEntries', // → customer
  'payments',     // → ticket?, customer?
  'financialTransactions', // → customer?, ticket?  (KASA — yoktu)
  'invoicePayments', // → invoice, payment  (tahsilat dağıtımı; EN SON)
] as const;

export type Tablo = (typeof YAZMA_SIRASI)[number];

/** Prisma model adları — silme/yazma sırasında $transaction içinde kullanılır. */
export const MODEL_ADI: Record<Tablo, string> = {
  customers: 'customer',
  parts: 'part',
  expenses: 'expense',
  printerStock: 'printerStock',
  counterEmails: 'counterEmail',
  devices: 'device',
  invoices: 'customerInvoice',
  invoiceLines: 'invoiceLine',
  tickets: 'serviceTicket',
  ticketParts: 'ticketPart',
  readings: 'counterReading',
  accountEntries: 'accountEntry',
  payments: 'payment',
  financialTransactions: 'financialTransaction',
  invoicePayments: 'invoicePayment',
};

/**
 * Dosyada BÖLÜMÜ OLMAYAN tabloya geri yükleme DOKUNMAZ.
 *
 * Neden: eski sürüm yedekleri kasayı, gideri, stoğu ve tahsilat dağıtımını
 * hiç içermiyordu. "Bölüm yoksa boş yaz" davranışı, elindeki eski dosyayla
 * geri yükleme yapan bayinin kasasını ve gider defterini SİLERDİ — hem de
 * yedekte karşılığı olmadığı için geri getirmenin yolu yok. Artık eksik
 * bölüm = "bu tabloya karışma" ve önizlemede açıkça yazılır.
 */
export function dosyadaBolumVar(ham: any, t: Tablo): boolean {
  return Array.isArray(ham?.[t]);
}

/**
 * Şemadaki TÜM DateTime alanları `...At`, `...Date` ile biter ya da tam olarak
 * `date`'tir; `At`/`Date` ile bitip DateTime OLMAYAN tek bir alan yoktur
 * (schema.prisma üzerinden doğrulandı). Kural bu yüzden isim tabanlı — içerik
 * tahminine dayanan bir kural, tarih gibi görünen bir metin alanını bozardı.
 */
export function tarihAlaniMi(anahtar: string): boolean {
  return anahtar === 'date' || anahtar.endsWith('At') || anahtar.endsWith('Date');
}

/** JSON'dan gelen ISO metinleri Date'e çevirir; geçersizse dokunmaz. */
export function tarihleriCevir<T extends Record<string, any>>(satir: T): T {
  const cikti: any = { ...satir };
  for (const [k, v] of Object.entries(cikti)) {
    if (v == null || !tarihAlaniMi(k) || typeof v !== 'string') continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) cikti[k] = d;
  }
  return cikti;
}

export interface DogrulamaSonuc {
  ok: boolean;
  hatalar: string[];
  uyarilar: string[];
  sayimlar: Record<string, number>;
  kullaniciSayisi: number;
  fotografDahil: boolean;
  kaynakFirma: string;
  olusturma: string | null;
}

/** Dosya gerçekten bizim yedeğimiz mi, ve içinde ne var? */
export function dogrulaYedek(ham: any): DogrulamaSonuc {
  const hatalar: string[] = [];
  const uyarilar: string[] = [];
  const sayimlar: Record<string, number> = {};

  if (!ham || typeof ham !== 'object') {
    return { ok: false, hatalar: ['Dosya okunamadı ya da JSON değil'], uyarilar, sayimlar, kullaniciSayisi: 0, fotografDahil: false, kaynakFirma: '', olusturma: null };
  }
  const meta = ham._meta ?? {};
  if (meta.format !== YEDEK_FORMAT) {
    hatalar.push(`Bu dosya bir Nextus Servis yedeği değil (format: ${meta.format ?? 'yok'})`);
  }
  if (meta.version !== 1) {
    hatalar.push(`Desteklenmeyen yedek sürümü: ${meta.version ?? 'yok'}`);
  }

  for (const t of YAZMA_SIRASI) {
    const dizi = ham[t];
    if (dizi === undefined) {
      sayimlar[t] = 0;
      // "Boş geri yüklenir" DEĞİL: eski yedeklerde kasa/gider bölümü yok ve
      // boş yazmak hedefteki veriyi yok ederdi. Dokunulmuyor.
      uyarilar.push(`"${t}" bölümü dosyada yok — bu tablo OLDUĞU GİBİ BIRAKILIR (silinmez, yazılmaz)`);
      continue;
    }
    if (!Array.isArray(dizi)) { hatalar.push(`"${t}" bir liste değil`); sayimlar[t] = 0; continue; }
    sayimlar[t] = dizi.length;
  }

  const kullanicilar = Array.isArray(ham.users) ? ham.users : [];
  const fotografDahil = Boolean(meta.photosIncluded);
  if (!fotografDahil && (sayimlar.readings ?? 0) > 0) {
    uyarilar.push('Yedek fotoğrafsız alınmış — sayaç fotoğrafları geri gelmez (sayaç değerleri gelir)');
  }
  if (kullanicilar.length > 0) {
    uyarilar.push(`${kullanicilar.length} kullanıcı yedekte var ama ŞİFRE YOK — eksik olanlar pasif oluşturulur, yönetici şifre atamalı`);
  }

  return {
    ok: hatalar.length === 0,
    hatalar, uyarilar, sayimlar,
    kullaniciSayisi: kullanicilar.length,
    fotografDahil,
    kaynakFirma: String(meta.tenantName ?? ''),
    olusturma: meta.createdAt ?? null,
  };
}

/**
 * Satırları hedef kiracıya göre hazırla: tenantId yeniden yazılır, tarihler
 * Date'e çevrilir. Kimlikler (cuid) korunur — aynı kiracıya geri yüklemede
 * fiş numaraları ve bağlantılar bozulmasın diye.
 */
export function hazirlaSatirlar(ham: any, hedefTenantId: string): Record<Tablo, any[]> {
  const cikti = {} as Record<Tablo, any[]>;
  for (const t of YAZMA_SIRASI) {
    const dizi: any[] = Array.isArray(ham[t]) ? ham[t] : [];
    cikti[t] = dizi.map((r) => tarihleriCevir({ ...r, tenantId: hedefTenantId }));
  }
  return cikti;
}

/** Yedekteki kullanıcıları hedef kiracıda oluşturulacak hâle getir (pasif, girilemez şifre). */
export function hazirlaKullanicilar(ham: any, hedefTenantId: string, girilemezHash: string) {
  const dizi: any[] = Array.isArray(ham.users) ? ham.users : [];
  return dizi.map((u) => ({
    id: u.id,
    tenantId: hedefTenantId,
    email: u.email,
    name: u.name ?? u.email,
    role: u.role ?? 'TECHNICIAN',
    // Geri yüklenen kullanıcı GİREMEZ: pasif + hiçbir parolayla eşleşmeyen özet.
    isActive: false,
    passwordHash: girilemezHash,
  }));
}

/** Tenant'ta geri yüklenecek ayarlar — firma ADI bilerek dışarıda. */
export function hazirlaFirmaAyarlari(ham: any) {
  const t = ham?.tenant;
  if (!t || typeof t !== 'object') return null;
  const ayar: Record<string, any> = {};
  for (const k of ['phone', 'address', 'taxOffice', 'taxNumber', 'pricePerBlack', 'pricePerColor']) {
    if (t[k] !== undefined && t[k] !== null) ayar[k] = t[k];
  }
  return Object.keys(ayar).length ? ayar : null;
}
