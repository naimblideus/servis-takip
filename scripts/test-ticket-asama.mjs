/**
 * Aşama çizelgesi testleri — veritabanı GEREKTİRMEZ.
 *   node scripts/test-ticket-asama.mjs
 *
 * Buradaki senaryoların çoğu ÜRETİLMİŞ değil, YAŞANMIŞ hatalardır: çekişmeli
 * denetimde bulunup düzeltilen davranışlar teste çevrildi. Bu mantık sessizce
 * bozulur — müşteri yanlış tarihe bakar, kimse fark etmez.
 */
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const gecici = mkdtempSync(join(tmpdir(), 'st-asama-test-'));
let zamanCizelgesi;
try {
  // Gerçek derleyici — elle tip silmek testi kaynağın kopyasına bakar hâle getirir.
  try {
    execFileSync(process.execPath,
      [join(kok, 'node_modules/typescript/bin/tsc'), join(kok, 'src/lib/ticket-asama.ts'),
        '--outDir', gecici, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'],
      { stdio: 'pipe' });
  } catch { /* '@/lib/prisma' çözülemez; JS çıktısı yine üretilir */ }

  // prisma yalnız kaydetAsama'da kullanılıyor; saf fonksiyonu test etmek için stub yeter.
  const js = readFileSync(join(gecici, 'ticket-asama.js'), 'utf8')
    .replace(/^import .*@\/lib\/prisma.*$/m, 'const prisma = {};');
  writeFileSync(join(gecici, 'm.mjs'), js);
  ({ zamanCizelgesi } = await import(pathToFileURL(join(gecici, 'm.mjs')).href));
} finally {
  // import tamamlandıktan sonra silinebilir
}

let gecti = 0, kaldi = 0;
const t = (ad, fn) => {
  try { fn(); console.log(`  ✓ ${ad}`); gecti++; }
  catch (e) { console.log(`  ✗ ${ad}\n      ${e.message}`); kaldi++; }
};
const esit = (a, b, m) => { if (a !== b) throw new Error(`${m ?? ''} beklenen ${b}, gelen ${a}`); };
const dogru = (v, m) => { if (!v) throw new Error(m ?? 'doğru bekleniyordu'); };

const G = (n) => new Date(`2026-08-${String(n).padStart(2, '0')}T10:00:00.000Z`);
const gun = (iso) => (iso ? Number(iso.slice(8, 10)) : null);
const adim = (c, st) => c.adimlar.find((a) => a.status === st);

console.log('\nAşama çizelgesi testleri\n');

t('normal akış: her adım kendi tarihini gösterir', () => {
  const c = zamanCizelgesi({ status: 'READY', createdAt: G(1), statusUpdatedAt: G(3) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: G(2), kaynak: 'PANEL' },
    { status: 'READY', changedAt: G(3), kaynak: 'PANEL' },
  ]);
  esit(gun(adim(c, 'NEW').zaman), 1);
  esit(gun(adim(c, 'IN_SERVICE').zaman), 2);
  esit(gun(adim(c, 'READY').zaman), 3);
  dogru(adim(c, 'READY').suan, 'READY şu anki adım olmalı');
  esit(adim(c, 'DELIVERED').zaman, null);
});

t('ŞU ANKİ adım SON varışı gösterir (aynı aşamaya ikinci giriş)', () => {
  // Yaşanmış hata: fiş Hazır'dan Serviste'ye geri alındığında müşteri ilk
  // giriş tarihini görüyor, "üç gündür serviste" sanıyordu.
  const c = zamanCizelgesi({ status: 'IN_SERVICE', createdAt: G(1), statusUpdatedAt: G(5) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: G(2), kaynak: 'PANEL' },
    { status: 'READY', changedAt: G(3), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: G(5), kaynak: 'PANEL' },
  ]);
  esit(gun(adim(c, 'IN_SERVICE').zaman), 5, 'son varış gösterilmeli —');
});

