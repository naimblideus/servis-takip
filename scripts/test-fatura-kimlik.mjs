// FATURA KİMLİĞİ — müşteri elektronik faturaya hazır mı?
// Çalıştır:  node scripts/test-fatura-kimlik.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu dosyadaki kural üç yerde birden kullanılacak: müşteri formu, göç
// sonrası özet, fatura kesme. Üçünün AYNI cevabı vermesi bu kuralın tek
// yerde ve doğru olmasına bağlı. Test ettiğim asıl şeyler:
//
//   1. "Sorulmadı" ile "mükellef değil" KARIŞMAMALI. Karışırsa mükellef bir
//      müşteriye e-Arşiv kesilir — yanlış belge.
//   2. Şahıs müşteriden kurum alanı istenmemeli. İstenirse bayi hiçbir
//      zaman "hazır" göremez ve listeye güvenmeyi bırakır.
//   3. Vergi no türü NUMARANIN KENDİSİNDEN çıkmalı; ayrı bir kutucuk
//      numarayla çelişebilirdi.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-fk-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/fatura-kimlik.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const {
  vergiKimlikTuru, faturaAdi, faturaYolu, faturaEksikleri, faturaHazir,
  faturaHazirlikOzeti,
} = await import(pathToFileURL(join(g, 'fatura-kimlik.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// Eksiksiz kurum müşterisi — testlerin çıkış noktası.
const KURUM = {
  name: 'Ahmet Bey Fotokopi',
  legalName: 'Çetin Kırtasiye Tic. Ltd. Şti.',
  taxNo: '1234567890',
  taxOffice: 'Mecidiyeköy',
  address: 'Eski Büyükdere Cad. No:12',
  city: 'İstanbul',
  district: 'Şişli',
  email: 'muhasebe@cetin.com',
  eInvoiceUser: true,
};
const SAHIS = {
  name: 'Mehmet Naim Çetin',
  taxNo: '12345678901',
  address: 'Barbaros Mah. 5/3',
  city: 'İstanbul',
  district: 'Ataşehir',
  email: 'mnc@ornek.com',
  eInvoiceUser: false,
};

console.log('\nVERGİ NO TÜRÜ NUMARADAN ÇIKIYOR\n');
{
  t('10 hane kurum (VKN)', vergiKimlikTuru('1234567890') === 'VKN');
  t('11 hane şahıs (TCKN)', vergiKimlikTuru('12345678901') === 'TCKN');
  t('boşluklu/tireli numara da okunuyor', vergiKimlikTuru(' 123 456 7890 ') === 'VKN', vergiKimlikTuru(' 123 456 7890 '));
  t('9 hane geçersiz', vergiKimlikTuru('123456789') === null);
  t('12 hane geçersiz', vergiKimlikTuru('123456789012') === null);
  t('boş geçersiz', vergiKimlikTuru('') === null && vergiKimlikTuru(null) === null);
}

console.log('\nFATURAYA YAZILAN AD\n');
{
  t('unvan varsa unvan yazıyor', faturaAdi(KURUM) === 'Çetin Kırtasiye Tic. Ltd. Şti.', faturaAdi(KURUM));
  t('unvan yoksa defterdeki ad', faturaAdi({ ...KURUM, legalName: null }) === 'Ahmet Bey Fotokopi');
  t('unvan sadece boşluksa defterdeki ad', faturaAdi({ ...KURUM, legalName: '   ' }) === 'Ahmet Bey Fotokopi');
}

console.log('\n★ "SORULMADI" İLE "MÜKELLEF DEĞİL" AYRI ŞEYLER\n');
{
  t('true → e-Fatura', faturaYolu(KURUM) === 'e-Fatura');
  t('false → e-Arşiv', faturaYolu(SAHIS) === 'e-Arşiv');
  t('null → yol bilinmiyor (e-Arşiv SAYILMIYOR)', faturaYolu({ ...KURUM, eInvoiceUser: null }) === null);
  t('alan hiç yoksa da yol bilinmiyor', faturaYolu({ ...KURUM, eInvoiceUser: undefined }) === null);
  const e = faturaEksikleri({ ...KURUM, eInvoiceUser: null });
  t('sorulmamışsa eksik sayılıyor', e.some((x) => /sorgulanmam/.test(x)), e);
  t('★ sorulmamış müşteri HAZIR görünmüyor', !faturaHazir({ ...KURUM, eInvoiceUser: null }));
}

console.log('\nHAZIR MÜŞTERİLER\n');
{
  t('eksiksiz kurum hazır', faturaHazir(KURUM), faturaEksikleri(KURUM));
  t('eksiksiz şahıs hazır', faturaHazir(SAHIS), faturaEksikleri(SAHIS));
}

console.log('\n★ ŞAHISTAN KURUM ALANI İSTENMİYOR\n');
{
  const e = faturaEksikleri(SAHIS);
  t('şahıstan ticari unvan istenmiyor', !e.some((x) => /unvan/i.test(x)), e);
  t('şahıstan vergi dairesi istenmiyor', !e.some((x) => /vergi dairesi/i.test(x)), e);
  const k = faturaEksikleri({ ...KURUM, legalName: null, taxOffice: null });
  t('kurumdan ticari unvan isteniyor', k.some((x) => /unvan/i.test(x)), k);
  t('kurumdan vergi dairesi isteniyor', k.some((x) => /vergi dairesi/i.test(x)), k);
}

console.log('\nADRES PARÇALARI AYRI AYRI İSTENİYOR\n');
{
  // Serbest metin adres dolu olsa BİLE il/ilçe ayrı isteniyor: fatura
  // biçiminde bunlar ayrı alanlar, serbest metinden ayrıştırmak tahmindir.
  const e = faturaEksikleri({ ...KURUM, city: null, district: null });
  t('adres dolu olsa da il isteniyor', e.some((x) => /İl yok/.test(x)), e);
  t('adres dolu olsa da ilçe isteniyor', e.some((x) => /İlçe yok/.test(x)), e);
  t('adres boşsa adres de isteniyor', faturaEksikleri({ ...KURUM, address: '  ' }).some((x) => /Adres yok/.test(x)));
}

console.log('\ne-ARŞİV MÜŞTERİSİNE ULAŞILABİLMELİ\n');
{
  const e = faturaEksikleri({ ...SAHIS, email: null });
  t('e-Arşiv müşterisinde e-posta isteniyor', e.some((x) => /e-posta/i.test(x)), e);
  // e-Fatura sistem üzerinden gidiyor; e-posta olmaması engel değil.
  t('e-Fatura müşterisinde e-posta zorunlu değil', faturaHazir({ ...KURUM, email: null }), faturaEksikleri({ ...KURUM, email: null }));
}

console.log('\nVERGİ NO HATA MESAJI AYIRT EDİCİ\n');
{
  const bos = faturaEksikleri({ ...KURUM, taxNo: null });
  const bozuk = faturaEksikleri({ ...KURUM, taxNo: '12345' });
  t('numara hiç yoksa "yok" diyor', bos.some((x) => /Vergi no ya da TC kimlik no yok/.test(x)), bos);
  t('numara bozuksa hane sayısını söylüyor', bozuk.some((x) => /10 hane.*11 hane/.test(x)), bozuk);
}

// GİB numara biçiminin testi test-fatura-belgesi.mjs'te (yıl dönüşü ve
// sıra boşluğu dahil) — buradaki kopya kaldırıldı.


console.log('\nGÖÇ SONRASI ÖZET — BAYİ NEREDEN BAŞLASIN\n');
{
  const liste = [
    KURUM,
    SAHIS,
    { ...KURUM, taxOffice: null },
    { ...KURUM, taxOffice: null, eInvoiceUser: null },
    { ...KURUM, eInvoiceUser: null },
    { ...KURUM, eInvoiceUser: null },
  ];
  const o = faturaHazirlikOzeti(liste);
  t('toplam doğru', o.toplam === 6, o);
  t('hazır sayısı doğru', o.hazir === 2, o);
  t('eksik sayısı doğru', o.eksik === 4, o);
  // Sorgulanmamış 3, vergi dairesi 2 — bayi tek işle en çok müşteriyi
  // hazır edeceği yeri en üstte görmeli.
  t('★ en sık eksik başta (sorgulanmamış ×3)', o.enSikEksikler[0].adet === 3 && /sorgulanmam/.test(o.enSikEksikler[0].eksik), o.enSikEksikler);
  t('sıra azalan', o.enSikEksikler.every((x, i, a) => i === 0 || a[i - 1].adet >= x.adet), o.enSikEksikler);
  t('vergi dairesi eksiği de sayılmış', o.enSikEksikler.some((x) => /vergi dairesi/i.test(x.eksik) && x.adet === 2), o.enSikEksikler);
  t('boş listede patlamıyor', faturaHazirlikOzeti([]).toplam === 0 && faturaHazirlikOzeti([]).hazir === 0);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
