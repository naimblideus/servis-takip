// TARAYICI KURULUMU — kurulum kodu, tek komut, canlı sinyal, teşhis.
// Çalıştır:  node scripts/test-tarayici-kurulum.mjs
//   · saf kurallar her zaman koşar
//   · veritabanı katmanı yalnız yerel veritabanıyla (kendi bayisini kurar, siler)
//   · HTTP + gerçek PowerShell yalnız dev sunucusu (:3002) açıksa ve Windows'ta
//
// NEDEN BU TEST
// Kurulum, teknisyenin müşteri ofisinde tek seferlik işi. Kilitli olanlar:
//   · KOD BİR KEZ. Aynı kod ikinci bilgisayarda kullanılamaz; GET /k/KOD
//     (WhatsApp önizlemesi) kodu harcamaz.
//   · HER OFİSİN KENDİ ANAHTARI. Yeni ofise kurmak eskisini durdurmaz;
//     tek kurulum kapatılınca yalnız o bilgisayar reddedilir.
//   · TEŞHİS ÖLÇÜMDEN. "SNMP kapalı" yalnız yazdırma kapısı açık ama SNMP'de
//     görünmeyen adres için söylenir; yazıcı bulunduysa "büyük ağ" denmez.
//   · GERÇEK BETİK UÇTAN UCA. Kurulumdan dönen betik sahte yazıcılara karşı
//     çalışır, sinyal + tarama + teşhis panele düşer.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { dizin, ice } = derle({
  girisler: ['src/lib/sayac-tarama.ts', 'src/lib/sayac-tarama-veri.ts', 'src/lib/tarayici-kurulum.ts'],
  onEk: 'st-kurulum-',
});
const saf = await ice('lib/sayac-tarama');
const { kurulumKoduNormal, hedefAyikla, toplulukAyikla, taniAyikla, kurulumIpuclari, taramaGovdesiAyikla, KURULUM_ALFABESI } = saf;
const { onyukleyici, kurulumKomutu } = await ice('lib/tarayici-kurulum');

console.log('\nKurulum — saf kurallar\n');
t('kod: küçük harf ve tire kabul, büyüğe çevrilir', kurulumKoduNormal('anec-hmfm') === 'ANECHMFM');
t('kod: karışan harfler (0, O, 1, I) yok', !/[01OIL]/.test(KURULUM_ALFABESI) && kurulumKoduNormal('ANECHMF0') === null);
t('kod: uzunluk 8', kurulumKoduNormal('ABCDEFG') === null && kurulumKoduNormal('ABCDEFGHJ') === null);
t('hedef: IP ve aralık, boşluk/virgül', JSON.stringify(hedefAyikla(' 192.168.1.50, 10.0.5.0/24 ')) === JSON.stringify({ hedef: '192.168.1.50,10.0.5.0/24' }));
t('hedef: boş = yok', hedefAyikla('').hedef === null && hedefAyikla(undefined).hedef === null);
t('★ hedef: bir parça bozuksa hiçbiri (yarım liste yok)', hedefAyikla('192.168.1.50, 192.168.1.300').hata === 'HEDEF_GECERSIZ');
t('hedef: /16 gibi geniş aralık reddedilir (65 bin adres)', hedefAyikla('10.0.0.0/16').hata === 'HEDEF_GECERSIZ');
t('hedef: komut enjeksiyonu reddedilir', hedefAyikla('1.2.3.4"; rm').hata === 'HEDEF_GECERSIZ');
t('hedef: en fazla 8', hedefAyikla(Array.from({ length: 9 }, (_, i) => `10.0.0.${i + 1}`).join(',')).hata === 'HEDEF_COK');
t('topluluk: public = varsayılan (yazılmaz)', toplulukAyikla('public').topluluk === null);
t('★ topluluk: tırnak/boşluk reddedilir (komuta girer)', toplulukAyikla("abc' -x").hata === 'TOPLULUK_GECERSIZ');
t('tanı: biçimsiz alanlar atılır', JSON.stringify(taniAyikla({ araliklar: ['10.0.0.0/24', 'x'], arayuzler: [{ ip: '10.0.0.5', onek: 16 }, { ip: 'a', onek: 1 }], adaylar: ['10.0.0.9', '999.1.1.1'], snmpCevap: 3, gunluk: true }))
  === JSON.stringify({ araliklar: ['10.0.0.0/24'], arayuzler: [{ ip: '10.0.0.5', onek: 16 }], snmpCevap: 3, adaylar: ['10.0.0.9'], gunluk: true, ozelTopluluk: false }));
