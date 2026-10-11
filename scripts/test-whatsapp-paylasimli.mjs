// WHATSAPP — PAYLAŞIMLI PLATFORM NUMARASI, ŞABLONLAR, RIZA, YÖNLENDİRME
// Çalıştır:  node scripts/test-whatsapp-paylasimli.mjs   (yerel veritabanı; gerçek Meta'ya GİTMEZ)
//
// NEDEN BU TEST
// Bütün bayilerin hatırlatmaları platformun tek numarasından gidiyor. Bu üç
// sessiz bozulmaya açık: (1) şablon değişken sayısı/sırası Meta'nınkiyle
// uyuşmazsa mesaj reddedilir — borç hatırlatması iki yerden iki ayrı biçimde
// gidiyordu; (2) her gün her fatura için mesaj = numara spam diye kısıtlanır ve
// bütün bayiler kanalı kaybeder; (3) müşterinin cevabı yanlış bayiye düşerse bir
// bayinin müşterisi başka bayiye ifşa olur. Ayrıca telefon eşleştirmesi SQL'de
// '\D' yüzünden hiç çalışmıyordu ("0532 111 22 33" kaydı tanınmıyordu).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-wa-'));
const KAYNAKLAR = ['whatsapp-sablon', 'whatsapp', 'whatsapp-inbound', 'vade-hatirlatma', 'reminders'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
// Vade işi faturaları OVERDUE'ya kendisi çeviriyor; burada yalnız gruplama ve sıklık sınanıyor.
writeFileSync(join(g, 'invoicing.js'), 'export async function markOverdueInvoices() { return 0; }\n');
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'")
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'")
    .replace(/'@prisma\/client'/g, JSON.stringify(istemci)));
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const sablon = await al('whatsapp-sablon');

