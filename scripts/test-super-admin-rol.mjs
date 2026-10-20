// SÜPER ADMİN ROLÜ — sahip ve ekip (lib/super-admin-rol.ts, middleware)
// Çalıştır:  node scripts/test-super-admin-rol.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Ekip hesabı (öğrencilerden oluşan kurulum ve başarı ekibi) bayilerin
// iletişim bilgisini görür ama fatura, paket, ayar, gizli anahtar ve yedekten
// geri yükleme ona kapalı olmalı. Kural izin listesi: yeni bir süper admin
// ekranı eklendiğinde ekibe kendiliğinden AÇILMAMALI. Bu test o kapıyı kilitler.
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

const g = mkdtempSync(join(tmpdir(), 'st-rol-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/super-admin-rol.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const r = await import(pathToFileURL(join(g, 'super-admin-rol.js')).href);
rmSync(g, { recursive: true, force: true });

console.log('\nKural\n');
t('rolü olmayan (eski) jeton sahip sayılır', r.saRol(undefined) === 'SAHIP' && r.saRol('x') === 'SAHIP' && r.saRol('EKIP') === 'EKIP');
for (const y of ['/super-admin/kurulum', '/super-admin/kurulum/abc', '/super-admin/sorunlar', '/super-admin/hesabim', '/api/super-admin/kurulum/abc/not', '/api/super-admin/sorunlar/x/ekran', '/api/super-admin/2fa', '/super-admin/login', '/api/super-admin/login']) {
  t(`ekip açar: ${y}`, r.rolErisebilir('EKIP', y));
}
for (const y of ['/super-admin/dashboard', '/super-admin/tenants', '/super-admin/tenants/abc', '/super-admin/billing', '/super-admin/settings', '/super-admin/ekip', '/super-admin/aktivasyon', '/super-admin/geri-yukle', '/api/super-admin/tenants', '/api/super-admin/settings', '/api/super-admin/ekip', '/api/super-admin/billing', '/super-admin/kurulumx', '/api/super-admin/sorunlarx']) {
  t(`★ ekibe kapalı: ${y}`, !r.rolErisebilir('EKIP', y));
}
t('sahip her yeri açar', ['/super-admin/settings', '/api/super-admin/ekip', '/super-admin/kurulum'].every((y) => r.rolErisebilir('SAHIP', y)));
t('ekibin ana sayfası kendi açabildiği yer', r.rolErisebilir('EKIP', r.EKIP_ANA_SAYFA));

console.log('\nKaynak\n');
const mw = oku('src/middleware.ts');
t('middleware sayfada rolü denetliyor ve ekibi ana sayfasına yolluyor', /rolErisebilir\(saRol\(payload\.rol\), pathname\)\) \{\s*return NextResponse\.redirect\(new URL\(EKIP_ANA_SAYFA/.test(mw));
t('middleware uçta rolü denetliyor (403)', /rolErisebilir\(saRol\(payload\.rol\), pathname\)\) \{\s*return NextResponse\.json\(\{ error: 'Forbidden', kod: 'EKIP_ERISEMEZ' \}, \{ status: 403 \}\)/.test(mw));
t('★ /api/super-admin dışındaki geri yükleme yalnız sahip', /sa\.rol !== 'SAHIP'/.test(oku('src/app/api/backup/restore/route.ts')));
t('★ üretici verisi ucu yalnız sahip', /admin\.rol !== 'SAHIP'/.test(oku('src/app/api/oem/reliability/route.ts')));
const ekip = oku('src/app/api/super-admin/ekip/route.ts');
t('ekip hesapları ucu kendi içinde de sahip istiyor', /sa\.rol !== 'SAHIP'/.test(ekip));
t('kendini kaldıramaz, son sahip korunur', /hata: 'KENDINI'/.test(ekip) && /hata: 'SON_SAHIP'/.test(ekip));
t('şifre bcrypt ile saklanır', /bcrypt\.hash\(sifre, 12\)/.test(ekip));
const auth = oku('src/lib/super-admin-auth.ts');
t('oturum rolü taşıyor', /rol: saRol\(admin\.rol\)/.test(auth) && /rol: saRol\(payload\.rol\)/.test(auth));
// Süper admin oturumunu okuyan, /api/super-admin dışındaki her uç rolü denetlemeli.
{
  const { execSync } = await import('node:child_process');
  let disarda = [];
  try {
    disarda = execSync('git grep -l "getSuperAdminSession" -- src/app/api', { cwd: KOK, encoding: 'utf8' })
      .split('\n').filter(Boolean).filter((f) => !f.startsWith('src/app/api/super-admin/'));
  } catch { /* eşleşme yok */ }
  const eksik = disarda.filter((f) => !/\.rol !== 'SAHIP'/.test(oku(f)));
  t('★ süper admin oturumu kullanan dış uçların hepsi rol denetliyor', eksik.length === 0, eksik);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
