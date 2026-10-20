// KURULUM VE BAŞARI — kurallar (saf) + veri katmanı (yerel veritabanı)
// Çalıştır:  node scripts/test-kurulum.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Kurulum ekibi listeye bakıp telefonu açıyor. Kural kayarsa ekip ya hazır
// bayiyi "kurulumda" diye arar (bayi "ben zaten kullanıyorum" der, güven
// gider) ya da faturası durmuş bayiyi yeşil görür ve aramaz (para gider).
// Burada sınırlar kilitli: %80 kapsam, 35 gün, ayın 7'si/10'u, deneme 5/2 gün,
// sessizlik 7/14 gün; "gerekmez" adımlar Hazır'ı engellemez; sıradaki adım
// önce zorunlulardan seçilir. Veritabanı kısmı adımların GERÇEK kayıtlardan
// doğru sayıldığını ve takip/not yazımını geçici bir bayide dener.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

// ── Derle ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-kurulum-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/kurulum.ts'), join(KOK, 'src/lib/kurulum-veri.ts'), join(KOK, 'src/lib/kurulum-metin.ts'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    '--outDir', g, '--rootDir', join(KOK, 'src/lib'), '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
const duzelt = (f, ciftler) => {
  const y = join(g, f);
  let s = readFileSync(y, 'utf8');
  for (const [a, b] of ciftler) s = s.replace(a, b);
  writeFileSync(y, s);
};
duzelt('kurulum-veri.js', [[/'@\/lib\/prisma'/g, "'./prisma-shim.js'"], [/'@\/lib\/kurulum'/g, "'./kurulum.js'"]]);
duzelt('kurulum-metin.js', [[/'@\/lib\/i18n\/sozluk'/g, "'./i18n/sozluk.js'"], [/'@\/lib\/kurulum'/g, "'./kurulum.js'"]]);
duzelt('i18n/sozluk.js', [["from './tr'", "from './tr.js'"], ["from './en'", "from './en.js'"]]);

const k = await import(pathToFileURL(join(g, 'kurulum.js')).href);
const mt = await import(pathToFileURL(join(g, 'kurulum-metin.js')).href);
const { tr: TRS } = await import(pathToFileURL(join(g, 'i18n/tr.js')).href);
const { en: ENS } = await import(pathToFileURL(join(g, 'i18n/en.js')).href);

const GUN = 86_400_000;
// Ayın 15'i, öğle (İstanbul): ayın 7'si ve 10'u eşikleri geçilmiş.
const simdi = new Date('2026-11-15T12:00:00+03:00');
const once = (n) => new Date(simdi.getTime() - n * GUN);
const sonra = (n) => new Date(simdi.getTime() + n * GUN);

