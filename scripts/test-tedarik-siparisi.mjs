// TEDARİKÇİ SİPARİŞİ
// Çalıştır:  node scripts/test-tedarik-siparisi.mjs
//
// NEDEN BU TEST
// Sipariş listesi paraya dokunmuyor ama bayinin toptancıya giden mesajı:
// yanlış tedarikçiye, yanlış adetle ya da kodsuz giden sipariş yanlış mal
// ve iade demek. Kurallar (hangi kalem, kimden, kaç adet) burada sabitleniyor.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-siparis-'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
// Veri katmanı cihazlardan doğan toner talebini de hesaplıyor (toner sevki):
// Sarf Takibi ile aynı hesap, onun modülleriyle birlikte derlenir.
const VERI_MODULLERI = [
  'tedarik-siparisi-veri', 'toner-veri', 'toner-sevk-veri', 'toner-sevk', 'verim-ogrenme', 'toner-verimi',
  'device-brands', 'reliability', 'fault-categories', 'stok-maliyet', 'toner', 'sayac-tarama', 'magaza-baglanti',
];
let saf, menu, veri = null;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['tedarik-siparisi', 'menu-aileleri', 'modules', ...VERI_MODULLERI].map((f) => join(KOK, `src/lib/${f}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz */ }
  writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
  const duzelt = (dosya, ciftler) => {
    const yol = join(g, dosya);
    let s = readFileSync(yol, 'utf8');
    for (const [a, b] of ciftler) s = s.split(a).join(b);
    writeFileSync(yol, s, 'utf8');
  };
  const yerel = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(istemci)],
    ...['tedarik-siparisi', ...VERI_MODULLERI].map((d) => [`'@/lib/${d}'`, `'./${d}.js'`])];
  for (const d of VERI_MODULLERI) duzelt(`${d}.js`, yerel);
  duzelt('menu-aileleri.js', [["'./modules'", "'./modules.js'"]]);
  saf = await import(pathToFileURL(join(g, 'tedarik-siparisi.js')).href);
  menu = await import(pathToFileURL(join(g, 'menu-aileleri.js')).href);
} catch (e) {
  console.log('✗ derlenemedi:', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(1);
}
const { oneriAdet, aylikKullanim, siparisGruplari, siparisMetni, tedarikciAnahtari, tahminiTutar } = saf;

console.log('\nTedarikçi siparişi — kurallar\n');
const P = (ek) => ({ id: ek.id, ad: ek.ad ?? ek.id, sku: ek.sku ?? `SKU-${ek.id}`, oemKodu: null, grup: null, stok: 0, asgari: 5, kullanim90: 0, alisVar: false, sonTedarikci: null, sonFiyat: null, ...ek });
t('aylık kullanım 90 günün ortalaması, yukarı yuvarlı', aylikKullanim(7) === 3 && aylikKullanim(6) === 2 && aylikKullanim(1) === 1 && aylikKullanim(0) === 0);
t('öneri: asgariye tamamla + aylık ortalama', oneriAdet({ stok: 1, asgari: 5, kullanim90: 7 }) === 7);
t('öneri: stok asgariye eşitse yalnız aylık kullanım', oneriAdet({ stok: 5, asgari: 5, kullanim90: 9 }) === 3);
t('öneri en az 1', oneriAdet({ stok: 5, asgari: 5, kullanim90: 0 }) === 1);
t('eksi stok (fazla düşülmüş) doğru tamamlanıyor', oneriAdet({ stok: -2, asgari: 3, kullanim90: 0 }) === 5);
{
  const { gruplar: gr, hareketsiz } = siparisGruplari([
    P({ id: 'a', ad: 'Drum DK-1150', grup: 'DRUM', stok: 1, asgari: 2, alisVar: true, sonTedarikci: 'AKSA Toner', sonFiyat: 900 }),
    P({ id: 'b', ad: 'Toner TK-1150', grup: 'TONER', stok: 0, asgari: 4, kullanim90: 18, alisVar: true, sonTedarikci: '  aksa   toner ', sonFiyat: 450, oemKodu: '1T02RV0NL0' }),
    P({ id: 'c', ad: 'Fırın ünitesi', grup: 'FUSER', stok: 0, asgari: 1, alisVar: true, sonTedarikci: 'Beta Parça', sonFiyat: 0 }),
    P({ id: 'd', ad: 'Kâğıt A4', grup: 'PAPER', stok: 50, asgari: 10, alisVar: true, sonTedarikci: 'AKSA Toner', sonFiyat: 100 }),
    P({ id: 'e', ad: 'Dişli', grup: 'GEAR', stok: 0, asgari: 1, kullanim90: 2 }),
    P({ id: 'f', ad: 'Eski mürekkep', stok: 0, asgari: 5 }),
  ]);
  const hepsi = gr.flatMap((x) => x.kalemler);
  t('★ yalnız asgari stoğun altındakiler (stoğu yeten gelmiyor)', !hepsi.some((k) => k.id === 'd') && !hareketsiz.some((k) => k.id === 'd'));
  t('★ hiç kullanılmamış ve hiç alınmamış kalem listeye GİRMİYOR, hareketsizlerde', !hepsi.some((k) => k.id === 'f') && hareketsiz.map((k) => k.id).join() === 'f');
  t('★ aynı tedarikçinin farklı yazımları tek grupta', gr[0].tedarikci === 'AKSA Toner' && gr[0].kalemler.length === 2, gr.map((x) => [x.tedarikci, x.kalemler.length]));
  t('grup içinde toner önce', gr[0].kalemler[0].id === 'b');
  t('tahmini tutar son alış fiyatıyla (10×450 + 1×900)', gr[0].tahminiTutar === 5400, gr[0].tahminiTutar);
  t('★ fiyatı bilinmeyen kalem varsa toplam söylenmiyor (eksik toplam yanlış toplamdır)', gr.find((x) => x.tedarikci === 'Beta Parça').tahminiTutar === null);
  t('★ kullanılan ama alış kaydı olmayan kalem: tedarikçi uydurulmuyor, en sonda ayrı grupta', gr[gr.length - 1].tedarikci === null && gr[gr.length - 1].kalemler.map((k) => k.id).join() === 'e');
  t('anahtar sadeleştirme', tedarikciAnahtari('  AKSA   Toner ') === tedarikciAnahtari('aksa toner') && tedarikciAnahtari('İPEK') === 'ipek');
  const hizmet = siparisGruplari([P({ id: 'i', grup: 'LABOUR', kullanim90: 5 }), P({ id: 'r', grup: 'REPAIR', alisVar: true })]);
  t('★ işçilik ve tamir kalemleri siparişe hiç girmiyor', hizmet.gruplar.length === 0 && hizmet.hareketsiz.length === 0);
  t('düzeltilen adetle tutar yeniden hesaplanıyor', tahminiTutar([{ sonFiyat: 450, adet: 2 }, { sonFiyat: 900, adet: 1 }]) === 1800 && tahminiTutar([]) === null);
}
{
  const m = siparisMetni({ selam: 'Merhaba:', kapanis: 'Teşekkürler.\nAlfa', adetEki: 'adet', kalemler: [
    { ad: 'Toner TK-1150', oemKodu: '1T02RV0NL0', sku: 'T1', adet: 10 },
    { ad: 'Drum', oemKodu: null, sku: 'D1', adet: 1 },
    { ad: 'Vazgeçilen', oemKodu: null, sku: 'X', adet: 0 },
  ] });
  t('★ mesajda üretici kodu yazıyor (toptancı adı değil kodu arar)', m.includes('• Toner TK-1150 (1T02RV0NL0) — 10 adet'));
  t('adedi 0 yapılan kalem mesaja girmiyor', !m.includes('Vazgeçilen') && m.includes('• Drum — 1 adet'));
  t('selam ve kapanış yerinde', m.startsWith('Merhaba:\n\n') && m.endsWith('\n\nTeşekkürler.\nAlfa'));
}
{
  const { hrefErisilir, aileBul } = menu;
  const e = (ek = {}) => ({ rol: 'ADMIN', ulke: 'TR', moduller: [], whatsappKurulu: false, ...ek });
  t('ekran Stok ailesinde, her pakette yöneticiye açık', aileBul('/siparis')?.anahtar === 'stok' && hrefErisilir('/siparis', e()));
  t('★ teknisyene kapalı (alış fiyatı ve tedarikçi mali veri)', !hrefErisilir('/siparis', e({ rol: 'TECHNICIAN' })));
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
else {
  try { veri = await import(pathToFileURL(join(g, 'tedarik-siparisi-veri.js')).href); }
  catch (e) { console.log('  ✗ veri katmanı derlenemedi —', e?.message); kaldi++; }
}
if (veri) {
  console.log('\nTedarikçi siparişi — veritabanı\n');
  const p = new PrismaClient();
  const SLUG = 'test-tedarik-siparisi';
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    const bayi = (await p.tenant.create({ data: { name: 'Sipariş Test', slug: SLUG }, select: { id: true } })).id;
    const parca = async (sku, ek) => (await p.part.create({ data: { tenantId: bayi, sku, name: sku, ...ek }, select: { id: true } })).id;
    const toner = await parca('TONER-1', { group: 'TONER', stockQty: 1, minStock: 5, oemCode: 'TK-1150' });
    const drum = await parca('DRUM-1', { group: 'DRUM', stockQty: 3, minStock: 2 });
    const kagit = await parca('KAGIT-1', { group: 'PAPER', stockQty: 0, minStock: 1 });
    const gun = (n) => new Date(Date.now() - n * 86400000);
    await p.partPurchase.createMany({ data: [
      { tenantId: bayi, partId: toner, quantity: 10, unitCost: 400, supplier: 'Eski Toptancı', purchasedAt: gun(90) },
      { tenantId: bayi, partId: toner, quantity: 10, unitCost: 450, supplier: 'AKSA', purchasedAt: gun(20) },
    ] });
    const musteri = (await p.customer.create({ data: { tenantId: bayi, name: 'M', phone: '5559998877' }, select: { id: true } })).id;
    const cihaz = (await p.device.create({ data: { tenantId: bayi, customerId: musteri, brand: 'K', model: 'M', serialNo: 'S-SIP-1', publicCode: 'SIP-1', qrTokenHash: 'sip-1' }, select: { id: true } })).id;
    const kullanici = (await p.user.create({ data: { tenantId: bayi, email: 'siparis-test@ornek.test', name: 'T', passwordHash: 'x', role: 'ADMIN' }, select: { id: true } })).id;
    const fis = async (n) => (await p.serviceTicket.create({ data: { tenantId: bayi, customerId: musteri, deviceId: cihaz, ticketNumber: `SIP-${n}`, createdByUserId: kullanici, issueText: 'toner' }, select: { id: true } })).id;
    const f1 = await fis(1), f2 = await fis(2);
    const dis = await parca('DISLI-1', { group: 'GEAR', stockQty: 0, minStock: 1 });
    await p.ticketPart.createMany({ data: [
      { tenantId: bayi, ticketId: f1, partId: toner, quantity: 3, unitPrice: 600, createdAt: gun(5) },
      { tenantId: bayi, ticketId: f2, partId: toner, quantity: 4, unitPrice: 600, createdAt: gun(45) },
      { tenantId: bayi, ticketId: f2, partId: toner, quantity: 10, unitPrice: 600, createdAt: gun(120) },
      { tenantId: bayi, ticketId: f1, partId: dis, quantity: 1, unitPrice: 50, createdAt: gun(10) },
    ] });
    const { siparisVerisi } = veri;
    const v = await siparisVerisi(bayi);
    const tumu = v.gruplar.flatMap((x) => x.kalemler);
    t('kritik kalem sayısı (drum stoğu yetiyor)', v.kritikSayisi === 3 && !tumu.some((k) => k.id === drum), v.kritikSayisi);
    const kt = tumu.find((k) => k.id === toner);
    t('★ tedarikçi ve fiyat EN SON alıştan (eski toptancı değil)', kt?.sonTedarikci === 'AKSA' && kt.sonFiyat === 450, kt);
    t('★ kullanım son 90 gün (120 gün önceki fiş sayılmıyor)', kt?.kullanim90 === 7, kt?.kullanim90);
    t('öneri = (5−1) + ⌈7/3⌉ = 7', kt?.oneri === 7);
    t('★ hiç kullanılmamış, hiç alınmamış kâğıt listeye girmiyor, hareketsizlerde', !tumu.some((k) => k.id === kagit) && v.hareketsiz.some((k) => k.id === kagit));
    t('kullanılan ama alınmamış dişli tedarikçisiz grupta', v.gruplar.find((x) => x.tedarikci === null)?.kalemler.some((k) => k.id === dis));
    t('başka bayinin verisi yok', (await siparisVerisi('yok-boyle-bayi')).gruplar.length === 0 && (await siparisVerisi('yok-boyle-bayi')).hareketsiz.length === 0);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.message);
  } finally {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } }).catch(() => null);
    if (eski) await p.tenant.delete({ where: { id: eski.id } }).catch(() => {});
    await p.$disconnect();
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

// ── KAYNAK VE HTTP ───────────────────────────────────────────────────────
{
  const oku = (p2) => readFileSync(join(KOK, p2), 'utf8');
  t('★ uç yalnız yönetici', /requireAdminUser\(\)/.test(oku('src/app/api/siparis/route.ts')));
  t('veri katmanı yazmıyor (sipariş kaydı tutulmuyor)', !/\.(create|update|delete|upsert)\w*\(/.test(oku('src/lib/tedarik-siparisi-veri.ts')));
  t('tedarikçiye giden metin bayinin dilinde', /useMusteriDili\(\)/.test(oku('src/app/(dashboard)/siparis/page.tsx')) && /disari\.sz\.siparis\.mesajSelam/.test(oku('src/app/(dashboard)/siparis/page.tsx')));
  const SUNUCU = process.env.TEST_SUNUCU || 'http://localhost:3002';
  const durum = async (...a) => { const r = await fetch(...a); await r.arrayBuffer().catch(() => {}); return r.status; };
  const acik = await durum(`${SUNUCU}/api/siparis`, { signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false);
  if (!acik) console.log('\n  ⊘ HTTP katmanı atlandı: sunucu kapalı');
  else t('liste oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/siparis`)) === 401);
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