t('gövde: eski betik (tanısız) da kabul', taramaGovdesiAyikla({ cihazlar: [], taranan: 5 })?.tani === null);

const tani = (ek = {}) => ({ araliklar: [], arayuzler: [{ ip: '10.154.236.167', onek: 16 }], snmpCevap: 0, adaylar: [], gunluk: true, ozelTopluluk: false, ...ek });
const kodlar = (l) => l.map((x) => x.kod).join(',');
t('★ yazıcı yok + büyük ağ → BUYUK_AG (kendi /24) + YAZICI_YOK', kodlar(kurulumIpuclari({ bulunan: 0, tani: tani(), sonuc: [] })) === 'BUYUK_AG,YAZICI_YOK'
  && kurulumIpuclari({ bulunan: 0, tani: tani(), sonuc: [] })[0].aralik === '10.154.236.0/24');
t('★ yazıcı bulunduysa "büyük ağ" denmez', !kodlar(kurulumIpuclari({ bulunan: 2, tani: tani(), sonuc: [{ ip: '1.1.1.1', durum: 'YAZILABILIR' }] })).includes('BUYUK_AG'));
t('★ SNMP kapalı: yalnız taramada görünmeyen aday', JSON.stringify(kurulumIpuclari({ bulunan: 1, tani: tani({ adaylar: ['10.0.0.5', '10.0.0.6'] }), sonuc: [{ ip: '10.0.0.5', durum: 'YAZILABILIR' }] })[0]) === JSON.stringify({ kod: 'SNMP_KAPALI', ipler: ['10.0.0.6'] }));
t('aday varsa "yazıcı yok" denmez', !kodlar(kurulumIpuclari({ bulunan: 0, tani: tani({ adaylar: ['10.0.0.6'] }), sonuc: [] })).includes('YAZICI_YOK'));
t('eşleşmeyen + renk ayrımı yok sayılır', kodlar(kurulumIpuclari({ bulunan: 3, tani: tani({ arayuzler: [] }), sonuc: [{ ip: 'a', durum: 'ESLESMEDI' }, { ip: 'b', durum: 'ESLESMEDI' }, { ip: 'c', durum: 'AYRIM_YOK' }] })) === 'ESLESMEYEN,AYRIM_YOK');
t('günlük görev kurulamadıysa söylenir; deneme (null) söylenmez', kodlar(kurulumIpuclari({ bulunan: 1, tani: tani({ gunluk: false }), sonuc: [] })) === 'GUNLUK_YOK'
  && kodlar(kurulumIpuclari({ bulunan: 1, tani: tani({ gunluk: null }), sonuc: [] })) === '');
t('eski betik, yazıcı yok → ESKI_SURUM', kodlar(kurulumIpuclari({ bulunan: 0, tani: null, sonuc: [] })) === 'ESKI_SURUM');

const ob = onyukleyici('https://nextusservis.com', 'ANECHMFM', null, 'tr');
t('önyükleyici: kod ve site gömülü, dil bayiden', ob.includes("$Kod = 'ANECHMFM'") && ob.includes("$Site = 'https://nextusservis.com'") && ob.includes('$TR = $true'));
t('önyükleyici: İngilizce bayi', onyukleyici('https://x', 'ANECHMFM', null, 'en').includes('$TR = $false'));
t('★ önyükleyici: geçersiz kod gövdeye girmez, yalnız cümle', onyukleyici('https://x', "AB'; calc", 'YOK').includes("$Kod = ''"));
t('önyükleyici: kodu KULLAN ucunda harcar, -Kurulum ile çalıştırır', ob.includes('/api/sayac/tarayici/kurulum/kullan') && ob.includes("'-Kurulum'"));
t('komut Win+R kutusuna sığar (259 karakter)', kurulumKomutu('https://nextusservis.com', 'ANECHMFM').length < 200);

