/**
 * DEMO: BASKI MERKEZİ (hesap türü MATBAA).
 *
 * ⚠️ BURADAKİ HER İSİM, NUMARA VE FİYAT UYDURMADIR. Gerçek bir matbaanın adı ya
 * da fiyat listesi bu dosyaya GİRMEZ.
 *
 * seed-bayi-demo.mjs tek satırla çağırır: matbaaDemosu(p, { sifreOzeti }).
 * Ayrı dosya, çünkü bayi tohumuyla ortak bir şeyi yok (cihaz, sayaç, sözleşme).
 *
 * Her ekranın bir hikâyesi var:
 *   Bugün ........ online gelen, haber verilmemiş hazır, geç kalan, bugün teslim,
 *                  ödeme bekleyen: beş satır türünün hepsi.
 *   İşler ........ her sütunda iş; Baskıda'da kırmızı (geç) kart.
 *   Kasa ......... bugün nakit + kart + havale, cariye yazılan iş.
 *   Fiyat listesi  çoğu ürün fiyatlı, iki ürün "Fiyatsız": eksik uyarısı görünsün.
 *   Müşteri ...... kurumsal müşterinin carisi: baskı borcu ve tahsilatı.
 *
 * Tutarlar elle yazılı (bu betik imajda düz Node ile çalışıyor, TypeScript motoru
 * yüklenemez); test-baski-mesaj fiyat motoruyla karşılaştırır. Fiyat listesi
 * değişip iş tutarı değişmezse test kırmızı olur.
 *
 * Deterministik: rastgele sayı yok, saatler günün öğlesine göre. Kurulum her çalışmada
 * baştan yapılır; yalnız demo bayraklı kayıt silinir.
 */
import crypto from 'node:crypto';

const SAAT = 3_600_000;
const GUN = 24 * SAAT;

export const MATBAA_SLUG = 'demo-matbaa';
export const MATBAA_EPOSTA = { yonetici: 'matbaa@demo.com', tezgah: 'tezgah@demo.com', operator: 'operator@demo.com' };

const YOK = { kod: 'yok', tur: 'CARPAN', deger: 1, varsayilan: true };
const yuz = { kod: 'yuz', ad: 'Yüz', zorunlu: true, degerler: [
  { kod: 'tek', ad: 'Tek yüz', tur: 'CARPAN', deger: 1, varsayilan: true },
  { kod: 'cift', ad: 'Çift yüz', tur: 'CARPAN', deger: 0.9, ciftYuz: true },
] };
const cilt = { kod: 'cilt', ad: 'Cilt', zorunlu: false, degerler: [
  { ...YOK, ad: 'Ciltsiz' },
  { kod: 'spiral', ad: 'Spiral', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 50, deger: 3000 }, { max: 100, deger: 4500 }, { max: 200, deger: 6000 }, { max: 400, deger: 8000 }] },
  { kod: 'termal', ad: 'Termal', tur: 'BIRIM', taban: 'NUSHA', deger: 0, araliklar: [{ max: 100, deger: 5000 }, { max: 250, deger: 7000 }] },
] };
const fotokopi = (sablonKodu, ad, fiyatlar, sira) => ({
  sablonKodu, ad, sira, kategori: 'FOTOKOPI', fiyatModeli: 'SAYFA', teslimSaat: 1, dosyaGerekli: true,
  kademeler: [1, 100, 500, 1000].map((min, i) => ({ min, fiyat: fiyatlar[i] })), secenekler: [yuz, cilt],
});

