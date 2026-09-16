// MÜŞTERİYE GİDEN MESAJLAR — WhatsApp/SMS metinleri
// Çalıştır:  node scripts/test-musteri-mesaji.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu metinler bayinin değil MÜŞTERİNİN eline geçiyor ve çoğu para istiyor.
// Ekranda göremediğin bir şey: düğmeye basınca WhatsApp açılır, metin oraya
// yazılır ve bayi çoğu zaman okumadan gönderir. Test ettiklerim:
//
//   1. DİL BAYİNİN DİLİ — İngilizce arayüz kullanan Türk bayinin müşterisine
//      Türkçe, Alman bayinin müşterisine İngilizce gitmeli. Mesaj üreticileri
//      `dil` parametresi alıyor; vermeyen eski çağrı Türkçe kalıyor.
//   2. PARA BİRİMİ BAYİDEN — € ile çalışan bayinin mesajında ₺ yazmamalı.
//   3. YARIM CÜMLE YOK — cihaz adı, fiş no, işlem, tutar opsiyonel; biri
//      yokken cümlede boşluk/asılı tire kalmamalı.
//   4. YER TUTUCU SIZMASI YOK — metinde {cihaz}, {n} gibi bir şey kalmamalı;
//      kalırsa müşteriye ham şablon gider.
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-mesaj-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/share.ts'), join(KOK, 'src/lib/bicim.ts'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

// tsc `@/...` takma adını ve uzantıyı olduğu gibi bırakıyor; Node ESM ikisini
// de çözemez. Derlenen dosyalarda göreli yola çeviriyoruz.
const yamalar = {
  'share.js': [["from '@/lib/i18n/sozluk'", "from './i18n/sozluk.js'"], ["from '@/lib/bicim'", "from './bicim.js'"]],
  'i18n/sozluk.js': [["from './tr'", "from './tr.js'"], ["from './en'", "from './en.js'"]],
};
for (const [dosya, ciftler] of Object.entries(yamalar)) {
  const yol = join(g, dosya);
  if (!existsSync(yol)) continue;
  let icerik = readFileSync(yol, 'utf8');
  for (const [a, b] of ciftler) icerik = icerik.replace(a, b);
  writeFileSync(yol, icerik, 'utf8');
}

