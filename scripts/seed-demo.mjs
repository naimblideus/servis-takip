/**
 * DEMO HESABI — landing'deki "Demoyu Dene" butonunun gittiği yer.
 *
 * ⚠️ NEDEN AYRI BİR HESAP: Gerçek bayi hesabını (admin@demo.com) demo olarak
 * açmak, o bayinin MÜŞTERİLERİNİN adlarını, cihaz sayılarını ve fiyatlarını
 * internete açmak demektir. Buradaki her isim ve rakam UYDURMADIR.
 *
 * Çalıştır:  node scripts/seed-demo.mjs
 * Tazele:    aynı komut — mevcut demo verisi silinip yeniden kurulur (idempotent).
 *
 * Ziyaret öncesi tazelemek iyi fikir: demoda gezinen biri veri bozmuş olabilir.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const SLUG = 'demo';
const EPOSTA = 'demo@nextusservis.com';
const SIFRE = process.env.DEMO_SIFRE || 'demo1234';

const MUSTERILER = [
  { name: 'Akdeniz Sigorta Acentesi', phone: '05321110001', address: 'Kavacık, Beykoz' },
  { name: 'Yıldız Mali Müşavirlik',   phone: '05321110002', address: 'Ümraniye' },
  { name: 'Beykoz Özel Poliklinik',   phone: '05321110003', address: 'Beykoz' },
  { name: 'Marmara Nakliyat',         phone: '05321110004', address: 'Dudullu OSB' },
  { name: 'Kuzey Mimarlık Ofisi',     phone: '05321110005', address: 'Çekmeköy' },
  { name: 'Anadolu Eğitim Kurumları', phone: '05321110006', address: 'Ataşehir' },
];

// Gerçek model adları kullanılıyor (marka güvenilirliği için anlamlı olsun),
// ama hangi müşteride kaç tane olduğu tamamen uydurma.
const MODELLER = [
  { brand: 'Canon',           model: 'iR2625',    renkli: true },
  { brand: 'Canon',           model: 'iR1643i',   renkli: false },
  { brand: 'Konica Minolta',  model: 'bizhub C250i', renkli: true },
  { brand: 'Kyocera',         model: 'TASKalfa 2554ci', renkli: true },
  { brand: 'Pantum',          model: 'M7300FDW',  renkli: false },
  { brand: 'Ricoh',           model: 'IM C300',   renkli: true },
];

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function main() {
  console.log('Demo hesabı kuruluyor…');

  // Varsa temizle — tazeleme her seferinde aynı sonucu versin
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) {
    await p.tenant.delete({ where: { id: eski.id } }); // cascade: tüm bağlı kayıtlar
    console.log('  eski demo verisi silindi');
  }

  const tenant = await p.tenant.create({
    data: {
      name: 'Demo Fotokopi (örnek veri)',
      slug: SLUG,
      plan: 'professional',
      isActive: true,
      maxUsers: 10,
      pricePerBlack: 0.42,
      pricePerColor: 1.60,
      // Demo hesabı ÜRETİCİ VERİ PAYLAŞIMINA dahil edilmez — uydurma veri
      // gerçek güvenilirlik raporunu kirletmemeli.
      oemDataSharing: false,
    },
  });

  await p.user.create({
    data: {
      tenantId: tenant.id, email: EPOSTA, name: 'Demo Kullanıcı',
      passwordHash: await bcrypt.hash(SIFRE, 12), role: 'ADMIN', isActive: true,
    },
  });

  let cihazSayisi = 0, okumaSayisi = 0;
  const tumCihazlar = [];   // fiş, fatura ve rapor üretimi için toplanır
  const tumMusteriler = [];

  for (const m of MUSTERILER) {
    const musteri = await p.customer.create({
      data: { tenantId: tenant.id, name: m.name, phone: m.phone, address: m.address },
    });
    tumMusteriler.push(musteri);

    const adet = rnd(1, 4);
    for (let i = 0; i < adet; i++) {
      const md = MODELLER[rnd(0, MODELLER.length - 1)];
      const siyah = rnd(18000, 240000);
      const renkli = md.renkli ? rnd(2000, 48000) : 0;

      // ── CİHAZ YAŞI ─────────────────────────────────────────────────────
      // Yenileme Fırsatları modülü yaş olmadan BOŞ liste döner (ölçüldü:
      // yasiBilinen=0 → adaylar=[]). Demoda "bu modül çalışmıyor" görünüyordu.
      // Yaş dağılımı bilinçli: bir kısmı 5 yaş üstü olsun ki gerçek aday çıksın.
      const yasAy = rnd(8, 96);
      const kurulum = new Date();
      kurulum.setMonth(kurulum.getMonth() - yasAy);

      // ── TONER VERİMİ ───────────────────────────────────────────────────
      // Tükenme tahmini verim yoksa HİÇ üretilmiyor (forecastChannel null döner).
      // Gerçek kartuş verimlerine yakın değerler.
      const verimS = [6000, 7200, 11000, 15000][rnd(0, 3)];
      const verimR = md.renkli ? [4000, 5000, 6000][rnd(0, 2)] : null;

      const cihaz = await p.device.create({
        data: {
          tenantId: tenant.id, customerId: musteri.id,
          brand: md.brand, model: md.model,
          serialNo: `DEMO${String(++cihazSayisi).padStart(4, '0')}`,
          location: ['Muhasebe', 'Ön Büro', 'Yönetim', 'Arşiv', '2. Kat'][rnd(0, 4)],
          isRental: true,
          monthlyRent: rnd(1200, 4200),
          includedBlack: 2000, includedColor: md.renkli ? 300 : 0,
          counterBlack: siyah, counterColor: renkli,
          publicCode: `DEV-DEMO${String(cihazSayisi).padStart(3, '0')}`,
          qrTokenHash: 'demo',
          installedAt: kurulum,
          installedAtPrecision: 'MONTH',
          tonerYieldBlack: verimS,
          tonerYieldColor: verimR,
          // Son toner değişimindeki sayaç — tükenmeye kalan sayfa buradan çıkar.
          // Verimin bir kısmı tüketilmiş olsun ki bazı cihazlar "yakında bitecek"
          // uyarısına düşsün; hepsi sıfırsa modül hiçbir şey göstermez.
          tonerResetBlack: Math.max(0, siyah - rnd(Math.floor(verimS * 0.55), Math.floor(verimS * 0.95))),
          tonerResetColor: verimR ? Math.max(0, renkli - rnd(Math.floor(verimR * 0.5), Math.floor(verimR * 0.9))) : null,
        },
      });
      tumCihazlar.push({ ...cihaz, renkli: md.renkli });

      // ── SON ÜÇ AYIN OKUMALARI ──────────────────────────────────────────
      // ÖNCEDEN her ay BAĞIMSIZ rastgele bir çıkarma yapıyordu; sonuç iki
      // yönden bozuktu: (a) sayaç bazen GERİYE gidiyordu, (b) deltaBlack hiç
      // yazılmadığı için 51/52 okumada "fark 0" görünüyordu. Bayiye demo
      // yaparken "fark 0" ürünün çalışmadığı izlenimi veriyor — demoda
      // görülen ilk şey bu.
      //
      // Artık seri GERİYE DOĞRU ama TUTARLI kuruluyor: bugünkü sayaçtan
      // başlayıp her ay için gerçek bir aylık hacim çıkarılıyor, sonra
      // ileri doğru yazılırken fark ve tutar GERÇEK formülle hesaplanıyor.
      const aylikHacim = [];
      for (let k = 0; k < 3; k++) aylikHacim.push({ s: rnd(1800, 7500), r: md.renkli ? rnd(250, 1600) : 0 });

      // ── BİR KISMI BİLEREK GECİKMELİ ────────────────────────────────────
      // "Sayacı Gelmeyen Cihaz" kartı (35+ gün okunmamış kiralık cihaz)
      // ürünün amiral gemisi hikâyesi: faturalanmayan gelir. Bütün okumalar
      // tazeyken kart SIFIR okuyor ve demoda o hikâye anlatılamıyor.
      // Cihazların ~üçte biri 2-3 ay okunmamış bırakılıyor — sahadaki gerçek
      // durum da böyle.
      const gecikmeAy = Math.random() < 0.35 ? rnd(2, 3) : 0;

      // En eski okumanın değeri = bugünkü sayaç − üç ayın toplamı
      let oncekiS = Math.max(0, siyah - aylikHacim.reduce((a, x) => a + x.s, 0));
      let oncekiR = Math.max(0, renkli - aylikHacim.reduce((a, x) => a + x.r, 0));

      for (let ay = 3; ay >= 1; ay--) {
        const tarih = new Date();
        tarih.setMonth(tarih.getMonth() - ay - gecikmeAy);
        const h = aylikHacim[3 - ay];
        const yeniS = oncekiS + h.s;
        const yeniR = oncekiR + h.r;
        const farkS = yeniS - oncekiS;
        const farkR = yeniR - oncekiR;

        // Kademeli ücret: dahil sayfa kiraya dahil, yalnız AŞIM faturalanır.
        // Uygulamadaki counterOverage ile aynı mantık (tek okuma = tek dönem).
        const asimS = Math.max(0, farkS - 2000);
        const asimR = Math.max(0, farkR - (md.renkli ? 300 : 0));
        const tutar = Math.round((asimS * 0.42 + asimR * 1.60) * 100) / 100;

        await p.counterReading.create({
          data: {
            tenantId: tenant.id, deviceId: cihaz.id,
            counterBlack: yeniS, counterColor: yeniR,
            deltaBlack: farkS, deltaColor: farkR,
            calculatedCost: tutar,
            readingDate: tarih,
            billed: true,
          },
        });
        oncekiS = yeniS; oncekiR = yeniR;
        okumaSayisi++;
      }

      // ── BU DÖNEMİN FATURALANMAMIŞ OKUMASI ──────────────────────────────
      // "Kaçan Gelir" ekranı yalnız billed=false okumaları sayıyor. Tüm
      // okumalar faturalanmış işaretliyken ekranın "SAYAÇ AŞIMI" yarısı
      // ₺0,00 kalıyordu — ürünün en güçlü ekranının yarısı ölü görünüyor.
      // Gecikmeli cihazlara eklenmez: onlar "sayacı gelmeyen" hikâyesinde.
      if (gecikmeAy === 0 && Math.random() < 0.6) {
        const hS = rnd(2400, 8200);
        const hR = md.renkli ? rnd(320, 1900) : 0;
        const asimS = Math.max(0, hS - 2000);
        const asimR = Math.max(0, hR - (md.renkli ? 300 : 0));
        await p.counterReading.create({
          data: {
            tenantId: tenant.id, deviceId: cihaz.id,
            counterBlack: oncekiS + hS, counterColor: oncekiR + hR,
            deltaBlack: hS, deltaColor: hR,
            calculatedCost: Math.round((asimS * 0.42 + asimR * 1.60) * 100) / 100,
            readingDate: new Date(),
            billed: false,
          },
        });
        await p.device.update({
          where: { id: cihaz.id },
          data: { counterBlack: oncekiS + hS, counterColor: oncekiR + hR },
        });
        okumaSayisi++;
      }
    }
  }

  const kullanici = await p.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });
  const sayilar = await modulVerisi(tenant, kullanici.id, tumMusteriler, tumCihazlar);

  console.log(`  ${MUSTERILER.length} müşteri, ${cihazSayisi} cihaz, ${okumaSayisi} sayaç okuması`);
  console.log(`  ${sayilar.parca} parça (${sayilar.kritik} kritik stok), ${sayilar.fis} servis fişi`);
  console.log(`  ${sayilar.fatura} fatura, ${sayilar.tahsilat} tahsilat, ${sayilar.gider} gider`);
  console.log(`\nGiriş: ${EPOSTA} / ${SIFRE}`);
  console.log('Bu hesaptaki her isim ve rakam uydurmadır.');
}

/**
 * MODÜL VERİSİ — sayaç dışındaki her modülün ekranında bir şey görünsün.
 *
 * Bu bölüm sonradan eklendi. Sebebi ölçüldü: demo hesabında panelin sekiz
 * kartından altısı SIFIR okuyordu (0 fiş, ₺0 ciro, 0 stok) ve servis fişi,
 * muhasebe, stok, yenileme, toner verimi, cihaz kârlılığı modülleri boş
 * açılıyordu. Bir bayiye "bu modül var" deyip boş ekran göstermek, o modülün
 * yokluğundan daha kötüdür.
 *
 * Üretilen her sayı UYDURMADIR ama TUTARLIDIR: fişin parçası stoktan düşer,
 * faturanın satırı gerçek okumaya dayanır, tahsilat faturaya bağlanır.
 */
