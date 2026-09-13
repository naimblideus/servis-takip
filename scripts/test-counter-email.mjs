// Sayaç e-postası okuyucusunun testi.
// Çalıştır:  node scripts/test-counter-email.mjs
//
// TS'i gerçek derleyiciyle geçici bir klasöre çevirip içe aktarır; ayrı bir
// derleme adımı gerekmez (eskiden gerekiyordu ve unutulduğunda test "modül
// bulunamadı" diye patlıyordu — kod bozukmuş gibi görünüyordu).
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const gecici = mkdtempSync(join(tmpdir(), 'st-counter-test-'));
let parseCounterEmail;
try {
  execFileSync(
    process.execPath,
    [join(kok, 'node_modules/typescript/bin/tsc'), join(kok, 'src/lib/counter-email.ts'),
      '--outDir', gecici, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'],
    { stdio: 'pipe' },
  );
  ({ parseCounterEmail } = await import(pathToFileURL(join(gecici, 'counter-email.js')).href));
} finally {
  rmSync(gecici, { recursive: true, force: true });
}

const SERIALS = ['ABC12345', 'WXY9988', 'KM-4471', 'QRS777'];

const T = [
  ['Canon düz metin',
    'Serial Number: ABC12345\nTotal 1: 145.230\nColor Total: 22,410',
    'ABC12345', 145230, 22410, true],
  ['HTML tablo',
    '<table><tr><td>Seri No</td><td>WXY9988</td></tr><tr><td>Siyah</td><td>98 450</td></tr><tr><td>Renkli</td><td>1200</td></tr></table>',
    'WXY9988', 98450, 1200, true],
  ['tireli seri, boşluklu yazım',
    'Makine: KM 4471 | Mono Counter 5310',
    'KM-4471', 5310, null, true],
  ['sadece siyah cihaz',
    'Serial ABC12345 Black: 4321',
    'ABC12345', 4321, null, true],
  // Seri eşleşmediğinde sayaç okunmuş olabilir; önemli olan İŞLENMEMESİ (guvenli=false).
  ['bilinmeyen seri → işlenmemeli',
    'Serial ZZZ0000 Total: 500',
    null, 500, null, false],
  ['sayaç yok → işlenmemeli',
    'Serial Number ABC12345 aylık raporu ektedir',
    'ABC12345', null, null, false],
  ['aynı anahtar iki kez → EN BÜYÜK (kümülatif) alınmalı',
    'Serial QRS777 Total this month: 1200 Total: 88000',
    'QRS777', 88000, null, true],
  ['9 haneden uzun sayı → sayaç sayılmamalı',
    'Serial ABC12345 Total: 12345678901 Black: 777',
    'ABC12345', 777, null, true],

  // ── TEK SATIR YERLEŞİM ────────────────────────────────────────────────
  // Cihazlar etiketi ve değeri çoğu zaman yan yana basar. Kuyruk sabit 40
  // karakter olduğu sürece öbür sayacın değeri de pencereye giriyor ve
  // "en büyük" kuralı yanlış sayacı seçiyordu: renkli baskısı siyahtan fazla
  // olan müşteride siyah sayaca 40.000 yazılıyordu. Sonucu üç katmanlı —
  // renkli sayfalar siyah tarifesinden faturalanır, gerçek siyah sayaç
  // kaybolur, ertesi ay gerçek okuma gelince "sayaç geriledi" alarmı çalar.
  ['tek satır: renkli değer siyaha yazılmamalı',
    'Serial ABC12345 Black: 5.000   Full Color: 40.000',
    'ABC12345', 5000, 40000, true],
  ['tek satır: ters sırada da karışmamalı',
    'Serial ABC12345 Full Color: 5.000   Black: 40.000',
    'ABC12345', 40000, 5000, true],

  // ── ETİKET TUZAKLARI ──────────────────────────────────────────────────
  ['renkli cihazda "Total" siyah sanılmamalı',
    'Serial ABC12345\nTotal 100000\nBlack 70000\nFull Color 30000',
    'ABC12345', 70000, 30000, true],
  ['toner yüzdesi sayaç değildir',
    'Serial ABC12345 Printed Pages Black: 145230 Toner black: 53%',
    'ABC12345', 145230, null, true],
  ['tarama sayacı faturalanmamalı',
    'Serial ABC12345\nScanned Pages\nTotal: 900000\nPrinted Pages\nTotal: 145230',
    'ABC12345', 145230, null, true],
];

let ok = 0;
for (const [ad, body, eS, eB, eC, eG] of T) {
  const r = parseCounterEmail(body, SERIALS);
  const gecti = r.serial === eS && r.black === eB && r.color === eC && r.guvenli === eG;
  if (gecti) ok++;
  console.log(`${gecti ? 'GECTI' : 'KALDI'}  ${ad}`);
  if (!gecti) {
    console.log(`   alınan  : serial=${r.serial} siyah=${r.black} renkli=${r.color} güvenli=${r.guvenli} (${r.sebep ?? '-'})`);
    console.log(`   beklenen: serial=${eS} siyah=${eB} renkli=${eC} güvenli=${eG}`);
  }
}
// Tek biçim: tüm testler aynı özet satırını basıyor ki koşturucu
// hiçbirini "biçimi farklı" diye atlamasın.
console.log(`\n${ok} geçti, ${T.length - ok} kaldı\n`);
process.exit(ok === T.length ? 0 : 1);
