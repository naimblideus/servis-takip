// ÇOK DEPO VE TEKNİSYEN ARACI (lib/depo.ts, lib/depo-veri.ts)
// Çalıştır:  node scripts/test-depo.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Stok parası tek yerden kaçar: araçtaki parça hem araçta hem depoda sayılırsa
// sayım hep "fazla" çıkar, hiç sayılmazsa "kayıp". Model tek kurala dayanıyor:
// toplam stok değişmez, ana depo = toplam − araçlar. Burada o kural kilitli.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
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
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

const g = mkdtempSync(join(tmpdir(), 'st-depo-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/depo.ts'), join(KOK, 'src/lib/depo-veri.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const f of ['depo.js', 'depo-veri.js']) {
  const y = join(g, f);
  writeFileSync(y, readFileSync(y, 'utf8').replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'").replace(/'@\/lib\/depo'/g, "'./depo.js'"));
}
const kural = await import(pathToFileURL(join(g, 'depo.js')).href);
const veri = await import(pathToFileURL(join(g, 'depo-veri.js')).href);

console.log('\nKurallar\n');
t('ana depo = toplam − diğerleri', JSON.stringify(kural.anaDepoAdedi(10, 4)) === JSON.stringify({ adet: 6, eksik: 0 }));
t('toplam elle düşürülmüşse ana 0, eksik görünür', JSON.stringify(kural.anaDepoAdedi(3, 5)) === JSON.stringify({ adet: 0, eksik: 2 }));
t('araç için teknisyen şart', kural.depoGirdisi({ ad: 'Ali aracı', tur: 'ARAC' }) === 'DEPO_TEKNISYEN_GEREKLI');
t('"Ana depo" adı ayrılmış', kural.depoGirdisi({ ad: 'ana depo', tur: 'DEPO' }) === 'DEPO_AD_GECERSIZ');
t('ek depo teknisyensiz kurulur, teknisyen düşer', JSON.stringify(kural.depoGirdisi({ ad: 'Ankara', tur: 'DEPO', kullaniciId: 'x' })) === JSON.stringify({ ad: 'Ankara', tur: 'DEPO', kullaniciId: null }));
t('aynı yere aktarım yok', kural.aktarimGirdisi({ kaynak: 'ana', hedef: 'ana', partId: 'p', adet: 1 }) === 'DEPO_AYNI');
t('adet tam sayı ve ≥1', kural.aktarimGirdisi({ kaynak: 'ana', hedef: 'd', partId: 'p', adet: 1.5 }) === 'DEPO_AKTARIM_GECERSIZ' && kural.aktarimGirdisi({ kaynak: 'ana', hedef: 'd', partId: 'p', adet: 0 }) === 'DEPO_AKTARIM_GECERSIZ');
t('teknisyen yalnız kendi aracına/aracından', kural.teknisyenAktarabilir('ana', 'A', 'A') && kural.teknisyenAktarabilir('A', 'ana', 'A') && !kural.teknisyenAktarabilir('ana', 'B', 'A') && !kural.teknisyenAktarabilir('ana', 'A', null));
t('fişte: araçta yetiyorsa araç, yoksa ana', kural.fisKaynagi(3, 2) === 'ARAC' && kural.fisKaynagi(1, 2) === 'ANA' && kural.fisKaynagi(null, 1) === 'ANA');

console.log('\nKaynak\n');
{
  const rota = oku('src/app/api/tickets/[id]/parts/route.ts');
  t('fişe parça eklenirken önce teknisyenin aracı denenir', /fistenDus\(tx, user\.tenantId, part\.id, quantity, \[ticket\.assignedUserId, user\.id\]\)/.test(rota));
  t('düştüğü depo fiş parçasına yazılır', /depoId,\n/.test(rota) || /depoId,\r?\n/.test(rota));
  t('fişten çıkarılınca aynı depoya geri konur', /fiseIade\(tx, user\.tenantId, ticketPart\.depoId, ticketPart\.partId, ticketPart\.quantity\)/.test(rota));
  t('toplam stok her durumda düşer', /stockQty: \{ decrement: quantity \}/.test(rota));
  t('demoda depo yazmaları kapalı', /'\/api\/depolar'/.test(oku('src/lib/demo-yazma.ts')));
}

console.log('\nVeritabanı\n');
let p = null, tid = null;
try {
  const env = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) || '';
  const url = process.env.DATABASE_URL || env.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^"|"$/g, '');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('ATLA');
  process.env.DATABASE_URL = url;
  const { PrismaClient } = require('@prisma/client');
  p = new PrismaClient();
  const SLUG = 'test-depo';
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  const bayi = await p.tenant.create({ data: { name: 'Depo Testi', slug: SLUG, users: { create: [{ email: 'a@depo.test', passwordHash: 'x', name: 'Ali', role: 'TECHNICIAN' }, { email: 'b@depo.test', passwordHash: 'x', name: 'Banu', role: 'TECHNICIAN' }] } }, include: { users: true } });
  tid = bayi.id;
  const [ali, banu] = bayi.users.sort((x, y) => x.name.localeCompare(y.name));
  const parca = await p.part.create({ data: { tenantId: tid, sku: 'DR-1', name: 'Drum Unit', stockQty: 10, avgCost: 100 } });
  const aliArac = await p.depo.create({ data: { tenantId: tid, ad: 'Ali aracı', tur: 'ARAC', kullaniciId: ali.id } });
  const sube = await p.depo.create({ data: { tenantId: tid, ad: 'Ankara', tur: 'DEPO' } });

  let s = await veri.aktar(tid, { kaynak: 'ana', hedef: aliArac.id, partId: parca.id, adet: 4 });
  t('ana → araç 4: tamam, anada 6 kaldı', s.ok && s.kaynakKalan === 6, s);
  let o = await veri.depoOzeti(tid, true);
  t('özet: ana 6, araç 4, toplam stok değişmedi', o.ana.adet === 6 && o.depolar.find((d) => d.id === aliArac.id).adet === 4 && (await p.part.findUnique({ where: { id: parca.id } })).stockQty === 10, o);
  t('değer yalnız istenince: araç ₺400', o.depolar.find((d) => d.id === aliArac.id).deger === 400 && (await veri.depoOzeti(tid, false)).ana.deger === null);
  s = await veri.aktar(tid, { kaynak: 'ana', hedef: sube.id, partId: parca.id, adet: 7 });
  t('anada olmayan kadar aktarılamaz', !s.ok && s.hata === 'DEPO_YETERSIZ' && s.deger.p2 === 6, s);
  s = await veri.aktar(tid, { kaynak: aliArac.id, hedef: sube.id, partId: parca.id, adet: 1 });
  t('araç → şube 1', s.ok && s.kaynakKalan === 3, s);

  // Aynı anda iki aktarım son parçalar için yarışır: toplam 6'dan fazlası çıkamaz.
  const yaris = await Promise.all([1, 2, 3].map(() => veri.aktar(tid, { kaynak: 'ana', hedef: aliArac.id, partId: parca.id, adet: 3 })));
  t('★ yarış: anadaki 6 için üç kez 3 → yalnız ikisi geçer', yaris.filter((r) => r.ok).length === 2, yaris);
  o = await veri.depoOzeti(tid, false);
  t('yarış sonrası ana 0, araç 9', o.ana.adet === 0 && o.depolar.find((d) => d.id === aliArac.id).adet === 9, o);

  // Fiş: Ali'nin fişi, Banu ekliyor → önce Ali'nin aracı.
  const dus = await p.$transaction((tx) => veri.fistenDus(tx, tid, parca.id, 2, [ali.id, banu.id]));
  t('★ fişte parça fişin teknisyeninin aracından düşer', dus === aliArac.id);
  const dusYok = await p.$transaction((tx) => veri.fistenDus(tx, tid, parca.id, 50, [ali.id]));
  t('araçta yetmiyorsa null (ana depodan)', dusYok === null);
  const dusBanu = await p.$transaction((tx) => veri.fistenDus(tx, tid, parca.id, 1, [banu.id]));
  t('aracı olmayan teknisyende null', dusBanu === null);
  await p.$transaction((tx) => veri.fiseIade(tx, tid, aliArac.id, parca.id, 2));
  o = await veri.depoOzeti(tid, false);
  t('fişten çıkarılınca araca geri döner (9)', o.depolar.find((d) => d.id === aliArac.id).adet === 9, o);

  await p.depo.update({ where: { id: aliArac.id }, data: { aktif: false } });
  t('pasif araçtan fişte düşülmez', (await p.$transaction((tx) => veri.fistenDus(tx, tid, parca.id, 1, [ali.id]))) === null);
  t('pasif araca aktarım yapılmaz', (await veri.aktar(tid, { kaynak: sube.id, hedef: aliArac.id, partId: parca.id, adet: 1 })).hata === 'DEPO_YOK');
  const kalemler = await veri.depoKalemleri(tid, sube.id, false);
  t('depo kalemleri: şubede 1 Drum Unit', kalemler.length === 1 && kalemler[0].adet === 1 && kalemler[0].birimMaliyet === null, kalemler);
  t('başka bayinin deposu okunamaz', (await veri.depoKalemleri('baska-bayi', sube.id, false)) === null);
} catch (e) {
  if (e.message === 'ATLA') console.log('  ⊘ veritabanı kısmı atlandı: yerel veritabanı yok');
  else { kaldi++; console.log('  ✗ veritabanı testi çöktü —', e); }
} finally {
  if (p && tid) await p.tenant.delete({ where: { id: tid } }).catch(() => {});
  if (p) await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
