// Yanlış basma koruması (2026-11-21, Saygılı olayı) — node scripts/test-yanlis-basma.mjs
//
// Olay: Tahsilat ekranına ₺22.074,60 yerine ₺220.741,60 yazıldı ve hiç
// sorulmadan kaydedildi. Bu test üç korumayı kilitler:
//  1. Açık faturayı aşan tahsilat onaysız kaydedilmez (sunucu kuralı).
//  2. Aynı müşteriye aynı tutar 2 dakikada ikinci kez onaysız kaydedilmez.
//  3. Yeni bayi kira/sayaç faturasını ELLE başlar; ekran metinleri iki dilde var.
// Gerçek veritabanında (yerel) geçici bir bayi açar, sonunda siler.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-yanlis-'));
let koruma, tr, en;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/tahsilat-koruma.ts'),
      join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  koruma = await import(pathToFileURL(join(g, 'tahsilat-koruma.js')).href);
  ({ tr } = await import(pathToFileURL(join(g, 'i18n/tr.js')).href));
  ({ en } = await import(pathToFileURL(join(g, 'i18n/en.js')).href));
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { fazlaTutarUyarisi, tahsilatiDenetle, TahsilatKorumasi, SUPHELI_KAT } = koruma;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\n1 · FAZLA TUTAR KURALI (saf)\n');
const saygili = fazlaTutarUyarisi(220741.6, 22074.6);
t('★ Saygılı olayı: ₺220.741,60 / açık ₺22.074,60 → uyarı', saygili?.kod === 'FAZLA_TUTAR' && saygili.avans === 198667, saygili);
t('★ kat 10 → "bir hane fazla" eşiğinin üstünde', saygili?.kat === 10 && saygili.kat >= SUPHELI_KAT, saygili?.kat);
t('tam açık borç kadar → uyarı yok', fazlaTutarUyarisi(22074.6, 22074.6) === null);
t('borçtan az → uyarı yok', fazlaTutarUyarisi(1000, 22074.6) === null);
t('kuruş yuvarlaması uyarı doğurmaz', fazlaTutarUyarisi(100.004, 100) === null);
const bos = fazlaTutarUyarisi(500, 0);
t('açık fatura yokken → uyarı, kat yok (sıfıra bölme yok)', bos?.kod === 'FAZLA_TUTAR' && bos.kat === null && bos.avans === 500, bos);

console.log('\n2 · SUNUCU KURALI (yerel veritabanı)\n');
const p = new PrismaClient();
const SLUG = `yanlis-basma-testi-${Date.now()}`;
let bayiId;
const korumaKodu = async (fn) => {
  try { await fn(); return null; } catch (e) { if (e instanceof TahsilatKorumasi) return e.uyari.kod; throw e; }
};
try {
  const bayi = await p.tenant.create({ data: { name: 'Yanlış Basma Testi', slug: SLUG } });
  bayiId = bayi.id;
  const m = await p.customer.create({ data: { tenantId: bayiId, name: 'Aykut Kırtasiye', phone: '05320000000' } });
  await p.customerInvoice.create({
    data: {
      tenantId: bayiId, customerId: m.id, invoiceNumber: `YB-${Date.now()}`,
      period: "2026-11", invoiceDate: new Date(), dueDate: new Date(),
      subtotal: 18395.5, vatAmount: 3679.1, totalAmount: 22074.6, paidAmount: 0, status: 'OPEN',
    },
  });
  const denet = (ek) => p.$transaction((tx) => tahsilatiDenetle(tx, { tenantId: bayiId, customerId: m.id, ...ek }));

  t('★ fazla tutar onaysız → FAZLA_TUTAR', await korumaKodu(() => denet({ tutar: 220741.6 })) === 'FAZLA_TUTAR');
  t('fazla tutar onaylı → geçer', await korumaKodu(() => denet({ tutar: 220741.6, fazlaOnay: true })) === null);
  t('doğru tutar → geçer', await korumaKodu(() => denet({ tutar: 22074.6 })) === null);

  await p.payment.create({ data: { tenantId: bayiId, customerId: m.id, amount: 5000, method: 'TRANSFER' } });
  t('★ aynı tutar 2 dk içinde → AYNI_TAHSILAT', await korumaKodu(() => denet({ tutar: 5000 })) === 'AYNI_TAHSILAT');
  t('aynı tutar onaylı → geçer', await korumaKodu(() => denet({ tutar: 5000, tekrarOnay: true })) === null);
  t('farklı tutar → geçer', await korumaKodu(() => denet({ tutar: 5000.5 })) === null);
  const sonra = new Date(Date.now() + 3 * 60 * 1000);
  t('3 dk sonra aynı tutar → geçer (süre doldu)', await korumaKodu(() => denet({ tutar: 5000, simdi: sonra })) === null);
} finally {
  if (bayiId) await p.tenant.delete({ where: { id: bayiId } }).catch(() => {});
  await p.$disconnect();
}

console.log('\n3 · YENİ BAYİ ELLE BAŞLAR + METİNLER\n');
const yonetici = readFileSync(join(KOK, 'src/lib/tenant-manager.ts'), 'utf8');
const superAdmin = readFileSync(join(KOK, 'src/app/api/admin/tenants/route.ts'), 'utf8');
t('★ kayıt ve süper admin yolu yeni bayiyi otomatik faturasız açar',
  /autoInvoiceEnabled:\s*false/.test(yonetici) && /autoInvoiceEnabled:\s*false/.test(superAdmin));
const tahsilatAnahtar = ['fazlaBaslik', 'fazlaMetin', 'fazlaHicFatura', 'fazlaKat', 'ayniBaslik', 'ayniMetin', 'evetKaydet', 'ayniKaydet', 'duzelt'];
const muhasebeAnahtar = ['aktarYeni', 'aktarDegisen', 'aktarFaturali', 'aktarYok', 'topluNeYapar', 'fisleriAktarNe', 'kiraSayacNe'];
const faturaAnahtar = ['faturalaNe', 'ozetKesilecek', 'ozetHicYok', 'ozetTaslak', 'ozetHata'];
t('Dönem Faturala açıklama + özet metinleri iki dilde dolu', faturaAnahtar.every((k) => tr.faturalar[k] && en.faturalar[k]));
t('tahsilat uyarı metinleri iki dilde dolu', tahsilatAnahtar.every((k) => tr.tahsilat[k] && en.tahsilat[k]));
t('cariye aktar özet metinleri iki dilde dolu', muhasebeAnahtar.every((k) => tr.muhasebe[k] && en.muhasebe[k]));
const sayfa = readFileSync(join(KOK, 'src/app/(dashboard)/collections/page.tsx'), 'utf8');
t('★ tahsilat ekranında çift tıklama kilidi var', /kilit\.current/.test(sayfa));
const muh = readFileSync(join(KOK, 'src/app/(dashboard)/accounting/page.tsx'), 'utf8');
t('★ "Fişleri cariye aktar" önce özeti çeker, sonra POST', /fetch\('\/api\/tickets\/backfill-cari'\)[\s\S]{0,900}method: 'POST'/.test(muh));

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
