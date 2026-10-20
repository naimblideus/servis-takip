// SORUN BİLDİR — kurallar ve veri yalıtımı
// Çalıştır:  node scripts/test-sorun.mjs   (sunucu gerekmez; DB kısmı yalnız yerel veritabanında)
//
// NEDEN BU TEST
// Sahadan gelen "şurada takıldım" bildirimi ürünün en ucuz pusulası; ama
// üç şekilde zarara dönebilir:
//   1. GİZLİLİK — sayfa adresinde şifre sıfırlama jetonu ya da davet kodu
//      varsa bildirimle birlikte süper admin'e, oradan CSV ile Notion'a gider.
//   2. YALITIM — bir bayinin bildirimi (ve ekran görüntüsü) başka bayiye
//      görünürse müşteri verisi sızar. Teknisyen de patronun yazdığını görmez.
//   3. GÜRÜLTÜ — demodan ya da ısrarlı tek kullanıcıdan gelen yüzlerce kayıt
//      gerçek bayinin sesini bastırır. İstek sınırı ve demo süzgeci bunun için.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-sorun-'));
const KAYNAKLAR = ['sorun', 'sorun-veri', 'sorun-metin', 'rate-limit', 'csv'];
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  const s = readFileSync(yol, 'utf8')
    .replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'")
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'");
  writeFileSync(yol, s);
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const S = await al('sorun');
const V = await al('sorun-veri');
const { sorunMetni } = await al('sorun-metin');
const { rateLimit } = await al('rate-limit');
const { csvMetni } = await al('csv');

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ DOĞRULAMA\n');
{
  const iyi = { tur: 'DURDURUYOR', neOldu: 'Kaydet çalışmıyor', neYapiyordu: 'Fatura', sayfa: '/invoices?x=1', ekran: '375x812', tarayici: 'Mozilla/5.0' };
  const d = S.sorunDogrula(iyi);
  t('geçerli bildirim kabul edilir', d.ok && d.veri.neOldu === 'Kaydet çalışmıyor' && d.veri.ekran === '375x812');
  t('★ tür zorunlu ve üçünden biri', S.sorunDogrula({ ...iyi, tur: 'ACIL' }).kod === 'SORUN_TUR_GECERSIZ' && S.sorunDogrula({ ...iyi, tur: undefined }).kod === 'SORUN_TUR_GECERSIZ');
  t('★ "Ne oldu?" en az 5 harf (boşluklar sayılmaz)', S.sorunDogrula({ ...iyi, neOldu: '  abc   ' }).kod === 'SORUN_METIN_KISA' && S.sorunDogrula({ ...iyi, neOldu: 'abcde' }).ok);
  t('"Ne oldu?" en çok 2000', S.sorunDogrula({ ...iyi, neOldu: 'a'.repeat(2001) }).kod === 'SORUN_METIN_UZUN' && S.sorunDogrula({ ...iyi, neOldu: 'a'.repeat(2000) }).ok);
  t('"Ne yapıyordu" isteğe bağlı, boşsa null', S.sorunDogrula({ ...iyi, neYapiyordu: '  ' }).veri.neYapiyordu === null);
  t('"Ne yapıyordu" en çok 2000', S.sorunDogrula({ ...iyi, neYapiyordu: 'a'.repeat(2001) }).kod === 'SORUN_METIN_UZUN');
  t('★ bozuk bağlam bildirimi REDDETMEZ, alan boş kalır', (() => { const x = S.sorunDogrula({ ...iyi, ekran: 'büyük', sayfa: 42, tarayici: {} }); return x.ok && x.veri.ekran === null && x.veri.sayfa === null && x.veri.tarayici === null; })());
  t('tarayıcı 200 karaktere kırpılır, satır sonu atılır', S.sorunDogrula({ ...iyi, tarayici: 'a\nb' + 'x'.repeat(500) }).veri.tarayici.length === 200 && !S.sorunDogrula({ ...iyi, tarayici: 'a\nb' }).veri.tarayici.includes('\n'));
  const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(100);
  t('ekran görüntüsü: JPEG data URL kabul', S.sorunDogrula({ ...iyi, ekranGoruntusu: jpeg }).veri.ekranGoruntusu === jpeg);
  t('★ ekran görüntüsü: PNG/SVG/düz metin reddedilir', ['data:image/png;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'http://x/y.jpg', 'data:image/jpeg;base64,<script>'].every((v) => S.sorunDogrula({ ...iyi, ekranGoruntusu: v }).kod === 'SORUN_EKRAN_GECERSIZ'));
  t('★ ekran görüntüsü ~1 MB sınırı', S.sorunDogrula({ ...iyi, ekranGoruntusu: 'data:image/jpeg;base64,' + 'A'.repeat(S.EKRAN_EN_COK_KARAKTER) }).kod === 'SORUN_EKRAN_BUYUK');
  t('görüntü yoksa null', S.sorunDogrula({ ...iyi, ekranGoruntusu: '' }).veri.ekranGoruntusu === null && S.sorunDogrula(iyi).veri.ekranGoruntusu === null);
  t('gövdesiz istek çökmez', S.sorunDogrula(null).ok === false);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ADRES AYIKLAMA (jeton, şifre, anahtar bildirime girmez)\n');
{
  const a = S.sayfaAyikla;
  t('yol ve güvenli sorgu korunur', a('/devices?durum=aktif&sayfa=2') === '/devices?durum=aktif&sayfa=2');
  t('★ token / t / kod / code atılır', a('/sifre-sifirla?token=abc&t=1&kod=9&code=7&x=1') === '/sifre-sifirla?x=1');
  t('★ sifre / password / key / anahtar / secret atılır', a('/a?sifre=1&password=2&key=3&anahtar=4&secret=5&ok=1') === '/a?ok=1');
  t('★ adında kök geçen her parametre atılır (resetToken, api_key, apiKey, sifreYeni)', a('/a?resetToken=1&api_key=2&apiKey=3&sifreYeni=4&kalsin=ok') === '/a?kalsin=ok');
  t('büyük harf de yakalanır (TOKEN, Code)', a('/a?TOKEN=1&Code=2') === '/a');
  t('★ tam adres → yalnız yol (alan adı atılır)', a('https://nextusservis.com/tickets/5?tab=x') === '/tickets/5?tab=x');
  t('★ parça (#...) atılır — bazen jeton taşır', a('/giris#access_token=zzz') === '/giris');
  t('boş / geçersiz → null', a('') === null && a(null) === null && a(5) === null);
  t('500 karakterle sınırlı', a('/a?q=' + 'x'.repeat(900)).length === 500);
  t('ürün bileşeni de adresi tarayıcıda ayıklıyor', /sayfaAyikla\(window\.location\.pathname \+ window\.location\.search\)/.test(oku('src/components/SorunBildir.tsx')));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ İSTEK SINIRI\n');
{
  const k = `k-${Date.now()}`, b = `b-${Date.now()}`;
  const sonuc = [];
  for (let i = 0; i < 11; i++) sonuc.push(S.sorunSiniri(rateLimit, k, b).ok);
  t('★ kullanıcı başına saatte 10: 11. reddedilir', sonuc.slice(0, 10).every(Boolean) && sonuc[10] === false);
  t('reddedilen istek bekleme süresi verir', S.sorunSiniri(rateLimit, k, b).retryAfter > 0);
  // Bayi: 10 kullanıcı daha (yukarıdaki 10 kabul bayiye sayıldı) → toplam 50'de durur.
  let kabul = 10;
  for (let u = 0; u < 6; u++) for (let i = 0; i < 10; i++) if (S.sorunSiniri(rateLimit, `${k}-${u}`, b).ok) kabul++;
  t('★ bayi başına günde 50', kabul === 50, kabul);
  const b2 = `b2-${Date.now()}`;
  for (let i = 0; i < 15; i++) S.sorunSiniri(rateLimit, `${k}-israr`, b2);
  t('★ tek kullanıcının ısrarı ekibin hakkını yemez (bayi sayacı 10\'da kalır)', Array.from({ length: 40 }, (_, i) => S.sorunSiniri(rateLimit, `${k}-ekip-${i}`, b2).ok).every(Boolean));
  const uc = oku('src/app/api/sorun/route.ts');
  t('uç sınırı doğrulamadan SONRA uyguluyor', uc.indexOf('sorunDogrula(') > -1 && uc.indexOf('sorunDogrula(') < uc.indexOf('sorunSiniri('));
  t('★ demoda açık: demo-yazma öneklerinde /api/sorun yok', !/'\/api\/sorun'/.test(oku('src/lib/demo-yazma.ts')));
  t('★ demo bayrağı ve kimlik OTURUMDAN (gövdeden değil)', /demo: Boolean\(\(session\?\.user/.test(uc) && /kullaniciId: user\.id/.test(uc) && /rol: user\.role/.test(uc) && !/govde\.(tenantId|demo|kullaniciId|rol)/.test(uc));
  t('gövde ayrıştırılmadan önce boyut bakılıyor', uc.indexOf("content-length") > -1 && uc.indexOf('content-length') < uc.indexOf('JSON.parse'));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ AYIKLAMA GEÇİŞLERİ\n');
{
  const simdi = new Date('2026-10-21T10:00:00Z');
  const yeni = { durum: 'YENI', cozulduAt: null, bildirildiAt: null };
  const coz = S.ayiklamaKur(yeni, { durum: 'COZULDU' }, simdi);
  t('★ COZULDU\'ya geçince cozulduAt = şimdi', coz.ok && coz.data.durum === 'COZULDU' && coz.data.cozulduAt === simdi);
  const zaten = S.ayiklamaKur({ durum: 'COZULDU', cozulduAt: new Date(0), bildirildiAt: null }, { durum: 'COZULDU' }, simdi);
  t('zaten çözülmüşse cozulduAt değişmez', zaten.ok && !('cozulduAt' in zaten.data));
  const geri = S.ayiklamaKur({ durum: 'COZULDU', cozulduAt: new Date(0), bildirildiAt: new Date(0) }, { durum: 'INCELENIYOR' }, simdi);
  t('★ yeniden açılınca cozulduAt ve bildirildiAt silinir', geri.ok && geri.data.cozulduAt === null && geri.data.bildirildiAt === null);
  const kapa = S.ayiklamaKur({ durum: 'COZULDU', cozulduAt: new Date(0), bildirildiAt: null }, { durum: 'KAPANDI' }, simdi);
  t('KAPANDI cozulduAt\'a dokunmaz', kapa.ok && !('cozulduAt' in kapa.data));
  t('geçersiz durum reddedilir', S.ayiklamaKur(yeni, { durum: 'SILINDI' }, simdi).kod === 'SORUN_DURUM_GECERSIZ');
  t('kutu: üçünden biri ya da boş', S.ayiklamaKur(yeni, { kutu: 'HATA' }, simdi).data.kutu === 'HATA' && S.ayiklamaKur(yeni, { kutu: null }, simdi).data.kutu === null && S.ayiklamaKur(yeni, { kutu: 'X' }, simdi).kod === 'SORUN_KUTU_GECERSIZ');
  t('iç not kırpılır, boşsa null, 2000 sınırı', S.ayiklamaKur(yeni, { yoneticiNotu: '  ' }, simdi).data.yoneticiNotu === null && S.ayiklamaKur(yeni, { yoneticiNotu: 'x'.repeat(2001) }, simdi).kod === 'SORUN_NOT_UZUN');
  t('★ "Müşteriye bildirildi" çözülmeden işaretlenemez', S.ayiklamaKur(yeni, { bildirildi: true }, simdi).kod === 'SORUN_BILDIRIM_COZULMEDEN');
  const birlikte = S.ayiklamaKur(yeni, { durum: 'COZULDU', bildirildi: true }, simdi);
  t('★ aynı kayıtta çöz + bildir birlikte olur', birlikte.ok && birlikte.data.bildirildiAt === simdi && birlikte.data.cozulduAt === simdi);
  t('bildirildi tekrar işaretlenince ilk zaman korunur', !('bildirildiAt' in S.ayiklamaKur({ durum: 'COZULDU', cozulduAt: simdi, bildirildiAt: new Date(0) }, { bildirildi: true }, simdi).data));
  t('bildirildi geri alınabilir', S.ayiklamaKur({ durum: 'COZULDU', cozulduAt: simdi, bildirildiAt: simdi }, { bildirildi: false }, simdi).data.bildirildiAt === null);
  t('müşteriye görünen durum: KAPANDI da "Çözüldü", YENI "Alındı"', S.gorunenDurum('KAPANDI') === 'COZULDU' && S.gorunenDurum('YENI') === 'ALINDI' && S.gorunenDurum('INCELENIYOR') === 'INCELENIYOR');
  const pat = oku('src/app/api/super-admin/sorunlar/[id]/route.ts');
  t('★ PATCH süper admin oturumu istiyor ve denetime yazıyor', /getSuperAdminSession\(\)/.test(pat) && /writeAudit\(/.test(pat) && /actorType: 'SUPER_ADMIN'/.test(pat));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SÜZGEÇ, CSV, WHATSAPP\n');
{
  const sp = (o) => new URLSearchParams(o);
  t('★ demo varsayılan HARİÇ', S.suzgecKur(sp({})).demo === false && !('demo' in S.suzgecKur(sp({ demo: '1' }))));
  t('süzgeçler: durum, kutu, tür, bayi', (() => { const w = S.suzgecKur(sp({ durum: 'YENI', kutu: 'HATA', tur: 'ONERI', bayi: 'abc' })); return w.durum === 'YENI' && w.kutu === 'HATA' && w.tur === 'ONERI' && w.tenantId === 'abc'; })());
  t('"ayıklanmadı" süzgeci kutu=null', S.suzgecKur(sp({ kutu: 'YOK' })).kutu === null);
  t('geçersiz süzgeç değeri yok sayılır', Object.keys(S.suzgecKur(sp({ durum: 'x', tur: 'y', kutu: 'z' }))).join() === 'demo');

  for (const dil of ['tr', 'en']) {
    const m = sorunMetni(dil);
    const basliklar = S.CSV_SUTUNLARI.map((k) => m.csv[k]);
    t(`CSV başlıkları (${dil}) eksiksiz`, basliklar.every((b) => typeof b === 'string' && b.length > 0), basliklar);
  }
  const m = sorunMetni('tr');
  t('★ CSV başlıkları: Tarih … Kimlik sırası', S.CSV_SUTUNLARI.map((k) => m.csv[k]).join('|') === 'Tarih|Bayi|Kullanıcı|Rol|Tür|Durum|Kutu|Ne yapmaya çalışıyordu|Ne oldu|Sayfa|Ekran|Tarayıcı|Görüntü var|İç not|Çözüldü|Bildirildi|Demo|Kimlik');
  const kayit = { id: 'x1', createdAt: new Date('2026-10-21T08:30:00Z'), bayi: 'ABC; Ltd', kullaniciAd: '=HYPERLINK("x")', rol: 'ADMIN', tur: 'HATA', durum: 'YENI', kutu: null, neYapiyordu: null, neOldu: 'satır\nsonu', sayfa: '/a', ekran: '1x1', tarayici: null, ekranVar: true, yoneticiNotu: null, cozulduAt: null, bildirildiAt: null, demo: false, ekranGoruntusu: 'data:image/jpeg;base64,GIZLI' };
  const satir = S.csvSatiri(kayit, m.evet, m.hayir);
  t('CSV satırı başlıkla aynı uzunlukta', satir.length === S.CSV_SUTUNLARI.length);
  const metin = csvMetni(S.CSV_SUTUNLARI.map((k) => m.csv[k]), [satir]);
  t('★ CSV\'ye görüntü verisi GİRMEZ (yalnız var/yok)', !metin.includes('GIZLI') && !metin.includes('base64') && satir[12] === 'evet');
  t('★ formül sanılacak metin kesmeyle başlar', satir[2].startsWith("'="));
  t('noktalı virgüllü bayi adı sütun kaydırmaz', metin.includes('"ABC; Ltd"'));
  const csvUc = oku('src/app/api/super-admin/sorunlar/route.ts');
  t('CSV ucu süper admin oturumu istiyor', /getSuperAdminSession\(\)/.test(csvUc) && /format'\) === 'csv'/.test(csvUc));
  t('★ liste sorgusu görüntü sütununu SEÇMİYOR', !/ekranGoruntusu: true/.test(oku('src/lib/sorun-veri.ts').split('export async function sorunEkrani')[0]));

  t('wa.me: cep numarası 90 ile', S.waBaglantisi('0532 111 22 33', 'merhaba') === 'https://wa.me/905321112233?text=merhaba');
  t('wa.me: sabit hat ya da boş → yok', S.waBaglantisi('0212 111 22 33', 'x') === null && S.waBaglantisi(null, 'x') === null);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ YERLEŞİM\n');
{
  t('pencere panel yerleşiminde bir kez', (oku('src/app/(dashboard)/layout.tsx').match(/<SorunBildir \/>/g) ?? []).length === 1);
  t('yan menüde giriş', /sorunBildirAc\(\)/.test(oku('src/components/Sidebar.tsx')));
  t('alt menünün "+" sayfasında giriş', /sorunBildirAc\(\)/.test(oku('src/components/BottomNav.tsx')));
  t('Yardım sayfasında giriş', /sorunBildirAc/.test(oku('src/app/(dashboard)/yardim/page.tsx')));
  const bil = oku('src/components/SorunBildir.tsx');
  t('dokunma hedefi ≥44 px, giriş yazısı 16 px', /min-h-\[44px\]/.test(bil) && /text-base/.test(bil));
  t('görüntü istemcide küçültülüyor (1280 / 0.7) ve yalnız resim seçiliyor', /EKRAN_EN_UZUN_KENAR/.test(bil) && /EKRAN_JPEG_KALITE/.test(bil) && /accept="image\/\*"/.test(bil) && S.EKRAN_EN_UZUN_KENAR === 1280 && S.EKRAN_JPEG_KALITE === 0.7);
  t('süper admin sayfası oturumsuzsa girişe gönderir', /redirect\('\/super-admin\/login'\)/.test(oku('src/app/(super-admin)/super-admin/sorunlar/page.tsx')));
  t('kartta kurulum ayrıntısına bağlantı', /\/super-admin\/kurulum\/\$\{k\.tenantId\}/.test(oku('src/app/(super-admin)/super-admin/sorunlar/SorunKarti.tsx')));
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\n★ VERİTABANI: YALITIM, LİSTE FARKI, DEMO\n');
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const ek = Date.now().toString(36);
  const bayiler = [];
  try {
    const A = await p.tenant.create({ data: { name: `Sorun Testi A ${ek}`, slug: `sorun-testi-a-${ek}`, phone: '05321112233' } });
    const B = await p.tenant.create({ data: { name: `Sorun Testi B ${ek}`, slug: `sorun-testi-b-${ek}` } });
    bayiler.push(A.id, B.id);
    const kul = (tenantId, role, n) => p.user.create({ data: { tenantId, email: `sorun.${n}.${ek}@ornek.local`, passwordHash: 'x', name: `Kişi ${n}`, role } });
    const yon = await kul(A.id, 'ADMIN', 'yon');
    const tek = await kul(A.id, 'TECHNICIAN', 'tek');
    const yonB = await kul(B.id, 'ADMIN', 'yonb');

    const yaz = (u, neOldu, demo = false, ekran = null) => V.sorunOlustur({
      tur: 'DURDURUYOR', neYapiyordu: null, neOldu, sayfa: '/a', ekran: '1x1', tarayici: 'ua', ekranGoruntusu: ekran,
      tenantId: u.tenantId, kullaniciId: u.id, kullaniciAd: u.name, rol: u.role, demo,
    });
    const s1 = await yaz(yon, 'yönetici yazdı', false, 'data:image/jpeg;base64,QUJD');
    const s2 = await yaz(tek, 'teknisyen yazdı');
    const s3 = await yaz(yonB, 'B bayisi yazdı');
    const s4 = await yaz(tek, 'demodan geldi', true);

    const yonListe = await V.kendiSorunlari(yon);
    const tekListe = await V.kendiSorunlari(tek);
    const bListe = await V.kendiSorunlari(yonB);
    t('★ yönetici bayinin hepsini görür', [s1.id, s2.id, s4.id].every((id) => yonListe.some((x) => x.id === id)));
    t('★ teknisyen yalnız kendisininkini görür', tekListe.length === 2 && tekListe.every((x) => x.id === s2.id || x.id === s4.id));
    t('★ başka bayinin bildirimi görünmez (iki yönde)', !yonListe.some((x) => x.id === s3.id) && bListe.length === 1 && bListe[0].id === s3.id);
    const ilk = yonListe.find((x) => x.id === s1.id);
    t('★ ürün listesinde görüntü verisi ve iç not yok, yalnız ekranVar', ilk.ekranVar === true && !('ekranGoruntusu' in ilk) && !('yoneticiNotu' in ilk));
    t('durum müşteri dilinde: YENI → ALINDI', ilk.durum === 'ALINDI');

    const varsayilan = await V.sorunListesi({ ...S.suzgecKur(new URLSearchParams({ bayi: A.id })) });
    const demoDahil = await V.sorunListesi({ ...S.suzgecKur(new URLSearchParams({ bayi: A.id, demo: '1' })) });
    t('★ süper admin listesinde demo varsayılan hariç', varsayilan.length === 2 && !varsayilan.some((x) => x.id === s4.id));
    t('?demo=1 ile demo görünür ve demo bayrağı yazılmış', demoDahil.length === 3 && demoDahil.find((x) => x.id === s4.id)?.demo === true);
    t('süper admin listesi bayi adı + telefon taşıyor, görüntü taşımıyor', varsayilan[0].bayi === A.name && varsayilan.some((x) => x.telefon === '05321112233') && !('ekranGoruntusu' in varsayilan[0]));
    t('görüntü tek kayıt ucundan gelir', (await V.sorunEkrani(s1.id)) === 'data:image/jpeg;base64,QUJD' && (await V.sorunEkrani(s2.id)) === null);

    const mevcut = await V.sorunBul(s1.id);
    const k = S.ayiklamaKur(mevcut, { durum: 'COZULDU', kutu: 'BILGI_EKSIGI', yoneticiNotu: 'rehbere yazıldı', bildirildi: true }, new Date());
    const g1 = await V.sorunGuncelle(s1.id, k.data);
    t('★ PATCH: çözüldü + kutu + not + bildirildi kaydedildi', g1.durum === 'COZULDU' && g1.kutu === 'BILGI_EKSIGI' && g1.cozulduAt && g1.bildirildiAt && g1.yoneticiNotu === 'rehbere yazıldı');
    const g2 = await V.sorunGuncelle(s1.id, S.ayiklamaKur(g1, { durum: 'INCELENIYOR' }, new Date()).data);
    t('★ yeniden açılınca tarih alanları temizlendi', g2.durum === 'INCELENIYOR' && g2.cozulduAt === null && g2.bildirildiAt === null);
    const sayilar = await V.durumSayilari(false);
    t('durum sayıları dört durumu da taşır', ['YENI', 'INCELENIYOR', 'COZULDU', 'KAPANDI'].every((d) => typeof sayilar[d] === 'number'));
    t('iç not ürün listesine sızmıyor', !JSON.stringify(await V.kendiSorunlari(yon)).includes('rehbere'));
  } catch (e) {
    t('veritabanı kısmı hatasız', false, e?.message);
  } finally {
    for (const id of bayiler) await p.tenant.delete({ where: { id } }).catch(() => {});
    const kalan = await p.sorunBildirimi.count({ where: { tenantId: { in: bayiler } } }).catch(() => -1);
    t('geçici bayiler ve bildirimleri silindi', kalan === 0, kalan);
    await p.$disconnect();
    const { prisma } = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await prisma.$disconnect();
  }
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
