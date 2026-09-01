/**
 * LOGO ENTEGRASYONU — "sessiz başarı" olmadığını doğrular.
 *
 * NİYE VAR: uygulanmamış aktarım yöntemleri `{success:true}` dönüyordu.
 * Bayi "100 fatura Logo'ya aktarıldı" yazısını görüyor, Logo'da hiçbir şey
 * olmuyordu. Fatura aktarımında sessiz başarı = sessiz para kaybı: ay sonunda
 * mutabakat tutmuyor ve sebebi bulunamıyor.
 *
 * Bu test o yalanın geri gelmediğini garanti eder. Yöntem sonradan gerçekten
 * uygulanırsa test kırılır — o zaman beklenen değer bilerek güncellenir.
 *
 * Çalıştırma: node scripts/test-logo-durustluk.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const g = mkdtempSync(join(tmpdir(), 'logo-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/lib/logo-integration.ts',
  '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'], { stdio: 'pipe' });
const { LogoIntegration } = await import(pathToFileURL(join(g, 'logo-integration.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, ok, ek = '') => {
  if (ok) { console.log(`  ✓ ${ad}`); gecti++; }
  else { console.log(`  ✗ ${ad}${ek ? '\n      ' + ek : ''}`); kaldi++; }
};

console.log('\nLogo entegrasyonu — uygulanmamış yöntem "başarılı" demiyor\n');

for (const yontem of ['file', 'db']) {
  const l = new LogoIntegration({ method: yontem });

  const cari = await l.createOrUpdateCustomer({ id: 'x1', name: 'Test' });
  t(`${yontem}: cari aktarımı BAŞARISIZ döner`, cari.success === false, JSON.stringify(cari));
  t(`${yontem}: sebep açıkça yazıyor`, /uygulanmadı/i.test(cari.error ?? ''), cari.error);

  const fatura = await l.createInvoice({ id: 'x1', ticketNumber: 'SF-1', totalCost: 100 });
  t(`${yontem}: fatura aktarımı BAŞARISIZ döner`, fatura.success === false, JSON.stringify(fatura));

  const tahsilat = await l.createPayment({ id: 'x1', amount: 100 });
  t(`${yontem}: tahsilat aktarımı BAŞARISIZ döner`, tahsilat.success === false, JSON.stringify(tahsilat));

  const baglanti = await l.testConnection();
  t(`${yontem}: bağlantı testi TRUE dönmez`, baglanti === false, String(baglanti));
}

// Toplu aktarım raporu da yalan söylememeli: hepsi başarısız sayılmalı.
const l = new LogoIntegration({ method: 'file' });
const rapor = await l.syncAllCustomers([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
t('toplu aktarım raporu: 0 başarılı, 3 başarısız',
  rapor.success === 0 && rapor.failed === 3, JSON.stringify(rapor));

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
