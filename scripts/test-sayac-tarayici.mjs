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
    duzelt('sayac-tarama-veri.js', [...ortak, ["'@/lib/readings'", "'./readings.js'"], ["'@/lib/sayac-tarama'", "'./sayac-tarama.js'"]]);
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
