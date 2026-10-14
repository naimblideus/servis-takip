// DEMO, KENDİ KENDİNE KAYIT VE UYGULAMA İÇİ ZAMANLAYICI
// Çalıştır:  node scripts/test-demo-ve-kayit.mjs   (HTTP kısmı açık sunucu ister: npm run dev)
//
// NEDEN BU TEST
// Bütün Türkiye'ye satış üç şeye dayanıyor: servis hesabını gece yarısı da
// kendisi açabilmeli (kayıt), denemeden önce ürünü bütünüyle görebilmeli
// (demo, her özellik açık, her gece taze) ve aylık fatura ile hatırlatmalar
// kimse Coolify'a görev eklemeden çalışmalı (zamanlayıcı). Üçü de sessiz
// bozulur: demo'da bir modül kapalı kalır, aynı hatırlatma iki kez gider,
// aynı e-postayla iki hesap açılır. Bu dosya o sessiz bozulmaları kilitliyor.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-kayit-'));
const KAYNAKLAR = ['kayit', 'zamanlanmis-is', 'zamanlayici', 'tenant-manager', 'talep', 'sahip-bildirim', 'audit', 'iller', 'modules', 'demo-koruma', 'demo-yazma'];
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
writeFileSync(join(g, 'next-server-shim.js'),
  'export const NextResponse = { json: (b, i) => new Response(JSON.stringify(b), { status: i?.status ?? 200, headers: { "content-type": "application/json" } }) };\n');
const bcryptYolu = pathToFileURL(require.resolve('bcryptjs')).href;
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  let s = readFileSync(yol, 'utf8');
  s = s.replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'")
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'")
    .replace(/'next\/server'/g, "'./next-server-shim.js'")
    .replace(/'bcryptjs'/g, `'${bcryptYolu}'`);
  writeFileSync(yol, s);
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const kayit = await al('kayit');
const zis = await al('zamanlanmis-is');
const zam = await al('zamanlayici');
const tm = await al('tenant-manager');
const mod = await al('modules');
const dy = await al('demo-yazma');

// ── KAYIT DOĞRULAMA (saf) ────────────────────────────────────────────────
console.log('\nKayıt formu\n');
const { cepTelefonu, kayitDogrula } = kayit;
t('cep: boşluklu, +90\'lı, başında 0 olmayan aynı numara', cepTelefonu('0532 111 22 33') === '05321112233'
  && cepTelefonu('+90 532 111 22 33') === '05321112233' && cepTelefonu('5321112233') === '05321112233');
t('cep: sabit hat ve eksik numara reddediliyor', cepTelefonu('0212 555 55 55') === null && cepTelefonu('0532 111') === null && cepTelefonu(null) === null);
const tam = { firma: '  Örnek   Fotokopi ', ad: 'Ali Yılmaz', telefon: '0532 111 22 33', eposta: ' Ali.Yilmaz@Ornek.COM ', sifre: 'gizli-sifre-1', il: 'Van', onay: true };
const d1 = kayitDogrula(tam);
t('geçerli form: boşluklar toplandı, e-posta küçük harf, il tanındı', d1.ok && d1.veri.firma === 'Örnek Fotokopi' && d1.veri.eposta === 'ali.yilmaz@ornek.com'
  && d1.veri.telefon === '05321112233' && d1.veri.il === 'Van', d1);
t('bilinmeyen il kaydı engellemiyor (boş kalır)', kayitDogrula({ ...tam, il: 'Atlantis' }).veri?.il === null);
const kod = (x) => kayitDogrula(x).kod;
t('eksik alan', kod({ ...tam, firma: 'A' }) === 'KAYIT_ALAN_EKSIK' && kod({ ...tam, eposta: '' }) === 'KAYIT_ALAN_EKSIK' && kod(null) === 'KAYIT_ALAN_EKSIK');
t('geçersiz e-posta', kod({ ...tam, eposta: 'ali@ornek' }) === 'KAYIT_EPOSTA_GECERSIZ');
t('geçersiz telefon', kod({ ...tam, telefon: '0212 555 55 55' }) === 'KAYIT_TELEFON_GECERSIZ');
t('kısa şifre ve bcrypt\'in göremeyeceği uzun şifre', kod({ ...tam, sifre: '1234567' }) === 'KAYIT_SIFRE_KISA' && kod({ ...tam, sifre: 'ğ'.repeat(40) }) === 'KAYIT_SIFRE_KISA');
t('gizlilik onayı zorunlu ("true" metni de sayılmaz)', kod({ ...tam, onay: false }) === 'KAYIT_ONAY_YOK' && kod({ ...tam, onay: 'true' }) === 'KAYIT_ONAY_YOK');
t('slug: "İ" tire üretmiyor', tm.generateSlug('İstanbul Fotokopi Ltd.') === 'istanbul-fotokopi-ltd' && tm.generateSlug('IŞIK Büro') === 'isik-buro', [tm.generateSlug('İstanbul Fotokopi Ltd.'), tm.generateSlug('IŞIK Büro')]);
{
  const { denemeIzni, hizSiniriniSifirla } = kayit;
  hizSiniriniSifirla();
  const izinler = Array.from({ length: 6 }, () => denemeIzni('9.9.9.9', 1_000_000));
  t('★ IP başına 10 dakikada 5 deneme; 6.\'sı reddediliyor', izinler.slice(0, 5).every(Boolean) && izinler[5] === false, izinler);
  t('10 dakika sonra yeniden deneyebiliyor', denemeIzni('9.9.9.9', 1_000_000 + 10 * 60_000 + 1) === true);
  hizSiniriniSifirla();
}

