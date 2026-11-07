// EXCEL AKTARMA ÇEKİRDEĞİ — kiralık şartları, başlangıç sayacı, ön izleme, iki kapı
// Çalıştır:  node scripts/test-sayfa-ice-aktar.mjs   (yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bayinin listesini artık çoğunlukla biz yüklüyoruz (Süper admin → Kurulum →
// "Veriyi biz yükleyelim"). Yanlış yüklenen kira ilk faturada ortaya çıkar ve
// bayinin güvenini o gün kaybederiz. Burada kilitli olanlar:
//   · dahil sayfa, aşım fiyatı, kurulum tarihi, son faturalanan ay cihaza yazılıyor;
//   · ön izleme HİÇBİR ŞEY yazmıyor, aylık kira toplamını doğru veriyor;
//   · okunamayan tarih/dönem tahmin edilmiyor, gelecek ay yok sayılıyor;
//   · başlangıç sayacı GOC kaynağıyla yazılıyor (kurulum ekranı onu sayaç
//     toplama saymıyor) ve faturaya girmiyor;
//   · tekrar yüklemek çoğaltmıyor, son faturalanan ay GERİ gitmiyor
//     (geri gitseydi kesilmiş ayın kirası ikinci kez kesilirdi);
//   · başka bayiye tek satır yazılmıyor;
//   · bayinin ucu ile kurulum ekibinin ucu AYNI çekirdeği çağırıyor.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, temizle } = derle({ girisler: ['src/lib/sayfa-ice-aktar.ts'], onEk: 'st-sayfa-aktar-' });
const { sayfaIceAktar } = await ice('lib/sayfa-ice-aktar');
const p = new PrismaClient();
const SLUG = `test-sayfa-aktar-${Date.now().toString(36)}`;
const kiraciIdleri = [];

