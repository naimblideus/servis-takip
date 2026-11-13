// KİRALIK SAYAÇ — UÇTAN UCA, GERÇEK HTTP İSTEKLERİYLE
// Çalıştır:  node scripts/test-kiralik-uctan-uca.mjs   (önce `npm run dev`, yerel veritabanı)
//
// NEDEN BU TEST
// Kütüphane testleri kuralları tek tek doğruluyor. Bayi ise kuralları değil
// EKRANLARI kullanıyor: cihaz ekler, Sayaç Turu yapar, okumayı düzeltir,
// faturayı keser, tahsilatı girer. Bu test bir bayinin bir ayını, ekranların
// çağırdığı uçlar üzerinden baştan sona yürütür ve her adımda parayı kuruşu
// kuruşuna hesaplar. Bir uç yanlış bağlanmışsa (yanlış alan, eksik kilit,
// yanlış dönem) bunu yalnız bu test görür.
//
// Senaryo — "Şifa Hastanesi", bir bayinin tek müşterisi:
//   K1 kiralık S/B  : kira 1.000, ayda 1.000 dahil, aşım 0,50 — başlangıç 10.000
//   K2 kiralık renkli: kira 2.000, 1.000 S/B + 200 renkli dahil, aşım 0,50 / 2,00 — 20.000 / 5.000
//   K3 kopya başı   : müşterinin makinesi, sayfa 0,40, kira yok — 30.000
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try {
  await fetch(`${KOK}/api/rozetler`);
} catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect();
  process.exit(0);
}

