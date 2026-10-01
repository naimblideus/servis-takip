// SAYAÇ TARAYICI (SNMP) — ağdan sayaç
// Çalıştır:  node scripts/test-sayac-tarayici.mjs
//   · saf karar kuralları her zaman koşar
//   · PowerShell tarayıcısı yalnız Windows'ta (sahte SNMP cihazlarına karşı)
//   · veritabanı katmanı yalnız yerel veritabanıyla (veri yazar)
//   · HTTP ucu yalnız dev sunucusu açıksa
//
// NEDEN BU TEST
// Tarayıcının yanlış yazdığı sayaç doğrudan yanlış faturadır ve müşterinin
// bilgisayarında, kimsenin izlemediği bir anda çalışır. Üç şey kilitli:
//
//   · UYDURMA AYRIM YOK. Renkli cihazda siyah/renkli bölüşümü ancak
//     markanın sayaçları standart toplama BİREBİR eşitse kabul edilir.
//     Tutmazsa okuma yazılmaz; renk bilinmiyorsa da yazılmaz.
//   · ONAYSIZ FATURA YOK. Bayi otomatik yazmayı açmadıkça tarama yalnız
//     kaydedilir. Onay, taramadaki değil sistemdeki GÜNCEL sayaca bakar ve
//     aynı tarama iki kez yazılamaz.
//   · GERÇEK BETİK GERÇEK PAKETLE KONUŞUR. PowerShell betiği SNMP'yi kendisi
//     kodluyor; burada Node'da yazılmış sahte cihazlara karşı çalıştırılır
//     ve çıktısı sunucunun ayıklayıcısından geçirilir.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import dgram from 'node:dgram';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-tarayici-'));
let saf;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/sayac-tarama.ts'), join(KOK, 'src/lib/sayac-tarama-veri.ts'),
      join(KOK, 'src/lib/readings.ts'), join(KOK, 'src/lib/invoicing.ts'), join(KOK, 'src/lib/sayac-anomali.ts'),
      join(KOK, 'src/lib/verim-ogrenme.ts'), join(KOK, 'src/lib/toner-verimi.ts'), join(KOK, 'src/lib/reliability.ts'),
      join(KOK, 'src/lib/fault-categories.ts'), join(KOK, 'src/lib/stok-maliyet.ts'), join(KOK, 'src/lib/device-brands.ts'),
      join(KOK, 'src/lib/toner.ts'), join(KOK, 'src/lib/ticket-number.ts'), join(KOK, 'src/lib/ticket-asama.ts'),
      join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  saf = await import(pathToFileURL(join(g, 'sayac-tarama.js')).href);
} catch (e) {
  console.log('✗ sayac-tarama derlenemedi:', e?.message);
  process.exit(1);
}
const {
  renkAyrimi, renkliMi, seriNormal, seriEsle, cihazSonucu, tekrarlariAyikla, taramaOzeti,
  taramaGovdesiAyikla, taranmisCihazAyikla, sarfYuzdesi, marka, KYOCERA_DAL, ilerlemeDurumu,
  cihazUyarilari, sarfOlcumu, tonerDegistiMi, UYARI_TURU,
} = saf;

console.log('\nSayaç tarayıcı — saf karar\n');

const KY = KYOCERA_DAL;
const cihaz = (ek = {}) => ({
  ip: '10.0.0.5', sysObjectID: '1.3.6.1.4.1.1347.41', sysDescr: null, model: 'TASKalfa 2553ci',
  seri: 'LJD1Z12345', toplam: 120000, renkler: ['black', 'cyan', 'magenta', 'yellow'], sarf: [], ozel: {}, ...ek,
});
const kyoOzel = (bs = 90000, renk = 30000, orta = 0) => ({
  [`${KY}1.1`]: bs - 40000, [`${KY}1.2`]: orta, [`${KY}1.3`]: renk - 10000,
  [`${KY}2.1`]: 40000, [`${KY}2.2`]: 0, [`${KY}2.3`]: 10000,
});

// ── RENK AYRIMI ──────────────────────────────────────────────────────────
{
  const a = renkAyrimi(cihaz({ renkler: ['black'] }));
  t('tek renkli cihazda toplam = siyah', a.tur === 'TEK_RENK' && a.siyah === 120000, a);
}
{
  const a = renkAyrimi(cihaz({ ozel: kyoOzel() }));
  t('★ Kyocera: siyah + renkli toplama eşitse ayrım DOĞRULANDI', a.tur === 'DOGRULANDI' && a.siyah === 90000 && a.renkli === 30000, a);
}
{
  const a = renkAyrimi(cihaz({ ozel: kyoOzel(90000, 29000) }));
  t('★ toplam tutmuyorsa ayrım YAPILMIYOR (uydurma yok)', a.tur === 'YOK' && a.sebep === 'TOPLAM_TUTMUYOR', a);
}
{
  const a = renkAyrimi(cihaz({ ozel: kyoOzel(90000, 30000, 500), toplam: 120500 }));
  t('★ anlamı kesin olmayan kip doluysa ayrım yapılmıyor', a.tur === 'YOK' && a.sebep === 'BELIRSIZ_KIP', a);
}
{
  const a = renkAyrimi(cihaz({ sysObjectID: '1.3.6.1.4.1.1602.4.7', ozel: {} }));
  t('★ ayrım sayacı bilinmeyen renkli marka YAZILMIYOR', a.tur === 'YOK' && a.sebep === 'PROFIL_YOK', a);
}
{
  const a = renkAyrimi(cihaz({ renkler: [], sarf: [] }));
  t('★ renkli mi bilinmiyorsa tahmin edilmiyor', a.tur === 'YOK' && a.sebep === 'RENK_BILINMIYOR', a);
}
{
  t('toplam sayaç yoksa SAYAC_YOK', renkAyrimi(cihaz({ toplam: null })).sebep === 'SAYAC_YOK');
  t('sıfır toplam sayaç sayılmıyor', renkAyrimi(cihaz({ toplam: 0 })).sebep === 'SAYAC_YOK');
}
{
  t('renk listesi yoksa sarf adlarına bakılıyor (renkli)', renkliMi({ renkler: [], sarf: [{ ad: 'Cyan Toner', max: 100, seviye: 5 }] }) === true);
  t('yalnız siyah sarf → tek renkli', renkliMi({ renkler: [], sarf: [{ ad: 'Black Toner', max: 100, seviye: 5 }] }) === false);
  t('Türkçe renk adı da tanınıyor', renkliMi({ renkler: ['siyah', 'camgöbeği'], sarf: [] }) === true);
}

// ── SERİ ─────────────────────────────────────────────────────────────────
{
  t('seri: boşluk, tire, küçük harf yok sayılıyor', seriNormal(' phbq-123 456 ') === 'PHBQ123456');
  t('★ "bilmiyorum" serileri eşleşmeye girmiyor', seriNormal('0000000') === null && seriNormal('N/A') === null && seriNormal('') === null);
  const sistem = [
    { id: 'a', serialNo: 'LJD1Z12345', reportedSerial: null, counterBlack: 1, counterColor: 1 },
    { id: 'b', serialNo: 'ETIKET-9', reportedSerial: 'CIHAZ9', counterBlack: 1, counterColor: 1 },
  ];
  t('etiketteki seriyle eşleşiyor', seriEsle('ljd1z12345', sistem).map((c) => c.id).join() === 'a');
  t('cihazın bildirdiği seriyle de eşleşiyor', seriEsle('CIHAZ9', sistem).map((c) => c.id).join() === 'b');
}

// ── DURUM ────────────────────────────────────────────────────────────────
{
  const sistem = [{ id: 'k', serialNo: 'LJD1Z12345', reportedSerial: null, counterBlack: 80000, counterColor: 25000 }];
  const s = cihazSonucu(cihaz({ ozel: kyoOzel() }), sistem);
  t('★ ilerlemiş doğrulanmış okuma YAZILABILIR', s.durum === 'YAZILABILIR' && s.siyah === 90000 && s.renkli === 30000 && s.deviceId === 'k', s);
  const d = cihazSonucu(cihaz({ ozel: kyoOzel() }), [{ ...sistem[0], counterBlack: 95000 }]);
  t('★ sistemdekinden düşükse GERILEDI (yazılmaz)', d.durum === 'GERILEDI', d.durum);
  const e = cihazSonucu(cihaz({ ozel: kyoOzel() }), [{ ...sistem[0], counterBlack: 90000, counterColor: 30000 }]);
  t('aynıysa DEGISMEDI (sıfır farklı okuma yazılmaz)', e.durum === 'DEGISMEDI', e.durum);
  t('sistemde yoksa ESLESMEDI', cihazSonucu(cihaz({ seri: 'YOK1' }), sistem).durum === 'ESLESMEDI');
  t('ayrım yoksa AYRIM_YOK', cihazSonucu(cihaz({ ozel: {} , sysObjectID: '1.3.6.1.4.1.1602.1' }), sistem).durum === 'AYRIM_YOK');
}
{
  // Tek renkli makinede renkli sayaç sistemde neyse o kalır; sıfırlanırsa
  // "geriledi" sayılır ve cihaz hiç yazılamaz olurdu.
  const sistem = [{ id: 'h', serialNo: 'PHBQ123456', reportedSerial: null, counterBlack: 40000, counterColor: 12 }];
  const s = cihazSonucu(cihaz({ seri: 'PHBQ123456', renkler: ['black'], toplam: 45678, sysObjectID: '1.3.6.1.4.1.11.2.3.9.1' }), sistem);
  t('★ tek renklide renkli sayaç korunuyor', s.durum === 'YAZILABILIR' && s.renkli === 12 && s.siyah === 45678, s);
  t('marka kurum numarasından', s.marka === 'HP');
}
{
  const sistem = [{ id: 'k', serialNo: 'LJD1Z12345', reportedSerial: null, counterBlack: 1, counterColor: 1 }];
  const iki = tekrarlariAyikla([cihazSonucu(cihaz({ ozel: kyoOzel() }), sistem), cihazSonucu(cihaz({ ip: '10.0.0.6', ozel: kyoOzel() }), sistem)]);
  t('★ aynı makine iki IP ile görünürse ikincisi yazılmaz', iki[0].durum === 'YAZILABILIR' && iki[1].durum === 'BIRDEN_FAZLA', iki.map((x) => x.durum));
  const oz = taramaOzeti(iki);
  t('özet sayıyor', oz.bulunan === 2 && oz.eslesen === 2 && oz.yazilabilir === 1, oz);
}
{
  t('ilerleme: yeni cihaz (hiç okuma yok) yazılabilir', ilerlemeDurumu(10, 0, null, null) === 'YAZILABILIR');
  t('sarf yüzdesi', sarfYuzdesi({ ad: 'x', max: 200, seviye: 50 }) === 25);
  t('★ "biraz var" (-3) yüzde sayılmıyor', sarfYuzdesi({ ad: 'x', max: 100, seviye: -3 }) === null);
}