/** Fiyat listesi (kuruş, KDV dahil). Son ikisi bilerek fiyatsız. */
export const DEMO_URUNLERI = [
  fotokopi('fotokopi-a4-sb', 'Fotokopi A4 siyah-beyaz', [150, 120, 100, 80], 10),
  fotokopi('fotokopi-a4-renkli', 'Fotokopi A4 renkli', [500, 400, 300, 250], 20),
  fotokopi('fotokopi-a3-sb', 'Fotokopi A3 siyah-beyaz', [300, 240, 200, 160], 30),
  fotokopi('fotokopi-a3-renkli', 'Fotokopi A3 renkli', [1000, 800, 600, 500], 40),
  { sablonKodu: 'plan-a1', ad: 'Plan çıktı A1', sira: 60, kategori: 'PLAN', fiyatModeli: 'ADET', teslimSaat: 2, dosyaGerekli: true,
    kademeler: [{ min: 1, fiyat: 6000 }, { min: 10, fiyat: 4500 }],
    secenekler: [{ kod: 'renk', ad: 'Renk', zorunlu: true, degerler: [{ kod: 'sb', ad: 'Siyah-beyaz', tur: 'CARPAN', deger: 1, varsayilan: true }, { kod: 'renkli', ad: 'Renkli', tur: 'BIRIM', deger: 4000 }] }] },
  { sablonKodu: 'poster', ad: 'Poster', sira: 80, kategori: 'BUYUK_BASKI', fiyatModeli: 'ALAN', teslimSaat: 4, dosyaGerekli: true, minTutar: 15000,
    kademeler: [{ min: 1, fiyat: 45000 }, { min: 5, fiyat: 38000 }],
    secenekler: [{ kod: 'malzeme', ad: 'Malzeme', zorunlu: true, degerler: [{ kod: 'kuse', ad: 'Kuşe kâğıt', tur: 'CARPAN', deger: 1, varsayilan: true }, { kod: 'vinil', ad: 'Vinil (dış mekan)', tur: 'CARPAN', deger: 1.3 }] },
      { kod: 'kusgozu', ad: 'Kuşgözü', zorunlu: false, degerler: [{ ...YOK, ad: 'Kuşgözüsüz' }, { kod: 'dort', ad: '4 köşe kuşgözü', tur: 'BIRIM', taban: 'NUSHA', deger: 4000 }] }] },
  { sablonKodu: 'rollup', ad: 'Roll-up (85×200)', sira: 90, kategori: 'BUYUK_BASKI', fiyatModeli: 'ADET', teslimSaat: 24, dosyaGerekli: true,
    kademeler: [{ min: 1, fiyat: 180000 }, { min: 5, fiyat: 155000 }], secenekler: [] },
  { sablonKodu: 'cilt-termal', ad: 'Termal cilt', sira: 120, kategori: 'CILT', fiyatModeli: 'ADET', teslimSaat: 1, dosyaGerekli: false,
    kademeler: [{ min: 1, fiyat: 6000 }], secenekler: [] },
  { sablonKodu: 'laminasyon', ad: 'Laminasyon', sira: 130, kategori: 'DIGER', fiyatModeli: 'ADET', teslimSaat: 1, dosyaGerekli: false,
    kademeler: [{ min: 1, fiyat: 1500 }, { min: 50, fiyat: 1000 }],
    secenekler: [{ kod: 'ebat', ad: 'Ebat', zorunlu: true, degerler: [{ kod: 'a4', ad: 'A4', tur: 'CARPAN', deger: 1, varsayilan: true }, { kod: 'a3', ad: 'A3', tur: 'CARPAN', deger: 2 }] }] },
  { sablonKodu: 'kase', ad: 'Kaşe', sira: 140, kategori: 'DIGER', fiyatModeli: 'SABIT', teslimSaat: 24, dosyaGerekli: false,
    kademeler: [{ min: 1, fiyat: 45000 }], secenekler: [] },
  { sablonKodu: 'tarama', ad: 'Tarama (sayfa)', sira: 150, kategori: 'DIGER', fiyatModeli: 'ADET', teslimSaat: 1, dosyaGerekli: false,
    kademeler: [{ min: 1, fiyat: 300 }, { min: 100, fiyat: 200 }], secenekler: [] },
  // Hikâye: fiyatı girilmemiş ürün. Tezgahta görünmez, listede "Fiyatsız" yazar.
  { sablonKodu: 'canvas', ad: 'Canvas tablo', sira: 100, kategori: 'BUYUK_BASKI', fiyatModeli: 'ALAN', teslimSaat: 24, dosyaGerekli: true,
    kademeler: [{ min: 1, fiyat: 0 }],
    secenekler: [{ kod: 'kasnak', ad: 'Kasnak', zorunlu: true, degerler: [{ kod: 'var', ad: 'Kasnaklı', tur: 'BIRIM', taban: 'NUSHA', deger: 0, varsayilan: true }, { kod: 'yok', ad: 'Kasnaksız (rulo)', tur: 'CARPAN', deger: 1 }] }] },
  { sablonKodu: 'plan-a0', ad: 'Plan çıktı A0', sira: 70, kategori: 'PLAN', fiyatModeli: 'ADET', teslimSaat: 2, dosyaGerekli: true,
    kademeler: [{ min: 1, fiyat: 0 }, { min: 10, fiyat: 0 }], secenekler: [] },
];

