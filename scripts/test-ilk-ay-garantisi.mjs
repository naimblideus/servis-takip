// İLK AY GARANTİSİ — iade hakkı
// Çalıştır:  node scripts/test-ilk-ay-garantisi.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Tanıtım sayfası bir PARA sözü veriyor. Söz ile kod ayrışırsa ya hak
// kazanan bayiye "şartı sağlamadınız" denir ya da sistemi hiç açmamış bayiye
// iade yapılır. Kilitli olanlar: hangi paket kapsamda, şart hangi dönemde
// ölçülür, dönem bitmeden hüküm verilmez — ve sayfadaki metin kodla aynı.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-ilkay-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/ilk-ay-garantisi.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'ilk-ay-garantisi.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { garantiDurumu, donemAraligi, GARANTILI_PAKETLER } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const okuma = (n = 5, cihaz = 3, kiralik = 10) => ({ okumaSayisi: n, okunanCihaz: cihaz, kiralikCihaz: kiralik });
const an = (y, a, gun) => new Date(Date.UTC(y, a - 1, gun, 12));

console.log('\nİlk ay garantisi\n');

t('dönem aralığı ayın ilk gününden sonrakinin ilk gününe', (() => { const a = donemAraligi('2026-09'); return a.bas.toISOString().startsWith('2026-09-01') && a.bit.toISOString().startsWith('2026-10-01'); })());
t('aralık yılı aşıyor (Aralık → Ocak)', donemAraligi('2026-12').bit.toISOString().startsWith('2027-01-01'));
t('biçimsiz dönem', donemAraligi('2026-13') === null && donemAraligi('eylül') === null);

t('★ Başlangıç kapsam dışı (sözde yalnız Profesyonel ve Kurumsal)', garantiDurumu({ plan: 'starter', ilkOdenenDonem: '2026-09', okuma: okuma(), simdi: an(2026, 11, 1) }).durum === 'KAPSAM_DISI');
t('deneme kapsam dışı', garantiDurumu({ plan: 'trial', ilkOdenenDonem: null, okuma: okuma(), simdi: an(2026, 9, 1) }).durum === 'KAPSAM_DISI');
t('ödenmiş fatura yoksa hak yok', garantiDurumu({ plan: 'professional', ilkOdenenDonem: null, okuma: okuma(), simdi: an(2026, 9, 1) }).durum === 'ODEME_YOK');

{
  const g2 = garantiDurumu({ plan: 'professional', ilkOdenenDonem: '2026-09', okuma: okuma(0, 0), simdi: an(2026, 9, 29) });
  t('★ dönem bitmeden hüküm verilmez (ayın son günü okutabilir)', g2.durum === 'SURUYOR', g2);
}
{
  const g2 = garantiDurumu({ plan: 'professional', ilkOdenenDonem: '2026-09', okuma: okuma(12, 8), simdi: an(2026, 10, 2) });
  t('★ o ay sayaç okutan bayi iade talep edebilir', g2.durum === 'HAK_VAR' && g2.okunanCihaz === 8, g2);
}
{
  const g2 = garantiDurumu({ plan: 'enterprise', ilkOdenenDonem: '2026-09', okuma: okuma(0, 0), simdi: an(2026, 10, 2) });
  t('★ sistemi hiç kullanmayan bayinin iade hakkı yok', g2.durum === 'HAK_YOK', g2);
}
t('dönem bitişi tam sınırda: 1 Ekim 00:00 artık hüküm anı',
  garantiDurumu({ plan: 'professional', ilkOdenenDonem: '2026-09', okuma: okuma(1), simdi: new Date(Date.UTC(2026, 9, 1)) }).durum === 'HAK_VAR');

// ── SÖZ İLE KOD AYNI ─────────────────────────────────────────────────────
{
  const html = readFileSync(join(KOK, 'marketing/landing/nextus-servis.html'), 'utf8');
  t('★ sayfada söz verilen paketler kodla aynı (Profesyonel ve Kurumsal)',
    /Profesyonel ve Kurumsal paketlerde geçerlidir/.test(html) && JSON.stringify([...GARANTILI_PAKETLER].sort()) === JSON.stringify(['enterprise', 'professional']));
  t('sayfadaki şart kodun ölçtüğü şart (o ay sayaç okunmuş olmalı)', /o ay sayaçlarınızın sistemde okunmuş olması/.test(html));
  const uc = readFileSync(join(KOK, 'src/app/api/super-admin/tenants/[id]/stats/route.ts'), 'utf8');
  t('★ süper admin ekranı hakkı veriden görüyor', /garantiDurumu\(/.test(uc) && /status: 'paid'/.test(uc) && /orderBy: \{ period: 'asc' \}/.test(uc));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
