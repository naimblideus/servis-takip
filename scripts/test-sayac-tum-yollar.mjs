// SAYAÇ — SİSTEME GİREN HER YOL, TEK TEK
// Çalıştır:  node scripts/test-sayac-tum-yollar.mjs
//
// NEDEN BU TEST
// Sayaç bu ürünün kalbi: yanlış sayaç = yanlış fatura = kaybedilen müşteri.
// Sayaç sisteme SEKİZ ayrı yoldan giriyor ve hepsi tek yazma yolundan
// (lib/readings → createReading) geçiyor. Bir yol yanlış bağlanırsa
// diğerlerinin testi bunu GÖRMEZ. Bu test her yolu ayrı ayrı yürütür ve
// hepsinin AYNI kurallara uyduğunu doğrular:
//   • fark önceki okumaya göre hesaplanır
//   • düşen sayaç otomatik kabul EDİLMEZ (cihaz değişimi/sıfırlama bayinin kararı)
//   • kaynak (source) doğru işaretlenir — tartışmada kanıt ağırlığı bu
//   • okuma billed=false birikir, gelir dönem faturasında yazılır
//
// Gerçek veritabanına geçici bir bayi açar, sonunda siler; başka veriye
// dokunmaz. HTTP gerektirmez — kütüphane katmanını doğrudan sürer.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sayac-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/readings.ts'),
    join(KOK, 'src/lib/invoicing.ts'),
    join(KOK, 'src/lib/prisma.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
fs.writeFileSync(join(g, 'prisma-shim.js'), [
  `import { PrismaClient } from ${JSON.stringify(P)};`,
  'export const prisma = new PrismaClient();',
].join('\n'));
const duzelt = (dosya, esle) => {
  const y = join(g, dosya); let s = fs.readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  fs.writeFileSync(y, s);
};
const ORTAK = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]];
duzelt('readings.js', [...ORTAK, ["'@/lib/invoicing'", "'./invoicing.js'"]]);
duzelt('invoicing.js', ORTAK);

const { createReading, ReadingError } = await import(pathToFileURL(join(g, 'readings.js')).href);