// ── ŞABLON KURALLARI (saf) ───────────────────────────────────────────────
console.log('\nŞablonlar\n');
for (const [anahtar, s] of Object.entries(sablon.SABLONLAR)) {
  const yerler = [...s.metin.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const sirali = yerler.every((n, i) => n === i + 1);
  t(`${anahtar}: değişkenler sırayla ve birer kez ({{1}}..{{${yerler.length}}})`, sirali && new Set(yerler).size === yerler.length, yerler);
  t(`${anahtar}: metin değişkenle başlamıyor ve bitmiyor (Meta kuralı)`, !/^\s*\{\{/.test(s.metin) && !/\}\}\s*[.!?]?\s*$/.test(s.metin));
  t(`${anahtar}: örnek değer sayısı değişken sayısına eşit`, s.ornek.length === yerler.length);
  t(`${anahtar}: kategori UTILITY, dil tr`, s.kategori === 'UTILITY' && s.dil === 'tr');
}
t('★ borç: yardımcı değişken sayısı şablonla aynı (müşteri, bayi, tutar)', JSON.stringify(sablon.borcParametreleri('A', 'B', '1,00')) === '["A","B","1,00"]'
  && sablon.borcParametreleri('A', 'B', '1').length === [...sablon.SABLONLAR.borc.metin.matchAll(/\{\{\d+\}\}/g)].length);
t('★ sayaç: yardımcı değişken sayısı şablonla aynı (müşteri, bayi, cihaz)', JSON.stringify(sablon.sayacParametreleri('A', 'B', 3)) === '["A","B","3"]'
  && sablon.sayacParametreleri('A', 'B', 3).length === [...sablon.SABLONLAR.sayac.metin.matchAll(/\{\{\d+\}\}/g)].length);

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
t('★ bayinin toplu borç hatırlatması aynı yardımcıyla (eskiden 2 değişkenle gidiyordu)', /borcParametreleri\(/.test(oku('src/app/api/whatsapp/bulk/route.ts')) && !/params: \[r\.name, fmtTLm/.test(oku('src/app/api/whatsapp/bulk/route.ts')));
t('günlük vade işi kütüphaneden (müşteri başına, 7 günde bir)', /vadeHatirlatmalari\(\)/.test(oku('src/app/api/cron/overdue-reminders/route.ts')));
const sayacUc = oku('src/app/api/cron/sayac-hatirlatma/route.ts');
t('sayaç: aynı sıra yardımcısı, tek tek gönderilip kaydediliyor', /sayacParametreleri\(c\.name, t\.name, cihaz\)/.test(sayacUc) && /notificationLog\.create/.test(sayacUc) && !/sendBulkWhatsApp\(/.test(sayacUc));
t('★ rıza: vade ve sayaç işleri yalnız bayinin açtığı ayarla', /vadeHatirlatma: true/.test(oku('src/lib/vade-hatirlatma.ts')) && /sayacHatirlatma: true/.test(sayacUc));
t('rıza alanları varsayılan KAPALI', /vadeHatirlatma\s+Boolean\s+@default\(false\)/.test(oku('prisma/schema.prisma')) && /sayacHatirlatma\s+Boolean\s+@default\(false\)/.test(oku('prisma/schema.prisma')));
const ayar = oku('src/app/api/settings/route.ts');
t('ayarlar ucu yalnız true/false kabul ediyor', /typeof vadeHatirlatma === 'boolean'/.test(ayar) && /typeof sayacHatirlatma === 'boolean'/.test(ayar));
t('webhook paylaşımlı numarayı yönlendiriyor', /paylasimliNumaraBayisi\(m\.phoneNumberId, m\.fromPhone\)/.test(oku('src/app/api/whatsapp/webhook/route.ts')));
t('menü: platform numarası kuruluysa WhatsApp sekmesi', /paylasimliWhatsappAcik\(\)/.test(oku('src/app/(dashboard)/layout.tsx')));
const inbound = oku('src/lib/whatsapp-inbound.ts');
t("★ SQL'de '\\D' yok (Prisma şablonunda düz 'D' olur, eşleştirme hiç çalışmıyordu)", !inbound.includes("'\\D'") && inbound.includes("'[^0-9]'"));

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  // Sahte Meta: gönderilen şablonları kaydeder.
  const giden = [];
  let sonrakiHata = 0;
  const sahte = http.createServer((istek, cevap) => {
    let govde = '';
    istek.on('data', (d) => { govde += d; });
    istek.on('end', () => {
      if (sonrakiHata) { sonrakiHata--; cevap.writeHead(400, { 'content-type': 'application/json' }); cevap.end('{"error":{"message":"(#132000) Number of parameters does not match"}}'); return; }
      giden.push({ yol: istek.url, yetki: istek.headers.authorization, govde: JSON.parse(govde) });
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end('{"messages":[{"id":"wamid.test"}]}');
    });
  });
  await new Promise((r) => sahte.listen(0, '127.0.0.1', r));
  Object.assign(process.env, {
    WHATSAPP_GRAPH_KOK: `http://127.0.0.1:${sahte.address().port}`, WHATSAPP_TOKEN: 'test-jeton', WHATSAPP_PHONE_ID: 'platform-123',
    WHATSAPP_TEMPLATE: 'borc_hatirlatma', WHATSAPP_LANG: 'tr',
  });

  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const ON = 'WA Testi';
  const temizle = () => p.tenant.deleteMany({ where: { name: { startsWith: ON } } });
  await temizle();
  try {
    const bayi = (ad, ek = {}) => p.tenant.create({ data: { name: `${ON} ${ad}`, ...ek }, select: { id: true, name: true } });
    const A = await bayi('Bayi A', { vadeHatirlatma: true });
    const B = await bayi('Bayi B (kapalı)', { vadeHatirlatma: false });
    const musteri = (tenantId, ad, phone) => p.customer.create({ data: { tenantId, name: ad, phone }, select: { id: true } });
    const ma = await musteri(A.id, 'Ahmet Yılmaz', '0532 777 66 55');
    const mb = await musteri(B.id, 'Burak Kaya', '0533 888 77 66');
    const fatura = (tenantId, customerId, no, toplam, odenen = 0) => p.customerInvoice.create({ data: {
      tenantId, customerId, invoiceNumber: no, period: '2026-09', dueDate: new Date(Date.now() - 10 * 86400000),
      status: 'OVERDUE', totalAmount: toplam, paidAmount: odenen,
    } });
    await fatura(A.id, ma.id, 'WA-A-1', 1200);
    await fatura(A.id, ma.id, 'WA-A-2', 2000, 200);
    await fatura(B.id, mb.id, 'WA-B-1', 500);

    console.log('\nVade hatırlatması (veritabanı, sahte Meta)\n');
    const vade = await al('vade-hatirlatma');
    const r1 = await vade.vadeHatirlatmalari();
    const bizim = giden.filter((x) => x.govde.to === '905327776655' || x.govde.to === '905338887766');
    t('★ iki gecikmiş fatura → müşteriye TEK mesaj', bizim.filter((x) => x.govde.to === '905327776655').length === 1, bizim.map((x) => x.govde.to));
    const m1 = bizim.find((x) => x.govde.to === '905327776655');
    const deg = m1?.govde.template.components[0].parameters.map((x) => x.text);
    t('★ şablon ve değişkenler: borc_hatirlatma [müşteri, bayi, toplam açık tutar]', m1?.govde.template.name === 'borc_hatirlatma' && m1?.govde.template.language.code === 'tr'
      && JSON.stringify(deg) === JSON.stringify(['Ahmet Yılmaz', `${ON} Bayi A`, '3.000,00']), deg);
    t('platform numarasından ve jetonla', m1?.yol === '/platform-123/messages' && m1?.yetki === 'Bearer test-jeton');
    t('★ hatırlatmayı açmayan bayinin müşterisine HİÇ mesaj yok', !bizim.some((x) => x.govde.to === '905338887766'));
    const kayit = await p.notificationLog.findFirst({ where: { tenantId: A.id, channel: 'WHATSAPP' } });
    t('gönderim kaydı: SENT, fatura numaralarıyla', kayit?.status === 'SENT' && /WA-A-1, WA-A-2/.test(kayit?.message ?? '') && kayit?.sentAt !== null, kayit?.message);

    const once = giden.length;
    await vade.vadeHatirlatmalari();
    t('★ ertesi tur (7 gün dolmadan) aynı müşteriye yeni mesaj YOK', giden.length === once);
    await p.notificationLog.updateMany({ where: { tenantId: A.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    await vade.vadeHatirlatmalari();
    t('7 gün sonra yeniden hatırlatılıyor', giden.length === once + 1);

    // Meta reddederse: kayıt FAILED, aynı gün tekrar denenmez, ertesi gün denenir.
    await p.notificationLog.deleteMany({ where: { tenantId: A.id } });
    sonrakiHata = 1;
    await vade.vadeHatirlatmalari();
    const hata = await p.notificationLog.findFirst({ where: { tenantId: A.id }, orderBy: { createdAt: 'desc' } });
    t('Meta reddi → FAILED ve hata metni kayıtlı', hata?.status === 'FAILED' && /132000/.test(hata?.error ?? ''), hata?.error);
    const once2 = giden.length;
    await vade.vadeHatirlatmalari();
    t('başarısız gönderim aynı gün tekrar denenmiyor', giden.length === once2);
    await p.notificationLog.updateMany({ where: { tenantId: A.id }, data: { createdAt: new Date(Date.now() - 21 * 3600000) } });
    await vade.vadeHatirlatmalari();
    t('ertesi gün yeniden deneniyor', giden.length === once2 + 1);

    console.log('\nGelen mesaj yönlendirmesi (veritabanı)\n');
    const gelen = await al('whatsapp-inbound');
    t("★ boşluklu kayıtlı numara artık eşleşiyor (eskiden '\\D' yüzünden hiç)", (await gelen.findCustomerByPhone(A.id, '905327776655'))?.id === ma.id);
    t('★ tek bayide kayıtlı → o bayi', (await gelen.paylasimliNumaraBayisi('platform-123', '905327776655'))?.id === A.id);
    t('başka numara kimliği (bayinin kendi numarası değil, platform değil) → yok', (await gelen.paylasimliNumaraBayisi('baska-999', '905327776655')) === null);
    t('hiçbir bayide kayıtlı değil → yok', (await gelen.paylasimliNumaraBayisi('platform-123', '905009998877')) === null);
    const C = await bayi('Bayi C');
    await musteri(C.id, 'Ahmet Y.', '+90 532 777 66 55');
    t('★ iki bayide kayıtlı: en son WhatsApp GÖNDEREN bayi (A)', (await gelen.paylasimliNumaraBayisi('platform-123', '905327776655'))?.id === A.id);
    await p.notificationLog.deleteMany({ where: { tenantId: A.id } });
    t('★ iki bayide kayıtlı, ikisi de yazmamış → HİÇBİRİ (yanlış bayiye ifşa yok)', (await gelen.paylasimliNumaraBayisi('platform-123', '905327776655')) === null);
    await p.notificationLog.create({ data: { tenantId: C.id, recipient: '+90 532 777 66 55', channel: 'WHATSAPP', status: 'SENT', message: 'Sayaç hatırlatma — Ahmet Y. · 1 cihaz' } });
    t('sayaç hatırlatması gönderen bayi (C) kazanıyor', (await gelen.paylasimliNumaraBayisi('platform-123', '905327776655'))?.id === C.id);
    const D = await bayi('Bayi D demo', { demo: true });
    await musteri(D.id, 'Demo Müşteri', '0545 123 45 67');
    t('demo bayinin müşterisi yönlendirilmiyor', (await gelen.paylasimliNumaraBayisi('platform-123', '905451234567')) === null);
    t('platform numarası açık (menü)', gelen.paylasimliWhatsappAcik() === true);
  } finally {
    await temizle();
    await p.$disconnect();
    sahte.close();
  }
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
