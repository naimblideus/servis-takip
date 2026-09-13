// GARANTİ + TEKRAR ARIZA
// Çalıştır:  node scripts/test-garanti.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// "Bu iş garanti kapsamında mı?" sorusunun yanlış cevabı iki yönlü zarar:
// kapsamdaki işi faturalarsan müşteri güvenini kaybedersin, kapsam dışı işi
// bedava yaparsan parayı. Test ettiklerim:
//
//   1. TAHMİN EDİLMEMELİ. Garanti tarihi girilmemişse cevap "bilinmiyor"
//      olmalı; kurulum tarihinden +1 yıl diye TÜRETMEK yanlış faturaya yol
//      açar (ikinci el makine, devir alınan park, uzatılmış garanti).
//   2. SINIR GÜNLER. Bitiş günü hâlâ kapsamda mı? Bir gün sonrası?
//   3. TEKRAR ARIZA yalnız KAPANMIŞ fişleri saymalı — hâlâ açık olan fiş
//      "tekrar arıza" değil, aynı arızanın devamı.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-gr-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/garanti.ts'), join(KOK, 'src/lib/sozlesme.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  const fs = await import('node:fs');
  const yol = join(g, 'garanti.js');
  fs.writeFileSync(yol, fs.readFileSync(yol, 'utf8').split("'@/lib/sozlesme'").join("'./sozlesme.js'"), 'utf8');
}
const { garantiDurumu, ucretliMi, tekrarAriza, BITIYOR_ESIGI, TEKRAR_ARIZA_GUN } =
  await import(pathToFileURL(join(g, 'garanti.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const BUGUN = new Date(2026, 8, 14); // 14.09.2026
const gun = (n) => new Date(2026, 8, 14 + n);

console.log('\n★ GARANTİ TAHMİN EDİLMİYOR\n');
{
  const r = garantiDurumu({}, BUGUN);
  t('★ tarih yoksa BİLİNMİYOR', r.durum === 'BILINMIYOR', r);
  t('★ ücret kararı verilmiyor (null)', ucretliMi(r.durum) === null, ucretliMi(r.durum));
  t('bayiye ne yapacağı söyleniyor', /cihaz kartından/i.test(r.mesaj), r.mesaj);
}
{
  // Yalnız başlangıç var, bitiş yok: "ne zaman bittiği" bilinmeden
  // kapsamda olduğu söylenemez.
  const r = garantiDurumu({ warrantyStart: gun(-400) }, BUGUN);
  t('★ yalnız başlangıç varsa yine BİLİNMİYOR', r.durum === 'BILINMIYOR', r);
}

console.log('\nKAPSAM VE SINIR GÜNLER\n');
{
  t('bitişe uzun varsa kapsamda', garantiDurumu({ warrantyEnd: gun(200) }, BUGUN).durum === 'KAPSAMDA');
  t('kapsamdayken ücret alınmıyor', ucretliMi('KAPSAMDA') === false);
  const r = garantiDurumu({ warrantyEnd: gun(0) }, BUGUN);
  t('★ bitiş GÜNÜ hâlâ kapsamda', r.durum === 'BITIYOR' && r.kalanGun === 0, r);
  t('bitiş günü ücretsiz', ucretliMi(r.durum) === false);
  const s = garantiDurumu({ warrantyEnd: gun(-1) }, BUGUN);
  t('★ bitişin ERTESİ günü kapsam dışı', s.durum === 'BITTI' && s.kalanGun === -1, s);
  t('kapsam dışıysa ücretli', ucretliMi(s.durum) === true);
  t('kaç gün önce bittiği yazıyor', /1 gün önce/.test(s.mesaj), s.mesaj);
}
{
  t(`eşik günü (${BITIYOR_ESIGI}) hâlâ "bitiyor"`,
    garantiDurumu({ warrantyEnd: gun(BITIYOR_ESIGI) }, BUGUN).durum === 'BITIYOR');
  t('eşikten bir gün fazlası normal kapsam',
    garantiDurumu({ warrantyEnd: gun(BITIYOR_ESIGI + 1) }, BUGUN).durum === 'KAPSAMDA');
}
{
  // İleri tarihli başlangıç: henüz başlamamış.
  const r = garantiDurumu({ warrantyStart: gun(10), warrantyEnd: gun(375) }, BUGUN);
  t('★ ileri tarihli başlangıç BAŞLAMADI', r.durum === 'BASLAMADI', r);
  t('başlamamışsa ücretli', ucretliMi(r.durum) === true);
}
{
  const r = garantiDurumu({ warrantyEnd: gun(100), warrantyNote: 'parça hariç, işçilik dahil' }, BUGUN);
  t('★ kapsam notu mesaja giriyor', /parça hariç/.test(r.mesaj), r.mesaj);
}
{
  // Bozuk tarih uydurma bir sonuç üretmemeli.
  t('bozuk tarih BİLİNMİYOR', garantiDurumu({ warrantyEnd: 'abc' }, BUGUN).durum === 'BILINMIYOR');
  t('boş metin BİLİNMİYOR', garantiDurumu({ warrantyEnd: '' }, BUGUN).durum === 'BILINMIYOR');
  t('metin tarih de okunuyor', garantiDurumu({ warrantyEnd: '2026-12-31' }, BUGUN).durum === 'KAPSAMDA');
}

console.log('\n★ TEKRAR ARIZA — YALNIZ KAPANMIŞ FİŞLER\n');
const fis = (ek) => ({
  id: 'x', ticketNumber: 'SF-1', issueText: 'Kağıt sıkışması',
  status: 'DELIVERED', createdAt: gun(-10), statusUpdatedAt: gun(-10), ...ek,
});
{
  t('geçmiş yoksa tekrar yok', tekrarAriza([], BUGUN).tekrar === false);
  const r = tekrarAriza([fis({ statusUpdatedAt: gun(-10) })], BUGUN);
  t('★ 10 gün önce kapanmış fiş tekrar sayılıyor', r.tekrar === true && r.gunler === 10, r);
  t('fiş numarası mesajda', /SF-1/.test(r.mesaj), r.mesaj);
}
{
  // AÇIK fiş tekrar arıza DEĞİL — aynı arızanın devamı.
  const r = tekrarAriza([fis({ status: 'IN_SERVICE' }), fis({ status: 'NEW' })], BUGUN);
  t('★ açık fişler tekrar sayılmıyor', r.tekrar === false, r);
  t('iptal edilmiş fiş de sayılmıyor', tekrarAriza([fis({ status: 'CANCELLED' })], BUGUN).tekrar === false);
}
{
  // Eşik sınırı
  t(`${TEKRAR_ARIZA_GUN} gün önce kapanmış hâlâ tekrar`,
    tekrarAriza([fis({ statusUpdatedAt: gun(-TEKRAR_ARIZA_GUN) })], BUGUN).tekrar === true);
  t('eşikten eski fiş tekrar sayılmıyor',
    tekrarAriza([fis({ statusUpdatedAt: gun(-TEKRAR_ARIZA_GUN - 1) })], BUGUN).tekrar === false);
}
{
  const r = tekrarAriza([
    fis({ id: 'a', ticketNumber: 'SF-A', statusUpdatedAt: gun(-20) }),
    fis({ id: 'b', ticketNumber: 'SF-B', statusUpdatedAt: gun(-3) }),
    fis({ id: 'c', ticketNumber: 'SF-C', statusUpdatedAt: gun(-60) }),
  ], BUGUN);
  t('eşik içindekiler sayılıyor (2)', r.adet === 2, r);
  t('★ en yeni önce sıralanıyor', r.fisler[0].ticketNumber === 'SF-B' && r.fisler[0].gunOnce === 3, r.fisler);
  t('çoklu mesaj adet veriyor', /2 kapanmış fiş/.test(r.mesaj), r.mesaj);
}
{
  // Kapanış anı boşsa açılış anına düşülmeli: o fişi görmezden gelmek
  // tekrarı kaçırmak demek.
  const r = tekrarAriza([fis({ statusUpdatedAt: null, createdAt: gun(-5) })], BUGUN);
  t('★ kapanış anı boşsa açılışa düşülüyor', r.tekrar === true && r.gunler === 5, r);
}
{
  // Gelecek tarihli kayıt (saat kayması) negatif gün üretmemeli.
  t('gelecek tarihli kayıt elenmiyor değil, güvenle atlanıyor',
    tekrarAriza([fis({ statusUpdatedAt: gun(5) })], BUGUN).tekrar === false);
  t('bozuk tarih patlatmıyor', tekrarAriza([fis({ statusUpdatedAt: 'abc', createdAt: 'abc' })], BUGUN).tekrar === false);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
