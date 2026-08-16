/**
 * GERÇEK cihaz e-postasını ayrıştırıcıya sok, ne okuduğunu göster.
 *
 * Ayrıştırıcı kurulurken elimizde gerçek Canon/Konica çıktısı yoktu; kendi
 * kurduğumuz örneklerle yazıldı. Sahadan ilk gerçek rapor geldiğinde ÖNCE
 * buradan geçirilir — üretime gönderip "acaba işledi mi" diye ekrana bakmak
 * yerine, tam olarak hangi sayıyı nereden okuduğu görülür.
 *
 * Kullanım:
 *   node scripts/ornek-eposta-dene.mjs ornek.txt
 *   node scripts/ornek-eposta-dene.mjs ornek.txt SERI1 SERI2   (bilinen seriler)
 *
 * Seri verilmezse metinden aday seriler tahmin edilir; o hâlde "seri eşleşmedi"
 * demesi normaldir, asıl bakılacak şey SAYAÇLARIN doğru okunup okunmadığı.
 */
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dosya = process.argv[2];
if (!dosya) { console.error('Kullanım: node scripts/ornek-eposta-dene.mjs <dosya> [seri...]'); process.exit(1); }
const seriler = process.argv.slice(3);
const ham = readFileSync(dosya, 'utf8');

const g = mkdtempSync(join(tmpdir(), 'ornek-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/lib/counter-email.ts',
  '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'], { stdio: 'pipe' });
const mod = await import(pathToFileURL(join(g, 'counter-email.js')).href);
const { htmlToText, parseCounters, parseCounterEmail, parseCounterEmailCoklu } = mod;

const duz = htmlToText(ham);
console.log('\n═══ 1. HTML→METİN sonrası ═══');
console.log(duz.slice(0, 900).split('\n').map((s) => '  │ ' + s).join('\n'));
if (duz.length > 900) console.log(`  │ … (${duz.length} karakterin ilk 900'ü)`);

console.log('\n═══ 2. SAYAÇ OKUMA (tek cihaz mantığı) ═══');
const c = parseCounters(duz);
console.log('  siyah :', c.black ?? '(OKUNAMADI)', c.blackLabel ? `← "${c.blackLabel}" etiketinden` : '');
console.log('  renkli:', c.color ?? '(yok)', c.colorLabel ? `← "${c.colorLabel}" etiketinden` : '');

// Seri verilmediyse metinden aday çıkar: harf+rakam karışık, 6-20 karakter.
const adaylar = seriler.length ? seriler
  : [...new Set((duz.match(/\b(?=[A-Z0-9-]{6,20}\b)(?=[^\s]*\d)(?=[^\s]*[A-Z])[A-Z0-9-]+\b/g) ?? []))].slice(0, 12);
console.log('\n═══ 3. SERİ ADAYLARI ═══');
console.log(seriler.length ? '  (elle verildi) ' + adaylar.join(', ')
  : '  (metinden tahmin) ' + (adaylar.join(', ') || '(bulunamadı)'));

console.log('\n═══ 4. ÇOK CİHAZLI AYRIŞTIRMA ═══');
const ck = parseCounterEmailCoklu(ham, adaylar, '');
console.log('  yerleşim :', ck.yerlesim, '· cihaz sayısı:', ck.cihazSayisi, '· seri bulunamadı mı:', ck.seriYok);
for (const o of ck.okumalar) {
  console.log(`  ${o.guvenli ? '✓' : '✗'} ${o.serial.padEnd(20)} siyah=${o.black ?? '-'} renkli=${o.color ?? '-'}` +
    (o.sebep ? `  (${o.sebep})` : ''));
}

console.log('\n═══ 5. TEK CİHAZ AYRIŞTIRMA ═══');
const tek = parseCounterEmail(duz, adaylar, '');
console.log(`  ${tek.guvenli ? '✓ güvenli' : '✗ güvenli değil'} · seri=${tek.serial ?? '-'} siyah=${tek.black ?? '-'} renkli=${tek.color ?? '-'}` +
  (tek.sebep ? ` (${tek.sebep})` : ''));

console.log('\n═══ KARAR ═══');
if (ck.okumalar.some((o) => o.guvenli) || tek.guvenli) {
  console.log('  Bu biçim OKUNUYOR. Gerçek serilerle üretimde de işlenir.');
} else if (c.black !== null) {
  console.log('  Sayaç okunuyor ama SERİ eşleşmedi. Cihaz sistemde kayıtlıysa üretimde sorun olmaz;');
  console.log('  değilse cihazı ekle. (Bu testte seriler tahmin edildiği için normal olabilir.)');
} else {
  console.log('  SAYAÇ OKUNAMIYOR — ayrıştırıcı bu biçimi tanımıyor, kelime listesi genişletilmeli.');
  console.log('  Yukarıdaki 1. bölüme bak: sayaçlar hangi etiketle geliyor?');
}
rmSync(g, { recursive: true, force: true });