// ── AYIKLAYICI ───────────────────────────────────────────────────────────
{
  t('biçimsiz gövde reddediliyor', taramaGovdesiAyikla({ cihazlar: 'x' }) === null && taramaGovdesiAyikla(null) === null);
  t('★ 2000 cihaz sınırı', taramaGovdesiAyikla({ cihazlar: Array.from({ length: 2001 }, () => ({ ip: '1.1.1.1' })) }) === null);
  const c = taranmisCihazAyikla({ ip: '1.2.3.4', seri: 'AB12\u0000\u0000  ', toplam: 5, ozel: { 'bozuk': 5, '1.3.6.1.4.1.1347.1': -4, '1.3.6.1.4.1.1347.2': 7 } });
  t('★ yazıcının NUL/boşluk dolgusu seriden atılıyor', c.seri === 'AB12', c.seri);
  t('özel dalda biçimsiz OID ve eksi değer atılıyor', Object.keys(c.ozel).join() === '1.3.6.1.4.1.1347.2', c.ozel);
  t('kesirli sayaç reddediliyor', taranmisCihazAyikla({ ip: '1.1.1.1', toplam: 1.5 }).toplam === null);
  t('ip yoksa cihaz yok', taranmisCihazAyikla({ seri: 'X' }) === null);
}

console.log('\nCihaz durumu — arıza bitleri ve toner ölçümü\n');
{
  const u = (hata, durumKodu = null) => cihazUyarilari({ hata, durumKodu });
  t('boş maske → uyarı yok', u('0000').length === 0 && u(null).length === 0 && u('').length === 0);
  t('★ bit 0 = ilk baytın EN SOLDAKİ biti (kâğıt az)', JSON.stringify(u('80')) === '["KAGIT_AZ"]', u('80'));
  t('★ servis istendi (0x01)', JSON.stringify(u('01')) === '["SERVIS_GEREKLI"]', u('01'));
  t('ikinci bayt: bakım gecikti (0x02)', JSON.stringify(u('0002')) === '["BAKIM_GECIKTI"]', u('0002'));
  const sirali = u('f404');
  t('★ servis önce, sarf sonra, bilgi en sonda', sirali[0] === 'SIKISMA' && sirali.slice(1, 3).every((k) => UYARI_TURU[k] === 'SARF') && sirali.slice(3).every((k) => UYARI_TURU[k] === 'BILGI'), sirali);
  t('★ hrDeviceStatus 5 → cihaz arızalı', u(null, 5).join() === 'CIHAZ_ARIZALI');
  t('hrDeviceStatus 3 (uyarı) tek başına uyarı üretmiyor', u(null, 3).length === 0);
  t('tek baytlık maske (bazı cihazlar ikinci baytı yollamaz) okunuyor', u('04').join() === 'SIKISMA');
  t('her kodun bir türü var', Object.values(UYARI_TURU).every((x) => ['SERVIS', 'SARF', 'BILGI'].includes(x)) && Object.keys(UYARI_TURU).length === 16);
  const ay = (h) => taranmisCihazAyikla({ ip: '1.1.1.1', ...h });
  t('★ biçimsiz maske (onaltılık değil) atılıyor', ay({ hata: 'zz' }).hata === null && ay({ hata: "0'; drop" }).hata === null);
  t('maske küçük harfe indiriliyor', ay({ hata: 'AB01' }).hata === 'ab01');
  t('geçersiz durum kodu atılıyor', ay({ durumKodu: 9 }).durumKodu === null && ay({ durumKodu: 5 }).durumKodu === 5);
  t('eski betik (alan yok) → null', ay({}).hata === null && ay({}).durumKodu === null);

  const s = (ad, seviye, max = 100) => ({ ad, max, seviye });
  const o = (sarf) => sarfOlcumu({ sarf });
  t('★ renkli makine: siyah ve en düşük renk', JSON.stringify(o([s('Black Toner', 60), s('Cyan Toner', 30), s('Magenta Toner', 8), s('Yellow Toner', 50)])) === '{"siyah":60,"renkli":8}');
  t('★ atık toner kutusu ve drum toner sanılmıyor', JSON.stringify(o([s('Black Toner', 60), s('Waste Toner Box', 3), s('Black Drum Unit', 5), s('Fuser Kit', 1)])) === '{"siyah":60,"renkli":null}');
  t('★ tek tonerli makine ("Toner Cartridge") siyah sayılıyor', o([s('Toner Cartridge', 22), s('Imaging Drum', 70)]).siyah === 22);
  t('Türkçe adlar', JSON.stringify(o([s('Siyah Toner', 15), s('Sarı Toner', 44), s('Atık Toner Kutusu', 2)])) === '{"siyah":15,"renkli":44}');
  t('"biraz var" (−3) ölçüm sayılmıyor', o([s('Black Toner', -3)]).siyah === null);
  t('max 255 ölçeği yüzdeye çevriliyor', o([s('Black Toner', 51, 255)]).siyah === 20);
  t('sarf yoksa ölçüm yok', JSON.stringify(o([])) === '{"siyah":null,"renkli":null}');

  t('★ değişim: %8 → %98 evet', tonerDegistiMi(8, 98));
  t('★ ölçüm gürültüsü (%42 → %45) değişim değil', !tonerDegistiMi(42, 45));
  t('yarıda değiştirme (%50 → %100) yazılmıyor (emin değiliz)', !tonerDegistiMi(50, 100));
  t('yeni toner tam dolu görünmüyorsa (%25 → %70) yazılmıyor', !tonerDegistiMi(25, 70));
  t('önceki ölçüm yoksa değişim yok', !tonerDegistiMi(null, 100) && !tonerDegistiMi(5, null));

  // Panel sırası ve fiş kategorisi
  const { dikkatSirasi, UYARI_KATEGORISI, SERVIS_UYARILARI, TONER_KRITIK } = saf;
  const sira = [
    { ad: 'bilgi', uyarilar: ['KAGIT_YOK'], olcumSiyah: 80, olcumRenkli: null },
    { ad: 'toner12', uyarilar: [], olcumSiyah: 12, olcumRenkli: null },
    { ad: 'servis', uyarilar: ['KAGIT_YOK', 'SIKISMA'], olcumSiyah: 90, olcumRenkli: null },
    { ad: 'toner3', uyarilar: ['TONER_AZ'], olcumSiyah: 60, olcumRenkli: 3 },
  ].sort((a, b) => dikkatSirasi(a) - dikkatSirasi(b)).map((x) => x.ad).join();
  t('★ panel sırası: servis → en düşük toner → bilgi', sira === 'servis,toner3,toner12,bilgi', sira);
  t('sıkışma fişi kâğıt sıkışması kategorisiyle açılır; "servis istiyor" kategori uydurmaz',
    UYARI_KATEGORISI.SIKISMA === 'PAPER_JAM' && UYARI_KATEGORISI.SERVIS_GEREKLI === undefined && UYARI_KATEGORISI.CIHAZ_ARIZALI === undefined);
  t('servis uyarı listesi beş kod', SERVIS_UYARILARI.length === 5 && SERVIS_UYARILARI.includes('BAKIM_GECIKTI'));
  t('kritik eşik %15', TONER_KRITIK === 15);

  const { sarfKalemleri, parcaEnAz, olayFarki, fisAcacakOlaylar, parcaKategorisi, PARCA_KRITIK } = saf;
  const kl = sarfKalemleri({ sarf: [
    { ad: 'Black Toner', max: 100, seviye: 40 }, { ad: 'Drum Unit', max: 100, seviye: 6 },
    { ad: 'Waste Toner Box', max: 100, seviye: 30 }, { ad: 'Fuser Kit', max: 200, seviye: 100 }, { ad: 'Cyan Toner', max: 100, seviye: -3 },
  ] });
  t('★ sarf kalemleri: toner ve parça ayrılıyor, okunamayan (−3) düşüyor', JSON.stringify(kl.map((k) => `${k.ad}:${k.tur}:${k.yuzde}`)) === '["Black Toner:TONER:40","Drum Unit:PARCA:6","Waste Toner Box:PARCA:30","Fuser Kit:PARCA:50"]', kl);
  t('parça ömrünün en düşüğü', parcaEnAz(kl) === 6 && parcaEnAz([]) === null && PARCA_KRITIK === 10);
  const fk = olayFarki(['SIKISMA', 'KAGIT_YOK'], ['SIKISMA', 'SERVIS_GEREKLI']);
  t('★ olay farkı: yeni / süren / biten', fk.yeni.join() === 'SERVIS_GEREKLI' && fk.suren.join() === 'SIKISMA' && fk.biten.join() === 'KAGIT_YOK', fk);
  const ol = fisAcacakOlaylar([
    { kod: 'SIKISMA', gorulme: 2, ticketId: null }, { kod: 'SIKISMA', gorulme: 1, ticketId: null },
    { kod: 'KAGIT_YOK', gorulme: 5, ticketId: null }, { kod: 'SERVIS_GEREKLI', gorulme: 3, ticketId: 'f1' }, { kod: 'TONER_YOK', gorulme: 4, ticketId: null },
  ]);
  t('★ fiş yalnız iki taramada görülen, fişe bağlanmamış SERVİS uyarısından (kâğıt/toner fiş açmaz)', ol.length === 1 && ol[0].kod === 'SIKISMA' && ol[0].gorulme === 2, ol);
  t('parçadan kategori: drum → DRUM, fırın → FUSER, bakım kiti, atık; bilinmeyen öneri yok',
    parcaKategorisi('Drum Unit') === 'DRUM' && parcaKategorisi('Fırın Ünitesi') === 'FUSER' && parcaKategorisi('Maintenance Kit') === 'PERIODIC_MAINTENANCE'
    && parcaKategorisi('Atık Toner Kutusu') === 'CONSUMABLE' && parcaKategorisi('Transfer Belt') === null);
  t('panel sırası: parça ömrü tonerden sonra, bilgiden önce',
    dikkatSirasi({ uyarilar: [], olcumSiyah: 50, olcumRenkli: null, olcumParca: 5 }) > dikkatSirasi({ uyarilar: ['TONER_AZ'], olcumSiyah: 50, olcumRenkli: null })
    && dikkatSirasi({ uyarilar: [], olcumSiyah: 50, olcumRenkli: null, olcumParca: 5 }) < dikkatSirasi({ uyarilar: ['KAGIT_YOK'], olcumSiyah: 50, olcumRenkli: null }));
  t('durum tablosu gelmeyen cihaz: durumOkundu=false (uyarı yok değil, bilinmiyor)',
    cihazSonucu(cihaz({ hata: null, durumKodu: null }), []).durumOkundu === false && cihazSonucu(cihaz({ hata: '00', durumKodu: 2 }), []).durumOkundu === true);
}

