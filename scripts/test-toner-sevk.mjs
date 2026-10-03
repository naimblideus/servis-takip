// TONER SEVKİ + TONER ÜRÜNÜ KARNESİ
// Çalıştır:  node scripts/test-toner-sevk.mjs   (veritabanı kısmı yerel DB ister)
//
// NEDEN BU TEST
// Tekel fikrinin iki eksik halkası:
//   1) Aynı makinede HANGİ TONER sayfa başı daha ucuza geliyor. Ölçülen verim
//      BİR ÖNCEKİ değişimde takılan tonere aittir — değişim kaydının kendi
//      parçası yeni takılanı söyler. Bu karıştırılırsa karşılaştırma ters çıkar.
//   2) Toneri bitmek üzere olan cihaza tek onayla sevk: stok aynı işlemde
//      düşer, aynı cihaza iki açık sevk olamaz (veritabanı tutar), tarayıcı ya
//      da fiş değişimi görünce sevk "takıldı" olur ve gönderilen toner o
//      değişime yazılır — müşteri toneri kendisi takınca başka kaynak yok.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sevk-'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const MODULLER = [
  'toner-sevk', 'verim-karnesi', 'tedarik-siparisi', 'toner-sevk-veri', 'toner-veri', 'toner-urun-veri',
  'tedarik-siparisi-veri', 'verim-ogrenme', 'toner-verimi', 'device-brands', 'reliability', 'fault-categories',
  'stok-maliyet', 'toner', 'sayac-tarama', 'magaza-baglanti', 'teklif', 'sozlesme-karlilik',
];
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), ...MODULLER.map((m) => join(KOK, `src/lib/${m}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
for (const m of MODULLER) {
  const yol = join(g, `${m}.js`);
  let s = readFileSync(yol, 'utf8');
  s = s.split("'@/lib/prisma'").join("'./prisma-shim.js'").split("'@prisma/client'").join(JSON.stringify(P));
  for (const d of MODULLER) s = s.split(`'@/lib/${d}'`).join(`'./${d}.js'`);
  writeFileSync(yol, s, 'utf8');
}
const al = (m) => import(pathToFileURL(join(g, `${m}.js`)).href);
const sevk = await al('toner-sevk');
const karne = await al('verim-karnesi');
const sip = await al('tedarik-siparisi');

console.log('\nToner sevki — saf kurallar\n');
{
  const { ihtiyacSebebi, onerilenParca, enSik, cihazTalebi, sevkIstegiAyikla } = sevk;
  t('★ cihaz %12 ölçtü → ihtiyaç (OLCUM)', ihtiyacSebebi({ remainingPct: 12, daysLeft: null, olculdu: true }) === 'OLCUM');
  t('ölçüm %40 ama 5 gün içinde bitecek → ihtiyaç (TAHMIN)', ihtiyacSebebi({ remainingPct: 40, daysLeft: 5, olculdu: true }) === 'TAHMIN');
  t('20 gün var → ihtiyaç yok', ihtiyacSebebi({ remainingPct: 50, daysLeft: 20 }) === null);
  t('kurulum bekleyen kanalda karar yok', ihtiyacSebebi({ remainingPct: null, daysLeft: 1, needsSetup: true }) === null && ihtiyacSebebi(null) === null);
  t('★ öneri sırası: son takılan → fiş → model', onerilenParca({ sonTakilan: 'A', sonFis: 'B', modelEnSik: 'C' }).partId === 'A'
    && onerilenParca({ sonTakilan: null, sonFis: 'B', modelEnSik: 'C' }).kaynak === 'FIS'
    && onerilenParca({ sonTakilan: null, sonFis: null, modelEnSik: 'C' }).kaynak === 'MODEL'
    && onerilenParca({ sonTakilan: null, sonFis: null, modelEnSik: null }) === null);
  t('en sık: eşitlikte en son görülen', enSik(['A', 'B', 'A', 'B']) === 'B' && enSik(['A', 'A', 'B']) === 'A' && enSik([]) === null);
  const ct = cihazTalebi([{ partId: 'A', yolda: false }, { partId: 'A', yolda: false }, { partId: 'A', yolda: true }, { partId: null, yolda: false }]);
  t('★ cihaz talebi: yolda olan ve tonerini bilmediğimiz sayılmaz', ct.get('A') === 2 && ct.size === 1, [...ct]);
  t('istek doğrulama', sevkIstegiAyikla({ deviceId: 'd', channel: 'BLACK' }).adet === 1
    && sevkIstegiAyikla({ deviceId: 'd', channel: 'RED' }) === 'KANAL_GECERSIZ'
    && sevkIstegiAyikla({ deviceId: 'd', channel: 'COLOR', adet: 0 }) === 'ADET_GECERSIZ'
    && sevkIstegiAyikla({ channel: 'BLACK' }) === 'CIHAZ_YOK'
    && sevkIstegiAyikla({ deviceId: 'd', channel: 'BLACK', partId: 5 }) === 'PARCA_YOK');
}

console.log('\nToner ürünü karnesi — verim doğru tonere yazılıyor mu\n');
{
  const { urunGozlemleri, urunSatirlari } = karne;
  const M = 'KYOCERA|M3040DN'; // model anahtarının İÇİNDE ayraç var
  const k = (dev, gun, partId, verim, ch = 'BLACK') => ({ deviceId: dev, channel: ch, changedAt: new Date(2026, 0, gun), partId, observedYield: verim, model: M });
  const goz = urunGozlemleri([
    k('d1', 30, 'A', 4500), k('d1', 1, 'A', null), k('d1', 15, 'B', 3000), // sıra karışık verilir
    k('d2', 1, 'B', null), k('d2', 20, 'B', 2800), k('d2', 40, 'A', 2900),
  ]);
  t('★ verim BİR ÖNCEKİ değişimde takılan tonere yazılıyor', JSON.stringify(goz.get(`${M}|BLACK|A`)) === '[3000]'
    && JSON.stringify([...(goz.get(`${M}|BLACK|B`) ?? [])].sort()) === '[2800,2900,4500]', [...goz]);
  t('parçası bilinmeyen değişimden sonraki verim hiçbir tonere yazılmıyor', urunGozlemleri([k('d3', 1, null, null), k('d3', 9, 'A', 3100)]).size === 0);

  const gozlemler = new Map([
    [`${M}|BLACK|ucuz`, [2900, 3000, 3100]],
    [`${M}|BLACK|pahali`, [6000, 6100]],
    [`${M}|BLACK|tek`, [9000]],
    [`${M}|BLACK|fiyatsiz`, [5000, 5000]],
  ]);
  const parcalar = new Map([
    ['ucuz', { ad: 'Muadil TK-5240K', kod: null, fiyat: 300 }],   // 300/3000 = 0,10 ₺/sf
    ['pahali', { ad: 'Orijinal TK-5240K', kod: 'TK-5240K', fiyat: 480 }], // 480/6050 ≈ 0,0793 ₺/sf
    ['tek', { ad: 'Tek ölçümlü', kod: null, fiyat: 100 }],
    ['fiyatsiz', { ad: 'Fiyatsız', kod: null, fiyat: null }],
  ]);
  const satirlar = urunSatirlari(gozlemler, parcalar).get(M);
  const bul = (id) => satirlar.find((s) => s.partId === id);
  t('★ PAHALI görünen orijinal sayfa başı daha ucuz: en ucuz işaretli', bul('pahali')?.enUcuz === true && bul('ucuz')?.enUcuz === false, satirlar);
  t('ucuzluk: en çok kullanılana göre yüzde (≈%20,7)', Math.abs((bul('pahali')?.ucuzluk ?? 0) - 20.7) < 0.2, bul('pahali'));
  t('★ tek ölçümlü toner kıyasa girmiyor (çok ucuz görünse de)', bul('tek')?.enUcuz === false && bul('tek')?.sayfaBasi !== null);
  t('fiyatı olmayanın sayfa maliyeti yok', bul('fiyatsiz')?.sayfaBasi === null);
  t('model anahtarı ayraçlı olsa da doğru modele gidiyor', satirlar.length === 4 && satirlar.every((s) => s.kanal === 'BLACK'));

  // Modelin GERÇEK sayfa maliyeti: toplam fiyat ÷ toplam sayfa (fiyatı olan, tonere bağlı ölçümler).
  const { harmanMaliyet } = karne;
  const h = harmanMaliyet(gozlemler, new Map([...parcalar].map(([id, p]) => [id, p.fiyat])));
  const hm = h.get(`${M}|BLACK`);
  // ucuz 3×300 + pahali 2×480 + tek 1×100 = 1960 ₺ ; 9000 + 12100 + 9000 = 30100 sayfa
  t('★ harman maliyet = Σ fiyat ÷ Σ sayfa (1960 / 30100)', Math.abs((hm?.maliyet ?? 0) - 1960 / 30100) < 1e-9 && hm?.gozlem === 6, hm);
  t('fiyatı olmayan toner harmana girmiyor', hm?.gozlem === 6);
}

console.log('\nTedarikçi siparişi — cihaz talebi\n');
{
  const { siparisGerekli, oneriAdet, aktifMi } = sip;
  t('★ stok asgarinin üstünde ama cihaz talebi karşılanınca altına düşüyor → siparişe girer', siparisGerekli({ stok: 5, asgari: 2, cihazTalebi: 4 }) && !siparisGerekli({ stok: 5, asgari: 2, cihazTalebi: 0 }));
  t('öneri: talep + asgariye tamamla + aylık kullanım', oneriAdet({ stok: 1, asgari: 2, kullanim90: 6, cihazTalebi: 3 }) === 6, oneriAdet({ stok: 1, asgari: 2, kullanim90: 6, cihazTalebi: 3 }));
  t('talebi olan kalem aktif sayılır', aktifMi({ kullanim90: 0, alisVar: false, cihazTalebi: 1 }) && !aktifMi({ kullanim90: 0, alisVar: false, cihazTalebi: 0 }));
}

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const x = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    return x ? x.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nToner sevki — gerçek veritabanı\n');
  const p = new PrismaClient();
  const SLUG = ['test-toner-sevk', 'test-toner-sevk-diger'];
  const temizle = async () => {
    for (const slug of SLUG) {
      const x = await p.tenant.findFirst({ where: { slug }, select: { id: true } });
      if (x) await p.tenant.delete({ where: { id: x.id } });
    }
  };
  try {
    await temizle();
    const { sevkEt, sevkIptal, sevkBaglami } = await al('toner-sevk-veri');
    const { degisimKaydet } = await al('verim-ogrenme');
    const { tonerDurumu } = await al('toner-veri');
    const { tonerUrunKarnesi } = await al('toner-urun-veri');
    const { siparisVerisi } = await al('tedarik-siparisi-veri');

    const bayi = await p.tenant.create({ data: { name: 'Sevk Bayisi', slug: SLUG[0] } });
    const diger = await p.tenant.create({ data: { name: 'Başka Bayi', slug: SLUG[1] } });
    const kul = await p.user.create({ data: { tenantId: bayi.id, email: 'sevk@ornek.local', passwordHash: 'x', name: 'Sevk', role: 'ADMIN' } });
    const mus = await p.customer.create({ data: { tenantId: bayi.id, name: 'Sevk Müşterisi', phone: '05000000991' } });
    const digerMus = await p.customer.create({ data: { tenantId: diger.id, name: 'Diğer', phone: '05000000992' } });
    const cihaz = (tenantId, customerId, seri, ek = {}) => p.device.create({ data: {
      tenantId, customerId, brand: 'Kyocera', model: 'ECOSYS M3040dn', serialNo: seri, publicCode: `SVK-${seri}`, qrTokenHash: `svk-${seri}`,
      counterBlack: 10000, counterColor: 0, ...ek,
    }, select: { id: true } });
    const c1 = await cihaz(bayi.id, mus.id, 'S1');
    const c2 = await cihaz(bayi.id, mus.id, 'S2');
    const c3 = await cihaz(bayi.id, mus.id, 'S3');
    const yabanci = await cihaz(diger.id, digerMus.id, 'Y1');
    const parca = (tenantId, sku, ad, stok, fiyat) => p.part.create({ data: { tenantId, sku, name: ad, group: 'TONER', stockQty: stok, minStock: 1, buyPrice: fiyat, avgCost: fiyat } });
    const A = await parca(bayi.id, 'TK-A', 'Muadil TK-5240K', 2, 300);
    const B = await parca(bayi.id, 'TK-B', 'Orijinal TK-5240K', 0, 480);
    const yabanciParca = await parca(diger.id, 'TK-Y', 'Yabancı toner', 9, 100);
    const stok = async (id) => (await p.part.findUnique({ where: { id }, select: { stockQty: true } })).stockQty;

    let r = await sevkEt(bayi.id, kul.id, [{ deviceId: c1.id, channel: 'BLACK', partId: A.id }]);
    t('★ sevk: kayıt + stok düşüşü (2 → 1)', r[0].ok && r[0].stok === 1 && (await stok(A.id)) === 1, r);
    r = await sevkEt(bayi.id, kul.id, [{ deviceId: c1.id, channel: 'BLACK', partId: A.id }]);
    t('★ aynı cihaza ikinci açık sevk REDDEDİLİYOR, stok yine 1', !r[0].ok && r[0].hata === 'ZATEN_YOLDA' && (await stok(A.id)) === 1, r);
    r = await sevkEt(bayi.id, kul.id, [{ deviceId: c2.id, channel: 'BLACK', partId: B.id }]);
    const c2Sevk = await p.tonerSevki.count({ where: { deviceId: c2.id } });
    t('★ stokta olmayan toner: STOK_YETERSIZ ve sevk kaydı da YAZILMIYOR', !r[0].ok && r[0].hata === 'STOK_YETERSIZ' && c2Sevk === 0, r);
    r = await sevkEt(bayi.id, kul.id, [{ deviceId: c2.id, channel: 'BLACK', partId: yabanciParca.id }, { deviceId: yabanci.id, channel: 'BLACK', partId: A.id }]);
    t('★ başka bayinin tonerini ya da cihazını kullanamaz', r[0].hata === 'PARCA_YOK' && r[1].hata === 'CIHAZ_YOK' && (await stok(yabanciParca.id)) === 9, r);

    // Aynı anda iki istek (çift tıklama): yalnız biri geçer, stok bir kez düşer.
    const [x1, x2] = await Promise.all([
      sevkEt(bayi.id, kul.id, [{ deviceId: c2.id, channel: 'BLACK', partId: A.id }]),
      sevkEt(bayi.id, kul.id, [{ deviceId: c2.id, channel: 'BLACK', partId: A.id }]),
    ]);
    const okSay = [x1[0], x2[0]].filter((s) => s.ok).length;
    t('★ eşzamanlı çift sevk: biri geçti, biri ZATEN_YOLDA; stok bir kez düştü (1 → 0)', okSay === 1 && [x1[0], x2[0]].some((s) => s.hata === 'ZATEN_YOLDA') && (await stok(A.id)) === 0, [x1, x2]);

    const c2Acik = await p.tonerSevki.findFirst({ where: { deviceId: c2.id, durum: 'GONDERILDI' } });
    const ip = await sevkIptal(bayi.id, c2Acik.id);
    t('★ geri alma: stok geri geldi (0 → 1)', ip.durum === 'TAMAM' && (await stok(A.id)) === 1, ip);
    t('ikinci geri alma yapılmıyor', (await sevkIptal(bayi.id, c2Acik.id)).durum === 'KAPANMIS');
    t('başka bayinin sevki bulunmuyor', (await sevkIptal(diger.id, c2Acik.id)).durum === 'YOK');

    // Değişim → sevk takıldı, parça yazıldı.
    const once = new Date(Date.now() - 3 * 86400000);
    await degisimKaydet({ tenantId: bayi.id, deviceId: c1.id, channel: 'BLACK', counterValue: 9000, changedAt: once, source: 'ELLE' });
    t('sevkten ÖNCEKİ bir değişim sevki kapatmıyor', (await p.tonerSevki.count({ where: { deviceId: c1.id, durum: 'GONDERILDI' } })) === 1);
    const d = await degisimKaydet({ tenantId: bayi.id, deviceId: c1.id, channel: 'BLACK', counterValue: 12500, source: 'TARAYICI' });
    const s1 = await p.tonerSevki.findFirst({ where: { deviceId: c1.id } , orderBy: { gonderildiAt: 'asc' } });
    const tc = await p.tonerChange.findUnique({ where: { id: d.id } });
    t('★ tarayıcının gördüğü değişim sevki TAKILDI yaptı', s1.durum === 'TAKILDI' && s1.tonerChangeId === d.id && s1.takildiAt !== null, s1);
    t('★ parçası bilinmeyen değişime GÖNDERİLEN toner yazıldı', tc.partId === A.id, tc.partId);
    t('takılan sevk geri alınamıyor', (await sevkIptal(bayi.id, s1.id)).sebep === undefined && (await sevkIptal(bayi.id, s1.id)).durum === 'KAPANMIS');

    // Bağlam: c3 cihazdan %8 ölçtü; aynı modelde en sık takılan toner A → öneri.
    await p.device.update({ where: { id: c3.id }, data: { olcumAt: new Date(), olcumSiyah: 8 } });
    const durum = await tonerDurumu(bayi.id);
    const bag = await sevkBaglami(bayi.id, durum.takipli);
    const k3 = bag.kanallar.get(c3.id)?.BLACK;
    t('★ %8 ölçülen cihaz: ihtiyaç OLCUM, öneri modelde en sık takılan toner', k3?.ihtiyac === 'OLCUM' && k3?.oneri?.id === A.id && k3?.oneri?.kaynak === 'MODEL', k3);
    t('stokta hazır: 1 (A stokta 1)', bag.hazir === 1, bag.hazir);
    t('seçim listesi yalnız toner kartları', bag.tonerParcalari.length === 2 && bag.tonerParcalari.every((x) => /TK-5240K/.test(x.ad)));

    // Tedarikçi siparişi: A stok 1, asgari 1, c3'ün talebi 1 → siparişe girer, "1 cihaz bekliyor".
    const sv = await siparisVerisi(bayi.id);
    const kalem = sv.gruplar.flatMap((x) => x.kalemler).find((x) => x.id === A.id);
    t('★ tedarikçi siparişi cihaz talebini görüyor', kalem?.cihazTalebi === 1 && kalem.oneri >= 2, kalem);
    t('★ sevk edilen toner kullanım sayılıyor (90 gün)', (kalem?.kullanim90 ?? 0) >= 1, kalem?.kullanim90);

    // Ürün karnesi gerçek kayıtlardan. 9.000 → 12.500 arasındaki 3.500 sayfayı
    // A DEĞİL, ondan önce takılı olan (bilinmeyen) toner bastı: A o değişimde
    // TAKILDI. A'nın verimi bir sonraki değişimde ölçülür: 12.500 → 16.500.
    let uk = await tonerUrunKarnesi(bayi.id);
    t('★ A takıldığı değişimde ölçülen 3.500 A\'ya YAZILMIYOR (önceki toner bilinmiyor)', !Object.values(uk).flat().some((u) => u.partId === A.id), uk);
    // 10 gün sonra: tarayıcı kaydından sonraki 7 gün içinde elle girilen değişim "aynı değişim" sayılıp birleştirilir.
    await degisimKaydet({ tenantId: bayi.id, deviceId: c1.id, channel: 'BLACK', counterValue: 16500, changedAt: new Date(Date.now() + 10 * 86400000), source: 'ELLE' });
    uk = await tonerUrunKarnesi(bayi.id);
    const satir = Object.values(uk).flat().find((u) => u.partId === A.id);
    t('★ A bitip yenisi takılınca A\'nın verimi ölçüldü: 4.000 sayfa, sayfa başı 300/4000', satir?.verim === 4000 && satir?.gozlem === 1 && Math.abs((satir?.sayfaBasi ?? 0) - 0.075) < 1e-9, satir);

    // Teklif motoru aynı gerçek maliyeti kullanıyor (karne ile teklif ayrı sayı söylemesin).
    const { modelSayfaMaliyetleri } = await al('teklif');
    const { modelAnahtari } = await al('toner-verimi');
    const mm = (await modelSayfaMaliyetleri(bayi.id)).get(modelAnahtari('Kyocera', 'ECOSYS M3040dn'));
    t('★ teklif motoru modelin sayfa maliyetini ölçülen tonerden alıyor (0,075)', Math.abs((mm?.sb ?? 0) - 0.075) < 1e-9, mm);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.stack ?? e);
  } finally {
    await temizle().catch(() => {});
    await p.$disconnect();
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

console.log('\nToner sevki — uçlar\n');
{
  const SUNUCU = process.env.TEST_SUNUCU || 'http://localhost:3002';
  const acik = await fetch(`${SUNUCU}/api/toner`, { signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false);
  if (!acik) console.log('  ⊘ HTTP atlandı: sunucu kapalı');
  else {
    const post = await fetch(`${SUNUCU}/api/toner-sevk`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"sevkler":[]}' });
    const del = await fetch(`${SUNUCU}/api/toner-sevk/yok`, { method: 'DELETE' });
    t('★ oturumsuz sevk ve geri alma reddediliyor', post.status === 401 && del.status === 401, [post.status, del.status]);
    t('oturumsuz toner listesi reddediliyor', (await fetch(`${SUNUCU}/api/toner`)).status === 401);
  }
  const oku = (y) => readFileSync(join(KOK, y), 'utf8');
  t('sarf ekranı sevk ucunu kullanıyor', /\/api\/toner-sevk/.test(oku('src/app/(dashboard)/sarf/page.tsx')));
  t('★ değişim kaydı yoldaki sevki kapatıyor (tek yol: degisimKaydet)', /tonerSevki\.updateMany/.test(oku('src/lib/verim-ogrenme.ts')));
  t('★ açık sevk tekilliği veritabanında', /CREATE UNIQUE INDEX[^;]*TonerSevki_acik_tekil[^;]*WHERE "durum" = 'GONDERILDI'/.test(oku('prisma/migrations/20261003100000_toner_sevki/migration.sql')));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