const bos = () => ({
  firma: { vergiNo: false, adres: false, telefon: false }, ulke: 'TR',
  cihaz: 0, kiralik: 0, fiyatliKiralik: 0, okunanKiralik: 0, okuma: 0, kendiliginden: 0,
  faturaSayisi: 0, ilkFatura: null, ekip: 0, fis: 0, tarama: 0, arac: 0, sozlesme: 0,
  whatsapp: false, eFatura: 'YOK', portal: 0,
});
const tam = () => ({
  ...bos(), firma: { vergiNo: true, adres: true, telefon: true },
  cihaz: 12, kiralik: 10, fiyatliKiralik: 10, okunanKiralik: 10, okuma: 20, kendiliginden: 5,
  faturaSayisi: 3, ilkFatura: once(20),
});
const adimi = (s, kod) => s.adimlar.find((a) => a.kod === kod);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ADIMLAR VERİDEN\n');
{
  const s = k.kurulumDurumu(bos(), once(3));
  t('13 adım, 5 zorunlu', s.adimlar.length === 13 && s.zorunluToplam === 5);
  t('boş bayi: sıradaki adım FIRMA', s.sonrakiAdim?.kod === 'FIRMA', s.sonrakiAdim);
  t('★ kiralık yoksa FIYAT ve SAYAC gerekmez (UYGULANMAZ)', adimi(s, 'FIYAT').durum === 'UYGULANMAZ' && adimi(s, 'SAYAC').durum === 'UYGULANMAZ');
  t('gerekmeyen adımlar n/5 içinde sayılır: 2/5', s.zorunluTamam === 2, s.zorunluTamam);
  t('boş bayi Hazır değil, hazır günü yok', !s.hazir && s.hazirGunu === null);

  const f = k.kurulumDurumu({ ...bos(), firma: { vergiNo: true, adres: false, telefon: true } }, once(3));
  t('firma 2/3 → KISMEN, yine sıradaki', adimi(f, 'FIRMA').durum === 'KISMEN' && f.sonrakiAdim?.kod === 'FIRMA');

  const oran = (fiyatli) => adimi(k.kurulumDurumu({ ...tam(), fiyatliKiralik: fiyatli }, once(30)), 'FIYAT').durum;
  t('★ fiyat 8/10 (%80) → TAMAM', oran(8) === 'TAMAM');
  t('★ fiyat 7/10 → KISMEN', oran(7) === 'KISMEN');
  t('fiyat 0/10 → EKSIK', oran(0) === 'EKSIK');

  const sayac = (n, okuma, kendi) => adimi(k.kurulumDurumu({ ...tam(), okunanKiralik: n, okuma, kendiliginden: kendi }, once(30)), 'SAYAC');
  t('★ sayaç 8/10 → TAMAM; 7/10 → KISMEN', sayac(8, 8, 0).durum === 'TAMAM' && sayac(7, 7, 0).durum === 'KISMEN');
  t('kendiliğinden pay: 3/4 okuma → %75', sayac(8, 4, 3).kanit.pay === 75, sayac(8, 4, 3).kanit);
  t('★ okuma yoksa pay -1 (bilinmiyor, %0 değil)', sayac(0, 0, 0).kanit.pay === -1);

  const fiyatsiz = k.kurulumDurumu({ ...tam(), fiyatliKiralik: 2, faturaSayisi: 0, ilkFatura: null }, once(30));
  t('★ sıradaki adım zincir sırasıyla: önce FIYAT, sonra FATURA', fiyatsiz.sonrakiAdim?.kod === 'FIYAT');
  t('yol bayinin sayfası', fiyatsiz.sonrakiAdim?.yol === '/devices');

  const h = k.kurulumDurumu(tam(), once(30));
  t('★ beş zorunlu tamam → Hazır', h.hazir && h.zorunluTamam === 5);
  t('★ Hazır bayide sıradaki = ilk eksik isteğe bağlı (EKIP)', h.sonrakiAdim?.kod === 'EKIP' && !h.sonrakiAdim.zorunlu);
  t('★ hazır günü = açılış → ilk fatura (10 gün)', h.hazirGunu === 10, h.hazirGunu);

  const faturasiz = k.kurulumDurumu({ ...tam(), faturaSayisi: 0, ilkFatura: null }, once(30));
  t('fatura yoksa Hazır değil (4/5), hazır günü null', !faturasiz.hazir && faturasiz.zorunluTamam === 4 && faturasiz.hazirGunu === null);

  const hepsi = k.kurulumDurumu({ ...tam(), ekip: 1, fis: 1, tarama: 1, arac: 1, sozlesme: 1, whatsapp: true, eFatura: 'GERCEK', portal: 1 }, once(30));
  t('her şey tamam → sıradaki null', hepsi.sonrakiAdim === null);

  t('e-Fatura yurt dışında gerekmez', adimi(k.kurulumDurumu({ ...tam(), ulke: 'DE' }, once(1)), 'EFATURA').durum === 'UYGULANMAZ');
  t('e-Fatura yalnız test modu → KISMEN', adimi(k.kurulumDurumu({ ...tam(), eFatura: 'TEST' }, once(1)), 'EFATURA').durum === 'KISMEN');
  t('kiralık yok + firma, cihaz, fatura → Hazır (servis bayisi)', k.kurulumDurumu({ ...tam(), kiralik: 0, fiyatliKiralik: 0, okunanKiralik: 0 }, once(30)).hazir);

  t('ortanca tek sayılı', k.ortanca([9, 1, 4]) === 4);
  t('ortanca çift sayılı (yuvarlanır)', k.ortanca([1, 2, 3, 4]) === 3);
  t('ortanca boşta null', k.ortanca([]) === null);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SAĞLIK\n');
{
  const s0 = {
    acilis: once(60), sonHareket: once(1), kiralik: 10, buAyOkunanKiralik: 9,
    faturaSayisi: 5, sonFatura: once(10), denemede: false, denemeBitis: null, odedi: true, acikSorun: 0, durduranSorun: 0,
  };
  const sg = (x, an = simdi) => k.saglikDurumu({ ...s0, ...x }, an);
  const kodlar = (r) => r.nedenler.map((n) => `${n.kod}:${n.renk}`);
  t('★ sorun yok → YESIL', sg({}).renk === 'YESIL' && sg({}).nedenler.length === 0, kodlar(sg({})));

  t('6 gün sessiz → neden yok', !kodlar(sg({ sonHareket: once(6) })).some((x) => x.startsWith('SESSIZ')));
  t('★ 7 gün sessiz → SARI', kodlar(sg({ sonHareket: once(7) })).includes('SESSIZ:SARI'));
  t('★ 14 gün sessiz → KIRMIZI', kodlar(sg({ sonHareket: once(14) })).includes('SESSIZ:KIRMIZI'));
  t('hiç hareketi yok, 3 gün önce açıldı → sessiz değil', !kodlar(sg({ sonHareket: null, acilis: once(3) })).some((x) => x.startsWith('SESSIZ')));

  t('★ ayın 15i, bu ay %50 okundu → SAYAC_DUSTU SARI', kodlar(sg({ buAyOkunanKiralik: 5 })).includes('SAYAC_DUSTU:SARI'));
  t('★ tam %60 → düşüş değil', !kodlar(sg({ buAyOkunanKiralik: 6 })).some((x) => x.startsWith('SAYAC')));
  const ayin10u = new Date('2026-11-10T12:00:00+03:00');
  t('★ ayın 10u → henüz düşüş sayılmaz', !kodlar(sg({ buAyOkunanKiralik: 0, sonHareket: ayin10u, sonFatura: ayin10u }, ayin10u)).some((x) => x.startsWith('SAYAC')));
  t('bu ay açılan bayide sayaç düşüşü yok (ilk ay kurulum)', !kodlar(sg({ buAyOkunanKiralik: 0, acilis: once(5) })).some((x) => x.startsWith('SAYAC')));
  t('kiralığı olmayan bayide sayaç düşüşü yok', !kodlar(sg({ kiralik: 0, buAyOkunanKiralik: 0 })).some((x) => x.startsWith('SAYAC')));

  t('★ ayın 15i, bu ay fatura yok → FATURA_YOK KIRMIZI', kodlar(sg({ sonFatura: once(20) })).includes('FATURA_YOK:KIRMIZI'));
  const ayin7si = new Date('2026-11-07T12:00:00+03:00');
  const ayin8i = new Date('2026-11-08T12:00:00+03:00');
  t('★ ayın 7si → henüz fatura uyarısı yok', !kodlar(sg({ sonFatura: once(20), sonHareket: ayin7si }, ayin7si)).some((x) => x.startsWith('FATURA')));
  t('★ ayın 8i → fatura uyarısı', kodlar(sg({ sonFatura: once(20), sonHareket: ayin8i }, ayin8i)).includes('FATURA_YOK:KIRMIZI'));
  t('★ hiç fatura kesmemiş bayi (kurulumda) FATURA_YOK almaz', !kodlar(sg({ faturaSayisi: 0, sonFatura: null })).some((x) => x.startsWith('FATURA')));
  t('kiralığı olmayan bayi FATURA_YOK almaz', !kodlar(sg({ kiralik: 0, sonFatura: once(40) })).some((x) => x.startsWith('FATURA')));
  // Ay başı İstanbul'a göre: 1 Kasım 00:30 (TR) = 31 Ekim 21:30 UTC — bu ay sayılmalı.
  t('★ ay başı İstanbul saatiyle (1 Kasım 00:30 TR bu aydır)', !kodlar(sg({ sonFatura: new Date('2026-11-01T00:30:00+03:00') })).some((x) => x.startsWith('FATURA')));

  const deneme = (gun, odedi = false) => kodlar(sg({ denemede: true, odedi, denemeBitis: sonra(gun) }));
  t('deneme 6 gün → neden yok', !deneme(6).some((x) => x.startsWith('DENEME')));
  t('★ deneme 5 gün → SARI', deneme(5).includes('DENEME_BITIYOR:SARI'));
  t('★ deneme 2 gün → KIRMIZI', deneme(2).includes('DENEME_BITIYOR:KIRMIZI'));
  t('deneme bitmiş, ödeme yok → KIRMIZI, gün 0', deneme(-3).includes('DENEME_BITIYOR:KIRMIZI') && sg({ denemede: true, odedi: false, denemeBitis: once(3) }).nedenler[0].deger.n === 0);
  t('ödemiş bayide deneme uyarısı yok', !deneme(1, true).some((x) => x.startsWith('DENEME')));

  t('★ açık sorun → SARI', kodlar(sg({ acikSorun: 2 })).includes('ACIK_SORUN:SARI'));
  t('★ DURDURUYOR sorunu → KIRMIZI', kodlar(sg({ acikSorun: 2, durduranSorun: 1 })).includes('ACIK_SORUN:KIRMIZI'));

  const karma = sg({ sonHareket: once(8), sonFatura: once(20), acikSorun: 1 });
  t('★ kırmızılar önce, renk en kötüsü', karma.renk === 'KIRMIZI' && karma.nedenler[0].renk === 'KIRMIZI' && karma.nedenler.at(-1).renk === 'SARI', kodlar(karma));

  t('★ bugün aranacak: temas bugün', k.bugunAranacak(new Date('2026-11-14T21:00:00Z'), 'YESIL', simdi));
  t('bugün aranacak: temas geçmiş', k.bugunAranacak(once(3), 'SARI', simdi));
  t('★ temas yarın → bugün değil', !k.bugunAranacak(new Date('2026-11-15T21:00:00Z'), 'YESIL', simdi));
  t('temas yok, sarı → bugün değil', !k.bugunAranacak(null, 'SARI', simdi));
  t('★ kırmızı → her zaman bugün', k.bugunAranacak(null, 'KIRMIZI', simdi));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ GİRDİ DOĞRULAMA\n');
{
  t('gün metni ↔ okuma', k.gunMetni(k.gunOku('2026-11-20')) === '2026-11-20');
  t('★ 30 Şubat geçersiz', k.gunOku('2026-02-30') === null && k.gunOku('20-11-2026') === null);
  t('gunMetni İstanbul günü (21:30 UTC = ertesi gün TR)', k.gunMetni(new Date('2026-11-14T21:30:00Z')) === '2026-11-15');
  t('not: geçerli', JSON.stringify(k.notGirdisi({ tur: 'ARAMA', metin: '  Yarın 10da aranacak  ' })) === JSON.stringify({ tur: 'ARAMA', metin: 'Yarın 10da aranacak' }));
  t('not: boş', k.notGirdisi({ tur: 'NOT', metin: '   ' }).hata === 'NOT_BOS');
  t('★ not: 1000 karakter geçer, 1001 kalır', !k.notGirdisi({ tur: 'NOT', metin: 'a'.repeat(1000) }).hata && k.notGirdisi({ tur: 'NOT', metin: 'a'.repeat(1001) }).hata === 'NOT_UZUN');
  t('not: bilinmeyen tür', k.notGirdisi({ tur: 'SMS', metin: 'x' }).hata === 'NOT_TURU');
  t('★ not: kart numarasına benzeyen dizi reddedilir', k.notGirdisi({ tur: 'NOT', metin: 'kart 4111 1111 1111 1111' }).hata === 'NOT_KART');
  t('not: telefon numarası serbest (11 hane)', !k.notGirdisi({ tur: 'NOT', metin: 'Tel 0532 123 45 67' }).hata);
  t('takip: boş gövde reddedilir', k.takipGirdisi({}).hata === 'TAKIP_GECERSIZ');
  t('takip: bozuk tarih reddedilir', k.takipGirdisi({ sonrakiTemas: 'yarın' }).hata === 'TAKIP_GECERSIZ');
  const tg = k.takipGirdisi({ sorumluId: '', sonrakiTemas: '2026-11-20' });
  t('takip: boş sorumlu = kaldır, tarih İstanbul gece yarısı', tg.sorumluId === null && tg.sonrakiTemas.toISOString() === '2026-11-19T21:00:00.000Z', tg);
  t('takip: gönderilmeyen alan değişmez', !('sorumluId' in k.takipGirdisi({ sonrakiTemas: null })));
  t('wa: cep numarası', k.waAdresi('0532 123 45 67', 'Merhaba')?.startsWith('https://wa.me/905321234567?text='));
  t('★ wa: sabit hat → yok', k.waAdresi('0212 123 45 67', 'x') === null && k.waAdresi(null, 'x') === null);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ METİNLER\n');
{
  const TR = mt.kurulumMetni('tr'), EN = mt.kurulumMetni('en');
  const yapraklar = (o, y = '') => Object.entries(o).flatMap(([a, v]) => (v && typeof v === 'object' ? yapraklar(v, `${y}${a}.`) : [[`${y}${a}`, v]]));
  const trY = yapraklar(TR), enY = new Map(yapraklar(EN));
  t('★ iki dil aynı anahtarlar', trY.length === enY.size && trY.every(([p]) => enY.has(p)), trY.length);
  t('★ İngilizcede Türkçe harf yok', [...enY].filter(([, v]) => /[şğıöüçŞĞİÖÜÇ]/.test(String(v))).length === 0, [...enY].filter(([, v]) => /[şğıöüçŞĞİÖÜÇ]/.test(String(v))).slice(0, 3));
  const kodlar = ['FIRMA', 'CIHAZ', 'FIYAT', 'SAYAC', 'FATURA', 'EKIP', 'FIS', 'TARAYICI', 'ARAC', 'SOZLESME', 'WHATSAPP', 'EFATURA', 'PORTAL'];
  for (const [dil, m] of [['tr', TR], ['en', EN]]) {
    t(`${dil}: her adımın adı, sıradaki cümlesi, nasılı, mesajı var`, kodlar.every((c) => m.ad[c] && m.sirada[c] && m.nasil[c] && m.mesaj[c]));
    const durumlar = k.kurulumDurumu({ ...tam(), fiyatliKiralik: 5, okuma: 0, eFatura: 'TEST' }, once(30)).adimlar
      .concat(k.kurulumDurumu(bos(), once(1)).adimlar);
    const kanitlar = durumlar.map((a) => mt.kanitCumlesi(m, a));
    t(`${dil}: ★ kanıt cümlelerinde {yer} kalmıyor, boş yok`, kanitlar.every((c) => c && !/\{\w+/.test(c)), kanitlar.filter((c) => !c || /\{\w+/.test(c)));
    const nedenler = ['SESSIZ', 'SAYAC_DUSTU', 'FATURA_YOK', 'DENEME_BITIYOR', 'ACIK_SORUN']
      .map((kod) => mt.saglikCumlesi(m, { kod, renk: 'SARI', deger: { gun: 9, n: 3, toplam: 10, yuzde: 30, durduran: 1 } }));
    t(`${dil}: ★ sağlık cümlelerinde {yer} kalmıyor`, nedenler.every((c) => c && !/\{\w+/.test(c)), nedenler);
    const msj = mt.mesajMetni(m, { yetkili: 'Ayşe Kara', firma: 'X', sonraki: 'FIYAT' });
    t(`${dil}: mesaj ilk adla başlıyor`, /Ayşe/.test(msj) && !/\{/.test(msj), msj);
  }
  t('en: tekil/çoğul (1 device)', mt.kanitCumlesi(EN, { kod: 'CIHAZ', durum: 'TAMAM', kanit: { n: 1, kiralik: 0 } }).startsWith('1 device,'));

  // Bayi kartı sözlükte, kurulumKarti'nin hemen arkasında; iki dil tutarlı.
  const trK = Object.keys(TRS), enK = Object.keys(ENS);
  t('★ tr: kurulumDurumu kurulumKarti’nin hemen arkasında', trK.indexOf('kurulumDurumu') === trK.indexOf('kurulumKarti') + 1);
  t('en: aynı yerde', enK.indexOf('kurulumDurumu') === enK.indexOf('kurulumKarti') + 1);
  t('kurulumKarti bozulmadı', TRS.kurulumKarti?.baslik && TRS.kurulumKarti?.waMesaj);
  t('bayi kartı: 5 zorunlu adımın cümlesi var', ['FIRMA', 'CIHAZ', 'FIYAT', 'SAYAC', 'FATURA'].every((c) => TRS.kurulumDurumu.adim[c] && ENS.kurulumDurumu.adim[c]));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ KAYNAK\n');
{
  const liste = oku('src/app/(super-admin)/super-admin/kurulum/page.tsx');
  const ayrinti = oku('src/app/(super-admin)/super-admin/kurulum/[tenantId]/page.tsx');
  const uc1 = oku('src/app/api/super-admin/kurulum/[tenantId]/route.ts');
  const uc2 = oku('src/app/api/super-admin/kurulum/[tenantId]/not/route.ts');
  const bayiUc = oku('src/app/api/kurulum/route.ts');
  const veri = oku('src/lib/kurulum-veri.ts');
  t('★ ekranlar oturumsuz girişe kapalı', [liste, ayrinti].every((s) => /getSuperAdminSession\(\)/.test(s) && /redirect\('\/super-admin\/login'\)/.test(s)));
  t('★ iki uç da süper admin oturumu ister', [uc1, uc2].every((s) => /getSuperAdminSession\(\)/.test(s) && /OTURUM_YOK/.test(s)));
  t('★ yazan adı oturumdan (istemciden değil)', /yazanAd: sa\.name/.test(uc2) && !/govde\.yazanAd|body\.yazanAd/.test(uc2));
  t('uçlar denetime SUPER_ADMIN olarak yazar', [uc1, uc2].every((s) => /writeAudit/.test(s) && /actorType: 'SUPER_ADMIN'/.test(s)));
  t('★ bayi ucu yönetici değilse 403', /yoneticiMi\(user\)/.test(bayiUc) && /403/.test(bayiUc));
  t('★ bayi ucu kendi bayisi (oturumdaki tenantId)', /requireTenantUser\(\)/.test(bayiUc) && /kurulumSatiri\(tenantId\)/.test(bayiUc));
  t('★ veri katmanı toplu: bayi başına sorgu yok (döngüde await yok)', !/for \([^)]*\) \{[^}]*await prisma/.test(veri) && /groupBy/.test(veri));
  t('demo ve silinmiş bayiler kapsam dışı', /demo: false, deletedAt: null/.test(veri));
  t('★ toplu WhatsApp yok: wa.me yalnız ayrıntıda, tek bağlantı', !/wa\.me|waAdresi/.test(liste) && /waAdresi\(x\.telefon/.test(ayrinti));
  t('sorunlar bağlantısı bayiye süzülü', /\/super-admin\/sorunlar\?bayi=/.test(ayrinti));
  t('ekip ekranı sahip sayfasına bağlanmıyor (ekipte kapalı)', ![liste, ayrinti].some((s) => /\/super-admin\/tenants/.test(s)));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ VERİTABANI\n');
let p = null, tid = null, saId = null;
try {
  const env = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) || '';
  const url = process.env.DATABASE_URL || env.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^"|"$/g, '');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('ATLA');
  process.env.DATABASE_URL = url;
  const veri = await import(pathToFileURL(join(g, 'kurulum-veri.js')).href);
  const { prisma } = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
  p = prisma;

  const SLUG = 'test-kurulum';
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  await p.superAdmin.deleteMany({ where: { email: 'kurulum-test@nextus.test' } });

  const acilis = new Date(Date.now() - 12 * GUN);
  const bayi = await p.tenant.create({
    data: {
      name: 'Kurulum Testi', slug: SLUG, createdAt: acilis, taxNumber: '1234567890', address: 'Perpa', phone: '05321234567', ownerName: 'Ayşe Kara',
      users: { create: [{ email: 'a@kurulum.test', passwordHash: 'x', name: 'Ayşe', role: 'ADMIN' }, { email: 't@kurulum.test', passwordHash: 'x', name: 'Tekin', role: 'TECHNICIAN' }] },
    },
  });
  tid = bayi.id;
  const musteri = await p.customer.create({ data: { tenantId: tid, name: 'Ofis A', phone: '02120000001' } });
  const cihaz = (i, ek) => p.device.create({
    data: { tenantId: tid, customerId: musteri.id, brand: 'Pantum', model: 'M7100', serialNo: `KT-${i}`, publicCode: `KT-${i}-${tid.slice(-6)}`, qrTokenHash: 'x', ...ek },
  });
  const d1 = await cihaz(1, { isRental: true, monthlyRent: 500 });
  const d2 = await cihaz(2, { isRental: true });
  await cihaz(3, { isRental: false });
  await p.counterReading.create({ data: { tenantId: tid, deviceId: d1.id, counterBlack: 100, counterColor: 0, source: 'TARAYICI', readingDate: new Date(Date.now() - 2 * GUN) } });
  // 40 gün önceki okuma 35 günlük pencereye girmez.
  await p.counterReading.create({ data: { tenantId: tid, deviceId: d2.id, counterBlack: 50, counterColor: 0, source: 'ELLE', readingDate: new Date(Date.now() - 40 * GUN) } });

  let s = await veri.kurulumSatiri(tid);
  const ad = (kod) => s.kurulum.adimlar.find((a) => a.kod === kod);
  t('firma bilgisi tam → TAMAM', ad('FIRMA').durum === 'TAMAM');
  t('3 cihaz, 2 kiralık', s.cihaz === 3 && ad('CIHAZ').kanit.kiralik === 2, ad('CIHAZ').kanit);
  t('★ fiyat 1/2 kiralıkta → KISMEN (varsayılan sayfa fiyatı sayılmaz)', ad('FIYAT').durum === 'KISMEN' && ad('FIYAT').kanit.n === 1, ad('FIYAT'));
  t('★ sayaç 1/2 (40 günlük okuma sayılmaz), kendiliğinden %100', ad('SAYAC').durum === 'KISMEN' && ad('SAYAC').kanit.n === 1 && ad('SAYAC').kanit.pay === 100, ad('SAYAC').kanit);
  t('fatura yok → EKSIK; sıradaki FIYAT', ad('FATURA').durum === 'EKSIK' && s.kurulum.sonrakiAdim?.kod === 'FIYAT');
  t('teknisyen var → EKIP TAMAM', ad('EKIP').durum === 'TAMAM' && ad('EKIP').kanit.n === 1);
  t('kurulum 2/5, Hazır değil', s.kurulum.zorunluTamam === 2 && !s.kurulum.hazir, s.kurulum.zorunluTamam);

  await p.device.update({ where: { id: d2.id }, data: { pricePerBlack: 0.35 } });
  await p.counterReading.create({ data: { tenantId: tid, deviceId: d2.id, counterBlack: 80, counterColor: 0, source: 'ELLE', readingDate: new Date() } });
  await p.customerInvoice.create({ data: { tenantId: tid, customerId: musteri.id, invoiceNumber: 'KT-FAT-1', period: '2026-10', dueDate: new Date(), invoiceDate: new Date() } });
  s = await veri.kurulumSatiri(tid);
  t('★ fiyat + sayaç + fatura girilince Hazır 5/5', s.kurulum.hazir && s.kurulum.zorunluTamam === 5, s.kurulum.adimlar.filter((a) => a.zorunlu).map((a) => a.durum));
  t('★ hazır günü 12 (açılış → ilk fatura)', s.kurulum.hazirGunu === 12, s.kurulum.hazirGunu);
  t('kendiliğinden pay 1/2 → %50', ad('SAYAC').kanit.pay === 50, ad('SAYAC').kanit);

  const liste = await veri.kurulumListesi();
  t('toplu liste bayiyi aynı sonuçla içeriyor', liste.find((x) => x.tenantId === tid)?.kurulum.zorunluTamam === 5);

  // Sorun bildirimi: yalnız açık olanlar sayılır, DURDURUYOR kırmızı.
  await p.sorunBildirimi.create({ data: { tenantId: tid, tur: 'DURDURUYOR', neOldu: 'Fatura kesilemiyor', durum: 'YENI' } });
  await p.sorunBildirimi.create({ data: { tenantId: tid, tur: 'ONERI', neOldu: 'Eski', durum: 'COZULDU' } });
  s = await veri.kurulumSatiri(tid);
  t('★ açık DURDURUYOR sorunu → KIRMIZI, çözülen sayılmaz', s.saglik.renk === 'KIRMIZI' && s.acikSorun === 1 && s.durduranSorun === 1 && s.bugunAranacak, s.saglik);

  const sa = await p.superAdmin.create({ data: { email: 'kurulum-test@nextus.test', password: 'x', name: 'Deneme Ekip', rol: 'EKIP' } });
  saId = sa.id;
  const yok = await veri.takipGuncelle(tid, { sorumluId: 'olmayan-kimlik' });
  t('★ olmayan sorumlu reddedilir', !yok.ok && yok.hata === 'SORUMLU_YOK');
  const yarin = k.gunOku(k.gunMetni(new Date(Date.now() + GUN)));
  const tk = await veri.takipGuncelle(tid, { sorumluId: sa.id, sonrakiTemas: yarin });
  t('takip yazıldı, sorumlu adı kopyalandı', tk.ok && tk.deger.sonra.sorumluAd === 'Deneme Ekip' && tk.deger.once.sorumluId === null, tk);
  const tk2 = await veri.takipGuncelle(tid, { sonrakiTemas: null });
  t('★ yalnız tarih değişince sorumlu korunur', tk2.ok && tk2.deger.sonra.sorumluId === sa.id && tk2.deger.sonra.sonrakiTemas === null);
  t('olmayan bayiye takip yazılmaz', (await veri.takipGuncelle('olmayan-bayi', { sonrakiTemas: null })).hata === 'BAYI_YOK');

  const n = await veri.notEkle(tid, { yazanId: sa.id, yazanAd: sa.name, tur: 'ARAMA', metin: 'Fiyatları birlikte girdik.' });
  t('not yazıldı', n.ok && !!n.deger.id);
  t('olmayan bayiye not yazılmaz', (await veri.notEkle('olmayan-bayi', { yazanId: null, yazanAd: 'x', tur: 'NOT', metin: 'x' })).hata === 'BAYI_YOK');
  const ay = await veri.kurulumAyrintisi(tid);
  t('★ ayrıntı: not, sorumlu, son not tarihi', ay.notlar.length === 1 && ay.notlar[0].yazanAd === 'Deneme Ekip' && ay.satir.sorumluAd === 'Deneme Ekip' && !!ay.satir.sonNot);
  t('ayrıntı: sorumlu listesi süper adminlerden', ay.ekip.some((e) => e.id === sa.id));

  await p.tenant.update({ where: { id: tid }, data: { demo: true } });
  t('★ demo bayi kapsam dışı', (await veri.kurulumSatiri(tid)) === null && !(await veri.kurulumListesi()).some((x) => x.tenantId === tid));
} catch (e) {
  if (e.message === 'ATLA') console.log('  ⊘ veritabanı kısmı atlandı: yerel veritabanı yok');
  else { kaldi++; console.log('  ✗ veritabanı testi çöktü —', e); }
} finally {
  if (p && tid) await p.tenant.delete({ where: { id: tid } }).catch(() => {});
  if (p && saId) await p.superAdmin.delete({ where: { id: saId } }).catch(() => {});
  if (p) await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