// ── ETKİNLİK KODU (saf) ──────────────────────────────────────────────────
console.log('\nEtkinlik kodu (salonda herkes aynı Wi-Fi)\n');
{
  const { etkinlikBul, denemeDurumu, hizSiniriniSifirla } = kayit;
  const ekim17 = Date.parse('2026-10-17T10:00:00+03:00');
  t('★ "pantum" toplantı günlerinde geçerli, adıyla', etkinlikBul('pantum', ekim17)?.ad === 'Pantum Premium Partners Meeting 2026');
  t('kod büyük harf/boşlukla da tanınıyor', etkinlikBul(' PANTUM ', ekim17)?.kod === 'pantum');
  t('süresi geçen ya da bilinmeyen kod sıradan kayıt sayılır', etkinlikBul('pantum', Date.parse('2027-01-02T10:00:00+03:00')) === null
    && etkinlikBul('bilinmeyen', ekim17) === null && etkinlikBul('__proto__', ekim17) === null && etkinlikBul('constructor', ekim17) === null && etkinlikBul(null, ekim17) === null);
  hizSiniriniSifirla();
  const etk = etkinlikBul('pantum', ekim17);
  t('★ toplantı günü salon modu: 30 gün deneme, 5 kullanıcı', etk?.salon === true && etk?.denemeGun === 30 && etk?.kullanici === 5, etk);
  const ekim25 = Date.parse('2026-10-25T10:00:00+03:00');
  t('toplantıdan sonra kod geçerli ama salon değil (ofisten okutulan QR)', etkinlikBul('pantum', ekim25)?.salon === false && etkinlikBul('pantum', Date.parse('2026-10-15T23:00:00+03:00'))?.salon === false);
  const salon = Array.from({ length: 301 }, () => denemeDurumu('7.7.7.7', ekim17, etk));
  t('★ salon: aynı Wi-Fi\'dan 10 dakikada 300 deneme, 301.\'si bot sayılır', salon.slice(0, 300).every((x) => x === 'TAMAM') && salon[300] === 'DENEME', salon.slice(298));
  hizSiniriniSifirla();
  const ofis = etkinlikBul('pantum', ekim25);
  const kodlu = Array.from({ length: 31 }, () => denemeDurumu('7.7.7.8', ekim25, ofis));
  t('etkinlik kodlu (salon dışı): 10 dakikada 30 deneme, 31.\'si bot sayılır', kodlu.slice(0, 30).every((x) => x === 'TAMAM') && kodlu[30] === 'DENEME', kodlu.slice(28));
  const kodsuz = Array.from({ length: 6 }, () => denemeDurumu('8.8.8.8', ekim17, null));
  t('kodsuz sınır değişmedi (5 deneme)', kodsuz.slice(0, 5).every((x) => x === 'TAMAM') && kodsuz[5] === 'DENEME', kodsuz);
  hizSiniriniSifirla();
}

// ── DEMODA YAZMA KURALI (saf) ────────────────────────────────────────────
console.log('\nDemoda yazma kuralı (aynı anda yüz ziyaretçi)\n');
{
  const y = dy.demoYazmaYasak;
  t('★ her silme kapalı', y('DELETE', '/api/customers/abc') && y('DELETE', '/api/tickets/trash') && y('delete', '/api/devices/x'));
  t('★ ayarlar, kullanıcılar, içe aktarım, yedek kapalı', y('PUT', '/api/settings') && y('PATCH', '/api/users/u1') && y('POST', '/api/users')
    && y('POST', '/api/import/sheet') && y('POST', '/api/backup/restore') && y('POST', '/api/fix-phones'));
  t('★ demonun amacı açık: fiş, sayaç, cihaz, müşteri ekleme, tahsilat', !y('POST', '/api/tickets') && !y('POST', '/api/readings/bulk')
    && !y('POST', '/api/devices') && !y('POST', '/api/customers') && !y('PATCH', '/api/tickets/t1') && !y('POST', '/api/invoices/inv1/payments'));
  // Vitrin: biri basınca herkes için tükenen işler (Kaçan Gelir ₺0, tarama "tek tıkla ekle" kaybolur, toner listesi boşalır).
  t('★ vitrini tüketen işler kapalı: toplu fatura, tarama onayı, taramadan cihaz, toner sevki', y('POST', '/api/invoices') && y('POST', '/api/sayac/tarayici/tr1')
    && y('POST', '/api/sayac/tarayici/tr1/cihaz') && y('POST', '/api/toner-sevk'));
  t('★ Bayi Pazarı ortak yüzü kapalı: ilan, pazar adı, mesaj', y('POST', '/api/market/listings') && y('PATCH', '/api/market/listings/l1') && y('PATCH', '/api/market/profile')
    && y('POST', '/api/market/messages'));
  t('★ firma ayarının öbür kapıları kapalı: hedef marj, tarayıcı otomatikleri', y('POST', '/api/sozlesmeler/karlilik') && y('PATCH', '/api/sayac/tarayici/ayar'));
  t('WhatsApp: toplu gönderim kapalı, gelen kutusu (fotoğraftan sayaç) açık', y('POST', '/api/whatsapp/bulk') && !y('POST', '/api/whatsapp/inbox'));
  t('toplu zam/ayar önizlemesi açık (uygulama uçta kapalı)', !y('POST', '/api/devices/bulk-price') && !y('POST', '/api/devices/bulk-settings')
    && /!dryRun && await demoBayiMi/.test(readFileSync(join(KOK, 'src/app/api/devices/bulk-price/route.ts'), 'utf8'))
    && /dryRun[\s\S]{0,200}demoBayiMi/.test(readFileSync(join(KOK, 'src/app/api/devices/bulk-settings/route.ts'), 'utf8')));
  t('okuma, giriş/çıkış ve dil seçimi her zaman açık', !y('GET', '/api/settings') && !y('HEAD', '/api/users') && !y('POST', '/api/auth/callback/credentials')
    && !y('POST', '/api/auth/signout') && !y('POST', '/api/locale') && !y('DELETE', '/api/auth/session'));
  t('API dışı yollar kurala girmiyor', !y('POST', '/login') && !y('DELETE', '/dashboard'));
  t('tarayıcı anahtarı kendi demo cevabını veriyor (ücretsiz taramaya yönlendiren)', !y('POST', '/api/sayac/tarayici/ayar'));
  t('mesaj iki dilde ve kayıt sayfasını gösteriyor', /kayit/.test(dy.DEMO_YAZMA_MESAJI.tr) && /kayit/.test(dy.DEMO_YAZMA_MESAJI.en) && !/[ğışçöü]/i.test(dy.DEMO_YAZMA_MESAJI.en.replace('nextusservis.com/kayit', '')));
}