console.log('\nSarf — cihazın ölçtüğü yüzde tahminin önüne geçer\n');
{
  const { forecastChannel, olcumleBirlestir } = await import(pathToFileURL(join(g, 'toner.js')).href);
  const tahmin = forecastChannel({ yieldPages: 10000, reset: 50000, current: 52000, rate: 100, channel: 'black' });
  t('sayaçtan tahmin: %80 kaldı, 80 gün', tahmin.remainingPct === 80 && tahmin.daysLeft === 80, tahmin);
  const b1 = olcumleBirlestir({ tahmin, olcum: 12, yieldPages: 10000, current: 52000, rate: 100, channel: 'black' });
  t('★ cihaz %12 diyor: yüzde ve gün ölçümden (1.200 sf ÷ 100/gün = 12 gün)', b1.olculdu && b1.remainingPct === 12 && b1.remaining === 1200 && b1.daysLeft === 12, b1);
  const b2 = olcumleBirlestir({ tahmin: null, olcum: 30, yieldPages: null, current: 1000, rate: 100, channel: 'black' });
  t('★ verim bilinmiyorsa yalnız yüzde; gün UYDURULMUYOR', b2.olculdu && b2.remainingPct === 30 && b2.daysLeft === null && b2.remaining === null && !b2.needsSetup, b2);
  const kur = forecastChannel({ yieldPages: 10000, reset: null, current: 52000, rate: 100, channel: 'black' });
  t('"toner değişimi bekliyor" kurulumu ölçüm gelince gerekmiyor', kur.needsSetup && olcumleBirlestir({ tahmin: kur, olcum: 50, yieldPages: 10000, current: 52000, rate: 100, channel: 'black' }).needsSetup === false);
  t('ölçüm yoksa tahmin aynen kalıyor', olcumleBirlestir({ tahmin, olcum: null, yieldPages: 10000, current: 52000, rate: 100, channel: 'black' }) === tahmin);
  t('aralık dışı ölçüm (−3, 140) yok sayılıyor', olcumleBirlestir({ tahmin, olcum: -3, yieldPages: 1, current: 0, rate: 1, channel: 'black' }) === tahmin
    && olcumleBirlestir({ tahmin, olcum: 140, yieldPages: 1, current: 0, rate: 1, channel: 'black' }) === tahmin);
}

// ── SAHTE SNMP CİHAZLARI + GERÇEK POWERSHELL ─────────────────────────────
const tlv = (tag, deger) => {
  const u = deger.length;
  const uz = u < 0x80 ? [u] : u < 0x100 ? [0x81, u] : [0x82, u >> 8, u & 0xff];
  return Buffer.from([tag, ...uz, ...deger]);
};
const intB = (n) => { const b = []; let x = BigInt(n); do { b.unshift(Number(x & 0xffn)); x >>= 8n; } while (x > 0n && !(x === 0n)); if (b[0] & 0x80) b.unshift(0); return b; };
const oidB = (oid) => {
  const p = oid.split('.').map(Number); const out = [40 * p[0] + p[1]];
  for (const a of p.slice(2)) { const parca = [a & 0x7f]; let v = Math.floor(a / 128); while (v > 0) { parca.unshift(0x80 | (v & 0x7f)); v = Math.floor(v / 128); } out.push(...parca); }
  return out;
};
const deger = (d) => d.t === 'str' ? tlv(0x04, [...Buffer.from(d.v, 'utf8')])
  : d.t === 'hex' ? tlv(0x04, [...Buffer.from(d.v, 'hex')])
  : d.t === 'oid' ? tlv(0x06, oidB(d.v))
  : d.t === 'cnt' ? tlv(0x41, intB(d.v))
  : tlv(0x02, d.v < 0 ? [0xff, ...Buffer.from([(d.v + 256) & 0xff])] : intB(d.v));
const oku = (b, i) => { const tag = b[i]; let u = b[i + 1]; let j = i + 2; if (u & 0x80) { const k = u & 0x7f; u = 0; for (let x = 0; x < k; x++) u = (u << 8) | b[j++]; } return { tag, d: b.subarray(j, j + u), son: j + u }; };
const cocuk = (d) => { const l = []; let i = 0; while (i < d.length) { const x = oku(d, i); l.push(x); i = x.son; } return l; };
const oidCoz = (d) => { const p = [Math.floor(d[0] / 40), d[0] % 40]; let v = 0; for (const x of d.subarray(1)) { v = v * 128 + (x & 0x7f); if (!(x & 0x80)) { p.push(v); v = 0; } } return p.join('.'); };
const oidKarsilastir = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if (x[i] === undefined) return -1; if (y[i] === undefined) return 1; if (x[i] !== y[i]) return x[i] - y[i]; } return 0; };

function ajan(ip, port, mib) {
  const sirali = Object.keys(mib).sort(oidKarsilastir);
  const s = dgram.createSocket('udp4');
  s.on('message', (m, uzak) => {
    try {
      const [ver, top, pdu] = cocuk(oku(m, 0).d);
      if (Buffer.from(top.d).toString() !== 'public') return;
      const [rid, , , vbl] = cocuk(pdu.d);
      const vbs = cocuk(vbl.d).map((vb) => oidCoz(cocuk(vb.d)[0].d));
      const cevap = vbs.map((o) => {
        if (pdu.tag === 0xa1) {
          const sonraki = sirali.find((k) => oidKarsilastir(k, o) > 0);
          return sonraki ? tlv(0x30, [...tlv(0x06, oidB(sonraki)), ...deger(mib[sonraki])]) : tlv(0x30, [...tlv(0x06, oidB(o)), 0x82, 0x00]);
        }
        return mib[o] ? tlv(0x30, [...tlv(0x06, oidB(o)), ...deger(mib[o])]) : tlv(0x30, [...tlv(0x06, oidB(o)), 0x80, 0x00]);
      });
      const govde = [...tlv(0x02, [...rid.d]), ...tlv(0x02, [0]), ...tlv(0x02, [0]), ...tlv(0x30, Buffer.concat(cevap))];
      const paket = tlv(0x30, [...tlv(0x02, [...ver.d]), ...tlv(0x04, [...top.d]), ...tlv(0xa2, govde)]);
      s.send(paket, uzak.port, uzak.address);
    } catch { /* bozuk paket: gerçek cihaz da cevap vermez */ }
  });
  return new Promise((ok, hata) => { s.once('error', hata); s.bind(port, ip, () => ok(s)); });
}

