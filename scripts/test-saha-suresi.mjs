// SAHADA GEÇEN SÜRE — "Vardım / Çıktım" (lib/saha-suresi*.ts)
// Çalıştır:  node scripts/test-saha-suresi.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Teknisyen sahada, telefon yavaş, eldivenli parmak iki kez basar. İkinci
// basış ilk varış saatini EZERSE süre kısalır ve SLA raporu yalan söyler;
// başkasının işine "Vardım" basılabilirse karne başkasının adına dolar.
// Sessiz bozulmaların hepsi burada kilitli.
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

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-saha-'));
const KAYNAKLAR = ['saha-suresi', 'saha-suresi-veri', 'ticket-asama', 'sla'];
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
const ss = await al('saha-suresi');
const sv = await al('saha-suresi-veri');
const sla = await al('sla');

// ── KARAR (saf) ──────────────────────────────────────────────────────────
console.log('\nVardım / Çıktım kararı\n');
const SIMDI = new Date('2026-10-18T10:00:00Z');
const ONCE = new Date('2026-10-18T09:15:00Z');
const TEK = { id: 'tek-1', role: 'TECHNICIAN' };
const BASKA = { id: 'tek-2', role: 'TECHNICIAN' };
const YON = { id: 'yon-1', role: 'ADMIN' };
const BURO = { id: 'buro-1', role: 'FRONT_DESK' };
const fis = (ek = {}) => ({ status: 'NEW', varisAt: null, ayrilisAt: null, assignedUserId: 'tek-1', ...ek });
{
  const k = ss.sahaKarari(fis(), 'vardim', TEK, SIMDI);
  t('★ ilk "Vardım": varış = şimdi, "Yeni" fiş Serviste\'ye geçer', k.tur === 'YAZ' && k.alanlar.varisAt === SIMDI && k.serviseAl === true, k);
  t('fiş zaten serviste/parça bekliyorsa durumuna dokunulmaz', ss.sahaKarari(fis({ status: 'WAITING_FOR_PART' }), 'vardim', TEK, SIMDI).serviseAl === false);
  t('★ ikinci "Vardım" ilk saati EZMEZ (aynı)', ss.sahaKarari(fis({ varisAt: ONCE }), 'vardim', TEK, SIMDI).tur === 'AYNI');
  t('★ başkasının işine "Vardım" basılamaz', ss.sahaKarari(fis(), 'vardim', BASKA, SIMDI).kod === 'SAHA_YETKI_YOK');
  t('ön büro basamaz', ss.sahaKarari(fis(), 'vardim', BURO, SIMDI).kod === 'SAHA_YETKI_YOK');
  t('atanmamış işe teknisyen basamaz (önce işi alsın)', ss.sahaKarari(fis({ assignedUserId: null }), 'vardim', TEK, SIMDI).kod === 'SAHA_YETKI_YOK');
  t('yönetici her işte basabilir', ss.sahaKarari(fis({ assignedUserId: null }), 'vardim', YON, SIMDI).tur === 'YAZ');
  t('★ teslim edilmiş fişe geriye dönük varış yazılmaz', ss.sahaKarari(fis({ status: 'DELIVERED' }), 'vardim', TEK, SIMDI).kod === 'SAHA_FIS_KAPALI');
  t('iptal fişte hiçbir şey basılmaz', ss.sahaKarari(fis({ status: 'CANCELLED', varisAt: ONCE }), 'ciktim', TEK, SIMDI).kod === 'SAHA_FIS_KAPALI');
  t('★ "Vardım"dan önce "Çıktım" olmaz', ss.sahaKarari(fis(), 'ciktim', TEK, SIMDI).kod === 'SAHA_ONCE_VARDIM');
  const c = ss.sahaKarari(fis({ varisAt: ONCE }), 'ciktim', TEK, SIMDI);
  t('"Çıktım" çıkışı yazar', c.tur === 'YAZ' && c.alanlar.ayrilisAt === SIMDI && c.serviseAl === false, c);
  t('★ ikinci "Çıktım" ilk çıkışı EZMEZ', ss.sahaKarari(fis({ varisAt: ONCE, ayrilisAt: SIMDI }), 'ciktim', TEK, new Date('2026-10-18T11:00:00Z')).tur === 'AYNI');
  t('★ teslimden sonra "Çıktım" basılabilir (vardım → onar → teslim → çıktım)', ss.sahaKarari(fis({ status: 'DELIVERED', varisAt: ONCE }), 'ciktim', TEK, SIMDI).tur === 'YAZ');
  t('saat geriye gidemez: çıkış varıştan önce yazılmaz', ss.sahaKarari(fis({ varisAt: SIMDI }), 'ciktim', TEK, ONCE).alanlar.ayrilisAt === SIMDI);
  t('★ geri alma yalnız yönetici', ss.sahaKarari(fis({ varisAt: ONCE }), 'geriAl', TEK, SIMDI).kod === 'BU_ISLEM_ICIN_YONETICI_YETKISI');
  const g1 = ss.sahaKarari(fis({ varisAt: ONCE, ayrilisAt: SIMDI }), 'geriAl', YON, SIMDI);
  t('geri alma SON adımı siler: önce çıkış', g1.tur === 'YAZ' && g1.alanlar.ayrilisAt === null && !('varisAt' in g1.alanlar), g1);
  const g2 = ss.sahaKarari(fis({ varisAt: ONCE }), 'geriAl', YON, SIMDI);
  t('çıkış yoksa varış silinir', g2.tur === 'YAZ' && g2.alanlar.varisAt === null, g2);
  t('silinecek bir şey yoksa aynı', ss.sahaKarari(fis(), 'geriAl', YON, SIMDI).tur === 'AYNI');
  t('bilinmeyen işlem reddedilir', ss.sahaKarari(fis(), 'sil', YON, SIMDI).kod === 'GECERSIZ_ISLEM');
  t('★ süre: 09:15 → 10:00 = 45 dk; canlı sayaç şu ana kadar', ss.sahaDakikasi(ONCE, SIMDI) === 45 && ss.sahaDakikasi(ONCE, null, SIMDI) === 45 && ss.sahaDakikasi(ONCE, null) === null);
  t('bozuk kayıttan süre üretilmez (çıkış varıştan önce)', ss.sahaDakikasi(SIMDI, ONCE) === null && ss.sahaDakikasi(null, SIMDI) === null);
  t('72 dk = 1 sa 12 dk', JSON.stringify(ss.sureParcala(72)) === JSON.stringify({ saat: 1, dakika: 12 }));
}