// ── VERİTABANI ───────────────────────────────────────────────────────────
let p = null, bayi = null;
try {
  const { PrismaClient } = await import('@prisma/client');
  p = new PrismaClient();
  await p.$queryRaw`SELECT 1 FROM "TarayiciKurulumu" LIMIT 1`;
} catch (e) {
  console.log('\n  ⊘ veritabanı yok ya da göç uygulanmamış:', e?.message?.split('\n')[0]);
  p = null;
}
const veri = p ? await ice('lib/sayac-tarama-veri') : null;
if (p) {
  console.log('\nKurulum — veritabanı\n');
  bayi = await p.tenant.create({ data: { name: 'Test Kurulum Bayisi', slug: `test-kurulum-${Date.now()}`, isActive: true, locale: 'tr' } });
  const m = await p.customer.create({ data: { tenantId: bayi.id, name: 'Test Ofis', phone: '05000000001' } });
  for (const [seri, brand, model] of [['BNZ-PANTUM-0001', 'Pantum', 'BP5100DN'], ['BNZ-KYO-0002', 'Kyocera', 'TASKalfa 2553ci']]) {
    await p.device.create({ data: { tenantId: bayi.id, customerId: m.id, brand, model, serialNo: seri, isRental: true, publicCode: `TK-${seri}-${Date.now()}`, qrTokenHash: 'x', counterBlack: 1000, counterColor: 0 } });
  }
  const { kurulumOlustur, kurulumKoduBul, kurulumKoduKullan, anahtarlaBayi, kurulumKapat, kurulumDurumu, nabizYaz } = veri;

  const a = await kurulumOlustur(bayi.id, { hedef: '10.0.0.5', topluluk: null });
  t('kod üretildi, 6 saat geçerli', /^[A-Z2-9]{8}$/.test(a.kod) && Math.abs(a.kodBitis.getTime() - Date.now() - 6 * 3_600_000) < 60_000);
  t('kod bulundu (harcanmadan)', (await kurulumKoduBul(a.kod)).durum === 'GECERLI' && (await kurulumKoduBul(a.kod)).durum === 'GECERLI');
  const k1 = await kurulumKoduKullan(a.kod, 'OFIS-A');
  t('★ kullanınca kuruluma özel anahtar + hedef döner', k1.durum === 'TAMAM' && /^nst_/.test(k1.anahtar) && k1.hedef === '10.0.0.5' && k1.dil === 'tr');
  t('★ aynı kod ikinci kez kullanılamaz', (await kurulumKoduKullan(a.kod, 'OFIS-B')).durum === 'KULLANILDI');
  const b = await kurulumOlustur(bayi.id, { hedef: null, topluluk: null });
  const k2 = await kurulumKoduKullan(b.kod, 'OFIS-B');
  const ba = await anahtarlaBayi(k1.anahtar), bb = await anahtarlaBayi(k2.anahtar);
  t('★ iki ofis: ikisinin anahtarı da geçerli (yeni kurulum eskisini durdurmaz)', ba?.id === bayi.id && bb?.id === bayi.id && ba.kurulumId === a.id && bb.kurulumId === b.id);
  await kurulumKapat(bayi.id, a.id);
  t('★ tek kurulum kapatılınca yalnız o reddedilir', (await anahtarlaBayi(k1.anahtar)) === null && (await anahtarlaBayi(k2.anahtar))?.id === bayi.id);
  const c = await kurulumOlustur(bayi.id, { hedef: null, topluluk: null }, new Date(Date.now() - 7 * 3_600_000));
  t('süresi geçen kod kullanılamaz', (await kurulumKoduKullan(c.kod, 'X')).durum === 'SURESI_DOLDU');
  t('başka bayinin kurulumu görünmez', (await kurulumDurumu('baska-bayi', b.id)) === null);
  await nabizYaz(b.id, { asama: 'BASLADI', hedefSayisi: 254, bilgisayar: 'OFIS-B' });
  const d = await kurulumDurumu(bayi.id, b.id);
  t('canlı sinyal kurulum ekranında', d?.nabiz?.asama === 'BASLADI' && d.nabiz.hedefSayisi === 254 && d.tarama === null);
}

