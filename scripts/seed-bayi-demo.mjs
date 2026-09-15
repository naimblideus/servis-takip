/**
 * ICP DEMO HESABI — "tam bizim gibi bir bayi" hissi veren demo.
 *
 * ⚠️ BURADAKİ HER İSİM VE RAKAM UYDURMADIR. Gerçek bir bayinin ya da
 * müşterisinin adı, fiyatı, cihaz sayısı bu dosyaya GİRMEZ.
 *
 * ── NEDEN AYRI BİR DEMO ──────────────────────────────────────────────────
 * `seed-demo.mjs` landing'deki "Demoyu Dene" için küçük ve hızlı. Bu ise
 * SAHADA GÖSTERİLEN demo: 14 müşteri, 40+ makine, 12 aylık geçmiş. Amacı,
 * karşısındaki bayinin ekrana bakıp "bu benim işim" demesi.
 *
 * ── EKRANLAR BOŞ KALMASIN ────────────────────────────────────────────────
 * Bu depoda ölçülmüş bir ders var: boş ekran anlatmıyor, kimse doldurmuyor
 * (854 cihazın 853'ünde toner verimi boştu). Demoda her ekranın gösterecek
 * bir şeyi var ve her ekranda BİR TANE net hikâye var:
 *
 *   Sarf Takibi ......... 3 makinenin toneri iki hafta içinde bitiyor,
 *                         verimleri SAHADA ÖLÇÜLDÜ (kimse yazmadı).
 *   Sözleşme Kârlılığı .. biri hedefin altında (zam cümlesi hazır),
 *                         birinde sayfa maliyeti alınan fiyatı AŞIYOR.
 *   e-Fatura ............ 9'u hazır, 3'ünde müşteri bilgisi eksik.
 *   Stok ................ aynı toner üç ayrı tedarikçiden üç ayrı fiyata.
 *   Teklif .............. aday müşteriye yıllık tasarruf rakamı çıkmış.
 *   Sayaç Turu .......... bu ayın okuması bekleyen makineler.
 *
 * Çalıştır:  node scripts/seed-bayi-demo.mjs
 * Tazele:    aynı komut — mevcut veri silinip yeniden kurulur (idempotent).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();

// ── GİRİŞ BİLGİLERİ ──────────────────────────────────────────────────────
// Kısa ve akılda kalır tutuldu: demoyu telefonla tarif edebilmek gerekiyor.
// E-posta bayi bazında benzersiz (@@unique([tenantId, email])), yani aynı
// adres başka bir bayide de olabilir; giriş kodu şifresi tutan adayı
// arayarak çözüyor. Yine de çakışmasın diye kullanılmayan adresler seçildi.
const SLUG = 'demo-bayi';
const PATRON = 'demo@demo.com';
const TEKNISYEN = 'tekniker@demo.com';
const SIFRE = process.env.BAYI_DEMO_SIFRE || 'demo1234';

const BUGUN = new Date();
const gunOnce = (n) => new Date(BUGUN.getTime() - n * 86400000);
const ayBasi = (geriAy) => {
  const d = new Date(BUGUN.getFullYear(), BUGUN.getMonth() - geriAy, 1);
  return d;
};
const donem = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Yinelenebilir rastgelelik: demo her kurulumda aynı hikâyeyi anlatsın.
 *
 * ⚠ YÜKSEK BİTLER KULLANILIYOR. Doğrusal üreteçlerin DÜŞÜK bitleri çok kısa
 * çevrimlidir: `tohum % 4` bu tohumda sürekli 0 veriyordu — ilk denemede
 * hiç servis fişi üretilmedi ve her `secim()` hep ilk elemanı seçti. Hata
 * sessizdi, çünkü kod çalıştı ve "0 fiş" makul bir sonuç gibi göründü.
 */
let tohum = 20260915;
const rnd = (a, b) => {
  tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
  return a + (Math.floor(tohum / 65536) % (b - a + 1));
};
const secim = (dizi) => dizi[rnd(0, dizi.length - 1)];

// ── MÜŞTERİLER ───────────────────────────────────────────────────────────
// Fatura bilgileri BİLEREK karışık: çoğu tam, üçü eksik. Gerçekte de öyle —
// bayi müşterisini telefonla tanıyor, vergi dairesini yalnız fatura kestiği
// yerlerden almış oluyor. Hepsi tam olsaydı e-Fatura ekranı bir şey
// anlatmazdı; hiçbiri olmasaydı ekran kullanılamazdı.
const MUSTERILER = [
  { ad: 'Yılmaz Mali Müşavirlik', tel: '05321110101', ilce: 'Ümraniye', unvan: 'Yılmaz Mali Müşavirlik ve Denetim Ltd. Şti.', vkn: '2110340501', vd: 'Ümraniye', eposta: 'muhasebe@yilmazmusavirlik.example', mukellef: true },
  { ad: 'Deniz Hukuk Bürosu', tel: '05321110102', ilce: 'Kadıköy', unvan: 'Deniz Avukatlık Ortaklığı', vkn: '2110340502', vd: 'Kadıköy', eposta: 'info@denizhukuk.example', mukellef: true },
  { ad: 'Özel Anadolu Polikliniği', tel: '05321110103', ilce: 'Ataşehir', unvan: 'Anadolu Özel Sağlık Hizmetleri A.Ş.', vkn: '2110340503', vd: 'Ataşehir', eposta: 'satinalma@anadolupoliklinik.example', mukellef: true },
  { ad: 'Kuzey Nakliyat', tel: '05321110104', ilce: 'Ümraniye', unvan: 'Kuzey Nakliyat ve Lojistik Ltd. Şti.', vkn: '2110340504', vd: 'Dudullu', eposta: 'muhasebe@kuzeynakliyat.example', mukellef: false },
  { ad: 'Arge Mimarlık', tel: '05321110105', ilce: 'Sarıyer', unvan: 'Arge Mimarlık ve Proje Ltd. Şti.', vkn: '2110340505', vd: 'Maslak', eposta: 'ofis@argemimarlik.example', mukellef: true },
  { ad: 'Bilge Eğitim Kurumları', tel: '05321110106', ilce: 'Kartal', unvan: 'Bilge Eğitim Kurumları A.Ş.', vkn: '2110340506', vd: 'Kartal', eposta: 'muhasebe@bilgeegitim.example', mukellef: true },
  { ad: 'Ege Gıda Toptan', tel: '05321110107', ilce: 'Esenyurt', unvan: 'Ege Gıda Dağıtım Ltd. Şti.', vkn: '2110340507', vd: 'Esenyurt', eposta: 'muhasebe@egegida.example', mukellef: false },
  { ad: 'Çınar Sigorta Aracılık', tel: '05321110108', ilce: 'Kadıköy', unvan: 'Çınar Sigorta Aracılık Hizmetleri Ltd. Şti.', vkn: '2110340508', vd: 'Kozyatağı', eposta: 'info@cinarsigorta.example', mukellef: true },
  { ad: 'Efe İnşaat Taahhüt', tel: '05321110109', ilce: 'Başakşehir', unvan: 'Efe İnşaat Taahhüt ve Ticaret A.Ş.', vkn: '2110340509', vd: 'Başakşehir', eposta: 'muhasebe@efeinsaat.example', mukellef: true },
  { ad: 'Marmara Turizm Acentesi', tel: '05321110110', ilce: 'Şişli', unvan: 'Marmara Turizm Seyahat Acenteliği Ltd. Şti.', vkn: '2110340510', vd: 'Şişli', eposta: 'muhasebe@marmaraturizm.example', mukellef: true },
  { ad: 'Nova Yazılım', tel: '05321110111', ilce: 'Beşiktaş', unvan: 'Nova Yazılım Teknolojileri A.Ş.', vkn: '2110340511', vd: 'Levent', eposta: 'finans@novayazilim.example', mukellef: true },
  // ── EKSİK: vergi bilgisi hiç alınmamış (e-Fatura ekranı bunu gösterir)
  { ad: 'Sağlam Muhasebe', tel: '05321110112', ilce: 'Pendik' },
  // ── EKSİK: vergi no var ama "mükellef mi" SORULMAMIŞ — belgenin hangi
  //    yoldan gideceği bilinmiyor, o yüzden hazır sayılmıyor.
  { ad: 'Kent Ecza Deposu', tel: '05321110113', ilce: 'Bayrampaşa', unvan: 'Kent Ecza Deposu Ltd. Şti.', vkn: '2110340513', vd: 'Bayrampaşa', eposta: 'muhasebe@kentecza.example' },
  // ── EKSİK: unvan yok (defterdeki ad ≠ tescilli unvan)
  { ad: 'Vizyon Reklam', tel: '05321110114', ilce: 'Şişli', vkn: '2110340514', vd: 'Şişli', eposta: 'info@vizyonreklam.example', mukellef: true },
];

