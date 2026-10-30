// EKİP TEST HESAPLARI — kısa adla giriş, örnek veri, açık yazma, kapalı dış mesaj
// Çalıştır:  node scripts/test-ekip-test.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Teknik ekip, herkese açık demoyla aynı örnek veriyle kurulmuş ve her özelliği
// açık test hesaplarında çalışıyor. Üç şey bozulursa zarar gerçek olur:
//   · şifre açık depoya ya da sunucu günlüğüne düşerse herkes girer,
//   · dışarıya mesaj açılırsa örnek numaralar gerçek bir kişiye ait olabilir,
//   · şerit kaybolursa ekip ekran görüntüsünü gerçek veri sanabilir.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (y) => readFileSync(join(KOK, y), 'utf8');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'st-ekip-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/ekip-test.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const e = await import(pathToFileURL(join(g, 'ekip-test.js')).href);
rmSync(g, { recursive: true, force: true });

console.log('\nKısa adla giriş\n');
t('teknik3 → teknik3@nextusservis.com', e.girisAdiniCoz('teknik3') === 'teknik3@nextusservis.com');
t('teknisyen adı da açılır, büyük harf ve boşluk tolere edilir', e.girisAdiniCoz('  Teknik12-Teknisyen ') === 'teknik12-teknisyen@nextusservis.com');
t('★ kalıp dışı kısa ad açılmaz (teknik21, teknik0, test1, admin)', ['teknik21', 'teknik0', 'test1', 'admin'].every((x) => e.girisAdiniCoz(x) === x));
t('★ tam e-posta olduğu gibi kalır (küçültülür)', e.girisAdiniCoz('Ali@Firma.com') === 'ali@firma.com' && e.girisAdiniCoz('teknik1@baska.com') === 'teknik1@baska.com');
t('★ test bayisi hesapları teknikN adında', /patronEposta: `teknik\$\{i \+ 1\}@nextusservis\.com`/.test(oku('scripts/seed-bayi-demo.mjs')));
t('★ süper admin girişi de kısa adı çözüyor (teknik1 → Ekip hesabı)', /loginSuperAdmin\(girisAdiniCoz\(String\(email\)\)/.test(oku('src/app/api/super-admin/login/route.ts'))
  && !/type="email"/.test(oku('src/app/(super-admin)/super-admin/login/page.tsx')));
const auth = oku('src/lib/auth.ts');
t('giriş kısa adı çözüyor', /const eposta = girisAdiniCoz\(String\(credentials\.email\)\)/.test(auth));
t('giriş alanı kısa adı tarayıcıda reddetmiyor (type="text")', /id="eposta" type="text"/.test(oku('src/app/login/page.tsx')));

console.log('\nŞifre ve tohum\n');
const tohum = oku('scripts/seed-bayi-demo.mjs');
t('★ şifre depoda değil: ortamdan, en az 10 karakter', /process\.env\.EKIP_TEST_SIFRE/.test(tohum) && /EKIP_TEST_SIFRE\.length >= 10/.test(tohum));
{
  // Şifre değişkeni koddaki her yerde sayılır (yorumlar ve ekrana yazılan
  // "sunucudaki EKIP_TEST_SIFRE" metni hariç). Yalnız üç kullanıma izin var:
  // tanım, uzunluk denetimi, şifre özeti. Günlüğe giden her yeni kullanım düşer.
  const kod = tohum.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/sunucudaki EKIP_TEST_SIFRE/g, '');
  const kullanimlar = [...kod.matchAll(/.{0,30}\bEKIP_TEST_SIFRE\b.{0,20}/g)].map((m) => m[0].trim())
    .filter((s) => !/process\.env\.EKIP_TEST_SIFRE/.test(s) || /const EKIP_TEST_SIFRE/.test(s));
  const izinli = (s) => /const EKIP_TEST_SIFRE = /.test(s) || /EKIP_TEST_SIFRE\.length >= 10/.test(s) || /bcrypt\.hash\(EKIP_TEST_SIFRE, 10\)/.test(s);
  t('★ şifre günlüğe yazılmıyor (değişken yalnız tanım, uzunluk ve özette)', kullanimlar.length === 3 && kullanimlar.every(izinli), kullanimlar);
}
t('★ şifre özeti yüksek maliyetle (açık demo şifresi gibi 4 değil)', /bcrypt\.hash\(EKIP_TEST_SIFRE, 10\)/.test(tohum));
t('★ veri herkese açık demoyla aynı (veriN 6, aynı tohum)', /veriN: 6, ekipTest: true/.test(tohum) && /tohum: 20260920/.test(tohum.slice(tohum.indexOf('EKIP_TESTLERI'))));
t('müşteri adları ve seri numaraları veriN ile', (tohum.match(/bayi\.veriN \?\? bayi\.n/g) || []).length >= 3);
t('★ sorun bildirimleri yeniden kurulumda taşınıyor', /if \(eski\.ekipTest\) eskiBildirimler = await p\.sorunBildirimi\.findMany/.test(tohum) && /p\.sorunBildirimi\.createMany/.test(tohum));
t('★ kapatılan hesap SİLİNMEZ, girişi kapanır', /tenant: \{ ekipTest: true, demo: true, slug: \{ notIn: acikSluglar \} \}/.test(tohum) && /data: \{ isActive: false \}/.test(tohum));
t('bayi kaydı ekipTest bayrağını taşıyor', /ekipTest: Boolean\(bayi\.ekipTest\)/.test(tohum));
const zaman = oku('src/lib/zamanlayici.ts');
t('zamanlayıcı tohumla aynı kuralı sayıyor (10 karakter, varsayılan 5, en çok 20)',
  /\.trim\(\)\.length < 10/.test(zaman) && /Math\.min\(20, Math\.max\(1, Number\.parseInt\(env\.EKIP_TEST_SAYI \|\| '', 10\) \|\| 5\)\)/.test(zaman)
  && /Math\.min\(20, Math\.max\(1, Number\.parseInt\(process\.env\.EKIP_TEST_SAYI \|\| '', 10\) \|\| 5\)\)/.test(tohum));