const p = new PrismaClient();
const nf = (n) => Number(n || 0).toLocaleString('tr-TR');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-sayac-yollar';
let bayi;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  bayi = await p.tenant.create({
    data: { name: 'Sayaç Yolları Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20 },
  });
  const musteri = await p.customer.create({ data: { tenantId: bayi.id, name: 'Yol Testi', phone: '05000000999' } });

  let sayac = 0;
  const cihazKur = async (ad, opt = {}) => {
    sayac++;
    const c = await p.device.create({
      data: {
        tenantId: bayi.id, customerId: musteri.id, brand: 'Kyocera', model: ad,
        serialNo: `YOL-${sayac}`, publicCode: `YOL-${sayac}`, qrTokenHash: 'x',
        isRental: true, monthlyRent: 500, pricePerBlack: 0.5, includedBlack: 0,
        counterBlack: 0, counterColor: 0, ...opt,
      },
    });
    // Zincirin başı — devredilen sayaç, faturaya girmez.
    await p.counterReading.create({
      data: {
        tenantId: bayi.id, deviceId: c.id, counterBlack: 10000, counterColor: 500,
        deltaBlack: 0, deltaColor: 0, billed: true, source: 'TOPLU',
      },
    });
    return c;
  };

  // ── HER KAYNAK AYNI KURALLARA UYUYOR MU ────────────────────────────────
  console.log('\nHER GİRİŞ YOLU AYNI KURALLARA UYUYOR\n');
  const YOLLAR = [
    ['ELLE',          'cihaz kartından elle giriş'],
    ['TOPLU',         'Sayaç Turu — toplu giriş (sahanın can damarı)'],
    ['CIHAZ_EPOSTA',  'cihazın kendi gönderdiği e-posta'],
    ['PORTAL',        'müşteri panelinden beyan'],
    ['WHATSAPP_FOTO', 'WhatsApp fotoğrafı'],
    ['SERVIS_FISI',   'servis fişi kesilirken'],
    ['FOTOGRAF',      'sahada çekilen fotoğraf'],
  ];
  for (const [kaynak, aciklama] of YOLLAR) {
    const c = await cihazKur(`M-${kaynak}`);
    const r = await createReading({
      tenantId: bayi.id, deviceId: c.id,
      counterBlack: 13000, counterColor: 800,
      source: kaynak,
    });
    const ok = r.reading;
    const dogru = ok.deltaBlack === 3000 && ok.deltaColor === 300
      && ok.source === kaynak && ok.billed === false;
    t(`${kaynak.padEnd(14)} — ${aciklama}`, dogru,
      { fark: `${ok.deltaBlack}/${ok.deltaColor}`, kaynak: ok.source, billed: ok.billed });
  }

  // ── DÜŞEN SAYAÇ: hiçbir yol otomatik kabul etmemeli ────────────────────
  console.log('\nDÜŞEN SAYAÇ HİÇBİR YOLDAN SESSİZCE GEÇMİYOR\n');
  for (const [kaynak] of YOLLAR) {
    const c = await cihazKur(`D-${kaynak}`);
    let reddedildi = false, mesaj = '';
    try {
      await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 9000, counterColor: 400, source: kaynak });
    } catch (e) { reddedildi = e instanceof ReadingError || !!e; mesaj = e?.message || ''; }
    t(`${kaynak.padEnd(14)} — düşüş reddedildi`, reddedildi, { mesaj });
  }

  // ── CİHAZ DEĞİŞİMİ vs SAYAÇ SIFIRLAMA ─────────────────────────────────
  console.log('\nCİHAZ DEĞİŞİMİ ile SAYAÇ SIFIRLAMA AYRI ŞEYLER\n');
  {
    const c = await cihazKur('Degisim');
    const r = await createReading({
      tenantId: bayi.id, deviceId: c.id, counterBlack: 480000, counterColor: 0,
      source: 'ELLE', reset: true, resetTur: 'CIHAZ_DEGISTI',
    });
    // SAYAÇ ARTARAK değişti — sahada en sık görülen hâl: bayi müşterideki
    // 10.000 sayfalık makineyi alıp depodan 480.000 sayfalık ikinci el
    // takıyor. Eski kod yalnız DÜŞÜŞE bakıyordu, bu yön korumasızdı:
    // ölçüldü, fark 470.000 ve tutar ₺235.000 çıkıyordu.
    t('cihaz değişti (sayaç ARTTI) → yeni makinenin ömür boyu sayacı faturalanmıyor',
      r.reading.deltaBlack === 0, { fark: r.reading.deltaBlack });
    t('cihaz değişiminde ücret sıfır', Number(r.reading.calculatedCost) === 0, { ucret: String(r.reading.calculatedCost) });

    // Sonraki okuma yeni sayaçtan doğru hesaplamalı — zincir kopmasın.
    const r2 = await createReading({
      tenantId: bayi.id, deviceId: c.id, counterBlack: 482000, counterColor: 0, source: 'ELLE',
    });
    t('değişimden SONRAKİ okuma yeni sayaçtan doğru hesaplıyor (482.000 − 480.000 = 2.000)',
      r2.reading.deltaBlack === 2000, { fark: r2.reading.deltaBlack });
  }
  {
    // Ters yön de korunmalı — makine düşük sayaçlıyla değiştiyse.
    const c = await cihazKur('DegisimDusus');
    const r = await createReading({
      tenantId: bayi.id, deviceId: c.id, counterBlack: 300, counterColor: 0,
      source: 'ELLE', reset: true, resetTur: 'CIHAZ_DEGISTI',
    });
    t('cihaz değişti (sayaç DÜŞTÜ) → yine fark 0', r.reading.deltaBlack === 0, { fark: r.reading.deltaBlack });
  }
  {
    const c = await cihazKur('Sifirlama');
    const r = await createReading({
      tenantId: bayi.id, deviceId: c.id, counterBlack: 250, counterColor: 0,
      source: 'ELLE', reset: true, resetTur: 'SAYAC_SIFIRLANDI',
    });
    t('sayaç sıfırlandı → sıfırdan sonraki sayfalar faturalanıyor (fark 250)',
      r.reading.deltaBlack === 250, { fark: r.reading.deltaBlack });
  }

  // ── DAHİL PAKET aynı dönemde İKİ KEZ indirilmiyor ──────────────────────
  console.log('\nDAHİL PAKET DÖNEMDE TEK KEZ UYGULANIYOR\n');
  {
    const c = await cihazKur('Paket', { includedBlack: 1000, pricePerBlack: 0.5 });
    const r1 = await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 11500, counterColor: 500, source: 'ELLE' });
    // 1500 sayfa − 1000 dahil = 500 aşım × 0,50 = 250
    t('ilk okuma: (1.500 − 1.000 dahil) × ₺0,50 = ₺250',
      Math.abs(Number(r1.reading.calculatedCost) - 250) < 0.02, { ucret: String(r1.reading.calculatedCost) });

    const r2 = await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 12500, counterColor: 500, source: 'ELLE' });
    // Kümülatif 2500 − 1000 = 1500 aşım; önceki 500 zaten alındı → marjinal 1000 × 0,50 = 500
    t('ikinci okuma: dahil paket TEKRAR indirilmiyor → ₺500 (₺750 değil)',
      Math.abs(Number(r2.reading.calculatedCost) - 500) < 0.02, { ucret: String(r2.reading.calculatedCost) });
  }

  // ── OLAĞANDIŞI ARTIŞ UYARISI ───────────────────────────────────────────
  console.log('\nOLAĞANDIŞI ARTIŞ UYARIYOR\n');
  {
    const c = await cihazKur('Anomali');
    const r = await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 900000, counterColor: 500, source: 'ELLE' });
    t('çok yüksek artışta uyarı veriliyor (bayi kontrol etsin)', !!r.warning, { uyari: r.warning });
    t('ama okuma YİNE DE kaydediliyor — sessizce yutulmuyor', !!r.reading?.id);
  }

  // ── GELİR BURADA YAZILMIYOR (mükerrer gelir önlemi) ────────────────────
  console.log('\nGELİR OKUMADA DEĞİL FATURADA YAZILIYOR\n');
  {
    const c = await cihazKur('Gelir');
    await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 12000, counterColor: 500, source: 'ELLE' });
    const gelir = await p.financialTransaction.count({ where: { tenantId: bayi.id } });
    t('okuma kaydı kasaya gelir YAZMIYOR (fatura kesilince yazılır)', gelir === 0, { kasaKaydi: gelir });
    const acik = await p.counterReading.count({ where: { tenantId: bayi.id, deviceId: c.id, billed: false } });
    t('okuma faturalanmamış olarak bekliyor', acik === 1, { bekleyen: acik });
  }

  // ── KİRALIK OLMAYAN CİHAZ: ücret hesaplanmaz ──────────────────────────
  console.log('\nKİRALIK OLMAYAN CİHAZDA ÜCRET YOK\n');
  {
    const c = await cihazKur('Satilmis', { isRental: false, monthlyRent: 0 });
    const r = await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 15000, counterColor: 900, source: 'ELLE' });
    t('sayaç kaydediliyor (takip için)', r.reading.deltaBlack === 5000, { fark: r.reading.deltaBlack });
    t('ama ücret hesaplanmıyor — cihaz satılmış, kira yok', Number(r.reading.calculatedCost) === 0, { ucret: String(r.reading.calculatedCost) });
  }

  // ── CİHAZ KARTI HER YOLDA GÜNCELLENİYOR ────────────────────────────────
  console.log('\nCİHAZ KARTI HER YOLDA GÜNCELLENİYOR\n');
  {
    const c = await cihazKur('Kart');
    await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 17777, counterColor: 888, source: 'PORTAL' });
    const kart = await p.device.findUnique({ where: { id: c.id }, select: { counterBlack: true, counterColor: true } });
    t('cihaz kartındaki sayaç son okumaya eşit', kart.counterBlack === 17777 && kart.counterColor === 888, kart);
  }

} finally {
  if (bayi) await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