const MUSTERILER = [
  { kod: 'yapi', name: 'Kuzey Yapı Mimarlık', phone: '05550000101', contactPerson: 'Selin Aksoy', taxNo: '1110000010' },
  { kod: 'okul', name: 'Papatya Koleji', phone: '05550000102', contactPerson: 'Ozan Kurt', taxNo: '1110000020' },
];

/**
 * İşler. Saatler şimdiye göre (saat cinsinden): `acildi` geçmiş, `soz` söz verilen.
 * `toplam` fiyat listesinden hesaplanmış tutardır; test motorla karşılaştırır.
 * `kalemler[].girdi` motorun girdisi: { sablonKodu, adet, sayfa?, enCm?, boyCm?, secimler? }.
 */
export const DEMO_ISLERI = [
  // Bugün: online gelen, sayfa sayısı onay bekliyor.
  { no: 1038, kanal: 'ONLINE', durum: 'GELEN', acildi: -0.5, soz: 6, tahmini: true, musteriAd: 'Emre Tan', telefon: '05550000111', toplam: 12000,
    kalemler: [{ girdi: { sablonKodu: 'fotokopi-a4-sb', adet: 1, sayfa: 80 }, ozet: 'Fotokopi A4 siyah-beyaz · 1 nüsha · 80 sf · Tek yüz · Ciltsiz' }] },
  // Bugün: sırada, bugün teslim.
  { no: 1037, durum: 'SIRADA', acildi: -1, soz: 5, musteriAd: 'Zeynep Er', telefon: '05550000112', toplam: 76500, odemeYolu: 'KART', odeme: [['KART', 76500, -1]],
    kalemler: [{ girdi: { sablonKodu: 'poster', adet: 1, enCm: 100, boyCm: 170 }, ozet: 'Poster · 100×170 cm · Kuşe kâğıt · Kuşgözüsüz' }] },
  // İşler: acil, makinede, dünden sarktı: günün her saatinde geç kalan görünsün.
  { no: 1036, durum: 'BASKIDA', acil: true, acildi: -26, soz: -19, musteriAd: 'Ali Korkmaz', telefon: '05550000113', toplam: 57000, bitis: true, odemeYolu: 'NAKIT', odeme: [['NAKIT', 20000, -26]],
    kalemler: [{ girdi: { sablonKodu: 'fotokopi-a4-renkli', adet: 2, sayfa: 60, secimler: { cilt: 'spiral' } }, ozet: 'Fotokopi A4 renkli · 2 nüsha · 60 sf · Tek yüz · Spiral' }] },
  // İşler: cilt bekliyor, kurumsal cari.
  { no: 1035, durum: 'BITIS', acildi: -7, soz: 3, musteri: 'okul', musteriAd: 'Papatya Koleji', telefon: '05550000102', toplam: 80000, bitis: true, odemeYolu: 'CARI',
    kalemler: [{ girdi: { sablonKodu: 'fotokopi-a4-sb', adet: 10, sayfa: 50, secimler: { cilt: 'spiral' } }, ozet: 'Fotokopi A4 siyah-beyaz · 10 nüsha · 50 sf · Tek yüz · Spiral' }] },
  // Bugün: hazır, müşteriye haber verilmedi ("Haber ver" tek dokunuş).
  { no: 1034, durum: 'HAZIR', acildi: -6, soz: -0.5, musteriAd: 'Deniz Polat', telefon: '05550000114', toplam: 180000,
    kalemler: [{ girdi: { sablonKodu: 'rollup', adet: 1 }, ozet: 'Roll-up (85×200) · 1 adet' }] },
  // Bugün: hazır, haber verildi, parası alınmadı ("Ödeme al").
  { no: 1033, durum: 'HAZIR', acildi: -26, soz: -20, haber: -20, musteriAd: 'Hakan Uçar', telefon: '05550000115', toplam: 45000,
    kalemler: [{ girdi: { sablonKodu: 'kase', adet: 1 }, ozet: 'Kaşe · 1 adet' }] },
  // Kasa: bugün teslim edilenler.
  { no: 1032, durum: 'TESLIM', acildi: -4, soz: -3, haber: -3, teslim: -2, musteriAd: 'Nur Aydın', telefon: '05550000116', toplam: 7500, odemeYolu: 'NAKIT', odeme: [['NAKIT', 7500, -2]],
    kalemler: [{ girdi: { sablonKodu: 'fotokopi-a4-sb', adet: 1, sayfa: 50 }, ozet: 'Fotokopi A4 siyah-beyaz · 1 nüsha · 50 sf · Tek yüz · Ciltsiz' }] },
  { no: 1031, durum: 'TESLIM', acildi: -3, soz: -2, haber: -2, teslim: -1, musteriAd: 'Cem Öz', telefon: '05550000117', toplam: 9000, odemeYolu: 'HAVALE', odeme: [['HAVALE', 9000, -1.5]],
    kalemler: [{ girdi: { sablonKodu: 'tarama', adet: 30 }, ozet: 'Tarama (sayfa) · 30 adet' }] },
  { no: 1030, durum: 'TESLIM', acildi: -5, soz: -3, haber: -3, teslim: -1, musteri: 'yapi', musteriAd: 'Kuzey Yapı Mimarlık', telefon: '05550000101', toplam: 90000, odemeYolu: 'CARI',
    kalemler: [{ girdi: { sablonKodu: 'plan-a1', adet: 20 }, ozet: 'Plan çıktı A1 · 20 adet · Siyah-beyaz' }] },
  // Geçmiş gün: kasada gün değiştirince görünür; cari tahsilatı var.
  { no: 1029, durum: 'TESLIM', acildi: -30, soz: -26, haber: -26, teslim: -25, musteri: 'yapi', musteriAd: 'Kuzey Yapı Mimarlık', telefon: '05550000101', toplam: 45000, odemeYolu: 'CARI', odeme: [['HAVALE', 45000, -24]],
    kalemler: [{ girdi: { sablonKodu: 'plan-a1', adet: 10 }, ozet: 'Plan çıktı A1 · 10 adet · Siyah-beyaz' }] },
  // İptal: panoda görünmez, ayrıntıda neden yazar.
  { no: 1028, durum: 'IPTAL', acildi: -50, musteriAd: 'Pınar Şen', telefon: '05550000118', toplam: 6000, bitis: true, iptal: 'Müşteri vazgeçti.',
    kalemler: [{ girdi: { sablonKodu: 'cilt-termal', adet: 1 }, ozet: 'Termal cilt · 1 adet' }] },
];

