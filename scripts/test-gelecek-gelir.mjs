// GELECEK GELİR — lib/gelecek-gelir.ts + lib/gelecek-gelir-veri.ts + /gelecek-gelir
// Çalıştır:  node scripts/test-gelecek-gelir.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bu ekran bayiye "önümüzdeki 12 ayda şu kadar paran SÖZLEŞMEYLE bağlı"
// diyor; bankaya, ortağa gösterilecek rakam bu. Yanlışsa en pahalı yerde
// yanlış: sözleşme bitişinde kesilmeyen gelir, uydurulmuş zam, karışmış
// para birimi ya da faturadan farklı sayfa ücreti. Hepsi burada kilitli.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLE ────────────────────────────────────────────────────────────────
// Yeni lib dosyası eklenirse bu listeye eklenmeli.
const g = mkdtempSync(join(tmpdir(), 'st-gelir-'));
const DOSYALAR = ['gelecek-gelir', 'gelecek-gelir-veri', 'invoicing', 'sozlesme'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'),
    ...DOSYALAR.map((d) => join(KOK, `src/lib/${d}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
for (const d of DOSYALAR) {
  const yol = join(g, `${d}.js`);
  let s = readFileSync(yol, 'utf8');
  s = s.split("'@/lib/prisma'").join("'./prisma-shim.js'").split("'@prisma/client'").join(JSON.stringify(P));
  for (const x of DOSYALAR) s = s.split(`'@/lib/${x}'`).join(`'./${x}.js'`);
  writeFileSync(yol, s);
}
const gg = await import(pathToFileURL(join(g, 'gelecek-gelir.js')).href);
const inv = await import(pathToFileURL(join(g, 'invoicing.js')).href);
const veriMod = await import(pathToFileURL(join(g, 'gelecek-gelir-veri.js')).href);

const GUN = 86_400_000;
const simdi = new Date(2026, 9, 18, 2, 0); // 18 Ekim 2026, yerel
const yerel = (y, a, gun) => new Date(y, a - 1, gun);
const yak = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;

// ── AYLIK SAYFA ──────────────────────────────────────────────────────────
console.log('\nAylık sayfa (son 3 ay)\n');
{
  const bas = new Date(simdi.getTime() - 95 * GUN);
  const ozet = { siyah: 9000, renkli: 600, ilk: new Date(bas.getTime() + 30.4375 * GUN), son: new Date(bas.getTime() + 91.3125 * GUN), onceki: bas };
  const s = gg.aylikSayfa(ozet);
  t('★ 3 ayda 9.000 sayfa → ayda 3.000 (ölçülen süreye bölünür)', s?.siyah === 3000 && s.renkli === 200, s);
  t('önceki okuma yoksa ilk okumadan başlar', gg.aylikSayfa({ ...ozet, onceki: null })?.siyah === Math.round(9000 * 30.4375 / 60.875));
  t('★ bir aydan kısa ölçüm tahmin edilmez (null)', gg.aylikSayfa({ siyah: 500, renkli: 0, ilk: simdi, son: new Date(simdi.getTime() + 10 * GUN), onceki: null }) === null);
  t('okuma yok → null', gg.aylikSayfa(null) === null);
}

// ── AYLIK GELİR = FATURA ─────────────────────────────────────────────────
console.log('\nAylık gelir — faturayla aynı kural\n');
const bayi = { pricePerBlack: 0.5, pricePerColor: 2 };
{
  const kiralik = { isRental: true, monthlyRent: 1000, pricePerBlack: null, pricePerColor: null, includedBlack: 1000, includedColor: 0, overagePriceBlack: 0.6, overagePriceColor: null };
  const r = gg.aylikGelir(kiralik, bayi, { siyah: 3000, renkli: 100 });
  const fatura = inv.counterOverage(kiralik, 3000, 100, inv.fiyatTabani(kiralik, bayi));
  t('★ sayfa geliri invoicing.counterOverage ile birebir (dahil 1.000, aşım 0,60, renkli bayi fiyatı)', r.sayfa === fatura.total && r.sayfa === 2000 * 0.6 + 100 * 2 && r.kira === 1000, { r, fatura: fatura.total });
  const musteri = { isRental: false, monthlyRent: 0, pricePerBlack: 0.3, pricePerColor: null, includedBlack: 0, includedColor: 0 };
  const m = gg.aylikGelir(musteri, bayi, { siyah: 1000, renkli: 400 });
  t('kopya başı müşteri makinesi: kira yok, renkli kanal fiyatsız → ücretsiz (fatura gibi)', m.kira === 0 && m.sayfa === 300, m);
  t('sayfa ücretli cihazda hacim bilinmiyorsa null (sıfır değil)', gg.aylikGelir(kiralik, bayi, null).sayfa === null);
  t('sayfa ücretli olmayan cihazda sayfa geliri 0', gg.aylikGelir({ isRental: false, monthlyRent: 0, pricePerBlack: null, pricePerColor: null }, bayi, null).sayfa === 0);
  t('★ kopyalanmadı: hesap invoicing işlevlerini çağırıyor', /counterOverage\(cihaz, hacim\.siyah, hacim\.renkli, fiyatTabani\(cihaz, bayi\)\)/.test(oku('src/lib/gelecek-gelir.ts'))
    && /from '@\/lib\/invoicing'/.test(oku('src/lib/gelecek-gelir.ts')) && !/Math\.max\(0, \(prev/.test(oku('src/lib/gelecek-gelir.ts')));
}

// ── AYLARA YAYMA ─────────────────────────────────────────────────────────
console.log('\nSözleşmeli / yenilenirse / sözleşmesiz\n');
const kalem = (id, kira, sozlesme, birim = 'TRY', sayfa = 0) => ({ cihazId: id, birim, kira, sayfa, sozlesme });
const soz = (id, bitis, otomatikYenileme = false, zam = null) => ({ id, bitis, otomatikYenileme, zam });
{
  const tahmin = gg.gelecekGelir([
    kalem('A', 1000, soz('s1', yerel(2027, 3, 15))),                 // 15 Mart'ta biter, yenilenmez
    kalem('B', 2000, soz('s2', yerel(2027, 4, 30), true)),           // Nisan sonunda biter, yenilenir
    kalem('C', 500, null),                                            // sözleşmesiz
    kalem('D', 300, soz('s3', yerel(2026, 9, 30), true)),            // bitmiş, yenilenir
    kalem('E', 400, soz('s4', yerel(2026, 9, 30), false)),           // bitmiş, yenilenmez, hâlâ kirada
    kalem('F', 100, soz('s5', yerel(2026, 10, 25), false)),          // bu ay bitiyor
  ], simdi, 60);
  const b = tahmin[0];
  const ay = (k) => b.aylar.find((x) => x.ay === k);
  t('tahmin önümüzdeki aydan başlar, 60 ay', b.aylar.length === 60 && b.aylar[0].ay === '2026-11' && b.aylar[59].ay === '2031-10', [b.aylar[0].ay, b.aylar[59].ay]);
  t('★ bitişe kadar sözleşmeli (Şubat: A + B)', ay('2027-02').sozlesmeli === 3000, ay('2027-02'));
  t('★ ayın ortasında biten sözleşme gün oranıyla: Mart A 15/31', yak(ay('2027-03').sozlesmeli, 2000 + 1000 * 15 / 31), ay('2027-03'));
  t('★ yenilenmeyen sözleşme bitişten sonra SIFIR (Nisan\'da A yok)', ay('2027-04').sozlesmeli === 2000 && ay('2027-04').yenilenirse === 300, ay('2027-04'));
  t('★ kendiliğinden yenilenen: bitişten sonra "Yenilenirse" (Mayıs: B + D)', ay('2027-05').sozlesmeli === 0 && ay('2027-05').yenilenirse === 2300, ay('2027-05'));
  t('★ sözleşmesiz cihaz ayrı kalem, her ay aynı', b.aylar.every((x) => x.sozlesmesiz === 900) && b.sozlesmesizAylik === 900, b.sozlesmesizAylik);
  t('bitmiş + yenilenmeyen ama kirada: sözleşmesiz (fiilen aylık)', b.cihaz.sozlesmesiz === 2 && b.cihaz.suresiGecmis === 1, b.cihaz);
  t('bitmiş + yenilenen: kesin sayılmaz, "Yenilenirse"', ay('2026-11').yenilenirse === 300 && ay('2026-11').sozlesmeli === 3000, ay('2026-11'));
  t('bu ay biten, yenilenmeyen sözleşme gelecek ayda yok', !b.aylar.some((x) => x.sozlesmeli % 100 === 0 && x.sozlesmeli > 3000));
  const o12 = b.ozet['12'];
  const top12 = b.aylar.slice(0, 12).reduce((s, x) => s + x.sozlesmeli, 0);
  t('★ 12 ay özeti aylık dilimlerin toplamı', yak(o12.sozlesmeli, top12) && b.ozet['24'] && b.ozet['60'], { o12, top12 });
}
{
  // ZAM: %10, 12 ayda bir, son zam 10 Mart 2026 → sonraki 10 Mart 2027 → Nisan 2027'den itibaren.
  const zam = { oran: 10, ay: 12, taban: yerel(2026, 3, 10) };
  const b = gg.gelecekGelir([kalem('Z', 1000, soz('z', yerel(2031, 12, 31), false, zam), 'TRY', 200)], simdi, 60)[0];
  const ay = (k) => b.aylar.find((x) => x.ay === k);
  t('★ zam tarihinden önce eski tutar', ay('2027-03').sozlesmeli === 1200, ay('2027-03'));
  t('★ zamdan sonraki ilk tam aydan itibaren %10 (kira + sayfa)', ay('2027-04').sozlesmeli === 1320 && ay('2027-04').sozlesmeliSayfa === 220, ay('2027-04'));
  t('★ zam bileşik: ikinci yıl %21', yak(ay('2028-04').sozlesmeli, 1452), ay('2028-04'));
  const gecikmis = gg.gelecekGelir([kalem('Y', 1000, soz('y', yerel(2031, 12, 31), false, { oran: 10, ay: 12, taban: yerel(2025, 10, 1) }))], simdi, 24)[0];
  t('★ zamanı gelmiş ama yapılmamış zam eklenmez; sonraki (1 Ekim 2027, ayın 1\'i) o aydan', gecikmis.aylar.find((x) => x.ay === '2027-09').sozlesmeli === 1000
    && gecikmis.aylar.find((x) => x.ay === '2027-10').sozlesmeli === 1100, gecikmis.aylar.slice(9, 12));
  const oransiz = gg.gelecekGelir([kalem('X', 1000, soz('x', yerel(2031, 12, 31), false, null))], simdi, 60)[0];
  t('★ zam maddesi yoksa zam UYDURULMAZ', oransiz.aylar.every((x) => x.sozlesmeli === 1000));
  t('oran sıfır/eksi ya da aralık yok → zam yok', gg.zamCarpanlari({ oran: 0, ay: 12, taban: simdi }, simdi, gg.tahminAylari(simdi, 30)).every((c) => c === 1)
    && gg.zamCarpanlari({ oran: 10, ay: 0, taban: simdi }, simdi, gg.tahminAylari(simdi, 30)).every((c) => c === 1));
}
{
  const t2 = gg.gelecekGelir([kalem('T', 1000, null, 'TRY'), kalem('E', 50, null, 'EUR'), kalem('E2', 25, soz('e', yerel(2027, 12, 31)), 'EUR')], simdi, 12);
  t('★ para birimleri karışmaz: her birimin kendi toplamı', t2.length === 2 && t2.find((x) => x.birim === 'EUR').sozlesmesizAylik === 50
    && t2.find((x) => x.birim === 'TRY').sozlesmesizAylik === 1000 && t2.find((x) => x.birim === 'EUR').aylar[0].sozlesmeli === 25, t2.map((x) => [x.birim, x.sozlesmesizAylik]));
  const bilinmeyen = gg.gelecekGelir([{ cihazId: 'Q', birim: 'TRY', kira: 800, sayfa: null, sozlesme: null }], simdi, 12)[0];
  t('sayfası bilinmeyen cihaz sayılır, yalnız kirası eklenir', bilinmeyen.cihaz.sayfasiBilinmeyen === 1 && bilinmeyen.sozlesmesizAylik === 800, bilinmeyen.cihaz);
}

// ── RİSKTEKİ GELİR ───────────────────────────────────────────────────────
console.log('\nRiskteki gelir\n');
{
  const kalemler = [kalem('a', 1000, null), kalem('b', 2000, null), kalem('c', 300, null), kalem('d', 50, null, 'TRY', null)];
  const r = gg.risktekiGelir([
    { id: 'k1', contractNo: 'S-1', musteriId: 'm1', musteri: 'Bir', bitis: yerel(2027, 1, 31), noticeDays: 30, otomatikYenileme: true, cihazIdleri: ['a', 'd'] },
    { id: 'k2', contractNo: null, musteriId: 'm2', musteri: 'İki', bitis: yerel(2027, 6, 30), noticeDays: 0, otomatikYenileme: false, cihazIdleri: ['b'] }, // 255 gün → yok
    { id: 'k3', contractNo: null, musteriId: 'm3', musteri: 'Üç', bitis: yerel(2026, 9, 1), noticeDays: 15, otomatikYenileme: true, cihazIdleri: ['c'] },  // bitmiş
    { id: 'k4', contractNo: null, musteriId: 'm4', musteri: 'Dört', bitis: yerel(2026, 12, 1), noticeDays: 0, otomatikYenileme: false, cihazIdleri: [] },
  ], kalemler, simdi, 'TRY');
  t('★ 180 gün içinde biten ve süresi geçmiş sözleşmeler; uzaktaki yok', r.map((x) => x.id).join() === 'k3,k4,k1', r.map((x) => x.id));
  const k1 = r.find((x) => x.id === 'k1');
  t('★ ihbar son günü = bitiş − ihbar süresi (1 Ocak 2027)', new Date(k1.ihbarSonGun).getDate() === 1 && new Date(k1.ihbarSonGun).getMonth() === 0 && k1.ihbaraGun === 75, k1);
  t('aylık gelir sözleşmedeki cihazlardan; sayfası bilinmeyen sayılır', k1.aylik === 1050 && k1.cihaz === 2 && k1.sayfasiBilinmeyen === 1, k1);
  t('bitmiş sözleşme işaretli', r[0].bitti === true && r[0].bitimeGun < 0);
  t('cihazsız sözleşme bayinin biriminde 0', r.find((x) => x.id === 'k4').aylik === 0 && r.find((x) => x.id === 'k4').birim === 'TRY');
  t('risk toplamı birim başına', JSON.stringify(gg.riskToplami(r)) === JSON.stringify({ TRY: 1350 }), gg.riskToplami(r));
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const uc = oku('src/app/api/gelecek-gelir/route.ts');
  const sayfa = oku('src/app/(dashboard)/gelecek-gelir/page.tsx');
  const menu = oku('src/lib/menu-aileleri.ts');
  t('★ uç yalnız yönetici, yetki hatası okuyanın dilinde', /requireAdminUser\(\)/.test(uc) && /BU_EKRAN_ICIN_YONETICI_YETKISI/.test(uc) && !/requireTenantUser\(\)/.test(uc));
  t('ekran sunucuda yöneticiye kilitli (bir an bile açılmaz)', /redirect\('\/dashboard'\)/.test(oku('src/app/(dashboard)/gelecek-gelir/layout.tsx')));
  t('★ Kâr ailesinde, Raporlar\'dan önce; yalnız yönetici; Raporlar paketinde', /'\/filo', '\/gelecek-gelir', '\/reports'\] \}/.test(menu)
    && /'\/filo', '\/gelecek-gelir', '\/reports',/.test(menu) && /REPORTS: +\{ hrefs: \['\/reports', '\/gelecek-gelir'\] \}/.test(oku('src/lib/modules.ts')));
  t('istemci hesap modülünü çalışma anında içe almıyor (Prisma tarayıcıya gitmez)', !/from '@\/lib\/gelecek-gelir'/.test(sayfa.replace(/import type[^;]+;/g, '')));
  t('★ ekranda kur/enflasyon cümlesi ve "nasıl hesaplandı"', /g\.kurNotu/.test(sayfa) && /<details/.test(sayfa));
  t('yenileme görüşmesi kısayolu sözleşmeyi açıyor', /\/sozlesmeler\?ac=/.test(sayfa) && /get\('ac'\)/.test(oku('src/app/(dashboard)/sozlesmeler/page.tsx')));
  t('grafik sade SVG (yeni paket yok)', /<svg/.test(sayfa) && !/recharts|chart\.js|d3/.test(sayfa));
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı\n');
  await p.tenant.deleteMany({ where: { slug: { startsWith: 'gelir-testi-' } } });
  const damga = Date.now();
  const b = await p.tenant.create({ data: { name: 'Gelir Testi', slug: `gelir-testi-${damga}`, pricePerBlack: 0.5, pricePerColor: 2, currency: 'TRY' } });
  const bos = await p.tenant.create({ data: { name: 'Boş Bayi', slug: `gelir-testi-bos-${damga}` } });
  try {
    const su = new Date();
    const m1 = await p.customer.create({ data: { tenantId: b.id, name: 'Kira Müşterisi', phone: `0541${String(damga).slice(-7)}` } });
    const m2 = await p.customer.create({ data: { tenantId: b.id, name: 'Fatura Müşterisi', phone: `0542${String(damga).slice(-7)}` } });
    const fiyat = { isRental: true, monthlyRent: 1000, includedBlack: 1000, overagePriceBlack: 0.6 };
    const cihaz = (m, seri, ek = {}) => p.device.create({ data: { tenantId: b.id, customerId: m.id, brand: 'Ricoh', model: 'MP 2014', serialNo: `${seri}-${damga}`, publicCode: `GG-${seri}-${damga}`, qrTokenHash: `q-${seri}-${damga}`, ...ek } });
    const d1 = await cihaz(m1, 'A', fiyat);
    const d2 = await cihaz(m2, 'B', { ...fiyat, createdAt: new Date(2025, 0, 1) });
    const d3 = await cihaz(m1, 'C', { isRental: true, monthlyRent: 700 });
    const d4 = await cihaz(m1, 'D', { isRental: true, monthlyRent: 250 });
    await cihaz(m1, 'E', { isRental: false });                      // sayfa ücretsiz müşteri makinesi: hesaba girmez
    // d1: ölçülen süre tam 3 ortalama ay, her ay 3.000 sayfa.
    const bas = su.getTime() - 95 * GUN;
    for (let i = 0; i < 4; i++) {
      await p.counterReading.create({ data: { tenantId: b.id, deviceId: d1.id, counterBlack: 10_000 + i * 3000, counterColor: 0, deltaBlack: i === 0 ? 0 : 3000, deltaColor: 0, readingDate: new Date(bas + i * 30.4375 * GUN) } });
    }
    // d2: aynı fiyat; Eylül 2026 döneminde tek okuma, 3.000 sayfa → gerçek fatura kesilecek.
    await p.counterReading.create({ data: { tenantId: b.id, deviceId: d2.id, counterBlack: 5000, counterColor: 0, deltaBlack: 0, deltaColor: 0, readingDate: new Date(2026, 7, 10), billed: true } });
    await p.counterReading.create({ data: { tenantId: b.id, deviceId: d2.id, counterBlack: 8000, counterColor: 0, deltaBlack: 3000, deltaColor: 0, readingDate: new Date(2026, 8, 10) } });
    const sozlesme = (m, gun, cihazlar, ek = {}) => p.contract.create({
      data: { tenantId: b.id, customerId: m.id, startDate: new Date(su.getTime() - 300 * GUN), endDate: new Date(su.getTime() + gun * GUN), noticeDays: 30, ...ek,
        devices: { create: cihazlar.map((d) => ({ tenantId: b.id, deviceId: d.id })) } },
    });
    await sozlesme(m1, 400, [d1]);
    const yakin = await sozlesme(m1, 60, [d4], { autoRenew: true, contractNo: 'YK-1' });
    await sozlesme(m2, 300, [d2]);

    const v = await veriMod.gelecekGelirVerisi(b.id, su);
    const tr = v.birimler.find((x) => x.birim === 'TRY');
    t('★ gelecek ilk ay: d1 (1.000 kira + 1.200 sayfa) + d2 (sözleşmeli) + d4', tr && tr.aylar[0].sozlesmeli > 0 && v.ilkAy === tr.aylar[0].ay, tr?.aylar[0]);
    const d1Sayfa = tr.aylar[0].sozlesmeliSayfa;
    // d1 sayfa geliri: (3.000 − 1.000) × 0,60 = 1.200. d2'nin son 3 ayda tek okuması var (40 gün) → kendi oranıyla.
    t('d1\'in sayfası son 3 ay ortalamasıyla 3.000 → sayfa geliri 1.200 (ilk ayın sayfa toplamında)', d1Sayfa >= 1200, d1Sayfa);
    t('★ okuması olmayan kiralık cihaz: yalnız kirası, "sayfası bilinmeyen" sayıldı', tr.cihaz.sayfasiBilinmeyen >= 1 && tr.sozlesmesizAylik === 700, tr.cihaz);
    t('sayfa ücretsiz müşteri makinesi hesaba girmiyor', tr.cihaz.toplam === 4, tr.cihaz);
    t('★ riskte yalnız 60 gün içinde biten sözleşme', v.risk.length === 1 && v.risk[0].id === yakin.id && v.risk[0].aylik === 250 && v.risk[0].contractNo === 'YK-1', v.risk);

    // FATURA KARŞILAŞTIRMASI: aynı fiyatlı d2 için Eylül 2026 dönemini GERÇEK faturalama kesiyor.
    const fatura = await inv.buildInvoiceForCustomerPeriod(b.id, m2.id, '2026-09');
    const satirlar = fatura ? await p.invoiceLine.findMany({ where: { invoiceId: fatura.id } }) : [];
    const sayac = satirlar.filter((s) => s.kind === 'COUNTER').reduce((s, x) => s + Number(x.lineTotal), 0);
    const kira = satirlar.filter((s) => s.kind === 'RENTAL').reduce((s, x) => s + Number(x.lineTotal), 0);
    const tahmin = gg.aylikGelir({ ...fiyat, pricePerBlack: null, pricePerColor: null, includedColor: 0, overagePriceColor: null }, { pricePerBlack: 0.5, pricePerColor: 2 }, { siyah: 3000, renkli: 0 });
    t('★ 3.000 sayfalık ay: tahmin = gerçek faturanın sayaç satırı (dahil sayfa + aşım fiyatı)', yak(sayac, tahmin.sayfa) && sayac === 1200, { sayac, tahmin: tahmin.sayfa });
    t('★ kira da faturayla aynı', yak(kira, tahmin.kira) && kira === 1000, { kira, tahmin: tahmin.kira });

    const vb = await veriMod.gelecekGelirVerisi(bos.id, su);
    t('kiralık cihazı olmayan bayi: boş durum', vb.bos === true && vb.birimler.length === 0 && vb.risk.length === 0, vb);
    t('olmayan bayi: null (uç 404)', (await veriMod.gelecekGelirVerisi('olmayan-bayi', su)) === null);
    const demo = await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
    if (demo) {
      const dv = await veriMod.gelecekGelirVerisi(demo.id);
      const db = dv.birimler[0];
      t('herkese açık demoda tahmin dolu', !dv.bos && db && (db.ozet['12'].sozlesmeli + db.ozet['12'].yenilenirse + db.ozet['12'].sozlesmesizToplam) > 0,
        db && { sozlesmeli: db.ozet['12'].sozlesmeli, yenilenirse: db.ozet['12'].yenilenirse, risk: dv.risk.length });
    } else console.log('  ⊘ demo yerelde kurulu değil');
  } finally {
    await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
    await p.tenant.delete({ where: { id: bos.id } }).catch(() => {});
  }
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
