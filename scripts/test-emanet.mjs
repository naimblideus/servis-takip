// EMANET — MÜŞTERİDE DURAN TONER (lib/emanet.ts + lib/emanet-veri.ts)
// Çalıştır:  node scripts/test-emanet.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bu defter müşteriye "tonerimiz rafınızda yok" dedirtecek: sayım farkı
// kayıp tonerin kanıtı. Kanıtın kendisi yanlışsa (iki kez düşülen tüketim,
// eksiye düşen bakiye, yarım kalan bırakış) bayi müşterisinin karşısında
// mahcup olur. Burada kilitlenenler: stok ve defter aynı işlemde; bakiye
// aşılamaz; aynı değişim iki kez düşmez; belirsiz değişim hiç düşmez; açık
// sevk emanete dokunmaz; emanetten düşülen değişim "kaçan toner" sayılmaz.
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

// ── DERLEME ──────────────────────────────────────────────────────────────
const MODULLER = ['emanet', 'emanet-veri', 'verim-ogrenme', 'toner-verimi', 'device-brands', 'reliability', 'fault-categories',
  'stok-maliyet', 'kacan-toner', 'demo-yazma', 'menu-aileleri', 'modules'];
const g = mkdtempSync(join(tmpdir(), 'st-emanet-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...MODULLER.map((m) => join(KOK, `src/lib/${m}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const m of MODULLER) {
  const yol = join(g, `${m}.js`);
  let s = readFileSync(yol, 'utf8');
  s = s.split("'@/lib/prisma'").join("'./prisma-shim.js'").split("'@prisma/client'").join(JSON.stringify(istemci)).split("'./modules'").join("'./modules.js'");
  for (const d of MODULLER) s = s.split(`'@/lib/${d}'`).join(`'./${d}.js'`);
  writeFileSync(yol, s, 'utf8');
}
const al = (m) => import(pathToFileURL(join(g, `${m}.js`)).href);
const E = await al('emanet');

const GUN = 86_400_000;
const simdi = new Date('2026-10-18T12:00:00Z');
const once = (n) => new Date(simdi.getTime() - n * GUN);
const S = (tur, adet, gun, ek = {}) => ({ tur, adet, tarih: once(gun), partId: 'P', parcaAdi: 'TK-1170', birimMaliyet: 100, ...ek });

// ── SAF KURALLAR ─────────────────────────────────────────────────────────
console.log('\nSaf kurallar\n');
{
  t('kalem anahtarı: kart varsa kimliği, silinmişse adı (Türkçe küçük harf)', E.kalemAnahtari({ partId: 'p1', parcaAdi: 'X' }) === 'p1'
    && E.kalemAnahtari({ partId: null, parcaAdi: ' İZMİR Toner ' }) === 'ad:izmir toner');
  const fifo = E.partiler([S('BIRAKILDI', 5, 100), S('TAKILDI', -2, 80), S('BIRAKILDI', 3, 50, { birimMaliyet: 120 }), S('TAKILDI', -4, 10)]);
  t('★ FIFO: en eski önce tükenir, kalan parti en yeni bırakılış', fifo.length === 1 && fifo[0].adet === 2 && fifo[0].birimMaliyet === 120
    && fifo[0].tarih.getTime() === once(50).getTime(), fifo);
  const karisik = E.partiler([S('TAKILDI', -4, 10), S('BIRAKILDI', 3, 50, { birimMaliyet: 120 }), S('BIRAKILDI', 5, 100), S('TAKILDI', -2, 80)]);
  t('satır sırası önemsiz: tarihe göre sıralanır', JSON.stringify(karisik) === JSON.stringify(fifo));
  const borc = E.partiler([S('TAKILDI', -1, 30), S('SAYIM', 3, 10)]);
  t('defter bir an eksiye düştüyse sonraki giriş önce borcu kapatır (partiler = bakiye)', borc.length === 1 && borc[0].adet === 2);
  const p2 = [{ tarih: once(9), adet: 2, birimMaliyet: 100 }, { tarih: once(5), adet: 3, birimMaliyet: 130 }];
  t('★ çıkan maliyet FIFO: 2×100 + 1×130 → 110', E.cikanBirimMaliyet(p2, 3) === 110);
  t('maliyeti bilinmeyen birim varsa null (uydurulmaz)', E.cikanBirimMaliyet([{ tarih: once(1), adet: 2, birimMaliyet: null }], 1) === null);
  t('rafta olandan fazlası çıkamaz: null', E.cikanBirimMaliyet(p2, 6) === null);

  const f = E.fazlaDuruyor;
  t('★ fazla duruyor: 3 toner, 90 gün, hiç takılmamış', f({ bakiye: 3, enEskiGun: 90, tuketim90: 0 }) === true);
  t('90 günden yeni bırakılış henüz fazla sayılmaz', f({ bakiye: 9, enEskiGun: 89, tuketim90: 0 }) === false);
  t('2 yedek olağan: fazla değil', f({ bakiye: 2, enEskiGun: 400, tuketim90: 0 }) === false);
  t('★ hız eşiği: 6 rafta, 90 günde 3 takıldı (180 gün yeter) → değil; 7 → fazla', f({ bakiye: 6, enEskiGun: 120, tuketim90: 3 }) === false
    && f({ bakiye: 7, enEskiGun: 120, tuketim90: 3 }) === true);

  const k = E.kalemOzeti([S('BIRAKILDI', 6, 120), S('TAKILDI', -1, 100), S('TAKILDI', -1, 20), S('IADE', -1, 15), S('SAYIM', -1, 5, { birimMaliyet: 100 })], simdi);
  t('★ kalem özeti: bakiye, değer, en eski gün, 90 günlük tüketim yalnız TAKILDI', k.bakiye === 2 && k.deger === 200 && k.enEskiGun === 120
    && k.tuketim90 === 1 && k.fazla === false, k);
  t('son sayım farkı görünür (eksik negatif)', k.sonSayimFarki?.fark === -1 && k.sonSayimFarki?.birimMaliyet === 100);
  const bilinmeyen = E.kalemOzeti([S('BIRAKILDI', 2, 10, { birimMaliyet: null }), S('BIRAKILDI', 1, 5)], simdi);
  t('maliyeti bilinmeyen parti: bilinenler toplanır, eksik işaretlenir', bilinmeyen.deger === 100 && bilinmeyen.degerEksik === true);
  const sifir = E.kalemOzeti([S('BIRAKILDI', 2, 200), S('IADE', -2, 100)], simdi);
  t('rafta kalmayınca "en eski gün" yok', sifir.bakiye === 0 && sifir.enEskiGun === null && sifir.deger === 0);
  const mt = E.musteriToplami([k, { ...k, bakiye: 3, deger: 300, enEskiGun: 200, fazla: true, tuketim90: 0 }]);
  t('müşteri toplamı: Σ bakiye, en eski gün en büyüğü, fazla biri yeter', mt.bakiye === 5 && mt.deger === 500 && mt.enEskiGun === 200 && mt.fazla === true);
  t('bakiye o ana kadar (o an dahil)', E.bakiye([S('BIRAKILDI', 3, 10), S('TAKILDI', -1, 5)], once(6)) === 3 && E.bakiye([S('BIRAKILDI', 3, 10), S('TAKILDI', -1, 5)]) === 2);

  const sf = E.sayimFarklari([{ anahtar: 'a', sayilan: 2 }, { anahtar: 'b', sayilan: 1 }, { anahtar: 'c', sayilan: 4 }], new Map([['a', 3], ['c', 4]]));
  t('★ sayım farkı = sayılan − defter (eksik −, fazla +, tutan 0)', sf[0].fark === -1 && sf[1].fark === 1 && sf[1].defterde === 0 && sf[2].fark === 0, sf);

  const k2 = E.tuketimKarari;
  const ad = (partId, bakiye, uyar) => ({ partId, bakiye, uyar });
  t('★ değişimin parçası biliniyor ve rafta: o düşer', k2({ degisimParcasi: 'A', adaylar: [ad('A', 2, false), ad('B', 1, true)] }).partId === 'A');
  t('parçası biliniyor ama rafta yok: düşmez', k2({ degisimParcasi: 'A', adaylar: [ad('A', 0, true), ad('B', 1, true)] }).sebep === 'PARCA_RAFTA_YOK');
  t('★ bilinmiyor, uyan TEK toner: o düşer', k2({ degisimParcasi: null, adaylar: [ad('A', 2, true), ad('B', 3, false)] }).partId === 'A');
  t('★ birden çok uyan: BELİRSİZ, düşmez (sayım yakalar)', k2({ degisimParcasi: null, adaylar: [ad('A', 2, true), ad('B', 1, true)] }).sebep === 'BELIRSIZ');
  t('hiç uyan yok: düşmez', k2({ degisimParcasi: null, adaylar: [ad('A', 2, false)] }).sebep === 'ADAY_YOK');
  t('bakiyesi biten aday sayılmaz', k2({ degisimParcasi: null, adaylar: [ad('A', 0, true), ad('B', 2, true)] }).partId === 'B');

  const ay = E.istegiAyikla;
  const iyi = ay({ islem: 'birak', customerId: 'm1', kalemler: [{ partId: 'p1', adet: 2 }, { partId: 'p1', adet: '3' }, { partId: 'p2', adet: 1 }], bosAdet: 2, deviceId: 'd1', not: '  üst raf  ' });
  t('★ istek: aynı toner iki satırda gelirse toplanır; not kırpılır', iyi.kalemler?.length === 2 && iyi.kalemler[0].adet === 5 && iyi.bosAdet === 2 && iyi.not === 'üst raf' && iyi.deviceId === 'd1', iyi);
  t('işlem geçersiz', ay({ islem: 'sil', customerId: 'm', kalemler: [{ partId: 'p', adet: 1 }] }) === 'EMANET_ISLEM_GECERSIZ' && ay(null) === 'EMANET_ISLEM_GECERSIZ');
  t('müşteri yok / kalem yok', ay({ islem: 'birak', kalemler: [{ partId: 'p', adet: 1 }] }) === 'EMANET_MUSTERI_YOK'
    && ay({ islem: 'birak', customerId: 'm', kalemler: [] }) === 'EMANET_KALEM_YOK'
    && ay({ islem: 'birak', customerId: 'm', kalemler: Array.from({ length: 31 }, (_, i) => ({ partId: `p${i}`, adet: 1 })) }) === 'EMANET_KALEM_YOK');
  t('★ bırakırken adet ≥1, sayımda 0 geçerli', ay({ islem: 'birak', customerId: 'm', kalemler: [{ partId: 'p', adet: 0 }] }) === 'EMANET_ADET_GECERSIZ'
    && typeof ay({ islem: 'sayim', customerId: 'm', kalemler: [{ partId: 'p', sayilan: 0 }] }) === 'object'
    && ay({ islem: 'iade', customerId: 'm', kalemler: [{ partId: 'p', adet: 1.5 }] }) === 'EMANET_ADET_GECERSIZ'
    && ay({ islem: 'birak', customerId: 'm', kalemler: [{ partId: 'p', adet: 60 }, { partId: 'p', adet: 60 }] }) === 'EMANET_ADET_GECERSIZ');
  t('★ bırakmak stok kartı ister; kartı silinmiş kalem yalnız adıyla geri alınır', ay({ islem: 'birak', customerId: 'm', kalemler: [{ parcaAdi: 'X', adet: 1 }] }) === 'EMANET_PARCA_YOK'
    && ay({ islem: 'iade', customerId: 'm', kalemler: [{ partId: null, parcaAdi: 'Eski toner', adet: 1 }] }).kalemler?.[0].parcaAdi === 'Eski toner'
    && ay({ islem: 'iade', customerId: 'm', kalemler: [{ adet: 1 }] }) === 'EMANET_PARCA_YOK');
  t('boş kartuş eksi olamaz; bırakış dışı işlemde boş kartuş ve cihaz yok sayılır', ay({ islem: 'birak', customerId: 'm', kalemler: [{ partId: 'p', adet: 1 }], bosAdet: -1 }) === 'EMANET_ADET_GECERSIZ'
    && ay({ islem: 'iade', customerId: 'm', kalemler: [{ partId: 'p', adet: 1 }], bosAdet: 5, deviceId: 'd' }).bosAdet === 0);
  t('her hata kodunun HTTP karşılığı var', ['EMANET_ISLEM_GECERSIZ', 'EMANET_MUSTERI_YOK', 'EMANET_KALEM_YOK', 'EMANET_ADET_GECERSIZ', 'EMANET_PARCA_YOK', 'EMANET_CIHAZ_YOK', 'EMANET_STOK_YETERSIZ', 'EMANET_BAKIYE_ASIMI']
    .every((k) => E.HATA_DURUMU[k] >= 400));
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const dy = await al('demo-yazma');
  t('★ ortak demoda POST /api/emanet kapalı (vitrin), okuma açık', dy.demoYazmaYasak('POST', '/api/emanet') && !dy.demoYazmaYasak('GET', '/api/emanet') && !dy.demoYazmaYasak('GET', '/api/emanet/m1'));
  const mn = await al('menu-aileleri');
  const stok = mn.AILELER.find((a) => a.anahtar === 'stok');
  t('★ menü: Stok ailesinde Sarf\'ın hemen arkasında; teknisyen de görüyor', stok.uyeler.indexOf('/emanet') === stok.uyeler.indexOf('/sarf') + 1
    && mn.TEKNISYEN_MENUSU.indexOf('/emanet') === mn.TEKNISYEN_MENUSU.indexOf('/sarf') + 1);
  const vo = oku('src/lib/verim-ogrenme.ts');
  t('★ otomatik tüketim tek yolda: degisimKaydet (yeni kayıt + fişin tarayıcı kaydına eklenmesi)', (vo.match(/await emanetBagla\(/g) ?? []).length === 2);
  t('★ emanet bağı ana işi bozmuyor: hata yutulur, kayda geçer', /async function emanetBagla[\s\S]{0,400}try \{[\s\S]{0,200}emanettenDus[\s\S]{0,200}catch \(e\) \{\s*console\.error/.test(vo));
  t('kodda başka TonerChange yaratan yer yok (hepsi degisimKaydet\'ten geçer)', !/tonerChange\.create\(/.test(oku('src/app/api/tickets/[id]/parts/route.ts') + oku('src/app/api/devices/[id]/toner/route.ts') + oku('src/lib/sayac-tarama-veri.ts')));
  const uc = oku('src/app/api/emanet/route.ts');
  t('uç: oturum zorunlu, hata kodla (gömülü Türkçe yok)', /requireTenantUser\(\)/.test(uc) && /ucHatasi\(r\.hata/.test(uc) && !/error:\s*'/.test(uc));
  const sayfa = oku('src/app/(dashboard)/emanet/page.tsx');
  t('★ ekran demoda kaydetmiyor, ne olacağını söylüyor', /if \(demo\) \{ setHata\(e\.demo\)/.test(sayfa));
  t('ekranda giriş alanları ≥16px (iOS yakınlaştırmasın), dokunma hedefi 44px', /fontSize: 16/.test(sayfa) && /const DOKUNMA = 44/.test(sayfa));
  const belge = oku('src/components/docs/EmanetTutanagi.tsx');
  t('★ tutanakta fiyat/maliyet basılmıyor, imza kutuları var', !/birimMaliyet|para\(/.test(belge) && /teslimAlanImza/.test(belge));
  t('herkese açık tutanak imzayla açılıyor', /verifyDocToken\('emanet', id, token\)/.test(oku('src/app/belge/emanet/[id]/[token]/page.tsx')));
  t('müşteri sayfasında "Müşteride duran" kartı', /<MusteriEmanetKarti /.test(oku('src/app/(dashboard)/customers/[id]/page.tsx')));
  t('demo tohumu tek satırla bağlı', (oku('scripts/seed-bayi-demo.mjs').match(/seed-demo-emanet\.mjs/g) ?? []).length === 1);
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
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı — işlemler\n');
  const ON = 'emanet-testi-';
  await p.tenant.deleteMany({ where: { slug: { startsWith: ON } } });
  const b = await p.tenant.create({ data: { name: 'Emanet Testi', slug: `${ON}${Date.now()}` } });
  const diger = await p.tenant.create({ data: { name: 'Emanet Komşu', slug: `${ON}k-${Date.now()}` } });
  const V = await al('emanet-veri');
  const { degisimKaydet } = await al('verim-ogrenme');
  const { kacanTonerler } = await al('kacan-toner');
  try {
    const kul = await p.user.create({ data: { tenantId: b.id, email: `emanet.${Date.now()}@ornek.local`, passwordHash: 'x', name: 'Tekniker Ali', role: 'TECHNICIAN' } });
    let n = 0;
    const musteri = (ad, t2 = b.id) => p.customer.create({ data: { tenantId: t2, name: ad, phone: `0532${String(Date.now() + ++n).slice(-7)}` } });
    const cihaz = (m, marka, model, t2 = b.id, ek = {}) => p.device.create({ data: { tenantId: t2, customerId: m.id, brand: marka, model, serialNo: `EM-${++n}`, publicCode: `EM-${Date.now()}-${n}`, qrTokenHash: `em-${Date.now()}-${n}`, counterBlack: 10000 + n * 1000, ...ek } });
    const parca = (ad, grup, stok, ek = {}, t2 = b.id) => p.part.create({ data: { tenantId: t2, sku: `EM-${Date.now()}-${++n}`, name: ad, group: grup, stockQty: stok, sellPrice: 1000, ...ek } });
    const stok = async (id) => (await p.part.findUnique({ where: { id }, select: { stockQty: true } })).stockQty;
    const satirSay = (customerId) => p.emanetHareketi.count({ where: { tenantId: b.id, customerId } });
    const bakiyeOf = async (customerId, partId) => (await p.emanetHareketi.aggregate({ where: { tenantId: b.id, customerId, partId }, _sum: { adet: true } }))._sum.adet ?? 0;

    const M = await musteri('Şehir Hastanesi');
    const M1 = await cihaz(M, 'Kyocera', 'ECOSYS M2540dn');
    const A = await parca('Kyocera TK-1170 Toner', 'TONER', 10, { avgCost: 690, buyPrice: 700 });
    const B = await parca('Muadil TK-1170 Toner', 'TONER', 5, { buyPrice: 400 });
    const C = await parca('Kyocera DK-1150 Drum Ünitesi', 'DRUM', 3, { avgCost: 1350 });
    const yabanciM = await musteri('Komşunun müşterisi', diger.id);
    const yabanciP = await parca('Komşu toneri', 'TONER', 9, {}, diger.id);
    const N = await musteri('Başka Müşteri');
    const N1 = await cihaz(N, 'Kyocera', 'ECOSYS M2540dn');

    const islem = (govde, an) => V.emanetIslemi(b.id, kul.id, govde, an);
    let r = await islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: A.id, adet: 4 }, { partId: C.id, adet: 1 }], bosAdet: 2, deviceId: M1.id, not: 'arşiv dolabı' });
    const birakis = await p.emanetHareketi.findMany({ where: { customerId: M.id }, orderBy: { createdAt: 'asc' } });
    t('★ bırak: stok düştü (A 10→6, drum 3→2), iki satır, aynı an', r.ok && (await stok(A.id)) === 6 && (await stok(C.id)) === 2 && birakis.length === 2
      && birakis[0].tarih.getTime() === birakis[1].tarih.getTime() && r.stok[A.id] === 6, r);
    t('birim maliyet = ortalama maliyet; boş kartuş ilk satırda; kim bıraktı yazılı', Number(birakis[0].birimMaliyet) === 690 && birakis[0].bosAdet === 2 && birakis[1].bosAdet === 0
      && birakis[0].kullaniciId === kul.id && birakis[0].deviceId === M1.id && birakis[0].tur === 'BIRAKILDI' && r.tutanakId === birakis[0].id);
    const r2 = await islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: B.id, adet: 1 }, { partId: A.id, adet: 7 }] });
    t('★ stok yetmezse STOK_YETERSIZ ve bırakışın TAMAMI geri alınır (eksiye düşmez)', !r2.ok && r2.hata === 'EMANET_STOK_YETERSIZ' && r2.deger?.p2 === 6
      && (await stok(B.id)) === 5 && (await stok(A.id)) === 6 && (await satirSay(M.id)) === 2, r2);
    const r3 = await islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: B.id, adet: 1 }] });
    const bSatir = await p.emanetHareketi.findFirst({ where: { customerId: M.id, partId: B.id } });
    t('ortalaması olmayan kartta maliyet = son alış', r3.ok && Number(bSatir.birimMaliyet) === 400);

    r = await islem({ islem: 'iade', customerId: M.id, kalemler: [{ partId: A.id, adet: 1 }] });
    t('★ iade: defter −1, stok geri arttı (6→7)', r.ok && (await stok(A.id)) === 7 && (await bakiyeOf(M.id, A.id)) === 3 && r.stok[A.id] === 7, r);
    r = await islem({ islem: 'iade', customerId: M.id, kalemler: [{ partId: A.id, adet: 10 }] });
    t('★ bakiye aşımı reddi (defterde 3)', !r.ok && r.hata === 'EMANET_BAKIYE_ASIMI' && r.deger?.p2 === 3 && (await stok(A.id)) === 7, r);
    r = await islem({ islem: 'kayip', customerId: M.id, kalemler: [{ partId: C.id, adet: 2 }] });
    t('kayıp da rafta olandan fazla yazılamaz', !r.ok && r.hata === 'EMANET_BAKIYE_ASIMI');
    r = await islem({ islem: 'kayip', customerId: M.id, kalemler: [{ partId: C.id, adet: 1 }], not: 'müşteri kırdı' });
    const kayip = await p.emanetHareketi.findFirst({ where: { customerId: M.id, tur: 'KAYIP' } });
    t('★ kayıp: defter −1, stok değişmez, değeri satırda (1350)', r.ok && kayip.adet === -1 && Number(kayip.birimMaliyet) === 1350 && (await stok(C.id)) === 2 && kayip.not === 'müşteri kırdı');

    const once3 = await satirSay(M.id);
    r = await islem({ islem: 'sayim', customerId: M.id, kalemler: [{ partId: A.id, sayilan: 2 }, { partId: B.id, sayilan: 1 }, { partId: C.id, sayilan: 1 }] });
    const sayimlar = await p.emanetHareketi.findMany({ where: { customerId: M.id, tur: 'SAYIM' } });
    t('★ sayım: A defterde 3, rafta 2 → −1; C defterde 0, rafta 1 → +1; tutan B satır açmaz', r.ok && sayimlar.length === 2
      && sayimlar.find((s) => s.partId === A.id)?.adet === -1 && sayimlar.find((s) => s.partId === C.id)?.adet === 1
      && (await satirSay(M.id)) === once3 + 2 && r.sayim.find((s) => s.anahtar === B.id)?.fark === 0, r.sayim);
    t('eksik çıkan sayımın değeri FIFO maliyetinden (690)', Number(sayimlar.find((s) => s.partId === A.id).birimMaliyet) === 690);
    r = await islem({ islem: 'sayim', customerId: M.id, kalemler: [{ partId: A.id, sayilan: 2 }] });
    t('tutan sayım deftere satır açmıyor', r.ok && (await satirSay(M.id)) === once3 + 2 && r.sayim[0].fark === 0);

    t('★ başka bayinin müşterisi, parçası, ya da başka müşterinin makinesi kullanılamaz',
      (await islem({ islem: 'birak', customerId: yabanciM.id, kalemler: [{ partId: A.id, adet: 1 }] })).hata === 'EMANET_MUSTERI_YOK'
      && (await islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: yabanciP.id, adet: 1 }] })).hata === 'EMANET_PARCA_YOK'
      && (await islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: A.id, adet: 1 }], deviceId: N1.id })).hata === 'EMANET_CIHAZ_YOK'
      && (await stok(yabanciP.id)) === 9);

    // Yarış: aynı stoktan iki teknisyen aynı anda; aynı raftan iki iade aynı anda.
    const [y1, y2] = await Promise.all([
      islem({ islem: 'birak', customerId: N.id, kalemler: [{ partId: A.id, adet: 4 }] }),
      islem({ islem: 'birak', customerId: M.id, kalemler: [{ partId: A.id, adet: 4 }] }),
    ]);
    t('★ eşzamanlı iki bırakış (stok 7, ikisi 4): biri geçti, biri STOK_YETERSIZ, stok 3', [y1, y2].filter((x) => x.ok).length === 1
      && [y1, y2].some((x) => x.hata === 'EMANET_STOK_YETERSIZ') && (await stok(A.id)) === 3, [y1, y2]);
    const nBakiye = await bakiyeOf(N.id, A.id);
    const [i1, i2] = await Promise.all([
      islem({ islem: 'iade', customerId: N.id, kalemler: [{ partId: A.id, adet: Math.max(1, nBakiye) }] }),
      islem({ islem: 'iade', customerId: N.id, kalemler: [{ partId: A.id, adet: Math.max(1, nBakiye) }] }),
    ]);
    t('★ eşzamanlı iki tam iade: biri geçti, öteki BAKIYE_ASIMI — defter eksiye düşmedi', [i1, i2].filter((x) => x.ok).length <= 1
      && (await bakiyeOf(N.id, A.id)) >= 0, { i1, i2, nBakiye });

    // ── OTOMATİK TÜKETİM ────────────────────────────────────────────────
    console.log('\nVeritabanı — otomatik tüketim\n');
    const P = await musteri('Bilge Koleji');
    const P1 = await cihaz(P, 'Kyocera', 'ECOSYS M2540dn');
    const P2 = await cihaz(P, 'KYOCERA', 'ECOSYS M2540DN');
    const P3 = await cihaz(P, 'Canon', 'iR-ADV C3525i', b.id, { counterColor: 5000, tonerYieldColor: 9000 });
    await p.part.update({ where: { id: A.id }, data: { stockQty: 20 } });
    await islem({ islem: 'birak', customerId: P.id, kalemler: [{ partId: A.id, adet: 3 }], deviceId: P1.id }, new Date(Date.now() - 2 * GUN));
    const tak = async () => p.emanetHareketi.findMany({ where: { customerId: P.id, tur: 'TAKILDI' } });
    const d1 = await degisimKaydet({ tenantId: b.id, deviceId: P2.id, channel: 'BLACK', counterValue: 17000, source: 'TARAYICI', note: '%5 → %97' });
    let tk = await tak();
    t('★ tarayıcı aynı modeldeki makinede değişim gördü → raftan −1 TAKILDI (kimse yazmadı)', tk.length === 1 && tk[0].tonerChangeId === d1.id && tk[0].adet === -1
      && tk[0].partId === A.id && tk[0].kullaniciId === null && tk[0].deviceId === P2.id && (await bakiyeOf(P.id, A.id)) === 2, tk);
    t('takılanın maliyeti FIFO (690)', Number(tk[0].birimMaliyet) === 690);
    const ikinci = await V.emanettenDus(d1.id);
    t('★ aynı değişim ikinci kez düşmez (idempotent)', ikinci.durum === 'ATLANDI' && ikinci.sebep === 'ZATEN' && (await tak()).length === 1, ikinci);
    const fis = await degisimKaydet({ tenantId: b.id, deviceId: P2.id, channel: 'BLACK', counterValue: 17010, partId: A.id, source: 'FIS', note: 'TK-1170' });
    t('★ teknisyen aynı toneri fişe yazınca (tarayıcı kaydına eklenir) ikinci kez düşmez', fis.id === d1.id && (await tak()).length === 1 && (await bakiyeOf(P.id, A.id)) === 2);

    await islem({ islem: 'birak', customerId: P.id, kalemler: [{ partId: B.id, adet: 2 }], deviceId: P1.id }, new Date(Date.now() - GUN));
    const d2 = await degisimKaydet({ tenantId: b.id, deviceId: P1.id, channel: 'BLACK', counterValue: 19000, source: 'ELLE' });
    const s2 = await V.emanettenDus(d2.id);
    t('★ rafta iki uyan toner (orijinal + muadil): BELİRSİZ, düşmez', s2.sebep === 'BELIRSIZ' && (await tak()).length === 1, s2);
    const d3 = await degisimKaydet({ tenantId: b.id, deviceId: P1.id, channel: 'BLACK', counterValue: 22000, partId: B.id, source: 'FIS', note: 'Muadil' });
    tk = await tak();
    t('★ fişte parça yazılıysa o düşer (muadil 2→1)', tk.length === 2 && tk.some((x) => x.tonerChangeId === d3.id && x.partId === B.id) && (await bakiyeOf(P.id, B.id)) === 1);

    await p.tonerSevki.create({ data: { tenantId: b.id, deviceId: P2.id, channel: 'BLACK', partId: A.id, gonderildiAt: new Date(Date.now() - 3600_000) } });
    const d4 = await degisimKaydet({ tenantId: b.id, deviceId: P2.id, channel: 'BLACK', counterValue: 25000, source: 'TARAYICI' });
    const sevk = await p.tonerSevki.findFirst({ where: { deviceId: P2.id } });
    t('★ açık sevk varsa takılan sevk edilen toner: emanete dokunulmaz', sevk.durum === 'TAKILDI' && sevk.tonerChangeId === d4.id && (await tak()).length === 2
      && (await bakiyeOf(P.id, A.id)) === 2 && (await V.emanettenDus(d4.id)).sebep === 'SEVK');

    const d5 = await degisimKaydet({ tenantId: b.id, deviceId: P3.id, channel: 'COLOR', counterValue: 6000, source: 'TARAYICI' });
    t('★ renkli makinenin renkli değişimi siyah Kyocera tonerinden düşmez', (await V.emanettenDus(d5.id)).durum === 'ATLANDI' && (await tak()).length === 2);
    const geriye = await degisimKaydet({ tenantId: b.id, deviceId: P1.id, channel: 'BLACK', counterValue: 12000, changedAt: new Date(Date.now() - 10 * GUN), source: 'ELLE' });
    t('★ bırakılıştan ÖNCEKİ değişim raftaki tonerden düşmez', (await tak()).every((x) => x.tonerChangeId !== geriye.id) && (await V.emanettenDus(geriye.id)).durum === 'ATLANDI');
    const goc = await p.tonerChange.create({ data: { tenantId: b.id, deviceId: P1.id, channel: 'BLACK', counterValue: 30000, changedAt: new Date(), source: 'GOC' } });
    t('geçmiş aktarımı (GOC) düşmez', (await V.emanettenDus(goc.id)).sebep === 'GOC');

    const Q = await musteri('Sadece Drum');
    const Q1 = await cihaz(Q, 'Kyocera', 'ECOSYS M2540dn');
    await islem({ islem: 'birak', customerId: Q.id, kalemler: [{ partId: C.id, adet: 1 }], deviceId: Q1.id }, new Date(Date.now() - GUN));
    const dq = await degisimKaydet({ tenantId: b.id, deviceId: Q1.id, channel: 'BLACK', counterValue: 40000, source: 'TARAYICI' });
    t('rafta yalnız drum varsa toner değişimi düşmez', (await V.emanettenDus(dq.id)).durum === 'ATLANDI' && (await bakiyeOf(Q.id, C.id)) === 1);

    // Son toner için aynı anda iki değişim: yalnız biri düşer.
    const R = await musteri('Tek Yedekli');
    const R1 = await cihaz(R, 'Kyocera', 'ECOSYS M2540dn');
    const R2 = await cihaz(R, 'Kyocera', 'ECOSYS M2540dn');
    await islem({ islem: 'birak', customerId: R.id, kalemler: [{ partId: A.id, adet: 1 }], deviceId: R1.id }, new Date(Date.now() - GUN));
    const [c1, c2] = await Promise.all([R1, R2].map((d, i) => p.tonerChange.create({ data: { tenantId: b.id, deviceId: d.id, channel: 'BLACK', counterValue: 50000 + i, changedAt: new Date(), source: 'TARAYICI' } })));
    const [u1, u2] = await Promise.all([V.emanettenDus(c1.id), V.emanettenDus(c2.id)]);
    t('★ son yedek için eşzamanlı iki değişim: biri düştü, defter 0 (eksiye inmedi)', [u1, u2].filter((x) => x.durum === 'DUSULDU').length === 1 && (await bakiyeOf(R.id, A.id)) === 0, [u1, u2]);

    // ── KAÇAN TONER BAĞI ─────────────────────────────────────────────────
    console.log('\nVeritabanı — kaçan toner bağı\n');
    const T = await parca('Pantum TL-410X Toner', 'TONER', 10, { avgCost: 540 });
    const D = await parca('Pantum DL-410 Drum', 'DRUM', 4, { avgCost: 470 });
    const KS = await musteri('Emanetli Ofis');
    const [S1, S2] = await Promise.all([cihaz(KS, 'Pantum', 'M7100DW'), cihaz(KS, 'Pantum', 'M7100DW')]);
    const KU = await musteri('Sonradan Emanet');
    const U1 = await cihaz(KU, 'Pantum', 'M7100DW');
    const KV = await musteri('Rafta Drum');
    const V1 = await cihaz(KV, 'Pantum', 'M7100DW');
    const tarayici = (d, gun) => p.tonerChange.create({ data: { tenantId: b.id, deviceId: d.id, channel: 'BLACK', counterValue: 60000 + gun, changedAt: new Date(Date.now() - gun * GUN), source: 'TARAYICI' } });
    const satirYaz = (m, part, tur, adet, gun, ek = {}) => p.emanetHareketi.create({ data: { tenantId: b.id, customerId: m.id, partId: part.id, parcaAdi: part.name, tur, adet, tarih: new Date(Date.now() - gun * GUN), ...ek } });
    await satirYaz(KS, T, 'BIRAKILDI', 2, 40);
    const kS1 = await tarayici(S1, 20);
    await satirYaz(KS, T, 'TAKILDI', -1, 20, { tonerChangeId: kS1.id, deviceId: S1.id });
    const kS2 = await tarayici(S2, 15);
    const kU1 = await tarayici(U1, 20);
    await satirYaz(KU, T, 'BIRAKILDI', 2, 5);
    await satirYaz(KV, D, 'BIRAKILDI', 1, 40);
    const kV1 = await tarayici(V1, 20);
    const kt = await kacanTonerler(b.id);
    const ids = new Set(kt.kayitlar.map((k) => k.id));
    t('★ emanetten düşülen değişim kaçan toner SAYILMAZ (bayi vermiş)', !ids.has(kS1.id), [...ids]);
    t('★ rafta bayinin yedeği dururken görülen değişim de kaçan sayılmaz', !ids.has(kS2.id));
    t('★ emanet değişimden SONRA bırakıldıysa değişim yine kaçan', ids.has(kU1.id));
    t('rafta yalnız drum varken görülen toner değişimi kaçan', ids.has(kV1.id));

    // ── OKUMA ────────────────────────────────────────────────────────────
    console.log('\nVeritabanı — ekran verisi\n');
    const W = await musteri('Eski Raf AŞ');
    await satirYaz(W, A, 'BIRAKILDI', 5, 120, { birimMaliyet: 690 });
    const yon = await V.emanetOzeti(b.id, { yonetici: true });
    const tek = await V.emanetOzeti(b.id, { yonetici: false });
    const wOz = yon.musteriler.find((m) => m.id === W.id);
    t('★ tepe sayı = raflardaki toner toplamı; yönetici ₺ görür', yon.toplam.adet === yon.musteriler.reduce((s, m) => s + m.kalemler.filter((k) => k.bakiye > 0).reduce((x, k) => x + k.bakiye, 0), 0)
      && yon.toplam.adet > 0 && typeof yon.toplam.deger === 'number' && yon.toplam.deger > 0, yon.toplam);
    t('★ teknisyen adet görür, ₺ görmez (hiçbir alanda)', tek.toplam.deger === null && tek.musteriler.every((m) => m.deger === null && m.kalemler.every((k) => k.deger === null))
      && tek.uyarilar.fazla.every((u) => u.deger === null) && tek.kayip.kayipDeger === null && tek.toplam.adet === yon.toplam.adet);
    t('★ "uzun süredir duran": 120 gündür 5 toner, hiç takılmamış', wOz?.fazla === true && yon.uyarilar.fazla.some((u) => u.musteriId === W.id && u.bakiye === 5 && u.enEskiGun >= 119), wOz);
    t('★ sayım farkı uyarısı (eksik −1, değeriyle)', yon.uyarilar.sayimFarki.some((u) => u.musteriId === M.id && u.fark === -1 && u.deger === 690));
    t('son 12 ay kayıp raporu (kayıp 1 · sayımda eksik 1)', yon.kayip.kayipAdet === 1 && yon.kayip.kayipDeger === 1350 && yon.kayip.eksikAdet >= 1, yon.kayip);
    t('başka bayi bu defteri görmüyor', (await V.emanetOzeti(diger.id, { yonetici: true })).toplam.adet === 0);

    const df = await V.musteriDefteri(b.id, P.id, { yonetici: false });
    const tarayiciSatiri = df.hareketler.find((h) => h.tur === 'TAKILDI' && h.kaynak === 'TARAYICI');
    t('★ defter: en yeni önce; otomatik satır kaynağıyla (ağ tarayıcı), kişi yok', df.hareketler.length === df.hareketSayisi && !!tarayiciSatiri && tarayiciSatiri.kullanici === null
      && new Date(df.hareketler[0].tarih) >= new Date(df.hareketler[df.hareketler.length - 1].tarih));
    t('★ uyan tonerler: bu müşterinin modeline takılmış ya da bırakılmış', df.uygunParcalar.includes(A.id) && df.uygunParcalar.includes(B.id));
    t('teknisyen defterde birim maliyet görmüyor', df.hareketler.every((h) => h.birimMaliyet === null));
    const dfm = await V.musteriDefteri(b.id, M.id, { yonetici: true });
    const ziyaret = new Set((await p.emanetHareketi.findMany({ where: { customerId: M.id, tur: 'BIRAKILDI' } })).map((h) => `${h.tarih.getTime()}|${h.kullaniciId}`)).size;
    t('tutanak bağlantısı bırakışın yalnız ilk satırında (aynı ziyaret tek tutanak)', dfm.hareketler.filter((h) => h.tutanak).length === ziyaret && dfm.hareketler.find((h) => h.id === birakis[0].id)?.tutanak === true
      && dfm.hareketler.find((h) => h.id === birakis[1].id)?.tutanak === false);
    t('başka bayinin müşteri defteri açılmıyor', (await V.musteriDefteri(diger.id, M.id, { yonetici: true })) === null);

    const tt = await V.tutanakVerisi(birakis[1].id, b.id);
    t('★ tutanak: aynı ziyaretin bütün kalemleri, boş kartuş, teslim eden, makine', tt && tt.kalemler.length === 2 && tt.kalemler[0].adet === 4 && tt.bosAdet === 2
      && tt.teslimEden === 'Tekniker Ali' && /M2540dn/.test(tt.cihaz ?? '') && tt.not === 'arşiv dolabı' && tt.no === `ET-${birakis[0].id.slice(-6).toUpperCase()}`, tt);
    t('tutanakta fiyat alanı yok', tt && !('birimMaliyet' in tt.kalemler[0]) && !JSON.stringify(tt).includes('690'));
    t('başka bayinin tutanağı açılmıyor; iade satırı tutanak değil', (await V.tutanakVerisi(birakis[0].id, diger.id)) === null
      && (await V.tutanakVerisi((await p.emanetHareketi.findFirst({ where: { customerId: M.id, tur: 'IADE' } })).id, b.id)) === null);
    const kisa = await V.musteriEmanetKisa(b.id, W.id, { yonetici: false });
    t('müşteri kartı özeti: 5 toner, fazla, ₺ yok', kisa.bakiye === 5 && kisa.fazla === true && kisa.deger === null && kisa.kalemler[0].bakiye === 5);

    const demo = await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
    if (demo) {
      const dz = await V.emanetOzeti(demo.id, { yonetici: true });
      t('★ herkese açık demoda emanet ekranı dolu: raflarda toner, uzun süredir duran, sayım farkı', dz.toplam.adet > 0 && dz.uyarilar.fazla.length > 0 && dz.uyarilar.sayimFarki.length > 0, { adet: dz.toplam.adet, fazla: dz.uyarilar.fazla.length, sayim: dz.uyarilar.sayimFarki.length });
      const otomatik = await p.emanetHareketi.count({ where: { tenantId: demo.id, tur: 'TAKILDI', tonerChangeId: { not: null } } });
      t('★ demoda "kendiliğinden düştü" satırları gerçek toner değişimlerine bağlı', otomatik > 0, otomatik);
      const dk = await kacanTonerler(demo.id);
      t('demoda kaçan toner örneği emanet yüzünden kaybolmadı', dk.adet >= 1, dk.adet);
    } else {
      console.log('  ⊘ demo yerelde kurulu değil');
    }
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.stack ?? e);
  } finally {
    await p.tenant.deleteMany({ where: { slug: { startsWith: ON } } }).catch(() => {});
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
