// ÖĞRENEN TONER VERİMİ — sormak yerine ölçmek
// Çalıştır:  node scripts/test-verim-ogrenme.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Tükenme tahmininin en pahalı hatası YANLIŞ verim: bayi müşteriye
// "toneriniz bitmek üzere" der, değildir; ya da hiç uyarmaz, biter.
// Test ettiğim asıl şeyler:
//
//   1. ÖLÇÜM HATASI GÖZLEM SAYILMAMALI. Cihaz değişince sayaç sıfırlanır,
//      sıkışan toner boşalmadan atılır. Bu iki durumun ürettiği fark
//      "verim" diye kaydedilirse tahmin kalıcı olarak bozulur.
//   2. ORTANCA, ortalama değil. Tek bir uç gözlem ortalamayı bozar.
//   3. İKİ AYRI CİHAZIN sayaçları arasındaki fark verim DEĞİLDİR — model
//      özeti cihaz bazında çıkarılmalı.
//   4. HİÇ ÖLÇÜM YOKSA SAYI UYDURULMAMALI (null dönmeli).
//   5. ELLE GİRİLEN her zaman kazanmalı: bayi yüksek kapasiteli toner
//      takmış olabilir ve bunu bizden iyi bilir.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-vo-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/verim-ogrenme.ts'), join(KOK, 'src/lib/toner-verimi.ts'),
    join(KOK, 'src/lib/device-brands.ts'), join(KOK, 'src/lib/toner.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  // Derlenen dosyalar '@/lib/...' diye içe aktarıyor; yerel yola çevir.
  // prisma ve reliability yalnız VERİTABANI fonksiyonlarında kullanılıyor;
  // burada saf mantık test ediliyor, ikisi de sahteyle karşılanıyor.
  const yol = join(g, 'verim-ogrenme.js');
  let s = readFileSync(yol, 'utf8')
    .split("'@/lib/toner-verimi'").join("'./toner-verimi.js'")
    .split("'@/lib/prisma'").join("'./sahte-prisma.js'")
    .split("'@/lib/reliability'").join("'./sahte-reliability.js'");
  writeFileSync(yol, s, 'utf8');
  const t = join(g, 'toner-verimi.js');
  writeFileSync(t, readFileSync(t, 'utf8')
    .split("'@/lib/prisma'").join("'./sahte-prisma.js'")
    .split("'@/lib/device-brands'").join("'./device-brands.js'"), 'utf8');
  writeFileSync(join(g, 'sahte-prisma.js'), 'export const prisma = {};\n', 'utf8');
  writeFileSync(join(g, 'sahte-reliability.js'), 'export const MIN_TENANTS_FOR_OEM = 3;\n', 'utf8');
}
const {
  ortanca, gozlemler, ozetle, verimSec, EN_AZ_GOZLEM, VERIM_ALT, VERIM_UST,
} = await import(pathToFileURL(join(g, 'verim-ogrenme.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const gun = (n) => new Date(2026, 0, n);
/** Sayaç değerlerinden değişim kaydı dizisi. */
const kayitlar = (...sayaclar) => sayaclar.map((c, i) => ({ counterValue: c, changedAt: gun(1 + i * 30) }));

console.log('\nORTANCA\n');
{
  t('boş dizi → null', ortanca([]) === null);
  t('tek eleman', ortanca([5]) === 5);
  t('tek sayıda eleman ortadaki', ortanca([9, 1, 5]) === 5);
  t('çift sayıda eleman iki ortanın ortalaması', ortanca([1, 2, 3, 4]) === 3, ortanca([1, 2, 3, 4]));
  t('sıralanmamış girdi doğru sonuç veriyor', ortanca([100, 1, 50]) === 50);
  t('ondalık çıkmıyor (tam sayfa)', Number.isInteger(ortanca([1000, 1001])));
}

console.log('\n★ GÖZLEM = İKİ DEĞİŞİM ARASINDA BASILAN SAYFA\n');
{
  // 0 → 2.000 → 4.100 → 6.000 : iki gözlem (2.000 ve 2.100). İlk kayıt
  // referans, kendisi gözlem değil.
  const gz = gozlemler(kayitlar(0, 2000, 4100, 6000));
  t('★ üç gözlem çıkıyor (dört kayıttan)', gz.length === 3, gz);
  t('farklar doğru', gz.join(',') === '2000,2100,1900', gz);
  t('tek kayıttan gözlem çıkmıyor', gozlemler(kayitlar(5000)).length === 0);
  t('hiç kayıt yoksa boş', gozlemler([]).length === 0);
}

console.log('\n★ SIRALAMA — kayıtlar karışık gelirse fark negatife düşmemeli\n');
{
  const karisik = [
    { counterValue: 4000, changedAt: gun(61) },
    { counterValue: 0, changedAt: gun(1) },
    { counterValue: 2000, changedAt: gun(31) },
  ];
  const gz = gozlemler(karisik);
  t('★ ters sırada verilen kayıtlar sıralanıyor', gz.join(',') === '2000,2000', gz);
}

console.log('\n★ ÖLÇÜM HATALARI GÖZLEM SAYILMIYOR\n');
{
  // Cihaz değişimi / sayaç sıfırlanması: fark negatif.
  t('★ sayaç geri gitmiş → gözlem yok', gozlemler(kayitlar(50000, 100)).length === 0);
  t('★ sayaç hiç ilerlememiş → gözlem yok', gozlemler(kayitlar(5000, 5000)).length === 0);
  // Sıkışma yüzünden boşalmadan değişen toner.
  t(`★ ${VERIM_ALT} sayfadan kısa → gözlem yok`, gozlemler(kayitlar(0, VERIM_ALT - 1)).length === 0);
  t('alt sınırın kendisi kabul ediliyor', gozlemler(kayitlar(0, VERIM_ALT)).length === 1);
  // Sayaç sıfırlanıp devam etmiş: fark uçuk.
  t(`★ ${VERIM_UST} sayfadan uzun → gözlem yok`, gozlemler(kayitlar(0, VERIM_UST + 1)).length === 0);
  t('üst sınırın kendisi kabul ediliyor', gozlemler(kayitlar(0, VERIM_UST)).length === 1);
  // SAYAÇ SIFIRLANMASI: 0 → 2.000 → (cihaz değişti, sayaç 5'ten
  // başladı) → 2.100. Kopuş noktasındaki fark ELENİYOR; ama kopuştan
  // SONRAKİ 2.095 gerçek bir gözlem — sayaç yeniden sıfırdan sayıp o
  // kadar sayfa basmış. Burada "5 aslında yazım hatasıydı" varsayıp
  // 2.095'i de atmak, gerçek ölçümleri kaybettirirdi: bu alanı insan
  // yazmıyor, cihazın sayacından geliyor.
  const gz = gozlemler(kayitlar(0, 2000, 5, 2100));
  t('★ kopuş noktası eleniyor', !gz.includes(-1995) && gz.length === 2, gz);
  t('★ kopuştan önceki gözlem duruyor', gz.includes(2000), gz);
  t('★ kopuştan sonraki gözlem de duruyor', gz.includes(2095), gz);

  // Bozuk tek kayıt bütün geçmişi götürmemeli.
  const uzun = gozlemler(kayitlar(0, 2000, 4000, 3, 2000, 4000));
  t('★ bir kopuş, beş gözlemden dördünü bırakıyor', uzun.length === 4, uzun);
  t('kalanların hepsi makul', uzun.every((x) => x >= VERIM_ALT && x <= VERIM_UST), uzun);
}

console.log('\n★ ORTALAMA DEĞİL ORTANCA — tek uç gözlem bozmamalı\n');
{
  // Dört normal toner (~2.000) ve bir tanesi sıkışma yüzünden 300'de
  // değişmiş. Ortalama 1.660 verir — %17 yanlış. Ortanca 2.000 verir.
  const gz = [2000, 1950, 300, 2050, 2000];
  const o = ozetle(gz);
  t('★ ortanca 2000', o.deger === 2000, o);
  const ortalama = Math.round(gz.reduce((a, b) => a + b, 0) / gz.length);
  t('★ ortalama olsaydı 1660 olurdu (yanlış)', ortalama === 1660, ortalama);
  t('gözlem sayısı yazıyor', o.gozlem === 5);
  t('en az/en çok yazıyor', o.enAz === 300 && o.enCok === 2050, o);
  t('boş gözlemden özet çıkmıyor', ozetle([]) === null);
}

console.log('\n★ POPÜLASYON RIZASIZ TOPLANMIYOR\n');
{
  // Depodaki kural: "bayinin verisini başkasına açmak izin ister; izin
  // varsayılan olamaz." Bir bayinin ölçümünü BAŞKA bayiye göstermek de
  // aynı şey. Kaynakta rıza süzgeci ve k-anonimlik eşiği duruyor mu?
  const kaynak = readFileSync(join(KOK, 'src/lib/verim-ogrenme.ts'), 'utf8');
  const govde = kaynak.slice(kaynak.indexOf('export async function populasyonVerimleri'));
  t('★ rıza bayrağı sorgulanıyor', /oemDataSharing:\s*true/.test(govde));
  t('★ silinmiş/pasif bayi havuza girmiyor',
    /deletedAt:\s*null/.test(govde) && /isActive:\s*true/.test(govde));
  t('★ k-anonimlik eşiği uygulanıyor', /MIN_TENANTS_FOR_OEM/.test(govde));
  t('rızalı bayi eşiğin altındaysa boş dönülüyor',
    /rizaliBayiler\.length < MIN_TENANTS_FOR_OEM/.test(govde));
}

console.log('\n★ VERİM SEÇİMİ — kaynak GİZLENMİYOR\n');
{
  const ozet = (d, n) => ({ deger: d, gozlem: n, enAz: d, enCok: d });

  const elle = verimSec({ elle: 1600, cihaz: ozet(2000, 3), model: ozet(2200, 9) });
  t('★ elle girilen her şeyi yeniyor', elle.deger === 1600 && elle.kaynak === 'ELLE', elle);

  const c = verimSec({ elle: null, cihaz: ozet(2000, 3), model: ozet(2200, 9) });
  t('★ cihazın kendi geçmişi modeli yeniyor', c.deger === 2000 && c.kaynak === 'CIHAZ', c);
  t('kaç ölçümden geldiği yazıyor', /3 toner/.test(c.aciklama), c.aciklama);

  const m = verimSec({ elle: null, cihaz: undefined, model: ozet(2200, 9) });
  t('cihaz geçmişi yoksa modele düşülüyor', m.deger === 2200 && m.kaynak === 'MODEL', m);

  const pop = verimSec({ elle: null, cihaz: undefined, model: undefined, populasyon: ozet(1800, 40) });
  t('model de yoksa popülasyona düşülüyor', pop.deger === 1800 && pop.kaynak === 'POPULASYON', pop);
  t('popülasyon olduğu açıkça yazıyor', /Diğer bayilerde/.test(pop.aciklama), pop.aciklama);

  const yok = verimSec({ elle: null, cihaz: undefined, model: undefined });
  t('★ hiç ölçüm yoksa SAYI UYDURULMUYOR', yok.deger === null && yok.kaynak === null, yok);
  t('★ bayiye ne zaman çıkacağı söyleniyor', /ikinci toner değişiminde/.test(yok.aciklama), yok.aciklama);

  // Bozuk elle girilmiş değer (yazım hatası) sessizce kullanılmamalı.
  const bozuk = verimSec({ elle: 5, cihaz: ozet(2000, 3) });
  t('★ elle girilen değer aralık dışıysa ölçüme düşülüyor', bozuk.deger === 2000 && bozuk.kaynak === 'CIHAZ', bozuk);
  t('sıfır elle değer ölçümü engellemiyor', verimSec({ elle: 0, cihaz: ozet(2000, 1) }).kaynak === 'CIHAZ');
}

console.log('\nEŞİKLER\n');
{
  t('model için en az iki gözlem isteniyor', EN_AZ_GOZLEM === 2);
  t('tek gözlemli model kabul edilmiyor', !(ozetle([2000]).gozlem >= EN_AZ_GOZLEM));
  t('iki gözlemli model kabul ediliyor', ozetle([2000, 2100]).gozlem >= EN_AZ_GOZLEM);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