// ── HTTP + GERÇEK POWERSHELL ─────────────────────────────────────────────
const SUNUCU = process.env.SUNUCU || 'http://localhost:3002';
let sunucuVar = false;
try { sunucuVar = (await fetch(`${SUNUCU}/k/AAAAAAAA`, { signal: AbortSignal.timeout(60_000) })).ok; } catch { /* kapalı */ }
if (!p || !sunucuVar) {
  console.log(`\n  ⊘ HTTP atlandı (${!p ? 'veritabanı yok' : `${SUNUCU} kapalı`})`);
} else {
  console.log('\nKurulum — HTTP\n');
  const { kurulumOlustur, kurulumDurumu } = veri;
  const kod = (await kurulumOlustur(bayi.id, { hedef: '127.0.0.40,127.0.0.41,127.0.0.42', topluluk: null })).kod;
  const ob1 = await (await fetch(`${SUNUCU}/k/${kod}`)).text();
  const ob2 = await fetch(`${SUNUCU}/k/${kod}`);
  t('★ GET /k/KOD kodu harcamaz (önizleme iki kez açsa da)', ob1.includes(`$Kod = '${kod}'`) && ob1.includes("$Hata = ''") && (await ob2.text()).includes("$Hata = ''"));
  t('önyükleyici düz metin, utf-8', (ob2.headers.get('content-type') ?? '').includes('charset=utf-8'));
  const kul = await fetch(`${SUNUCU}/api/sayac/tarayici/kurulum/kullan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kod: kod.toLowerCase(), bilgisayar: 'TEST-PC' }) });
  const kj = await kul.json();
  const anahtar = /\$Anahtar = '(nst_[^']+)'/.exec(kj.betik ?? '')?.[1];
  t('★ kullan: betik anahtar, site ve dille dolu', kul.ok && !!anahtar && kj.betik.includes(`[string]$Sunucu = '${SUNUCU}'`) && kj.betik.includes("[string]$Dil = 'tr'") && kj.hedef === '127.0.0.40,127.0.0.41,127.0.0.42');
  const tekrar = await fetch(`${SUNUCU}/api/sayac/tarayici/kurulum/kullan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kod }) });
  t('ikinci kullanım 410 + KULLANILDI', tekrar.status === 410 && (await tekrar.json()).kod === 'KULLANILDI');
  t('sonra GET /k/KOD "kullanıldı" der', (await (await fetch(`${SUNUCU}/k/${kod}`)).text()).includes("$Hata = 'KULLANILDI'"));
  const nb = await fetch(`${SUNUCU}/api/sayac/tarayici/nabiz`, { method: 'POST', headers: { authorization: 'Bearer nst_yanlisyanlisyanlisyanlis', 'content-type': 'application/json' }, body: '{}' });
  t('yanlış anahtarla sinyal 401', nb.status === 401);

  if (process.platform !== 'win32') {
    console.log('  ⊘ PowerShell atlandı (Windows değil)');
  } else {
    console.log('\nKurulum — gerçek betik, sahte yazıcılar\n');
    const port = 20000 + Math.floor(Math.random() * 20000);
    const sim = spawn(process.execPath, [join(KOK, 'scripts/snmp-benzetim.mjs'), '--port', String(port), '--taban', '40'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((ok) => { let n = 0; sim.stdout.on('data', (d) => { n += (String(d).match(/✓/g) ?? []).length; if (n >= 3) ok(); }); setTimeout(ok, 5000); });
    const gec = mkdtempSync(join(tmpdir(), 'st-kurulum-ps-'));
    const yol = join(gec, 'nextus-sayac-tarayici.ps1');
    writeFileSync(yol, '﻿' + kj.betik, 'utf8');
    // Kurulum kipi ama -Deneme: test makinesine günlük görev KURULMAZ.
    const cikti = await new Promise((ok) => {
      const c = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', yol, '-Kurulum', '-Deneme', '-Sessiz', '-Hedef', kj.hedef, '-Port', String(port), '-ZamanAsimi', '800'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let o = ''; c.stdout.on('data', (d) => { o += d; }); c.stderr.on('data', (d) => { o += d; });
      c.on('close', () => ok(o));
      setTimeout(() => { c.kill(); ok(o + '\n[zaman aşımı]'); }, 180_000);
    });
    sim.kill();
    rmSync(gec, { recursive: true, force: true });
    const kur = await p.tarayiciKurulumu.findUnique({ where: { kod } });
    const d = await kurulumDurumu(bayi.id, kur.id);
    t('★ betik çalıştı: tarama bu kuruluma bağlı geldi', d?.tarama?.bulunan === 2 && d.tarama.eslesen === 2, { cikti: cikti.slice(-400), tarama: d?.tarama && { bulunan: d.tarama.bulunan, eslesen: d.tarama.eslesen } });
    t('★ SNMP kapalı yazıcı teşhis edildi (9100 açık, SNMP yok)', d?.tarama?.ipuclari?.some((i) => i.kod === 'SNMP_KAPALI' && i.ipler?.includes('127.0.0.42')), d?.tarama?.ipuclari);
    t('deneme kipinde "günlük kurulamadı" denmez', d?.tarama?.tani?.gunluk === null && !d.tarama.ipuclari.some((i) => i.kod === 'GUNLUK_YOK'));
    t('kurulum son sinyali BITTI, bilgisayar adı yazıldı', d?.nabiz?.asama === 'BITTI' && !!d.bilgisayar);
  }
}

if (p) {
  if (bayi) await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {});
  await p.$disconnect();
}
rmSync(dizin, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