// ── SLA: MÜDAHALE ANI = "VARDIM" ─────────────────────────────────────────
console.log('\nSLA — müdahale anı\n');
{
  const an = (s) => new Date(`2026-10-19T${s}:00+03:00`); // pazartesi, İstanbul
  const satirlar = [
    { status: 'NEW', changedAt: an('09:00'), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: an('09:05'), kaynak: 'PANEL' }, // ofis işi sabah "serviste"ye aldı
    { status: 'READY', changedAt: an('15:00'), kaynak: 'PANEL' },
  ];
  const o = sla.olaylariCikar(satirlar, an('09:00'), an('13:00'));
  t('★ "Vardım" basıldıysa müdahale anı kapıdan girilen an (13:00), durum geçişi değil (09:05)',
    o.ilkMudahale.getTime() === an('13:00').getTime() && o.mudahaleVaristan === true, o);
  const takvim = { zamanDilimi: 'Europe/Istanbul', gunler: [1, 2, 3, 4, 5], baslangicDk: 540, bitisDk: 1080, tatiller: [] };
  const olcum = sla.slaOlcumu(o, { mudahaleDk: 240, cozumDk: null, parcaDurdurur: false }, takvim, an('16:00'));
  t('★ SLA müdahalesi 240 dk ölçülüyor (5 dk değil) — 4 saat hedefi tam sınırda', olcum.mudahaleDk === 240 && olcum.mudahaleIhlal === false, olcum);
  t('"Vardım" yoksa eskisi gibi ilk IN_SERVICE', sla.olaylariCikar(satirlar, an('09:00')).ilkMudahale.getTime() === an('09:05').getTime()
    && sla.olaylariCikar(satirlar, an('09:00'), null).mudahaleVaristan === false);
  t('açılıştan önce yazılmış varış bozuk kayıt: kullanılmıyor', sla.olaylariCikar(satirlar, an('09:00'), an('08:00')).ilkMudahale.getTime() === an('09:05').getTime());
  t('çözümden sonra yazılmış varış kullanılmıyor', sla.olaylariCikar(satirlar, an('09:00'), an('16:00')).ilkMudahale.getTime() === an('09:05').getTime());
  t('kaynakta: SLA ve karne varış saatini veriyor', /f\.varisAt,\r?\n\s+\);/.test(oku('src/lib/sla-veri.ts')) && /f\.varisAt,\r?\n\s+\);/.test(oku('src/lib/teknisyen-veri.ts')));
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  t('★ konum alınmıyor (kartta ve uçta konum API\'si yok)', !/geolocation|navigator\.geo|latitude|enlem/i.test(oku('src/components/SahaKarti.tsx') + oku('src/app/api/tickets/[id]/saha/route.ts') + oku('src/lib/saha-suresi-veri.ts')));
  t('"Vardım" durum geçişi aşama geçmişine yazılıyor', /kaydetAsama\(\{[\s\S]{0,120}status: 'IN_SERVICE', oncekiStatus: 'NEW'/.test(oku('src/lib/saha-suresi-veri.ts')));
  t('fiş ekranında kart var', /<SahaKarti/.test(oku('src/app/(dashboard)/tickets/[id]/page.tsx')));
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
const ONEK = 'saha-testi-';

async function temizle() {
  const eski = await p.tenant.findMany({ where: { slug: { startsWith: ONEK } }, select: { id: true } });
  const ids = eski.map((x) => x.id);
  if (!ids.length) return;
  await p.serviceTicket.deleteMany({ where: { tenantId: { in: ids } } });
  await p.tenant.deleteMany({ where: { id: { in: ids } } });
}

// Sayaç zorunluluğu testleri de bu bayiyi kullanır (aşağıda, ayrı bölüm).
let ortak = null;

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı — Vardım / Çıktım\n');
  await temizle();
  const z = Date.now();
  const A = await p.tenant.create({ data: { name: 'Saha A', slug: `${ONEK}a-${z}` } });
  const B = await p.tenant.create({ data: { name: 'Saha B', slug: `${ONEK}b-${z}` } });
  const tek = await p.user.create({ data: { tenantId: A.id, email: `saha.tek.${z}@ornek.local`, passwordHash: 'x', name: 'Saha Usta', role: 'TECHNICIAN' } });
  const yon = await p.user.create({ data: { tenantId: A.id, email: `saha.yon.${z}@ornek.local`, passwordHash: 'x', name: 'Saha Yönetici', role: 'ADMIN' } });
  const m = await p.customer.create({ data: { tenantId: A.id, name: 'Saha Müşterisi', phone: '05321112233' } });
  const cihaz = (kiralik, harf) => p.device.create({ data: { tenantId: A.id, customerId: m.id, brand: 'Kyocera', model: 'M2040dn', serialNo: `SAHA-${harf}-${z}`, publicCode: `SAHA-${harf}-${z}`, qrTokenHash: `SAHA-${harf}-${z}-q`, isRental: kiralik } });
  const kiralik = await cihaz(true, 'K');
  const satilmis = await cihaz(false, 'S');
  let n = 0;
  const fisAc = (status = 'NEW', ek = {}) => p.serviceTicket.create({ data: { tenantId: A.id, customerId: m.id, deviceId: kiralik.id, ticketNumber: `SAHA-${z}-${++n}`, issueText: 'test', status, createdByUserId: yon.id, assignedUserId: tek.id, ...ek } });
  ortak = { A, B, tek, yon, m, kiralik, satilmis, fisAc, z };
  const kisi = (u) => ({ id: u.id, role: u.role });

  const F = await fisAc('NEW');
  t('★ başka bayi bu fişe basamaz', (await sv.sahaIslemi(B.id, F.id, kisi(tek), 'vardim')).durum === 'YOK');
  const v1 = await sv.sahaIslemi(A.id, F.id, kisi(tek), 'vardim', new Date('2026-10-18T09:15:00Z'));
  const gecmis = await p.ticketStatusHistory.findMany({ where: { ticketId: F.id } });
  t('★ "Vardım": varış yazıldı, fiş Serviste, aşama geçmişi düştü', v1.durum === 'TAMAM' && v1.degisti && v1.fis.status === 'IN_SERVICE'
    && v1.fis.varisAt?.toISOString() === '2026-10-18T09:15:00.000Z'
    && gecmis.length === 1 && gecmis[0].status === 'IN_SERVICE' && gecmis[0].oncekiStatus === 'NEW' && gecmis[0].changedByUserId === tek.id, { v1, gecmis });
  const v2 = await sv.sahaIslemi(A.id, F.id, kisi(tek), 'vardim', new Date('2026-10-18T09:40:00Z'));
  t('★ ikinci "Vardım" ilk saati değiştirmedi, geçmişe ikinci satır yazmadı', v2.durum === 'TAMAM' && !v2.degisti && v2.fis.varisAt?.toISOString() === '2026-10-18T09:15:00.000Z'
    && (await p.ticketStatusHistory.count({ where: { ticketId: F.id } })) === 1, v2);
  t('başkasının işi: 403', (await sv.sahaIslemi(A.id, F.id, { id: 'yabanci', role: 'TECHNICIAN' }, 'ciktim')).kod === 'SAHA_YETKI_YOK');
  const c1 = await sv.sahaIslemi(A.id, F.id, kisi(tek), 'ciktim', new Date('2026-10-18T10:27:00Z'));
  t('"Çıktım" yazıldı (72 dk sahada)', c1.durum === 'TAMAM' && c1.degisti && ss.sahaDakikasi(c1.fis.varisAt, c1.fis.ayrilisAt) === 72, c1);
  const c2 = await sv.sahaIslemi(A.id, F.id, kisi(tek), 'ciktim', new Date('2026-10-18T11:00:00Z'));
  t('★ ikinci "Çıktım" ilk çıkışı değiştirmedi', !c2.degisti && c2.fis.ayrilisAt?.toISOString() === '2026-10-18T10:27:00.000Z');
  t('teknisyen geri alamaz', (await sv.sahaIslemi(A.id, F.id, kisi(tek), 'geriAl')).kod === 'BU_ISLEM_ICIN_YONETICI_YETKISI');
  const ga = await sv.sahaIslemi(A.id, F.id, kisi(yon), 'geriAl');
  t('★ yönetici son basışı geri aldı: çıkış silindi, varış ve durum kaldı', ga.degisti && ga.fis.ayrilisAt === null && ga.fis.varisAt !== null && ga.fis.status === 'IN_SERVICE', ga);

  // Aynı anda iki "Vardım"
  const F2 = await fisAc('NEW');
  const [y1, y2] = await Promise.all([
    sv.sahaIslemi(A.id, F2.id, kisi(tek), 'vardim', new Date('2026-10-18T13:00:00Z')),
    sv.sahaIslemi(A.id, F2.id, kisi(yon), 'vardim', new Date('2026-10-18T13:00:05Z')),
  ]);
  t('★ aynı anda iki "Vardım": yalnız biri yazdı, tek geçmiş satırı', [y1.degisti, y2.degisti].filter(Boolean).length === 1
    && (await p.ticketStatusHistory.count({ where: { ticketId: F2.id } })) === 1, { y1, y2 });
}

// SAYAÇ ZORUNLULUĞU bölümü buraya eklenir (aynı bayi: ortak).

if (ortak) await temizle();
await p.$disconnect();
if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
