// SAYAÇ E-POSTASI — UÇTAN UCA CANLI TEST
// Çalıştır:  node scripts/test-sayac-uctan-uca.mjs
//
// NEDEN AYRI TEST
// Diğer sayaç testleri ayrıştırıcıyı ve hesabı YALITILMIŞ olarak doğruluyor.
// Bu test zincirin TAMAMINI gerçek HTTP üzerinden çalıştırıyor: cihazın
// gönderdiği biçimde bir Kyocera raporu → /api/sayac/eposta → bayi kodundan
// kiracı → seriden cihaz → okuma kaydı → fark → ücret → cihaz kartı.
// Ayrıştırıcı doğru ama uç yanlış bağlanmışsa bunu yalnız bu test görür.
//
// ÖN KOŞUL: `npm run dev` açık (port 3002) ve .env'de SAYAC_EPOSTA_SECRET var.
// Sunucu kapalıysa test ATLANIR, hata vermez.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const UC = process.env.SAYAC_TEST_UC || 'http://localhost:3002/api/sayac/eposta';
const SIR = process.env.SAYAC_EPOSTA_SECRET;

const nf = (n) => Number(n || 0).toLocaleString('tr-TR');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

if (!SIR) {
  console.log('ATLANDI: SAYAC_EPOSTA_SECRET tanımlı değil (.env).');
  await p.$disconnect();
  process.exit(0);
}
try {
  const y = await fetch(UC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!y) throw new Error('yanıt yok');
} catch {
  console.log(`ATLANDI: ${UC} ayakta değil (önce npm run dev).`);
  await p.$disconnect();
  process.exit(0);
}

