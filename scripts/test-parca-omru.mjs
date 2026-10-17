// PARÇA ÖMRÜ — drum, fırın, bakım kiti (lib/parca-omru.ts + parca-omru-veri.ts)
// Çalıştır:  node scripts/test-parca-omru.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bu ekran bayiye "bu drum 6 gün sonra bitiyor" diyor. Yanlış alarm (iki yıl
// önce değişmiş drumu "doldu" göstermek, eski fişi bugünkü sayaçla saymak)
// ekrana güveni bir kerede bitirir; sessiz kalmak ise acil servis demek.
// Değişim zinciri, yaklaşık işareti, eşikler ve cihaz ölçümünün önceliği
// burada kilitli.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUNUCU = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLE ────────────────────────────────────────────────────────────────
// Yeni lib dosyası eklenirse buraya: '@/lib/x' importları yerel dosyaya çevrilir.
const MODULLER = ['parca-omru', 'parca-omru-veri', 'toner', 'sayac-tarama', 'tr-katla'];
const g = mkdtempSync(join(tmpdir(), 'st-omur-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...MODULLER.map((m) => join(KOK, `src/lib/${m}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz: '@/lib' yolu burada çözülmüyor, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const m of MODULLER) {
  const yol = join(g, `${m}.js`);
  let s = readFileSync(yol, 'utf8').replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'").replace(/'@prisma\/client'/g, JSON.stringify(istemci));
  for (const d of MODULLER) s = s.split(`'@/lib/${d}'`).join(`'./${d}.js'`);
  writeFileSync(yol, s);
}
const po = await import(pathToFileURL(join(g, 'parca-omru.js')).href);

const GUN = 86_400_000;
const bugun = new Date('2026-10-18T09:00:00Z');
const once = (n) => new Date(bugun.getTime() - n * GUN);
const ok = (b, r) => ({ readingDate: once(b), counterBlack: r, counterColor: 0 });

// ── GİRDİ VE SAYAÇ ───────────────────────────────────────────────────────
console.log('\nGirdi ve sayaç\n');
{
  const a = po.omurSayfaAyikla;
  t('boş ömür = izlenmiyor', a('').gecerli && a('').deger === null && a(null).deger === null && a(undefined).deger === null);
  t('sayı ve sayı metni kabul', a(100000).deger === 100000 && a(' 300000 ').deger === 300000);
  t('★ "100.000" REDDEDİLİYOR (Number() 100 okurdu, drum 100 sayfada dolardı)', a('100.000').gecerli === false && a('100,000').gecerli === false);
  t('0, eksi, kesirli, aşırı büyük reddediliyor', !a(0).gecerli && !a(-5).gecerli && !a(1.5).gecerli && !a(po.EN_FAZLA_OMUR + 1).gecerli && a(po.EN_FAZLA_OMUR).gecerli);

  t('toplam sayaç = siyah + renkli', po.toplamSayac({ counterBlack: 100, counterColor: 50 }) === 150);
  t('★ sıfır sayaç "bilinmiyor" (boş kartın 0\'ı başlangıç sayılmaz)', po.toplamSayac({ counterBlack: 0, counterColor: 0 }) === null && po.toplamSayac(null) === null);
  const s = po.takilmaSayaciSec;
  t('★ takılma sayacı: önce fişin okuması', s({ fisOkumasi: { counterBlack: 1000, counterColor: 0 }, sonOkuma: { counterBlack: 5000, counterColor: 0 }, kart: { counterBlack: 9000, counterColor: 0 } }) === 1000);
  t('fiş okuması yoksa cihazın son okuması', s({ fisOkumasi: null, sonOkuma: { counterBlack: 5000, counterColor: 200 }, kart: { counterBlack: 9000, counterColor: 0 } }) === 5200);
  t('okuma hiç yoksa kart', s({ fisOkumasi: null, sonOkuma: null, kart: { counterBlack: 9000, counterColor: 10 } }) === 9010);
  t('★ hiçbiri yoksa null (uydurulmuş başlangıç yok)', s({ fisOkumasi: null, sonOkuma: null, kart: { counterBlack: null, counterColor: null } }) === null);

  t('günlük sayfa: pencerede iki okuma', Math.round(po.gunlukSayfa([ok(60, 10000), ok(0, 16000)], bugun)) === 100);
  t('★ günlük sayfa yok → null (90 günden eski okumalar sayılmaz)', po.gunlukSayfa([ok(200, 10000), ok(120, 16000)], bugun) === null);
  t('tek okuma → null', po.gunlukSayfa([ok(10, 10000)], bugun) === null);
  t('pencere 90 gün', po.HIZ_PENCERESI_GUN === 90);
}

// ── YAKLAŞIK TAKILMA NOKTASI ─────────────────────────────────────────────
console.log('\nYaklaşık takılma noktası\n');
{
  const n = po.takilmaNoktasi;
  const r = n(12345, once(100), [ok(100, 99999)]);
  t('★ kayıtlı sayaç kesin, "yaklaşık" değil', r.sayac === 12345 && r.yaklasik === false);
  const y = n(null, once(100), [ok(110, 50000), ok(97, 51000)]);
  t('★ kayıt yoksa fiş tarihine EN YAKIN okuma, "yaklaşık" işaretli', y.sayac === 51000 && y.yaklasik === true, y);
  t('eşit uzaklıkta ÖNCEKİ okuma (ömür kısa görünür, uyarı erken gelir)', n(null, once(100), [ok(105, 50000), ok(95, 51000)]).sayac === 50000);
  const u = n(null, once(100), [ok(200, 50000)]);
  t('★ 45 günden uzak okuma: sayı yok, bilinmiyor', u.sayac === null && u.yaklasik === true && po.YAKLASIK_EN_FAZLA_GUN === 45);
  t('0 kaydı kayıtlı sayılmaz (yaklaşığa düşer)', n(0, once(100), [ok(100, 7000)]).yaklasik === true);
}

// ── TÜR, RENK, YUVA ──────────────────────────────────────────────────────
console.log('\nParça türü\n');
{
  const tr = po.parcaTuru;
  t('drum / fırın / bakım kiti / atık kutusu', tr('Drum Unit') === 'DRUM' && tr('Fuser Unit') === 'FIRIN' && tr('Maintenance Kit') === 'BAKIM' && tr('Waste Toner Box') === 'ATIK');
  t('★ Türkçe büyük harf (İ katlanır): "FIRIN ÜNİTESİ", "BAKIM KİTİ"', tr('FIRIN ÜNİTESİ') === 'FIRIN' && tr('KYOCERA BAKIM KİTİ') === 'BAKIM' && tr('Pantum DL-410 Drum Ünitesi') === 'DRUM');
  t('"Fuser Maintenance Kit" bakım kiti; Canon "Fixing Assembly" fırın', tr('HP Fuser Maintenance Kit') === 'BAKIM' && tr('Canon Fixing Assembly') === 'FIRIN');
  t('"Transfer Rulosu" merdane, "Transfer Belt" kayış', tr('Transfer Rulosu') === 'MERDANE' && tr('Intermediate Transfer Belt') === 'KAYIS');
  t('ad bir şey söylemiyorsa stok grubu', tr('FM1-A606', 'FUSER') === 'FIRIN' && tr('DK-1150', 'DRUM') === 'DRUM' && tr('X-1', 'SPARE') === null);
  t('★ tek harf renk sayılmaz ("C-EXV49" camgöbeği değil)', po.parcaRengi('Canon C-EXV49 Drum') === null && po.parcaRengi('Black Drum Unit') === 'K' && po.parcaRengi('Camgöbeği Drum') === 'C');
  t('aynı yuva: tür aynı, renk çelişmiyor', po.ayniYuva({ tur: 'DRUM', renk: null }, { tur: 'DRUM', renk: 'K' }) && !po.ayniYuva({ tur: 'DRUM', renk: 'C' }, { tur: 'DRUM', renk: 'K' }) && !po.ayniYuva({ tur: null, renk: null }, { tur: null, renk: null }));
  t('★ plânlı değişim arıza sayılmaz: sarf değişimi; bakım kiti periyodik bakım', po.planliKategori('DRUM') === 'CONSUMABLE' && po.planliKategori('BAKIM') === 'PERIODIC_MAINTENANCE' && po.planliKategori(null) === 'CONSUMABLE');
}

// ── DEĞİŞİM ZİNCİRİ ──────────────────────────────────────────────────────
console.log('\nDeğişim zinciri\n');
const T = (ek) => ({
  id: ek.id, deviceId: ek.deviceId ?? 'D1', partId: ek.partId ?? 'P-DRUM', parcaAdi: ek.parcaAdi ?? 'Kyocera DK-1150 Drum', grup: 'grup' in ek ? ek.grup : 'DRUM',
  omurSayfa: ek.omurSayfa ?? 100000, adet: ek.adet ?? 1, takilmaSayaci: ek.takilmaSayaci ?? null, fisId: `F-${ek.id}`, fisNo: `SF-${ek.id}`,
  fisTarihi: ek.fisTarihi ?? once(10), parcaTarihi: ek.parcaTarihi ?? ek.fisTarihi ?? once(10), marka: ek.marka ?? 'Kyocera', model: ek.model ?? 'M2540dn',
});
{
  const z = po.sonTakilislar([T({ id: 'a', fisTarihi: once(700) }), T({ id: 'b', fisTarihi: once(60) })]);
  t('★ aynı parça iki kez takıldıysa YALNIZ yenisi (eskisi değişmiş sayılır)', z.length === 1 && z[0].id === 'b', z.map((x) => x.id));
  const m = po.sonTakilislar([T({ id: 'oem', fisTarihi: once(300) }), T({ id: 'muadil', partId: 'P-MUADIL', parcaAdi: 'DK-1150 Muadil Drum', fisTarihi: once(30) })]);
  t('★ aynı yuvaya başka kart (orijinal → muadil): eskisi düşer', m.length === 1 && m[0].id === 'muadil', m.map((x) => x.id));
  const r = po.sonTakilislar([T({ id: 'c', partId: 'P-C', parcaAdi: 'Cyan Drum', fisTarihi: once(300) }), T({ id: 'k', partId: 'P-K', parcaAdi: 'Black Drum', fisTarihi: once(30) })]);
  t('farklı renk drumlar ayrı yuva: ikisi de kalır', r.length === 2);
  const d = po.sonTakilislar([T({ id: 'x', deviceId: 'D1' }), T({ id: 'y', deviceId: 'D2' })]);
  t('farklı cihazlar birbirini düşürmez', d.length === 2);
  const b = po.sonTakilislar([T({ id: 'u1', partId: 'P-U1', parcaAdi: 'Parça X', grup: null, fisTarihi: once(100) }), T({ id: 'u2', partId: 'P-U2', parcaAdi: 'Parça Y', grup: null, fisTarihi: once(10) })]);
  t('türü bilinmeyen farklı kartlar birbirini düşürmez', b.length === 2);
  const ay = po.sonTakilislar([T({ id: 'e1', fisTarihi: once(5), parcaTarihi: once(5) }), T({ id: 'e2', fisTarihi: once(5), parcaTarihi: new Date(once(5).getTime() + 3600000) })]);
  t('aynı fişte iki kayıt: sonra eklenen', ay.length === 1 && ay[0].id === 'e2');
}

// ── HESAP VE EŞİKLER ─────────────────────────────────────────────────────
console.log('\nHesap ve eşikler\n');
{
  const h = po.sayactanHesap({ omurSayfa: 100000, takilma: 200000, guncel: 260000, gunluk: 200 });
  t('★ sayaçtan: kalan = ömür − (şimdi − takılma); gün = kalan ÷ hız', h.kalanSayfa === 40000 && h.yuzde === 40 && h.gun === 200 && h.durum === 'IYI', h);
  const asim = po.sayactanHesap({ omurSayfa: 100000, takilma: 100000, guncel: 210000, gunluk: 100 });
  t('ömür aşıldı: kalan eksi, gün eksi, KRİTİK, yüzde 0', asim.kalanSayfa === -10000 && asim.gun === -100 && asim.yuzde === 0 && asim.durum === 'KRITIK', asim);
  const hizsiz = po.sayactanHesap({ omurSayfa: 100000, takilma: 200000, guncel: 260000, gunluk: null });
  t('★ günlük sayfa yokken gün NULL (sayfa yine söylenir)', hizsiz.gun === null && hizsiz.kalanSayfa === 40000, hizsiz);
  t('★ sayaç geriledi (makine değişmiş): bilinmiyor, sayı uydurulmaz', po.sayactanHesap({ omurSayfa: 100000, takilma: 300000, guncel: 1000, gunluk: 50 }).sebep === 'SAYAC_GERILEDI');
  t('takılma bilinmiyor / sayaç yok: sebebiyle bilinmiyor', po.sayactanHesap({ omurSayfa: 1, takilma: null, guncel: 5, gunluk: 1 }).sebep === 'BASLANGIC_YOK'
    && po.sayactanHesap({ omurSayfa: 1, takilma: 5, guncel: null, gunluk: 1 }).durum === 'BILINMIYOR');

  const d = po.durumBul;
  t('★ eşikler: ≤%10 kritik, ≤%20 yakında, üstü iyi', d(10, null) === 'KRITIK' && d(11, null) === 'YAKINDA' && d(20, null) === 'YAKINDA' && d(21, null) === 'IYI' && po.KRITIK_YUZDE === 10 && po.YAKINDA_YUZDE === 20);
  t('kritik eşik Ağ Tarayıcı ile aynı sayı', po.KRITIK_YUZDE === (oku('src/lib/sayac-tarama.ts').match(/PARCA_KRITIK = (\d+)/)?.[1] | 0));
  t('çok basan makine: yüzde yüksek ama 30 gün içinde → yakında', d(50, 25) === 'YAKINDA' && d(50, 31) === 'IYI');
  t('yüzde yoksa BİLİNMİYOR (yeşil değil)', d(null, null) === 'BILINMIYOR');

  const c = po.cihazdanHesap({ yuzde: 8, omurSayfa: 100000, gunluk: 400 });
  t('★ cihazdan + kart ömrü: kalan sayfa ve gün TAHMİN', c.yuzde === 8 && c.kalanSayfa === 8000 && c.gun === 20 && c.durum === 'KRITIK', c);
  const c2 = po.cihazdanHesap({ yuzde: 8, omurSayfa: null, gunluk: 400 });
  t('★ cihazdan, kart ömrü yok: yalnız yüzde, gün uydurulmaz', c2.kalanSayfa === null && c2.gun === null && c2.yuzde === 8);

  const u = po.ufuktaMi;
  t('30 gün ufku: gün 30 içinde, 31 dışında', u({ durum: 'YAKINDA', gun: 30, yuzde: 50 }) && !u({ durum: 'IYI', gun: 31, yuzde: 50 }) && po.UFUK_GUN === 30);
  t('★ günü bilinmeyen: cihaz ≤%10 diyorsa sayılır, %15 sayılmaz', u({ durum: 'KRITIK', gun: null, yuzde: 10 }) && !u({ durum: 'YAKINDA', gun: null, yuzde: 15 }));
  t('bilinmeyen satır ufka girmez', !u({ durum: 'BILINMIYOR', gun: null, yuzde: null }));

  const k = po.cihazKalemleri([{ ad: 'Black Toner', yuzde: 40, tur: 'TONER' }, { ad: 'Drum Unit', yuzde: 8, tur: 'PARCA' }, { ad: 'Bozuk', yuzde: 140, tur: 'PARCA' }, null], 8);
  t('cihaz kalemleri: yalnız PARÇA, bozuk değer atılır', k.length === 1 && k[0].ad === 'Drum Unit' && k[0].yuzde === 8, k);
  t('eski tarama (kalem adı yok, olcumParca var): adsız tek kalem', JSON.stringify(po.cihazKalemleri(null, 12)) === JSON.stringify([{ ad: '', yuzde: 12 }]) && po.cihazKalemleri(null, null).length === 0);
}

// ── BİRLEŞTİRME: CİHAZ ÖLÇÜMÜ ÖNCELİKLİ ──────────────────────────────────
console.log('\nBirleştirme\n');
{
  const cihaz = (id, ek = {}) => ({
    deviceId: id, marka: 'Kyocera', model: 'M2540dn', seri: `S-${id}`, publicCode: `PC-${id}`, konum: null,
    musteriId: 'M1', musteri: 'Müşteri', guncelSayac: 260000, sayacTarihi: once(1).toISOString(), gunlukSayfa: 200, olcumAt: null, kalemler: [], ...ek,
  });
  const coz = (x, sayac, yaklasik = false) => ({ ...x, takilma: { sayac, yaklasik } });
  const cihazlar = new Map([
    // A: cihaz drum %8 bildiriyor + fişle drum takılmış (sayaç %40 der) + fişle fırın (cihaz söylemiyor).
    ['A', cihaz('A', { olcumAt: once(1), kalemler: [{ ad: 'Drum Unit', yuzde: 8 }, { ad: 'Staple Cartridge', yuzde: 50 }] })],
    // B: aynı model, kendi takılışı yok, tarayıcı drum %12 diyor → kart modelden.
    ['B', cihaz('B', { olcumAt: once(40), kalemler: [{ ad: 'Drum Unit', yuzde: 12 }] })],
    // C: tarayıcı yok, eski fişte drum (yaklaşık), günlük sayfa yok.
    ['C', cihaz('C', { model: 'TASKalfa', gunlukSayfa: null, guncelSayac: 150000 })],
  ]);
  const takilislar = [
    coz(T({ id: 'a-drum', deviceId: 'A', takilmaSayaci: 200000, fisTarihi: once(300) }), 200000),
    coz(T({ id: 'a-firin', deviceId: 'A', partId: 'P-FIRIN', parcaAdi: 'Fırın Ünitesi', grup: 'FUSER', omurSayfa: 300000, takilmaSayaci: 250000, fisTarihi: once(50) }), 250000),
    coz(T({ id: 'c-drum', deviceId: 'C', model: 'TASKalfa', fisTarihi: once(200) }), 140000, true),
  ];
  const satirlar = po.omurSatirlari({ cihazlar, takilislar, bugun });
  const A = satirlar.filter((s) => s.deviceId === 'A');
  const aDrum = A.find((s) => s.tur === 'DRUM');
  t('★ aynı drum İKİ satır değil: cihaz bildiriyorsa tek CİHAZ satırı', A.filter((s) => s.tur === 'DRUM').length === 1 && aDrum?.kaynak === 'CIHAZ', A.map((s) => [s.kaynak, s.parca]));
  t('★ cihazın kendi ölçümü önceliklidir (%8), sayaç hesabı (%40) ayrıntıda', aDrum?.hesap.yuzde === 8 && aDrum?.sayactan?.yuzde === 40, { h: aDrum?.hesap, s: aDrum?.sayactan });
  t('cihaz satırına kartın ömrüyle gün tahmini: %8 × 100.000 ÷ 200', aDrum?.kart?.id === 'P-DRUM' && aDrum?.kart?.kaynak === 'BU_CIHAZ' && aDrum?.hesap.gun === 40, aDrum?.hesap);
  t('cihazın bildirmediği fırın ayrı SAYAÇ satırı', A.some((s) => s.kaynak === 'SAYAC' && s.tur === 'FIRIN' && s.hesap.yuzde === 97));
  t('türü bilinmeyen cihaz kalemi de satır (kartsız, gün yok)', A.some((s) => s.parca === 'Staple Cartridge' && s.kart === null && s.hesap.gun === null));
  const B = satirlar.find((s) => s.deviceId === 'B');
  t('★ kendi takılışı olmayan cihaz: kart AYNI MODELDEN (sayaç hesabı başka makinenin değil)', B?.kart?.kaynak === 'AYNI_MODEL' && B?.sayactan === null && B?.hesap.gun === 60, B && { kart: B.kart, h: B.hesap });
  t('★ 30 günden eski ölçüm "eski ölçüm" işaretli', B?.eskiOlcum === true && aDrum?.eskiOlcum === false);
  const C = satirlar.find((s) => s.deviceId === 'C');
  t('★ takılma sayacı kayıtlı değil → yaklaşık işaretli', C?.kaynak === 'SAYAC' && C?.yaklasik === true && C?.hesap.yuzde === 90);
  t('★ günlük sayfa yokken gün null', C?.hesap.gun === null);
  t('farklı modelin kartı başka modele geçmez', !satirlar.some((s) => s.deviceId === 'C' && s.kart?.kaynak === 'AYNI_MODEL'));
  t('★ sıra: kritik → yakında → iyi; ilk satır en acil', satirlar[0].deviceId === 'A' && satirlar[0].hesap.durum === 'KRITIK'
    && satirlar.findIndex((s) => s.hesap.durum === 'IYI') > satirlar.findIndex((s) => s.hesap.durum === 'YAKINDA'), satirlar.map((s) => [s.deviceId, s.parca, s.hesap.durum, s.hesap.gun]));
  t('fiş aç: kategori sarf değişimi', aDrum?.kategori === 'CONSUMABLE');

  const oz = po.omurOzeti(satirlar);
  t('özet: ufukta = gün ≤ 30 ya da günsüz kritik', oz.ufukta === satirlar.filter((s) => s.ufukta).length && oz.satir === satirlar.length && oz.cihaz === 3, oz);

  const st = po.stokIhtiyaci(satirlar, new Map([['P-DRUM', 1]]));
  const drum = st.kalemler.find((k) => k.partId === 'P-DRUM');
  t('stok ihtiyacı: ufuktaki satırlar kart başına', st.kalemler.every((k) => k.gereken > 0) && (!drum || drum.eksik === Math.max(0, drum.gereken - 1)), st);
  const bos = po.stokIhtiyaci([{ ...aDrum, ufukta: true, kart: null, parca: 'Drum Unit' }, { ...aDrum, anahtar: 'x', ufukta: true, kart: null, parca: 'DRUM UNIT' }], new Map());
  t('★ kartı belli olmayan ayrı listede, kart UYDURULMAZ', bos.kalemler.length === 0 && bos.kartsiz.length === 1 && bos.kartsiz[0].adet === 2, bos);
  const set = po.stokIhtiyaci([{ ...satirlar.find((s) => s.kaynak === 'SAYAC'), ufukta: true, takilis: { fisId: 'f', fisNo: 'n', tarih: '', sayac: 1, adet: 4 } }], new Map([['P-FIRIN', 1]]));
  t('sayaç satırı takıldığı adetle sayılır (dörtlü set dördü birden biter)', set.kalemler[0]?.gereken === 4 && set.kalemler[0]?.eksik === 3, set);
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const uc = oku('src/app/api/tickets/[id]/parts/route.ts');
  t('★ fiş parçası eklenirken takılma sayacı yazılıyor', /takilmaSayaciBul\(user\.tenantId, ticketId, ticket\.deviceId\)/.test(uc) && /takilmaSayaci,\n/.test(uc.replace(/\r/g, '')));
  t('★ eski sistemden aktarılan fiş bugünkü sayaçla yazılmıyor (null → yaklaşık)', /takilmaSayaci: null/.test(oku('src/app/api/import/sql/route.ts')));
  const menu = oku('src/lib/menu-aileleri.ts');
  t('menü: Stok ailesinde Toner Verimi\'nin arkasında', /'\/toner-verimi', '\/parca-omru'/.test(menu));
  t('teknisyen de görüyor (yardımdan önce)', /'\/parca-omru',\s*\n\s*'\/yardim'/.test(menu.replace(/\r/g, '').replace(/\n\s*\/\/[^\n]*/g, '')));
  t('her pakette açık (modül haritasında yok)', !oku('src/lib/modules.ts').includes('/parca-omru'));
  const veri = oku('src/lib/parca-omru-veri.ts');
  t('★ yanıtta para yok (fiyat/maliyet okunmuyor)', !/sellPrice|buyPrice|avgCost|unitPrice|unitCost/.test(veri) && !/sellPrice|buyPrice|unitPrice/.test(oku('src/app/api/parca-omru/route.ts')));
  t('uç oturum istiyor', /requireTenantUser\(\)/.test(oku('src/app/api/parca-omru/route.ts')));
  t('★ demoda kartın ömrü değiştirilemiyor (vitrin), aynı değer geçiyor', /omur\.deger !== existing\.omurSayfa[\s\S]{0,400}demoBayiMi/.test(oku('src/app/api/inventory/[id]/route.ts')));
  t('çöpteki ve iptal fişin parçası takılmış sayılmaz', /"deletedAt" IS NULL AND t\."status" <> 'CANCELLED'/.test(veri));
  t('★ cihaz başına sorgu yok (DISTINCT ON / LATERAL, döngüde await yok)', /DISTINCT ON/.test(veri) && /LATERAL/.test(veri) && !/for \([^)]*\) \{[^}]*await prisma/.test(veri));
  const demo = oku('scripts/seed-bayi-demo.mjs');
  t('demo tazelemesi parça ömrü demosunu TEK satırla çağırıyor', (demo.match(/seed-demo-parca-omru\.mjs/g) ?? []).length === 1);
  t('demo dosyası fonksiyon dışa aktarıyor', /export async function parcaOmruDemosu/.test(oku('scripts/seed-demo-parca-omru.mjs')));
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
  console.log('\nVeritabanı\n');
  const veri = await import(pathToFileURL(join(g, 'parca-omru-veri.js')).href);
  const ONEK = 'parca-omru-testi-';
  await p.tenant.deleteMany({ where: { slug: { startsWith: ONEK } } });
  const b = await p.tenant.create({ data: { name: 'Parça Ömrü Testi', slug: `${ONEK}${Date.now()}` } });
  const b2 = await p.tenant.create({ data: { name: 'Parça Ömrü Testi 2', slug: `${ONEK}${Date.now()}-2` } });
  try {
    const simdi = new Date();
    const gunOnce = (n) => new Date(simdi.getTime() - n * GUN);
    const u = await p.user.create({ data: { tenantId: b.id, email: `omur.${Date.now()}@ornek.local`, passwordHash: 'x', name: 'Y', role: 'ADMIN' } });
    const m = await p.customer.create({ data: { tenantId: b.id, name: 'Hastane', phone: '05320001122' } });
    let n = 0;
    const cihaz = (ek = {}) => p.device.create({ data: { tenantId: b.id, customerId: m.id, brand: 'Kyocera', model: 'ECOSYS M2540dn', serialNo: `PO-${++n}-${Date.now()}`, publicCode: `PO-${n}-${Date.now()}`, qrTokenHash: `po-${n}-${Date.now()}`, ...ek } });
    const okuma = (d, gun, toplam, ek = {}) => p.counterReading.create({ data: { tenantId: b.id, deviceId: d.id, readingDate: gunOnce(gun), counterBlack: toplam, counterColor: 0, ...ek } });
    const fis = (d, gun, ek = {}) => p.serviceTicket.create({ data: { tenantId: b.id, customerId: m.id, deviceId: d.id, ticketNumber: `PO-${++n}`, issueText: 'drum', createdByUserId: u.id, createdAt: gunOnce(gun), ...ek } });
    const drum = await p.part.create({ data: { tenantId: b.id, sku: `DK-${Date.now()}`, name: 'Kyocera DK-1150 Drum Ünitesi', group: 'DRUM', sellPrice: 2400, stockQty: 1, omurSayfa: 100000 } });
    const paten = await p.part.create({ data: { tenantId: b.id, sku: `PT-${Date.now()}`, name: 'Kağıt Alma Pateni', group: 'ROLLER', sellPrice: 480, stockQty: 9 } });

    // ── takilmaSayaci: fiş parçası eklenirken ──
    const A = await cihaz({ counterBlack: 999999, counterColor: 0 });
    await okuma(A, 30, 200000);
    const fA = await fis(A, 2);
    await okuma(A, 2, 250000, { ticketId: fA.id });
    await okuma(A, 1, 250900); // fişten sonra tarayıcıdan gelen okuma
    t('★ fişin okuması varsa ONUN sayacı (sonraki okuma değil)', (await veri.takilmaSayaciBul(b.id, fA.id, A.id)) === 250000);
    const fA2 = await fis(A, 0);
    t('★ fişin okuması yoksa cihazın son okuması', (await veri.takilmaSayaciBul(b.id, fA2.id, A.id)) === 250900);
    const K = await cihaz({ counterBlack: 41000, counterColor: 500 });
    const fK = await fis(K, 0);
    t('okuma hiç yoksa cihaz kartı', (await veri.takilmaSayaciBul(b.id, fK.id, K.id)) === 41500);
    const Y = await cihaz();
    const fY = await fis(Y, 0);
    t('★ hiçbir sayaç yoksa null (0 yazılmıyor)', (await veri.takilmaSayaciBul(b.id, fY.id, Y.id)) === null);
    t('başka bayinin fişi/cihazı okunmuyor', (await veri.takilmaSayaciBul(b2.id, fA.id, A.id)) === null);
    // Uçtaki yazma: aynı işlev, aynı alan (uç oturum istiyor; kaynağı yukarıda doğrulandı).
    const tp = await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fA2.id, partId: paten.id, quantity: 1, unitPrice: 480, takilmaSayaci: await veri.takilmaSayaciBul(b.id, fA2.id, A.id) } });
    t('★ fiş parçası takılma sayacıyla kaydoldu (ömürsüz parça da: ömür sonradan girilirse hazır)', (await p.ticketPart.findUnique({ where: { id: tp.id } })).takilmaSayaci === 250900);

    // ── uçtan uca liste ──
    // A: tarayıcı drum %7 + fişle drum (sayaç). B: fişle drum, takılma sayacı YOK (eski kayıt).
    // C: drum iki kez değişmiş. D: iptal fişte drum (sayılmaz).
    await p.device.update({ where: { id: A.id }, data: { olcumAt: gunOnce(0), olcumParca: 7, olcumSarf: [{ ad: 'Black Toner', yuzde: 50, tur: 'TONER' }, { ad: 'Drum Unit', yuzde: 7, tur: 'PARCA' }] } });
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fA.id, partId: drum.id, quantity: 1, unitPrice: 2400, takilmaSayaci: 180000 } });
    const B = await cihaz();
    await okuma(B, 400, 100000); await okuma(B, 80, 160000); await okuma(B, 0, 172000);
    const fB = await fis(B, 395);
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fB.id, partId: drum.id, quantity: 1, unitPrice: 2400, createdAt: gunOnce(395) } });
    const C = await cihaz();
    await okuma(C, 80, 300000); await okuma(C, 0, 316000);
    const fC1 = await fis(C, 700), fC2 = await fis(C, 40);
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fC1.id, partId: drum.id, quantity: 1, unitPrice: 2400, takilmaSayaci: 50000, createdAt: gunOnce(700) } });
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fC2.id, partId: drum.id, quantity: 1, unitPrice: 2400, takilmaSayaci: 308000, createdAt: gunOnce(40) } });
    const D = await cihaz();
    await okuma(D, 80, 10000); await okuma(D, 0, 90000);
    const fD = await fis(D, 30, { status: 'CANCELLED' });
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fD.id, partId: drum.id, quantity: 1, unitPrice: 2400, takilmaSayaci: 1 } });

    const v = await veri.parcaOmruVerisi(b.id);
    const satir = (d) => v.satirlar.filter((s) => s.deviceId === d.id);
    const a = satir(A);
    t('★ A: drum tek satır, CİHAZ bildirdi %7; sayaç hesabı ayrıntıda', a.length === 1 && a[0].kaynak === 'CIHAZ' && a[0].hesap.yuzde === 7 && a[0].sayactan?.kalanSayfa === 100000 - (250900 - 180000), a);
    const bS = satir(B)[0];
    t('★ B: eski kayıt (takılma sayacı yok) fiş tarihine en yakın okumadan YAKLAŞIK', bS?.kaynak === 'SAYAC' && bS.yaklasik === true && bS.takilis?.sayac === 100000 && bS.hesap.kalanSayfa === 28000, bS && { y: bS.yaklasik, t: bS.takilis, h: bS.hesap });
    t('B: gün = kalan ÷ son 90 günün hızı', bS?.hesap.gun === Math.floor(28000 / (12000 / 80)), bS?.hesap);
    const c = satir(C);
    t('★ C: drum iki kez değişti → yalnız yenisi (eskisi 266.000 sayfa aşmış görünürdü)', c.length === 1 && c[0].takilis?.sayac === 308000 && c[0].hesap.kalanSayfa === 92000, c.map((s) => s.takilis));
    t('★ D: iptal fişteki parça takılmış sayılmaz', satir(D).length === 0);
    t('ömürsüz parça (paten) listede yok', !v.satirlar.some((s) => s.parca.includes('Pateni')));
    t('özet ve stok: A ufukta, drum ihtiyacı stokla karşılaştırılıyor', v.ozet.ufukta >= 1 && v.stok.kalemler.some((k) => k.partId === drum.id && k.stok === 1), { o: v.ozet, s: v.stok });
    t('olcumluCihaz ve omurluKart', v.olcumluCihaz === 1 && v.omurluKart === 1, { c: v.olcumluCihaz, k: v.omurluKart });
    const tek = await veri.parcaOmruVerisi(b.id, { deviceId: B.id });
    t('★ cihaz sayfası: yalnız o cihazın satırları, liste ile aynı hesap', tek.satirlar.length === 1 && tek.satirlar[0].hesap.kalanSayfa === bS?.hesap.kalanSayfa);
    t('başka bayi bu verinin hiçbirini görmüyor', (await veri.parcaOmruVerisi(b2.id)).satirlar.length === 0);
    t('olmayan cihaz: boş sonuç, hata değil', (await veri.parcaOmruVerisi(b.id, { deviceId: 'yok' })).satirlar.length === 0);
    const talep = await veri.parcaOmruTalebi(b.id);
    t('sipariş için kart başına talep', (talep.get(drum.id) ?? 0) >= 1, [...talep]);

    // ── DEMO KURULUMU ──
    const { parcaOmruDemosu } = await import(pathToFileURL(join(KOK, 'scripts/seed-demo-parca-omru.mjs')).href);
    t('demo işlevi boş bayide patlamıyor', await parcaOmruDemosu(p, b2.id).then(() => true).catch((e) => (console.log(e), false)));
  } finally {
    await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
    await p.tenant.delete({ where: { id: b2.id } }).catch(() => {});
  }

  const demo = await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
  if (demo) {
    const veri2 = await import(pathToFileURL(join(g, 'parca-omru-veri.js')).href);
    const dv = await veri2.parcaOmruVerisi(demo.id);
    if (dv.omurluKart === 0) console.log('  ⊘ demo henüz parça ömrü verisiyle kurulmamış (node scripts/seed-bayi-demo.mjs)');
    else t('★ herkese açık demoda parça ömrü ekranı dolu: cihaz + sayaç satırı, 30 günde dolan var', dv.ozet.cihazdan > 0 && dv.ozet.sayactan > 0 && dv.ozet.ufukta > 0, dv.ozet);
  } else {
    console.log('  ⊘ demo yerelde kurulu değil');
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const r = await fetch(`${SUNUCU}/api/parca-omru`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
if (!r) console.log('\n  ⊘ HTTP kısmı atlandı: sunucu kapalı');
else { console.log('\nSunucu\n'); t('oturumsuz istek reddediliyor', r.status === 401, r.status); }

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
