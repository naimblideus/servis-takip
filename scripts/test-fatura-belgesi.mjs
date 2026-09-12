// e-BELGE — entegratöre gidecek kanonik fatura nesnesi
// Çalıştır:  node scripts/test-fatura-belgesi.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu nesne müşteriye giden RESMÎ belgenin içeriği. En pahalı hata, belgedeki
// tutarın defterdekinden farklı olması: müşteriye bizim takip ettiğimizden
// başka bir rakam gitmiş olur ve bunu ne bayi ne müşteri fark eder, ikisi de
// kendi kâğıdına bakar. Test ettiğim asıl şeyler:
//
//   1. TOPLAMLAR FATURAYLA TUTMALI, tutmuyorsa belge ÜRETİLMEMELİ.
//   2. EKSİK BİLGİYLE BELGE ÜRETİLMEMELİ — yarım belge, belge olmamasından
//      daha kötü: gönderilir, reddedilir, bayi neden olduğunu bilmez.
//   3. "SORULMAMIŞ" MÜKELLEFLİK e-Arşiv SAYILMAMALI (yanlış belge türü).
//   4. GİB SIRASINDA BOŞLUK OLMAMALI ve yıl dönünce 1'den başlamalı.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-eb-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/fatura-belgesi.ts'), join(KOK, 'src/lib/fatura-kimlik.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
// Derlenen dosya '@/lib/fatura-kimlik' diye içe aktarıyor; yerel yola çevir.
{
  const fs = await import('node:fs');
  const yol = join(g, 'fatura-belgesi.js');
  fs.writeFileSync(yol, fs.readFileSync(yol, 'utf8').split("'@/lib/fatura-kimlik'").join("'./fatura-kimlik.js'"), 'utf8');
}
const {
  ettnUret, belgeSenaryosu, gibNumarasiUret, saticiEksikleri, belgeEksikleri, eBelgeUret,
} = await import(pathToFileURL(join(g, 'fatura-belgesi.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const patla = (f) => { try { f(); return null; } catch (e) { return e.message; } };

const SATICI = {
  name: 'Nextus Fotokopi Ltd. Şti.',
  taxNumber: '9876543210', taxOffice: 'Beşiktaş',
  address: 'Barbaros Bulvarı 15', city: 'İstanbul', district: 'Beşiktaş',
  phone: '02121234567', email: 'bayi@nextus.com', eFaturaEtiket: 'NXS',
};
const ALICI = {
  name: 'Ahmet Bey Fotokopi',
  legalName: 'Çetin Kırtasiye Tic. Ltd. Şti.',
  taxNo: '1234567890', taxOffice: 'Mecidiyeköy',
  address: 'Büyükdere Cad. 12', city: 'İstanbul', district: 'Şişli',
  email: 'muhasebe@cetin.com', eInvoiceUser: true,
};
// 1.500 kira + 450 sayaç = 1.950 matrah · %20 KDV 390 · toplam 2.340
const FATURA = {
  invoiceNumber: 'SF-FAT-2026-00001',
  invoiceDate: new Date(2026, 8, 13),
  subtotal: 1950, vatRate: 20, vatAmount: 390, totalAmount: 2340,
  notes: 'Ağustos dönemi',
};
const SATIRLAR = [
  { aciklama: 'Kyocera M2540 aylık kira', miktar: 1, birimFiyat: 1500, tutar: 1500, kdvOrani: null },
  { aciklama: 'S/B sayaç 1.000 sayfa', miktar: 1000, birimFiyat: 0.45, tutar: 450, kdvOrani: null },
];
const uret = (ek = {}) => eBelgeUret({
  satici: SATICI, alici: ALICI, fatura: FATURA, satirlar: SATIRLAR,
  ettn: '11111111-2222-3333-4444-555555555555', gibNo: 'NXS2026000000001', ...ek,
});

console.log('\nETTN\n');
{
  const a = ettnUret(), b = ettnUret();
  t('UUID biçiminde', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a), a);
  t('her çağrıda farklı', a !== b);
}

console.log('\n★ "SORULMAMIŞ" MÜKELLEFLİK e-ARŞİV SAYILMIYOR\n');
{
  t('mükellef → TEMELFATURA', belgeSenaryosu({ eInvoiceUser: true }) === 'TEMELFATURA');
  t('mükellef değil → EARSIVFATURA', belgeSenaryosu({ eInvoiceUser: false }) === 'EARSIVFATURA');
  t('★ sorulmamış → null (e-Arşiv DEĞİL)', belgeSenaryosu({ eInvoiceUser: null }) === null);
  const h = patla(() => uret({ alici: { ...ALICI, eInvoiceUser: null } }));
  t('sorulmamışken belge üretilmiyor', h !== null, h);
}

console.log('\n★ GİB SIRASI — BOŞLUK YOK, YIL DÖNÜNCE SIFIRLANIYOR\n');
{
  const a = gibNumarasiUret('NXS', 2026, 0, null);
  t('ilk belge 1. sıra', a.no === 'NXS2026000000001' && a.sira === 1, a);
  const b = gibNumarasiUret('NXS', 2026, a.sira, a.yil);
  t('sonraki belge 2. sıra (atlamıyor)', b.no === 'NXS2026000000002' && b.sira === 2, b);
  const c = gibNumarasiUret('NXS', 2027, b.sira, b.yil);
  t('★ yıl dönünce 1den başlıyor', c.no === 'NXS2027000000001' && c.sira === 1, c);
  t('16 karakter', a.no.length === 16, a.no.length);
  t('küçük harf ön ek büyütülüyor', gibNumarasiUret('nxs', 2026, 0, null).no === 'NXS2026000000001');
  t('ön ek yoksa hata', patla(() => gibNumarasiUret(null, 2026, 0, null)) !== null);
  t('2 harflik ön ek reddediliyor', patla(() => gibNumarasiUret('NX', 2026, 0, null)) !== null);
  t('yıllık sıra dolunca hata', patla(() => gibNumarasiUret('NXS', 2026, 999999999, 2026)) !== null);
}

console.log('\nSATICI EKSİKLERİ\n');
{
  t('eksiksiz satıcıda eksik yok', saticiEksikleri(SATICI).length === 0, saticiEksikleri(SATICI));
  t('vergi dairesi eksiği yakalanıyor', saticiEksikleri({ ...SATICI, taxOffice: null }).some((x) => /vergi dairesi/i.test(x)));
  t('ön ek/etiket eksiği yakalanıyor', saticiEksikleri({ ...SATICI, eFaturaEtiket: null }).some((x) => /etiket/i.test(x)));
  t('hatalı VKN yakalanıyor', saticiEksikleri({ ...SATICI, taxNumber: '123' }).some((x) => /vergi numaras/i.test(x)));
}

console.log('\n★ EKSİK BİLGİYLE BELGE ÜRETİLMİYOR\n');
{
  const h1 = patla(() => uret({ alici: { ...ALICI, taxOffice: null } }));
  t('alıcının vergi dairesi yoksa üretilmiyor', h1 !== null && /Alıcı/.test(h1), h1);
  const h2 = patla(() => uret({ satici: { ...SATICI, city: null } }));
  t('satıcının ili yoksa üretilmiyor', h2 !== null && /Satıcı/.test(h2), h2);
  const h3 = patla(() => uret({ satirlar: [] }));
  t('kalemsiz fatura üretilmiyor', h3 !== null && /kalem/.test(h3), h3);
  const h4 = patla(() => uret({
    fatura: { ...FATURA, subtotal: 0, vatAmount: 0, totalAmount: 0 }, satirlar: [{ ...SATIRLAR[0], tutar: 0, birimFiyat: 0 }],
  }));
  t('sıfır tutarlı fatura üretilmiyor', h4 !== null && /sıfır/.test(h4), h4);
  // Eksikler TEK TEK yazılmalı: "eksik var" demek bayiye hiçbir şey söylemez.
  const h5 = patla(() => uret({ alici: { ...ALICI, taxOffice: null, city: null, district: null } }));
  t('eksiklerin hepsi tek tek listeleniyor', (h5.match(/·/g) || []).length >= 3, h5);
  t('eksik listesi bayiye eksikleri gösteriyor', belgeEksikleri(SATICI, { ...ALICI, city: null }, FATURA, SATIRLAR).length === 1);
}

console.log('\nBELGE İÇERİĞİ\n');
{
  const b = uret();
  t('senaryo TEMELFATURA', b.senaryo === 'TEMELFATURA', b.senaryo);
  t('belge tipi SATIS', b.faturaTipi === 'SATIS');
  t('para birimi TRY', b.paraBirimi === 'TRY');
  t('tarih yyyy-aa-gg', b.tarih === '2026-09-13', b.tarih);
  t('★ alıcı adı TESCİLLİ UNVAN (defterdeki ad değil)', b.alici.unvan === 'Çetin Kırtasiye Tic. Ltd. Şti.', b.alici.unvan);
  t('alıcı kimlik türü VKN (10 hane)', b.alici.kimlikTuru === 'VKN' && b.alici.kimlikNo === '1234567890', b.alici);
  t('il ve ilçe ayrı alanlarda', b.alici.il === 'İstanbul' && b.alici.ilce === 'Şişli', b.alici);
  t('satıcı VKN yalnız rakam', b.satici.vkn === '9876543210', b.satici.vkn);
  t('kalemler sıralı', b.satirlar.map((s) => s.sira).join(',') === '1,2', b.satirlar);
  t('birim kodu C62 (adet)', b.satirlar.every((s) => s.birim === 'C62'));
  t('not taşınıyor', b.not === 'Ağustos dönemi', b.not);
}
{
  // Şahıs müşteri: unvan yok, defterdeki ad faturaya yazılır; TCKN 11 hane.
  const b = eBelgeUret({
    satici: SATICI,
    alici: {
      name: 'Mehmet Naim Çetin', taxNo: '12345678901',
      address: 'Barbaros Mah. 5/3', city: 'İstanbul', district: 'Ataşehir',
      email: 'mnc@ornek.com', eInvoiceUser: false,
    },
    fatura: FATURA, satirlar: SATIRLAR,
    ettn: 'x', gibNo: 'NXS2026000000002',
  });
  t('şahısta senaryo EARSIVFATURA', b.senaryo === 'EARSIVFATURA', b.senaryo);
  t('şahısta kimlik türü TCKN', b.alici.kimlikTuru === 'TCKN', b.alici.kimlikTuru);
  t('unvan yoksa defterdeki ad yazılıyor', b.alici.unvan === 'Mehmet Naim Çetin', b.alici.unvan);
}

console.log('\n★ DEFTER İLE BELGE AYRIŞMIYOR\n');
{
  const b = uret();
  t('matrah faturayla aynı', b.toplamlar.matrah === 1950, b.toplamlar);
  t('KDV faturayla aynı', b.toplamlar.kdv === 390, b.toplamlar);
  t('genel toplam faturayla aynı', b.toplamlar.genelToplam === 2340, b.toplamlar);
  t('kalem KDVleri toplamı genel KDVye eşit',
    Math.round(b.satirlar.reduce((x, s) => x + s.kdvTutari, 0) * 100) / 100 === b.toplamlar.kdv, b.satirlar);

  // Kalem toplamı faturayla tutmuyorsa BELGE ÜRETİLMEMELİ.
  const h1 = patla(() => uret({ satirlar: [{ ...SATIRLAR[0], tutar: 1400 }, SATIRLAR[1]] }));
  t('★ kalem toplamı matrahla tutmuyorsa üretilmiyor', h1 !== null && /matrah/.test(h1), h1);
  const h2 = patla(() => uret({ fatura: { ...FATURA, vatAmount: 500 } }));
  t('★ KDV faturayla tutmuyorsa üretilmiyor', h2 !== null && /KDV/.test(h2), h2);
  const h3 = patla(() => uret({ fatura: { ...FATURA, totalAmount: 9999 } }));
  t('★ genel toplam tutmuyorsa üretilmiyor', h3 !== null && /toplam/.test(h3), h3);
}

console.log('\nKALEM BAZINDA KDV — ORAN ORAN AYRIŞIYOR\n');
{
  // Tek oran: özet tek satır, faturayla birebir.
  const b = uret();
  t('tek oranda özet tek satır', b.kdvOzeti.length === 1, b.kdvOzeti);
  t('özet oranı %20', b.kdvOzeti[0].oran === 20 && b.kdvOzeti[0].matrah === 1950 && b.kdvOzeti[0].tutar === 390, b.kdvOzeti);
}
{
  // İki oran: 1.000 (%20 → 200) + 1.000 (%10 → 100) = matrah 2.000, KDV 300
  const satirlar = [
    { aciklama: 'Kira', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: null },
    { aciklama: 'İndirimli kalem', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: 10 },
  ];
  const fatura = { ...FATURA, subtotal: 2000, vatRate: 20, vatAmount: 300, totalAmount: 2300 };
  const b = eBelgeUret({ satici: SATICI, alici: ALICI, fatura, satirlar, ettn: 'x', gibNo: 'y' });
  t('★ iki farklı oran ayrı ayrı özetleniyor', b.kdvOzeti.length === 2, b.kdvOzeti);
  t('özet küçük orandan büyüğe sıralı', b.kdvOzeti[0].oran === 10 && b.kdvOzeti[1].oran === 20, b.kdvOzeti);
  t('%10 matrahı ve KDVsi doğru', b.kdvOzeti[0].matrah === 1000 && b.kdvOzeti[0].tutar === 100, b.kdvOzeti[0]);
  t('%20 matrahı ve KDVsi doğru', b.kdvOzeti[1].matrah === 1000 && b.kdvOzeti[1].tutar === 200, b.kdvOzeti[1]);
  t('toplam KDV 300', b.toplamlar.kdv === 300, b.toplamlar);
  t('oranı boş olan kalem faturanın genel oranını alıyor', b.satirlar[0].kdvOrani === 20, b.satirlar[0]);
  t('oranı yazılı kalem kendi oranını koruyor', b.satirlar[1].kdvOrani === 10, b.satirlar[1]);
}
{
  // Kalem oranları faturanın KDV tutarıyla çelişiyorsa belge üretilmemeli:
  // burada oranlar 300 üretir ama fatura 400 diyor.
  const satirlar = [
    { aciklama: 'A', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: null },
    { aciklama: 'B', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: 10 },
  ];
  const fatura = { ...FATURA, subtotal: 2000, vatRate: 20, vatAmount: 400, totalAmount: 2400 };
  const h = patla(() => eBelgeUret({ satici: SATICI, alici: ALICI, fatura, satirlar, ettn: 'x', gibNo: 'y' }));
  t('★ kalem oranları faturanın KDVsiyle çelişirse üretilmiyor', h !== null && /KDV/.test(h), h);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
