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
const KAYNAKLAR = ['kayit', 'zamanlanmis-is', 'zamanlayici', 'tenant-manager', 'talep', 'sahip-bildirim', 'audit', 'iller', 'modules', 'demo-koruma'];
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

const tohum = oku('scripts/seed-bayi-demo.mjs');
const demoModuller = (tohum.match(/modules: \[([^\]]+)\]/)?.[1] ?? '').match(/'([A-Z_]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
t('★ demo bayisinde BÜTÜN modüller açık (yeni modül eklenince bu test hatırlatır)', mod.ALL_MODULE_KEYS.every((k) => demoModuller.includes(k)), { eksik: mod.ALL_MODULE_KEYS.filter((k) => !demoModuller.includes(k)) });
t('demo bayileri demo bayrağıyla kuruluyor', /demo: true,/.test(tohum));
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
  const eposta = { in: [1, 2, 3, 4, 5, 6].map(TEST_EPOSTA) };
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
const json = (govde, cerez) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...(cerez ? { cookie: cerez } : {}) }, body: JSON.stringify(govde) });
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
  if (yerel && dj.acik) {
    try {
      const iyi = await istek('/api/kayit', json({ ...tam, eposta: TEST_EPOSTA(6), sifre: 'yeni-hesap-1' }));
      t('★ HTTP: hesap açıldı', iyi?.status === 200 && (await iyi.json()).eposta === TEST_EPOSTA(6), iyi?.status);
      const cerez = await girisYap(TEST_EPOSTA(6), 'yeni-hesap-1');
      t('★ açılan hesapla seçilen şifre giriş yapıyor', !!cerez);
      const ob = cerez ? await (await istek('/api/onboarding/status', { headers: { cookie: cerez } })).json() : null;
      t('ilk girişte başlangıç rehberi açılacak', ob?.onboarded === false, ob);
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
      t('★ demoda şifre değişmiyor', s1?.status === 403 && await kodu(s1) === 'DEMO_HESABINDA_KAPALI', s1?.status);
      const s2 = await istek('/api/auth/2fa', json({ action: 'setup' }, cerez));
      t('★ demoda 2FA açılmıyor', s2?.status === 403);
      const s3 = await istek('/api/sayac/tarayici/ayar', json({}, cerez));
      t('★ demoda tarayıcı anahtarı üretilmiyor (ücretsiz taramaya yönlendiriyor)', s3?.status === 403 && await kodu(s3) === 'DEMO_TARAYICI_KAPALI', s3?.status);
      const s4 = await istek('/api/sms/bulk', json({ customerIds: [], message: 'x' }, cerez));
      t('demoda toplu SMS kapalı', s4?.status === 403);
      const s5 = await istek(`/api/users/${hedef.id}`, { ...json({ name: 'Ad Değişebilir' }, cerez), method: 'PATCH' });
      t('demoda zararsız düzenleme (ad) serbest', s5?.status === 200);
      await p.user.update({ where: { id: hedef.id }, data: { name: hedef.name } });
      t('şifre gerçekten değişmedi', await bcrypt.compare(girisSifre, (await p.user.findUnique({ where: { id: hedef.id } })).passwordHash));
    }
  }
  t('cron ucu hâlâ yetkisiz isteğe kapalı', (await istek('/api/cron/overdue-reminders'))?.status === 401);
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
