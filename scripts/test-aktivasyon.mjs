// BUGÜN KİMİ ARAMALI — aktivasyon kuralları (saf; veritabanı ve sunucu gerekmez).
// Çalıştır:  node scripts/test-aktivasyon.mjs
//
// NEDEN BU TEST
// Toplantıdan 130+ deneme hesabı açılacak. Liste yanlış sıralarsa ekip
// denemesi bitmek üzere olan, rakamı çıkmış bayiyi değil dün açılmış hesabı
// arar; ya da hiç giriş yapmamış bayiye "paketi konuşalım" der. Kurallar
// burada sabitlenir: deneme bitiyor > değeri gördü > takıldığı adım > yeni.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'aktivasyon-'));
let k;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/aktivasyon-kural.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları ayrıca tsc ile denetleniyor */ }
  k = await import(pathToFileURL(join(g, 'aktivasyon-kural.js')).href);
} catch (e) {
  console.log('✗ derlenemedi:', e?.message);
  process.exit(1);
}

const simdi = new Date('2026-11-10T12:00:00+03:00');
const gun = (n) => new Date(simdi.getTime() - n * 86_400_000);
const sonra = (n) => new Date(simdi.getTime() + n * 86_400_000);

// ── ADIM ──
t('hiçbir şey yok → 0', k.adimBul({ girdi: false, cihaz: 0, okuma: 0, teknisyen: 0, fis: 0, odedi: false }) === 0);
t('giriş var → 1', k.adimBul({ girdi: true, cihaz: 0, okuma: 0, teknisyen: 0, fis: 0, odedi: false }) === 1);
t('cihaz var → 2', k.adimBul({ girdi: true, cihaz: 3, okuma: 0, teknisyen: 0, fis: 0, odedi: false }) === 2);
t('sayaç okuması var → 3', k.adimBul({ girdi: true, cihaz: 3, okuma: 5, teknisyen: 0, fis: 0, odedi: false }) === 3);
t('okuma + teknisyen → 4', k.adimBul({ girdi: true, cihaz: 3, okuma: 5, teknisyen: 1, fis: 0, odedi: false }) === 4);
t('okuma + fiş (teknisyensiz) → 4', k.adimBul({ girdi: true, cihaz: 3, okuma: 5, teknisyen: 0, fis: 2, odedi: false }) === 4);
t('ödedi her şeyi ezer → 5', k.adimBul({ girdi: false, cihaz: 0, okuma: 0, teknisyen: 0, fis: 0, odedi: true }) === 5);

// ── NEDEN / ÖNCELİK ──
const n = (h) => k.nedenBul({ sonHareket: null, denemeBitis: null, ...h }, simdi);
t('deneme bitiyor + rakam çıkabilir → BITIYOR_HAZIR, en önce', n({ adim: 3, acilis: gun(26), denemeBitis: sonra(4), sonHareket: gun(1) }).neden === 'BITIYOR_HAZIR' && n({ adim: 3, acilis: gun(26), denemeBitis: sonra(4) }).oncelik === 1);
t('deneme bitiyor + kurulum eksik → BITIYOR_EKSIK', n({ adim: 1, acilis: gun(26), denemeBitis: sonra(2), sonHareket: gun(1) }).neden === 'BITIYOR_EKSIK');
t('deneme bitti (negatif kalan) de "bitiyor" sayılır', n({ adim: 2, acilis: gun(35), denemeBitis: gun(3), sonHareket: gun(1) }).neden === 'BITIYOR_EKSIK');
t('değeri gördü (adım 4) → SICAK', n({ adim: 4, acilis: gun(8), denemeBitis: sonra(22), sonHareket: gun(1) }).neden === 'SICAK');
t('dün açıldı, giriş yok → GIRIS_YOK', n({ adim: 0, acilis: gun(2), denemeBitis: sonra(28) }).neden === 'GIRIS_YOK');
t('bugün açıldı → YENI (önceliği düşük, 48 saat içinde)', n({ adim: 0, acilis: new Date(simdi.getTime() - 3_600_000), denemeBitis: sonra(30) }).neden === 'YENI');
t('giriş var cihaz yok → CIHAZ_YOK', n({ adim: 1, acilis: gun(2), denemeBitis: sonra(28), sonHareket: gun(1) }).neden === 'CIHAZ_YOK');
t('cihaz var sayaç yok → SAYAC_YOK', n({ adim: 2, acilis: gun(4), denemeBitis: sonra(26), sonHareket: gun(1) }).neden === 'SAYAC_YOK');
t('okuma var ekip yok → EKIP_YOK', n({ adim: 3, acilis: gun(6), denemeBitis: sonra(24), sonHareket: gun(1) }).neden === 'EKIP_YOK');
t('6 gündür hareket yok → SESSIZ', n({ adim: 2, acilis: gun(10), denemeBitis: sonra(20), sonHareket: gun(6) }).neden === 'SESSIZ');
t('ödedi → ODEDI ve listenin sonunda', n({ adim: 5, acilis: gun(40) }).neden === 'ODEDI' && n({ adim: 5, acilis: gun(40) }).oncelik > 10);
t('sıra: bitiyor < sıcak < takılmış < yeni',
  n({ adim: 3, acilis: gun(26), denemeBitis: sonra(3) }).oncelik < n({ adim: 4, acilis: gun(8), denemeBitis: sonra(22), sonHareket: gun(1) }).oncelik &&
  n({ adim: 4, acilis: gun(8), denemeBitis: sonra(22), sonHareket: gun(1) }).oncelik < n({ adim: 1, acilis: gun(2), denemeBitis: sonra(28), sonHareket: gun(1) }).oncelik &&
  n({ adim: 1, acilis: gun(2), denemeBitis: sonra(28), sonHareket: gun(1) }).oncelik < n({ adim: 0, acilis: new Date(simdi.getTime() - 3_600_000), denemeBitis: sonra(30) }).oncelik);

// ── ETKİNLİK ADI ──
const ONEK = 'Siteden kendi kendine açıldı';
t('il + etkinlik → etkinlik adı', k.etkinlikAdi(`${ONEK} · Kütahya · Pantum Premium Partners Meeting 2026`, ONEK) === 'Pantum Premium Partners Meeting 2026');
t('ilsiz etkinlik → etkinlik adı', k.etkinlikAdi(`${ONEK} · Pantum Premium Partners Meeting 2026`, ONEK) === 'Pantum Premium Partners Meeting 2026');
t('yalnız il → etkinlik yok', k.etkinlikAdi(`${ONEK} · Afyonkarahisar`, ONEK) === null);
t('elle açılmış hesap → etkinlik yok', k.etkinlikAdi('Süper admin açtı · Pantum Premium Partners Meeting 2026', ONEK) === null);
t('boş not → etkinlik yok', k.etkinlikAdi(null, ONEK) === null);

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