const PRT = '1.3.6.1.2.1.43';
const KYOCERA_MIB = {
  '1.3.6.1.2.1.1.1.0': { t: 'str', v: 'KYOCERA Document Solutions Printing System' },
  '1.3.6.1.2.1.1.2.0': { t: 'oid', v: '1.3.6.1.4.1.1347.41' },
  '1.3.6.1.2.1.25.3.2.1.3.1': { t: 'str', v: 'TASKalfa 2553ci' },
  [`${PRT}.5.1.1.17.1`]: { t: 'str', v: 'LJD1Z12345\u0000\u0000' },
  [`${PRT}.10.2.1.4.1.1`]: { t: 'cnt', v: 120000 },
  [`${PRT}.11.1.1.6.1.1`]: { t: 'str', v: 'Black Toner' },
  [`${PRT}.11.1.1.6.1.2`]: { t: 'str', v: 'Cyan Toner' },
  [`${PRT}.11.1.1.8.1.1`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.8.1.2`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.9.1.1`]: { t: 'int', v: 40 },
  [`${PRT}.11.1.1.9.1.2`]: { t: 'int', v: -3 },
  [`${PRT}.12.1.1.4.1.1`]: { t: 'str', v: 'black' },
  [`${PRT}.12.1.1.4.1.2`]: { t: 'str', v: 'cyan' },
  [`${PRT}.12.1.1.4.1.3`]: { t: 'str', v: 'magenta' },
  [`${PRT}.12.1.1.4.1.4`]: { t: 'str', v: 'yellow' },
  // Durum: uyarı (3); sıkışma (0x04) + bakım gecikti (ikinci bayt 0x02).
  // 0x00 baytı metin gibi okunsaydı kırpılırdı — ham bayt yollanmalı.
  '1.3.6.1.2.1.25.3.2.1.5.1': { t: 'int', v: 3 },
  '1.3.6.1.2.1.25.3.5.1.2.1': { t: 'hex', v: '0402' },
  ...Object.fromEntries(Object.entries(kyoOzel()).map(([k, v]) => [k, { t: 'int', v }])),
  // Dalın hemen dışındaki bir değer: gezinti burada durmalı.
  '1.3.6.1.4.1.1347.42.3.1.3.1': { t: 'int', v: 777 },
};
const HP_MIB = {
  '1.3.6.1.2.1.1.1.0': { t: 'str', v: 'HP ETHERNET MULTI-ENVIRONMENT' },
  '1.3.6.1.2.1.1.2.0': { t: 'oid', v: '1.3.6.1.4.1.11.2.3.9.1' },
  '1.3.6.1.2.1.25.3.2.1.3.1': { t: 'str', v: 'HP LaserJet Pro M404dn' },
  [`${PRT}.5.1.1.17.1`]: { t: 'str', v: 'PHBQ123456' },
  [`${PRT}.10.2.1.4.1.1`]: { t: 'cnt', v: 45678 },
  [`${PRT}.11.1.1.6.1.1`]: { t: 'str', v: 'Black Cartridge HP CF259A' },
  [`${PRT}.11.1.1.8.1.1`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.9.1.1`]: { t: 'int', v: 12 },
  [`${PRT}.12.1.1.4.1.1`]: { t: 'str', v: 'black' },
  // Yalnız durum var, hata tablosu yok (bazı modeller): hata null kalmalı.
  '1.3.6.1.2.1.25.3.2.1.5.1': { t: 'int', v: 2 },
};
// Yazıcı olmayan SNMP cihazı (ağ anahtarı): listeye GİRMEMELİ.
const ANAHTAR_MIB = {
  '1.3.6.1.2.1.1.1.0': { t: 'str', v: 'Cisco IOS Software' },
  '1.3.6.1.2.1.1.2.0': { t: 'oid', v: '1.3.6.1.4.1.9.1.1' },
};

let psJson = null;
let ajanlar = [];
let ajanPort = 0;
let psKabuk = null;
const betik = join(KOK, 'public/tarayici/nextus-sayac-tarayici.ps1');
if (process.platform !== 'win32') {
  console.log('\n  ⊘ PowerShell tarayıcısı atlandı (Windows değil)');
} else {
  console.log('\nSayaç tarayıcı — gerçek PowerShell, sahte cihazlar\n');
  t('★ betik UTF-8 BOM ile kaydedilmiş (Windows PowerShell 5.1 Türkçe harfleri bozmasın)',
    readFileSync(betik).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
  const port = 20000 + Math.floor(Math.random() * 20000);
  ajanPort = port;
  try {
    ajanlar.push(await ajan('127.0.0.1', port, KYOCERA_MIB));
    ajanlar.push(await ajan('127.0.0.2', port, HP_MIB));
    ajanlar.push(await ajan('127.0.0.3', port, ANAHTAR_MIB));
  } catch (e) {
    console.log('  ⊘ sahte cihaz açılamadı:', e?.message);
  }
  if (ajanlar.length === 3) {
    for (const kabuk of ['powershell.exe', 'pwsh.exe']) {
      const var_ = spawnSync(kabuk, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
      if (var_.status !== 0) { console.log(`  ⊘ ${kabuk} yok`); continue; }
      // Tarayıcı çocuk süreçte; sahte cihazlar bu süreçte cevap vermeli, o
      // yüzden eşzamansız çalıştırılıyor (spawnSync olay döngüsünü kilitlerdi).
      const cikti = await new Promise((ok) => {
        import('node:child_process').then(({ spawn }) => {
          const c = spawn(kabuk, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', betik,
            '-Kuru', '-Hedef', '127.0.0.1,127.0.0.2,127.0.0.3,127.0.0.4', '-Port', String(port), '-ZamanAsimi', '700', '-Dil', 'tr']);
          let o = '', e = '';
          c.stdout.on('data', (d) => { o += d; });
          c.stderr.on('data', (d) => { e += d; });
          c.on('close', (kod) => ok({ kod, o, e }));
        });
      });
      const satir = cikti.o.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.startsWith('{')).pop();
      let js = null;
      try { js = JSON.parse(satir); } catch { /* aşağıda başarısız */ }
      t(`[${kabuk}] betik hatasız bitti ve JSON üretti`, cikti.kod === 0 && js !== null, { kod: cikti.kod, hata: cikti.e.slice(0, 400), son: cikti.o.slice(-300) });
      if (!js) continue;
      psJson = psJson ?? js;
      psKabuk = psKabuk ?? kabuk;
      const ips = js.cihazlar.map((c) => c.ip).sort();
      t(`[${kabuk}] ★ iki yazıcı bulundu, ağ anahtarı ve boş adres elendi`, JSON.stringify(ips) === JSON.stringify(['127.0.0.1', '127.0.0.2']), ips);
      const ky = js.cihazlar.find((c) => c.ip === '127.0.0.1');
      t(`[${kabuk}] seri, model ve toplam okundu`, ky?.seri === 'LJD1Z12345' && ky?.model === 'TASKalfa 2553ci' && ky?.toplam === 120000, ky);
      t(`[${kabuk}] renk listesi gezinildi`, JSON.stringify(ky?.renkler) === JSON.stringify(['black', 'cyan', 'magenta', 'yellow']), ky?.renkler);
      t(`[${kabuk}] ★ Kyocera dalı okundu ve dalın dışına taşmadı`,
        Object.keys(ky?.ozel ?? {}).length === 6 && !('1.3.6.1.4.1.1347.42.3.1.3.1' in (ky?.ozel ?? {})), ky?.ozel);
      t(`[${kabuk}] eksi sarf seviyesi (−3) doğru çözüldü`, ky?.sarf?.some((s) => s.seviye === -3), ky?.sarf);
      const hp = js.cihazlar.find((c) => c.ip === '127.0.0.2');
      t(`[${kabuk}] ★ tek elemanlı dizi dizi olarak kaldı (PowerShell açmadı)`, Array.isArray(hp?.renkler) && hp.renkler.length === 1 && Array.isArray(hp?.sarf), hp);
      t(`[${kabuk}] markaya özel dal yalnız o markada okunuyor`, Object.keys(hp?.ozel ?? {}).length === 0, hp?.ozel);
      t(`[${kabuk}] ★ arıza bit maskesi ham bayt olarak geldi ("0402")`, ky?.hata === '0402' && ky?.durumKodu === 3, { hata: ky?.hata, durumKodu: ky?.durumKodu });
      t(`[${kabuk}] hata tablosu olmayan cihazda hata boş, durum geliyor`, hp?.hata == null && hp?.durumKodu === 2, { hata: hp?.hata, durumKodu: hp?.durumKodu });
      t(`[${kabuk}] ★ betik sürümü sunucunun beklediği sürüm (TARAYICI_SURUMU)`, js.surum === saf.TARAYICI_SURUMU, { betik: js.surum, sunucu: saf.TARAYICI_SURUMU });
    }
  }
}

if (psJson) {
  // Betiğin ürettiği gövde, sunucunun kararından geçiyor: iki uç aynı dili konuşuyor mu.
  const govde = taramaGovdesiAyikla(psJson);
  const sistem = [
    { id: 'k', serialNo: 'LJD1Z12345', reportedSerial: null, counterBlack: 80000, counterColor: 25000 },
    { id: 'h', serialNo: 'phbq-123456', reportedSerial: null, counterBlack: 40000, counterColor: 0 },
  ];
  const s = govde.cihazlar.map((c) => cihazSonucu(c, sistem));
  const ky = s.find((x) => x.deviceId === 'k'), hp = s.find((x) => x.deviceId === 'h');
  t('★ betik → sunucu: Kyocera ayrımı doğrulandı ve yazılabilir', ky?.ayrim === 'DOGRULANDI' && ky?.durum === 'YAZILABILIR' && ky?.siyah === 90000 && ky?.renkli === 30000, ky);
  t('★ betik → sunucu: tek renkli HP yazılabilir', hp?.ayrim === 'TEK_RENK' && hp?.durum === 'YAZILABILIR' && hp?.siyah === 45678, hp);
  t('★ betik → sunucu: Kyocera sıkışma + bakım gecikti servis uyarısı', JSON.stringify(ky?.uyarilar) === JSON.stringify(['SIKISMA', 'BAKIM_GECIKTI']), ky?.uyarilar);
  t('betik → sunucu: Kyocera siyah %40 ölçüldü, renkli "biraz var" sayılmadı', ky?.olcum?.siyah === 40 && ky?.olcum?.renkli === null, ky?.olcum);
  t('betik → sunucu: HP kartuşu %12', hp?.olcum?.siyah === 12 && hp?.uyarilar?.length === 0, { olcum: hp?.olcum, uyarilar: hp?.uyarilar });
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}

let veri = null;
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
} else {
  try {
    const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
    writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
    const duzelt = (dosya, ciftler) => {
      const yol = join(g, dosya);
      let s = readFileSync(yol, 'utf8');
      for (const [a, b] of ciftler) s = s.split(a).join(b);
      writeFileSync(yol, s, 'utf8');
    };
    const ortak = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(istemci)]];
    duzelt('sayac-tarama-veri.js', [...ortak, ["'@/lib/readings'", "'./readings.js'"], ["'@/lib/sayac-tarama'", "'./sayac-tarama.js'"], ["'@/lib/verim-ogrenme'", "'./verim-ogrenme.js'"],
      ["'@/lib/ticket-number'", "'./ticket-number.js'"], ["'@/lib/ticket-asama'", "'./ticket-asama.js'"], ["'@/lib/i18n/sozluk'", "'./i18n/sozluk.js'"]]);
    duzelt('ticket-number.js', ortak);
    duzelt('ticket-asama.js', ortak);
    duzelt('i18n/sozluk.js', [["from './tr'", "from './tr.js'"], ["from './en'", "from './en.js'"]]);
    duzelt('verim-ogrenme.js', [...ortak, ["'@/lib/toner-verimi'", "'./toner-verimi.js'"], ["'@/lib/reliability'", "'./reliability.js'"]]);
    duzelt('toner-verimi.js', [...ortak, ["'@/lib/device-brands'", "'./device-brands.js'"]]);
    duzelt('reliability.js', [...ortak, ["'@/lib/fault-categories'", "'./fault-categories.js'"], ["'@/lib/stok-maliyet'", "'./stok-maliyet.js'"]]);
    duzelt('stok-maliyet.js', ortak);
    duzelt('fault-categories.js', ortak);
    duzelt('readings.js', [...ortak, ["'@/lib/invoicing'", "'./invoicing.js'"], ["'@/lib/sayac-anomali'", "'./sayac-anomali.js'"]]);
    duzelt('invoicing.js', ortak);
    veri = await import(pathToFileURL(join(g, 'sayac-tarama-veri.js')).href);
  } catch (e) {
    console.log('  ✗ veri katmanı derlenemedi —', e?.message);
    kaldi++;
  }
}

if (veri) {
  console.log('\nSayaç tarayıcı — veritabanı\n');
  const { anahtarUret, anahtarlaBayi, anahtarOzeti, taramaKaydet, taramaOnayla, sonTaramalar, anahtarYenile } = veri;
  const p = new PrismaClient();
  const SLUG = 'test-sayac-tarayici';
  let bayiId = null;
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    bayiId = (await p.tenant.create({ data: { name: 'Tarayıcı Test Bayisi', slug: SLUG }, select: { id: true } })).id;
    const musteri = await p.customer.create({ data: { tenantId: bayiId, name: 'Tarama Müşterisi', phone: '5559990077' }, select: { id: true } });
    const cihazYap = async (seri, ek = {}) => (await p.device.create({
      data: {
        tenantId: bayiId, customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa',
        serialNo: seri, publicCode: `TRY-${seri}`, qrTokenHash: `try-${seri}`, isRental: true, monthlyRent: 1000, ...ek,
      },
      select: { id: true },
    })).id;
    const kyId = await cihazYap('LJD1Z12345', { counterBlack: 80000, counterColor: 25000 });
    const hpId = await cihazYap('phbq-123456', { counterBlack: 40000, counterColor: 0 });
    const gerId = await cihazYap('GER-1', { counterBlack: 99999, counterColor: 0 });
    const canonId = await cihazYap('CANON-7', { counterBlack: 1000, counterColor: 500 });
    // Geçmiş okuma: fark ÖNCEKİ OKUMADAN hesaplanır, cihaz kartındaki sayaçtan
    // değil. İlk okuma taban sayılır (fark 0) — gerçek bayide her cihazın
    // geçmişi var, test de öyle kuruluyor.
    const gecmis = async (deviceId, b, c) => p.counterReading.create({ data: {
      tenantId: bayiId, deviceId, counterBlack: b, counterColor: c, deltaBlack: 0, deltaColor: 0,
      calculatedCost: 0, readingDate: new Date(Date.now() - 30 * 86400000), source: 'TOPLU',
    } });
    await gecmis(kyId, 80000, 25000);
    await gecmis(hpId, 40000, 0);

    const govde = (ek = []) => ({
      bilgisayar: 'TEST-PC', taranan: 254, cihazlar: [
        cihaz({ ozel: kyoOzel() }),
        cihaz({ ip: '10.0.0.6', seri: 'PHBQ123456', renkler: ['black'], toplam: 45678, sysObjectID: '1.3.6.1.4.1.11.2.3.9.1', ozel: {} }),
        cihaz({ ip: '10.0.0.7', seri: 'GER-1', renkler: ['black'], toplam: 5000, ozel: {} }),
        cihaz({ ip: '10.0.0.8', seri: 'CANON-7', sysObjectID: '1.3.6.1.4.1.1602.4.7', ozel: {} }),
        cihaz({ ip: '10.0.0.9', seri: 'SISTEMDE-YOK', renkler: ['black'], ozel: {} }),
        ...ek,
      ],
    });
    const okumaSayisi = () => p.counterReading.count({ where: { tenantId: bayiId, source: 'AG_TARAMA' } });

    // ── anahtar
    const { anahtar, ozet } = anahtarUret();
    await p.tenant.update({ where: { id: bayiId }, data: { tarayiciAnahtarHash: ozet } });
    t('★ anahtar veritabanında DÜZ METİN durmuyor', (await p.tenant.findUnique({ where: { id: bayiId }, select: { tarayiciAnahtarHash: true } })).tarayiciAnahtarHash !== anahtar);
    t('doğru anahtar bayiyi buluyor', (await anahtarlaBayi(anahtar))?.id === bayiId);
    t('yanlış anahtar bulmuyor', (await anahtarlaBayi(anahtar.slice(0, -2) + 'xx')) === null);
    t('biçimsiz anahtar veritabanına sorulmadan reddediliyor', (await anahtarlaBayi("x' OR 1=1")) === null && (await anahtarlaBayi(null)) === null);
    const yeni = await anahtarYenile(bayiId);
    t('★ anahtar yenilenince eskisi çalışmıyor', (await anahtarlaBayi(anahtar)) === null && (await anahtarlaBayi(yeni))?.id === bayiId);
    t('özet belirlenimci', anahtarOzeti('nst_abc') === anahtarOzeti('nst_abc'));

    // ── onaysız kayıt
    const r1 = await taramaKaydet(bayiId, taramaGovdesiAyikla(govde()), false);
    t('★ otomatik kapalıyken HİÇBİR okuma yazılmıyor', (await okumaSayisi()) === 0);
    const d = Object.fromEntries(r1.sonuclar.map((s) => [s.seri, s.durum]));
    t('durumlar doğru', d.LJD1Z12345 === 'YAZILABILIR' && d.PHBQ123456 === 'YAZILABILIR' && d['GER-1'] === 'GERILEDI' && d['CANON-7'] === 'AYRIM_YOK' && d['SISTEMDE-YOK'] === 'ESLESMEDI', d);
    t('özet kaydedildi', r1.ozet.yazilabilir === 2 && r1.ozet.eslesen === 4, r1.ozet);

    // ── onay
    const o1 = await taramaOnayla(bayiId, r1.id);
    t('★ onayda iki okuma yazıldı', o1.durum === 'TAMAM' && o1.ozet.yazilan === 2 && (await okumaSayisi()) === 2, o1);
    const ky = await p.device.findUnique({ where: { id: kyId }, select: { counterBlack: true, counterColor: true } });
    t('cihazın sayacı güncellendi', ky.counterBlack === 90000 && ky.counterColor === 30000, ky);
    const okuma = await p.counterReading.findFirst({ where: { deviceId: kyId, source: 'AG_TARAMA' }, select: { deltaBlack: true, deltaColor: true } });
    t('★ okuma farkı doğru (tek yazma yolundan geçti)', okuma?.deltaBlack === 10000 && okuma?.deltaColor === 5000, okuma);
    t('★ ikinci onay yazmıyor', (await taramaOnayla(bayiId, r1.id)).durum === 'ZATEN' && (await okumaSayisi()) === 2);
    t('başka bayinin taraması bulunmuyor', (await taramaOnayla('yok-boyle-bayi', r1.id)).durum === 'YOK');
    const gerCihaz = await p.device.findUnique({ where: { id: gerId }, select: { counterBlack: true } });
    t('geriledi olan cihaza dokunulmadı', gerCihaz.counterBlack === 99999);

    // ── eşzamanlı onay
    const r2 = await taramaKaydet(bayiId, taramaGovdesiAyikla({ bilgisayar: 'X', taranan: 1, cihazlar: [cihaz({ ozel: kyoOzel(95000, 31000), toplam: 126000 })] }), false);
    const [a, b] = await Promise.all([taramaOnayla(bayiId, r2.id), taramaOnayla(bayiId, r2.id)]);
    t('★ aynı anda iki onay: yalnız biri yazıyor', [a.durum, b.durum].sort().join() === 'TAMAM,ZATEN' && (await okumaSayisi()) === 3, [a.durum, b.durum]);

    // ── tarama ile onay arasında elle okuma
    const r3 = await taramaKaydet(bayiId, taramaGovdesiAyikla({ bilgisayar: 'X', taranan: 1, cihazlar: [cihaz({ ozel: kyoOzel(97000, 32000), toplam: 129000 })] }), false);
    await p.device.update({ where: { id: kyId }, data: { counterBlack: 98000, counterColor: 33000 } });
    const o3 = await taramaOnayla(bayiId, r3.id);
    t('★ onay GÜNCEL sayaca bakıyor: arada girilen okumadan düşük tarama yazılmıyor',
      o3.durum === 'TAMAM' && o3.ozet.yazilan === 0 && (o3.ozet.durumlar.GERILEDI ?? 0) === 1 && (await okumaSayisi()) === 3, o3);

    // ── otomatik
    await p.device.update({ where: { id: hpId }, data: { counterBlack: 40000, counterColor: 0 } });
    const r4 = await taramaKaydet(bayiId, taramaGovdesiAyikla({ bilgisayar: 'X', taranan: 1, cihazlar: [cihaz({ ip: '10.0.0.6', seri: 'PHBQ123456', renkler: ['black'], toplam: 46000, ozel: {} })] }), true);
    const k4 = await p.sayacTaramasi.findUnique({ where: { id: r4.id }, select: { onaylandiAt: true, yazilan: true } });
    t('★ otomatik açıkken uygun okuma hemen yazılıyor ve tarama onaylı sayılıyor', r4.ozet.yazilan === 1 && k4.onaylandiAt !== null && k4.yazilan === 1, { ozet: r4.ozet, k4 });
    t('otomatik tarama tekrar onaylanamıyor', (await taramaOnayla(bayiId, r4.id)).durum === 'ZATEN');

    // ── panel listesi
    const liste = await sonTaramalar(bayiId);
    t('panel son taramaları yeniden eskiye veriyor', liste.taramalar.length === 4 && liste.taramalar[0].id === r4.id);
    t('eşleşen cihazların etiketi ve müşterisi geliyor', liste.cihazlar[kyId]?.musteri === 'Tarama Müşterisi', liste.cihazlar[kyId]);
    t('canon cihazına hiç okuma yazılmadı', (await p.counterReading.count({ where: { deviceId: canonId } })) === 0);

    // ── cihazdan ölçülen durum
    // Kyocera taramalarında Black Toner %40, uyarı yok; HP'de kartuş yok (sarf boş).
    const kart = (id) => p.device.findUnique({ where: { id }, select: { olcumAt: true, olcumSiyah: true, olcumRenkli: true, cihazUyarilari: true, uyariAt: true, tonerResetBlack: true } });
    const ky0 = await kart(kyId);
    t('★ onay beklese de toner yüzdesi kartta (durum fatura değil)', ky0.olcumAt !== null && ky0.olcumSiyah === null, ky0);
    const sarfli = (siyah, hata, ek = {}) => cihaz({ ozel: kyoOzel(99500, 34500), toplam: 134000, hata, durumKodu: hata ? 3 : 2,
      sarf: [{ ad: 'Black Toner', max: 100, seviye: siyah }, { ad: 'Cyan Toner', max: 100, seviye: 60 }, { ad: 'Waste Toner Box', max: 100, seviye: 2 }], ...ek });
    const tara = (c, ek = []) => taramaKaydet(bayiId, taramaGovdesiAyikla({ bilgisayar: 'OFIS-PC', taranan: 1, cihazlar: [c, ...ek] }), false);
    await tara(sarfli(9, '0402'));
    const ky1 = await kart(kyId);
    t('★ toner %9 ve renkli %60 kartta; atık kutusu (%2) toner sanılmadı', ky1.olcumSiyah === 9 && ky1.olcumRenkli === 60, ky1);
    t('★ uyarılar kartta: sıkışma + bakım gecikti', JSON.stringify(ky1.cihazUyarilari) === '["SIKISMA","BAKIM_GECIKTI"]' && ky1.uyariAt !== null, ky1);
    await new Promise((r) => setTimeout(r, 20));
    await tara(sarfli(8, '0400'));
    const ky2 = await kart(kyId);
    t('★ uyarı sürüyorsa ilk görüldüğü an korunuyor', ky2.uyariAt?.getTime() === ky1.uyariAt?.getTime() && JSON.stringify(ky2.cihazUyarilari) === '["SIKISMA"]', { once: ky1.uyariAt, sonra: ky2.uyariAt });
    const degisimSay = () => p.tonerChange.count({ where: { deviceId: kyId, channel: 'BLACK' } });
    t('henüz toner değişimi yok', (await degisimSay()) === 0);
    const r5 = await tara(sarfli(97, '0000'));
    const ky3 = await kart(kyId);
    const dg = await p.tonerChange.findFirst({ where: { deviceId: kyId, channel: 'BLACK' }, orderBy: { changedAt: 'desc' } });
    t('★ %8 → %97: toner değişimi KENDİLİĞİNDEN kaydedildi (kaynak TARAYICI)', (await degisimSay()) === 1 && dg?.source === 'TARAYICI' && dg?.note === '%8 → %97', dg);
    t('değişim taramadaki sayaçla kaydedildi, cihaz kartının referansı güncellendi', dg?.counterValue === 99500 && ky3.tonerResetBlack === 99500, { dg: dg?.counterValue, kart: ky3.tonerResetBlack });
    t('tarama sonucunda "toner değişti" işareti', r5.sonuclar[0].tonerDegisti === true);
    t('★ uyarılar temizlenince başlangıç anı da siliniyor', ky3.cihazUyarilari.length === 0 && ky3.uyariAt === null, ky3);
    await tara(sarfli(96, null));
    t('★ dolu toner ikinci taramada tekrar değişim sayılmıyor', (await degisimSay()) === 1);

    // Teknisyen aynı toneri fişe sonradan yazıyor: ikinci kayıt OLMAMALI.
    const { degisimKaydet } = await import(pathToFileURL(join(g, 'verim-ogrenme.js')).href);
    const fis = await degisimKaydet({ tenantId: bayiId, deviceId: kyId, channel: 'BLACK', counterValue: 99600, source: 'FIS', note: 'TK-5240K' });
    const dg2 = await p.tonerChange.findUnique({ where: { id: dg.id } });
    t('★ fişteki toner tarayıcının kaydına eklendi, ikinci değişim yazılmadı', (await degisimSay()) === 1 && fis.id === dg.id && dg2.note === 'TK-5240K', { sayi: await degisimSay(), dg2 });

    // Arada fişle değişim girilmişse tarayıcı ikinci kez yazmıyor.
    await tara(sarfli(10, null));
    await p.tonerChange.create({ data: { tenantId: bayiId, deviceId: kyId, channel: 'BLACK', counterValue: 99550, changedAt: new Date(), source: 'ELLE' } });
    await tara(sarfli(99, null));
    t('★ arada elle girilmiş değişim varsa tarayıcı tekrar kaydetmiyor', (await p.tonerChange.count({ where: { deviceId: kyId, source: 'TARAYICI' } })) === 1);

    // İki ölçüm arası uzunsa (tarayıcı haftalarca kapalı) değişim anı belirsiz.
    await tara(sarfli(5, null));
    await p.device.update({ where: { id: kyId }, data: { olcumAt: new Date(Date.now() - 10 * 86400000) } });
    await tara(sarfli(100, null));
    t('★ 10 gün ölçüm yoksa değişim kaydedilmiyor (hangi sayaçta olduğu belli değil)', (await p.tonerChange.count({ where: { deviceId: kyId, source: 'TARAYICI' } })) === 1);

    // Aynı makine iki IP'den görünürse ikincisi kartı ezmiyor.
    await tara(sarfli(70, null), [sarfli(3, '01', { ip: '10.0.0.99' })]);
    const ky4 = await kart(kyId);
    t('★ yinelenen görünüm (BIRDEN_FAZLA) kartı ezmiyor', ky4.olcumSiyah === 70 && ky4.cihazUyarilari.length === 0, ky4);
    t('sayacı yazılamayan (ayrım yok) ama eşleşen cihazın durumu yine kartta', (await kart(canonId)).olcumAt !== null);

    // ── panel: dikkat isteyen cihazlar ve tarayan bilgisayarlar
    const { cihazDurumlari, tarayanBilgisayarlar } = veri;
    await tara(sarfli(5, '04'));
    let dur = await cihazDurumlari(bayiId);
    const kyD = dur.cihazlar.find((c) => c.id === kyId);
    t('★ sıkışan + toneri %5 olan cihaz listede, açık fiş yok', kyD && kyD.uyarilar.join() === 'SIKISMA' && kyD.olcumSiyah === 5 && kyD.acikFis === null, kyD);
    t('izlenen cihaz sayısı (güncel ölçümü olan)', dur.izlenen >= 2, dur.izlenen);
    t('uyarısı ve kritik toneri olmayan cihaz listede değil', !dur.cihazlar.some((c) => c.id === hpId));
    const kullanici = await p.user.create({ data: { tenantId: bayiId, email: 'tarayici-test@ornek.local', passwordHash: 'x', name: 'Test' }, select: { id: true } });
    await p.serviceTicket.create({ data: { tenantId: bayiId, deviceId: kyId, customerId: musteri.id, ticketNumber: 'TRY-1', createdByUserId: kullanici.id, issueText: 'Sıkışma' } });
    dur = await cihazDurumlari(bayiId);
    t('★ açık fiş varsa yanında geliyor (ikinci fiş açtırılmaz)', dur.cihazlar.find((c) => c.id === kyId)?.acikFis?.ticketNumber === 'TRY-1');
    await p.device.update({ where: { id: kyId }, data: { olcumAt: new Date(Date.now() - 4 * 86400000) } });
    t('★ 3 günden eski ölçüm panelde "güncel" sayılmıyor', !(await cihazDurumlari(bayiId)).cihazlar.some((c) => c.id === kyId));

    let pcs = await tarayanBilgisayarlar(bayiId);
    const ofis = pcs.find((x) => x.bilgisayar === 'OFIS-PC');
    t('tarayan bilgisayar: son tarama ve 7 günlük sayı', ofis && ofis.haftalik >= 8 && !ofis.sessiz, ofis);
    t('★ sürüm göndermeyen betik "eski" sayılıyor', ofis?.eski === true && ofis?.surum === null);
    await taramaKaydet(bayiId, taramaGovdesiAyikla({ surum: saf.TARAYICI_SURUMU, bilgisayar: 'YENI-PC', taranan: 1, cihazlar: [] }), false);
    await p.sayacTaramasi.updateMany({ where: { tenantId: bayiId, bilgisayar: 'OFIS-PC' }, data: { createdAt: new Date(Date.now() - 5 * 86400000) } });
    pcs = await tarayanBilgisayarlar(bayiId);
    t('★ güncel sürüm "eski" değil; sürüm taramada saklanıyor', pcs.find((x) => x.bilgisayar === 'YENI-PC')?.eski === false && pcs.find((x) => x.bilgisayar === 'YENI-PC')?.surum === saf.TARAYICI_SURUMU);
    t('★ 5 gündür tarama göndermeyen bilgisayar SESSİZ', pcs.find((x) => x.bilgisayar === 'OFIS-PC')?.sessiz === true);

    // ── uyarı geçmişi (olaylar)
    const { uyariGecmisi } = veri;
    const olay1 = await cihazYap('OLAY-1', { counterBlack: 1000, counterColor: 0 });
    const olayCihazi = (seri, hata, ek = {}) => cihaz({ ip: '10.0.0.50', seri, renkler: ['black'], toplam: 2000, ozel: {}, sysObjectID: '1.3.6.1.4.1.11.2.3.9.1',
      hata, durumKodu: hata === undefined ? undefined : 2, ...ek });
    const taraTek = (c) => taramaKaydet(bayiId, taramaGovdesiAyikla({ surum: 2, bilgisayar: 'OLAY-PC', taranan: 1, cihazlar: [c] }), false);
    const olaylar = (id) => p.cihazOlayi.findMany({ where: { deviceId: id }, orderBy: { createdAt: 'asc' } });
    await taraTek(olayCihazi('OLAY-1', '04'));
    let ol1 = await olaylar(olay1);
    t('★ sıkışma görüldü: olay açıldı (1 tarama)', ol1.length === 1 && ol1[0].kod === 'SIKISMA' && ol1[0].bitti === null && ol1[0].gorulme === 1, ol1);
    await taraTek(olayCihazi('OLAY-1', '04'));
    ol1 = await olaylar(olay1);
    t('★ ikinci taramada sürüyor: aynı olay, görülme 2 (yeni olay açılmadı)', ol1.length === 1 && ol1[0].gorulme === 2);
    t('otomatik fiş KAPALIYKEN fiş açılmadı', (await p.serviceTicket.count({ where: { deviceId: olay1 } })) === 0 && ol1[0].ticketId === null);
    await taraTek(olayCihazi('OLAY-1', undefined));
    const olay1Kart = await p.device.findUnique({ where: { id: olay1 }, select: { cihazUyarilari: true } });
    ol1 = await olaylar(olay1);
    t('★ ESKİ BETİK (durum tablosu yok) uyarıları "düzeldi" saymıyor: kart ve olay açık kalıyor', ol1[0].bitti === null && olay1Kart.cihazUyarilari.join() === 'SIKISMA', { ol1, olay1Kart });
    await taraTek(olayCihazi('OLAY-1', '00'));
    ol1 = await olaylar(olay1);
    t('★ uyarı kaybolunca olay kapandı', ol1.length === 1 && ol1[0].bitti !== null);
    await taraTek(olayCihazi('OLAY-1', '04'));
    const g1 = await uyariGecmisi(bayiId, olay1, 90);
    t('★ geçmiş: sıkışma 2 kez, en sonuncusu sürüyor', g1.ozet.length === 1 && g1.ozet[0].kod === 'SIKISMA' && g1.ozet[0].adet === 2 && g1.ozet[0].acik === true, g1.ozet);

    // ── otomatik fiş
    await p.user.create({ data: { tenantId: bayiId, email: 'tarayici-yonetici@ornek.local', passwordHash: 'x', name: 'Yönetici', role: 'ADMIN' } });
    await p.tenant.update({ where: { id: bayiId }, data: { tarayiciOtomatikFis: true, locale: 'tr' } });
    const olay2 = await cihazYap('OLAY-2', { counterBlack: 1000, counterColor: 0 });
    const fisSay = () => p.serviceTicket.count({ where: { deviceId: olay2 } });
    const r1o = await taraTek(olayCihazi('OLAY-2', '01'));
    t('servis istendi ilk taramada: fiş YOK (tek seferlik olabilir)', (await fisSay()) === 0 && !r1o.sonuclar[0].fisAcildi);
    const r2o = await taraTek(olayCihazi('OLAY-2', '01'));
    const ofis1 = await p.serviceTicket.findFirst({ where: { deviceId: olay2 }, include: { statusHistory: true } });
    t('★ iki taramada üst üste: fiş KENDİLİĞİNDEN açıldı', (await fisSay()) === 1 && ofis1?.status === 'NEW' && /^SF-\d+$/.test(ofis1?.ticketNumber ?? '') && r2o.sonuclar[0].fisAcildi === ofis1?.ticketNumber,
      { sayi: await fisSay(), no: ofis1?.ticketNumber, sonuc: r2o.sonuclar[0].fisAcildi });
    t('fiş metni cihazın bildirdiği uyarı, not "Ağ Tarayıcı açtı", aşama kaynağı SİSTEM', /Servis istiyor/.test(ofis1?.issueText ?? '') && /Ağ Tarayıcı/.test(ofis1?.notes ?? '') && ofis1?.statusHistory?.[0]?.kaynak === 'SISTEM', { issue: ofis1?.issueText, notes: ofis1?.notes, h: ofis1?.statusHistory });
    t('"servis istiyor" arıza kategorisi uydurmuyor (teknisyen seçer)', ofis1?.faultCategory === null);
    t('olay fişe bağlandı', (await olaylar(olay2)).every((o) => o.ticketId === ofis1?.id));
    await taraTek(olayCihazi('OLAY-2', '01'));
    t('★ üçüncü taramada İKİNCİ fiş açılmadı', (await fisSay()) === 1);
    await taraTek(olayCihazi('OLAY-2', '05'));
    await taraTek(olayCihazi('OLAY-2', '05'));
    const sik = (await olaylar(olay2)).find((o) => o.kod === 'SIKISMA');
    t('★ açık fiş varken yeni servis uyarısı yeni fiş açmıyor, açık fişe bağlanıyor', (await fisSay()) === 1 && sik?.ticketId === ofis1?.id, sik);
    const olay3 = await cihazYap('OLAY-3', { counterBlack: 1000, counterColor: 0 });
    await taraTek(olayCihazi('OLAY-3', '04'));
    await taraTek(olayCihazi('OLAY-3', '04'));
    const fis3 = await p.serviceTicket.findFirst({ where: { deviceId: olay3 } });
    t('★ sıkışmadan açılan fiş "kâğıt sıkışması" kategorisinde', fis3?.faultCategory === 'PAPER_JAM' && /Kâğıt sıkışması/.test(fis3?.issueText ?? ''), fis3 && { k: fis3.faultCategory, i: fis3.issueText });
    t('fiş numaraları çakışmıyor', fis3 && fis3.ticketNumber !== ofis1.ticketNumber);
    const olay4 = await cihazYap('OLAY-4', { counterBlack: 1000, counterColor: 0 });
    await taraTek(olayCihazi('OLAY-4', '40'));
    await taraTek(olayCihazi('OLAY-4', '40'));
    t('kâğıt bitti (müşterinin işi) iki taramada da fiş açmıyor', (await p.serviceTicket.count({ where: { deviceId: olay4 } })) === 0);

    // ── parça ömrü
    await taraTek(olayCihazi('OLAY-4', '00', { sarf: [{ ad: 'Black Toner', max: 100, seviye: 70 }, { ad: 'Drum Unit', max: 100, seviye: 6 }] }));
    const o4 = await p.device.findUnique({ where: { id: olay4 }, select: { olcumParca: true, olcumSarf: true } });
    t('★ parça ömrü kartta (drum %6) ve bütün kalemler saklandı', o4.olcumParca === 6 && Array.isArray(o4.olcumSarf) && o4.olcumSarf.length === 2, o4);
    const dur4 = (await cihazDurumlari(bayiId)).cihazlar.find((c) => c.id === olay4);
    t('★ drumı biten cihaz dikkat listesinde, parçanın adıyla', dur4?.olcumParca === 6 && dur4?.parcaAd === 'Drum Unit', dur4);

    // ── HTTP
    const SUNUCU = process.env.TEST_SUNUCU || 'http://localhost:3002';
    const acik = await fetch(`${SUNUCU}/api/sayac/tarayici`, { method: 'POST', signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false);
    if (!acik) {
      console.log('  ⊘ HTTP ucu atlandı: sunucu kapalı');
    } else {
      const gonder = (govdeMetni, anahtarBasligi, dil) => fetch(`${SUNUCU}/api/sayac/tarayici`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(anahtarBasligi ? { authorization: `Bearer ${anahtarBasligi}` } : {}), ...(dil ? { 'x-dil': dil } : {}) },
        body: govdeMetni,
      });
      const r = await gonder(JSON.stringify({ bilgisayar: 'HTTP', taranan: 10, cihazlar: [cihaz({ ozel: kyoOzel(99000, 34000), toplam: 133000 })] }), yeni);
      const j = await r.json();
      t('★ HTTP: geçerli anahtarla tarama kaydediliyor', r.status === 200 && j.ok && j.cihazlar?.[0]?.durum === 'YAZILABILIR', { status: r.status, j });
      t('HTTP: yanıt cümle değil KOD taşıyor', typeof j.cihazlar?.[0]?.durum === 'string' && !('mesaj' in j));
      const y = await gonder('{}', 'nst_' + 'a'.repeat(32));
      t('★ HTTP: yanlış anahtar 401', y.status === 401);
      const yEn = await (await gonder('{}', 'nst_' + 'a'.repeat(32), 'en')).json();
      t('HTTP: hata tarayıcının dilinde', /scanner key/i.test(yEn.error ?? ''), yEn);
      t('HTTP: anahtarsız 401', (await gonder('{}', null)).status === 401);
      t('HTTP: bozuk gövde 400', (await gonder('{bozuk', yeni)).status === 400);
      t('HTTP: panel listesi oturumsuz açılmıyor', (await fetch(`${SUNUCU}/api/sayac/tarayici`)).status === 401);

      // ── Müşteri paneli: toner seviyesi görünür, arıza kodu görünmez
      const jeton = 'ab'.repeat(32);
      const pm = await p.customer.create({ data: { tenantId: bayiId, name: 'Panel Müşterisi', phone: '5559990088', portalEnabled: true, portalToken: jeton } });
      const pc = await p.device.create({ data: {
        tenantId: bayiId, customerId: pm.id, brand: 'HP', model: 'Panel', serialNo: 'PANEL-1', publicCode: 'TRY-PANEL-1', qrTokenHash: 'try-panel-1',
        olcumAt: new Date(), olcumSiyah: 9, olcumRenkli: null, cihazUyarilari: ['SIKISMA', 'SERVIS_GEREKLI'], uyariAt: new Date(),
      }, select: { id: true } });
      const sayfa = async () => (await fetch(`${SUNUCU}/m/${jeton}`)).text();
      let html = await sayfa();
      t('★ müşteri panelinde toner seviyesi cihazdan okunmuş olarak görünüyor', /%9|9%/.test(html) && /cihazdan okundu/.test(html), html.length);
      t('★ müşteriye arıza kodu GÖSTERİLMİYOR (bayinin işi)', !/Kâğıt sıkışması|Servis istiyor/.test(html));
      await p.device.update({ where: { id: pc.id }, data: { olcumAt: new Date(Date.now() - 10 * 86400000) } });
      html = await sayfa();
      t('★ bir haftadan eski toner ölçümü müşteriye gösterilmiyor', !/cihazdan okundu/.test(html));

      // ── UÇTAN UCA: gerçek betik, gerçek anahtar, gerçek sunucu ────────
      if (psKabuk && ajanlar.length === 3) {
        const once = await p.sayacTaramasi.count({ where: { tenantId: bayiId } });
        const { spawn } = await import('node:child_process');
        const cikti = await new Promise((ok) => {
          const c = spawn(psKabuk, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', betik,
            '-Sunucu', SUNUCU, '-Anahtar', yeni, '-Dil', 'tr', '-Sessiz',
            '-Hedef', '127.0.0.1,127.0.0.2,127.0.0.3', '-Port', String(ajanPort), '-ZamanAsimi', '700']);
          let o = '', e = '';
          c.stdout.on('data', (d) => { o += d; });
          c.stderr.on('data', (d) => { e += d; });
          c.on('close', (kod) => ok({ kod, o, e }));
        });
        const son = await p.sayacTaramasi.findFirst({ where: { tenantId: bayiId }, orderBy: { createdAt: 'desc' }, select: { bulunan: true, bilgisayar: true, sonuc: true } });
        t('★ UÇTAN UCA: betik sahte cihazları tarayıp sunucuya gönderdi, tarama kaydedildi',
          cikti.kod === 0 && (await p.sayacTaramasi.count({ where: { tenantId: bayiId } })) === once + 1 && son?.bulunan === 2,
          { kod: cikti.kod, hata: cikti.e.slice(0, 300), cikti: cikti.o.slice(-300), son: son && { bulunan: son.bulunan } });
        const ky = (son?.sonuc ?? []).find((s) => s.seri === 'LJD1Z12345');
        t('uçtan uca: Kyocera ayrımı sunucuda doğrulandı', ky?.ayrim === 'DOGRULANDI' && ky?.siyah === 90000, ky);
        t('uçtan uca: betik sonucu kendi dilinde yazdı', /Bulunan yazıcı: 2/.test(cikti.o) && /Sistemde yok|eşleşen/i.test(cikti.o), cikti.o.slice(-400));

        // Elle çalıştırma (sağ tık → PowerShell ile çalıştır): -Sessiz YOK.
        // Sonda günlük çalışma sorulur; "H" denir, Enter ile kapanır. Windows
        // PowerShell 5.1'de görev sorgusu stderr yüzünden betiği çökertiyordu.
        const elle = await new Promise((ok) => {
          const c = spawn(psKabuk, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', betik,
            '-Sunucu', SUNUCU, '-Anahtar', yeni, '-Dil', 'tr',
            '-Hedef', '127.0.0.1', '-Port', String(ajanPort), '-ZamanAsimi', '700']);
          let o = '', e = '';
          const sure = setTimeout(() => c.kill(), 60000);
          c.stdout.on('data', (d) => { o += d; });
          c.stderr.on('data', (d) => { e += d; });
          c.on('close', (kod) => { clearTimeout(sure); ok({ kod, o, e }); });
          c.stdin.write('H\r\n\r\n');
          c.stdin.end();
        });
        t(`★ elle çalıştırma (${psKabuk}) çökmeden sona kadar gidiyor; günlük çalışma görevi sorgusu hata fırlatmıyor`,
          elle.kod === 0 && /Kapatmak için Enter/.test(elle.o) && !/schtasks|ERROR:/i.test(elle.e + elle.o),
          { kod: elle.kod, hata: elle.e.slice(0, 300), son: elle.o.slice(-400) });
      }
    }
  } catch (e) {
    kaldi++;
    console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
  } finally {
    if (bayiId) await p.tenant.delete({ where: { id: bayiId } }).catch(() => {});
    await p.$disconnect();
  }
}

for (const a of ajanlar) a.close();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