t('şifre eklenince gece beklenmeden kuruluyor', /demoTazele\('ekip-test', ekip\.donem\)/.test(zaman));

console.log('\nOturum ve kısıtlar\n');
t('★ oturumda demo kısıtı ekip testinde kapalı', /demo: Boolean\(\(user as any\)\.tenant\.demo && !\(user as any\)\.tenant\.ekipTest\)/.test(auth)
  && /token\.demo = Boolean\(kayitli\.tenant\.demo && !kayitli\.tenant\.ekipTest\)/.test(auth));
t('ekip testi açık yazılı değil: yanlış şifre kilidi ona uygulanır', /tenant\?\.demo && !\(a as any\)\.tenant\?\.ekipTest\)\); return null;/.test(auth));
const koruma = oku('src/lib/demo-koruma.ts');
t('demo kısıtları ekip testinde yok', /return Boolean\(t\?\.demo && !t\.ekipTest\)/.test(koruma));
t('★ dışarıya mesaj her demo bayisinde kapalı (ekip testi dahil)', /if \(!t\?\.demo\) return null;\s*return t\.ekipTest \? 'TEST_HESABINDA_MESAJ_KAPALI' : 'DEMO_HESABINDA_KAPALI'/.test(koruma));
for (const y of ['src/app/api/sms/bulk/route.ts', 'src/app/api/whatsapp/bulk/route.ts']) {
  t(`★ ${y} dış mesaj engelini kullanıyor`, /const mesajEngeli = await disariyaMesajKapali\(tenantId\);\s*if \(mesajEngeli\) return ucHatasi\(mesajEngeli, 403\)/.test(oku(y)));
}
const gelen = oku('src/app/api/whatsapp/inbox/route.ts');
t('★ WhatsApp cevabı dış mesaj engelini kullanıyor', /action === 'cevap'[\s\S]{0,400}disariyaMesajKapali\(tenantId\)/.test(gelen));
t('"ilgilenildi" işareti dış mesaj değil: ekip testinde açık', /action === 'handled'[\s\S]{0,300}demoBayiMi\(tenantId\)/.test(gelen));
const sso = oku('src/lib/sso-kimlik.ts');
t('SSO girişi de bayrağı okuyor', /demo: true, ekipTest: true/.test(sso));

console.log('\nÖrnek veri şeridi\n');
const yerlesim = oku('src/app/(dashboard)/layout.tsx');
t('★ şerit ekip testinde her sayfada', /\{ekipTest && <OrnekVeriSeridi \/>\}/.test(yerlesim));
t('★ arama/WhatsApp bağlantıları ekip testinde de korunuyor', /\?\.demo \|\| ekipTest\) && <DemoBaglantiKoruma \/>/.test(yerlesim));
const tr = oku('src/lib/i18n/tr.ts'), en = oku('src/lib/i18n/en.ts');
t('şerit örnek (seed) veri olduğunu söylüyor (TR/EN)', /ornekVeri: \{[\s\S]{0,400}örnek \(seed\) veridir/.test(tr) && /ornekVeri: \{[\s\S]{0,400}sample \(seed\) data/.test(en));
t('ekip testine özel hata metni (TR/EN)', /TEST_HESABINDA_MESAJ_KAPALI:/.test(tr) && /TEST_HESABINDA_MESAJ_KAPALI:/.test(en));

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
