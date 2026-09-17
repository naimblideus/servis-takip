// KURUMSAL GRUP — SAF BİRLEŞTİRME
// Çalıştır:  node scripts/test-kurumsal.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Bu ekran genel müdürlük masasına konan tek sayfa. Orada söylenen bir sayı
// yanlışsa ihale kaybedilir — ya da daha kötüsü, kazanılır ve sonra çıkar.
// İki kural bu yüzden testle kilitli:
//
//   1. SIFIR SAYFA İLE OKUNMAMIŞ SAYFA AYNI ŞEY DEĞİL. Dönemde hiç sayacı
//      okunmamış şube "0 sayfa" yazarsa, o şube hiç basmamış gibi görünür.
//   2. SLA AĞIRLIKLI BİRLEŞİR. Şube oranlarının düz ortalaması, tek fişi
//      olan şube ile iki yüz fişi olan şubeyi eşit sayar ve kötü giden
//      büyük şubeyi küçüklerin arkasına saklar.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-kurumsal-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/kurumsal.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'kurumsal.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { grupToplami, subeSirala, agirlikliOrtalama } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

let sayac = 0;
const sube = (ek = {}) => ({
  musteriId: `m${++sayac}`,
  musteri: `Şube ${sayac}`,
  cihaz: 10,
  okunanCihaz: 10,
  siyah: 10000,
  renkli: 2000,
  ariza: 2,
  planli: 1,
  slaMudahaleYuzde: 100,
  slaCozumYuzde: 100,
  slaOlculen: 10,
  donemFaturasi: 5000,
  bakiye: 0,
  ...ek,
});

console.log('\nKurumsal grup — saf birleştirme\n');

// ── AĞIRLIKLI ORTALAMA ───────────────────────────────────────────────────
t('ağırlıklı ortalama ağırlığa uyar',
  agirlikliOrtalama([{ deger: 100, agirlik: 1 }, { deger: 0, agirlik: 99 }]) === 1);
t('★ düz ortalama DEĞİL', agirlikliOrtalama([{ deger: 100, agirlik: 1 }, { deger: 0, agirlik: 99 }]) !== 50);
t('null değer ağırlığa girmiyor',
  agirlikliOrtalama([{ deger: null, agirlik: 1000 }, { deger: 80, agirlik: 10 }]) === 80);
t('sıfır ağırlık sayılmıyor',
  agirlikliOrtalama([{ deger: 100, agirlik: 0 }, { deger: 50, agirlik: 10 }]) === 50);
t('hiç ağırlık yoksa null', agirlikliOrtalama([{ deger: 100, agirlik: 0 }]) === null);
t('boş listede null', agirlikliOrtalama([]) === null);

// ── SAYFA ────────────────────────────────────────────────────────────────
{
  const r = grupToplami([sube(), sube()]);
  t('sayfalar toplanıyor', r.siyah === 20000 && r.renkli === 4000 && r.toplamSayfa === 24000, r);
  t('renkli payı yüzde ölçeğinde', Math.abs(r.renkliPayi - (4000 / 24000) * 100) < 1e-9, r.renkliPayi);
  t('cihaz toplanıyor', r.cihaz === 20 && r.okunmayanCihaz === 0, r);
}
{
  // Hiç okuma yoksa sayfa BİLİNMİYOR: null.
  const r = grupToplami([sube({ siyah: null, renkli: null, okunanCihaz: 0 })]);
  t('★ okuması olmayan şubenin sayfası null (sıfır DEĞİL)', r.siyah === null && r.toplamSayfa === null, r);
  t('★ okunmayan cihaz sayılıyor', r.okunmayanCihaz === 10, r.okunmayanCihaz);
  t('sayfa yokken renkli payı null', r.renkliPayi === null, r.renkliPayi);
}
{
  // Bir şube okunmuş, biri okunmamış: toplam okunanı verir, sıfır eklemez.
  const r = grupToplami([sube(), sube({ siyah: null, renkli: null, okunanCihaz: 0 })]);
  t('★ okunmamış şube toplamı bozmuyor', r.siyah === 10000 && r.toplamSayfa === 12000, r);
  t('okunmayan cihaz toplamda görünüyor', r.okunmayanCihaz === 10, r.okunmayanCihaz);
}

