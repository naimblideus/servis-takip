// CANLI OPERASYON PANOSU — lib/canli-pano.ts + lib/canli-pano-veri.ts + /pano
// Çalıştır:  node scripts/test-canli-pano.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Pano operasyon odasındaki televizyonda durur ve herkes ona bakar. Üç hata
// ekranda görünmez ama güveni bitirir:
//   · SLA kutusu hedef YOKKEN "0 gecikme" yazar (uydurma "her şey yolunda"),
//   · süre SLA raporundan farklı hesaplanır (pano "geçmedi", rapor "geçti"),
//   · odadaki herkesin göreceği ekrana para sızar.
// Üçü de burada kilitli; durum sayıları, olay sırası ve teknisyen satırları da.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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
// tsc '@/...' takma yolunu çözemez ve hata verir ama JS'i yine üretir; tip
// denetimi ayrıca koşuyor (npx tsc --noEmit). Yeni lib dosyası eklenirse
// bu listeye ve aşağıdaki yeniden yazma tablosuna eklenmeli.
const g = mkdtempSync(join(tmpdir(), 'st-pano-'));
const DOSYALAR = ['canli-pano', 'canli-pano-veri', 'sla', 'sla-veri', 'sayac-tarama', 'modules', 'magaza-baglanti'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'),
    ...DOSYALAR.map((d) => join(KOK, `src/lib/${d}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const d of DOSYALAR) {
  const yol = join(g, `${d}.js`);
  let s = readFileSync(yol, 'utf8');
  s = s.split("'@/lib/prisma'").join("'./prisma-shim.js'");
  for (const x of DOSYALAR) s = s.split(`'@/lib/${x}'`).join(`'./${x}.js'`);
  s = s.split("from './modules'").join("from './modules.js'");
  writeFileSync(yol, s);
}
const cp = await import(pathToFileURL(join(g, 'canli-pano.js')).href);
const sla = await import(pathToFileURL(join(g, 'sla.js')).href);
const veriMod = await import(pathToFileURL(join(g, 'canli-pano-veri.js')).href);

const DK = 60_000;
const TAKVIM = { zamanDilimi: 'Europe/Istanbul', gunler: [1, 2, 3, 4, 5], baslangicDk: 540, bitisDk: 1080, tatiller: [] };
// 14 Ekim 2026 Çarşamba 11:00 İstanbul = 08:00Z
const CARSAMBA_11 = new Date('2026-10-14T08:00:00Z');
const yerel = (gun, saat, dk = 0) => new Date(Date.UTC(2026, 9, gun, saat - 3, dk)); // İstanbul UTC+3

// ── DURUM SAYILARI ───────────────────────────────────────────────────────
console.log('\nDurum sayıları\n');
{
  const s = cp.fisSayilari([
    { status: 'NEW', adet: 3 }, { status: 'READY', adet: 2 }, { status: 'DELIVERED', adet: 40 },
    { status: 'CANCELLED', adet: 5 }, { status: 'WAITING_FOR_PART', adet: 1 },
  ]);
  t('★ açık = yeni + serviste + parça + hazır (teslim/iptal girmez)', s.toplam === 6, s);
  t('gelmeyen durum sıfır (kutu boş kalmaz)', s.durum.IN_SERVICE === 0 && s.durum.NEW === 3 && s.durum.READY === 2 && s.durum.WAITING_FOR_PART === 1, s.durum);
  t('bozuk sayı toplamı bozmaz', cp.fisSayilari([{ status: 'NEW', adet: Number.NaN }, { status: 'NEW', adet: -4 }]).toplam === 0);
  t('ekran sırası: yeni → serviste → parça → hazır', cp.ACIK_DURUMLAR.join() === 'NEW,IN_SERVICE,WAITING_FOR_PART,READY');
}

// ── YEREL GÜN ────────────────────────────────────────────────────────────
console.log('\nBayinin günü\n');
{
  // 14 Ekim 21:30Z = 15 Ekim 00:30 İstanbul → gün 14 Ekim 21:00Z'de başladı.
  const b = cp.gununBasi(new Date('2026-10-14T21:30:00Z'), 'Europe/Istanbul');
  t('★ "bugün" bayinin saat diliminde (UTC gece yarısı değil)', b.toISOString() === '2026-10-14T21:00:00.000Z', b.toISOString());
  const y = cp.gununBasi(new Date('2026-10-14T21:30:00Z'), 'Bozuk/Dilim');
  t('bozuk saat dilimi panoyu düşürmez (İstanbul)', y.toISOString() === '2026-10-14T21:00:00.000Z', y.toISOString());
}

// ── SLA KUTUSU ───────────────────────────────────────────────────────────
console.log('\nSLA kutusu\n');
const olay = (satirlar, acilis) => sla.olaylariCikar(satirlar.map(([status, an]) => ({ status, changedAt: an, kaynak: 'PANEL' })), acilis);
const fis = (id, satirlar, acilis, hedef) => ({ id, ticketNumber: id, musteri: `M-${id}`, cihaz: 'Kyocera', olay: olay(satirlar, acilis), hedef });
const H = (mudahaleDk, cozumDk, parcaDurdurur = false) => ({ mudahaleDk, cozumDk, parcaDurdurur });
{
  t('★ SLA hedefi tanımlı sözleşme yoksa kutu YOK (uydurma "0 gecikme" değil)', cp.slaKutusu([], TAKVIM, CARSAMBA_11, 0) === null);
  const bos = cp.slaKutusu([], TAKVIM, CARSAMBA_11, 2);
  t('hedef var, açık iş yok → kutu var, sıfır', bos && bos.gecen === 0 && bos.yaklasan === 0 && !bos.olculemiyor, bos);

  const A = fis('A', [['NEW', yerel(14, 9)]], yerel(14, 9), H(60, null));            // 120 dk geçmiş, hedef 60 → 60 geçti
  const B = fis('B', [['NEW', yerel(14, 10, 30)]], yerel(14, 10, 30), H(60, null));  // 30 dk, 30 kaldı → yaklaşan
  const C = fis('C', [['NEW', yerel(14, 10, 50)]], yerel(14, 10, 50), H(240, null)); // 10 dk, 230 kaldı → hiçbiri
  const D = fis('D', [['NEW', yerel(13, 9)], ['IN_SERVICE', yerel(13, 9, 30)]], yerel(13, 9), H(60, 480)); // çözüm 660 > 480
  const E = fis('E', [['NEW', yerel(14, 10)], ['IN_SERVICE', yerel(14, 10, 5)], ['WAITING_FOR_PART', yerel(14, 10, 10)]], yerel(14, 10), H(null, 60, true));
  const F = fis('F', [['NEW', yerel(14, 9)], ['IN_SERVICE', yerel(14, 9, 10)]], yerel(14, 9), H(30, null)); // müdahale yapılmış
  const G = fis('G', [['NEW', yerel(14, 9)], ['READY', yerel(14, 9, 20)]], yerel(14, 9), H(10, null));       // Serviste'siz Hazır
  const T = { ...fis('T', [['NEW', yerel(14, 9)]], yerel(14, 9), H(10, null)) };
  T.olay = sla.olaylariCikar([{ status: 'NEW', changedAt: yerel(14, 9), kaynak: 'GECMIS' }], yerel(14, 9));
  const k = cp.slaKutusu([A, B, C, D, E, F, G, T], TAKVIM, CARSAMBA_11, 3);
  t('★ geçen: A (müdahale) ve D (çözüm)', k.gecen === 2 && k.liste.filter((s) => s.kalanDk < 0).map((s) => s.id).join() === 'D,A', k.liste);
  t('★ 1 saat içinde geçecek: yalnız B (30 dk kaldı)', k.yaklasan === 1 && k.liste.some((s) => s.id === 'B' && s.kalanDk === 30), k.liste);
  t('★ süre SLA motoruyla aynı (çalışma saati): D dün 9 saat + bugün 2 saat = 660 dk', k.liste.find((s) => s.id === 'D')?.kalanDk === 480 - 660);
  t('saati duran (parça bekliyor, sözleşme durduruyor) fiş bu saat içinde geçmez', !k.liste.some((s) => s.id === 'E'));
  t('müdahalesi yapılmış fişte müdahale saati işlemez', !k.liste.some((s) => s.id === 'F'));
  t('"Serviste" basılmadan Hazır olan fişte müdahale saati durmuş sayılır', !k.liste.some((s) => s.id === 'G'));
  t('türetilmiş geçmişli fiş SLA dışı (raporla aynı)', !k.liste.some((s) => s.id === 'T'));
  t('en çok geçen en üstte, sonra en az kalan', k.liste.map((s) => s.id).join() === 'D,A,B', k.liste.map((s) => s.id));

  // Cuma 17:45: mesai 18:00'de bitiyor → önümüzdeki saatte yalnız 15 çalışma dakikası var.
  const cuma = yerel(16, 17, 45);
  const K30 = fis('K30', [['NEW', yerel(16, 17, 15)]], yerel(16, 17, 15), H(60, null)); // 30 geçti, 30 kaldı
  const K10 = fis('K10', [['NEW', yerel(16, 16, 55)]], yerel(16, 16, 55), H(60, null)); // 50 geçti, 10 kaldı
  const kc = cp.slaKutusu([K30, K10], TAKVIM, cuma, 1);
  t('★ cuma 17:45: 30 dk kalan pazartesi geçer (yaklaşan değil), 10 dk kalan geçer', kc.yaklasan === 1 && kc.liste[0]?.id === 'K10', kc.liste);
  // 17:50'de açılmış, hedef 60: 22:00'de 10 çalışma dakikası geçmiş, 50 kalmış ama gece saat işlemiyor.
  const aksam = fis('AK', [['NEW', yerel(14, 17, 50)]], yerel(14, 17, 50), H(60, null));
  const gece = cp.slaKutusu([aksam], TAKVIM, yerel(14, 22), 1);
  t('mesai dışında hiçbir saat ilerlemez → yaklaşan yok', gece.yaklasan === 0 && gece.gecen === 0, gece);
  const bozuk = cp.slaKutusu([A], { ...TAKVIM, bitisDk: 100 }, CARSAMBA_11, 1);
  t('★ bozuk çalışma takvimi: "ölçülemiyor" (sıfır yazılmaz)', bozuk.olculemiyor === true, bozuk);
}

// ── TEKNİSYENLER ─────────────────────────────────────────────────────────
console.log('\nTeknisyenler\n');
{
  const simdi = new Date('2026-10-14T10:00:00Z');
  const once = (dk) => new Date(simdi.getTime() - dk * DK);
  const is = (id, atananId, status, durumDk, varisDk = null, ayrilisDk = null) => ({
    id, ticketNumber: `F-${id}`, musteri: `Müşteri ${id}`, cihaz: 'Canon', status, atananId,
    durumBasi: once(durumDk), varisAt: varisDk === null ? null : once(varisDk), ayrilisAt: ayrilisDk === null ? null : once(ayrilisDk),
  });
  const kisiler = [{ id: 'u1', ad: 'Ayşe' }, { id: 'u2', ad: 'Can' }, { id: 'u3', ad: 'Deniz' }, { id: 'u4', ad: 'Ece' }];
  const isler = [
    is('1', 'u1', 'IN_SERVICE', 50),
    is('2', 'u1', 'NEW', 10),
    is('3', 'u2', 'NEW', 90, 35),                 // sahada 35 dk
    is('4', 'u2', 'IN_SERVICE', 20),
    is('5', 'u3', 'NEW', 5),
    is('6', 'u3', 'READY', 5),                    // hazır: sırada sayılmaz
    is('7', 'u4', 'IN_SERVICE', 30, 200, 120),    // varmış, çıkmış → sahada değil
  ];
  const r = cp.teknisyenSatirlari(kisiler, isler, new Map([['u1', 2]]), simdi);
  const can = r.find((x) => x.id === 'u2');
  t('★ "Vardım" denmiş iş öne geçer: sahada 35 dk', can.suanki?.id === '3' && can.suanki.sahada && can.suanki.dakika === 35, can);
  t('sahadaki işin dışındakiler sırada sayılır', can.sirada === 1, can);
  const ayse = r.find((x) => x.id === 'u1');
  t('varış yoksa "Serviste" iş ve durum süresi', ayse.suanki?.id === '1' && !ayse.suanki.sahada && ayse.suanki.dakika === 50 && ayse.sirada === 1 && ayse.bugunKapatti === 2, ayse);
  const deniz = r.find((x) => x.id === 'u3');
  t('★ şu anki iş kayıttan: serviste/sahada yoksa yok (uydurulmaz), hazır sırada sayılmaz', deniz.suanki === null && deniz.sirada === 1, deniz);
  const ece = r.find((x) => x.id === 'u4');
  t('çıkış basılmış ziyaret sahada değil', ece.suanki?.id === '7' && ece.suanki.sahada === false, ece);
  t('sıra: sahada → serviste (uzun önce) → sırası olan', r.map((x) => x.ad).join() === 'Can,Ayşe,Ece,Deniz', r.map((x) => x.ad));
  t('ikinci ziyaret (çıkış varıştan eski) yine sahada', cp.sahadaMi({ varisAt: once(5), ayrilisAt: once(60) }) === true
    && cp.sahadaMi({ varisAt: once(60), ayrilisAt: once(5) }) === false && cp.sahadaMi({ varisAt: null, ayrilisAt: null }) === false);
  const k = cp.kapanisSayilari([{ ticketId: 'a', atananId: 'u1' }, { ticketId: 'a', atananId: 'u1' }, { ticketId: 'b', atananId: null }]);
  t('aynı gün iki kez teslime alınan fiş bir kez sayılır', k.toplam === 2 && k.kisi.get('u1') === 1, { toplam: k.toplam });
}

// ── OLAY AKIŞI ───────────────────────────────────────────────────────────
console.log('\nOlay akışı\n');
{
  const o = (id, tur, dk) => ({ id, tur, zaman: new Date(Date.UTC(2026, 9, 14, 10, 0) - dk * DK).toISOString(), ticketNumber: null, musteri: null, cihaz: null, kod: null, onceki: null });
  const fisler = [o('f1', 'YENI_FIS', 1), o('f2', 'YENI_FIS', 30), o('f3', 'YENI_FIS', 90)];
  const gecis = [o('d1', 'DURUM', 5), o('d2', 'DURUM', 1)];
  const portal = [o('p1', 'PORTAL', 12)];
  const uyari = [o('u1', 'UYARI', 1), o('u2', 'UYARI', 200)];
  const a = cp.olayAkisi([fisler, gecis, portal, uyari]);
  t('★ en yeni önce, dört kaynak tek akışta', a.map((x) => x.id).join() === 'u1,f1,d2,d1,p1,f2,f3,u2', a.map((x) => x.id));
  t('aynı anda: cihaz uyarısı → fiş → durum (her turda aynı sıra)', a.slice(0, 3).map((x) => x.tur).join() === 'UYARI,YENI_FIS,DURUM');
  const cok = cp.olayAkisi([Array.from({ length: 15 }, (_, i) => o(`x${i}`, 'YENI_FIS', i)), [o('x3', 'YENI_FIS', 3)]]);
  t('★ en fazla 10 olay, tekrar yok', cok.length === 10 && new Set(cok.map((x) => x.id)).size === 10, cok.length);
  t('bozuk zamanlı olay akışı bozmaz', cp.olayAkisi([[{ ...o('z', 'PORTAL', 0), zaman: 'yok' }]]).length === 0);
  // Mağaza siparişi müşteriden gelir: aynı anda iç kayıttan (yeni fiş, durum) önce.
  const es = cp.olayAkisi([[o('f1', 'YENI_FIS', 5)], [o('s1', 'SIPARIS', 5)]]);
  t('aynı anda mağaza siparişi yeni fişten önce', es[0]?.tur === 'SIPARIS' && es[1]?.tur === 'YENI_FIS', es.map((x) => x.tur));
}

// ── EKRAN YARDIMCILARI ───────────────────────────────────────────────────
console.log('\nEkran yardımcıları\n');
{
  const s = new Date('2026-10-14T10:00:00Z');
  const z = (dk) => cp.goreliZaman(new Date(s.getTime() - dk * DK), s);
  t('göreli zaman: az önce / dk / sa / gün', z(0).birim === 'AZ' && z(12).n === 12 && z(12).birim === 'DK' && z(185).birim === 'SA' && z(185).n === 3 && z(3000).birim === 'GUN' && z(3000).n === 2);
  t('gelecekteki an "az önce" (saat kayması eksi süre yazdırmaz)', cp.goreliZaman(new Date(s.getTime() + 5 * DK), s).birim === 'AZ');
  t('süre parçalama 135 dk → 2 sa 15 dk', JSON.stringify(cp.sureParcala(135)) === '{"sa":2,"dk":15}');
  t('★ bağlantı: iki buçuk tur cevap yoksa bayat', cp.bayatMi(0, 37_600) === true && cp.bayatMi(0, 30_000) === false && cp.bayatMi(null, 1e9) === false);
  t('15 saniyede bir yoklama', cp.YOKLAMA_SN === 15);
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const sayfa = oku('src/app/pano/page.tsx');
  const duzen = oku('src/app/pano/layout.tsx');
  const veri = oku('src/lib/canli-pano-veri.ts');
  const uc = oku('src/app/api/pano/route.ts');
  t('★ sayacı gelmeyen ölçütü ana panel kartı ve /api/sayac/eksik ile aynı (35 gün)',
    cp.SAYAC_GEC_GUN === 35 && /35 \* 24 \* 60 \* 60 \* 1000/.test(oku('src/app/api/dashboard/stats/route.ts'))
    && /const ESIK_GUN = 35;/.test(oku('src/app/api/sayac/eksik/route.ts')));
  t('★ pano verisi TUTAR seçmiyor (oda herkese açık)', !/monthlyRent|totalCost|laborCost|sellPrice|buyPrice|amount|price|paidAmount|totalAmount|financial/i.test(veri));
  t('★ pano ekranı para biçimlemiyor', !/useBicim|\.para\(|b\.para/.test(sayfa));
  // Mağaza kutusu: sipariş tablosundan yalnız durum ve teslim biçimi sayılır, tutar sütunu okunmaz.
  const magazaSorgulari = veri.match(/SELECT[\s\S]*?FROM shop\."ShopOrder"/g) ?? [];
  t('★ mağaza kutusu sipariş TUTARI okumuyor (toplam, kargo, KDV)', magazaSorgulari.length === 2
    && magazaSorgulari.every((q) => !/toplam|araToplam|kdvTutar|kargo"|"kargo/i.test(q)), magazaSorgulari.length);
  t('sekme görünmezken sorulmuyor, görünür olunca hemen soruluyor', /if \(document\.hidden\) return;/.test(sayfa) && /visibilitychange/.test(sayfa));
  t('bağlantı koparsa son veri kalıyor (hata veriyi silmiyor)', /setHata\(true\)/.test(sayfa) && !/setVeri\(null\)/.test(sayfa));
  t('tam ekran düğmesi ve 3 sn sonra gizlenen imleç', /requestFullscreen\(\)/.test(sayfa) && /setImlecGizli\(true\), 3000/.test(sayfa) && /cursor: imlecGizli \? 'none'/.test(sayfa));
  t('★ oturumsuz açılış girişe ve geri panoya', /redirect\('\/login\?next=\/pano'\)/.test(duzen) && /router\.push\(donus\)/.test(oku('src/app/login/page.tsx')));
  t('giriş dönüşü yalnız sitenin kendi yolu (açık yönlendirme yok)', /\/\^\\\/\[a-z0-9-\]\+/.test(oku('src/app/login/page.tsx')));
  t('kilitli bayinin panosu açılmıyor (kilit ekranı panelde)', /if \(kilitli \|\| ayar\?\.maintenanceMode\) redirect\('\/dashboard'\)/.test(duzen));
  t('uç her role açık ama oturumun bayisine bağlı', /requireTenantUser\(\)/.test(uc) && /canliPanoVerisi\(tenantId/.test(uc));
  t('★ SLA sözü rapor ve panoda tek kaynaktan (slaHedefleri)', /const hedefler = await slaHedefleri\(tenantId\)/.test(oku('src/lib/sla-veri.ts')) && /slaHedefleri\(tenantId\)/.test(veri));
  t('ana panelde göze batmayan "Canlı panoyu aç" bağlantısı', /href="\/pano"/.test(oku('src/app/(dashboard)/dashboard/page.tsx')));
  t('tek ekran yerleşimi: TV\'de kaydırma yok', /\.cp-kok\{height:100vh;overflow:hidden/.test(sayfa));
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
const yerelDb = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());

if (!yerelDb) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı\n');
  await p.tenant.deleteMany({ where: { slug: { startsWith: 'pano-testi-' } } });
  const damga = Date.now();
  // 7/24 çalışma takvimi: SLA sonucu testin koştuğu saate bağlı olmasın.
  const b = await p.tenant.create({ data: { name: 'Pano Testi', slug: `pano-testi-${damga}`, workDays: '0,1,2,3,4,5,6', workStartMin: 0, workEndMin: 1440 } });
  try {
    const simdi = new Date();
    const once = (dk) => new Date(simdi.getTime() - dk * DK);
    const [yon, tek1, tek2] = await Promise.all([
      p.user.create({ data: { tenantId: b.id, email: `pano.y.${damga}@ornek.local`, passwordHash: 'x', name: 'Yönetici', role: 'ADMIN' } }),
      p.user.create({ data: { tenantId: b.id, email: `pano.t1.${damga}@ornek.local`, passwordHash: 'x', name: 'Ali Usta', role: 'TECHNICIAN' } }),
      p.user.create({ data: { tenantId: b.id, email: `pano.t2.${damga}@ornek.local`, passwordHash: 'x', name: 'Burak Usta', role: 'TECHNICIAN' } }),
    ]);
    await p.user.create({ data: { tenantId: b.id, email: `pano.t3.${damga}@ornek.local`, passwordHash: 'x', name: 'Pasif Usta', role: 'TECHNICIAN', isActive: false } });
    const m1 = await p.customer.create({ data: { tenantId: b.id, name: 'SLA Müşterisi', phone: `0532${String(damga).slice(-7)}` } });
    const m2 = await p.customer.create({ data: { tenantId: b.id, name: 'Sıradan Müşteri', phone: `0533${String(damga).slice(-7)}` } });
    const cihaz = (m, seri, ek = {}) => p.device.create({ data: { tenantId: b.id, customerId: m.id, brand: 'Kyocera', model: 'M2040', serialNo: `${seri}-${damga}`, publicCode: `PN-${seri}-${damga}`, qrTokenHash: `q-${seri}-${damga}`, ...ek } });
    const taze = once(60);
    const [d1, d2, d3, d4] = await Promise.all([
      cihaz(m1, 'A', { isRental: true, monthlyRent: 98765, olcumAt: taze, cihazUyarilari: ['SIKISMA'], olcumSiyah: 60 }),
      cihaz(m1, 'B', { isRental: true, monthlyRent: 98765, olcumAt: taze, olcumSiyah: 8 }),
      cihaz(m2, 'C', { isRental: true, olcumAt: taze, cihazUyarilari: ['KAGIT_AZ'], olcumSiyah: 70 }),
      cihaz(m2, 'D', { isRental: false, olcumAt: new Date(simdi.getTime() - 10 * 86_400_000), cihazUyarilari: ['SERVIS_GEREKLI'], olcumSiyah: 5 }),
    ]);
    // Okumalar: A bu ay okunmuş, B 40 gün önce, C hiç → sayacı gelmeyen 2 (B, C).
    await p.counterReading.create({ data: { tenantId: b.id, deviceId: d1.id, counterBlack: 1000, counterColor: 0, readingDate: once(60 * 24 * 3) } });
    await p.counterReading.create({ data: { tenantId: b.id, deviceId: d2.id, counterBlack: 1000, counterColor: 0, readingDate: once(60 * 24 * 40) } });
    const no = (x) => `PN-${damga}-${x}`;
    const fis = (x, cihazK, musteri, status, ek = {}) => p.serviceTicket.create({ data: { tenantId: b.id, deviceId: cihazK.id, customerId: musteri.id, ticketNumber: no(x), issueText: 'arıza', status, createdByUserId: yon.id, ...ek } });
    const gecmis = (f, status, onceki, an, kaynak = 'PANEL') => p.ticketStatusHistory.create({ data: { tenantId: b.id, ticketId: f.id, status, oncekiStatus: onceki, changedAt: an, kaynak } });
    // SLA'lı müşterinin fişleri: biri geçmiş (180 dk, hedef 60), biri yaklaşan (30 dk, hedef 60).
    const sGecen = await fis('S1', d1, m1, 'NEW', { createdAt: once(180), statusUpdatedAt: once(180) });
    await gecmis(sGecen, 'NEW', null, once(180));
    const sYak = await fis('S2', d2, m1, 'NEW', { createdAt: once(30), statusUpdatedAt: once(30) });
    await gecmis(sYak, 'NEW', null, once(30));
    await p.contract.create({ data: { tenantId: b.id, customerId: m1.id, startDate: once(60 * 24 * 100), endDate: new Date(simdi.getTime() + 200 * 86_400_000), slaResponseMins: 60 } });
    // Teknisyen 1: sahada (Vardım 35 dk önce) + bir iş sırada.
    const t1a = await fis('T1A', d3, m2, 'IN_SERVICE', { assignedUserId: tek1.id, varisAt: once(35), createdAt: once(120), statusUpdatedAt: once(5) });
    await gecmis(t1a, 'NEW', null, once(120));
    await gecmis(t1a, 'IN_SERVICE', 'NEW', once(100));
    await fis('T1B', d3, m2, 'WAITING_FOR_PART', { assignedUserId: tek1.id, createdAt: once(60 * 24 * 2), statusUpdatedAt: once(60 * 24) });
    // Teknisyen 2: serviste — süre aşama geçmişinden (damga yeni basılmış olsa da).
    const t2a = await fis('T2A', d4, m2, 'IN_SERVICE', { assignedUserId: tek2.id, createdAt: once(300), statusUpdatedAt: once(1) });
    await gecmis(t2a, 'NEW', null, once(300));
    await gecmis(t2a, 'IN_SERVICE', 'NEW', once(45));
    // Bugün teslim edilen (teknisyen 2) + dün teslim edilen + bugün teslim edilip geri açılan.
    const k1 = await fis('K1', d4, m2, 'DELIVERED', { assignedUserId: tek2.id, createdAt: once(60 * 24 * 3) });
    await gecmis(k1, 'DELIVERED', 'IN_SERVICE', once(2));
    const k2 = await fis('K2', d4, m2, 'DELIVERED', { assignedUserId: tek2.id, createdAt: once(60 * 24 * 3) });
    await gecmis(k2, 'DELIVERED', 'IN_SERVICE', once(60 * 30));
    const k3 = await fis('K3', d4, m2, 'NEW', { createdAt: once(60 * 24 * 3) });
    await gecmis(k3, 'DELIVERED', 'IN_SERVICE', once(20));
    await gecmis(k3, 'NEW', 'DELIVERED', once(10));
    // Atanmamış ve hazır fiş; silinmiş fiş hiçbir yerde sayılmaz.
    await fis('U1', d3, m2, 'NEW', { createdAt: once(3) });
    await fis('R1', d3, m2, 'READY', { createdAt: once(60 * 24 * 4) });
    await fis('X1', d3, m2, 'NEW', { createdAt: once(4), deletedAt: once(1) });
    // Kuyruklar ve olaylar.
    await p.portalRequest.create({ data: { tenantId: b.id, customerId: m2.id, deviceId: d3.id, tur: 'ARIZA', aciklama: 'kâğıt sıkıştı', createdAt: once(7) } });
    await p.portalRequest.create({ data: { tenantId: b.id, customerId: m2.id, tur: 'SAYAC', durum: 'ISLENDI', createdAt: once(400) } });
    await p.tonerSevki.create({ data: { tenantId: b.id, deviceId: d2.id, channel: 'BLACK' } });
    await p.tonerSevki.create({ data: { tenantId: b.id, deviceId: d1.id, channel: 'BLACK', durum: 'TAKILDI' } });
    await p.cihazOlayi.create({ data: { tenantId: b.id, deviceId: d1.id, kod: 'SIKISMA', basladi: once(0.5) } });
    await p.cihazOlayi.create({ data: { tenantId: b.id, deviceId: d3.id, kod: 'KAGIT_AZ', basladi: once(0.2) } });

    const v = await veriMod.canliPanoVerisi(b.id, { simdi, paylasimliWhatsapp: false });
    t('★ açık fiş: 7 (S1,S2,K3,U1,T1A,T2A,T1B) + hazır 1 = 8; silinmiş/teslim sayılmaz', v.fis.toplam === 8
      && v.fis.durum.NEW === 4 && v.fis.durum.IN_SERVICE === 2 && v.fis.durum.WAITING_FOR_PART === 1 && v.fis.durum.READY === 1, v.fis);
    t('bugün açılan: bugün oluşturulan, silinmemiş fişler', v.fis.bugunAcilan === [once(180), once(30), once(120), once(300), once(3)].filter((x) => x >= cp.gununBasi(simdi, 'Europe/Istanbul')).length, v.fis.bugunAcilan);
    t('★ bugün kapanan: yalnız bugün teslime geçip teslimde kalan (K1)', v.fis.bugunKapanan === 1, v.fis.bugunKapanan);
    t('atanmamış, işi süren fiş 4 (S1, S2, U1, geri açılan K3; hazır sayılmaz)', v.fis.atanmamis === 4, v.fis.atanmamis);
    t('★ SLA: 1 geçen (S1), 1 yaklaşan (S2)', v.sla && v.sla.gecen === 1 && v.sla.yaklasan === 1 && v.sla.liste[0]?.ticketNumber === no('S1'), v.sla);
    const ali = v.teknisyenler.find((x) => x.id === tek1.id);
    t('★ teknisyen sahada 35 dk, sırada 1', ali?.suanki?.sahada === true && ali.suanki.dakika === 35 && ali.sirada === 1, ali);
    const burak = v.teknisyenler.find((x) => x.id === tek2.id);
    t('★ servisteki işin süresi aşama geçmişinden (45 dk, damgadan değil)', burak?.suanki?.dakika === 45 && burak.bugunKapatti === 1 && burak.sirada === 0, burak);
    t('pasif kullanıcı panoda yok, yönetici işi yoksa yok', !v.teknisyenler.some((x) => x.ad === 'Pasif Usta' || x.id === yon.id), v.teknisyenler.map((x) => x.ad));
    t('★ cihaz sağlığı: uyarı 2 (taze), servis 1, toner kritik 1, eski ölçüm sayılmaz', v.cihaz.izlenen === 3 && v.cihaz.uyari === 2 && v.cihaz.servisUyari === 1 && v.cihaz.tonerKritik === 1, v.cihaz);
    t('★ sayacı gelmeyen kiralık: 2 (40 gün önce okunan + hiç okunmayan)', v.cihaz.sayacGelmeyen === 2 && v.cihaz.kiralik === 3, v.cihaz);
    t('yolda toner: yalnız gönderilmiş, takılmamış', v.cihaz.yoldaToner === 1, v.cihaz);
    t('bekleyen müşteri talebi 1 ve en eskisi', v.talepler.portal?.adet === 1 && Math.abs(Date.parse(v.talepler.portal.enEski) - once(7).getTime()) < 1000, v.talepler);
    t('WhatsApp kurulu değilse kutu yok', v.talepler.whatsapp === null, v.talepler);
    t('★ olay akışı en yeni önce; kâğıt-az gibi bilgi uyarısı akışta yok', v.olaylar.length > 0 && v.olaylar[0].tur === 'UYARI' && v.olaylar[0].kod === 'SIKISMA'
      && !v.olaylar.some((o) => o.kod === 'KAGIT_AZ') && v.olaylar.every((o, i, a) => i === 0 || Date.parse(a[i - 1].zaman) >= Date.parse(o.zaman)), v.olaylar.map((o) => `${o.tur}:${o.kod ?? o.ticketNumber}`));
    t('akışta silinmiş fiş yok', !v.olaylar.some((o) => o.ticketNumber === no('X1')));
    const j = JSON.stringify(v);
    t('★ cevapta para yok (98765 kira hiçbir alanda geçmiyor)', !/98765|monthlyRent/.test(j));
    const baska = await veriMod.canliPanoVerisi('olmayan-bayi');
    t('olmayan bayi: null (uç 404 döner)', baska === null);
    t('mağazası olmayan bayide mağaza kutusu yok', v.magaza === null, v.magaza);

    const demo = await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
    if (demo) {
      const dv = await veriMod.canliPanoVerisi(demo.id);
      t('herkese açık demoda pano dolu (açık fiş ve olay var)', dv.fis.toplam > 0 && dv.olaylar.length > 0, { acik: dv.fis.toplam, olay: dv.olaylar.length });
    } else console.log('  ⊘ demo yerelde kurulu değil');
  } finally {
    await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
  }
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
