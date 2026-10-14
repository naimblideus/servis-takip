// SİYAH-BEYAZ CİHAZDA SAYAÇ GİRİŞİ — renkli kutu zorunlu değil mi?
// Çalıştır:  node scripts/test-renkli-cihaz.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST (ölçülmüş engel)
// Cihaz sayfasındaki sayaç girişi renkli sayacı da ZORUNLU tutuyordu: "Ekle"
// düğmesi yalnız iki kutu da doluyken açılıyordu. Pantum modellerinin çoğu
// siyah-beyaz; teknisyen renkli kutusuna ne yazacağını bilemiyor, düğme hiç
// açılmıyordu. Düzenleme penceresi de aynıydı. Sayaç Turu (api/readings/bulk)
// renkli sütunu zaten yalnız renkli kanıtı olan cihazda gösteriyor — cihaz
// sayfası artık AYNI ölçütü kullanıyor (lib/renkli-cihaz.ts).
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-renkli-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/renkli-cihaz.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { renkliMi, sayacGirisiTamam, gonderilecekRenkli } = await import(pathToFileURL(join(g, 'renkli-cihaz.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\nRENKLİ Mİ? (Sayaç Turu ile aynı kural)\n');
{
  t('★ hiçbir renkli kanıtı yok → siyah-beyaz', renkliMi({}) === false);
  t('renkli sayaç 0, fiyat/paket yok → siyah-beyaz', renkliMi({ counterColor: 0, pricePerColor: null, includedColor: 0, overagePriceColor: null }) === false);
  t('renkli sayaç > 0 → renkli', renkliMi({ counterColor: 12 }) === true);
  t('cihaza özel renkli fiyat (0 bile olsa) → renkli', renkliMi({ pricePerColor: 0 }) === true);
  t('sözleşmede renkli paket → renkli', renkliMi({ includedColor: 500 }) === true);
  t('renkli aşım fiyatı → renkli', renkliMi({ overagePriceColor: 1.2 }) === true);
}

console.log('\n★ "EKLE" NE ZAMAN AÇILIR\n');
{
  t('★ siyah-beyaz: yalnız siyah yeterli', sayacGirisiTamam(false, '36010', '') === true);
  t('siyah-beyaz: siyah boşsa kapalı', sayacGirisiTamam(false, '', '') === false);
  t('renkli: renkli boşsa kapalı', sayacGirisiTamam(true, '36010', '') === false);
  t('renkli: ikisi doluysa açık (0 da değerdir)', sayacGirisiTamam(true, '36010', '0') === true);
  t('boşluk dolu sayılmıyor', sayacGirisiTamam(false, '   ', '') === false);
}

console.log('\nSUNUCUYA GİDEN RENKLİ SAYAÇ\n');
{
  t('★ siyah-beyaz: bilinen renkli sayaç aynen (0)', gonderilecekRenkli(false, '', 0) === 0);
  t('siyah-beyaz: kutu boş, bilinen değer korunuyor (düşüş sayılmasın)', gonderilecekRenkli(false, '', 7) === 7);
  t('siyah-beyaz: bilinmiyorsa 0', gonderilecekRenkli(false, '', null) === 0 && gonderilecekRenkli(false, '', undefined) === 0);
  t('renkli: girilen değer', gonderilecekRenkli(true, '1520', 0) === 1520);
}

console.log('\nEKRAN VE SAYAÇ TURU AYNI KURALI KULLANIYOR (kaynak denetimi)\n');
{
  const panel = readFileSync(join(KOK, 'src/components/CounterReadingPanel.tsx'), 'utf8');
  const tur = readFileSync(join(KOK, 'src/app/api/readings/bulk/route.ts'), 'utf8');
  const kural = readFileSync(join(KOK, 'src/lib/renkli-cihaz.ts'), 'utf8');
  t('Sayaç Turu kuralı değişmedi (değiştiyse lib/renkli-cihaz.ts de güncellenmeli)',
    tur.includes('(d.includedColor ?? 0) > 0 || d.pricePerColor != null || d.overagePriceColor != null || (d.counterColor ?? 0) > 0')
    && kural.includes('(d.includedColor ?? 0) > 0 || d.pricePerColor != null || d.overagePriceColor != null || (d.counterColor ?? 0) > 0'));
  t('★ yeni okuma ve düzenleme renkli kutuyu ZORUNLU tutmuyor', !/!form\.counterColor/.test(panel) && !/!editForm\.counterColor/.test(panel));
  t('düğmeler sayacGirisiTamam ile açılıyor', (panel.match(/sayacGirisiTamam\(renkli,/g) || []).length >= 4);
  t('renkli kutu yalnız renkli cihazda çiziliyor', /\{renkli \? \(/.test(panel) && /\{renkli && \(/.test(panel));
  t('siyah-beyazda renkli değer gonderilecekRenkli ile gidiyor', (panel.match(/gonderilecekRenkli\(renkli,/g) || []).length === 2);
  t('gömülü "Aylık aidat dahil" metni kalmadı', !panel.includes('Aylık aidat dahil'));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
