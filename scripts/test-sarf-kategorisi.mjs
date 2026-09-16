// SARF DEĞİŞİMİ ARIZA SAYILMIYOR
// Çalıştır:  node scripts/test-sarf-kategorisi.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Marka/model güvenilirlik raporu satın alma kararını değiştiriyor: "bu model
// çok bozuluyor" cümlesi bayiyi başka markaya götürür. Toner bitip
// değiştirilmesi bir ARIZA DEĞİL, rutin sarf işidir — ama taksonomide karşılığı
// olmadığı için "Toner Sorunu" seçiliyordu ve o kategori arıza sayılıyordu.
// Ölçüldü: demo bayide her modelin en sık "arızası" toner çıkıyordu (56, 33,
// 27...) ve gerçek arızalar (4, 3, 2) altında kayboluyordu.
//
// Test ettiklerim:
//   1. CONSUMABLE ARIZA DEĞİL ve FAILURE_CODES'a girmiyor.
//   2. GERÇEK TONER ARIZASI hâlâ arıza — ikisi karışmıyor.
//   3. METİNDEN KATEGORİ: "toner değişti" sarf, "toner akıtıyor" arıza.
//   4. TEK KAYNAK: dışlama listesi elle yazılmıyor, isFailure'dan türüyor.
import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sarf-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/fault-categories.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

// @prisma/client yalnız TİP için alınıyor; derlenmiş dosyada kalırsa
// test prisma'yı yüklemek zorunda kalır.
{
  const yol = join(g, 'fault-categories.js');
  const metin = (await import('node:fs')).readFileSync(yol, 'utf8');
  writeFileSync(yol, metin.split("from '@prisma/client'").join("from './bos.js'"), 'utf8');
  writeFileSync(join(g, 'bos.js'), 'export {};\n', 'utf8');
}

const { FAULT_CATEGORIES, QUICK_FAULT_CODES, faultCategoryFromLegacyText } =
  await import(pathToFileURL(join(g, 'fault-categories.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const bul = (kod) => FAULT_CATEGORIES.find((c) => c.code === kod);
// reliability.ts ile AYNI türetme — elle yazılmış bir liste olmadığını
// kanıtlamanın yolu aynı ifadeyi burada da kurmak.
const FAILURE_CODES = FAULT_CATEGORIES.filter((c) => c.isFailure).map((c) => c.code);

console.log('\n★ SARF DEĞİŞİMİ ARIZA DEĞİL\n');
{
  const s = bul('CONSUMABLE');
  t('CONSUMABLE kategorisi var', Boolean(s), s);
  t('★ isFailure false', s?.isFailure === false, s);
  t('★ FAILURE_CODES içinde YOK', !FAILURE_CODES.includes('CONSUMABLE'), FAILURE_CODES);
  t('etiketi Türkçe ve anlaşılır', s?.label === 'Sarf Değişimi', s?.label);
  t('★ hızlı seçim listesinde (teknisyen tek dokunuşla geçsin)',
    QUICK_FAULT_CODES.includes('CONSUMABLE'), QUICK_FAULT_CODES);
}

console.log('\n★ GERÇEK TONER ARIZASI HÂLÂ ARIZA\n');
{
  t('★ TONER isFailure true', bul('TONER')?.isFailure === true);
  t('TONER, FAILURE_CODES içinde', FAILURE_CODES.includes('TONER'));
  t('DRUM hâlâ arıza', bul('DRUM')?.isFailure === true);
  t('kağıt sıkışması hâlâ arıza', bul('PAPER_JAM')?.isFailure === true);
}

console.log('\n★ ARIZA SAYILMAYANLAR TAM OLARAK ÜÇÜ\n');
{
  const arizaDegil = FAULT_CATEGORIES.filter((c) => !c.isFailure).map((c) => c.code).sort();
  t('★ üçlü: CONSUMABLE, INSTALLATION, PERIODIC_MAINTENANCE',
    JSON.stringify(arizaDegil) === JSON.stringify(['CONSUMABLE', 'INSTALLATION', 'PERIODIC_MAINTENANCE']),
    arizaDegil);
  t('OTHER arıza sayılıyor (bilinçli seçim)', bul('OTHER')?.isFailure === true);
}

console.log('\n★ METİNDEN KATEGORİ — DEĞİŞİM İLE ARIZA AYRILIYOR\n');
{
  t('★ "S/B toner bitti" → sarf', faultCategoryFromLegacyText('S/B toner bitti') === 'CONSUMABLE',
    faultCategoryFromLegacyText('S/B toner bitti'));
  t('★ "toner değişti" → sarf', faultCategoryFromLegacyText('Toner değişti') === 'CONSUMABLE');
  t('"kartuş takıldı" → sarf', faultCategoryFromLegacyText('Kartuş takıldı') === 'CONSUMABLE');
  t('"drum yenilendi" → sarf', faultCategoryFromLegacyText('Drum yenilendi') === 'CONSUMABLE');
  t('"sarf malzemesi" → sarf', faultCategoryFromLegacyText('Sarf malzemesi verildi') === 'CONSUMABLE');

  t('★ "toner akıtıyor" → ARIZA (sarf değil)',
    faultCategoryFromLegacyText('Toner akıtıyor') === 'TONER',
    faultCategoryFromLegacyText('Toner akıtıyor'));
  t('★ "toner sorunu" → ARIZA', faultCategoryFromLegacyText('Toner sorunu') === 'TONER');
  t('"drum sorunu" → ARIZA', faultCategoryFromLegacyText('Drum sorunu') === 'DRUM');
  t('kağıt sıkışması bozulmadı', faultCategoryFromLegacyText('Kağıt sıkışması var') === 'PAPER_JAM');
  t('periyodik bakım bozulmadı', faultCategoryFromLegacyText('Periyodik bakım yapıldı') === 'PERIODIC_MAINTENANCE');
  t('boş metin null', faultCategoryFromLegacyText('') === null);
  t('eşleşmeyen metin null', faultCategoryFromLegacyText('müşteri aradı') === null);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