const SLUG = 'test-sayac-e2e';
let bayi;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  // Kendi bayisini kurar — başka veriye dokunmaz, sonunda siler.
  bayi = await p.tenant.create({
    data: { name: 'Sayaç E2E Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.4, vatRate: 20 },
  });
  // Bayi kodu DB trigger'ıyla üretiliyor; okumak için geri çek.
  const kod = (await p.tenant.findUnique({ where: { id: bayi.id }, select: { sayacEpostaKodu: true } })).sayacEpostaKodu;
  t('bayi kodu otomatik üretildi (DB trigger)', !!kod && kod.length >= 4, { kod });
  if (!kod) throw new Error('bayi kodu yok — trigger çalışmamış');

  const musteri = await p.customer.create({ data: { tenantId: bayi.id, name: 'E2E Müşteri', phone: '05000000777' } });
  const SERI = 'E2E-TEST-0001';
  const cihaz = await p.device.create({
    data: {
      tenantId: bayi.id, customerId: musteri.id, brand: 'Kyocera', model: 'ECOSYS M2540dn',
      serialNo: SERI, publicCode: SERI, qrTokenHash: 'x',
      isRental: true, monthlyRent: 1000, pricePerBlack: 0.4, includedBlack: 1000,
      counterBlack: 0, counterColor: 0,
    },
  });
  // Zincirin başı — devredilen sayaç, faturalanmaz.
  await p.counterReading.create({
    data: {
      tenantId: bayi.id, deviceId: cihaz.id, counterBlack: 90000, counterColor: 0,
      deltaBlack: 0, deltaColor: 0, billed: true, source: 'TOPLU',
    },
  });

  const SIYAH_OZEL = 93417;    // 'Black & White' — faturalanan siyah sayaç budur
  const RENKLI = 733;          // 'Full Color' — bu da faturalanır
  const TOPLAM_BASKI = 94150;  // 'Total Print' renkliyi de içerir, FATURALIK DEĞİL
  const BEKLENEN_FARK = SIYAH_OZEL - 90000;

  const rapor = [
    'Counter Report', '',
    'Model Name        : ECOSYS M2540dn',
    `Serial Number     : ${SERI}`,
    'Report Date       : 08/09/2026 07:14', '',
    '[Print Counter]',
    `  Total Print     : ${TOPLAM_BASKI}`,
    `  Black & White   : ${SIYAH_OZEL}`,
    `  Full Color      : ${RENKLI}`, '',
    '[Scan Counter]',
    '  Total Scan      : 41255', '',
    '[Toner Coverage]',
    '  Black           : 47%',
  ].join('\r\n');

  const adres = `nextussayac+${kod}@gmail.com`;
  const gonder = (metin = rapor) => fetch(UC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sayac-secret': SIR },
    body: JSON.stringify({ to: adres, from: 'ECOSYS@musteri.local', subject: `Counter Report - ${SERI}`, text: metin }),
  });

  console.log(`\nGERÇEK RAPOR → ${adres}\n`);
  const c1 = await gonder();
  const g1 = await c1.json().catch(() => ({}));
  t('uç 2xx döndü (köprü ancak 2xx görünce mesajı işaretler)', c1.status >= 200 && c1.status < 300, { durum: c1.status });
  t('bayi ADRESTEKİ KODDAN bulundu', g1.bayi === 'kodla belirlendi', { bayi: g1.bayi });
  t('rapor işlendi', g1.islenen === 1, g1);

  const okuma = await p.counterReading.findFirst({
    where: { deviceId: cihaz.id }, orderBy: { createdAt: 'desc' },
    select: { counterBlack: true, counterColor: true, deltaBlack: true, deltaColor: true, calculatedCost: true, source: true, billed: true },
  });
  console.log(`  okuma: sayaç ${nf(okuma?.counterBlack)} · fark ${nf(okuma?.deltaBlack)} · ücret ${okuma?.calculatedCost}`);
  t('SİYAH ÖZEL sütunu okundu — "Total Print" DEĞİL (o renkliyi de içerir)',
    okuma?.counterBlack === SIYAH_OZEL, { okunan: okuma?.counterBlack, beklenen: SIYAH_OZEL, totalPrint: TOPLAM_BASKI });
  t(`fark doğru: ${nf(SIYAH_OZEL)} − 90.000 = ${nf(BEKLENEN_FARK)}`,
    okuma?.deltaBlack === BEKLENEN_FARK, { fark: okuma?.deltaBlack });
  t('kaynak CIHAZ_EPOSTA (tartışmada kanıt ağırlığı)', okuma?.source === 'CIHAZ_EPOSTA', { kaynak: okuma?.source });
  t('faturalanmamış — ay sonu faturasına girecek', okuma?.billed === false, { billed: okuma?.billed });

  // ÜCRET — iki kalem birden. İlk yazdığımda renkliyi unutmuştum ve test
  // "hata" verdi; hata bendeydi, sistem doğruydu. Rapordaki "Full Color"
  // sayfaları da faturalanıyor ve dahil paketi yalnız SİYAHTA tanımlı.
  //   siyah aşım : (3.417 − 1.000 dahil) × ₺0,40 = ₺966,80
  //   renkli     :  733 × ₺1,50 (bayi varsayılanı)  = ₺1.099,50
  const siyahAsim = (BEKLENEN_FARK - 1000) * 0.4;
  const renkliUcret = RENKLI * 1.5;
  const beklenenUcret = siyahAsim + renkliUcret;
  t(`ücret doğru: siyah ₺${siyahAsim.toFixed(2)} + renkli ₺${renkliUcret.toFixed(2)} = ₺${beklenenUcret.toFixed(2)}`,
    Math.abs(Number(okuma?.calculatedCost) - beklenenUcret) < 0.02,
    { ucret: String(okuma?.calculatedCost), beklenen: beklenenUcret });
  t('renkli sayfa da okundu (dahil paketi yalnız siyahta)', okuma?.deltaColor === RENKLI, { renkli: okuma?.deltaColor });

  const kart = await p.device.findUnique({ where: { id: cihaz.id }, select: { counterBlack: true } });
  t('cihaz kartındaki sayaç güncellendi', kart.counterBlack === SIYAH_OZEL, { kart: kart.counterBlack });

  const ep = await p.counterEmail.findFirst({ where: { deviceId: cihaz.id }, orderBy: { receivedAt: 'desc' }, select: { status: true } });
  t('e-posta ISLENDI olarak kaydedildi', ep?.status === 'ISLENDI', { durum: ep?.status });

  // ── AYNI RAPOR TEKRAR: köprünün işaretleme adımı düşerse aynı mesaj gelir
  console.log('\nAYNI RAPOR İKİNCİ KEZ (köprü tekrar denerse)\n');
  const sayiOnce = await p.counterReading.count({ where: { deviceId: cihaz.id } });
  const c2 = await gonder();
  const g2 = await c2.json().catch(() => ({}));
  const sayiSonra = await p.counterReading.count({ where: { deviceId: cihaz.id } });
  t('ÇİFT OKUMA YAZILMADI', sayiSonra === sayiOnce, { once: sayiOnce, sonra: sayiSonra });
  t('uç yine 2xx döndü (köprü sonsuz tekrara girmesin)', c2.status >= 200 && c2.status < 300, { durum: c2.status });
  const ep2 = await p.counterEmail.findFirst({ where: { deviceId: cihaz.id }, orderBy: { receivedAt: 'desc' }, select: { status: true } });
  t('ikinci kayıt ATLANDI olarak işaretlendi', ep2?.status === 'ATLANDI', { durum: ep2?.status, yanit: g2 });

  // ── BİLİNMEYEN SERİ: kuyruğa düşmeli, sessizce kaybolmamalı
  console.log('\nBİLİNMEYEN SERİ\n');
  // Konu satirinda da seri geciyor; yalniz govdeyi degistirmek yetmez —
  // ayristirici konudan da seri okuyor (ilk yazdigimda bunu kacirdim).
  const c3 = await fetch(UC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sayac-secret': SIR },
    body: JSON.stringify({
      to: adres, from: 'ECOSYS@musteri.local',
      subject: 'Counter Report - HIC-OLMAYAN-SERI',
      text: rapor.split(SERI).join('HIC-OLMAYAN-SERI'),
    }),
  });
  const g3 = await c3.json().catch(() => ({}));
  t('uç 2xx döndü (4xx olsaydı köprü 15 dk\'da bir sonsuz tekrar ederdi)', c3.status >= 200 && c3.status < 300, { durum: c3.status });
  t('kuyruğa düştü — sessizce kaybolmadı', (g3.bekleyen ?? 0) >= 1, g3);

  // ── YANLIŞ SIR
  console.log('\nYANLIŞ SIR\n');
  const c4 = await fetch(UC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sayac-secret': 'yanlis' },
    body: JSON.stringify({ to: adres, from: 'x@y.z', subject: 'x', text: rapor }),
  });
  t('yanlış sır reddedildi', c4.status === 401 || c4.status === 403, { durum: c4.status });

} finally {
  if (bayi) await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