t('geri alınan adımın tarihi GÖSTERİLMEZ', () => {
  // Yaşanmış hata: Hazır'dan geri dönülünce "Hazır · 10 Ağu" duruyordu,
  // müşteri hazır sanıyordu.
  const c = zamanCizelgesi({ status: 'IN_SERVICE', createdAt: G(1), statusUpdatedAt: G(5) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'READY', changedAt: G(3), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: G(5), kaynak: 'PANEL' },
  ]);
  esit(adim(c, 'READY').zaman, null, 'ulaşılmamış adımda tarih olmamalı —');
  esit(adim(c, 'READY').tamam, false);
});

t('NEW satırı yoksa fişin açılış tarihi kullanılır', () => {
  // Yaşanmış hata: "Talebiniz alındı — tarih kayıtlı değil" yazıyordu,
  // hâlbuki açılış tarihi kartın üstünde duruyordu.
  const c = zamanCizelgesi({ status: 'READY', createdAt: G(1), statusUpdatedAt: G(4) }, [
    { status: 'READY', changedAt: G(4), kaynak: 'PANEL' },
  ]);
  esit(gun(adim(c, 'NEW').zaman), 1);
});

t('doğrudan parça beklemeye alınan fişte Serviste adımı tarihli', () => {
  const c = zamanCizelgesi({ status: 'WAITING_FOR_PART', createdAt: G(1), statusUpdatedAt: G(3) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'WAITING_FOR_PART', changedAt: G(3), kaynak: 'PANEL' },
  ]);
  esit(gun(adim(c, 'IN_SERVICE').zaman), 3, 'yan durumun tarihi kullanılmalı —');
  dogru(adim(c, 'IN_SERVICE').suan, 'yan durum Serviste adımına biner');
  esit(c.yanDurum, 'Parça bekleniyor');
});

t('geçmiş boşsa çökmez, fişin kendi tarihlerinden türetir', () => {
  const c = zamanCizelgesi({ status: 'DELIVERED', createdAt: G(1), statusUpdatedAt: G(6) }, []);
  dogru(c.turetilmis, 'türetilmiş işaretlenmeli');
  dogru(c.araAsamalarEksik, 'ara aşamalar eksik işaretlenmeli');
  esit(gun(adim(c, 'NEW').zaman), 1);
  esit(gun(adim(c, 'DELIVERED').zaman), 6);
  esit(adim(c, 'IN_SERVICE').zaman, null, 'bilinmeyen ara adım tarihsiz —');
  dogru(adim(c, 'IN_SERVICE').tamam, 'ama tamamlanmış sayılmalı');
});

t('iptal çizelgenin yerine geçer', () => {
  const c = zamanCizelgesi({ status: 'CANCELLED', createdAt: G(1), statusUpdatedAt: G(2) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'CANCELLED', changedAt: G(2), kaynak: 'PANEL' },
  ]);
  esit(c.adimlar.length, 0);
  dogru(c.iptal, 'iptal bilgisi dönmeli');
  esit(gun(c.iptal.zaman), 2);
});

t('devir kaydı içeren fiş "ara aşamalar eksik" der', () => {
  const c = zamanCizelgesi({ status: 'DELIVERED', createdAt: G(1), statusUpdatedAt: G(5) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'GECMIS' },
    { status: 'DELIVERED', changedAt: G(5), kaynak: 'GECMIS' },
  ]);
  dogru(c.araAsamalarEksik);
  esit(c.turetilmis, false, 'gerçek satır var, türetilmiş değil —');
});

t('teslim edilmiş fişte tüm adımlar tamam', () => {
  const c = zamanCizelgesi({ status: 'DELIVERED', createdAt: G(1), statusUpdatedAt: G(4) }, [
    { status: 'NEW', changedAt: G(1), kaynak: 'PANEL' },
    { status: 'IN_SERVICE', changedAt: G(2), kaynak: 'PANEL' },
    { status: 'READY', changedAt: G(3), kaynak: 'PANEL' },
    { status: 'DELIVERED', changedAt: G(4), kaynak: 'PANEL' },
  ]);
  dogru(c.adimlar.every((a) => a.tamam), 'hepsi tamam olmalı');
  esit(c.adimlar.filter((a) => a.suan).length, 1, 'tek bir şu anki adım —');
});

rmSync(gecici, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