// ── SLA ──────────────────────────────────────────────────────────────────
{
  const r = grupToplami([
    sube({ slaMudahaleYuzde: 100, slaCozumYuzde: 100, slaOlculen: 1 }),
    sube({ slaMudahaleYuzde: 50, slaCozumYuzde: 40, slaOlculen: 99 }),
  ]);
  t('★ grup SLA ölçülen fişle ağırlıklı', Math.abs(r.slaMudahaleYuzde - (100 * 1 + 50 * 99) / 100) < 1e-9, r.slaMudahaleYuzde);
  t('★ düz ortalama olsaydı 75 çıkardı', Math.round(r.slaMudahaleYuzde) !== 75, r.slaMudahaleYuzde);
  t('çözüm uyumu da ağırlıklı', Math.abs(r.slaCozumYuzde - (100 * 1 + 40 * 99) / 100) < 1e-9, r.slaCozumYuzde);
}
{
  const r = grupToplami([
    sube({ slaMudahaleYuzde: null, slaCozumYuzde: null, slaOlculen: 0 }),
    sube({ slaMudahaleYuzde: 90, slaCozumYuzde: 90, slaOlculen: 5 }),
  ]);
  t('★ sözü olmayan şube uyum oranına girmiyor', r.slaMudahaleYuzde === 90, r.slaMudahaleYuzde);
  t('★ kaç şubede söz var sayılıyor', r.slaSozluSube === 1 && r.sube === 2, r);
  t('ağırlık yalnız sözlü şubeden', r.slaOlculen === 5, r.slaOlculen);
}
{
  const r = grupToplami([sube({ slaMudahaleYuzde: null, slaCozumYuzde: null, slaOlculen: 0 })]);
  t('★ hiç söz yoksa grup uyumu null (sıfır değil)', r.slaMudahaleYuzde === null && r.slaCozumYuzde === null, r);
}

// ── PARA ─────────────────────────────────────────────────────────────────
{
  const r = grupToplami([sube({ bakiye: 1500, donemFaturasi: 3000 }), sube({ bakiye: 0, donemFaturasi: 2000 })]);
  t('fatura ve bakiye toplanıyor', r.donemFaturasi === 5000 && r.bakiye === 1500, r);
  t('bakiyeli şube sayılıyor', r.bakiyeliSube === 1, r.bakiyeliSube);
}
{
  const r = grupToplami([sube({ bakiye: 0.004 })]);
  t('kuruş altı bakiye "borçlu" saymıyor', r.bakiyeliSube === 0, r.bakiyeliSube);
}

// ── BOŞ GRUP ─────────────────────────────────────────────────────────────
{
  const r = grupToplami([]);
  t('★ boş grupta sayı uydurulmuyor',
    r.sube === 0 && r.siyah === null && r.toplamSayfa === null && r.slaMudahaleYuzde === null, r);
  t('boş grupta para sıfır', r.donemFaturasi === 0 && r.bakiye === 0, r);
}

// ── SIRALAMA ─────────────────────────────────────────────────────────────
{
  const liste = subeSirala([
    sube({ musteri: 'Küçük', siyah: 100, renkli: 0 }),
    sube({ musteri: 'Büyük', siyah: 90000, renkli: 10000 }),
    sube({ musteri: 'Bilinmeyen', siyah: null, renkli: null, okunanCihaz: 0 }),
    sube({ musteri: 'Orta', siyah: 5000, renkli: 500 }),
  ]);
  t('★ en çok basan üstte', liste[0].musteri === 'Büyük', liste.map((s) => s.musteri));
  t('sıralama azalan', liste[1].musteri === 'Orta' && liste[2].musteri === 'Küçük', liste.map((s) => s.musteri));
  t('★ sayfası bilinmeyen şube listeden DÜŞMÜYOR, en alta iniyor',
    liste[3].musteri === 'Bilinmeyen' && liste.length === 4, liste.map((s) => s.musteri));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