try {
  const bayi = await p.tenant.create({ data: { name: 'Aktarım Testi', slug: SLUG } });
  const baska = await p.tenant.create({ data: { name: 'Başka Bayi', slug: `${SLUG}-b` } });
  kiraciIdleri.push(bayi.id, baska.id);
  const tid = bayi.id;
  // Kasım 2026: "12.2026" gelecek ay, "10.2026" geçmiş.
  const simdi = new Date('2026-11-07T12:00:00+03:00');

  const csv = [
    'Müşteri Adı;Telefon;Marka;Model;Seri No;S/B Sayaç;Kiralık mı;Aylık Kira;S/B Sayfa Fiyatı;Dahil S/B Sayfa;Aşım Renkli Fiyatı;Kurulum Tarihi;Son Faturalanan Ay',
    'Ofis A;0555 111 22 33;Pantum;M7100DW;ST-A1;36010;Evet;1500;0,45;1000;;15.03.2024;10.2026',
    'Ofis A;0555 111 22 33;Pantum;M6500;ST-A2;1200;Evet;900;;500;;03.2025;Ekim 2026',
    'Ofis B;0555 222 33 44;Kyocera;M2040;ST-B1;5000;Evet;;;;;2023;12.2026',
    'Ofis B;0555 222 33 44;HP;M402;ST-B2;800;Hayır;;;;;xx.yy;bozuk',
  ].join('\n');

  console.log('\n★ ÖN İZLEME\n');
  const on = await sayfaIceAktar({ tenantId: tid, csv, dryRun: true, simdi });
  t('ön izleme başarılı', on.ok, on);
  const g = on.govde ?? {};
  t('4 geçerli satır, 2 müşteri, 4 cihaz', g.validRows === 4 && g.willCreateCustomers === 2 && g.willCreateDevices === 4, g);
  t('★ aylık kira toplamı 2.400 (2 cihaz), kirası boş kiralık 1',
    g.kiraOzeti?.toplam === 2400 && g.kiraOzeti?.cihaz === 2 && g.kiraOzeti?.kirasiz === 1, g.kiraOzeti);
  t('en yüksek kiralı müşteri Ofis A: 2.400', g.kiraOzeti?.musteriler?.[0]?.ad === 'Ofis A' && g.kiraOzeti?.musteriler?.[0]?.toplam === 2400, g.kiraOzeti);
  const uyari = (k) => (g.warnings ?? []).find((w) => w.kod === k);
  t('KIRA_YOK: kirası da fiyatı da boş kiralık (ST-B1)', uyari('KIRA_YOK')?.n === 1 && uyari('KIRA_YOK')?.ornek === 'ST-B1', g.warnings);
  t('DAHIL_FIYATSIZ: dahil sayfa var, fiyat yok (ST-A2)', uyari('DAHIL_FIYATSIZ')?.n === 1 && uyari('DAHIL_FIYATSIZ')?.ornek === 'ST-A2', g.warnings);
  t('TARIH_OKUNAMADI: "xx.yy" tahmin edilmiyor', uyari('TARIH_OKUNAMADI')?.n === 1 && uyari('TARIH_OKUNAMADI')?.ornek === 'xx.yy', g.warnings);
  t('DONEM_OKUNAMADI: "bozuk"', uyari('DONEM_OKUNAMADI')?.n === 1, g.warnings);
  t('★ DONEM_GELECEK: Kasım\'da "12.2026" yok sayılıyor', uyari('DONEM_GELECEK')?.n === 1 && uyari('DONEM_GELECEK')?.ornek === '2026-12', g.warnings);
  t('★ ön izleme hiçbir şey yazmadı',
    (await p.device.count({ where: { tenantId: tid } })) === 0 && (await p.customer.count({ where: { tenantId: tid } })) === 0);

  console.log('\n★ AKTARIM\n');
  const ak = await sayfaIceAktar({ tenantId: tid, csv, dryRun: false, simdi });
  t('aktarım başarılı: 2 yeni müşteri, 4 yeni cihaz', ak.ok && ak.govde.customersCreated === 2 && ak.govde.devicesCreated === 4, ak.govde);
  t('sonuçta da aylık kira toplamı var', ak.govde?.kiraOzeti?.toplam === 2400, ak.govde?.kiraOzeti);
  const cihaz = (seri) => p.device.findFirst({ where: { tenantId: tid, serialNo: seri } });
  const gun = (d) => (d ? d.toISOString().slice(0, 10) : null);

  const a1 = await cihaz('ST-A1');
  t('★ ST-A1: kira 1.500, dahil 1.000 sayfa, sayfa fiyatı 0,45',
    Number(a1.monthlyRent) === 1500 && a1.includedBlack === 1000 && Number(a1.pricePerBlack) === 0.45 && a1.isRental, a1);
  t('★ ST-A1: kurulum 15.03.2024 (gün), son faturalanan ay 2026-10',
    gun(a1.installedAt) === '2024-03-15' && a1.installedAtPrecision === 'DAY' && a1.lastInvoicedPeriod === '2026-10',
    { installedAt: a1.installedAt, p: a1.installedAtPrecision, son: a1.lastInvoicedPeriod });
  const a2 = await cihaz('ST-A2');
  t('ST-A2: "03.2025" ay hassasiyeti, "Ekim 2026" → 2026-10, aşım fiyatı boş',
    gun(a2.installedAt) === '2025-03-01' && a2.installedAtPrecision === 'MONTH' && a2.lastInvoicedPeriod === '2026-10' && a2.overagePriceBlack === null,
    { installedAt: a2.installedAt, p: a2.installedAtPrecision, son: a2.lastInvoicedPeriod });
  const b1 = await cihaz('ST-B1');
  t('ST-B1: "2023" yıl hassasiyeti, gelecek ay yazılmadı', b1.installedAtPrecision === 'YEAR' && gun(b1.installedAt) === '2023-01-01' && b1.lastInvoicedPeriod === null, b1);
  const b2 = await cihaz('ST-B2');
  t('ST-B2: okunamayan tarih ve dönem boş kaldı', b2.installedAt === null && b2.lastInvoicedPeriod === null && !b2.isRental, b2);

  const okumalar = await p.counterReading.findMany({ where: { tenantId: tid } });
  t('★ başlangıç sayacı: 4 okuma, kaynak GOC, faturalanmış, fark 0',
    okumalar.length === 4 && okumalar.every((o) => o.source === 'GOC' && o.billed === true && o.deltaBlack === 0 && Number(o.calculatedCost) === 0),
    okumalar.map((o) => [o.source, o.billed, o.deltaBlack]));

  console.log('\n★ TEKRAR AKTARIM\n');
  // Sistem Kasım'ı kesmiş olsun; bayi eski dosyasını (Eylül yazılı) yeniden yüklesin.
  await p.device.update({ where: { id: a1.id }, data: { lastInvoicedPeriod: '2026-11' } });
  const ak2 = await sayfaIceAktar({ tenantId: tid, csv: csv.replace('10.2026', '09.2026'), dryRun: false, simdi });
  t('çoğaltmadı: 0 yeni, 4 güncellenen cihaz', ak2.ok && ak2.govde.devicesCreated === 0 && ak2.govde.devicesUpdated === 4, ak2.govde);
  t('★ son faturalanan ay geri gitmedi (2026-11 kaldı)', (await cihaz('ST-A1')).lastInvoicedPeriod === '2026-11');
  t('başlangıç sayacı ikinci kez yazılmadı', (await p.counterReading.count({ where: { tenantId: tid } })) === 4);
  t('★ başka bayiye tek satır yazılmadı',
    (await p.device.count({ where: { tenantId: baska.id } })) === 0 && (await p.customer.count({ where: { tenantId: baska.id } })) === 0);

  console.log('\nHATALAR\n');
  const bos = await sayfaIceAktar({ tenantId: tid, csv: '   ', dryRun: true });
  t('boş dosya → DOSYA_BOS_GORUNUYOR, ekrana BOS_DOSYA', !bos.ok && bos.hata === 'DOSYA_BOS_GORUNUYOR' && bos.ek?.kod === 'BOS_DOSYA', bos);
  const tanimsiz = await sayfaIceAktar({ tenantId: tid, csv: 'Renk;Boy\nmavi;3', dryRun: true });
  t('tanınmayan kolonlar → KOLON_TANINMADI', !tanimsiz.ok && tanimsiz.ek?.kod === 'KOLON_TANINMADI', tanimsiz);

  console.log('\n★ İKİ KAPI, TEK KURAL (kaynak denetimi)\n');
  const oku = (y) => readFileSync(join(KOK, y), 'utf8');
  const bayiUcu = oku('src/app/api/import/sheet/route.ts');
  const ekipUcu = oku('src/app/api/super-admin/kurulum/[tenantId]/ice-aktar/route.ts');
  t('★ bayi ucu ve kurulum ucu aynı çekirdeği çağırıyor', /sayfaIceAktar\(/.test(bayiUcu) && /sayfaIceAktar\(/.test(ekipUcu));
  t('bayi ucu yönetici yetkisi istiyor', /VERI_AKTARMAK_ICIN_YONETICI_YETKISI/.test(bayiUcu));
  t('kurulum ucu oturum istiyor, demo ve silinmiş bayiye yazmıyor',
    /getSuperAdminSession\(\)/.test(ekipUcu) && /demo: false/.test(ekipUcu) && /deletedAt: null/.test(ekipUcu));
  t('kurulum ucu gerçek aktarımı denetime ve kurulum notuna yazıyor', /writeAudit\(/.test(ekipUcu) && /notEkle\(/.test(ekipUcu));
  t('çekirdekte eski TOPLU kaynağı kalmadı', !/source: 'TOPLU'/.test(oku('src/lib/sayfa-ice-aktar.ts')));
  t('kurulum ekranı ExcelImport\'u kurulum ucuyla kullanıyor',
    /ExcelImport uc=\{`\/api\/super-admin\/kurulum\/\$\{encodeURIComponent\(x\.tenantId\)\}\/ice-aktar`\}/.test(oku('src/app/(super-admin)/super-admin/kurulum/[tenantId]/page.tsx')));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.message ?? e);
} finally {
  for (const id of kiraciIdleri) {
    await p.counterReading.deleteMany({ where: { tenantId: id } }).catch(() => {});
    await p.device.deleteMany({ where: { tenantId: id } }).catch(() => {});
    await p.customer.deleteMany({ where: { tenantId: id } }).catch(() => {});
    await p.tenant.delete({ where: { id } }).catch(() => {});
  }
  await p.$disconnect();
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