const { statusMessage, invoiceMessage, paymentMessage, reminderMessage } =
  await import(pathToFileURL(join(g, 'share.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const temizMi = (s) => !/\{[a-zA-Z]+\}/.test(s);

console.log('\n★ SERVİS DURUMU MESAJI\n');
{
  const tr = statusMessage('READY', {
    customerName: 'Mercan Hukuk', deviceName: 'Canon iR 2425', ticketNumber: 'EKS-0028',
    actionText: 'Fırın ünitesi değişti', totalCost: 1500, tenantName: 'Nextus Ofis',
  });
  t('★ varsayılan Türkçe (eski çağrı bozulmadı)', tr.includes('Sayın Mercan Hukuk,') && tr.includes('teslim alabilirsiniz'), tr);
  t('★ cihaz adı cümlenin içine girdi', tr.includes('Canon iR 2425 cihazınızdaki'), tr);
  t('fiş no eklendi', tr.includes('(Fiş: EKS-0028)'));
  t('★ tutar bayinin para biriminde (₺)', tr.includes('₺1.500,00'), tr);
  t('yer tutucu sızmadı', temizMi(tr), tr);

  const en = statusMessage('READY', {
    dil: 'en', birim: 'EUR',
    customerName: 'Mercan Legal', deviceName: 'Canon iR 2425', ticketNumber: 'EKS-0028',
    actionText: 'Fuser unit replaced', totalCost: 1500, tenantName: 'Nextus Office',
  });
  t('★ en: İngilizce gövde', en.includes('Dear Mercan Legal,') && en.includes('ready for collection'), en);
  t('★ en: cihaz adı doğru yerde', en.includes('your Canon iR 2425 device'), en);
  t('★ en: tutar € ile', en.includes('€1,500.00'), en);
  t('en: yer tutucu sızmadı', temizMi(en), en);
}

console.log('\n★ EKSİK ALANLARDA YARIM CÜMLE YOK\n');
{
  const a = statusMessage('IN_SERVICE', {});
  t('ad yoksa "Merhaba,"', a.startsWith('Merhaba,'), a);
  t('★ cihaz adı yoksa cümle yine düzgün', a.includes('cihazınız servise alınmıştır') && !a.includes('  '), a);
  t('fiş no yoksa parantez yok', !a.includes('(Fiş'), a);

  const b = statusMessage('IN_SERVICE', { dil: 'en' });
  t('en: ad yoksa "Hello,"', b.startsWith('Hello,'), b);
  t('★ en: cihaz yoksa "your device"', b.includes('Your device is now in our workshop'), b);

  // READY olmayan durumda işlem/tutar satırı HİÇ eklenmez
  const c = statusMessage('IN_SERVICE', { actionText: 'x', totalCost: 100 });
  t('★ iş bitmeden tutar yazılmıyor', !c.includes('Tutar'), c);
}

console.log('\n★ FATURA MESAJI\n');
{
  const tr = invoiceMessage({ invoiceNumber: 'FT-2026-001', period: '2026-09', totalAmount: 5000, openAmount: 2000, dueDate: new Date(2026, 8, 30) });
  t('tr: fatura no ve dönem', tr.includes('FT-2026-001 numaralı faturanız (2026-09)'), tr);
  t('★ tr: kalan + son ödeme tarihi', tr.includes('Kalan: ₺2.000,00') && tr.includes('30.09.2026'), tr);
  const kapali = invoiceMessage({ invoiceNumber: 'FT-1', totalAmount: 100, openAmount: 0, dueDate: new Date(2026, 8, 30) });
  t('★ borç yoksa "ödenmiştir"', kapali.includes('Ödenmiştir'), kapali);
  t('dönem yoksa boş parantez yok', !kapali.includes('()'), kapali);

  const en = invoiceMessage({ dil: 'en', birim: 'GBP', invoiceNumber: 'INV-9', period: '2026-09', totalAmount: 5000, openAmount: 2000, dueDate: new Date(2026, 8, 30) });
  t('★ en: İngilizce + £', en.includes('Your invoice INV-9') && en.includes('£2,000.00'), en);
  t('★ en: tarih gün/ay/yıl', en.includes('30/09/2026'), en);
  t('en: yer tutucu sızmadı', temizMi(en), en);
}

console.log('\n★ TAHSİLAT VE BORÇ HATIRLATMA\n');
{
  const p = paymentMessage({ customerName: 'Ege İnşaat', amount: 750.5, date: new Date(2026, 8, 16) });
  t('tr: tutar + tarih', p.includes('₺750,50') && p.includes('(16.09.2026)'), p);
  const pTarihsiz = paymentMessage({ amount: 750.5 });
  t('★ tarih yoksa boş parantez yok', !pTarihsiz.includes('()'), pTarihsiz);

  const pEn = paymentMessage({ dil: 'en', birim: 'EUR', customerName: 'Ege Construction', amount: 750.5, date: new Date(2026, 8, 16) });
  t('★ en: "We have received your payment"', pEn.includes('We have received your payment of €750.50'), pEn);

  const r = reminderMessage({ customerName: 'Nova', debt: 12400, tenantName: 'Nextus Ofis' });
  t('tr: borç tutarı', r.includes('₺12.400,00'), r);
  t('imza satırı bayi adı', r.trim().endsWith('Nextus Ofis'), r);
  const rEn = reminderMessage({ dil: 'en', birim: 'EUR', customerName: 'Nova', debt: 12400 });
  t('★ en: overdue balance', rEn.includes('overdue balance of €12,400.00'), rEn);
  t('en: yer tutucu sızmadı', temizMi(rEn), rEn);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