// ── DÖNEM VE VAKİT (saf) ─────────────────────────────────────────────────
console.log('\nZamanlayıcı — dönem ve vakit\n');
const { donemi } = zis;
const { vakitGeldiMi, ISLER } = zam;
const an = (iso) => new Date(iso);
t('İstanbul saati: 31 Ekim 21:30 UTC = 1 Kasım 00:30 → yeni gün ve yeni ay', donemi('gunluk', an('2026-10-31T21:30:00Z')) === '2026-11-01' && donemi('aylik', an('2026-10-31T21:30:00Z')) === '2026-11');
t('aynı an UTC\'de hâlâ ekim (dönem İstanbul\'a göre)', donemi('aylik', an('2026-10-31T20:59:00Z')) === '2026-10');
const is = (k) => ISLER.find((x) => x.anahtar === k);
t('fatura: ayın 1\'i 05:59 değil, 06:00 vakit', !vakitGeldiMi(is('faturalar'), an('2026-11-01T02:59:00Z')) && vakitGeldiMi(is('faturalar'), an('2026-11-01T03:00:00Z')));
t('★ fatura kaçarsa yetişir: ayın 9\'unda da vakit (dönem kilidi tek sefer)', vakitGeldiMi(is('faturalar'), an('2026-11-09T12:00:00Z')));
t('★ sayaç hatırlatması ay ortasında YETİŞMEZ (5\'inden sonra)', vakitGeldiMi(is('sayac'), an('2026-11-05T08:00:00Z')) && !vakitGeldiMi(is('sayac'), an('2026-11-06T08:00:00Z')));
t('günlük hatırlatma 09:00 İstanbul', !vakitGeldiMi(is('hatirlatma'), an('2026-10-10T05:59:00Z')) && vakitGeldiMi(is('hatirlatma'), an('2026-10-10T06:00:00Z')));
t('bütün cron uçları zamanlayıcıda', ['faturalar', 'hatirlatma', 'sayac', 'nobetci', 'wa-temizlik', 'crm-sinyal', 'demo'].every((k) => is(k)));