async function modulVerisi(tenant, kullaniciId, musteriler, cihazlar) {
  // ── STOK ────────────────────────────────────────────────────────────────
  // Bir kısmı minStock altında: "Kritik Stok" kartı ve sipariş listesi dolsun.
  const PARCALAR = [
    { sku: 'TN-2420', name: 'Brother TN-2420 Toner',        buy: 480,  sell: 850,  qty: 14, min: 5,  grup: 'Toner' },
    { sku: 'TK-1170', name: 'Kyocera TK-1170 Toner',        buy: 720,  sell: 1250, qty: 3,  min: 6,  grup: 'Toner' },
    { sku: 'C-EXV49B', name: 'Canon C-EXV49 Siyah Toner',   buy: 1150, sell: 1900, qty: 9,  min: 4,  grup: 'Toner' },
    { sku: 'C-EXV49C', name: 'Canon C-EXV49 Mavi Toner',    buy: 1480, sell: 2400, qty: 2,  min: 4,  grup: 'Toner' },
    { sku: 'TNP-48K', name: 'Konica TNP-48 Siyah Toner',    buy: 1320, sell: 2150, qty: 6,  min: 3,  grup: 'Toner' },
    { sku: 'DK-1150', name: 'Kyocera DK-1150 Drum',         buy: 1650, sell: 2750, qty: 4,  min: 2,  grup: 'Drum' },
    { sku: 'FK-1150', name: 'Kyocera FK-1150 Fuser',        buy: 2900, sell: 4600, qty: 1,  min: 2,  grup: 'Fuser' },
    { sku: 'MK-1150', name: 'Kyocera MK-1150 Bakım Kiti',   buy: 2200, sell: 3500, qty: 5,  min: 2,  grup: 'Bakım Kiti' },
    { sku: 'PR-A4',   name: 'Kağıt Besleme Rulosu (A4)',    buy: 180,  sell: 380,  qty: 22, min: 8,  grup: 'Rulo' },
    { sku: 'SR-01',   name: 'Ayırıcı Pad (separation)',     buy: 95,   sell: 220,  qty: 2,  min: 10, grup: 'Rulo' },
    { sku: 'TW-BOX',  name: 'Atık Toner Kutusu',            buy: 260,  sell: 520,  qty: 11, min: 4,  grup: 'Sarf' },
    { sku: 'IM-C300', name: 'Ricoh IM C300 Görüntü Ünitesi', buy: 3400, sell: 5400, qty: 0,  min: 2,  grup: 'Drum' },
  ];
  const parcalar = [];
  for (const x of PARCALAR) {
    parcalar.push(await p.part.create({
      data: {
        tenantId: tenant.id, sku: x.sku, name: x.name, barcode: `868${x.sku.replace(/\W/g, '').slice(0, 9)}`,
        buyPrice: x.buy, sellPrice: x.sell, stockQty: x.qty, minStock: x.min, group: x.grup,
      },
    }));
  }
  const kritik = PARCALAR.filter((x) => x.qty < x.min).length;

  // ── SERVİS FİŞLERİ ──────────────────────────────────────────────────────
  // Durumlar bilinçli dağıtıldı: her panel kartının karşılığı olsun.
  // Arıza kategorisi de dağıtılıyor — Marka/Model Güvenilirliği raporu bu
  // alandan besleniyor; hepsi OTHER olsaydı rapor anlamsız çıkardı.
  const ARIZALAR = [
    { k: 'PAPER_JAM', m: 'Kağıt sıkışması, arka kapak',      i: 'Besleme rulosu değişti, yol temizlendi' },
    { k: 'TONER', m: 'Toner bitti, baskı soluk',             i: 'Toner değişimi yapıldı' },
    { k: 'PRINT_QUALITY', m: 'Sayfada dikey çizgi',          i: 'Drum ünitesi temizlendi' },
    { k: 'FUSER', m: 'Fuser hatası, baskı çıkmıyor',         i: 'Fuser ünitesi değiştirildi' },
    { k: 'FEED_ERROR', m: 'Kağıt çekmiyor',                  i: 'Ayırıcı pad değişti' },
    { k: 'NETWORK', m: 'Ağdan yazdıramıyoruz',               i: 'IP ayarı düzeltildi' },
    { k: 'DRUM', m: 'Baskıda gölgelenme',                    i: 'Drum değişti' },
    { k: 'PERIODIC_MAINTENANCE', m: 'Periyodik bakım',       i: 'Bakım kiti uygulandı' },
  ];
  // Dağılım: 4 yeni · 3 serviste · 2 parça bekliyor · 2 teslime hazır · 13 kapanmış
  const DURUMLAR = [
    ...Array(4).fill('NEW'), ...Array(3).fill('IN_SERVICE'), ...Array(2).fill('WAITING_FOR_PART'),
    ...Array(2).fill('READY'), ...Array(13).fill('DELIVERED'),
  ];
  const fisler = [];
  let no = 0;
  for (const durum of DURUMLAR) {
    const c = cihazlar[rnd(0, cihazlar.length - 1)];
    const a = ARIZALAR[rnd(0, ARIZALAR.length - 1)];
    const kapali = durum === 'DELIVERED';
    // Açık fişlerin bir kısmı ESKİ olsun: "Duran İşler" bloğu 3 günü aşanları
    // gösteriyor; hepsi bugün açılsaydı o blok boş kalırdı.
    // Panelde "Bugünkü Fişler" kartı sıfır okumasın: ilk iki açık fiş bugün.
    const gunOnce = kapali ? rnd(20, 300) : (no <= 2 ? 0 : rnd(1, 14));
    const tarih = new Date(Date.now() - gunOnce * 86400000);
    const iscilik = rnd(250, 900);

    const fis = await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, deviceId: c.id, customerId: c.customerId,
        ticketNumber: `TSK-${String(++no).padStart(4, '0')}`,
        status: durum, priority: ['LOW', 'NORMAL', 'NORMAL', 'HIGH'][rnd(0, 3)],
        createdByUserId: kullaniciId, assignedUserId: kullaniciId,
        faultCategory: a.k, issueText: a.m,
        actionText: kapali ? a.i : null,
        laborCost: iscilik, totalCost: iscilik,
        paymentStatus: kapali ? 'PAID' : 'UNPAID',
        createdAt: tarih, updatedAt: tarih, statusUpdatedAt: tarih,
      },
    });

    // Parça takıldıysa stoktan düşülür — "fişten stoğa" zinciri demoda görünsün.
    if (kapali && Math.random() < 0.6) {
      const parca = parcalar[rnd(0, parcalar.length - 1)];
      const adet = rnd(1, 2);
      await p.ticketPart.create({
        data: { tenantId: tenant.id, ticketId: fis.id, partId: parca.id, quantity: adet, unitPrice: parca.sellPrice },
      });
      await p.part.update({ where: { id: parca.id }, data: { stockQty: { decrement: adet } } });
      const yeniToplam = iscilik + Number(parca.sellPrice) * adet;
      await p.serviceTicket.update({ where: { id: fis.id }, data: { totalCost: yeniToplam } });
    }
    fisler.push(fis);
  }

  // ── FATURA · TAHSİLAT · CARİ ────────────────────────────────────────────
  // Gelir NAKİT ESASLI yazılıyor (tahsilatta), sistemdeki kural bu.
  // Bir müşteri bilerek ödemesiz bırakılıyor: "Borçlu Müşteriler" bloğu ve
  // gecikme takibi demoda boş kalmasın.
  let faturaNo = 0, faturaSayisi = 0, tahsilatSayisi = 0;
  for (const [ix, musteri] of musteriler.entries()) {
    const mCihazlar = cihazlar.filter((c) => c.customerId === musteri.id);
    if (!mCihazlar.length) continue;

    for (let ayOnce = 2; ayOnce >= 1; ayOnce--) {
      const d = new Date(); d.setMonth(d.getMonth() - ayOnce);
      const donem = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const kesim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const vade = new Date(kesim); vade.setDate(vade.getDate() + 15);

      const satirlar = [];
      let araToplam = 0;
      for (const c of mCihazlar) {
        const kira = Number(c.monthlyRent);
        satirlar.push({ kind: 'RENTAL', description: `${c.brand} ${c.model} · ${c.serialNo} aylık kira`, deviceId: c.id, quantity: 1, unitPrice: kira, lineTotal: kira });
        araToplam += kira;
        const asim = rnd(0, 3200);
        if (asim > 0) {
          const tutar = Math.round(asim * 0.42 * 100) / 100;
          satirlar.push({ kind: 'COUNTER', description: `${c.serialNo} · ${asim} sayfa aşım (S/B)`, deviceId: c.id, quantity: asim, unitPrice: 0.42, lineTotal: tutar });
          araToplam += tutar;
        }
      }
      araToplam = Math.round(araToplam * 100) / 100;
      const kdv = Math.round(araToplam * 0.20 * 100) / 100;
      const toplam = Math.round((araToplam + kdv) * 100) / 100;

      // Son müşteri hiç ödemiyor → gerçek bir borçlu; biri kısmi ödüyor.
      const borclu = ix === musteriler.length - 1;
      const kismi = ix === musteriler.length - 2 && ayOnce === 1;
      const odenen = borclu ? 0 : kismi ? Math.round(toplam * 0.4 * 100) / 100 : toplam;
      const durum = odenen === 0 ? (vade < new Date() ? 'OVERDUE' : 'OPEN') : odenen < toplam ? 'PARTIAL' : 'PAID';

      const fatura = await p.customerInvoice.create({
        data: {
          tenantId: tenant.id, customerId: musteri.id,
          invoiceNumber: `FTR-${donem}-${String(++faturaNo).padStart(3, '0')}`,
          period: donem, invoiceDate: kesim, dueDate: vade, status: durum,
          subtotal: araToplam, vatRate: 20, vatAmount: kdv, totalAmount: toplam,
          paidAmount: odenen, paidAt: odenen >= toplam ? vade : null,
          lines: { create: satirlar.map((s) => ({ ...s, tenantId: tenant.id })) },
        },
      });
      faturaSayisi++;

      if (odenen > 0) {
        const odeme = await p.payment.create({
          data: {
            tenantId: tenant.id, customerId: musteri.id, amount: odenen,
            method: ['TRANSFER', 'CASH', 'CARD'][rnd(0, 2)],
            paymentDate: vade, reconciled: true, notes: `${donem} dönemi tahsilatı`,
          },
        });
        await p.invoicePayment.create({
          data: { tenantId: tenant.id, invoiceId: fatura.id, paymentId: odeme.id, amount: odenen, allocatedAt: vade },
        });
        // NAKİT ESASLI GELİR KAYDI — muhasebe/cari modülü Payment'ı değil
        // FinancialTransaction'ı okuyor. Gerçek tahsilat yolu (lib/invoicing.ts)
        // bu satırı da yazıyor; tohum onu atlayınca muhasebe özeti ₺0 kalıyordu.
        await p.financialTransaction.create({
          data: {
            tenantId: tenant.id, customerId: musteri.id, invoiceId: fatura.id,
            type: 'INCOME', category: 'COUNTER_FEE', amount: odenen,
            method: odeme.method, description: `Tahsilat — ${fatura.invoiceNumber}`, date: vade,
          },
        });
        tahsilatSayisi++;
      }
    }
  }

  // ── GİDERLER ────────────────────────────────────────────────────────────
  // Cihaz kârlılığı ve muhasebe özeti gelir kadar gideri de ister.
  const GIDERLER = [
    { c: 'FUEL', d: 'Servis aracı yakıt', a: 8400 }, { c: 'MAINTENANCE', d: 'Araç bakım', a: 3200 },
    { c: 'SALARY', d: 'Teknisyen maaşı', a: 42000 }, { c: 'RENT', d: 'Depo kirası', a: 18000 },
    { c: 'PART_PURCHASE', d: 'Toner alımı (toplu)', a: 26500 }, { c: 'UTILITY', d: 'Telefon ve internet', a: 2400 },
  ];
  for (const g of GIDERLER) {
    const t = new Date(); t.setMonth(t.getMonth() - rnd(0, 2));
    await p.expense.create({
      data: { tenantId: tenant.id, category: g.c, description: g.d, amount: g.a, date: t, method: 'TRANSFER' },
    });
    // Gider modülü Expense'i, muhasebe özeti FinancialTransaction'ı okuyor.
    // İkisi de yazılmazsa "gider var ama muhasebede yok" çelişkisi görünüyor.
    await p.financialTransaction.create({
      data: {
        tenantId: tenant.id, type: 'EXPENSE', category: g.c, amount: g.a,
        method: 'TRANSFER', description: g.d, date: t,
      },
    });
  }

  return { parca: PARCALAR.length, kritik, fis: fisler.length, fatura: faturaSayisi, tahsilat: tahsilatSayisi, gider: GIDERLER.length };
}

main()
  .catch((e) => { console.error('HATA:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
