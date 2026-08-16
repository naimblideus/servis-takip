/**
 * GERÇEK CİHAZ BİÇİMLERİ — saha örnekleriyle ayrıştırma testi.
 *
 * scripts/test-counter-email*.mjs kurgusal örneklerle yazılmıştı. Bu dosya
 * SAHADAN gelen gerçek raporları ve onların ortaya çıkardığı tuzakları tutar.
 * Yeni bir marka/model sorun çıkarınca örneği buraya eklenir — bir daha
 * bozulmaz.
 *
 * Çalıştırma: node scripts/test-gercek-cihazlar.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const g = mkdtempSync(join(tmpdir(), 'gercek-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/lib/counter-email.ts',
  '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'], { stdio: 'pipe' });
const { parseCounters } = await import(pathToFileURL(join(g, 'counter-email.js')).href);

let gecti = 0, kaldi = 0;
function t(ad, metin, beklenenSiyah, beklenenRenkli) {
  const c = parseCounters(metin);
  const okS = c.black === beklenenSiyah;
  const okR = beklenenRenkli === undefined || c.color === beklenenRenkli;
  if (okS && okR) { console.log(`  ✓ ${ad}`); gecti++; }
  else {
    console.log(`  ✗ ${ad}`);
    console.log(`      siyah  beklenen ${beklenenSiyah}  gelen ${c.black}  (etiket: ${c.blackLabel ?? '-'})`);
    if (beklenenRenkli !== undefined) console.log(`      renkli beklenen ${beklenenRenkli}  gelen ${c.color}`);
    kaldi++;
  }
}

console.log('\nGerçek cihaz biçimleri\n');

// ── SAHADAN: Kyocera ECOSYS M2540dn (mono) ──────────────────────────────
// Tuzak: en altta "black: 53%" var — bu TONER SEVİYESİ, sayaç değil.
t('Kyocera M2540dn — mono, toner yüzdesi tuzağı', `
Model Name:             ECOSYS M2540dn
Serial Number:          VCG9114481
Counters by Function:
 Printed Pages:
  Copier:               14694
  Printer:              60884
  FAX:                  0
  Total:                75578
 Scanned Pages:
  Total:                36114
Counters by Duplex:
  Total:                75578

<Mon 06 Feb 2023 12:03:54>
  black:                53%
`, 75578);

// ── SAHADAN: Kyocera ECOSYS M3540dn (mono) ──────────────────────────────
// Tuzak: "black:" alanı BOŞ + altında toner olay kayıtları var.
t('Kyocera M3540dn — boş black alanı + olay kayıtları', `
Model Name:             ECOSYS M3540dn
Serial Number:          LSA4404071
Counters by Function:
 Printed Pages:
  Copier:               269931
  Printer:              346315
  FAX:                  135
  Total:                616381
 Scanned Pages:
  Total:                152852
Counters by Duplex:
  Total:                616381

<Fri 27 Feb 2026 09:00:05>
  black:

<Thu 26 Feb 2026 16:08:51>
  [*] Add Toner
`, 616381);

// ── PARA HATASI: renkli cihazda genel toplam siyah sanılırsa ────────────
// Genel toplam 100.000, bunun 70.000'i siyah 30.000'i renkli. Siyah yerine
// 100.000 okunursa renkli sayfalar SİYAH TARİFESİNDEN DE faturalanır.
t('Renkli cihaz — genel toplam siyah sanılmamalı', `
Serial Number: ABC123456
Total Counter:        100000
Black:                 70000
Full Color:            30000
`, 70000, 30000);

// Aynı tuzak Türkçe etiketlerle
t('Renkli cihaz (TR) — toplam yerine siyah okunmalı', `
Seri No: XYZ987654
Toplam:               100000
Siyah:                 70000
Renkli:                30000
`, 70000, 30000);

// ── Yalnız toner bilgisi olan mail: sayaç OKUNMAMALI ────────────────────
// Okursa 53 yazar, bir sonraki gerçek okumada "sayaç geriledi" alarmı çalar.
t('Yalnız toner seviyesi — sayaç okunmamalı', `
Serial Number: TONER0001
  black:                53%
  cyan:                 41%
`, null);

// ── Tarama sayacı yazdırma sanılmamalı ──────────────────────────────────
// Bu cihazda tarama (900.000) yazdırmadan (120.000) BÜYÜK. En büyüğü alan
// mantık taramayı faturalar.
t('Tarama toplamı yazdırma sanılmamalı', `
Serial Number: SCAN0001
Counters by Function:
 Printed Pages:
  Total:                120000
 Scanned Pages:
  Total:                900000
`, 120000);

// ── Konica Minolta tipik biçimi ─────────────────────────────────────────
t('Konica Minolta — Black / Full Color', `
Serial Number: A79J021000123
Total Counter
Black                    145230
Full Color                38472
`, 145230, 38472);

// ── Xerox tipik biçimi ──────────────────────────────────────────────────
t('Xerox — Total Impressions', `
Serial Number: XRX55501
Total Impressions:        88123
Black Impressions:        70000
Color Impressions:        18123
`, 70000, 18123);

// ── Tablo biçimi (cihaz web arayüzü çıktısı) ────────────────────────────
t('Tablo — Function/Total başlıklı', `
Printed Pages
Function\tTotal
Copy\t269931
Printer\t346315
FAX\t135
Total\t616381
`, 616381);

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