// ── KAYNAK KİLİTLERİ ─────────────────────────────────────────────────────
console.log('\nKaynak\n');
const CRON = ['overdue-reminders', 'generate-customer-invoices', 'sayac-hatirlatma', 'whatsapp-temizlik', 'crm-sinyal', 'nobetci'];
t('★ altı cron ucunun hepsi dönemi sahipleniyor', CRON.every((c) => /tekSeferlik\(req, '/.test(oku(`src/app/api/cron/${c}/route.ts`))), CRON.filter((c) => !/tekSeferlik/.test(oku(`src/app/api/cron/${c}/route.ts`))));
t('★ zamanlayıcının anahtarları uçlarınkiyle aynı', ISLER.filter((i) => i.yol).every((i) => oku(`src/app${i.yol}/route.ts`).includes(`tekSeferlik(req, '${i.anahtar}'`)));
const baslangic = oku('startup.sh');
t('CRON_SECRET yoksa sunucudan ÖNCE geçici anahtar üretiliyor', /if \[ -z "\$CRON_SECRET" \]/.test(baslangic) && baslangic.indexOf('export CRON_SECRET') < baslangic.indexOf('exec node server.js'));
const enstr = oku('src/instrumentation.ts');
t('zamanlayıcı yalnız üretimde ve Node ortamında başlıyor (Node modülü yalnız nodejs dalında)', /if \(process\.env\.NEXT_RUNTIME === 'nodejs'\) \{/.test(enstr) && /NODE_ENV !== 'production'/.test(enstr) && enstr.indexOf("import('./lib/zamanlayici')") > enstr.indexOf("=== 'nodejs'"));
t('★ hatırlatma işleri demo bayilerine gitmiyor', /demo: false/.test(oku('src/lib/vade-hatirlatma.ts')) && /demo: false/.test(oku('src/app/api/cron/sayac-hatirlatma/route.ts')));
const KORUMA = ['src/app/api/sms/bulk/route.ts', 'src/app/api/whatsapp/bulk/route.ts', 'src/app/api/auth/2fa/route.ts', 'src/app/api/users/[id]/route.ts', 'src/app/api/sayac/tarayici/ayar/route.ts'];
t('demo koruması beş uçta', KORUMA.every((f) => oku(f).includes('demoBayiMi(')), KORUMA.filter((f) => !oku(f).includes('demoBayiMi(')));

const ara = oku('src/middleware.ts');
t('★ middleware demo oturumunda kuralı uyguluyor ve /api yollarını kapsıyor', /demoYazmaYasak\(request\.method, pathname\)/.test(ara) && /jeton\?\.demo/.test(ara) && ara.includes("'/api/:path*'"));
const authKaynak = oku('src/lib/auth.ts');
t('★ oturum jetonu bayinin demo bayrağını taşıyor (giriş ve SSO)', /demo: Boolean\(\(user as any\)\.tenant\.demo\)/.test(authKaynak) && /token\.demo = Boolean\(\(user as any\)\.demo\)/.test(authKaynak) && /token\.demo = Boolean\(kayitli\.tenant\.demo\)/.test(authKaynak)
  && /demo: true/.test(oku('src/lib/sso-kimlik.ts')));
// Bayi Pazarı: demo komşuları gerçek bayilere görünmesin, demo ziyaretçisi gerçek bayiye yazamasın.
t('★ pazar listesi yalnız kendi dünyasındaki satıcıları gösteriyor', /marketEnabled: true, demo: a\.tenant!\.demo/.test(oku('src/app/api/market/listings/route.ts')));
t('★ ilan ayrıntısı, sipariş ve mesaj demo ↔ gerçek arası kapalı', /sellerTenant\?\.demo !== a\.tenant!\.demo/.test(oku('src/app/api/market/listings/[id]/route.ts'))
  && /seller\.demo !== a\.tenant!\.demo/.test(oku('src/app/api/market/orders/route.ts')) && /ayniDunyada\(a\.tenant!/.test(oku('src/app/api/market/messages/route.ts')));
const etkinlikSayfasi = oku('public/pantum.html');
t('★ etkinlik sayfası: kısa adres, kodlu kayıt, etiketli talep', /source: '\/pantum', destination: '\/pantum\.html'/.test(oku('next.config.ts'))
  && etkinlikSayfasi.includes('href="/kayit?k=pantum"') && etkinlikSayfasi.includes('href="/demo"') && /utm_source: 'pantum'/.test(etkinlikSayfasi)
  && kayit.etkinlikBul('pantum', Date.parse('2026-10-17T10:00:00+03:00')) !== null);
t('★ etkinlik sayfası: gün/kullanıcı sunucudan, sayaç yalnız gerçek sayı ve en az 10', /data-gun/.test(etkinlikSayfasi) && /d\.hesap >= 10/.test(etkinlikSayfasi) && !/14 gün/.test(etkinlikSayfasi));
t('★ yeni hesabın panelinde "kurulumu birlikte yapalım" (müşteri yokken, demoda değil)', /<KurulumKarti \/>/.test(oku('src/app/(dashboard)/dashboard/page.tsx'))
  && /hasCustomers/.test(oku('src/components/KurulumKarti.tsx')) && /if \(!goster \|\| demo\) return null/.test(oku('src/components/KurulumKarti.tsx')));

{
  // Etkinlik sonrası yüzlerce talebi ekibe dağıtmak: kaynak süzgeci + Excel.
  const lr = oku('src/app/api/super-admin/leads/route.ts');
  t('★ Talepler: kaynağa göre süzülür, 1000 kayda kadar, Excel dosyası iner', /kaynak \? \{ kaynak \}/.test(lr) && /take: 1000/.test(lr) && lr.includes("get('bicim') === 'csv'"));
  t('★ CSV: formül sanılacak hücre etkisiz, Excel için BOM ve noktalı virgül', lr.includes('/^[=+\\-@\\t\\r]/') && lr.includes("'\\uFEFF'") && lr.includes(".join(';')"));
}
const tohum = oku('scripts/seed-bayi-demo.mjs');
{
  // Parça grubu KOD olmalı: Türkçe ad İngilizce ekranda Türkçe kalır, grup süzgeci kaçırır.
  const parcalar = tohum.slice(tohum.indexOf('const PARCALAR = ['), tohum.indexOf('];', tohum.indexOf('const PARCALAR = [')));
  const gruplar = [...parcalar.matchAll(/grup: '([^']+)'/g)].map((m) => m[1]);
  const KODLAR = ['TONER', 'INK', 'FUSER', 'ROLLER', 'GEAR', 'DRUM', 'SPARE', 'PAPER', 'LABOUR', 'REPAIR', 'OTHER'];
  t('★ demo stoğunda parça grubu KOD (gece tazelemesi Türkçe ad yazmıyor)', gruplar.length >= 15 && gruplar.every((x) => KODLAR.includes(x)), [...new Set(gruplar)]);
  t('★ demoda Pantum makineleri ve tonerleri var (Pantum bayileri kendi makinesini görsün)', /marka: 'Pantum', model: 'M7100DW'/.test(tohum) && /marka: 'Pantum', model: 'BP5100DN'/.test(tohum)
    && /'Pantum TL-410X Toner'/.test(parcalar) && /'Pantum TL-5120X Toner'/.test(parcalar));
}
const demoModuller = (tohum.match(/modules: \[([^\]]+)\]/)?.[1] ?? '').match(/'([A-Z_]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
t('★ demo bayisinde BÜTÜN modüller açık (yeni modül eklenince bu test hatırlatır)', mod.ALL_MODULE_KEYS.every((k) => demoModuller.includes(k)), { eksik: mod.ALL_MODULE_KEYS.filter((k) => !demoModuller.includes(k)) });
t('demo bayileri demo bayrağıyla kuruluyor', /demo: true,/.test(tohum));
t('★ demo şifre özeti ucuz (şifre zaten açık; salonda yüzlerce giriş sunucuyu kilitlemesin)', /const DEMO_SIFRE_MALIYETI = 4;/.test(tohum) && !/bcrypt\.hash\(bayi\.sifre \?\? SIFRE, 12\)/.test(tohum));
t('★ gece kurulumu YALNIZ demo işaretli bayiyi siliyor (gerçek bayi aynı adı taşısa bile)', /if \(!eski\.demo\) throw/.test(tohum) && /if \(var_ && !var_\.demo\) throw/.test(tohum));
const goc = oku('prisma/migrations/20261010100000_zamanlayici_kayit_demo/migration.sql');
t('eski demo bayileri göçte yalnız demo adresleriyle doğrulanarak işaretleniyor', /UPDATE "Tenant" SET "demo" = true/.test(goc) && /EXISTS \(/.test(goc));
const giris = oku('src/app/login/page.tsx');
const girisEposta = giris.match(/const DEMO_EPOSTA = '([^']+)'/)?.[1];
const girisSifre = giris.match(/const DEMO_SIFRE = '([^']+)'/)?.[1];
t('★ herkese açık demo: giriş sayfasındaki adres ve şifreyle kuruluyor', !!girisEposta && tohum.includes(`patronEposta: '${girisEposta}'`) && tohum.includes(`sifre: '${girisSifre}'`) && /slug: 'demo',/.test(tohum));
t('eski küçük demo betiği çalışmıyor (aynı bayiyi korumasız kurardı)', /process\.exit\(1\);/.test(oku('scripts/seed-demo.mjs')));
const landing = oku('marketing/landing/nextus-servis.html');
t('★ ana sayfa: deneme düğmeleri kayıt sayfasına, demo düğmeleri anında demoya', (landing.match(/href="\/kayit"/g) ?? []).length >= 4 && (landing.match(/href="\/login\?demo=1"/g) ?? []).length >= 2
  && !/denemeyi%20baslatmak/.test(landing), { kayit: (landing.match(/href="\/kayit"/g) ?? []).length, demo: (landing.match(/href="\/login\?demo=1"/g) ?? []).length });
t('derlenmiş ana sayfa güncel (Landing.tsx)', (oku('src/app/_landing/Landing.tsx').match(/\/kayit/g) ?? []).length >= 4);
t('giriş sayfasında kayıt bağlantısı', /href="\/kayit"/.test(giris));

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());
const TEST_EPOSTA = (n) => `kayit.testi.${n}@ornek.local`;
const temizle = async () => {
  const eposta = { in: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(TEST_EPOSTA) };
  const kullanicilar = await p.user.findMany({ where: { OR: [{ email: eposta }, { email: 'Kayit.Testi.Buyuk@Ornek.local' }] }, select: { tenantId: true } });
  for (const k of kullanicilar) await p.tenant.delete({ where: { id: k.tenantId } }).catch(() => {});
  await p.lead.deleteMany({ where: { eposta } });
};

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nZamanlayıcı — dönem sahiplenme (veritabanı)\n');
  const { isiSahiplen, isiBitir, tekSeferlik } = zis;
  const yedek = await p.zamanlanmisIs.findMany();
  try {
    await p.zamanlanmisIs.deleteMany({ where: { anahtar: { in: ['test-gunluk', 'test-tek'] } } });
    t('ilk sahiplenme çalıştırır', await isiSahiplen('test-gunluk', '2026-10-10', 'test') === true);
    t('★ aynı dönemde ikinci çağrı ÇALIŞMAZ', await isiSahiplen('test-gunluk', '2026-10-10', 'test') === false);
    const [a, b] = await Promise.all([isiSahiplen('test-gunluk', '2026-10-11', 'x'), isiSahiplen('test-gunluk', '2026-10-11', 'y')]);
    t('★ yeni dönemde aynı anda iki çağrı: yalnız biri çalışır', (a ? 1 : 0) + (b ? 1 : 0) === 1, { a, b });
    await isiBitir('test-gunluk', 'HATA', 'deneme');
    await p.zamanlanmisIs.update({ where: { anahtar: 'test-gunluk' }, data: { basladiAt: new Date(Date.now() - 5 * 3_600_000) } });
    t('★ mesaj gönderen iş hata sonrası aynı dönemde TEKRARLANMAZ', await isiSahiplen('test-gunluk', '2026-10-11', 'test') === false);

    await p.zamanlanmisIs.upsert({ where: { anahtar: 'faturalar' }, update: { donem: '2099-01', durum: 'HATA', basladiAt: new Date(Date.now() - 2 * 3_600_000) }, create: { anahtar: 'faturalar', donem: '2099-01', durum: 'HATA', basladiAt: new Date(Date.now() - 2 * 3_600_000) } });
    t('fatura (tekrarı zararsız) hata + 1 saat sonra yeniden denenir', await isiSahiplen('faturalar', '2099-01', 'test') === true);
    t('yeniden denenen şu an çalışıyorsa ikinci çağrı beklemez', await isiSahiplen('faturalar', '2099-01', 'test') === false);
    await p.zamanlanmisIs.update({ where: { anahtar: 'faturalar' }, data: { basladiAt: new Date(Date.now() - 4 * 3_600_000) } });
    t('yarıda kalan (3 saattir "çalışıyor") fatura işi devralınır', await isiSahiplen('faturalar', '2099-01', 'test') === true);
    await isiBitir('faturalar', 'TAMAM');
    t('tamamlanan dönem bir daha çalışmaz', await isiSahiplen('faturalar', '2099-01', 'test') === false);

    let calisti = 0;
    const is1 = async () => { calisti++; return new Response('{"ok":true}', { status: 200 }); };
    const r1 = await tekSeferlik(new Request('http://x/api/cron/test', { headers: { 'x-zamanlayici': '1' } }), 'test-tek', 'gunluk', is1);
    const r2 = await (await tekSeferlik(new Request('http://x/api/cron/test'), 'test-tek', 'gunluk', is1)).json();
    t('★ uç sarmalayıcı: ikinci çağrı "atlandı" döner, iş bir kez çalıştı', r1.status === 200 && r2.atlandi === true && calisti === 1, { r2, calisti });
    const kayitSatiri = await p.zamanlanmisIs.findUnique({ where: { anahtar: 'test-tek' } });
    t('çalışma kaydı: tamam, kaynak zamanlayıcı', kayitSatiri?.durum === 'TAMAM' && kayitSatiri?.kaynak === 'zamanlayici' && kayitSatiri?.bittiAt !== null, kayitSatiri);
    await tekSeferlik(new Request('http://x/api/cron/test?zorla=1'), 'test-tek', 'gunluk', is1);
    t('?zorla=1 elle yeniden çalıştırır', calisti === 2);

    // Bütün işler bu dönem yapılmışsa zamanlayıcı hiçbir şeye dokunmaz.
    const simdi = new Date();
    for (const i of ISLER) {
      const v = { donem: donemi(i.tur, simdi), durum: 'TAMAM', basladiAt: simdi };
      await p.zamanlanmisIs.upsert({ where: { anahtar: i.anahtar }, update: v, create: { anahtar: i.anahtar, ...v } });
    }
    t('★ bu dönem yapılmış işler: zamanlayıcı turu hiçbir şey çalıştırmıyor', (await zam.turAt(simdi)).length === 0);
    // Dünden kalmış hatırlatma: sabah 09:00'dan sonra sıradaki turda çalışır.
    process.env.PORT = '9'; // uç çağrısı kapalı porta gider: gerçek bir şey tetiklenmez
    await p.zamanlanmisIs.update({ where: { anahtar: 'hatirlatma' }, data: { donem: '2000-01-01' } });
    const saat10 = new Date(`${donemi('gunluk', simdi)}T07:00:00Z`); // İstanbul 10:00
    const calisan = await zam.turAt(saat10);
    t('★ dönemi geçmiş hatırlatma vakti gelince sıraya giriyor', calisan.includes('hatirlatma') && !calisan.includes('demo'), calisan);
  } finally {
    await p.zamanlanmisIs.deleteMany({});
    for (const y of yedek) await p.zamanlanmisIs.create({ data: y });
  }

  console.log('\nKendi kendine kayıt (veritabanı)\n');
  const { kayitAc, KAYIT_NOTU } = kayit;
  await temizle();
  let ayar = await p.platformSettings.findFirst();
  if (!ayar) ayar = await p.platformSettings.create({ data: {} });
  const eskiAcik = ayar.kayitAcik;
  try {
    await p.platformSettings.update({ where: { id: ayar.id }, data: { kayitAcik: true } });
    const veri = (n, ek = {}) => kayitDogrula({ ...tam, eposta: TEST_EPOSTA(n), firma: 'Kayıt Testi Firma', ...ek }).veri;
    const s1 = await kayitAc(veri(1), '10.0.0.1');
    t('hesap açıldı', s1.durum === 'TAMAM', s1);
    const b1 = await p.tenant.findUnique({ where: { id: s1.tenantId }, include: { users: true } });
    const gun = (b1.trialEndsAt - Date.now()) / 86_400_000;
    t('★ deneme paketi: 14 gün, 2 kullanıcı, il yazıldı, not işaretli', b1.plan === 'trial' && gun > (ayar.defaultTrialDays ?? 14) - 1 && gun <= (ayar.defaultTrialDays ?? 14)
      && b1.maxUsers === 2 && b1.city === 'Van' && b1.adminNotes.startsWith(KAYIT_NOTU) && b1.demo === false, { plan: b1.plan, gun, maxUsers: b1.maxUsers, city: b1.city });
    t('★ denemede BÜTÜN özellikler açık', mod.ALL_MODULE_KEYS.every((k) => mod.effectiveModules(b1).has(k)));
    const u1 = b1.users[0];
    t('yönetici kullanıcı: seçilen şifre (geçici değil), e-posta küçük harf', b1.users.length === 1 && u1.role === 'ADMIN' && u1.email === TEST_EPOSTA(1) && await bcrypt.compare('gizli-sifre-1', u1.passwordHash), { rol: u1.role, eposta: u1.email });
    const lead = await p.lead.findFirst({ where: { eposta: TEST_EPOSTA(1) } });
    t('★ satış ekibi görsün: Talepler ekranında (kaynak "kayit")', lead?.kaynak === 'kayit' && lead?.telefon === '05321112233' && /deneme hesabı/.test(lead?.mesaj ?? ''), lead);
    const denetim = await p.auditLog.findFirst({ where: { tenantId: s1.tenantId, action: 'KENDI_KAYDI' } });
    t('denetim kaydı IP ile', denetim?.ipAddress === '10.0.0.1');

    t('★ aynı e-posta (büyük harfle) ikinci hesap açmıyor', (await kayitAc(kayitDogrula({ ...tam, eposta: TEST_EPOSTA(1).toUpperCase() }).veri, null)).durum === 'EPOSTA_VAR');
    const bt = await p.tenant.create({ data: { name: 'Büyük Harf Testi', slug: `kayit-testi-buyuk-${Date.now()}`, users: { create: { email: 'Kayit.Testi.Buyuk@Ornek.local', passwordHash: 'x', name: 'B', role: 'ADMIN' } } } });
    t('veritabanındaki büyük harfli adres de "var" sayılıyor', (await kayitAc(kayitDogrula({ ...tam, eposta: 'kayit.testi.buyuk@ornek.local' }).veri, null)).durum === 'EPOSTA_VAR');
    await p.tenant.delete({ where: { id: bt.id } });

    const s2 = await kayitAc(veri(2), null);
    const b2 = await p.tenant.findUnique({ where: { id: s2.tenantId } });
    t('aynı firma adı: slug çakışmıyor', s2.durum === 'TAMAM' && b2.slug !== b1.slug && b2.slug.startsWith(b1.slug), { s1: b1.slug, s2: b2.slug });

    const s5 = await kayitAc(veri(5, { firma: 'Demo' }), null);
    const b5 = await p.tenant.findUnique({ where: { id: s5.tenantId } });
    t('★ "Demo" adlı firma demo adını ALMIYOR (gece tazelemesi silmesin)', s5.durum === 'TAMAM' && !/^demo(-|$)/.test(b5.slug) && b5.demo === false, b5?.slug);

    const [e1, e2] = await Promise.all([kayitAc(veri(3), null), kayitAc(veri(3), null)]);
    t('★ aynı e-posta aynı anda iki kez: tek hesap', [e1.durum, e2.durum].sort().join() === 'EPOSTA_VAR,TAMAM'
      && (await p.user.count({ where: { email: TEST_EPOSTA(3) } })) === 1, [e1.durum, e2.durum]);

    const etk = kayit.etkinlikBul('pantum', Date.parse('2026-10-17T10:00:00+03:00'));
    const s7 = await kayitAc(veri(7), '10.0.0.7', etk);
    const b7 = await p.tenant.findUnique({ where: { id: s7.tenantId } });
    const l7 = await p.lead.findFirst({ where: { eposta: TEST_EPOSTA(7) } });
    const gun7 = (b7.trialEndsAt - Date.now()) / 86_400_000;
    t('★ toplantıdan açılan hesap: 30 gün deneme, 5 kullanıcı', gun7 > 29 && gun7 <= 30 && b7.maxUsers === 5, { gun7, maxUsers: b7.maxUsers });
    t('★ canlı sayaç toplantıdan açılan hesabı sayıyor', (await kayit.etkinlikHesapSayisi(etk, Date.now() + 60_000)) >= 1);
    t('★ etkinlik kaydı sahibine tek tek e-posta atmıyor (Gmail sınırı şifre sıfırlamaya kalsın)', /\{ sessiz: Boolean\(etk\) \}/.test(oku('src/lib/kayit.ts')));
    t('★ etkinlik kodlu kayıt: bayi notunda ve talepte etkinlik adı', s7.durum === 'TAMAM' && b7.adminNotes.includes(etk.ad)
      && l7?.kaynak === 'pantum' && l7?.kampanya === etk.ad, { not: b7?.adminNotes, kaynak: l7?.kaynak });

    await kayit.sinirdaTalep(veri(8), etk);
    const l8 = await p.lead.findFirst({ where: { eposta: TEST_EPOSTA(8) } });
    t('★ sınıra takılan kayıt kaybolmuyor: talep düşüyor, hesap açılmıyor, şifre yazılmıyor', !!l8 && l8.kaynak === 'pantum' && /otomatik açılmadı/.test(l8.mesaj ?? '')
      && !JSON.stringify(l8).includes('gizli-sifre-1') && (await p.user.count({ where: { email: TEST_EPOSTA(8) } })) === 0, l8);
    await kayit.sinirdaTalep(veri(9), null);
    t('etkinliksiz sınır talebi "kayit" kaynağıyla', (await p.lead.findFirst({ where: { eposta: TEST_EPOSTA(9) } }))?.kaynak === 'kayit');

    await p.platformSettings.update({ where: { id: ayar.id }, data: { kayitAcik: false } });
    t('★ süper admin kapattıysa hesap açılmıyor', (await kayitAc(veri(4), null)).durum === 'KAPALI' && (await p.user.count({ where: { email: TEST_EPOSTA(4) } })) === 0);
  } finally {
    await p.platformSettings.update({ where: { id: ayar.id }, data: { kayitAcik: eskiAcik } }).catch(() => {});
    await temizle();
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const istek = async (yol, ek = {}) => {
  try { return await fetch(SUNUCU + yol, { redirect: 'manual', signal: AbortSignal.timeout(60000), ...ek }); } catch { return null; }
};
// Her koşu kendi IP'siyle: sunucunun hız sınırı (IP başına 10 dakikada 5 deneme)
// bellekte; test iki kez arka arkaya koşunca aynı IP'nin denemeleri birikip
// "hesap açıldı" 429'a düşüyordu. Sınırın kendisi ayrı testte sınanıyor.
const kosuIp = `10.${(process.pid % 200) + 20}.${Math.floor(Date.now() / 1000) % 250}.${Math.floor(Math.random() * 250) + 1}`;
const json = (govde, cerez) => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': kosuIp, ...(cerez ? { cookie: cerez } : {}) }, body: JSON.stringify(govde) });
async function girisYap(eposta, sifre) {
  const c = await fetch(`${SUNUCU}/api/auth/csrf`);
  const csrfCerez = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const g2 = await fetch(`${SUNUCU}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
    body: new URLSearchParams({ email: eposta, password: sifre, csrfToken, redirect: 'false', json: 'true' }), redirect: 'manual',
  });
  const cerezler = [csrfCerez, ...(g2.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0])];
  const oturum = cerezler.some((x) => /session-token=/.test(x));
  return oturum ? cerezler.join('; ') : null;
}

const durumIstegi = await istek('/api/kayit');
if (!durumIstegi) {
  console.log('\n  ⊘ HTTP kısmı atlandı: sunucu kapalı');
} else {
  console.log('\nSunucu\n');
  const dj = await durumIstegi.json().catch(() => ({}));
  t('GET /api/kayit: açık ve WhatsApp numarası', durumIstegi.status === 200 && typeof dj.acik === 'boolean' && /^\d{10,15}$/.test(dj.whatsapp ?? ''), dj);
  const kisa = await istek('/demo');
  t('kısa adres /demo herkese açık demoya gidiyor', [307, 308].includes(kisa?.status) && kisa?.headers.get('location')?.endsWith('/login?demo=1'), { status: kisa?.status, yer: kisa?.headers.get('location') });
  const sayfa = await istek('/kayit');
  t('/kayit oturumsuz açılıyor', sayfa?.status === 200 && /14 gün ücretsiz deneyin/.test(await sayfa.text()), sayfa?.status);
  const kotu = await istek('/api/kayit', json({ ...tam, eposta: TEST_EPOSTA(5), telefon: '0212 555 55 55' }));
  t('geçersiz telefon: 400 ve hata kodu', kotu?.status === 400 && (await kotu.json()).kod === 'KAYIT_TELEFON_GECERSIZ');
  const bal = await istek('/api/kayit', json({ ...tam, eposta: TEST_EPOSTA(5), web_sitesi: 'http://spam' }));
  t('bal küpü: "tamam" der ama hesap açmaz', bal?.status === 200 && (await p.user.count({ where: { email: TEST_EPOSTA(5) } })) === 0);
  const ek = await (await istek('/api/kayit?k=pantum'))?.json().catch(() => ({}));
  t('GET /api/kayit?k=pantum etkinlik adını veriyor (sayfadaki rozet)', ek?.etkinlik === 'Pantum Premium Partners Meeting 2026', ek);
  t('★ GET /api/kayit?k=pantum deneme süresi, kullanıcı ve gerçek sayaç', ek?.denemeGun === 30 && ek?.kullanici === 5 && typeof ek?.hesap === 'number', ek);
  // Salon Wi-Fi'ında JS geç yüklenir: ilk HTML "14 gün" deyip sonra "30 gün"e dönmesin.
  const qrSayfa = await (await istek('/kayit?k=pantum'))?.text() ?? '';
  t('★ /kayit?k=pantum ilk HTML\'de 30 gün, rozet ve sekme başlığı', /<h1[^>]*>30 gün ücretsiz deneyin<\/h1>/.test(qrSayfa) && qrSayfa.includes('Pantum Premium Partners Meeting 2026') && /<title>30 gün ücretsiz deneyin/.test(qrSayfa), qrSayfa.match(/<title>[^<]*<\/title>/)?.[0]);
  const yanlisKod = await (await istek('/kayit?k=yok'))?.text() ?? '';
  t('bilinmeyen kod sıradan kayıt (14 gün)', /<title>14 gün ücretsiz deneyin/.test(yanlisKod) && !yanlisKod.includes('Pantum'));
  const ps = await istek('/pantum');
  t('/pantum oturumsuz açılıyor', ps?.status === 200 && /Pantum Premium Partners Meeting 2026/.test(await ps.text()), ps?.status);
  if (yerel && dj.acik) {
    try {
      const iyi = await istek('/api/kayit', json({ ...tam, eposta: TEST_EPOSTA(6), sifre: 'yeni-hesap-1' }));
      t('★ HTTP: hesap açıldı', iyi?.status === 200 && (await iyi.json()).eposta === TEST_EPOSTA(6), iyi?.status);
      const cerez = await girisYap(TEST_EPOSTA(6), 'yeni-hesap-1');
      t('★ açılan hesapla seçilen şifre giriş yapıyor', !!cerez);
      const ob = cerez ? await (await istek('/api/onboarding/status', { headers: { cookie: cerez } })).json() : null;
      t('ilk girişte başlangıç rehberi açılacak', ob?.onboarded === false, ob);
      if (cerez) {
        // Gerçek (deneme) bayi pazarda demo komşularının ilanlarını görmemeli.
        const pz = await (await istek('/api/market/listings', { headers: { cookie: cerez } })).json().catch(() => ({}));
        const ilanlar = await p.marketListing.findMany({ where: { id: { in: (pz.listings ?? []).map((l) => l.id) } }, select: { sellerTenantId: true } });
        const demoSatici = await p.tenant.count({ where: { id: { in: ilanlar.map((l) => l.sellerTenantId) }, demo: true } });
        t('★ gerçek bayi pazarda demo ilanı görmüyor', Array.isArray(pz.listings) && demoSatici === 0, { ilan: pz.listings?.length, demoSatici });
        const demoSaticilar = await p.tenant.findMany({ where: { demo: true, marketEnabled: true }, select: { id: true } });
        const demoIlan = await p.marketListing.findFirst({ where: { status: 'ACTIVE', sellerTenantId: { in: demoSaticilar.map((d) => d.id) } } });
        if (demoIlan) {
          const sip = await istek('/api/market/orders', json({ listingId: demoIlan.id, quantity: 1 }, cerez));
          t('★ gerçek bayi demo satıcıya sipariş veremiyor', sip?.status === 400, sip?.status);
          const ay = await istek(`/api/market/listings/${demoIlan.id}`, { headers: { cookie: cerez } });
          t('demo ilanının ayrıntısı gerçek bayiye 404', ay?.status === 404, ay?.status);
        }
        const sil = await istek('/api/customers/olmayan-musteri', { method: 'DELETE', headers: { cookie: cerez } });
        t('gerçek bayinin silme isteği demo kuralına takılmıyor', sil?.status !== 403 || (await sil.json()).kod !== 'DEMO_KAPALI', sil?.status);
      }

      // Salon: aynı IP'den 3 hesap açılır, 4.'sü TALEBE döner; etkinlik koduyla devam eder.
      const ip = `10.${(Date.now() >> 8) % 250}.${Date.now() % 250}.${7 + (process.pid % 200)}`;
      const ipli = (govde) => ({ ...json(govde), headers: { 'content-type': 'application/json', 'x-real-ip': ip } });
      const sonuclar = [];
      for (const n of [10, 11, 12]) sonuclar.push((await istek('/api/kayit', ipli({ ...tam, eposta: TEST_EPOSTA(n) })))?.status);
      const dorduncu = await istek('/api/kayit', ipli({ ...tam, eposta: TEST_EPOSTA(13) }));
      const dj4 = await dorduncu?.json().catch(() => ({}));
      t('★ aynı IP\'den 4. kayıt hata değil: talep alındı (202), hesap açılmadı', sonuclar.every((s) => s === 200) && dorduncu?.status === 202 && dj4?.talep === true
        && (await p.user.count({ where: { email: TEST_EPOSTA(13) } })) === 0 && !!(await p.lead.findFirst({ where: { eposta: TEST_EPOSTA(13), mesaj: { contains: 'otomatik açılmadı' } } })),
        { sonuclar, dorduncu: dorduncu?.status, dj4 });
      await p.lead.deleteMany({ where: { eposta: TEST_EPOSTA(13) } });
      const kodlu = await istek('/api/kayit', ipli({ ...tam, eposta: TEST_EPOSTA(13), kod: 'pantum' }));
      t('★ aynı IP, etkinlik koduyla: hesap açılıyor', kodlu?.status === 200, kodlu?.status);
    } finally { await temizle(); }
  }

  const demo = yerel ? await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, include: { users: true } }) : null;
  if (!demo || !girisEposta) {
    console.log('  ⊘ demo koruması atlandı: herkese açık demo yerelde kurulu değil (node scripts/seed-bayi-demo.mjs)');
  } else {
    const cerez = await girisYap(girisEposta, girisSifre);
    t('★ herkese açık demo giriş sayfasındaki bilgilerle açılıyor', !!cerez);
    if (cerez) {
      const hedef = demo.users.find((u) => u.email === girisEposta);
      const kodu = async (r) => (r ? (await r.json().catch(() => ({}))).kod : null);
      const s1 = await istek(`/api/users/${hedef.id}`, { ...json({ password: 'degistirildi-1' }, cerez), method: 'PATCH' });
      t('★ demoda şifre değişmiyor', s1?.status === 403 && ['DEMO_HESABINDA_KAPALI', 'DEMO_KAPALI'].includes(await kodu(s1)), s1?.status);
      const s2 = await istek('/api/auth/2fa', json({ action: 'setup' }, cerez));
      t('★ demoda 2FA açılmıyor', s2?.status === 403);
      const s3 = await istek('/api/sayac/tarayici/ayar', json({}, cerez));
      t('★ demoda tarayıcı anahtarı üretilmiyor (ücretsiz taramaya yönlendiriyor)', s3?.status === 403 && await kodu(s3) === 'DEMO_TARAYICI_KAPALI', s3?.status);
      const s4 = await istek('/api/sms/bulk', json({ customerIds: [], message: 'x' }, cerez));
      t('demoda toplu SMS kapalı', s4?.status === 403);
      const s5 = await istek(`/api/users/${hedef.id}`, { ...json({ name: 'Ad Değişebilir' }, cerez), method: 'PATCH' });
      t('★ demoda kullanıcı adı da değişmiyor (herkesin ekranında görünür)', s5?.status === 403 && await kodu(s5) === 'DEMO_KAPALI', s5?.status);
      await p.user.update({ where: { id: hedef.id }, data: { name: hedef.name } });
      const musteri = await p.customer.findFirst({ where: { tenantId: demo.id }, select: { id: true } });
      const s6 = await istek(`/api/customers/${musteri.id}`, { method: 'DELETE', headers: { cookie: cerez } });
      t('★ demoda müşteri silinmiyor', s6?.status === 403 && await kodu(s6) === 'DEMO_KAPALI' && !!(await p.customer.findUnique({ where: { id: musteri.id } })), s6?.status);
      const s7 = await istek('/api/settings', { ...json({ name: 'Bozuk Ad' }, cerez), method: 'PUT' });
      t('★ demoda firma ayarları değişmiyor', s7?.status === 403 && (await p.tenant.findUnique({ where: { id: demo.id } })).name === demo.name, s7?.status);
      const pz = await (await istek('/api/market/listings', { headers: { cookie: cerez } })).json().catch(() => ({}));
      const ilanlar = await p.marketListing.findMany({ where: { id: { in: (pz.listings ?? []).map((l) => l.id) } }, select: { sellerTenantId: true } });
      const gercek = await p.tenant.count({ where: { id: { in: ilanlar.map((l) => l.sellerTenantId) }, demo: false } });
      t('★ demo ziyaretçisi pazarda yalnız demo satıcıları görüyor', (pz.listings?.length ?? 0) > 0 && gercek === 0, { ilan: pz.listings?.length, gercek });
      t('şifre gerçekten değişmedi', await bcrypt.compare(girisSifre, (await p.user.findUnique({ where: { id: hedef.id } })).passwordHash));
    }
  }
  t('cron ucu hâlâ yetkisiz isteğe kapalı', (await istek('/api/cron/overdue-reminders'))?.status === 401);
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
