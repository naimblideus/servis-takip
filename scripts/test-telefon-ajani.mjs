// TELEFON AJANI — kurallar, kimlik, imza, Retell gövdeleri, kaynak bekçisi
// Çalıştır:  node scripts/test-telefon-ajani.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Ajan bayinin müşterisiyle bayi adına konuşuyor. Bayiyle kararlaştırılan
// beş kuralın her biri burada makineyle denetleniyor, çünkü hiçbiri ilk
// kırıldığında görünmez:
//   1. Otomatik fiş YOK → ajan yolunda fiş yazan satır yok (kaynak bekçisi).
//   2. Fotoğraftan sayaç okuma YOK → ajan dosyaları medyaya dokunmuyor.
//   3. Tanınmayana WhatsApp cevabı YOK; "böyle bir fiş yok" DENMEZ →
//      bulunamadı / başkasının / tanınmadı cevapları bayt bayt aynı.
//   4. IDOR → kimlik yalnız Retell çağrı kaydından; argümandaki numara yok sayılır.
//   5. Varsayılan KAPALI; kapatınca hat açık kalır → gelen arama aktarma ajanına.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');
const g = mkdtempSync(join(tmpdir(), 'st-telefon-ajani-'));
let A, I, M;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/telefon-ajani.ts'), join(KOK, 'src/lib/telefon-ajani-imza.ts'),
      join(KOK, 'src/lib/telefon-ajani-metin.ts'), join(KOK, 'src/lib/sla.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  // tsc uzantısız bırakıyor; Node ESM uzantı ister.
  for (const f of ['telefon-ajani.js', 'telefon-ajani-imza.js', 'telefon-ajani-metin.js']) {
    const y = join(g, f);
    writeFileSync(y, readFileSync(y, 'utf8').replace(/from '\.\/(sla|telefon-ajani)'/g, "from './$1.js'"), 'utf8');
  }
  A = await import(pathToFileURL(join(g, 'telefon-ajani.js')).href);
  I = await import(pathToFileURL(join(g, 'telefon-ajani-imza.js')).href);
  M = await import(pathToFileURL(join(g, 'telefon-ajani-metin.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── NUMARA ───────────────────────────────────────────────────────────────
console.log('\nNumara');
t('son10: +90 ile', A.son10('+905321234567') === '5321234567');
t('son10: boşluklu yerel biçim', A.son10('0532 123 45 67') === '5321234567');
t('★ son10: gizli numara tanınmaz', A.son10('anonymous') === '');
t('★ son10: SIP adresindeki rakamlar numara sayılmaz', A.son10('sip:+905321234567@10.0.0.1') === '');
t('son10: kısa numara tanınmaz', A.son10('12345') === '' && A.son10(undefined) === '');
t('e164TR: cep', A.e164TR('0532 123 45 67') === '+905321234567');
t('e164TR: sabit hat +90', A.e164TR('+90 (212) 555-11-22') === '+902125551122');
t('e164TR: 90 ile başlayan 12 hane', A.e164TR('905321234567') === '+905321234567');
t('e164TR: 0090 ön eki', A.e164TR('0090 532 123 45 67') === '+905321234567');
t('e164TR: 0850 kabul', A.e164TR('0850 123 45 67') === '+908501234567');
t('★ e164TR: 0900 (ücretli hat) REDDEDİLİR', A.e164TR('0900 123 45 67') === null);
t('★ e164TR: yurt dışı REDDEDİLİR', A.e164TR('+1 415 555 1234') === null && A.e164TR('+44 20 7946 0958') === null);
t('e164TR: anlamsız/boş/6xx', A.e164TR('abc') === null && A.e164TR('') === null && A.e164TR('0612 345 67 89') === null);
t('hatNumarasiSade: rakamlar', A.hatNumarasiSade('+90 850 123 45 67') === '908501234567' && A.hatNumarasiSade('+1 (415) 555-1234') === '14155551234');
t('hatNumarasiSade: geçersiz', A.hatNumarasiSade('abc') === null && A.hatNumarasiSade('123') === null && A.hatNumarasiSade('+90 850; DROP') === null);

// ── FİŞ NUMARASI ─────────────────────────────────────────────────────────
console.log('\nFiş numarası');
t('SF- ön eki', A.fisNoCikar('SF-284') === '284' && A.fisNoCikar('sf 284 ne oldu') === '284' && A.fisNoCikar('TSK-12') === '12');
t('ön sıfır atılır (SF-0284 → 284)', A.fisNoCikar('SF-0284') === '284');
t('niyet kelimesiyle çıplak sayı', A.fisNoCikar('284 numaralı fişim ne oldu') === '284' && A.fisNoCikar('kaydım 1520 durum nedir') === '1520');
t('★ model adı fiş sanılmaz: "MX-3061 durumu ne oldu"', A.fisNoCikar('MX-3061 durumu ne oldu') === null);
t('★ model adı fiş sanılmaz: "iR 2520 fiş durumu"', A.fisNoCikar('iR 2520 fiş durumu') === null);
t('★ model adı fiş sanılmaz: "M2040 durum", "2554ci fiş"', A.fisNoCikar('M2040 durum') === null && A.fisNoCikar('2554ci fiş durumu') === null);
t('niyetsiz çıplak sayı alınmaz ("MX-3061 kağıt sıkıştırıyor", "2 gündür")',
  A.fisNoCikar('MX-3061 kağıt sıkıştırıyor') === null && A.fisNoCikar('2 gündür bozuk') === null && A.fisNoCikar('1520 bozuk') === null);
t('seste numara ayrı soruldu: niyetsiz kabul', A.fisNoCikar('1520', { niyetsiz: true }) === '1520');

// ── KİMLİK: yalnız call nesnesi ──────────────────────────────────────────
console.log('\nKimlik ve kiracı');
const govde = {
  name: 'fis_durumu',
  from_number: '+905559999999',
  call: { agent_id: 'ag_1', call_id: 'call_1', from_number: '+905321234567', to_number: '+908501234567' },
  args: { fis_no: '284', from_number: '+905559999999', telefon: '05559999999' },
};
const b0 = A.cagriBaglami(govde);
t('★ kimlik call.from_number\'dan; kökteki ve args\'taki numara YOK SAYILIR', b0?.arayanSon10 === '5321234567', b0);
t('ajan/çağrı kimliği call\'dan', b0?.agentId === 'ag_1' && b0?.callId === 'call_1');
t('★ call yoksa gövde geçersiz (köke düşülmez)', A.cagriBaglami({ agent_id: 'ag_1', from_number: '+905321234567' }) === null);
t('call dizi ya da gövde boşsa geçersiz', A.cagriBaglami({ call: [] }) === null && A.cagriBaglami(null) === null);
t('araç adı ve argümanlar', esit(A.aracCagrisi(govde), { ad: 'fis_durumu', args: govde.args }) && esit(A.aracCagrisi({ name: 'x', args: [1] }).args, {}));
t('★ bilinmeyen/eksik ajan kimliği → RED (numaraya düşülmez)', A.kiraciKarari(null, { tenantId: 'x', acik: true, bayiEtkin: true }).tur === 'RED' && A.kiraciKarari('ag_1', null).tur === 'RED');
t('açık ajan + etkin bayi → ACIK', esit(A.kiraciKarari('ag_1', { tenantId: 't1', acik: true, bayiEtkin: true }), { tur: 'ACIK', tenantId: 't1' }));
t('★ kapalı ajan ya da askıdaki bayi → KAPALI', A.kiraciKarari('ag_1', { tenantId: 't1', acik: false, bayiEtkin: true }).tur === 'KAPALI' && A.kiraciKarari('ag_1', { tenantId: 't1', acik: true, bayiEtkin: false }).tur === 'KAPALI');
t('bayiEtkin: askıda/silinmiş/kapalı değil', A.bayiEtkin({ isActive: true }) && !A.bayiEtkin({ isActive: true, isSuspended: true }) && !A.bayiEtkin({ isActive: true, deletedAt: new Date() }) && !A.bayiEtkin({ isActive: false }) && !A.bayiEtkin(null));

// ── GELEN ARAMA ──────────────────────────────────────────────────────────
console.log('\nGelen arama (bot kapalıyken hat açık kalır)');
const e = (x) => ({ acik: true, bayiEtkin: true, bayiSilindi: false, asilAgentId: 'asil', aktarmaAgentId: 'aktar', ...x });
t('tanınmayan hat → boş cevap (numaranın varsayılanı)', esit(A.gelenAramaYaniti(null), { call_inbound: {} }));
t('açık ajan → asıl ajan', esit(A.gelenAramaYaniti(e({})), { call_inbound: { override_agent_id: 'asil' } }));
t('★ kapalı ajan → YALNIZ AKTARMA ajanı (bot konuşmaz, hat kapanmaz)', esit(A.gelenAramaYaniti(e({ acik: false })), { call_inbound: { override_agent_id: 'aktar' } }));
t('★ askıdaki bayi → aktarma ajanı', esit(A.gelenAramaYaniti(e({ bayiEtkin: false })), { call_inbound: { override_agent_id: 'aktar' } }));
t('asıl ajan kurulmamışsa → aktarma ajanı', esit(A.gelenAramaYaniti(e({ asilAgentId: null })), { call_inbound: { override_agent_id: 'aktar' } }));
t('silinmiş bayinin hattı reddedilir', esit(A.gelenAramaYaniti(e({ bayiSilindi: true })), { call_inbound: { reject: true } }));
t('★ kapalı ajanda asıl ajan HİÇBİR durumda seçilmez',
  [e({ acik: false }), e({ acik: false, aktarmaAgentId: null }), e({ bayiEtkin: false, aktarmaAgentId: null })]
    .every((x) => A.gelenAramaYaniti(x).call_inbound.override_agent_id !== 'asil'));

// ── CİHAZ EŞLEME ─────────────────────────────────────────────────────────
console.log('\nCihaz eşleme');
const C = [
  { id: 'a', brand: 'Kyocera', model: 'TASKalfa 2554ci', serialNo: 'LV9-A12345' },
  { id: 'b', brand: 'Kyocera', model: 'TASKalfa 2554ci', serialNo: 'LV9A67890' },
  { id: 'c', brand: 'HP', model: 'LaserJet M404', serialNo: 'PHB1234567' },
];
t('tam seri (boşluk/tire/harf büyüklüğü yok sayılır)', esit(A.cihazEsle({ seriNo: 'lv9 a12345' }, C), { deviceId: 'a', neden: 'SERI' }));
t('tekil son 5+ hane', esit(A.cihazEsle({ seriNo: '67890' }, C), { deviceId: 'b', neden: 'SERI' }));
t('★ aynı modelden iki cihaz → SEÇİLMEZ', esit(A.cihazEsle({ model: 'kyocera 2554ci' }, C), { deviceId: null, neden: 'BELIRSIZ' }));
t('tekil model', esit(A.cihazEsle({ model: 'laserjet m404' }, C), { deviceId: 'c', neden: 'MODEL' }));
t('★ eksik söylenen model (marka + kod) tanınır', esit(A.cihazEsle({ model: 'HP M404' }, C), { deviceId: 'c', neden: 'MODEL' }));
t('hiçbir şey söylenmedi + tek cihaz → TEK_CIHAZ', esit(A.cihazEsle({}, [C[2]]), { deviceId: 'c', neden: 'TEK_CIHAZ' }));
t('hiçbir şey söylenmedi + çok cihaz → BELIRSIZ', A.cihazEsle({}, C).deviceId === null);
t('söylenen tek cihazla uyuşmuyorsa varsayılmaz', esit(A.cihazEsle({ model: 'brother 2320' }, [C[2]]), { deviceId: null, neden: 'YOK' }));
t('★ tanınmayan arayan: yalnız TAM seri, model sayılmaz', esit(A.cihazEsle({ model: 'laserjet m404' }, C, { yalnizSeri: true }), { deviceId: null, neden: 'YOK' }) && A.cihazEsle({ seriNo: '67890' }, C, { yalnizSeri: true }).deviceId === null);
t('aynı seri iki kayıtta (biçim farkı) → BELIRSIZ', A.cihazEsle({ seriNo: 'LV9A12345' }, [...C, { id: 'd', brand: 'X', model: 'Y', serialNo: 'lv9a12345' }]).neden === 'BELIRSIZ');
t('WhatsApp metninden seri', esit(A.cihazEsleMetin('seri no PHB1234567 olan yazıcı', C), { deviceId: 'c', neden: 'SERI' }));
t('WhatsApp metninden model', esit(A.cihazEsleMetin('muhasebedeki laserjet m404 yazmıyor', C), { deviceId: 'c', neden: 'MODEL' }));
t('WhatsApp metninde ipucu yok', A.cihazEsleMetin('yazıcı bozuk', C).deviceId === null);

// ── SESLİ CEVAPLAR VERİ TAŞIMAZ ─────────────────────────────────────────
console.log('\nSesli cevaplar (veritabanından bilgi taşımaz)');
const cumleler = new Set(Object.values(A.CUMLE));
const cbCevaplari = [
  A.cihazBulCevabi({ seriVerdi: false, modelVerdi: false, tekilEslesme: false }),
  A.cihazBulCevabi({ seriVerdi: true, modelVerdi: false, tekilEslesme: true }),
  A.cihazBulCevabi({ seriVerdi: true, modelVerdi: false, tekilEslesme: false }),
  A.cihazBulCevabi({ seriVerdi: false, modelVerdi: true, tekilEslesme: false }),
];
t('★ cihaz_bul yalnız sabit cümle döner (cihaz adı/sayısı/yeri yok)', cbCevaplari.every((c) => cumleler.has(c.soyle) && Object.keys(c).join() === 'ok,soyle'));
t('bilgi yoksa sorar, tekilse not alır, belirsizse seri ister',
  cbCevaplari[0].soyle === A.CUMLE.CIHAZ_SOR && cbCevaplari[1].soyle === A.CUMLE.NOT_ALDIM && cbCevaplari[3].soyle === A.CUMLE.SERI_ISTE);
const n1 = A.notrCevap(), n2 = A.notrCevap();
t('★ bulunamadı / başkasının / tanınmadı → BAYT BAYT AYNI cevap', JSON.stringify(n1) === JSON.stringify(n2) && n1 !== n2);
t('★ nötr cevapta "yok" geçmez ("böyle bir fiş yok" denmez)', !/\byok\b/i.test(n1.soyle) && !/bulunamad/i.test(n1.soyle));
t('sesli durum cümlesinde marka/model yok, yalnız numara + durum', A.sesDurumCumlesi('SF-284', 'IN_SERVICE') === 'SF-284 numaralı kaydınızın durumu: serviste, üzerinde çalışılıyor.');
t('WhatsApp durum cümlesi mevcut otomatik cevapla aynı biçim', A.waDurumCumlesi({ ticketNumber: 'SF-9', status: 'READY', brand: 'HP', model: 'M404' }).includes('HP M404 — hazır'));
t('devir ve hata cevabı aktarır', A.devirCevabi().devret === true && A.hataCevabi().devret === true);

// ── WHATSAPP KARARI ──────────────────────────────────────────────────────
console.log('\nWhatsApp kararı');
const w = (x) => A.waKarari({ musteriTanindi: true, metin: 'yazıcı çalışmıyor', arizaBildirimi: true, cihazBekleyenTaslakId: null, acikTaslakId: null, ...x });
t('★ tanınmayan numara → HİÇBİR ŞEY', w({ musteriTanindi: false }).tur === 'YOK');
t('boş/medya-yalnız mesaj → hiçbir şey (fotoğraf yorumlanmaz)', w({ metin: '' }).tur === 'YOK' && w({ metin: null }).tur === 'YOK');
t('cihaz sorulmuş taslak varsa bu mesaj cevaptır', esit(w({ cihazBekleyenTaslakId: 't1', metin: 'SF-12 olan değil, M404' }), { tur: 'TASLAK_TAMAMLA', taslakId: 't1' }));
t('fiş sorusu (arıza değil)', esit(w({ metin: 'SF-12 ne oldu', arizaBildirimi: false }), { tur: 'FIS_DURUMU', fisNo: '12', yoksa: { tur: 'YOK' } }));
t('★ fiş bulunamazsa arıza akışına düşer', esit(w({ metin: 'SF-12 hâlâ bozuk' }), { tur: 'FIS_DURUMU', fisNo: '12', yoksa: { tur: 'TASLAK_AC' } }));
t('arıza + açık taslak → ona eklenir (üç mesaj, tek taslak)', esit(w({ acikTaslakId: 't2' }), { tur: 'TASLAK_EKLE', taslakId: 't2' }));
t('arıza → yeni taslak', esit(w({}), { tur: 'TASLAK_AC' }));
t('selam → hiçbir şey', w({ metin: 'merhaba', arizaBildirimi: false }).tur === 'YOK');
t('model numarası fiş sorgusu sanılmaz', esit(w({ metin: 'MX-3061 kağıt sıkıştırıyor' }), { tur: 'TASLAK_AC' }));

// ── TASLAK BİRLEŞTİRME ───────────────────────────────────────────────────
console.log('\nTaslak birleştirme');
const tb = A.taslakBirlestir({ arizaMetni: 'Kağıt sıkışıyor', acil: true, firmaAdi: 'Acme' }, { arizaMetni: 'kağıt sıkışıyor', acil: false, firmaAdi: '' });
t('aynı arıza çiftlenmez', tb.arizaMetni === 'Kağıt sıkışıyor');
t('acil bir kez işaretlenince kalır; boş yeni değer eskisini silmez', tb.acil === true && tb.firmaAdi === 'Acme');
t('yeni bilgi eklenir', A.taslakBirlestir({ arizaMetni: 'Kağıt sıkışıyor' }, { arizaMetni: 'ekranda C6000 yazıyor' }).arizaMetni === 'Kağıt sıkışıyor\nekranda C6000 yazıyor');

// ── TEKNİSYEN ÖNERİSİ ────────────────────────────────────────────────────
console.log('\nTeknisyen önerisi (yalnız öneri)');
const k = (id, ad, x) => ({ id, ad, bolgeIs: 0, markaIs: 0, kategoriIs: 0, acikIs: 0, ...x });
t('teknisyen yoksa öneri yok', A.teknisyenSec([]) === null);
t('bölge markadan ağır basar', A.teknisyenSec([k('a', 'Ali', { bolgeIs: 10, acikIs: 2 }), k('b', 'Can', { markaIs: 10 })]).teknisyenId === 'a');
t('★ yük cezası: 15 açık işi olan bölge ustası değil, boştaki seçilir', A.teknisyenSec([k('a', 'Ali', { bolgeIs: 10, acikIs: 15 }), k('b', 'Can', { bolgeIs: 2 })]).teknisyenId === 'b');
t('eşit puanda az yüklü, o da eşitse ada göre', A.teknisyenSec([k('a', 'Zeki', { markaIs: 5 }), k('b', 'Ali', { markaIs: 5 })]).teknisyenId === 'b');
const gy = A.teknisyenSec([k('a', 'Ali', { acikIs: 3 }), k('b', 'Can', { acikIs: 1 })]);
t('★ kimsenin geçmişi yoksa en az yüklü ve bu AÇIKÇA yazılır', gy.teknisyenId === 'b' && gy.veri.gecmisYok === true);
t('gerekçe okuyanın dilinde', M.gerekceMetni({ bolgeIs: 7, markaIs: 0, kategoriIs: 2, acikIs: 1, gecmisYok: false }, M.ajanMetni('tr')) === 'bu bölgede 7 iş · 2 benzer arıza · şu an 1 açık işi var'
  && M.gerekceMetni({ bolgeIs: 0, markaIs: 0, kategoriIs: 0, acikIs: 1, gecmisYok: true }, M.ajanMetni('en')).startsWith('no past jobs'));

// ── MESAİ, AY BAŞI, SINIR, SAYAÇ ─────────────────────────────────────────
console.log('\nMesai, ay başı, sorgu sınırı, sayaç');
const takvim = { zamanDilimi: 'Europe/Istanbul', gunler: [1, 2, 3, 4, 5], baslangicDk: 540, bitisDk: 1080, tatiller: ['2026-11-19'] };
t('salı 10:00 mesai', A.mesaideMi(new Date('2026-11-17T07:00:00Z'), takvim) === true);
t('salı 09:00 mesai, 08:59 değil', A.mesaideMi(new Date('2026-11-17T06:00:00Z'), takvim) && !A.mesaideMi(new Date('2026-11-17T05:59:00Z'), takvim));
t('salı 18:30 değil', A.mesaideMi(new Date('2026-11-17T15:30:00Z'), takvim) === false);
t('cumartesi değil', A.mesaideMi(new Date('2026-11-21T07:00:00Z'), takvim) === false);
t('tatil günü değil', A.mesaideMi(new Date('2026-11-19T07:00:00Z'), takvim) === false);
t('ay başı İstanbul saatiyle', A.ayBasi(new Date('2026-11-17T10:00:00Z')).toISOString() === '2026-10-31T21:00:00.000Z'
  && A.ayBasi(new Date('2026-11-30T22:30:00Z')).toISOString() === '2026-11-30T21:00:00.000Z');
const sn = A.sinirlayici(3, 60_000);
t('★ bir çağrıda en çok 3 fiş sorgusu', sn('c1', 0) && sn('c1', 1) && sn('c1', 2) && !sn('c1', 3) && sn('c2', 3));
t('pencere dolunca yeniden; çağrı kimliği yoksa hiç', sn('c1', 70_000) && !sn(null, 0));
t('sayaç: açılan/onaylanan/mesajdan/reddedilen/bekleyen', esit(A.sayacTopla([
  { durum: 'BEKLIYOR', kapanisYolu: null, n: 2 }, { durum: 'ONAYLANDI', kapanisYolu: 'TASLAK', n: 5 },
  { durum: 'ONAYLANDI', kapanisYolu: 'MESAJ', n: 1 }, { durum: 'REDDEDILDI', kapanisYolu: null, n: 3 },
]), { acilan: 11, onaylanan: 6, mesajdan: 1, reddedilen: 3, bekleyen: 2 }));

// ── RETELL GÖVDELERİ ─────────────────────────────────────────────────────
console.log('\nRetell gövdeleri');
const sir = randomBytes(16).toString('hex').slice(0, 24);
const araclar = A.servisAraclari({ url: 'https://ornek.test/api/voice/tools', sir }, '+905321234567');
const ozel = araclar.filter((a) => a.type === 'custom');
t('★ araç adları ARAC_ADLARI ile birebir', esit(ozel.map((a) => a.name), [...A.ARAC_ADLARI]));
t('★ sır BAŞLIKTA, adres https, yöntem POST', ozel.every((a) => a.headers?.[A.SIR_BASLIGI] === sir && a.url.startsWith('https://') && a.method === 'POST'));
t('zaman aşımı ≤ 10 sn (varsayılan 120 sn arayanı susturur)', ozel.every((a) => a.timeout_ms > 0 && a.timeout_ms <= 10_000));
const paramlar = ozel.flatMap((a) => Object.keys(a.parameters?.properties ?? {}));
t('★ hiçbir parametre çağrı alanı adını taşımaz (from_number, call, agent_id…)', paramlar.every((p) => !A.YASAK_PARAMETRELER.includes(p)), paramlar);
const aktarma = araclar.find((a) => a.type === 'transfer_call');
t('aktarma aracı + ile ve soğuk aktarma', aktarma?.transfer_destination?.number === '+905321234567' && aktarma?.transfer_option?.type === 'cold_transfer');
t('bitirme aracı var', araclar.some((a) => a.type === 'end_call' && a.name === A.BITIR_ARACI));
t('aktarma ajanı yalnız aktarır', esit(A.aktarmaAraclari('905321234567').map((a) => a.name), [A.AKTAR_ARACI, A.BITIR_ARACI]) && A.aktarmaAraci('905321234567').transfer_destination.number === '+905321234567');

const acilis = A.acilisCumlesi('Acme "Ofis"\nSistemi', 'Ayşe');
t('★ açılış yapay zekâ ve kayıt beyanıyla başlar', /yapay zekâ asistanıyım/.test(acilis) && /kayda alınabilir/.test(acilis));
t('bayi adı komut metnine temizlenerek girer (tırnak/satır sonu yok)', !acilis.includes('"') && !acilis.includes('\n') && acilis.includes('Acme Ofis Sistemi'));
t('asistan adı yalnız harf', A.asistanAdiTemizle('Ayşe') === 'Ayşe' && A.asistanAdiTemizle('<script>') === 'Deniz' && A.asistanAdiTemizle('A') === 'Deniz');
const prompt = A.ajanPromptu({ bayiAdi: 'Acme', asistanAdi: 'Deniz' });
t('★ komut metni yasakları sayar: fiyat, geliş sözü, "fiş açıldı", müşteri bilgisi, teknik tarif', ['FİYAT SÖYLEME', 'GELİŞ SÖZÜ', '"FİŞ AÇILDI" DEME', 'MÜŞTERİ YA DA CİHAZ BİLGİSİ OKUMA', 'TEKNİK YÖNLENDİRME'].every((s) => prompt.includes(s)));
t('komut metni araç cümlesini AYNEN söyletir', prompt.includes('AYNEN söyle'));
t('★ komut metnindeki araç adları tanımlarla aynı', [...A.ARAC_ADLARI, A.AKTAR_ARACI, A.BITIR_ARACI].every((a) => prompt.includes(a)));
t('komut metni 8.000 jeton altında', prompt.length / 4 < 8000, prompt.length);
const llm = A.llmGovdesi({ prompt, araclar, acilis });
t('LLM: ajan başlar, açılış sabit', llm.start_speaker === 'agent' && llm.begin_message === acilis && llm.general_tools === araclar);
t('★ komut metninde sır yok (yalnız araç başlığında)', !llm.general_prompt.includes(sir) && !llm.begin_message.includes(sir));
const ayar = A.ajanGovdesi({ webhookUrl: 'https://ornek.test/api/voice/webhook' });
t('ajan: tr-TR, 25 sn sessizlik, 12 dk tavan, İstanbul saati', ayar.language === 'tr-TR' && ayar.end_call_after_silence_ms === 25_000 && ayar.max_call_duration_ms === 720_000 && ayar.timezone === 'Europe/Istanbul');
t('★ ajan: kayıt saklama süresi var (KVKK), webhook AÇIKÇA bizim uç', ayar.data_storage_retention_days === 30 && ayar.webhook_url === 'https://ornek.test/api/voice/webhook');
t('yapay ortam sesi eklenmiyor', !('ambient_sound' in ayar));

// ── ADRES, KURULUM KAPILARI, HAZIRLIK ────────────────────────────────────
console.log('\nKurulum kapıları');
t('araç adresi: VOICE_TOOL_BASE_URL önce', A.aracTabani({ VOICE_TOOL_BASE_URL: 'https://nextusservis.com/', NEXTAUTH_URL: 'https://baska.com' }) === 'https://nextusservis.com');
t('★ http adres https\'e ÇEVRİLMEZ', A.aracTabani({ NEXTAUTH_URL: 'http://nextusservis.com' }) === null);
t('★ localhost reddedilir; sabit adrese DÜŞÜLMEZ', A.aracTabani({ NEXTAUTH_URL: 'https://localhost:3002' }) === null && A.aracTabani({}) === null);
const tamEnv = { RETELL_API_KEY: 'k', RETELL_VOICE_ID: 'v', VOICE_TOOL_SECRET: sir, VOICE_TOOL_BASE_URL: 'https://ornek.test' };
const ak = { aktarmaTelefonu: '+905321234567', hatNumarasi: '908501234567' };
t('her şey tamam → kapı açık', A.kurulumKapisi(tamEnv, ak, { yeniAjan: true, hatGerekli: true }) === null);
t('anahtar yok', A.kurulumKapisi({ ...tamEnv, RETELL_API_KEY: '' }, ak, { yeniAjan: true, hatGerekli: true }) === 'ANAHTAR_YOK');
t('adres yok', A.kurulumKapisi({ ...tamEnv, VOICE_TOOL_BASE_URL: '' }, ak, { yeniAjan: true, hatGerekli: true }) === 'ARAC_ADRESI_YOK');
t('★ kısa sır → kapalı', A.kurulumKapisi({ ...tamEnv, VOICE_TOOL_SECRET: 'kisa' }, ak, { yeniAjan: true, hatGerekli: true }) === 'SIR_YOK');
t('★ aktarma yok → kurulmaz (bot kapalıyken hattın tek yolu)', A.kurulumKapisi(tamEnv, { ...ak, aktarmaTelefonu: null }, { yeniAjan: true, hatGerekli: true }) === 'AKTARMA_YOK');
t('★ aktarma = ajan hattı → döngü, kurulmaz', A.kurulumKapisi(tamEnv, { aktarmaTelefonu: '+908501234567', hatNumarasi: '908501234567' }, { yeniAjan: false, hatGerekli: true }) === 'AKTARMA_YOK');
t('ses kimliği yalnız yeni ajanda şart', A.kurulumKapisi({ ...tamEnv, RETELL_VOICE_ID: '' }, ak, { yeniAjan: true, hatGerekli: true }) === 'SES_KIMLIGI_YOK' && A.kurulumKapisi({ ...tamEnv, RETELL_VOICE_ID: '' }, ak, { yeniAjan: false, hatGerekli: true }) === null);
t('hat yalnız bağlarken şart', A.kurulumKapisi(tamEnv, { ...ak, hatNumarasi: null }, { yeniAjan: false, hatGerekli: true }) === 'HAT_YOK' && A.kurulumKapisi(tamEnv, { ...ak, hatNumarasi: null }, { yeniAjan: false, hatGerekli: false }) === null);
const hz = A.hazirlikListesi(tamEnv, { ...ak, kurulu: true }, false);
t('★ hazırlık listesi yalnız evet/hayır taşır (sır ekrana çıkmaz)', hz.length === 8 && hz.every((h) => typeof h.tamam === 'boolean' && Object.keys(h).join() === 'kod,tamam') && !JSON.stringify(hz).includes(sir));

// ── SIR VE İMZA ──────────────────────────────────────────────────────────
console.log('\nSır ve Retell imzası');
t('★ sır tanımsız → uç kapalı', I.aracSirriGecerli('x'.repeat(20), undefined) === false && I.aracSirriGecerli('', '') === false);
t('★ kısa sır → uç kapalı (doğru gönderilse bile)', I.aracSirriGecerli('kisa', 'kisa') === false);
t('yanlış ya da eksik sır → ret', I.aracSirriGecerli(sir + 'x', sir) === false && I.aracSirriGecerli(null, sir) === false);
t('doğru sır → kabul', I.aracSirriGecerli(sir, sir) === true);
const anahtar = `test-${randomBytes(8).toString('hex')}`;
const ham = JSON.stringify(govde);
const simdi = Date.now();
const imza = I.retellImzasi(ham, anahtar, simdi);
t('geçerli imza kabul', I.retellImzasiGecerli(ham, imza, anahtar, simdi) === true);
t('★ anahtar yoksa ret (fail-closed)', I.retellImzasiGecerli(ham, imza, undefined, simdi) === false);
t('başlık yoksa ret', I.retellImzasiGecerli(ham, null, anahtar, simdi) === false);
t('yanlış anahtarla imza ret', I.retellImzasiGecerli(ham, I.retellImzasi(ham, anahtar + 'x', simdi), anahtar, simdi) === false);
t('★ gövde değiştirilirse ret', I.retellImzasiGecerli(ham.replace('284', '285'), imza, anahtar, simdi) === false);
t('★ 5 dakikadan eski imza ret (tekrar oynatma)', I.retellImzasiGecerli(ham, I.retellImzasi(ham, anahtar, simdi - 6 * 60_000), anahtar, simdi) === false);
t('4 dakikalık imza kabul', I.retellImzasiGecerli(ham, I.retellImzasi(ham, anahtar, simdi - 4 * 60_000), anahtar, simdi) === true);
t('makul ileri sapma kabul, aşırısı ret', I.retellImzasiGecerli(ham, I.retellImzasi(ham, anahtar, simdi + 30_000), anahtar, simdi) && !I.retellImzasiGecerli(ham, I.retellImzasi(ham, anahtar, simdi + 2 * 60_000), anahtar, simdi));
t('bozuk biçim ret', ['v=abc,d=00', `v=${simdi}`, `d=${imza.split('d=')[1]}`, 'merhaba'].every((h) => !I.retellImzasiGecerli(ham, h, anahtar, simdi)));
t('büyük harf özet kabul', I.retellImzasiGecerli(ham, imza.replace(/d=(.*)$/, (_, x) => `d=${x.toUpperCase()}`), anahtar, simdi) === true);

// ── EKRAN METİNLERİ ──────────────────────────────────────────────────────
console.log('\nEkran metinleri');
const anahtarlar = (o, on = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? anahtarlar(v, `${on}${k}.`) : [`${on}${k}`])).sort();
t('TR ve EN aynı anahtarlar', esit(anahtarlar(M.ajanMetniTr), anahtarlar(M.ajanMetniEn)));
t('EN metinde Türkçe harf yok', !/[ğĞıİşŞçÇöÖüÜ]/.test(JSON.stringify(M.ajanMetniEn)));
t('numara gösterimi', M.numaraGoster('5321234567') === '0532 123 45 67');

// ── KAYNAK BEKÇİSİ ───────────────────────────────────────────────────────
console.log('\nKaynak bekçisi (kurallar kodda)');
const veri = oku('src/lib/telefon-ajani-veri.ts');
const ajanDosyalari = {
  'lib/telefon-ajani.ts': oku('src/lib/telefon-ajani.ts'),
  'lib/telefon-ajani-imza.ts': oku('src/lib/telefon-ajani-imza.ts'),
  'lib/telefon-ajani-retell.ts': oku('src/lib/telefon-ajani-retell.ts'),
  'api/voice/tools': oku('src/app/api/voice/tools/route.ts'),
  'api/voice/webhook': oku('src/app/api/voice/webhook/route.ts'),
};
const FIS_YAZAN = /serviceTicket\.(create|createMany|upsert)\b|INSERT\s+INTO\s+"ServiceTicket"/;
const yazan = Object.entries(ajanDosyalari).filter(([, s]) => FIS_YAZAN.test(s)).map(([f]) => f);
t('★ ajan yolunda fiş yazan satır YOK (araçlar, uçlar, kurallar)', yazan.length === 0, yazan);
const fisYazimlari = [...veri.matchAll(/serviceTicket\.(create|createMany|upsert)\b|INSERT\s+INTO\s+"ServiceTicket"/g)];
const onayBas = veri.indexOf('export async function taslakOnayla');
const onaySon = veri.indexOf('export async function', onayBas + 10);
t('★ veri katmanında fiş yazan TEK yer taslakOnayla (bayinin tıkı)', fisYazimlari.length === 1 && fisYazimlari[0].index > onayBas && fisYazimlari[0].index < onaySon, fisYazimlari.length);
t('★ ajan medyaya dokunmaz (sayaç fotoğrafı okunmaz)', !/downloadMedia|mediaId|mediaType/.test(veri) && Object.values(ajanDosyalari).every((s) => !/downloadMedia/.test(s)));
const durumlar = [...veri.slice(veri.indexOf('export async function aracCalistir'), veri.indexOf('/** Yalnız "tanındı mı"')).matchAll(/case '(\w+)':/g)].map((x) => x[1]);
t('★ uçtaki switch = ARAC_ADLARI (uyuşmayan ad "aktarıyorum"a düşer)', esit(durumlar, [...A.ARAC_ADLARI]), durumlar);
t('★ IDOR: fiş sorgusu ServiceTicket.customerId ile (cihaz üzerinden değil)', /customerId: \{ in: m\.map/.test(veri) && !/device: \{ customerId/.test(veri));
t('★ araç ucu sırrı sorgu dizesinden almaz', !/searchParams/.test(ajanDosyalari['api/voice/tools']) && !/===\s*sir/.test(ajanDosyalari['lib/telefon-ajani-imza.ts']));
t('kiracı yalnız ajan kimliğiyle (araç yolunda numaraya bakılmaz)', /where: \{ retellAgentId: agentId \}/.test(veri) && !/hatNumarasi/.test(veri.slice(veri.indexOf('export async function aracKiracisi'), veri.indexOf('export async function aracCalistir'))));
const wh = oku('src/app/api/whatsapp/webhook/route.ts');
t('★ WhatsApp: ajan ayarı okunamazsa eski otomatik cevap çalışır', /catch \(e: any\) \{ console\.error\('\[whatsapp-webhook\] ajan ayarı okunamadı/.test(wh) && /handleAutoReply\(/.test(wh));
t('WhatsApp: cevap yalnız platform numarasına gelen mesaja', /platformNumarasina: !kendiBayisi && m\.phoneNumberId === process\.env\.WHATSAPP_PHONE_ID/.test(wh));
const sema = oku('prisma/schema.prisma');
t('★ ajan varsayılan KAPALI', /model TelefonAjani \{[\s\S]*?acik\s+Boolean\s+@default\(false\)/.test(sema));
const goc = oku('prisma/migrations/20261116100000_telefon_ajani/migration.sql');
const alterler = [...goc.matchAll(/ALTER TABLE "(\w+)"/g)].map((x) => x[1]);
t('★ göç yalnız ekler: mevcut tablolara dokunmaz, veri yazmaz', alterler.every((x) => x === 'TelefonAjani' || x === 'AjanTaslagi') && !/^\s*(DROP|UPDATE|DELETE|INSERT)\b/im.test(goc), alterler);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
