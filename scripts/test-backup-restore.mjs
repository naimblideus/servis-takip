/**
 * Yedekten geri yükleme dönüşüm testleri — veritabanı GEREKTİRMEZ.
 *   node scripts/test-backup-restore.mjs
 *
 * Neden saf fonksiyon testi: geri yüklemenin kendisi veri siler; onu canlıya
 * benzer bir yerde denemek pahalı ve risklidir. Silme/yazma sırası ve alan
 * dönüşümü ise saf mantıktır — asıl bozulan da hep orasıdır.
 *
 * Not: bu test şemayı da denetler. schema.prisma'da `At`/`Date` ile bitip
 * DateTime OLMAYAN bir alan açılırsa tarih kuralı sessizce yanlışa döner;
 * son test bunu yakalar.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');

// TS dosyasını GERÇEK derleyiciyle çeviriyoruz. Elle regex ile tip silmek
// sessizce farklı bir kod üretebilir — o zaman test, kaynağı değil kendi
// kopyasını test etmiş olur.
const gecici = mkdtempSync(join(tmpdir(), 'st-restore-test-'));
let mod;
try {
  // node ile doğrudan tsc — npx/npx.cmd platforma göre değişir, bu değişmez.
  execFileSync(
    process.execPath,
    [join(kok, 'node_modules/typescript/bin/tsc'), join(kok, 'src/lib/backup-restore.ts'),
      '--outDir', gecici, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'],
    { stdio: 'pipe' },
  );
  mod = await import(pathToFileURL(join(gecici, 'backup-restore.js')).href);
} finally {
  rmSync(gecici, { recursive: true, force: true });
}
const { YAZMA_SIRASI, MODEL_ADI, tarihAlaniMi, tarihleriCevir, dogrulaYedek, hazirlaSatirlar, hazirlaKullanicilar, hazirlaFirmaAyarlari, dosyadaBolumVar } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, fn) => {
  try { fn(); console.log(`  ✓ ${ad}`); gecti++; }
  catch (e) { console.log(`  ✗ ${ad}\n      ${e.message}`); kaldi++; }
};
const esit = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); };
const dogru = (v, m) => { if (!v) throw new Error(m ?? 'doğru bekleniyordu'); };

const ornekYedek = () => ({
  _meta: { format: 'nexus-servis-backup', version: 1, createdAt: '2026-08-01T10:00:00.000Z', tenantName: 'Kabim Elektronik', photosIncluded: false },
  tenant: { name: 'Kabim Elektronik', phone: '05321112233', address: 'Bursa', taxOffice: 'Nilüfer', taxNumber: '1234567890', pricePerBlack: '0.4500', pricePerColor: '2.1000' },
  users: [{ id: 'u1', name: 'Ahmet', email: 'a@k.com', role: 'ADMIN', isActive: true }],
  customers: [{ id: 'c1', tenantId: 'ESKI', name: 'ABC Ltd', createdAt: '2026-01-05T08:00:00.000Z' }],
  devices: [{ id: 'd1', tenantId: 'ESKI', customerId: 'c1', brand: 'Canon', installedAt: '2026-02-01T00:00:00.000Z' }],
  tickets: [{ id: 't1', tenantId: 'ESKI', deviceId: 'd1', customerId: 'c1', createdByUserId: 'u1', completedAt: null }],
  ticketParts: [], readings: [{ id: 'r1', tenantId: 'ESKI', deviceId: 'd1', readingDate: '2026-03-01T00:00:00.000Z', counterBlack: 15000 }],
  parts: [], accountEntries: [], payments: [], invoices: [], invoiceLines: [],
});

console.log('\nYedekten geri yükleme testleri\n');

t('geçerli yedek doğrulanır', () => {
  const s = dogrulaYedek(ornekYedek());
  dogru(s.ok, 'geçerli yedek reddedildi: ' + s.hatalar.join(', '));
  esit(s.sayimlar.customers, 1);
  esit(s.kaynakFirma, 'Kabim Elektronik');
});

t('yabancı dosya reddedilir', () => {
  const s = dogrulaYedek({ _meta: { format: 'baska-sistem', version: 1 } });
  dogru(!s.ok, 'yabancı format kabul edildi');
});

t('boş/bozuk girdi çökmez', () => {
  dogru(!dogrulaYedek(null).ok);
  dogru(!dogrulaYedek('metin').ok);
  dogru(!dogrulaYedek({}).ok);
});

t('fotoğrafsız yedek uyarı verir', () => {
  const s = dogrulaYedek(ornekYedek());
  dogru(s.uyarilar.some((u) => u.includes('fotoğraf')), 'fotoğraf uyarısı yok');
});

t('şifresiz kullanıcı uyarısı verilir', () => {
  const s = dogrulaYedek(ornekYedek());
  dogru(s.uyarilar.some((u) => u.includes('ŞİFRE YOK')), 'şifre uyarısı yok');
});

t('tenantId hedefe yeniden yazılır', () => {
  const h = hazirlaSatirlar(ornekYedek(), 'YENI');
  for (const tab of YAZMA_SIRASI) for (const r of h[tab]) esit(r.tenantId, 'YENI', tab);
});

t('kimlikler korunur (bağlantılar bozulmasın)', () => {
  const h = hazirlaSatirlar(ornekYedek(), 'YENI');
  esit(h.devices[0].customerId, 'c1');
  esit(h.tickets[0].deviceId, 'd1');
  esit(h.readings[0].deviceId, 'd1');
});

t('ISO metinler Date nesnesine çevrilir', () => {
  const h = hazirlaSatirlar(ornekYedek(), 'YENI');
  dogru(h.customers[0].createdAt instanceof Date, 'createdAt Date değil');
  dogru(h.devices[0].installedAt instanceof Date, 'installedAt Date değil');
  dogru(h.readings[0].readingDate instanceof Date, 'readingDate Date değil');
});

t('null tarih null kalır, sayı bozulmaz', () => {
  const h = hazirlaSatirlar(ornekYedek(), 'YENI');
  esit(h.tickets[0].completedAt, null);
  esit(h.readings[0].counterBlack, 15000);
});

t('tarih olmayan alan Date yapılmaz', () => {
  const c = tarihleriCevir({ name: '2026-01-01T00:00:00.000Z', note: 'metin' });
  dogru(typeof c.name === 'string', 'name yanlışlıkla Date oldu');
});

t('geçersiz tarih metni olduğu gibi kalır', () => {
  const c = tarihleriCevir({ createdAt: 'tarih değil' });
  esit(c.createdAt, 'tarih değil');
});

t('yazma sırası FK güvenli', () => {
  const s = YAZMA_SIRASI;
  const i = (x) => s.indexOf(x);
  dogru(i('customers') < i('devices'), 'cihaz müşteriden önce yazılıyor');
  dogru(i('customers') < i('invoices'), 'fatura müşteriden önce');
  dogru(i('invoices') < i('invoiceLines'), 'fatura satırı faturadan önce');
  dogru(i('devices') < i('tickets'), 'fiş cihazdan önce');
  dogru(i('invoices') < i('tickets'), 'fiş faturadan önce (ticket.invoiceId)');
  dogru(i('tickets') < i('ticketParts'), 'fiş parçası fişten önce');
  dogru(i('parts') < i('ticketParts'), 'fiş parçası parçadan önce');
  dogru(i('tickets') < i('readings'), 'sayaç fişten önce (reading.ticketId)');
  dogru(i('tickets') < i('payments'), 'tahsilat fişten önce');
  // Sonradan eklenen tablolar
  dogru(i('customers') < i('financialTransactions'), 'kasa müşteriden önce (transaction.customerId)');
  dogru(i('tickets') < i('financialTransactions'), 'kasa fişten önce (transaction.ticketId)');
  dogru(i('invoices') < i('invoicePayments'), 'tahsilat dağıtımı faturadan önce');
  dogru(i('payments') < i('invoicePayments'), 'tahsilat dağıtımı ödemeden önce');
});

t('kasa, gider ve tahsilat dağıtımı yedeğin KAPSAMINDA', () => {
  // Bunlar "tam yedek"te hiç yoktu: felaket sonrası boş kiracıya geri
  // yüklerken kasa ve gider defteri yok oluyordu, geri getirmenin yolu da
  // yoktu. Bu test o boşluğun geri açılmasını engeller.
  for (const zorunlu of ['financialTransactions', 'expenses', 'invoicePayments', 'counterEmails', 'printerStock']) {
    dogru(YAZMA_SIRASI.includes(zorunlu), `${zorunlu} yedek kapsamında değil`);
    dogru(MODEL_ADI[zorunlu], `${zorunlu} için model adı yok`);
  }
});

t('dosyada olmayan bölüm SİLİNMEZ (eski yedek kasayı yok etmesin)', () => {
  const y = ornekYedek();
  // Eski sürüm yedeğinde bu bölümler hiç yok
  dogru(!dosyadaBolumVar(y, 'financialTransactions'), 'kasa bölümü var sayıldı');
  dogru(!dosyadaBolumVar(y, 'expenses'), 'gider bölümü var sayıldı');
  // Bölümü OLAN tablo normal davranır
  dogru(dosyadaBolumVar(y, 'customers'), 'müşteri bölümü yok sayıldı');
  // Boş dizi de "bölüm var" demektir: bilerek boşaltılmış yedek geçerlidir
  dogru(dosyadaBolumVar({ expenses: [] }, 'expenses'), 'boş dizi bölüm sayılmadı');
  // Uyarı metni artık "boş geri yüklenir" değil "olduğu gibi bırakılır" demeli
  const s2 = dogrulaYedek(y);
  const u = s2.uyarilar.find((x) => x.includes('financialTransactions'));
  dogru(u && u.includes('OLDUĞU GİBİ'), 'eksik bölüm uyarısı silme vaadi veriyor: ' + u);
});

t('her tablonun bir Prisma modeli var', () => {
  for (const tab of YAZMA_SIRASI) dogru(MODEL_ADI[tab], `${tab} için model adı yok`);
});

t('geri yüklenen kullanıcı GİREMEZ', () => {
  const k = hazirlaKullanicilar(ornekYedek(), 'YENI', 'girilemez-xyz');
  esit(k[0].isActive, false, 'kullanıcı aktif geldi');
  esit(k[0].passwordHash, 'girilemez-xyz');
  dogru(!k[0].passwordHash.startsWith('$2'), 'bcrypt biçiminde özet — eşleşebilir');
  esit(k[0].tenantId, 'YENI');
});

t('firma ADI geri yüklenmez, fiyatlar yüklenir', () => {
  const a = hazirlaFirmaAyarlari(ornekYedek());
  esit(a.name, undefined, 'firma adı ezilecekti');
  esit(a.pricePerBlack, '0.4500');
  esit(a.taxNumber, '1234567890');
});

t('eksik bölüm çökme yerine uyarı üretir', () => {
  const y = ornekYedek(); delete y.payments;
  const s = dogrulaYedek(y);
  dogru(s.ok, 'eksik bölüm hata sayıldı');
  dogru(s.uyarilar.some((u) => u.includes('payments')), 'eksik bölüm uyarısı yok');
  esit(hazirlaSatirlar(y, 'YENI').payments, []);
});

t('şema kuralı hâlâ geçerli: At/Date ile biten her alan DateTime', () => {
  const sema = readFileSync(join(kok, 'prisma/schema.prisma'), 'utf8');
  const yanlis = [];
  for (const satir of sema.split('\n')) {
    const m = satir.match(/^\s+([a-zA-Z]+)\s+([A-Za-z]+)/);
    if (!m) continue;
    const [, alan, tip] = m;
    if (tarihAlaniMi(alan) && tip !== 'DateTime') yanlis.push(`${alan}: ${tip}`);
  }
  esit(yanlis, [], 'tarih kuralı bozulmuş, geri yükleme bu alanları yanlış çevirir —');
});

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