// ── CİHAZ MODELLERİ ──────────────────────────────────────────────────────
// verim = tonerin GERÇEKTEN bastığı sayfa. Demoda cihaz kartına YAZILMIYOR:
// sistem toner değişimlerinden kendi ölçüyor. Buradaki sayı yalnız sahte
// sayaç geçmişini gerçekçi üretmek için.
const MODELLER = [
  { marka: 'Kyocera', model: 'ECOSYS M2540dn', renkli: false, verim: 7200, aylik: [1800, 5200], kira: 1450, sbFiyat: 0.42, toner: 'Kyocera TK-1170 Toner' },
  { marka: 'Kyocera', model: 'TASKalfa 2553ci', renkli: true, verim: 11500, verimR: 8500, aylik: [3200, 9500], kira: 3200, sbFiyat: 0.38, renkliFiyat: 1.85, toner: 'Kyocera TK-8115K Siyah Toner', tonerR: 'Kyocera TK-8115 Renkli Set (C+M+Y)' },
  { marka: 'Canon', model: 'imageRUNNER 2425', renkli: false, verim: 10200, aylik: [2500, 7000], kira: 1950, sbFiyat: 0.40, toner: 'Canon C-EXV60 Toner' },
  { marka: 'Canon', model: 'iR-ADV C3525i', renkli: true, verim: 16000, verimR: 9800, aylik: [4000, 12000], kira: 4100, sbFiyat: 0.36, renkliFiyat: 1.60, toner: 'Canon C-EXV49 Siyah Toner', tonerR: 'Canon C-EXV49 Renkli Set (C+M+Y)' },
  { marka: 'Ricoh', model: 'IM 350F', renkli: false, verim: 13500, aylik: [2200, 6500], kira: 1750, sbFiyat: 0.41, toner: 'Ricoh IM 350 Toner' },
  { marka: 'HP', model: 'LaserJet Pro M404dn', renkli: false, verim: 3000, aylik: [900, 2600], kira: 850, sbFiyat: 0.48, toner: 'HP CF259A Toner' },
  { marka: 'Konica Minolta', model: 'bizhub 250i', renkli: false, verim: 12000, aylik: [2400, 6800], kira: 1850, sbFiyat: 0.39, toner: 'Konica TN-118 Toner' },
  { marka: 'Brother', model: 'HL-L5100DN', renkli: false, verim: 3000, aylik: [800, 2200], kira: 780, sbFiyat: 0.50, toner: 'Brother TN-3480 Toner' },
];

// ── STOK ─────────────────────────────────────────────────────────────────
// Alış fiyatı burada YOK: her parça ALIŞ KAYITLARINDAN maliyetleniyor
// (aşağıda), çünkü gerçek bayi aynı toneri üç ayrı yerden üç ayrı fiyata
// alıyor ve "tek alış fiyatı" alanı bunu taşıyamıyor.
const PARCALAR = [
  { ad: 'Kyocera TK-1170 Toner', grup: 'Toner', satis: 1250, alislar: [[8, 690, 'Anadolu Bilgisayar'], [6, 740, 'Kadıköy Ofis'], [10, 665, 'Anadolu Bilgisayar']] },
  { ad: 'Kyocera TK-8115K Siyah Toner', grup: 'Toner', satis: 2150, alislar: [[4, 1180, 'Anadolu Bilgisayar'], [3, 1290, 'Acil Tedarik']] },
  { ad: 'Kyocera TK-8115 Renkli Set (C+M+Y)', grup: 'Toner', satis: 7900, alislar: [[6, 4620, 'Anadolu Bilgisayar'], [3, 5080, 'Kadıköy Ofis']] },
  { ad: 'Canon C-EXV60 Toner', grup: 'Toner', satis: 1780, alislar: [[5, 980, 'Kadıköy Ofis'], [4, 1045, 'Anadolu Bilgisayar']] },
  { ad: 'Canon C-EXV49 Siyah Toner', grup: 'Toner', satis: 1950, alislar: [[4, 1090, 'Anadolu Bilgisayar'], [2, 1210, 'Acil Tedarik']] },
  // ⚠ RENKLİ TONER = SET FİYATI. Bir renkli sayfa camgöbeği, macenta ve
  //   sarıyı birden tüketiyor; tek kartuş fiyatıyla hesaplamak sayfa
  //   maliyetini üç kat düşük gösterirdi. Eski sözleşmedeki düşük renkli
  //   sayfa fiyatı bu maliyetin ALTINDA kalıyor — kârlılık ekranındaki
  //   kırmızı "her sayfada zarar" uyarısı buradan doğuyor.
  { ad: 'Canon C-EXV49 Renkli Set (C+M+Y)', grup: 'Toner', satis: 9600, alislar: [[3, 5680, 'Anadolu Bilgisayar'], [3, 6240, 'Acil Tedarik']] },
  { ad: 'Ricoh IM 350 Toner', grup: 'Toner', satis: 1690, alislar: [[6, 920, 'Kadıköy Ofis'], [4, 985, 'Anadolu Bilgisayar']] },
  { ad: 'HP CF259A Toner', grup: 'Toner', satis: 1450, alislar: [[8, 810, 'Anadolu Bilgisayar'], [5, 870, 'Kadıköy Ofis']] },
  { ad: 'Konica TN-118 Toner', grup: 'Toner', satis: 1620, alislar: [[5, 890, 'Kadıköy Ofis'], [4, 940, 'Anadolu Bilgisayar']] },
  { ad: 'Brother TN-3480 Toner', grup: 'Toner', satis: 1180, alislar: [[7, 640, 'Anadolu Bilgisayar']] },
  { ad: 'Kyocera DK-1150 Drum Ünitesi', grup: 'Drum', satis: 2400, alislar: [[3, 1350, 'Anadolu Bilgisayar']] },
  { ad: 'Canon FM1-A606 Fırın Ünitesi', grup: 'Fırın Grubu', satis: 3900, alislar: [[2, 2250, 'Kadıköy Ofis']] },
  { ad: 'Kağıt Alma Pateni (set)', grup: 'Paten', satis: 480, alislar: [[20, 165, 'Anadolu Bilgisayar'], [15, 190, 'Acil Tedarik']] },
  { ad: 'Fuser Film Kılıfı', grup: 'Yedek Parça', satis: 620, alislar: [[12, 240, 'Anadolu Bilgisayar']] },
  { ad: 'Transfer Rulosu', grup: 'Yedek Parça', satis: 540, alislar: [[10, 215, 'Kadıköy Ofis']] },
];

const ARIZALAR = [
  { k: 'PAPER_JAM', m: 'Kağıt sıkışması — arka kapak bölgesi', i: 'Paten seti değişti, kağıt yolu temizlendi.' },
  { k: 'PRINT_QUALITY', m: 'Baskıda dikey çizgi', i: 'Drum temizlendi, test baskısı alındı.' },
  { k: 'TONER', m: 'Toner bitti uyarısı', i: 'Toner değişti, sayaç kaydedildi.' },
  { k: 'NETWORK', m: 'Ağdan yazdırma yapılamıyor', i: 'IP çakışması giderildi, sürücü yeniden kuruldu.' },
  { k: 'PERIODIC_MAINTENANCE', m: 'Periyodik bakım', i: 'Genel temizlik ve kalibrasyon yapıldı.' },
  { k: 'PAPER_JAM', m: 'Çift taraflı baskıda sıkışma', i: 'Dupleks ünitesi sökülüp temizlendi.' },
  { k: 'PRINT_QUALITY', m: 'Baskı soluk çıkıyor', i: 'Toner sarsıldı, yoğunluk ayarı yapıldı.' },
  { k: 'ROLLER', m: 'Kağıt çekmiyor', i: 'Paten mekanizması değişti.' },
  { k: 'FUSER', m: 'Fırın hatası kodu veriyor', i: 'Fuser film kılıfı değişti.' },
  { k: 'DRUM', m: 'Baskıda tekrar eden leke', i: 'Drum ünitesi değişti.' },
];

