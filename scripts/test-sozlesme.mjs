// SÖZLEŞME KURALLARI — sözleşmede yazanla sistemde olan
// Çalıştır:  node scripts/test-sozlesme.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu dosya bayiye "şu kadar para kaybediyorsun" diyor. Yanlış söylerse iki
// türlü zarar var: olmayan parayı varmış gibi gösterip bayiyi müşterisine
// yanlış rakamla gönderir, ya da gerçek kaybı görmez. Test ettiklerim:
//
//   1. YÖN DOĞRU OLMALI. Dahil paket BÜYÜDÜKÇE müşteri AZ öder — yani
//      sözleşmedeki paket sistemdekinden büyükse biz FAZLA faturalıyoruz.
//      Diğer kalemlerin tersi; karıştırmak en kolay hata.
//   2. ₺ UYDURULMAMALI. Sayfa farkının parası cihazın gerçek hacmine bağlı;
//      hacim bilinmiyorsa tutar YAZILMAMALI, fark yine görünmeli.
//   3. FAZLA FATURALAMA DA SÖYLENMELİ. Yalnız "az kesiyorsun" demek
//      kolaycılık; müşteri fark ederse bayi parayı iade eder.
//   4. İHBAR PENCERESİ bitiş tarihinden AYRI. "Daha 2 ay var" derken ihbar
//      süresi geçmiş olabiliyor ve sözleşme bir yıl daha uzuyor.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sz-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/sozlesme.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { sartFarklari, aylikNetEtki, sozlesmeTakvimi, zamDurumu, gunFarki } =
  await import(pathToFileURL(join(g, 'sozlesme.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const bul = (f, alan) => f.find((x) => x.alan === alan);

console.log('\nFARK YOKSA UYARI YOK\n');
{
  const s = { monthlyRent: 1500, includedBlack: 1000, pricePerBlack: 0.42 };
  t('birebir aynıysa fark yok', sartFarklari(s, { ...s }).length === 0, sartFarklari(s, { ...s }));
  // Sözleşmede konuşulmamış kalem karşılaştırılmaz.
  t('sözleşmede boş olan kalem karşılaştırılmıyor',
    sartFarklari({ monthlyRent: 1500 }, { monthlyRent: 1500, includedBlack: 999 }).length === 0);
  t('sistemde boş olan kalem karşılaştırılmıyor',
    sartFarklari({ monthlyRent: 1500, pricePerBlack: 0.5 }, { monthlyRent: 1500 }).length === 0);
  t('kuruş altı fark gürültü sayılmıyor',
    sartFarklari({ monthlyRent: 1500 }, { monthlyRent: 1500.002 }).length === 0);
}

console.log('\n★ KİRA FARKI — HER İKİ YÖN DE SÖYLENİYOR\n');
{
  const f = sartFarklari({ monthlyRent: 1500 }, { monthlyRent: 1200 });
  t('kira farkı bulundu', f.length === 1 && f[0].alan === 'monthlyRent', f);
  t('yön: eksik faturalama', f[0].yon === 'EKSIK_FATURALAMA', f[0]);
  t('aylık etki ₺300', f[0].aylikEtki === 300, f[0]);
  t('açıklama rakamları içeriyor', /1500/.test(f[0].aciklama) && /300/.test(f[0].aciklama), f[0].aciklama);
}
{
  const f = sartFarklari({ monthlyRent: 1200 }, { monthlyRent: 1500 });
  t('★ sistemde FAZLA yazılıysa fazla faturalama deniyor', f[0].yon === 'FAZLA_FATURALAMA', f[0]);
  t('fazla faturalamada da tutar veriliyor', f[0].aylikEtki === 300, f[0]);
  t('açıklamada "fazla" geçiyor', /fazla/.test(f[0].aciklama), f[0].aciklama);
}

console.log('\n★ DAHİL PAKETİN YÖNÜ TERS — KARIŞTIRILMAMALI\n');
{
  // Sözleşme 1.000 dahil, sistem 500 dahil, cihaz ayda 1.400 sayfa basıyor.
  // Sözleşmeye göre 400 sayfa aşım, sisteme göre 900 → 500 sayfa FAZLA
  // faturalanıyor. 500 × ₺0,42 = ₺210
  const f = sartFarklari(
    { includedBlack: 1000 },
    { includedBlack: 500, overagePriceBlack: 0.42 },
    1400,
  );
  const d = bul(f, 'includedBlack');
  t('★ sözleşmedeki paket büyükse FAZLA faturalıyoruz', d.yon === 'FAZLA_FATURALAMA', d);
  t('aylık etki ₺210', d.aylikEtki === 210, d);
  t('açıklama FAZLA diyor', /FAZLA/.test(d.aciklama), d.aciklama);
}
{
  // Ters yön: sözleşme 500 dahil, sistem 1.000 dahil → eksik faturalıyoruz.
  const f = sartFarklari(
    { includedBlack: 500 },
    { includedBlack: 1000, overagePriceBlack: 0.42 },
    1400,
  );
  const d = bul(f, 'includedBlack');
  t('★ sistemdeki paket büyükse EKSİK faturalıyoruz', d.yon === 'EKSIK_FATURALAMA', d);
  t('aylık etki ₺210', d.aylikEtki === 210, d);
}
{
  // Hacim iki paketin de ALTINDA: hiç aşım yok, para etkisi SIFIR olmalı.
  const f = sartFarklari(
    { includedBlack: 1000 },
    { includedBlack: 500, overagePriceBlack: 0.42 },
    300,
  );
  const d = bul(f, 'includedBlack');
  t('★ hacim iki paketin de altındaysa para etkisi sıfır', d.aylikEtki === 0, d);
  t('fark yine de bildiriliyor (sözleşmeye aykırı kayıt)', !!d, f);
}
{
  // Hacim iki paketin ARASINDA: yalnız gerçekten aşan kısım para eder.
  // Sözleşme 1.000, sistem 500, hacim 800 → sözleşmeye göre 0, sisteme göre
  // 300 aşım → 300 × 0,42 = ₺126
  const f = sartFarklari({ includedBlack: 1000 }, { includedBlack: 500, overagePriceBlack: 0.42 }, 800);
  t('hacim iki paket arasındaysa yalnız aşan kısım sayılıyor', bul(f, 'includedBlack').aylikEtki === 126, bul(f, 'includedBlack'));
}

console.log('\n★ ₺ UYDURULMUYOR\n');
{
  // Hacim verilmemiş: fark görünmeli ama tutar YAZILMAMALI.
  const f = sartFarklari({ includedBlack: 1000 }, { includedBlack: 500, overagePriceBlack: 0.42 });
  const d = bul(f, 'includedBlack');
  t('★ hacim bilinmiyorsa tutar null', d.aylikEtki === null, d);
  t('fark yine de gösteriliyor', d.sozlesmede === 1000 && d.sistemde === 500, d);
  t('açıklama "geçmiş yeterli değil" diyor', /yeterli değil/.test(d.aciklama), d.aciklama);
}
{
  // Aşım birim fiyatı da bilinmiyorsa tutar hesaplanamaz.
  const f = sartFarklari({ includedBlack: 1000 }, { includedBlack: 500 }, 1400);
  t('birim fiyat yoksa tutar null', bul(f, 'includedBlack').aylikEtki === null, bul(f, 'includedBlack'));
}
{
  // Aşım fiyatı boşsa sayfa fiyatına düşmeli (faturalama da öyle yapıyor).
  const f = sartFarklari({ includedBlack: 1000 }, { includedBlack: 500, pricePerBlack: 0.30 }, 1400);
  t('aşım fiyatı yoksa sayfa fiyatı kullanılıyor (₺150)', bul(f, 'includedBlack').aylikEtki === 150, bul(f, 'includedBlack'));
}

console.log('\nSAYFA VE AŞIM FİYATI FARKLARI\n');
{
  // Sözleşme ₺0,60 aşım, sistem ₺0,42. Hacim 1.400, dahil 1.000 → 400 aşan.
  // 400 × ₺0,18 = ₺72 eksik.
  const f = sartFarklari(
    { overagePriceBlack: 0.60 },
    { overagePriceBlack: 0.42, includedBlack: 1000 },
    1400,
  );
  const d = bul(f, 'overagePriceBlack');
  t('aşım fiyatı farkı bulundu', !!d, f);
  t('yön eksik faturalama', d.yon === 'EKSIK_FATURALAMA', d);
  t('★ yalnız AŞAN sayfada hesaplanıyor (₺72)', d.aylikEtki === 72, d);
}
{
  // Dahil paket hacmi karşılıyorsa aşım fiyatı farkı para etmiyor.
  const f = sartFarklari({ overagePriceBlack: 0.60 }, { overagePriceBlack: 0.42, includedBlack: 2000 }, 1400);
  t('aşım yoksa fiyat farkı ₺0', bul(f, 'overagePriceBlack').aylikEtki === 0, bul(f, 'overagePriceBlack'));
}
{
  const f = sartFarklari({ pricePerColor: 2.0 }, { pricePerColor: 1.5, includedColor: 0 }, null, 200);
  t('renkli sayfa fiyatı farkı (200 × ₺0,50 = ₺100)', bul(f, 'pricePerColor').aylikEtki === 100, bul(f, 'pricePerColor'));
}
{
  // 4 haneye kadar anlamlı: 0,4200 ile 0,4201 fark sayılır, 0,42000 sayılmaz.
  t('fiyatta 4. hane farkı yakalanıyor',
    sartFarklari({ pricePerBlack: 0.4201 }, { pricePerBlack: 0.4200 }).length === 1);
  t('fiyatta 5. hane gürültüsü yakalanmıyor',
    sartFarklari({ pricePerBlack: 0.42001 }, { pricePerBlack: 0.42 }).length === 0);
}

console.log('\nNET ETKİ\n');
{
  const f = sartFarklari(
    { monthlyRent: 1500, includedBlack: 1000 },
    { monthlyRent: 1200, includedBlack: 500, overagePriceBlack: 0.42 },
    1400,
  );
  const n = aylikNetEtki(f);
  t('eksik ₺300 (kira)', n.eksik === 300, n);
  t('fazla ₺210 (dahil paket)', n.fazla === 210, n);
  t('★ net ₺90 — iki yön birbirini götürüyor', n.net === 90, n);
  t('tutarı olmayan farklar toplama girmiyor',
    aylikNetEtki([{ yon: 'EKSIK_FATURALAMA', aylikEtki: null }]).eksik === 0);
}

console.log('\n★ İHBAR PENCERESİ BİTİŞ TARİHİNDEN AYRI\n');
{
  const bugun = new Date(2026, 8, 13);
  const gunSonra = (n) => new Date(2026, 8, 13 + n);
  {
    const k = sozlesmeTakvimi({ endDate: gunSonra(60), noticeDays: 30 }, bugun);
    t('bitime 60 gün', k.bitimeGun === 60, k);
    t('ihbara 30 gün', k.ihbaraGun === 30, k);
    t('ihbar kaçmadı', k.ihbarKacti === false, k);
  }
  {
    // ★ Asıl tuzak: bitişe daha 20 gün var ama ihbar süresi 30 gün —
    // pencere 10 gün önce kapandı. "Daha vaktim var" diye rahat olan bayi
    // sözleşmeyi bir yıl daha eski fiyattan uzatmış oluyor.
    const k = sozlesmeTakvimi({ endDate: gunSonra(20), noticeDays: 30 }, bugun);
    t('★ bitişe 20 gün varken ihbar penceresi KAÇMIŞ', k.ihbarKacti === true, k);
    t('kaç gün geçtiği yazıyor', k.ihbaraGun === -10, k);
    t('sözleşme henüz bitmemiş', k.bitmis === false, k);
  }
  {
    const k = sozlesmeTakvimi({ endDate: gunSonra(-5), noticeDays: 30 }, bugun);
    t('bitmiş sözleşme bitmiş görünüyor', k.bitmis === true && k.bitimeGun === -5, k);
    t('★ bitmiş sözleşmede "ihbar kaçtı" denmiyor (boşuna iş çıkmasın)', k.ihbarKacti === false, k);
  }
  {
    const k = sozlesmeTakvimi({ endDate: gunSonra(20), noticeDays: 0 }, bugun);
    t('ihbar süresi yoksa ihbar günü de yok', k.ihbarSonGun === null && k.ihbaraGun === null, k);
  }
  {
    // Saat farkı gün sayısını kaydırmamalı.
    const a = new Date(2026, 8, 13, 23, 59), b = new Date(2026, 8, 14, 0, 1);
    t('gün farkı saatten etkilenmiyor', gunFarki(a, b) === 1, gunFarki(a, b));
  }
}

console.log('\n★ ZAM MADDESİ\n');
{
  const bugun = new Date(2026, 8, 13);
  {
    const z = zamDurumu({ startDate: new Date(2026, 8, 13), escalationMonths: null }, 1500, bugun);
    t('madde yoksa uyarı yok', z.maddeVar === false && z.zamani === false, z);
  }
  {
    // 12 ayda bir, başlangıç 1 yıl önce → tam zamanı.
    const z = zamDurumu({ startDate: new Date(2025, 8, 13), escalationMonths: 12, escalationRate: 20 }, 1500, bugun);
    t('★ zamanı gelen zam bildiriliyor', z.zamani === true, z);
    t('aylık kayıp ₺300 (₺1.500 × %20)', z.aylikKayip === 300, z);
    t('gecikme 0 ay (tam bugün)', z.gecikenAy === 0, z);
  }
  {
    // 14 ay geçmiş: 2 ay gecikme.
    const z = zamDurumu({ startDate: new Date(2025, 6, 13), escalationMonths: 12, escalationRate: 20 }, 1500, bugun);
    t('★ geciken ay sayısı doğru (2)', z.gecikenAy === 2, z);
  }
  {
    // Zam yapılmışsa sayaç ORADAN başlar, sözleşme başından değil.
    const z = zamDurumu({
      startDate: new Date(2024, 0, 1), escalationMonths: 12, escalationRate: 20,
      lastEscalationAt: new Date(2026, 5, 1),
    }, 1500, bugun);
    t('★ son zam tarihinden sayılıyor (sözleşme başından değil)', z.zamani === false, z);
    t('sonraki zam 01.06.2027', z.sonrakiTarih.getFullYear() === 2027 && z.sonrakiTarih.getMonth() === 5, z.sonrakiTarih);
  }
  {
    // Oran sözleşmede yazmıyorsa (pazarlıkla) tutar UYDURULMAZ.
    const z = zamDurumu({ startDate: new Date(2025, 8, 13), escalationMonths: 12, escalationRate: null }, 1500, bugun);
    t('★ oran yoksa tutar uydurulmuyor', z.zamani === true && z.aylikKayip === null, z);
  }
  {
    const z = zamDurumu({ startDate: new Date(2025, 8, 13), escalationMonths: 12, escalationRate: 20 }, null, bugun);
    t('kira bilinmiyorsa tutar yok', z.aylikKayip === null, z);
  }
  {
    const z = zamDurumu({ startDate: new Date(2026, 5, 1), escalationMonths: 12, escalationRate: 20 }, 1500, bugun);
    t('zamanı gelmemişse kalan gün pozitif', z.zamani === false && z.kalanGun > 0, z);
  }
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