const AKIS = ['GELEN', 'SIRADA', 'BASKIDA', 'BITIS', 'HAZIR', 'TESLIM'];
const YONTEM = { NAKIT: 'CASH', KART: 'CARD', HAVALE: 'TRANSFER' };

/** Örnek IBAN: kontrol toplamı geçerli (ekran doğruluyor), banka kodu 99999 hiçbir bankanın değil. */
function ornekIban() {
  const govde = '9999900000000000001234';
  let kalan = 0;
  for (const r of `${govde}292700`) kalan = (kalan * 10 + Number(r)) % 97;
  return `TR${String(98 - kalan).padStart(2, '0')}${govde}`;
}

/**
 * Saatlerin çapası: bugünün öğlesi (İstanbul), kurulum anı DEĞİL. Demo gece 03:30'da
 * kuruluyor; "şimdi"ye bağlı olsaydı bugünkü ödemeler dünkü kasaya düşer, söz
 * verilen saatler sabaha kalmadan geçer, öğleden sonra bütün işler geç görünürdü.
 */
export function gununOglesi(an) {
  const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(an));
  return Date.parse(`${gun}T12:00:00+03:00`);
}

export async function matbaaDemosu(p, { sifreOzeti }) {
  console.log('\n═══ BASKI MERKEZİ DEMOSU ═══\n');
  const eski = await p.tenant.findFirst({ where: { slug: MATBAA_SLUG } });
  if (eski) {
    if (!eski.demo) throw new Error(`'${MATBAA_SLUG}' adlı işletme DEMO DEĞİL — silinmedi, kurulum durdu.`);
    await p.tenant.delete({ where: { id: eski.id } });
  }

  const simdi = gununOglesi(Date.now());
  const an = (saat) => new Date(simdi + saat * SAAT);
  const tenant = await p.tenant.create({
    data: {
      name: 'Örnek Baskı Merkezi', slug: MATBAA_SLUG, hesapTuru: 'MATBAA',
      plan: 'enterprise', isActive: true, maxUsers: 25, demo: true,
      address: 'Örnek Cad. No:1 Kat:1', city: 'İstanbul', phone: '02165550199', email: 'info@ornekbaski.example',
      ownerName: 'Derya Baskan', odemeIban: ornekIban(), odemeHesapAdi: 'Örnek Baskı Merkezi',
      nextInvoiceSeq: 0,
      // Sipariş sayfası açık: demoda /b/demo-matbaa gezilebilsin. Kurulum listesi kapalı (karşılama kopyalanmış).
      matbaaAyar: { create: { kisaAd: MATBAA_SLUG, siparisAcik: true, calismaSaatleri: 'Hafta içi 09:00–19:00, Cumartesi 10:00–16:00', karsilamaKopyalandiAt: new Date(simdi - 29 * GUN) } },
      users: { create: [
        { email: MATBAA_EPOSTA.yonetici, passwordHash: sifreOzeti, name: 'Derya Baskan', role: 'ADMIN', isActive: true, onboardedAt: new Date(simdi - 30 * GUN) },
        { email: MATBAA_EPOSTA.tezgah, passwordHash: sifreOzeti, name: 'Tuna Tezgah', role: 'FRONT_DESK', isActive: true, onboardedAt: new Date(simdi - 30 * GUN) },
        { email: MATBAA_EPOSTA.operator, passwordHash: sifreOzeti, name: 'Oya Operatör', role: 'TECHNICIAN', isActive: true, onboardedAt: new Date(simdi - 30 * GUN) },
      ] },
    },
    include: { users: true },
  });
  const tenantId = tenant.id;
  const tezgah = tenant.users.find((u) => u.role === 'FRONT_DESK');

  const urunId = {};
  for (const u of DEMO_URUNLERI) {
    const r = await p.baskiUrunu.create({ data: { ...u, tenantId, kdvOrani: 20, kdvDahil: true } });
    urunId[u.sablonKodu] = r.id;
  }

  const musteriId = {};
  for (const { kod, ...m } of MUSTERILER) {
    const r = await p.customer.create({ data: { ...m, tenantId } });
    musteriId[kod] = r.id;
  }

  for (const d of DEMO_ISLERI) {
    const acildi = an(d.acildi);
    const odemeler = d.odeme ?? [];
    const odenen = odemeler.reduce((t, [, tutar]) => t + tutar, 0);
    // Geçmiş: akışın başından bugünkü duruma adım adım (ekranda gerçek iş gibi).
    const son = d.durum === 'IPTAL' ? 0 : AKIS.indexOf(d.durum);
    const ilk = d.kanal === 'ONLINE' ? 0 : 1;
    const olaylar = [{ tenantId, tur: 'DURUM', durumSonra: AKIS[ilk], kullaniciId: tezgah.id, kullaniciAd: tezgah.name, createdAt: acildi }];
    for (let i = ilk + 1; i <= son; i++) {
      if (AKIS[i] === 'BITIS' && !d.bitis) continue;
      const onceki = AKIS[i - 1] === 'BITIS' && !d.bitis ? AKIS[i - 2] : AKIS[i - 1];
      const adimAni = new Date(+acildi + ((i - ilk) / (son - ilk + 1)) * (simdi - +acildi) * 0.8);
      olaylar.push({ tenantId, tur: 'DURUM', durumOnce: onceki, durumSonra: AKIS[i], kullaniciId: tezgah.id, kullaniciAd: tezgah.name, createdAt: adimAni });
    }
    if (d.durum === 'IPTAL') olaylar.push({ tenantId, tur: 'DURUM', durumOnce: AKIS[ilk], durumSonra: 'IPTAL', metin: d.iptal, kullaniciId: tezgah.id, kullaniciAd: tezgah.name, createdAt: an(d.acildi + 1) });
    if (d.haber !== undefined) olaylar.push({ tenantId, tur: 'BILDIRIM', metin: 'HAZIR', kullaniciId: tezgah.id, kullaniciAd: tezgah.name, createdAt: an(d.haber) });
    for (const [yol, tutar, saat] of odemeler) olaylar.push({ tenantId, tur: 'ODEME', metin: `${yol} ${tutar}`, kullaniciId: tezgah.id, kullaniciAd: tezgah.name, createdAt: an(saat) });

    const kdvHaric = Math.round((d.toplam * 100) / 120);
    const is = await p.baskiIsi.create({
      data: {
        tenantId, no: d.no, kanal: d.kanal ?? 'TEZGAH', durum: d.durum, acil: d.acil === true, bitisGerekli: d.bitis === true,
        customerId: d.musteri ? musteriId[d.musteri] : null, musteriAd: d.musteriAd, telefon: d.telefon,
        sozVerilenAt: d.soz !== undefined ? an(d.soz) : null,
        kdvHaric, kdv: d.toplam - kdvHaric, toplam: d.toplam, tahmini: d.tahmini === true,
        odemeYolu: d.odemeYolu ?? null, odenen,
        haberVerildiAt: d.haber !== undefined ? an(d.haber) : null,
        teslimAt: d.teslim !== undefined ? an(d.teslim) : null,
        iptalAt: d.durum === 'IPTAL' ? an(d.acildi + 1) : null, iptalNedeni: d.iptal ?? null,
        jeton: crypto.randomBytes(18).toString('base64url'),
        olusturanId: tezgah.id, olusturanAd: tezgah.name, createdAt: acildi,
        kalemler: { create: d.kalemler.map((k, sira) => ({
          urunId: urunId[k.girdi.sablonKodu], urunAd: DEMO_URUNLERI.find((u) => u.sablonKodu === k.girdi.sablonKodu).ad,
          secimler: k.girdi.secimler ?? {}, adet: k.girdi.adet, sayfa: k.girdi.sayfa ?? null, enCm: k.girdi.enCm ?? null, boyCm: k.girdi.boyCm ?? null,
          birimFiyat: DEMO_URUNLERI.find((u) => u.sablonKodu === k.girdi.sablonKodu).kademeler[0].fiyat, tutar: d.toplam, ozet: k.ozet, sira,
        })) },
        olaylar: { create: olaylar },
        odemeler: { create: odemeler.map(([yol, tutar, saat]) => ({ tenantId, tutar, yol, tarih: an(saat), aliciId: tezgah.id, aliciAd: tezgah.name })) },
      },
    });

    // Cari: lib/baski-cari ile aynı kayıtlar (ilk uzlaştırma hiçbir şey değiştirmesin).
    if (d.musteri && d.durum !== 'IPTAL' && d.durum !== 'GELEN') {
      const customerId = musteriId[d.musteri];
      await p.accountEntry.create({ data: { tenantId, customerId, baskiIsiId: is.id, type: 'SALE', product: `Baskı B-${d.no}`, amount: d.toplam / 100, method: 'OPEN_ACCOUNT', notes: 'Baskı işi', createdByName: tezgah.name, date: acildi } });
      if (odenen > 0) {
        const [yol, , saat] = odemeler[odemeler.length - 1];
        await p.accountEntry.create({ data: { tenantId, customerId, baskiIsiId: is.id, type: 'PAYMENT', amount: odenen / 100, method: YONTEM[yol], notes: 'Baskı tahsilatı', createdByName: tezgah.name, date: an(saat) } });
      }
    }
  }

  console.log(`  ${DEMO_URUNLERI.length} ürün, ${MUSTERILER.length} müşteri, ${DEMO_ISLERI.length} iş`);
  return { eposta: MATBAA_EPOSTA.yonetici, tezgah: MATBAA_EPOSTA.tezgah, operator: MATBAA_EPOSTA.operator, is: DEMO_ISLERI.length };
}
