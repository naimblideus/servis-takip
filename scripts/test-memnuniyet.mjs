// MÜŞTERİ MEMNUNİYETİ — tavsiye puanı anketi (lib/memnuniyet*.ts)
// Çalıştır:  node scripts/test-memnuniyet.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bu ekran iki kişiyi ölçüyor: bayiyi (müşterisi onu tavsiye ediyor mu) ve
// teknisyeni (kimin müşterisi memnun değil). Yanlış sayı burada iki şekilde
// can yakar ve ikisi de hata vermez:
//   · Üç cevaptan çıkan "−33" bir teknisyen hakkında hüküm olur → az cevapta puan YOK.
//   · İkinci cevap birincisini ezerse, kızgın müşteri ertesi gün 10 verip
//     dünkü 2'yi silebilir; ya da biri bağlantıyı başka fişe taşır → anahtar fişe bağlı.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// Anahtar AUTH_SECRET'tan türüyor; testin kendi sırrı (gerçeği değil).
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'memnuniyet-testi-sabit-sir';

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-memnuniyet-'));
const KAYNAKLAR = ['memnuniyet', 'memnuniyet-veri', 'doc-token', 'demo-yazma'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'),
    ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'")
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'"));
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const mm = await al('memnuniyet');
const mv = await al('memnuniyet-veri');
const dt = await al('doc-token');
const dy = await al('demo-yazma');

// ── PUAN VE YORUM ────────────────────────────────────────────────────────
console.log('\nPuan ve yorum\n');
t('0 ve 10 geçerli, metin "7" de', mm.puanOku(0) === 0 && mm.puanOku(10) === 10 && mm.puanOku('7') === 7);
t('★ 11, −1, 7.5, "abc", boş, null reddediliyor (yuvarlanıp kabul edilmiyor)',
  [11, -1, 7.5, 'abc', '', null, undefined, '7.5', true].every((x) => mm.puanOku(x) === null));
t('yorum boşsa null', mm.yorumOku('   ').ok && mm.yorumOku('   ').yorum === null && mm.yorumOku(undefined).yorum === null);
t('★ 1000 karakter geçer, 1001 REDDEDİLİR (kırpılmaz)', mm.yorumOku('a'.repeat(1000)).ok === true && mm.yorumOku('a'.repeat(1001)).ok === false);
t('kontrol karakteri atılıyor, satır sonu kalıyor', mm.yorumOku('iyi\u0000\u0007 servis\r\nteşekkürler').yorum === 'iyi servis\nteşekkürler', mm.yorumOku('iyi\u0000\u0007 servis\r\nteşekkürler'));
t('metin dışı yorum reddediliyor', mm.yorumOku(42).ok === false && mm.yorumOku({}).ok === false);
t('puan sınıfları: 9–10 / 7–8 / 0–6', mm.puanSinifi(9) === 'TAVSIYE' && mm.puanSinifi(8) === 'KARARSIZ' && mm.puanSinifi(7) === 'KARARSIZ' && mm.puanSinifi(6) === 'MEMNUN_DEGIL' && mm.puanSinifi(0) === 'MEMNUN_DEGIL');
t('anket yalnız iş bitmiş fişte (teslim / hazır)', mm.anketlenebilir('DELIVERED') && mm.anketlenebilir('READY') && !mm.anketlenebilir('IN_SERVICE') && !mm.anketlenebilir('CANCELLED') && !mm.anketlenebilir(null));
t('kanal listesi', mm.kanalMi('YERINDE') && mm.kanalMi('WHATSAPP') && !mm.kanalMi('SMS') && !mm.kanalMi(null));

// ── TAVSİYE PUANI ────────────────────────────────────────────────────────
console.log('\nTavsiye puanı\n');
{
  const o = mm.tavsiyeOzeti([10, 10, 9, 8, 7, 6, 3, 10, 9, 9]);
  t('★ %60 tavsiye − %20 memnun değil = +40', o.puan === 40 && o.tavsiyeEden === 6 && o.kararsiz === 2 && o.memnunDegil === 2, o);
  t('★ "10 müşteriden 6\'sı" ve ortalama 8,1', o.onda === 6 && o.ortalama === 8.1, o);
  const az = mm.tavsiyeOzeti([10, 10, 2]);
  t(`★ ${mm.EN_AZ_CEVAP} cevabın altında puan YAYIMLANMIYOR (az cevap, n=3)`, az.puan === null && az.onda === null && az.azCevap === true && az.cevap === 3, az);
  t('hiç cevap yoksa az cevap da değil', mm.tavsiyeOzeti([]).azCevap === false && mm.tavsiyeOzeti([]).puan === null);
  t('uçlar: hepsi 10 → +100, hepsi 0 → −100', mm.tavsiyeOzeti([10, 10, 10, 10, 10]).puan === 100 && mm.tavsiyeOzeti([0, 0, 0, 0, 0]).puan === -100);
  t('eksi sıfır yazılmıyor', Object.is(mm.tavsiyeOzeti([9, 9, 0, 0, 7]).puan, 0));
  t('geçersiz puan sayılmıyor (null, 11, 7.5)', mm.tavsiyeOzeti([10, 10, 10, 10, 10, null, 11, 7.5]).cevap === 5);
  t('işaretli gösterim: +46, −12, 0', mm.isaretliPuan(46) === '+46' && mm.isaretliPuan(-12) === '−12' && mm.isaretliPuan(0) === '0');
}
{
  const simdi = new Date('2026-10-18T12:00:00Z');
  const gun = (n) => new Date(simdi.getTime() - n * 86400000);
  const a = (puan, cevapGun, gonderGun = cevapGun, teknisyenId = 'T1') => ({ puan, gonderildiAt: gun(gonderGun), cevaplandiAt: puan === null ? null : gun(cevapGun), teknisyenId });
  const liste = [
    a(10, 5), a(10, 10), a(9, 20), a(9, 30), a(3, 40),           // son 90 gün: 4 tavsiye, 1 memnun değil → +60
    a(10, 100), a(6, 110), a(5, 120), a(8, 130), a(9, 140),      // önceki 90 gün: 2 tavsiye, 2 memnun değil → 0
    a(null, 0, 3), a(null, 0, 50),                               // sorulmuş, cevapsız
    a(2, 200),                                                    // 180 günden eski: hiçbir döneme girmiyor
  ];
  const d = mm.donemKarsilastir(liste, simdi);
  t('★ son 90 gün +60, önceki 90 gün 0, fark +60', d.son.puan === 60 && d.onceki.puan === 0 && d.fark === 60, d);
  t('180 günden eski cevap iki döneme de girmiyor', d.son.cevap + d.onceki.cevap === 10);
  const r = mm.cevapOrani(liste, simdi);
  t('★ cevap oranı kohort: son 90 günde sorulan 7, cevaplanan 5 → %71', r.gonderilen === 7 && r.cevaplanan === 5 && r.yuzde === 71, r);
  t('hiç sorulmamışsa oran null (0 değil)', mm.cevapOrani([], simdi).yuzde === null);
  const d2 = mm.donemKarsilastir([a(10, 5), a(10, 6), a(10, 7), a(10, 8), a(10, 9), a(1, 100)], simdi);
  t('★ önceki dönemde az cevap varsa eğilim uydurulmuyor (fark null)', d2.son.puan === 100 && d2.onceki.puan === null && d2.fark === null, d2);

  const tek = mm.teknisyeneGore([
    a(10, 1, 1, 'IYI'), a(10, 2, 2, 'IYI'), a(9, 3, 3, 'IYI'), a(9, 4, 4, 'IYI'), a(10, 5, 5, 'IYI'),
    a(3, 1, 1, 'KOTU'), a(4, 2, 2, 'KOTU'), a(10, 3, 3, 'KOTU'), a(6, 4, 4, 'KOTU'), a(9, 5, 5, 'KOTU'),
    a(2, 1, 1, 'AZ'), a(2, 2, 2, 'AZ'),
    a(10, 1, 1, null), a(10, 2, 2, null), a(10, 3, 3, null), a(10, 4, 4, null), a(10, 5, 5, null),
  ], simdi);
  t('★ teknisyene göre: önce sorun (en düşük puan), az cevaplı sonra, atanmamış en sonda',
    JSON.stringify(tek.map((x) => x.teknisyenId)) === JSON.stringify(['KOTU', 'IYI', 'AZ', null]), tek.map((x) => [x.teknisyenId, x.ozet.puan]));
  t('★ iki cevaplı teknisyene puan yazılmıyor', tek.find((x) => x.teknisyenId === 'AZ')?.ozet.puan === null);
  t('aranacak: 0–6 ve aranmamış', mm.aranacakMi({ puan: 6, arandiAt: null }) && !mm.aranacakMi({ puan: 7, arandiAt: null })
    && !mm.aranacakMi({ puan: 2, arandiAt: new Date() }) && !mm.aranacakMi({ puan: null, arandiAt: null }));
}

// ── BAĞLANTI ANAHTARI ────────────────────────────────────────────────────
console.log('\nBağlantı anahtarı\n');
{
  const yol = mv.anketYolu('fis-123');
  const anahtar = new URL(`http://x${yol}`).searchParams.get('t');
  t('yol /anket/<fiş>?t=<40 hane>', /^\/anket\/fis-123\?t=[0-9a-f]{40}$/.test(yol), yol);
  t('★ doğru fişin anahtarı geçer', mv.anketAnahtariGecerli('fis-123', anahtar) === true);
  t('★ anahtar başka fişe taşınamaz', mv.anketAnahtariGecerli('fis-124', anahtar) === false);
  t('★ bir harfi değişmiş anahtar geçmez', mv.anketAnahtariGecerli('fis-123', anahtar.slice(0, -1) + (anahtar.endsWith('0') ? '1' : '0')) === false);
  t('boş/eksik/metin olmayan anahtar geçmez', [undefined, null, '', 'abc', 123, anahtar.slice(0, 39)].every((x) => mv.anketAnahtariGecerli('fis-123', x) === false));
  t('★ fatura bağlantısının anahtarı ankete geçmez (tür ayrı)', mv.anketAnahtariGecerli('fis-123', dt.docToken('fatura', 'fis-123')) === false);
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const uc = oku('src/app/api/public/anket/[ticketId]/route.ts');
  t('girişsiz uç: oturum aramıyor, hız sınırı IP ve fiş başına', !/auth\(\)|requireTenantUser/.test(uc) && /rateLimit\(`anket-ip:/.test(uc) && /rateLimit\(`anket-fis:/.test(uc) && /istemciIp\(req\)/.test(uc));
  t('★ ikinci cevap 200 + "ZATEN" (409 değil)', /case 'ZATEN': return NextResponse\.json\(\{ ok: true, durum: 'ZATEN' \}\)/.test(uc));
  t('★ yönetici ucu yöneticiye kilitli', /requireAdminUser\(\)/.test(oku('src/app/api/memnuniyet/[id]/route.ts')));
  t('★ pano sayfası yönetici değilse fişlere yönlendiriyor', /if \(!yoneticiMi\(user\)\) redirect\('\/tickets'\)/.test(oku('src/app/(dashboard)/memnuniyet/page.tsx')));
  t('fiş kartı yalnız teslim edilmiş fişte', /if \(ticket\.status === 'DELIVERED'\)/.test(oku('src/app/(dashboard)/tickets/[id]/page.tsx')));
  const kart = oku('src/components/MemnuniyetKarti.tsx');
  t('★ WhatsApp bir <a href=wa.me> (demoda DemoBaglantiKoruma yakalar), API yok', /<a href=\{waUrl\(musteriTelefon, mesaj\)\}/.test(kart) && !/whatsapp-out|sendWhatsapp/i.test(kart));
  t('★ müşteriye giden metin bayinin dilinde', /useMusteriDili\(\)/.test(kart) && /musteri\.sz\.memnuniyet\.waGovde/.test(kart));
  t('anket sayfası arama motorlarına kapalı', /robots: \{ index: false/.test(oku('src/app/anket/[ticketId]/page.tsx')));
  t('★ demoda "Aradım" kapalı; müşteri cevabı ve "Memnuniyet sor" açık', dy.demoYazmaYasak('PATCH', '/api/memnuniyet/x') === true
    && dy.demoYazmaYasak('POST', '/api/public/anket/x') === false && dy.demoYazmaYasak('POST', '/api/tickets/x/memnuniyet') === false);
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());
const ONEK = 'memnuniyet-testi-';

async function temizle() {
  const eski = await p.tenant.findMany({ where: { slug: { startsWith: ONEK } }, select: { id: true } });
  const ids = eski.map((x) => x.id);
  if (!ids.length) return;
  await p.serviceTicket.deleteMany({ where: { tenantId: { in: ids } } });
  await p.tenant.deleteMany({ where: { id: { in: ids } } });
}

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı\n');
  await temizle();
  const z = Date.now();
  const A = await p.tenant.create({ data: { name: 'Memnuniyet A', slug: `${ONEK}a-${z}`, locale: 'tr' } });
  const B = await p.tenant.create({ data: { name: 'Memnuniyet B', slug: `${ONEK}b-${z}`, locale: 'en' } });
  try {
    const kur = async (b, harf) => {
      const u = await p.user.create({ data: { tenantId: b.id, email: `mem.${harf}.${z}@ornek.local`, passwordHash: 'x', name: `Usta ${harf}`, role: 'TECHNICIAN' } });
      const m = await p.customer.create({ data: { tenantId: b.id, name: `Müşteri ${harf}`, phone: '05321112233' } });
      const c = await p.device.create({ data: { tenantId: b.id, customerId: m.id, brand: 'Pantum', model: 'M7100DW', serialNo: `MEM-${harf}-${z}`, publicCode: `MEM-${harf}-${z}`, qrTokenHash: `MEM-${harf}-${z}-q` } });
      let n = 0;
      const fis = (status, ek = {}) => p.serviceTicket.create({ data: { tenantId: b.id, customerId: m.id, deviceId: c.id, ticketNumber: `MEM-${harf}-${z}-${++n}`, issueText: 'test', status, createdByUserId: u.id, assignedUserId: u.id, ...ek } });
      return { u, m, c, fis };
    };
    const a = await kur(A, 'A');
    const bb = await kur(B, 'B');
    const A1 = await a.fis('DELIVERED');
    const A2 = await a.fis('IN_SERVICE');
    const A3 = await a.fis('DELIVERED', { deletedAt: new Date() });
    const A4 = await a.fis('DELIVERED');
    const A5 = await a.fis('READY');
    const B1 = await bb.fis('DELIVERED');
    const anahtar = (id) => new URL(`http://x${mv.anketYolu(id)}`).searchParams.get('t');

    // Gönderim (fiş ekranındaki kart)
    t('★ yanlış bayi: B, A\'nın fişine anket açamıyor', (await mv.anketGonder(B.id, A1.id, 'YERINDE')).durum === 'FIS_YOK');
    t('iş bitmemiş fişe anket açılmıyor', (await mv.anketGonder(A.id, A2.id, 'YERINDE')).durum === 'DURUM_UYGUN_DEGIL');
    t('çöp kutusundaki fişe anket açılmıyor', (await mv.anketGonder(A.id, A3.id, 'YERINDE')).durum === 'FIS_YOK');
    const g1 = await mv.anketGonder(A.id, A1.id, 'YERINDE');
    t('★ kart açılınca puansız "soruldu" satırı', g1.durum === 'TAMAM' && g1.anket.puan === null && g1.anket.kanal === 'YERINDE', g1);
    const g2 = await mv.anketGonder(A.id, A1.id, 'WHATSAPP');
    t('★ ikinci gönderim yeni satır açmıyor, son kanal yazılıyor', g2.anket.id === g1.anket.id && g2.anket.kanal === 'WHATSAPP'
      && (await p.memnuniyetAnketi.count({ where: { ticketId: A1.id } })) === 1);
    const satirA1 = await p.memnuniyetAnketi.findUnique({ where: { ticketId: A1.id } });
    t('satır işi yapan teknisyeni ve müşteriyi taşıyor', satirA1.teknisyenId === a.u.id && satirA1.customerId === a.m.id && satirA1.tenantId === A.id);

    // Cevap (girişsiz)
    t('★ anahtarsız/yanlış anahtar → geçersiz', (await mv.anketCevapla({ ticketId: A1.id, anahtar: 'x'.repeat(40), puan: 9 })).durum === 'GECERSIZ');
    t('★ A\'nın anahtarı B\'nin fişinde çalışmıyor', (await mv.anketCevapla({ ticketId: B1.id, anahtar: anahtar(A1.id), puan: 9 })).durum === 'GECERSIZ');
    t('puan 11 → reddedildi, satır puansız kaldı', (await mv.anketCevapla({ ticketId: A1.id, anahtar: anahtar(A1.id), puan: 11 })).durum === 'PUAN_GECERSIZ'
      && (await p.memnuniyetAnketi.findUnique({ where: { ticketId: A1.id } })).puan === null);
    t('★ 1001 karakter yorum → reddedildi', (await mv.anketCevapla({ ticketId: A1.id, anahtar: anahtar(A1.id), puan: 9, yorum: 'a'.repeat(1001) })).durum === 'YORUM_UZUN');
    const c1 = await mv.anketCevapla({ ticketId: A1.id, anahtar: anahtar(A1.id), puan: 9, yorum: '  Hızlı geldiler, teşekkürler  ' });
    const sonra = await p.memnuniyetAnketi.findUnique({ where: { ticketId: A1.id } });
    t('★ cevap yazıldı (puan, kırpılmış yorum, cevap anı), dil bayiden', c1.durum === 'KAYDEDILDI' && c1.dil === 'tr' && sonra.puan === 9 && sonra.yorum === 'Hızlı geldiler, teşekkürler' && sonra.cevaplandiAt !== null, { c1, sonra });
    const c2 = await mv.anketCevapla({ ticketId: A1.id, anahtar: anahtar(A1.id), puan: 2, yorum: 'değiştirdim' });
    const sonra2 = await p.memnuniyetAnketi.findUnique({ where: { ticketId: A1.id } });
    t('★ ikinci cevap ilkini EZMİYOR ("zaten")', c2.durum === 'ZATEN' && sonra2.puan === 9 && sonra2.yorum === 'Hızlı geldiler, teşekkürler', { c2, sonra2 });
    t('cevap verildikten sonra kart yeniden göndermiyor (satır aynı, puan duruyor)', (await mv.anketGonder(A.id, A1.id, 'YERINDE')).anket.puan === 9);
    t('iş bitmemiş fiş → kapalı', (await mv.anketCevapla({ ticketId: A2.id, anahtar: anahtar(A2.id), puan: 9 })).durum === 'KAPALI');
    t('çöp kutusundaki fiş → geçersiz', (await mv.anketCevapla({ ticketId: A3.id, anahtar: anahtar(A3.id), puan: 9 })).durum === 'GECERSIZ');
    t('hazır (READY) fişte de cevap kabul', (await mv.anketCevapla({ ticketId: A5.id, anahtar: anahtar(A5.id), puan: '8' })).durum === 'KAYDEDILDI');

    // Aynı anda iki cevap, satır yokken (bağlantı "soruldu" kaydı düşmeden ulaştı)
    const [e1, e2] = await Promise.all([
      mv.anketCevapla({ ticketId: A4.id, anahtar: anahtar(A4.id), puan: 3, yorum: 'geç geldiler' }),
      mv.anketCevapla({ ticketId: A4.id, anahtar: anahtar(A4.id), puan: 10 }),
    ]);
    const satirA4 = await p.memnuniyetAnketi.findMany({ where: { ticketId: A4.id } });
    t('★ aynı anda iki cevap: biri yazılır, öbürü "zaten"; tek satır', [e1.durum, e2.durum].sort().join() === 'KAYDEDILDI,ZATEN' && satirA4.length === 1, { e1, e2, n: satirA4.length });

    // Sayfa
    t('sayfa: cevaplanmış → teşekkür', (await mv.anketSayfasi(A1.id, anahtar(A1.id))).durum === 'CEVAPLANDI');
    t('sayfa: iş bitmemiş → kapalı', (await mv.anketSayfasi(A2.id, anahtar(A2.id))).durum === 'KAPALI');
    const acik = await mv.anketSayfasi(B1.id, anahtar(B1.id));
    t('★ sayfa: açık, bayinin adı ve dili ile', acik.durum === 'ACIK' && acik.bayi.ad === 'Memnuniyet B' && acik.bayi.dil === 'en' && acik.cihaz === 'Pantum M7100DW', acik);
    t('sayfa: anahtarsız → geçersiz', (await mv.anketSayfasi(B1.id, undefined)).durum === 'GECERSIZ');

    // Pano ve "Aradım"
    const kizgin = await a.fis('DELIVERED');
    await mv.anketGonder(A.id, kizgin.id, 'WHATSAPP');
    await mv.anketCevapla({ ticketId: kizgin.id, anahtar: anahtar(kizgin.id), puan: 4, yorum: 'toner hâlâ iz bırakıyor' });
    const pano = await mv.memnuniyetPanosu(A.id);
    t('★ pano: aranacaklar yalnız aranmamış 0–6', pano.aranacaklar.some((x) => x.ticketId === kizgin.id) && pano.aranacaklar.every((x) => x.puan <= 6), pano.aranacaklar);
    const satir = pano.aranacaklar.find((x) => x.ticketId === kizgin.id);
    t('aranacak satırında müşteri, telefon, fiş no, teknisyen', satir?.musteri === 'Müşteri A' && satir?.telefon === '05321112233' && /^MEM-A-/.test(satir?.fisNo ?? '') && satir?.teknisyen === 'Usta A', satir);
    t('son yorumlar dolu', pano.yorumlar.some((x) => x.yorum === 'Hızlı geldiler, teşekkürler'));
    // A1, A5, A4, kızgın: dört cevap, dört soru → az cevap, puan yok.
    t('★ cevap sayısı ve oran tutarlı; az cevapta puan yok', pano.donem.son.cevap === 4 && pano.donem.son.puan === null && pano.donem.son.azCevap
      && pano.oran.gonderilen === 4 && pano.oran.cevaplanan === 4, { son: pano.donem.son, oran: pano.oran });

    const kSatir = await p.memnuniyetAnketi.findUnique({ where: { ticketId: kizgin.id } });
    t('★ yanlış bayi "Aradım" diyemez', (await mv.aradimIsaretle(B.id, kSatir.id)) === 'YOK');
    const ilk = new Date('2026-10-18T09:00:00Z');
    t('"Aradım" yazılıyor', (await mv.aradimIsaretle(A.id, kSatir.id, ilk)) === 'TAMAM'
      && (await p.memnuniyetAnketi.findUnique({ where: { id: kSatir.id } })).arandiAt?.getTime() === ilk.getTime());
    t('tekrar basmak saati değiştirmiyor', (await mv.aradimIsaretle(A.id, kSatir.id, new Date())) === 'TAMAM'
      && (await p.memnuniyetAnketi.findUnique({ where: { id: kSatir.id } })).arandiAt?.getTime() === ilk.getTime());
    t('memnun müşteriye "Aradım" yazılmıyor', (await mv.aradimIsaretle(A.id, sonra.id)) === 'YOK');
    t('aranan müşteri listeden düştü', !(await mv.memnuniyetPanosu(A.id)).aranacaklar.some((x) => x.ticketId === kizgin.id));
    const panoB = await mv.memnuniyetPanosu(B.id);
    t('★ B\'nin panosunda A\'nın hiçbir satırı yok', panoB.toplam === 0 && panoB.aranacaklar.length === 0 && panoB.yorumlar.length === 0, panoB);
  } finally {
    await temizle();
  }
}
await p.$disconnect();
if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
