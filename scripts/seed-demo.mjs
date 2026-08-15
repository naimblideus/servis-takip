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

  for (const m of MUSTERILER) {
    const musteri = await p.customer.create({
      data: { tenantId: tenant.id, name: m.name, phone: m.phone, address: m.address },
    });

    const adet = rnd(1, 4);
    for (let i = 0; i < adet; i++) {
      const md = MODELLER[rnd(0, MODELLER.length - 1)];
      const siyah = rnd(18000, 240000);
      const renkli = md.renkli ? rnd(2000, 48000) : 0;

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
        },
      });

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

      // En eski okumanın değeri = bugünkü sayaç − üç ayın toplamı
      let oncekiS = Math.max(0, siyah - aylikHacim.reduce((a, x) => a + x.s, 0));
      let oncekiR = Math.max(0, renkli - aylikHacim.reduce((a, x) => a + x.r, 0));

      for (let ay = 3; ay >= 1; ay--) {
        const tarih = new Date();
        tarih.setMonth(tarih.getMonth() - ay);
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
    }
  }

  console.log(`  ${MUSTERILER.length} müşteri, ${cihazSayisi} cihaz, ${okumaSayisi} sayaç okuması`);
  console.log(`\nGiriş: ${EPOSTA} / ${SIFRE}`);
  console.log('Bu hesaptaki her isim ve rakam uydurmadır.');
}

main()
  .catch((e) => { console.error('HATA:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