async function girisYap(eposta, sifre) {
  const csrfY = await fetch(`${KOK}/api/auth/csrf`);
  const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await csrfY.json();
  const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
    body: new URLSearchParams({ email: eposta, password: sifre, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cerezler = [csrfCerez];
  for (const c of (y.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
  return cerezler.join('; ');
}

const SLUG = 'test-kiralik-uctan-uca';
let bayi;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  bayi = await p.tenant.create({ data: { name: 'Uçtan Uca Bayi', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20, paymentTermDays: 15 } });
  const EPOSTA = 'kiralik-uu@test.local';
  await p.user.create({ data: { tenantId: bayi.id, email: EPOSTA, name: 'Uçtan Uca Yönetici', passwordHash: await bcrypt.hash('test1234', 10), role: 'ADMIN', isActive: true } });
  const cerez = await girisYap(EPOSTA, 'test1234');
  const istek = async (yol, yontem = 'GET', govde) => {
    const r = await fetch(`${KOK}${yol}`, {
      method: yontem,
      headers: { cookie: cerez, ...(govde ? { 'Content-Type': 'application/json' } : {}) },
      body: govde ? JSON.stringify(govde) : undefined,
    });
    let veri = null;
    try { veri = await r.json(); } catch { /* boş */ }
    return { durum: r.status, veri };
  };

  console.log('\n1 · MÜŞTERİ VE CİHAZLAR (ekranın uçları)\n');
  const m = await istek('/api/customers', 'POST', { name: 'Şifa Hastanesi', phone: '0532 111 22 33' });
  t('müşteri eklendi', m.durum === 200 || m.durum === 201, m);
  const musteriId = m.veri?.id;
  const ekle = (govde) => istek('/api/devices', 'POST', { customerId: musteriId, brand: 'Kyocera', ...govde });
  const k1 = await ekle({ model: 'TASKalfa 4012i', serialNo: 'UU-K1', isRental: true, monthlyRent: 1000, includedBlack: 1000, pricePerBlack: 0.5, counterBlack: 10000, location: 'Kat 1 · Poliklinik' });
  const k2 = await ekle({ model: 'TASKalfa 2554ci', serialNo: 'UU-K2', isRental: true, monthlyRent: 2000, includedBlack: 1000, includedColor: 200, pricePerBlack: 0.5, pricePerColor: 2, counterBlack: 20000, counterColor: 5000, location: 'Kat 2 · Laboratuvar' });
  const k3 = await ekle({ model: 'ECOSYS M3655', serialNo: 'UU-K3', isRental: false, kopyaBasi: true, pricePerBlack: 0.4, counterBlack: 30000, location: 'Kat 3 · Başhekimlik' });
  t('üç cihaz eklendi', [k1, k2, k3].every((x) => x.durum === 200 && x.veri?.id), [k1.durum, k2.durum, k3.durum]);
  const [K1, K2, K3] = [k1.veri.id, k2.veri.id, k3.veri.id];
  const baslangic = await p.counterReading.findMany({ where: { deviceId: { in: [K1, K2, K3] } }, select: { deviceId: true, billed: true, deltaBlack: true, customerId: true } });
  t('her cihazın başlangıç okuması yazıldı (kapalı, fark 0, müşterili)', baslangic.length === 3 && baslangic.every((b) => b.billed && b.deltaBlack === 0 && b.customerId === musteriId), baslangic);

  // Okumalar şu andan itibaren yazılır; karşılaştırılabilir zaman sırası için kısa bekleme.
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  await bekle(20);

  console.log('\n2 · SAYAÇ TURU\n');
  const tur = await istek(`/api/readings/bulk?customerId=${musteriId}`);
  const turCihazlar = tur.veri?.devices ?? [];
  t('★ kopya başı cihaz da turda (eskiden yalnız kiralık)', turCihazlar.length === 3 && turCihazlar.some((d) => d.id === K3), turCihazlar.map((d) => d.serialNo));
  t('tur kat sırasıyla dizili', turCihazlar.map((d) => d.serialNo).join(',') === 'UU-K1,UU-K2,UU-K3', turCihazlar.map((d) => d.serialNo));
  t('başlangıç sayacı "bu dönem okundu" sayılmıyor', tur.veri?.alreadyRead === 0, tur.veri?.alreadyRead);
  t('renkli sütun yalnız renkli cihazda', turCihazlar.find((d) => d.id === K2)?.hasColor === true && turCihazlar.find((d) => d.id === K1)?.hasColor === false);

  const kaydet = await istek('/api/readings/bulk', 'POST', {
    rows: [
      { deviceId: K1, counterBlack: 12500, counterColor: 0 },    // 2.500 sayfa
      { deviceId: K2, counterBlack: 21500, counterColor: 5300 }, // 1.500 S/B + 300 renkli
      { deviceId: K3, counterBlack: 31000, counterColor: 0 },    // 1.000 sayfa
    ],
  });
  t('tur kaydedildi: 3/3', kaydet.veri?.saved === 3 && kaydet.veri?.failed === 0, kaydet.veri);
  const tur2 = await istek(`/api/readings/bulk?customerId=${musteriId}`);
  t('tur sonrası 3 cihaz "okundu"', tur2.veri?.alreadyRead === 3, tur2.veri?.alreadyRead);

  console.log('\n3 · OKUMA DÜZELTME VE SİLME (cihaz kartı)\n');
  // K1'e ikinci okuma: 13.000. Sonra ilk okumayı (12.500) yanlış yazılmış sayıp 12.600'e düzelt.
  const ek = await istek(`/api/devices/${K1}/readings`, 'POST', { counterBlack: 13000, counterColor: 0 });
  t('tek okuma eklendi (500 sayfa)', ek.durum === 200 && ek.veri?.deltaBlack === 500, ek.veri);
  const ilk = await p.counterReading.findFirst({ where: { deviceId: K1, counterBlack: 12500 } });
  const duz = await istek(`/api/devices/${K1}/readings?readingId=${ilk.id}`, 'PATCH', { counterBlack: 12600, counterColor: 0 });
  t('düzeltme: 2.600 + sonraki 400', duz.durum === 200 && duz.veri?.reading?.deltaBlack === 2600 && duz.veri?.sonrakiGuncellendi?.black === 400, duz.veri);
  const buyuk = await istek(`/api/devices/${K1}/readings?readingId=${ilk.id}`, 'PATCH', { counterBlack: 13500, counterColor: 0 });
  t('sonraki okumadan büyük değer reddedilir', buyuk.durum === 400 && buyuk.veri?.code === 'SONRAKI_DUSUK', buyuk);
  const sil = await istek(`/api/devices/${K1}/readings?readingId=${ilk.id}`, 'DELETE');
  const sonraki = await p.counterReading.findFirst({ where: { deviceId: K1, counterBlack: 13000 }, select: { deltaBlack: true } });
  t('★ ortadaki okuma silindi: sonraki 3.000 olur, sayfa kaybolmaz', sil.durum === 200 && sonraki.deltaBlack === 3000, { sil: sil.durum, sonraki });
  const dus = await istek(`/api/devices/${K1}/readings`, 'POST', { counterBlack: 12000, counterColor: 0 });
  t('düşen sayaç onaysız reddedilir', dus.durum === 400 && dus.veri?.code === 'COUNTER_DECREASE', dus.veri);

  console.log('\n4 · EŞZAMANLI GİRİŞ (iki ekran, aynı cihaz)\n');
  const ikiz = await Promise.all([1, 2].map(() => istek(`/api/devices/${K3}/readings`, 'POST', { counterBlack: 31500, counterColor: 0 })));
  const k3Top = await p.counterReading.aggregate({ where: { deviceId: K3, billed: false }, _sum: { deltaBlack: true } });
  t('★ aynı sayaç iki ekrandan aynı anda: 1.500 sayfa bir kez sayılır', k3Top._sum.deltaBlack === 1500, { toplam: k3Top._sum.deltaBlack, durumlar: ikiz.map((x) => x.durum) });

  console.log('\n5 · FATURA ÖNCESİ KONTROL VE KESİM\n');
  const ayar = await p.tenant.findUnique({ where: { id: bayi.id }, select: { invoiceDayOfMonth: true } });
  const pf = await istek('/api/invoices/preflight');
  const donem = pf.veri?.secenekler?.acik;
  const pfAcik = await istek(`/api/invoices/preflight?period=${donem}`);
  t('açık dönem bulundu', /^\d{4}-\d{2}$/.test(donem ?? ''), pf.veri);
  t('★ kontrol kopya başı cihazı da sayar, hepsi okunmuş: eksik 0 / 3', pfAcik.veri?.totalRental === 3 && pfAcik.veri?.missingCount === 0, pfAcik.veri && { toplam: pfAcik.veri.totalRental, eksik: pfAcik.veri.missingCount });
  void ayar;

  const kes = await istek('/api/invoices', 'POST', { period: donem });
  t('dönem faturalandı: 1 fatura', kes.durum === 200 && kes.veri?.created === 1, kes.veri);
  const fatura = await p.customerInvoice.findFirst({ where: { customerId: musteriId, period: donem }, include: { lines: true } });
  const satir = (kind, cihaz, renkli) => fatura?.lines.find((l) => l.kind === kind && l.deviceId === cihaz && (renkli === undefined || l.description.includes(renkli ? 'Renkli' : 'S/B')));
  // Beklenen (KDV hariç):
  //   K1 kira 1.000 + (3.000 − 1.000) × 0,50 = 1.000      → 2.000
  //   K2 kira 2.000 + (1.500 − 1.000) × 0,50 = 250 + (300 − 200) × 2 = 200 → 2.450
  //   K3 kira yok   + 1.500 × 0,40 = 600                     →   600
  t('K1: kira 1.000, aşım 2.000 sayfa × 0,50', Number(satir('RENTAL', K1)?.lineTotal) === 1000 && Number(satir('COUNTER', K1, false)?.quantity) === 2000 && Number(satir('COUNTER', K1, false)?.lineTotal) === 1000, fatura?.lines.filter((l) => l.deviceId === K1).map((l) => [l.kind, Number(l.quantity), Number(l.lineTotal)]));
  t('K2: kira 2.000, S/B 500 aşım, renkli 100 aşım × 2', Number(satir('RENTAL', K2)?.lineTotal) === 2000 && Number(satir('COUNTER', K2, false)?.quantity) === 500 && Number(satir('COUNTER', K2, true)?.quantity) === 100 && Number(satir('COUNTER', K2, true)?.lineTotal) === 200, fatura?.lines.filter((l) => l.deviceId === K2).map((l) => [l.kind, Number(l.quantity), Number(l.lineTotal)]));
  t('★ K3 kopya başı: kira yok, 1.500 × 0,40 = 600', !satir('RENTAL', K3) && Number(satir('COUNTER', K3, false)?.lineTotal) === 600, fatura?.lines.filter((l) => l.deviceId === K3).map((l) => [l.kind, Number(l.quantity), Number(l.lineTotal)]));
  t('★ toplam: 5.050 + %20 KDV = 6.060', Number(fatura?.subtotal) === 5050 && Number(fatura?.totalAmount) === 6060, fatura && { ara: Number(fatura.subtotal), toplam: Number(fatura.totalAmount) });
  t('fatura satırı cihazı seri numarasıyla ayırt eder', satir('COUNTER', K1, false)?.description.includes('UU-K1'), satir('COUNTER', K1, false)?.description);
  const kapali = await p.counterReading.count({ where: { deviceId: { in: [K1, K2, K3] }, billed: false } });
  const sahipli = await p.counterReading.count({ where: { deviceId: { in: [K1, K2, K3] }, faturaId: fatura?.id } });
  t('bütün okumalar faturalandı ve faturasına bağlı', kapali === 0 && sahipli >= 5, { acik: kapali, bagli: sahipli });
  const kiraKayit = await p.kiraDonemi.findMany({ where: { deviceId: { in: [K1, K2, K3] } }, select: { deviceId: true, period: true, invoiceId: true } });
  t('kira dönem kaydı: K1 ve K2, bu dönem, bu fatura', kiraKayit.length === 2 && kiraKayit.every((k) => k.period === donem && k.invoiceId === fatura?.id), kiraKayit);
  const tekrar = await istek('/api/invoices', 'POST', { period: donem });
  t('aynı dönemi tekrar kesmek yeni fatura üretmez', tekrar.veri?.created === 0 && (await p.customerInvoice.count({ where: { customerId: musteriId } })) === 1, tekrar.veri);
  const faturali = await istek(`/api/devices/${K1}/readings?readingId=${(await p.counterReading.findFirst({ where: { deviceId: K1, counterBlack: 13000 } })).id}`, 'DELETE');
  t('faturalanmış okuma silinemez', faturali.durum === 409, faturali);

  console.log('\n6 · TAHSİLAT VE AVANS\n');
  const od = await istek('/api/collections', 'POST', { customerId: musteriId, amount: 10000, method: 'TRANSFER' });
  t('₺10.000 tahsilat: ₺6.060 faturaya, ₺3.940 avans', od.durum === 200 && Number(od.veri?.allocated ?? od.veri?.result?.allocated) === 6060, od.veri);
  const f1 = await p.customerInvoice.findUnique({ where: { id: fatura.id } });
  t('fatura ödendi', f1.status === 'PAID' && Number(f1.paidAmount) === 6060, { durum: f1.status, odenen: Number(f1.paidAmount) });

  console.log('\n7 · CİHAZ TAŞIMA VE KORUMALAR\n');
  const m2 = await istek('/api/customers', 'POST', { name: 'Şifa Tıp Merkezi', phone: '0532 111 22 44' });
  const ek2 = await istek(`/api/devices/${K1}/readings`, 'POST', { counterBlack: 14000, counterColor: 0 }); // hastanede 1.000 sayfa daha
  t('taşımadan önce hastanede 1.000 sayfa okundu', ek2.veri?.deltaBlack === 1000, ek2.veri);
  const kapat = await istek(`/api/devices/${K1}`, 'PATCH', { isRental: false });
  t('★ faturalanmamış sayfası olan cihaz ücretsize çevrilemez', kapat.durum === 409, kapat);
  const silC = await istek(`/api/devices/${K1}`, 'DELETE');
  t('★ faturalanmamış sayfası olan cihaz silinemez', silC.durum === 409, silC);
  const tasi = await istek(`/api/devices/${K1}`, 'PATCH', { customerId: m2.veri.id });
  t('cihaz Tıp Merkezi\'ne taşındı', tasi.durum === 200);
  const ek3 = await istek(`/api/devices/${K1}/readings`, 'POST', { counterBlack: 14300, counterColor: 0 });
  t('yeni yerde okuma yeni müşteriyle yazıldı', ek3.veri?.customerId === m2.veri.id, ek3.veri);
  const hastane = await p.counterReading.findFirst({ where: { deviceId: K1, counterBlack: 14000 }, select: { customerId: true } });
  t('★ hastanede okunan 1.000 sayfa hastanede kaldı', hastane.customerId === musteriId, hastane);

  console.log('\n8 · GÖRÜNÜRLÜK VE BAKİYE\n');
  const yeniFatura = await istek('/api/invoices', 'POST', { period: donem });
  const hFat = await p.customerInvoice.findMany({ where: { customerId: musteriId }, orderBy: { invoiceDate: 'asc' }, include: { lines: true } });
  const ikinci = hFat[1];
  t('★ hastanenin ara faturası: taşımadan önceki 1.000 sayfa (paket bu dönem tükendi) = 500', yeniFatura.durum === 200 && ikinci && Number(ikinci.subtotal) === 500 && ikinci.lines.length === 1, ikinci && ikinci.lines.map((l) => [l.kind, Number(l.quantity), Number(l.lineTotal)]));
  t('★ avans hemen düştü: ₺600 faturanın ₺600\'ü ödendi', ikinci && Number(ikinci.paidAmount) === 600 && ikinci.status === 'PAID', ikinci && { odenen: Number(ikinci.paidAmount), durum: ikinci.status });
  const tm = await p.customerInvoice.findMany({ where: { customerId: m2.veri.id } });
  t('Tıp Merkezi kira kesilmedi (bu dönemin kirası hastanede kesilmişti) ve 300 sayfası paket içinde', tm.length === 0, tm.map((f) => Number(f.subtotal)));
} catch (e) {
  kaldi++; console.log('  ✗ senaryo patladı —', e?.stack ?? e);
} finally {
  if (bayi) await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {});
  console.log('\n  (temizlik: geçici bayi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
