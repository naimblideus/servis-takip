// Sayaç e-postası ADRES çözümlemesinin testi.
// Çalıştır:  node scripts/test-sayac-adres.mjs
//
// Neden ayrı bir test: bu mantık GÜVENLİK sınırı. Adresten çıkan kod bayiyi
// belirliyor ve yanlış çözülürse bir müşterinin ham sayaç raporu BAŞKA bir
// bayinin kuyruğuna düşer. Aynı şehirdeki iki fotokopi bayisi rakiptir.
//
// TS'i gerçek derleyiciyle geçici klasöre çevirip içe aktarır — ayrı bir
// derleme adımı gerekmez.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const gecici = mkdtempSync(join(tmpdir(), 'st-adres-test-'));
let bayiKodAdaylari, sayacAdresi;
try {
  execFileSync(
    process.execPath,
    [join(kok, 'node_modules/typescript/bin/tsc'), join(kok, 'src/lib/sayac-eposta.ts'),
      '--outDir', gecici, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'],
    { stdio: 'pipe' },
  );
  ({ bayiKodAdaylari, sayacAdresi } = await import(pathToFileURL(join(gecici, 'sayac-eposta.js')).href));
} catch (e) {
  console.error('Derleme başarısız:', e.stderr?.toString() || e.message);
  process.exit(1);
}

process.env.SAYAC_EPOSTA_ALANADI = 'nextusservis.com';

let gecti = 0, kaldi = 0;
const es = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const t = (ad, bulunan, beklenen) => {
  if (es(bulunan, beklenen)) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}\n      beklenen: ${JSON.stringify(beklenen)}\n      bulunan : ${JSON.stringify(bulunan)}`); }
};

console.log('\nADAY KOD ÇIKARIMI\n');

t('tek alıcı, artılı biçim',
  bayiKodAdaylari('sayac+xc3vwwqb@nextusservis.com'), ['xc3vwwqb']);

t('Gmail köprüsü (kullanıcı adı farklı, artı yine çalışır)',
  bayiKodAdaylari('nextussayac+xc3vwwqb@gmail.com'), ['xc3vwwqb']);

// Sahadaki asıl hâl: cihazdaki mevcut alıcı SİLİNMİYOR, bizimki EKLENİYOR.
t('çok alıcılı — bizim adres EN SONDA',
  bayiKodAdaylari('muhasebe@firma.com, bt@firma.com, sayac+xc3vwwqb@nextusservis.com'),
  ['xc3vwwqb']);

t('çok alıcılı — düz biçim, kendi alan adımızda, sonda',
  bayiKodAdaylari('muhasebe@firma.com, xc3vwwqb@nextusservis.com'), ['xc3vwwqb']);

t('açılı ayraçlı biçim',
  bayiKodAdaylari('"Muhasebe" <muhasebe@firma.com>, <xc3vwwqb@nextusservis.com>'), ['xc3vwwqb']);

t('noktalı virgül ayraç (Kyocera Fleet Services böyle yazıyor)',
  bayiKodAdaylari('bt@firma.com;xc3vwwqb@nextusservis.com'), ['xc3vwwqb']);

// Eski hâlde bu geçerli raporu YANLIŞ koda düşürüyordu: ilk '+' eşleşmesi
// alakasız adresten geliyordu.
t('alakasız etiketli adres kodu ÇALMIYOR — ikisi de aday, DB karar verir',
  bayiKodAdaylari('muhasebe+fatura@firma.com, sayac+xc3vwwqb@nextusservis.com'),
  ['fatura', 'xc3vwwqb']);

// Düz biçim BAŞKA alan adında aranmaz; yoksa her adres bir bayi kodu sanılır.
t('yabancı alan adındaki düz adres aday DEĞİL',
  bayiKodAdaylari('muhasebe@firma.com, bilgi@baskafirma.com'), []);

t('kod hiç yok — boş dizi (eski kodsuz kurulum bozulmasın)',
  bayiKodAdaylari('sayac@nextussayac.com'), []);

t('boş / tanımsız girdi', bayiKodAdaylari(''), []);
t('null girdi', bayiKodAdaylari(null), []);

t('büyük harf küçültülür',
  bayiKodAdaylari('SAYAC+XC3VWWQB@NEXTUSSERVIS.COM'), ['xc3vwwqb']);

t('aynı kod iki kez geçerse tekilleşir',
  bayiKodAdaylari('sayac+xc3vwwqb@nextusservis.com, xc3vwwqb@nextusservis.com'), ['xc3vwwqb']);

// Alfabede 0/O/1/l/I yok ama uzunluk sınırı yine de korunmalı.
t('3 karakterlik parça aday değil (alt sınır 4)',
  bayiKodAdaylari('sayac+abc@nextusservis.com'), []);

console.log('\nADRES KURMA ile TERSLİK\n');

process.env.SAYAC_EPOSTA_SECRET = 'test';
process.env.SAYAC_EPOSTA_KULLANICI = 'sayac';
const adres = sayacAdresi('xc3vwwqb');
t('kurulan adres geri çözülüyor', bayiKodAdaylari(adres), ['xc3vwwqb']);

process.env.SAYAC_EPOSTA_KULLANICI = 'nextussayac';
process.env.SAYAC_EPOSTA_ALANADI = 'gmail.com';
const gmailAdres = sayacAdresi('xc3vwwqb');
t('Gmail kurulumunda da geri çözülüyor', bayiKodAdaylari(gmailAdres), ['xc3vwwqb']);

rmSync(gecici, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