async function main() {
  console.log('\n═══ ICP DEMO KURULUYOR ═══\n');

  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) {
    await p.tenant.delete({ where: { id: eski.id } });
    console.log('  eski demo silindi');
  }

  // ── BAYİ ──────────────────────────────────────────────────────────────
  const tenant = await p.tenant.create({
    data: {
      name: 'Demo Büro Sistemleri', slug: SLUG,
      // ── BÜTÜN ÖZELLİKLER AÇIK ──────────────────────────────────────
      // Demo bir paket satmak için değil ÜRÜNÜ GÖSTERMEK için. Kapalı
      // bir modül, karşıdaki bayinin göremediği bir özellik demek;
      // görmediği şeyi de sormuyor. Plan Kurumsal ve modül listesi
      // açıkça yazılı: plan varsayılanı ileride değişse bile demoda
      // hiçbir ekran kaybolmasın.
      plan: 'enterprise', isActive: true, maxUsers: 25,
      modules: ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP'],
      marketEnabled: true,
      // WhatsApp menüde ancak Meta numarası bağlıysa görünüyor.
      // Demoda kanal kurulmuş sayılıyor; gelen mesaj kuyruğu aşağıda.
      whatsappPhoneId: 'DEMO-WA-1015550100',
      pricePerBlack: 0.42, pricePerColor: 1.75,
      taxNumber: '2110340100', taxOffice: 'Ümraniye',
      address: 'Alemdağ Cad. No:112 Kat:2', city: 'İstanbul', district: 'Ümraniye',
      phone: '02165550100', email: 'info@demoburo.example',
      ownerName: 'Serkan Yalçın',
      paymentTermDays: 15,
      // ── KÂRLILIK HESABININ İKİ GİRDİSİ ──
      // Bunlar dolu olmasaydı kârlılık ekranı "işçilik hariç" deyip yarım
      // çalışırdı ve demo o ekranı anlatamazdı.
      ziyaretMaliyeti: 450,
      // HEDEF MARJ NEDEN %72: bu hesap sarf (toner/parça) + servis
      // ziyaretini kapsıyor, MAKİNENİN KENDİ bedelini değil — sistem
      // amortisman tutmuyor. Yani ölçülen şey BRÜT KATKI MARJI ve sağlıklı
      // bir kiralama sözleşmesinde yüksek çıkıyor: bu demo verisinde
      // gerçekleşen dağılım %63 ile %85 arasında.
      //
      // %72 hedefiyle 14 sözleşmenin 6'sı altta kalıyor ve ekran bir
      // yapılacaklar listesi oluyor. %30 koysaydık hiçbiri altta kalmaz,
      // %90 koysaydık hepsi kalırdı — iki uçta da ekran bir şey anlatmaz.
      hedefMarj: 0.72,
      // ── e-FATURA: ELDEN GÖNDERİM ──
      // Entegratör sözleşmesi olmayan bir bayi bile UBL XML'i indirip kendi
      // portalına yükleyerek faturayı kesebiliyor. Demo tam olarak bunu
      // gösteriyor; kullanıcı adı/parola istemiyor.
      eFaturaOnEk: 'MBS', eFaturaSaglayici: 'ELDEN', eFaturaTestModu: true,
      // Uydurma veri gerçek popülasyon ölçümünü kirletmesin.
      oemDataSharing: false,
    },
  });

  const patron = await p.user.create({
    data: {
      tenantId: tenant.id, email: PATRON, name: 'Serkan Yalçın',
      passwordHash: await bcrypt.hash(SIFRE, 12), role: 'ADMIN', isActive: true,
    },
  });
  const teknisyen = await p.user.create({
    data: {
      tenantId: tenant.id, email: TEKNISYEN, name: 'Murat Demir',
      passwordHash: await bcrypt.hash(SIFRE, 12), role: 'TECHNICIAN', isActive: true,
    },
  });

  // ── STOK + ALIŞLAR ────────────────────────────────────────────────────
  // Her alış ayrı kayıt; ortalama maliyet hareketli ağırlıklı ortalamayla
  // ilerliyor. "Son alış fiyatı" ile "elindekinin maliyeti" farkı demoda
  // gözle görülüyor.
  const parcaHarita = new Map();
  let sku = 0;
  for (const x of PARCALAR) {
    const parca = await p.part.create({
      data: {
        tenantId: tenant.id, sku: `MBS-${String(++sku).padStart(4, '0')}`,
        name: x.ad, group: x.grup, sellPrice: x.satis,
        buyPrice: 0, stockQty: 0, minStock: 3,
      },
    });
    let stok = 0, ortalama = null;
    let gun = 340;
    for (const [adet, birim, tedarikci] of x.alislar) {
      ortalama = stok > 0 && ortalama
        ? Math.round(((stok * ortalama + adet * birim) / (stok + adet)) * 100) / 100
        : birim;
      stok += adet;
      await p.partPurchase.create({
        data: {
          tenantId: tenant.id, partId: parca.id, quantity: adet, unitCost: birim,
          supplier: tedarikci, invoiceNo: `A-${2026}${String(rnd(1000, 9999))}`,
          purchasedAt: gunOnce(gun), avgAfter: ortalama,
        },
      });
      gun -= rnd(70, 110);
    }
    if (x.alislar.length) {
      await p.part.update({
        where: { id: parca.id },
        data: { stockQty: stok, avgCost: ortalama, buyPrice: x.alislar[x.alislar.length - 1][1] },
      });
    }
    parcaHarita.set(x.ad, { id: parca.id, satis: x.satis, maliyet: ortalama });
  }
  console.log(`  stok: ${PARCALAR.length} parça, alış kaydı girildi`);

  // ── MÜŞTERİ + CİHAZ + SAYAÇ ───────────────────────────────────────────
  const musteriler = [];
  const cihazlar = [];
  let seri = 0;

  for (let mi = 0; mi < MUSTERILER.length; mi++) {
    const m = MUSTERILER[mi];
    const musteri = await p.customer.create({
      data: {
        tenantId: tenant.id, name: m.ad, phone: m.tel,
        address: `${m.ilce}, İstanbul`,
        legalName: m.unvan ?? null, taxNo: m.vkn ?? null, taxOffice: m.vd ?? null,
        city: m.vkn ? 'İstanbul' : null, district: m.vkn ? m.ilce : null,
        email: m.eposta ?? null,
        eInvoiceUser: m.mukellef === undefined ? null : m.mukellef,
        portalEnabled: mi < 6,
        portalToken: mi < 6 ? `mbs-portal-${mi + 1}-${Math.random().toString(36).slice(2, 10)}` : null,
      },
    });
    musteriler.push(musteri);

    // Büyük müşteride 5-6, küçükte 1-2 makine — gerçek dağılım böyle.
    const adet = mi < 3 ? rnd(5, 6) : mi < 8 ? rnd(3, 4) : rnd(1, 2);
    for (let i = 0; i < adet; i++) {
      const mdl = MODELLER[(mi + i) % MODELLER.length];
      const kurulum = gunOnce(rnd(200, 1500));

      // Kira ve sayfa fiyatı müşteriden müşteriye biraz oynuyor — pazarlık
      // gerçek hayatta da böyle. Bir müşteri BİLEREK eski fiyatta bırakıldı
      // (aşağıda): kârlılık ekranının anlatacağı hikâye o.
      // İKİ MÜŞTERİ BİLEREK ESKİ FİYATTA: sözleşmeleri iki yıldır
      // yenilenmemiş. Kârlılık ekranının anlatacağı hikâye onlar —
      // hepsinin marjı iyi olsaydı ekran hiçbir şey söylemezdi.
      // ── KUZEY NAKLİYAT: iki yıldır zam yapılmamış ──
      // Marjı hedefin belirgin altında ama makul bir zamla düzelir.
      // %300'lük bir öneri çıkarsaydı demo inandırıcılığını kaybederdi;
      // görüşmede söylenebilecek bir rakam olmalı.
      const eskiSozlesme = mi === 3;
      // ── EGE GIDA: SESSİZ ZARAR ──
      // Sayfa fiyatı, o modelin ÖLÇÜLEN toner maliyetinin altında. Toplam
      // marj kirayla ayakta duruyor, ama her basılan sayfada para
      // kaybediliyor ve hacim arttıkça zarar da artıyor. Kârlılık
      // ekranındaki kırmızı uyarı tam olarak bunu yakalıyor.
      const sessizZarar = mi === 6;
      const kira = Math.round(mdl.kira * (eskiSozlesme ? 0.70 : 1 + (rnd(-6, 8) / 100)));
      const sbFiyat = sessizZarar
        ? 0.11
        : Math.round(mdl.sbFiyat * (eskiSozlesme ? 0.60 : 1 + (rnd(-5, 6) / 100)) * 100) / 100;
      const renkliFiyat = mdl.renkli
        ? Math.round((mdl.renkliFiyat ?? 1.6) * (eskiSozlesme ? 0.72 : 1 + (rnd(-5, 6) / 100)) * 100) / 100
        : null;

      const aylikSb = rnd(mdl.aylik[0], mdl.aylik[1]);
      const aylikRenkli = mdl.renkli ? Math.round(aylikSb * (rnd(25, 60) / 100)) : 0;
      const baslangicSb = rnd(18000, 240000);
      const baslangicRenkli = mdl.renkli ? Math.round(baslangicSb * 0.35) : 0;

      const cihaz = await p.device.create({
        data: {
          tenantId: tenant.id, customerId: musteri.id,
          brand: mdl.marka, model: mdl.model,
          serialNo: `MBS${String(++seri).padStart(5, '0')}`,
          publicCode: `MBS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          qrTokenHash: `seed-${seri}`,
          location: secim(['Muhasebe', 'Yönetim katı', 'Ön büro', '2. kat koridor', 'Arşiv odası', 'Toplantı katı']),
          installedAt: kurulum, installedAtPrecision: 'DAY',
          warrantyStart: kurulum,
          warrantyEnd: new Date(kurulum.getTime() + 730 * 86400000),
          isRental: true, monthlyRent: kira,
          pricePerBlack: sbFiyat, pricePerColor: renkliFiyat,
          includedBlack: secim([0, 0, 1000, 2000]),
          counterBlack: baslangicSb, counterColor: baslangicRenkli,
          // tonerYield BİLEREK BOŞ — sistem toner değişimlerinden ölçecek.
        },
      });
      cihazlar.push({ ...cihaz, mdl, aylikSb, aylikRenkli, musteriAdi: m.ad, eskiSozlesme });
    }
  }
  console.log(`  ${musteriler.length} müşteri · ${cihazlar.length} cihaz`);

  // ── SAYAÇ GEÇMİŞİ (6 ay) ──────────────────────────────────────────────
  let okuma = 0;
  const sessizCihazlar = new Set(cihazlar.slice(3, 6).map((c) => c.id));
  for (const c of cihazlar) {
    let sb = c.counterBlack - c.aylikSb * 12;
    let renkli = c.counterColor - c.aylikRenkli * 12;
    if (sb < 0) sb = 500;
    if (renkli < 0) renkli = 0;
    let oncekiSb = sb, oncekiRenkli = renkli;

    // ÜÇ CİHAZIN SAYACI İKİ AYDIR GELMİYOR. "Sayacı gelmeyen cihaz" kartı
    // bu ürünün en sessiz para kaybını yakalıyor: okunmayan sayaç
    // faturalanmıyor ve kimse fark etmiyor. Kart sıfır gösterseydi
    // anlatılamazdı.
    const sessiz = sessizCihazlar.has(c.id);
    for (let ay = 12; ay >= 1; ay--) {
      if (sessiz && ay <= 2) break;
      sb += c.aylikSb + rnd(-300, 300);
      renkli += c.aylikRenkli + (c.aylikRenkli ? rnd(-120, 120) : 0);
      const tarih = new Date(ayBasi(ay).getFullYear(), ayBasi(ay).getMonth(), rnd(26, 28));
      const farkSb = Math.max(0, Math.max(0, sb) - oncekiSb);
      const farkRenkli = Math.max(0, Math.max(0, renkli) - oncekiRenkli);
      const asimSb = Math.max(0, farkSb - (c.includedBlack || 0));
      await p.counterReading.create({
        data: {
          tenantId: tenant.id, deviceId: c.id, readingDate: tarih,
          counterBlack: Math.max(0, sb), counterColor: Math.max(0, renkli),
          deltaBlack: farkSb, deltaColor: farkRenkli,
          calculatedCost: Math.round((asimSb * Number(c.pricePerBlack) + farkRenkli * Number(c.pricePerColor || 0)) * 100) / 100,
          monthlyRent: Number(c.monthlyRent),
          // Kaynak KANITIN GÜCÜNÜ söylüyor: cihazın kendi e-postası,
          // müşterinin portaldan girdiği ve teknisyenin elle yazdığı aynı
          // ağırlıkta değil. Demoda üçü de var.
          source: secim(['ELLE', 'ELLE', 'CIHAZ_EPOSTA', 'PORTAL', 'FOTOGRAF']),
          billed: true, createdAt: tarih,
        },
      });
      oncekiSb = Math.max(0, sb); oncekiRenkli = Math.max(0, renkli);
      okuma++;
    }
    // Cihazın güncel sayacı = son okuma + bu ayın kısmi kullanımı
    const gecenGun = BUGUN.getDate();
    const kismi = Math.round((c.aylikSb * gecenGun) / 30);
    const kismiR = Math.round((c.aylikRenkli * gecenGun) / 30);
    await p.device.update({
      where: { id: c.id },
      data: { counterBlack: sb + kismi, counterColor: renkli + kismiR },
    });
    c.counterBlack = sb + kismi;
    c.counterColor = renkli + kismiR;
    c.sonFaturalananSb = sb;
    c.sonFaturalananRenkli = renkli;
  }
  console.log(`  ${okuma} sayaç okuması (12 ay)`);

  // ── BU AYIN OKUMASI: bir kısmı BEKLİYOR ───────────────────────────────
  // Sayaç Turu ekranının işi bu. Hepsi okunmuş olsaydı ekran boş kalırdı.
  let bekleyen = 0;
  for (const c of cihazlar) {
    if (sessizCihazlar.has(c.id)) { bekleyen++; continue; }
    if (rnd(0, 100) < 55) {
      const t2 = gunOnce(rnd(1, 6));
      await p.counterReading.create({
        data: {
          tenantId: tenant.id, deviceId: c.id, readingDate: t2,
          counterBlack: c.counterBlack, counterColor: c.counterColor,
          deltaBlack: Math.max(0, c.counterBlack - (c.sonFaturalananSb ?? 0)),
          deltaColor: Math.max(0, c.counterColor - (c.sonFaturalananRenkli ?? 0)),
          monthlyRent: Number(c.monthlyRent),
          source: secim(['ELLE', 'CIHAZ_EPOSTA', 'PORTAL']),
          billed: false, createdAt: t2,
        },
      });
    } else bekleyen++;
  }
  console.log(`  bu ayın okuması: ${bekleyen} makine bekliyor · ${sessizCihazlar.size} makinenin sayacı 2 aydır gelmiyor`);

  // ── TONER DEĞİŞİMLERİ → VERİM SAHADA ÖLÇÜLÜYOR ────────────────────────
  // Her cihaza üç değişim yazılıyor: ilki referans, sonraki ikisi GÖZLEM.
  // Böylece hem cihaz hem model bazında verim ölçülmüş oluyor ve Sarf
  // Takibi ekranı ilk günden çalışıyor — kimse bir sayı yazmadan.
  let degisim = 0, gozlem = 0, tonerFisNo = 0, tonerFisi = 0;
  for (const c of cihazlar) {
    const tonerAd = c.mdl.toner;
    const parca = parcaHarita.get(tonerAd);
    if (!parca) continue;

    const kanallar = [{ kanal: 'BLACK', verim: c.mdl.verim, sayac: c.counterBlack, parcaAd: tonerAd }];
    if (c.mdl.renkli && c.mdl.tonerR && parcaHarita.get(c.mdl.tonerR)) {
      kanallar.push({ kanal: 'COLOR', verim: c.mdl.verimR ?? c.mdl.verim, sayac: c.counterColor, parcaAd: c.mdl.tonerR });
    }

    for (const k of kanallar) {
      const pr = parcaHarita.get(k.parcaAd);
      // Son değişimden bu yana ne kadar basıldığı: bazı cihazlarda tonerin
      // BİTMEK ÜZERE olması için bilerek yüksek seçiliyor.
      const kalanOran = rnd(0, 100) < 22 ? rnd(85, 96) / 100 : rnd(15, 70) / 100;
      const sonDegisimSayac = Math.max(0, k.sayac - Math.round(k.verim * kalanOran));
      // Beş değişim, 11 aya yayılmış: gelir penceresi 12 ay olduğu için
      // maliyet de aynı pencereye dağılmalı. Dört aya sıkıştırılsaydı
      // kârlılık, maliyeti eksik sayıp marjı olduğundan yüksek gösterirdi.
      const oncekiler = [];
      let imlec = sonDegisimSayac;
      for (let n = 0; n < 5; n++) {
        if (imlec <= 0) break;
        oncekiler.unshift(imlec);
        imlec -= Math.round(k.verim * (rnd(92, 108) / 100));
      }

      let onceki = null;
      for (let i = 0; i < oncekiler.length; i++) {
        const deger = oncekiler[i];
        const olculen = onceki === null ? null : deger - onceki;
        const tarih = gunOnce(330 - i * Math.floor(300 / Math.max(1, oncekiler.length - 1)) + rnd(-6, 6));

        // ── TONER DEĞİŞİMİ BİR SERVİS FİŞİDİR ────────────────────────────
        // Gerçek akışta toner stoktan FİŞLE çıkıyor; maliyet oraya
        // yazılıyor ve sözleşme kârlılığına oradan giriyor. İlk kurulumda
        // bu fişler yazılmamıştı ve sonuç sessizce yanlıştı: en büyük
        // maliyet kalemi hesaba hiç girmediği için bütün sözleşmeler
        // %95 marjla çalışıyor göründü.
        const fis = await p.serviceTicket.create({
          data: {
            tenantId: tenant.id, deviceId: c.id, customerId: c.customerId,
            ticketNumber: `MBS-T${String(++tonerFisNo).padStart(4, '0')}`,
            status: 'DELIVERED', priority: 'NORMAL',
            createdByUserId: patron.id, assignedUserId: teknisyen.id,
            faultCategory: 'TONER',
            issueText: `${k.kanal === 'COLOR' ? 'Renkli' : 'S/B'} toner bitti`,
            actionText: `${k.parcaAd} takıldı, sayaç kaydedildi.`,
            laborCost: 0, totalCost: pr.satis,
            paymentStatus: 'PAID',
            createdAt: tarih, updatedAt: tarih, statusUpdatedAt: tarih,
          },
        });
        await p.ticketPart.create({
          data: {
            tenantId: tenant.id, ticketId: fis.id, partId: pr.id, quantity: 1,
            unitPrice: pr.satis, unitCost: pr.maliyet ?? null, createdAt: tarih,
          },
        });
        // Takılan toner stoktan DÜŞER. İlk kurulumda bu satır yoktu:
        // 227 toner fişe yazılmış ama raftan hiç eksilmemiş görünüyordu.
        await p.part.update({ where: { id: pr.id }, data: { stockQty: { decrement: 1 } } });
        tonerFisi++;

        await p.tonerChange.create({
          data: {
            tenantId: tenant.id, deviceId: c.id, channel: k.kanal,
            counterValue: deger, changedAt: tarih,
            observedYield: olculen && olculen >= 100 && olculen <= 200000 ? olculen : null,
            partId: pr.id, source: 'FIS', note: k.parcaAd,
          },
        });
        degisim++;
        if (olculen) gozlem++;
        onceki = deger;
      }
      await p.device.update({
        where: { id: c.id },
        data: k.kanal === 'BLACK'
          ? { tonerResetBlack: sonDegisimSayac, tonerChangedAt: gunOnce(30) }
          : { tonerResetColor: sonDegisimSayac, tonerChangedAt: gunOnce(30) },
      });
    }
  }
  console.log(`  ${degisim} toner değişimi (${tonerFisi} fiş) → ${gozlem} verim gözlemi (kimse elle girmedi)`);

  // ── SAYAÇ E-POSTASI KUYRUĞU ───────────────────────────────────────────
  // Cihazların kendi gönderdiği sayaç raporları. Kuyruk BİLEREK karışık:
  // çoğu eşleşip okumaya dönüşmüş, biri hiç eşleşmemiş (seri tanınmıyor),
  // biri de okunamamış. Hepsi eşleşseydi ekran hiçbir şey anlatmazdı;
  // hiçbiri eşleşmeseydi kanal çalışmıyor sanılırdı.
  {
    const epostali = cihazlar.slice(0, 12);
    for (let i = 0; i < epostali.length; i++) {
      const c = epostali[i];
      const gun = rnd(1, 20);
      await p.counterEmail.create({
        data: {
          tenantId: tenant.id, deviceId: c.id,
          fromAddress: `${c.brand.toLowerCase()}-${c.serialNo.toLowerCase()}@cihaz.demoburo.example`,
          subject: `Counter Report / Sayac Raporu — ${c.serialNo}`,
          rawText: [
            `Device: ${c.brand} ${c.model}`,
            `Serial Number: ${c.serialNo}`,
            `Total Black: ${c.counterBlack}`,
            c.counterColor ? `Total Color: ${c.counterColor}` : 'Total Color: 0',
            `Report Date: ${gunOnce(gun).toLocaleDateString('tr-TR')}`,
          ].join('\n'),
          serial: c.serialNo,
          parsedBlack: c.counterBlack, parsedColor: c.counterColor ?? 0,
          status: 'ISLENDI', receivedAt: gunOnce(gun),
        },
      });
    }
    // Seri tanınmadı: bu satır bayinin TEK TIKLA cihazla eşleştirmesini
    // bekliyor. Eşleşmezse o cihazın sayacı her ay sessizce kaybolur.
    await p.counterEmail.create({
      data: {
        tenantId: tenant.id,
        fromAddress: 'noreply@kyoceradocumentsolutions.example',
        subject: 'Counter Report — KM-A4821X',
        rawText: 'Device: Kyocera ECOSYS M2540dn\nSerial Number: KM-A4821X\nTotal Black: 48210\nTotal Color: 0',
        serial: 'KM-A4821X', parsedBlack: 48210, parsedColor: 0,
        status: 'BEKLIYOR', receivedAt: gunOnce(2),
      },
    });
    // Okunamayan biçim: ek ZIP içinde gelmiş, metin çıkarılamamış.
    await p.counterEmail.create({
      data: {
        tenantId: tenant.id,
        fromAddress: 'reports@canon-oip.example',
        subject: 'Meter Read Report (attachment)',
        rawText: 'Rapor ek dosyada (ZIP). Metin gövdesinde sayaç yok.',
        status: 'HATA', hata: 'Sayaç değeri bulunamadı — rapor ek dosyada geliyor.',
        receivedAt: gunOnce(5),
      },
    });
  }

  // ── SERVİS FİŞLERİ ────────────────────────────────────────────────────
  let fisNo = 0, fisSayisi = 0;
  for (const c of cihazlar) {
    // Cihaz başına 1-4 arıza (6 ayda). Daha azını üretince aşınma
    // parçaları model başına üç kullanıma ulaşmıyor ve fişteki "bu
    // modelde en çok kullanılanlar" önerisi yalnız toneri gösteriyordu.
    const kac = rnd(1, 4);
    for (let i = 0; i < kac; i++) {
      const a = secim(ARIZALAR);
      const kapali = rnd(0, 100) < 78;
      // AÇIK FİŞ ESKİ OLAMAZ. İlk kurulumda bütün fişler yıla yayılıyordu
      // ve panoda "300 gün" bekleyen açık fişler çıkıyordu — hiçbir bayi
      // fişi on ay açık bırakmaz, demo ihmal edilmiş bir işletme gibi
      // görünüyordu. Kapanmışlar yıla yayılı, açıklar bu ayın işi.
      const tarih = kapali ? gunOnce(rnd(12, 350)) : gunOnce(rnd(0, 11));
      const iscilik = secim([0, 0, 450, 600, 750]);

      const fis = await p.serviceTicket.create({
        data: {
          tenantId: tenant.id, deviceId: c.id, customerId: c.customerId,
          ticketNumber: `MBS-${String(++fisNo).padStart(4, '0')}`,
          status: kapali ? secim(['DELIVERED', 'READY']) : secim(['NEW', 'IN_SERVICE', 'WAITING_FOR_PART']),
          priority: secim(['LOW', 'NORMAL', 'NORMAL', 'HIGH']),
          createdByUserId: patron.id, assignedUserId: teknisyen.id,
          faultCategory: a.k, issueText: a.m, actionText: kapali ? a.i : null,
          laborCost: iscilik, totalCost: iscilik,
          paymentStatus: kapali && rnd(0, 100) < 70 ? 'PAID' : 'UNPAID',
          createdAt: tarih, updatedAt: tarih, statusUpdatedAt: tarih,
        },
      });
      fisSayisi++;

      // Parça takıldıysa: stoktan düşer VE o günün maliyeti fişe donar.
      if (kapali && rnd(0, 100) < 62) {
        // Takılan parça ARIZAYLA UYUMLU: rastgele parça takmak, "bu modelde
        // en çok kullanılanlar" önerisini de anlamsız yapardı.
        const adAdaylari = a.k === 'TONER' ? [c.mdl.toner]
          : a.k === 'PAPER_JAM' || a.k === 'ROLLER' ? ['Kağıt Alma Pateni (set)', 'Transfer Rulosu']
            : a.k === 'PERIODIC_MAINTENANCE' ? ['Fuser Film Kılıfı', 'Kağıt Alma Pateni (set)']
              : a.k === 'FUSER' ? ['Fuser Film Kılıfı']
                : a.k === 'DRUM' ? ['Kyocera DK-1150 Drum Ünitesi']
                  : ['Fuser Film Kılıfı', 'Transfer Rulosu'];
        const pr = parcaHarita.get(secim(adAdaylari));
        if (pr) {
          const adet = rnd(1, 2);
          await p.ticketPart.create({
            data: {
              tenantId: tenant.id, ticketId: fis.id, partId: pr.id, quantity: adet,
              unitPrice: pr.satis, unitCost: pr.maliyet ?? null, createdAt: tarih,
            },
          });
          await p.part.update({ where: { id: pr.id }, data: { stockQty: { decrement: adet } } });
          const toplam = iscilik + pr.satis * adet;
          await p.serviceTicket.update({ where: { id: fis.id }, data: { totalCost: toplam } });

          await p.accountEntry.create({
            data: {
              tenantId: tenant.id, customerId: c.customerId, ticketId: fis.id,
              type: 'SALE', product: `Servis ${fis.ticketNumber}`, amount: toplam,
              method: 'OPEN_ACCOUNT', notes: 'Servis fişi', createdByName: 'Serkan Yalçın', date: tarih,
            },
          });
        }
      }
    }
  }
  console.log(`  ${fisSayisi} arıza fişi (+ ${tonerFisi} toner fişi)`);

  // ── STOK DENKLEŞTİRME ─────────────────────────────────────────────────
  // Yıl boyunca tüketilen parça, açılış alışlarından fazla olabiliyor ve
  // stok EKSİYE düşüyordu. Eksi stok gerçek hayatta olmaz: bayi biterken
  // yeniden alır. Tüketim belli olduktan sonra eksik kalan miktar üç ayrı
  // alışa bölünerek yıla yayılıyor — tedarikçi karşılaştırması da bundan
  // besleniyor.
  //
  // Ortalama maliyet bu alışlarla yeniden hesaplanıyor ama FİŞLERE
  // DONDURULMUŞ maliyetlere DOKUNULMUYOR: o fişin o günkü maliyeti neyse
  // odur, sonraki alışlar geçmişi değiştirmez.
  {
    const TEDARIKCILER = ['Anadolu Bilgisayar', 'Kadıköy Ofis', 'Acil Tedarik'];
    let ekAlis = 0;
    const hepsi = await p.part.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, stockQty: true, avgCost: true, buyPrice: true, minStock: true },
    });
    // Üç parça BİLEREK kritik seviyede bırakılıyor: "Kritik Stok" kartı
    // sıfır gösterseydi o uyarının ne işe yaradığı anlaşılmazdı.
    const kritikler = new Set(hepsi.slice(0, 3).map((x) => x.id));
    for (const parca of hepsi) {
      const hedefKalan = kritikler.has(parca.id)
        ? Math.max(0, parca.minStock - rnd(0, 2))
        : parca.minStock + rnd(1, 6);
      const eksik = hedefKalan - parca.stockQty;
      if (eksik <= 0) continue;

      // Üç parti: yılın başı, ortası, sonu. Miktarlar eşit bölünüyor,
      // artan son partiye ekleniyor.
      const parti = [Math.floor(eksik / 3), Math.floor(eksik / 3), eksik - 2 * Math.floor(eksik / 3)]
        .filter((n) => n > 0);
      let stok = Math.max(0, parca.stockQty);
      let ortalama = parca.avgCost === null ? null : Number(parca.avgCost);
      const temel = Number(parca.buyPrice) || Number(parca.avgCost) || 0;
      let gun = 300;
      for (let i = 0; i < parti.length; i++) {
        const adet = parti[i];
        // Fiyat yıl içinde oynuyor — sabit fiyat, ortalama maliyetin
        // neden gerekli olduğunu gösteremezdi.
        const birim = Math.round(temel * (1 + (rnd(-8, 14) / 100)));
        ortalama = stok > 0 && ortalama
          ? Math.round(((stok * ortalama + adet * birim) / (stok + adet)) * 100) / 100
          : birim;
        stok += adet;
        await p.partPurchase.create({
          data: {
            tenantId: tenant.id, partId: parca.id, quantity: adet, unitCost: birim,
            supplier: TEDARIKCILER[(i + parti.length) % TEDARIKCILER.length],
            invoiceNo: `A-2026${String(rnd(1000, 9999))}`,
            purchasedAt: gunOnce(gun), avgAfter: ortalama,
          },
        });
        ekAlis++;
        gun -= Math.floor(260 / parti.length);
      }
      await p.part.update({
        where: { id: parca.id },
        data: { stockQty: hedefKalan, avgCost: ortalama },
      });
    }
    console.log(`  stok denkleştirildi: ${ekAlis} ek alış, eksi stok kalmadı`);
  }

  // ── SÖZLEŞMELER ───────────────────────────────────────────────────────
  // Her müşteriye bir sözleşme. Biri BİLEREK eski fiyatta (Kuzey Nakliyat)
  // ve kârlılık ekranında hedefin altında çıkıyor; ekranın anlatacağı
  // hikâye o.
  let sozNo = 0;
  for (let i = 0; i < musteriler.length; i++) {
    const m = musteriler[i];
    const kendi = cihazlar.filter((c) => c.customerId === m.id);
    if (!kendi.length) continue;

    const baslangic = gunOnce(rnd(400, 900));
    const bitis = new Date(baslangic.getTime() + 730 * 86400000);
    const soz = await p.contract.create({
      data: {
        tenantId: tenant.id, customerId: m.id,
        contractNo: `MBS-SZL-${String(++sozNo).padStart(3, '0')}`,
        startDate: baslangic, endDate: bitis,
        noticeDays: 30, autoRenew: true, renewMonths: 12,
        escalationMonths: 12, escalationRate: 25,
        lastEscalationAt: (i === 3 || i === 6) ? null : gunOnce(rnd(60, 340)),
        status: 'AKTIF',
        notes: (i === 3 || i === 6) ? 'İki yıldır zam yapılmadı — yenilemede konuşulacak.' : null,
      },
    });
    for (const c of kendi) {
      await p.contractDevice.create({
        data: {
          tenantId: tenant.id, contractId: soz.id, deviceId: c.id,
          monthlyRent: c.monthlyRent, pricePerBlack: c.pricePerBlack,
          pricePerColor: c.pricePerColor, includedBlack: c.includedBlack,
        },
      });
    }
  }
  console.log(`  ${sozNo} sözleşme`);

  // ── FATURALAR (son 4 ay) + TAHSİLAT ───────────────────────────────────
  let faturaNo = 0, faturaSayisi = 0;
  for (let ay = 12; ay >= 1; ay--) {
    const d = ayBasi(ay);
    const per = donem(d);
    const tarih = new Date(d.getFullYear(), d.getMonth(), 28);

    for (const m of musteriler) {
      const kendi = cihazlar.filter((c) => c.customerId === m.id);
      if (!kendi.length) continue;

      const satirlar = [];
      let ara = 0;
      for (const c of kendi) {
        satirlar.push({
          kind: 'RENTAL', description: `${c.brand} ${c.model} — ${per} kira`,
          deviceId: c.id, quantity: 1, unitPrice: Number(c.monthlyRent), lineTotal: Number(c.monthlyRent),
        });
        ara += Number(c.monthlyRent);

        const sbAdet = Math.max(0, c.aylikSb - (c.includedBlack || 0));
        if (sbAdet > 0) {
          const tutar = Math.round(sbAdet * Number(c.pricePerBlack) * 100) / 100;
          satirlar.push({
            kind: 'COUNTER', description: `S/B sayaç ${sbAdet.toLocaleString('tr-TR')} sayfa`,
            deviceId: c.id, quantity: sbAdet, unitPrice: Number(c.pricePerBlack), lineTotal: tutar,
          });
          ara += tutar;
        }
        if (c.aylikRenkli > 0 && c.pricePerColor) {
          const tutar = Math.round(c.aylikRenkli * Number(c.pricePerColor) * 100) / 100;
          satirlar.push({
            kind: 'COUNTER', description: `Renkli sayaç ${c.aylikRenkli.toLocaleString('tr-TR')} sayfa`,
            deviceId: c.id, quantity: c.aylikRenkli, unitPrice: Number(c.pricePerColor), lineTotal: tutar,
          });
          ara += tutar;
        }
      }
      ara = Math.round(ara * 100) / 100;
      const kdv = Math.round(ara * 0.2 * 100) / 100;
      const toplam = Math.round((ara + kdv) * 100) / 100;

      // Eski aylar ödenmiş, son ay açık — Tahsilat ekranı iş göstersin.
      const odendi = ay >= 2;
      const fatura = await p.customerInvoice.create({
        data: {
          tenantId: tenant.id, customerId: m.id,
          invoiceNumber: `MBS-FAT-${d.getFullYear()}-${String(++faturaNo).padStart(5, '0')}`,
          period: per, invoiceDate: tarih,
          dueDate: new Date(tarih.getTime() + 15 * 86400000),
          status: odendi ? 'PAID' : 'OPEN',
          subtotal: ara, vatRate: 20, vatAmount: kdv, totalAmount: toplam,
          paidAmount: odendi ? toplam : 0, paidAt: odendi ? new Date(tarih.getTime() + rnd(3, 14) * 86400000) : null,
          createdAt: tarih,
          lines: { create: satirlar.map((s) => ({ ...s, tenantId: tenant.id })) },
        },
      });
      faturaSayisi++;

      if (odendi) {
        const odemeTarih = new Date(tarih.getTime() + rnd(3, 14) * 86400000);
        const odeme = await p.payment.create({
          data: {
            tenantId: tenant.id, customerId: m.id, amount: toplam,
            method: secim(['TRANSFER', 'TRANSFER', 'CASH']),
            paymentDate: odemeTarih, reconciled: true,
            notes: `${per} dönemi tahsilatı`,
          },
        });
        await p.invoicePayment.create({
          data: { tenantId: tenant.id, invoiceId: fatura.id, paymentId: odeme.id, amount: toplam, allocatedAt: odemeTarih },
        });
        // NAKİT ESASLI GELİR: muhasebe özeti Payment'ı değil
        // FinancialTransaction'ı okuyor; ikisi de yazılmazsa
        // "tahsilat var ama muhasebede yok" çelişkisi görünür.
        await p.financialTransaction.create({
          data: {
            tenantId: tenant.id, customerId: m.id, invoiceId: fatura.id,
            type: 'INCOME', category: 'COUNTER_FEE', amount: toplam,
            method: odeme.method, description: `Tahsilat — ${fatura.invoiceNumber}`, date: odemeTarih,
          },
        });
      }
    }
  }
  console.log(`  ${faturaSayisi} fatura (12 ay) + tahsilatlar`);

  // ── BU HAFTANIN TAHSİLATLARI ──────────────────────────────────────────
  // Açık faturaların birkaçı son günlerde ödeniyor. Olmasaydı pano
  // "bugünkü tahsilat ₺0" derdi ve işletme durmuş gibi görünürdü.
  {
    const acik = await p.customerInvoice.findMany({
      where: { tenantId: tenant.id, status: 'OPEN' },
      orderBy: { invoiceDate: 'asc' }, take: 3,
      select: { id: true, customerId: true, invoiceNumber: true, totalAmount: true },
    });
    for (let i = 0; i < acik.length; i++) {
      const f = acik[i];
      const tutar = Number(f.totalAmount);
      const t = gunOnce(i);
      const odeme = await p.payment.create({
        data: {
          tenantId: tenant.id, customerId: f.customerId, amount: tutar,
          method: secim(['TRANSFER', 'CASH']), paymentDate: t, reconciled: true,
          notes: 'Tahsilat',
        },
      });
      await p.invoicePayment.create({
        data: { tenantId: tenant.id, invoiceId: f.id, paymentId: odeme.id, amount: tutar, allocatedAt: t },
      });
      await p.financialTransaction.create({
        data: {
          tenantId: tenant.id, customerId: f.customerId, invoiceId: f.id,
          type: 'INCOME', category: 'COUNTER_FEE', amount: tutar,
          method: odeme.method, description: `Tahsilat — ${f.invoiceNumber}`, date: t,
        },
      });
      await p.customerInvoice.update({
        where: { id: f.id },
        data: { status: 'PAID', paidAmount: tutar, paidAt: t },
      });
    }
    console.log(`  ${acik.length} tahsilat bu hafta yapıldı (pano boş kalmasın)`);
  }

  // ── SON FATURALANAN DÖNEM ─────────────────────────────────────────────
  // Cihazın hangi döneme kadar faturalandığı yazılmazsa aynı ay iki kez
  // faturalanabilir. Son fatura GEÇEN AYIN; bu ay bilerek açık bırakıldı
  // ki demoda ay sonu faturalaması gerçekten çalıştırılabilsin.
  {
    const sonDonem = donem(ayBasi(1));
    await p.device.updateMany({ where: { tenantId: tenant.id }, data: { lastInvoicedPeriod: sonDonem } });
  }

  // ── GİDERLER ──────────────────────────────────────────────────────────
  for (let ay = 12; ay >= 1; ay--) {
    const d = ayBasi(ay);
    for (const [kod, ad, tutar] of [['RENT', 'Depo kirası', 18000], ['SALARY', 'Personel', 62000], ['FUEL', 'Servis aracı yakıt', 9500], ['PART_PURCHASE', 'Toner alımı', 24000]]) {
      const tarih = new Date(d.getFullYear(), d.getMonth(), 5);
      const miktar = tutar + rnd(-1500, 1500);
      await p.expense.create({
        data: {
          tenantId: tenant.id, category: kod, amount: miktar,
          description: `${donem(d)} — ${ad}`, date: tarih, method: 'TRANSFER',
        },
      });
      await p.financialTransaction.create({
        data: {
          tenantId: tenant.id, type: 'EXPENSE', category: kod, amount: miktar,
          method: 'TRANSFER', description: `${donem(d)} — ${ad}`, date: tarih,
        },
      });
    }
  }

  // ── MÜŞTERİ PANELİ TALEPLERİ ──────────────────────────────────────────
  // Müşteri kendi panelinden arıza bildiriyor ya da sayaç giriyor. Üçü
  // BEKLİYOR: bu ekranın işi o kuyruğu boşaltmak, boş kuyruk anlatmıyor.
  {
    const portalli = musteriler.slice(0, 6);
    const bildirimler = [
      { tur: 'ARIZA', durum: 'BEKLIYOR', aciklama: 'Sabahtan beri kağıt sıkışıyor, arka kapaktan çıkarıyoruz ama tekrarlıyor.' },
      { tur: 'SAYAC', durum: 'BEKLIYOR', aciklama: null },
      { tur: 'ARIZA', durum: 'BEKLIYOR', aciklama: 'Renkli çıktıda sararma var, sunum bastıramıyoruz.' },
      { tur: 'ARIZA', durum: 'ISLENDI', aciklama: 'Tarayıcı ağa bağlanmıyor.', notu: 'IP çakışması giderildi, fiş açıldı.' },
      { tur: 'SAYAC', durum: 'ISLENDI', aciklama: null, notu: 'Okuma kaydedildi.' },
      { tur: 'ARIZA', durum: 'REDDEDILDI', aciklama: 'Kağıt bitti uyarısı geliyor.', notu: 'Kağıt takviyesi müşteride — arıza değil.' },
    ];
    for (let i = 0; i < bildirimler.length; i++) {
      const b = bildirimler[i];
      const m = portalli[i % portalli.length];
      const kendi = cihazlar.filter((c) => c.customerId === m.id);
      const c = kendi[0];
      if (!c) continue;
      const t = gunOnce(b.durum === 'BEKLIYOR' ? rnd(1, 5) : rnd(20, 90));
      await p.portalRequest.create({
        data: {
          tenantId: tenant.id, customerId: m.id, deviceId: c.id,
          tur: b.tur, aciklama: b.aciklama, durum: b.durum, notu: b.notu ?? null,
          sayacBlack: b.tur === 'SAYAC' ? c.counterBlack + rnd(50, 400) : null,
          sayacColor: b.tur === 'SAYAC' ? (c.counterColor || null) : null,
          createdAt: t, islenenAt: b.durum === 'BEKLIYOR' ? null : t,
        },
      });
    }
  }

  // ── WHATSAPP KUYRUĞU ──────────────────────────────────────────────────
  // Müşteri WhatsApp'tan yazıyor ya da sayaç fotoğrafı gönderiyor. Biri
  // TANINMAYAN NUMARADAN: "sisteme ekle" akışı oradan çıkıyor.
  {
    const mesajlar = [
      { m: 0, text: 'Merhaba, makine kağıt çekmiyor. Bugün bakabilir misiniz?', ariza: true, handled: false },
      { m: 1, text: 'Sayaç fotoğrafını gönderiyorum.', foto: true, handled: false },
      { m: 2, text: 'Toner bitmek üzere, yenisini yollayabilir misiniz?', ariza: true, handled: false },
      { m: 3, text: 'Teşekkürler, sorun çözüldü.', handled: true },
    ];
    for (let i = 0; i < mesajlar.length; i++) {
      const x = mesajlar[i];
      const m = musteriler[x.m];
      await p.whatsAppMessage.create({
        data: {
          tenantId: tenant.id, customerId: m.id,
          waMessageId: `wamid.DEMO${Date.now()}${i}`,
          fromPhone: `9${m.phone.replace(/\D/g, '')}`,
          contactName: m.name,
          text: x.text,
          mediaId: x.foto ? 'DEMO-MEDIA-1' : null, mediaType: x.foto ? 'image' : null,
          receivedAt: gunOnce(rnd(1, 8)),
          handled: x.handled, isFaultReport: !!x.ariza,
        },
      });
    }
    // Tanınmayan numara: sistemde müşterisi yok.
    await p.whatsAppMessage.create({
      data: {
        tenantId: tenant.id, customerId: null,
        waMessageId: `wamid.DEMO${Date.now()}X`,
        fromPhone: '905367778899', contactName: 'Burak Şen',
        text: 'Merhaba, fotokopi kiralama fiyatlarınızı öğrenebilir miyim?',
        receivedAt: gunOnce(1), handled: false,
      },
    });
  }

  // ── BAYİ PAZARI İLANLARI ──────────────────────────────────────────────
  // Bayiler arası parça/makine alışverişi. Demoda bu bayinin KENDİ
  // ilanları var; pazar ekranı boş açılmasın.
  {
    const ilanlar = [
      { kind: 'PART', title: 'Kyocera TK-1170 Toner (orijinal)', brand: 'Kyocera', model: 'TK-1170', condition: 'SIFIR', category: 'Toner', price: 1150, quantity: 6, unit: 'adet' },
      { kind: 'MACHINE', title: 'Canon imageRUNNER 2425 — sözleşmeden çıkan', brand: 'Canon', model: 'imageRUNNER 2425', condition: 'IKINCI_EL', category: 'Fotokopi', price: 28500, quantity: 1, unit: 'adet' },
      { kind: 'PART', title: 'Fuser Film Kılıfı (HP/Canon uyumlu)', brand: 'HP', model: '2035/LBP', condition: 'SIFIR', category: 'Yedek Parça', price: 520, quantity: 9, unit: 'adet' },
      { kind: 'MACHINE', title: 'Kyocera ECOSYS M2540dn — düşük sayaç', brand: 'Kyocera', model: 'ECOSYS M2540dn', condition: 'IKINCI_EL', category: 'Yazıcı', price: 12900, quantity: 2, unit: 'adet' },
    ];
    for (const x of ilanlar) {
      await p.marketListing.create({
        data: {
          sellerTenantId: tenant.id, ...x,
          description: 'Demo Büro Sistemleri stoğundan. Fatura kesilir, kargo alıcıya aittir.',
          city: 'İstanbul', status: 'ACTIVE',
          createdAt: gunOnce(rnd(3, 60)),
        },
      });
    }
  }

  // ── TEKLİF ────────────────────────────────────────────────────────────
  // Aday müşteri: henüz kayıtlı değil. Ölçülmüş modellerden fiyat çıkıyor.
  const teklif = await p.teklif.create({
    data: {
      tenantId: tenant.id, teklifNo: `TKF-${BUGUN.getFullYear()}-0001`,
      musteriAdi: 'Boğaziçi Denetim ve Danışmanlık',
      yetkili: 'Aylin Kaya', telefon: '05329990055', eposta: 'aylin@bogazicidenetim.example',
      durum: 'TASLAK', gecerlilikGun: 30,
      notlar: 'Mevcut tedarikçileriyle sözleşmeleri 2 ay sonra bitiyor. Üç katta toplam 4 makine.',
      satirlar: {
        create: [
          { tenantId: tenant.id, marka: 'Kyocera', model: 'ECOSYS M2540dn', adet: 2, aylikSayfaSb: 4200, aylikSayfaRenkli: 0, mevcutAylikTutar: 3900 },
          { tenantId: tenant.id, marka: 'Canon', model: 'imageRUNNER 2425', adet: 1, aylikSayfaSb: 6500, aylikSayfaRenkli: 0, mevcutAylikTutar: 3400 },
          { tenantId: tenant.id, marka: 'Ricoh', model: 'IM 350F', adet: 1, aylikSayfaSb: 3100, aylikSayfaRenkli: 0, mevcutAylikTutar: 2150 },
        ],
      },
    },
  });
  console.log(`  1 teklif (${teklif.teklifNo})`);

  // ── ÖZET ──────────────────────────────────────────────────────────────
  const say = async (f) => f;
  console.log('\n═══ HAZIR ═══\n');
  console.log(`  Bayi      : Demo Büro Sistemleri`);
  console.log(`  Adres     : /  (giriş sayfasından)`);
  console.log('');
  console.log(`  YÖNETİCİ  : ${PATRON}`);
  console.log(`  TEKNİSYEN : ${TEKNISYEN}`);
  console.log(`  ŞİFRE     : ${SIFRE}   (ikisi de aynı)`);
  console.log('');
  console.log(`  ${musteriler.length} müşteri · ${cihazlar.length} makine · ${okuma} sayaç okuması`);
  console.log(`  ${fisSayisi + tonerFisi} servis fişi · ${faturaSayisi} fatura · ${sozNo} sözleşme`);
  console.log(`  ${gozlem} toner verimi SAHADA ÖLÇÜLDÜ (elle girilen: 0)`);
  console.log('');
  console.log('  Bütün modüller AÇIK: Faturalar · Rota · Takip · Kaçan Gelir ·');
  console.log('  Raporlar · Bayi Pazarı · Müşteri Paneli · Mağaza · WhatsApp');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
