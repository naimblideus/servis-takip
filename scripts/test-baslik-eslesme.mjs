// BAŞLIK EŞLEŞMESİ + FATURA ALANLARI — göç dosyası gerçekten okunuyor mu?
// Çalıştır:  node scripts/test-baslik-eslesme.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Göçün ilk adımı bir Excel dosyasının BAŞLIK satırını tanımak. Tanımazsa
// dosya "okundu" görünür, satırlar geçerli görünür, ama kolon boş kalır ve
// veri sessizce kaybolur. Bayi bunu ancak aylar sonra fark eder.
//
// Ölçülmüş gerçek hata: JavaScript'te /i bayrağı büyük İ'yi i'ye katlamıyor.
// "SERİ NO" başlığı /seri/i ile EŞLEŞMİYORDU ("SERI NO" eşleşiyordu). Excel
// büyük harf başlık çok yaygın; bu tuzağa düşen dosyada cihazların HİÇBİRİ
// aktarılamıyordu. Ters tuzak da var: tr-TR küçültme "FIRMA"yı "fırma"
// yapıyor. Test ikisini birden tutuyor.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const KOKDIZIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-bs-'));
try {
  execFileSync(process.execPath, [
    join(KOKDIZIN, 'node_modules/typescript/bin/tsc'), join(KOKDIZIN, 'src/lib/sheet-import.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { autoMap, basligiNormalle } = await import(pathToFileURL(join(g, 'sheet-import.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const esle = (baslik) => autoMap([baslik])[0];

console.log('\n★ BÜYÜK HARFLİ TÜRKÇE BAŞLIK (ölçülmüş hata)\n');
{
  t('SERİ NO → seri no (noktalı İ)', esle('SERİ NO') === 'serialNo', esle('SERİ NO'));
  t('SERI NO → seri no (noktasız I)', esle('SERI NO') === 'serialNo', esle('SERI NO'));
  t('VERGİ NO → vergi no', esle('VERGİ NO') === 'taxNo', esle('VERGİ NO'));
  t('FİRMA → müşteri', esle('FİRMA') === 'customerName', esle('FİRMA'));
  t('FIRMA → müşteri (ters tuzak: tr küçültme I→ı yapıyor)', esle('FIRMA') === 'customerName', esle('FIRMA'));
  t('İSİM → müşteri', esle('İSİM') === 'customerName', esle('İSİM'));
  t('MÜŞTERİ ADI → müşteri', esle('MÜŞTERİ ADI') === 'customerName', esle('MÜŞTERİ ADI'));
  t('TELEFON → telefon', esle('TELEFON') === 'phone', esle('TELEFON'));
  t('AYLIK KİRA → aylık kira', esle('AYLIK KİRA') === 'monthlyRent', esle('AYLIK KİRA'));
  t('küçük harfli yazım bozulmadı', esle('Seri No') === 'serialNo' && esle('seri no') === 'serialNo');
}

console.log('\nNORMALLEŞTİRME KENDİSİ\n');
{
  t('İ → i', basligiNormalle('SERİ') === 'seri', basligiNormalle('SERİ'));
  t('I → i (ı üzerinden)', basligiNormalle('FIRMA') === 'firma', basligiNormalle('FIRMA'));
  t('ş ğ ü ö ç katlanıyor', basligiNormalle('ŞĞÜÖÇ') === 'sguoc', basligiNormalle('ŞĞÜÖÇ'));
  t('araya giren boşluklar tekilleniyor', basligiNormalle('  Seri   No  ') === 'seri no', basligiNormalle('  Seri   No  '));
  t('boş başlık patlatmıyor', basligiNormalle('') === '' && basligiNormalle(null) === '');
}

console.log('\n★ DAR KALIP GENİŞ KALIBI YEMİYOR\n');
{
  // "Vergi Dairesi" /vergi/ kalıbına, "İlçe" /il/ kalıbına yakalanırdı.
  const m = autoMap(['Ünvan', 'Vergi No', 'Vergi Dairesi', 'İl', 'İlçe', 'Adres']);
  t('Ünvan → ticari unvan', m[0] === 'legalName', m);
  t('Vergi No → vergi no', m[1] === 'taxNo', m);
  t('★ Vergi Dairesi → vergi dairesi (vergi no DEĞİL)', m[2] === 'taxOffice', m);
  t('İl → il', m[3] === 'city', m);
  t('★ İlçe → ilçe (il DEĞİL)', m[4] === 'district', m);
  t('Adres → adres', m[5] === 'address', m);
  const b = autoMap(['VERGİ DAİRESİ', 'İLÇE']);
  t('büyük harfli hâlleri de doğru', b[0] === 'taxOffice' && b[1] === 'district', b);
}
{
  // "İl" tek başına il demek; "İlgili Kişi" ya da "İlan" değil.
  t('İlgili Kişi il sanılmıyor', esle('İlgili Kişi') !== 'city', esle('İlgili Kişi'));
  t('Bölüm konum olarak okunuyor', esle('BÖLÜM') === 'location', esle('BÖLÜM'));
  // "Daire No" Türkçe'de apartman dairesidir — vergi dairesi değil.
  t('Daire No vergi dairesi sanılmıyor', esle('Daire No') !== 'taxOffice', esle('Daire No'));
  t('V.D. vergi dairesi olarak okunuyor', esle('V.D.') === 'taxOffice', esle('V.D.'));
}

// ── UÇTAN UCA ────────────────────────────────────────────────────────────
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const p = new PrismaClient();
let sunucu = true;
try { await fetch(`${KOK}/api/rozetler`); } catch { sunucu = false; }

if (!sunucu) {
  console.log(`\n(uçtan uca ATLANDI: ${KOK} ayakta değil)\n`);
} else {
  const SLUG = 'test-baslik-eslesme';
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    const tenant = await p.tenant.create({
      data: {
        name: SLUG, slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2,
        users: { create: { email: 'baslik@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'ADMIN', isActive: true } },
      },
    });

    const c = await fetch(`${KOK}/api/auth/csrf`);
    const cc = (c.headers.get('set-cookie') || '').split(';')[0];
    const { csrfToken } = await c.json();
    const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
      body: new URLSearchParams({ email: 'baslik@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
      redirect: 'manual',
    });
    const cs = [cc];
    for (const x of (gy.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
    const cerez = cs.join('; ');

    const gonder = (csv, dryRun) => fetch(`${KOK}/api/import/sheet`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ csv, mapping: null, dryRun }),
    });

    console.log('\n★ BÜYÜK HARFLİ BAŞLIKLI DOSYA GERÇEKTEN AKTARILIYOR\n');
    {
      // Eski programdan çıkan tipik dosya: başlıklar TAMAMEN büyük harf.
      const csv = [
        'ÜNVAN;TELEFON;VERGİ NO;VERGİ DAİRESİ;İL;İLÇE;ADRES;MARKA;MODEL;SERİ NO',
        'Çetin Kırtasiye Tic. Ltd. Şti.;05551112233;1234567890;Mecidiyeköy;İstanbul;Şişli;Büyükdere Cad. 12;Kyocera;M2540;BSL-0001',
      ].join('\n');
      const d = await (await gonder(csv, true)).json();
      t('önizleme geçerli satır buluyor', d.validRows === 1, d);
      t('★ SERİ NO kolonu tanınıyor (eskiden tanınmıyordu)', d.sample?.[0]?.serialNo === 'BSL-0001', d.sample?.[0]);
      t('ünvan kolonu tek ad kolonuyken müşteri adı boş kalmıyor', d.sample?.[0]?.customerName === 'Çetin Kırtasiye Tic. Ltd. Şti.', d.sample?.[0]);

      const y = await (await gonder(csv, false)).json();
      t('aktarım müşteri ve cihaz oluşturdu', y.customersCreated === 1 && y.devicesCreated === 1, y);

      const m = await p.customer.findFirst({
        where: { tenantId: tenant.id },
        select: { name: true, legalName: true, taxNo: true, taxOffice: true, city: true, district: true, address: true },
      });
      t('ticari unvan yazıldı', m.legalName === 'Çetin Kırtasiye Tic. Ltd. Şti.', m);
      t('vergi dairesi vergi no ile karışmadı', m.taxOffice === 'Mecidiyeköy' && m.taxNo === '1234567890', m);
      t('il ve ilçe ayrı ayrı yazıldı', m.city === 'İstanbul' && m.district === 'Şişli', m);
      t('adres il/ilçeyle karışmadı', m.address === 'Büyükdere Cad. 12', m);

      const cihaz = await p.device.findFirst({ where: { tenantId: tenant.id }, select: { serialNo: true } });
      t('cihaz seri numarasıyla yazıldı', cihaz?.serialNo === 'BSL-0001', cihaz);
    }

    console.log('\nBOŞ KOLON MEVCUT BİLGİYİ SİLMİYOR\n');
    {
      // İkinci dosyada vergi dairesi kolonu YOK. Aynı müşteri tekrar
      // gelince, önceden girilmiş vergi dairesi silinmemeli.
      const csv = [
        'MÜŞTERİ;TELEFON;ADRES',
        'Çetin Kırtasiye;05551112233;Yeni Adres 5',
      ].join('\n');
      await gonder(csv, false);
      const m = await p.customer.findFirst({
        where: { tenantId: tenant.id },
        select: { taxOffice: true, city: true, district: true, legalName: true, address: true },
      });
      t('vergi dairesi duruyor', m.taxOffice === 'Mecidiyeköy', m);
      t('il/ilçe duruyor', m.city === 'İstanbul' && m.district === 'Şişli', m);
      t('ticari unvan duruyor', m.legalName === 'Çetin Kırtasiye Tic. Ltd. Şti.', m);
      t('dolu gelen adres güncellendi', m.address === 'Yeni Adres 5', m);
    }

    console.log('\nFATURA HAZIRLIĞI GÖÇTEN SONRA ÖLÇÜLEBİLİYOR\n');
    {
      const m = await p.customer.findFirst({
        where: { tenantId: tenant.id },
        select: { eInvoiceUser: true, eInvoiceCheckedAt: true },
      });
      // Aktarım bu soruyu CEVAPLAMIYOR ve cevaplamış gibi de yapmıyor:
      // mükellef sorgusu ayrı bir iş, varsayılanı "bilinmiyor".
      t('★ e-Fatura mükellefliği "bilinmiyor" kalıyor (false varsayılmıyor)', m.eInvoiceUser === null, m);
      t('sorgu tarihi de boş', m.eInvoiceCheckedAt === null, m);
    }

    console.log('\nBAYİ EKSİKLERİ ELLE DÜZELTEBİLİYOR\n');
    {
      const musteri = await p.customer.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });
      const yama = (govde) => fetch(`${KOK}/api/customers/${musteri.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify(govde),
      });

      // 'evet' → mükellef + sorgu tarihi damgalanıyor
      const y1 = await yama({ eInvoiceUser: 'evet' });
      const m1 = await p.customer.findFirst({ where: { id: musteri.id }, select: { eInvoiceUser: true, eInvoiceCheckedAt: true } });
      t('evet → mükellef', y1.ok && m1.eInvoiceUser === true, m1);
      t('★ sorgu tarihi damgalanıyor (ne zaman bakıldığı bilinsin)', m1.eInvoiceCheckedAt instanceof Date, m1);

      // 'hayir' → mükellef değil, ama SORULMUŞ
      await yama({ eInvoiceUser: 'hayir' });
      const m2 = await p.customer.findFirst({ where: { id: musteri.id }, select: { eInvoiceUser: true, eInvoiceCheckedAt: true } });
      t('hayır → mükellef değil', m2.eInvoiceUser === false, m2);
      t('hayır da bir cevaptır — tarih duruyor', m2.eInvoiceCheckedAt instanceof Date, m2);

      // '' → geri 'bilinmiyor'a dönüyor, tarih de siliniyor
      await yama({ eInvoiceUser: '' });
      const m3 = await p.customer.findFirst({ where: { id: musteri.id }, select: { eInvoiceUser: true, eInvoiceCheckedAt: true } });
      t('★ boş → bilinmiyor (false OLMUYOR)', m3.eInvoiceUser === null, m3);
      t('bilinmiyorken eski sorgu tarihi kalmıyor', m3.eInvoiceCheckedAt === null, m3);

      await yama({ legalName: 'Yeni Unvan A.Ş.', taxOffice: 'Kadıköy', city: 'İstanbul', district: 'Kadıköy', email: 'a@b.com' });
      const m4 = await p.customer.findFirst({ where: { id: musteri.id }, select: { legalName: true, taxOffice: true, city: true, district: true, email: true } });
      t('fatura alanları elle kaydedilebiliyor', m4.legalName === 'Yeni Unvan A.Ş.' && m4.taxOffice === 'Kadıköy' && m4.email === 'a@b.com', m4);

      // Boş gönderilen alan temizlenmeli — bayi yanlış girdiğini silebilsin.
      await yama({ taxOffice: '' });
      const m5 = await p.customer.findFirst({ where: { id: musteri.id }, select: { taxOffice: true, legalName: true } });
      t('boş gönderilen alan temizleniyor', m5.taxOffice === null, m5);
      t('gönderilmeyen alana dokunulmuyor', m5.legalName === 'Yeni Unvan A.Ş.', m5);
    }
  } finally {
    const e = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
    console.log('\n  (temizlik: test bayisi silindi)');
  }
}
await p.$disconnect();

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
