/**
 * UYGULAMA İÇİ ZAMANLAYICI.
 *
 * Aylık fatura, vade ve sayaç hatırlatması, nöbetçi ve gece demo tazelemesi
 * eskiden yalnız Coolify "Scheduled Tasks" ile çalışıyordu. Görev kurulmamışsa
 * bu özellikler canlıda hiç çalışmıyordu ve bunu gösteren bir şey yoktu.
 * Artık sunucu kendisi tetikliyor (src/instrumentation.ts başlatır).
 *
 * Her iş kendi ucunu çağırır (run-cron.mjs ile aynı yol, aynı CRON_SECRET);
 * uç dönemi sahiplenir (lib/zamanlanmis-is.ts). Coolify görevi de kuruluysa
 * ikisinden yalnız biri çalışır.
 *
 * Kaçan iş yetişir: sunucu 06:00'da kapalıydıysa fatura açılınca kesilir.
 * Sayaç hatırlatması yalnız ayın ilk günlerinde yetişir: ay ortasında
 * "sayacınızı gönderin" mesajı anlamsız olur.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { donemi, istanbul, isiSahiplen, isiBitir, TEKRARI_ZARARSIZ, type DonemTuru } from '@/lib/zamanlanmis-is';

export interface ZamanlanmisIsTanimi {
  anahtar: string;
  tur: DonemTuru;
  /** Aylık işte ayın kaçında (İstanbul). */
  gun?: number;
  /** Aylık işin yetişebileceği son gün; geçtiyse bu ay atlanır. */
  sonGun?: number;
  saat: number;
  dakika: number;
  /** Çağrılacak cron ucu; yoksa iş burada yapılır (demo). */
  yol?: string;
}

/** Saatler İstanbul saatidir. */
export const ISLER: ZamanlanmisIsTanimi[] = [
  { anahtar: 'demo', tur: 'gunluk', saat: 3, dakika: 30 },
  { anahtar: 'wa-temizlik', tur: 'gunluk', saat: 4, dakika: 0, yol: '/api/cron/whatsapp-temizlik' },
  { anahtar: 'faturalar', tur: 'aylik', gun: 1, saat: 6, dakika: 0, yol: '/api/cron/generate-customer-invoices' },
  { anahtar: 'crm-sinyal', tur: 'gunluk', saat: 8, dakika: 0, yol: '/api/cron/crm-sinyal' },
  { anahtar: 'sahip-ozet', tur: 'gunluk', saat: 8, dakika: 30, yol: '/api/cron/sahip-ozet' },
  { anahtar: 'hatirlatma', tur: 'gunluk', saat: 9, dakika: 0, yol: '/api/cron/overdue-reminders' },
  { anahtar: 'sayac', tur: 'aylik', gun: 1, sonGun: 5, saat: 10, dakika: 0, yol: '/api/cron/sayac-hatirlatma' },
  { anahtar: 'nobetci', tur: 'gunluk', saat: 10, dakika: 30, yol: '/api/cron/nobetci' },
];

/** Bu dönemde işin vakti geldi mi (İstanbul saati). */
export function vakitGeldiMi(is: ZamanlanmisIsTanimi, an = new Date()): boolean {
  const t = istanbul(an);
  const dk = t.saat * 60 + t.dakika;
  const hedef = is.saat * 60 + is.dakika;
  if (is.tur === 'gunluk') return dk >= hedef;
  const g = is.gun ?? 1;
  if (is.sonGun !== undefined && t.gun > is.sonGun) return false;
  return t.gun > g || (t.gun === g && dk >= hedef);
}

/** Herkese açık demo (giriş sayfasındaki "Demoyu dene") kurulu mu. */
/**
 * DEMO TOHUMU SÜRÜMÜ. scripts/seed-bayi-demo.mjs (ya da içe aktardığı
 * seed-demo-*.mjs dosyaları) değiştiğinde bu değer de değişir. Yeni sürüm
 * canlıya çıkınca demo, gece 03:30'u beklemeden ilk turda (açılıştan 1–6 dk
 * sonra) bir kez yeniden kurulur.
 *
 * NEDEN: yeni bir ekranın demo verisi gece tazelemesinden SONRA canlıya
 * çıkarsa ekran ertesi geceye kadar demoda boş görünür — tam da o sabah
 * gösterilecekken. Sürüm başına bir kez çalışır (ZamanlanmisIs 'demo-surum').
 */
export const DEMO_TOHUM_SURUMU = '2026-10-21-ekip-test';

/**
 * EKİP TEST HESAPLARI (scripts/seed-bayi-demo.mjs ile aynı kural): sunucuda
 * EKIP_TEST_SIFRE en az 10 karakterse EKIP_TEST_SAYI kadar (varsayılan 5, en
 * çok 20) hesap kurulur. Şifre sonradan eklenince ya da sayı değişince gece
 * 03:30'u beklemeden ilk turda bir kez kurulur (ZamanlanmisIs 'ekip-test').
 */
export function ekipTestAyari(env: NodeJS.ProcessEnv = process.env): { sayi: number; donem: string } | null {
  if ((env.EKIP_TEST_SIFRE || '').trim().length < 10) return null;
  const sayi = Math.min(20, Math.max(1, Number.parseInt(env.EKIP_TEST_SAYI || '', 10) || 5));
  return { sayi, donem: `sayi-${sayi}` };
}

async function ekipTestEksik(sayi: number): Promise<boolean> {
  const sluglar = Array.from({ length: sayi }, (_, i) => `ekip-test-${i + 1}`);
  const n = await prisma.tenant.count({ where: { ekipTest: true, demo: true, slug: { in: sluglar } } });
  return n < sayi;
}

async function genelDemoVar(): Promise<boolean> {
  const t = await prisma.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
  return Boolean(t);
}

/**
 * Demo hesaplarını baştan kurar (scripts/seed-bayi-demo.mjs, imajda var).
 * Ayrı süreçte koşar: sunucunun belleğini ve olay döngüsünü tutmaz. Betik
 * giriş bilgilerini stdout'a yazar; o çıktı kayda GEÇMEZ, yalnız hata satırı.
 */
async function demoTazele(anahtar = 'demo', donem = donemi('gunluk')): Promise<void> {
  const betik = join(process.cwd(), 'scripts', 'seed-bayi-demo.mjs');
  if (!existsSync(betik)) return;
  if (!(await isiSahiplen(anahtar, donem, 'zamanlayici'))) return;
  let hata = '';
  const kod = await new Promise<number>((tamam) => {
    const c = spawn(process.execPath, [betik], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
    c.stderr?.on('data', (d) => { hata = (hata + String(d)).slice(-600); });
    c.on('close', (k) => tamam(k ?? 1));
    c.on('error', () => tamam(1));
  });
  const son = hata.trim().split('\n').pop() ?? '';
  await isiBitir(anahtar, kod === 0 ? 'TAMAM' : 'HATA', kod === 0 ? null : `çıkış ${kod}${son ? `: ${son}` : ''}`);
  console.log(`[zamanlayıcı] demo tazeleme (${anahtar} ${donem}) ${kod === 0 ? 'tamam' : `başarısız (çıkış ${kod})`}`);
}

async function ucuCagir(is: ZamanlanmisIsTanimi): Promise<void> {
  const url = `http://127.0.0.1:${process.env.PORT || 3000}${is.yol}`;
  try {
    const r = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-zamanlayici': '1' },
      signal: AbortSignal.timeout(10 * 60_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.atlandi) console.log(`[zamanlayıcı] ${is.anahtar}: HTTP ${r.status}`);
  } catch (e) {
    console.error(`[zamanlayıcı] ${is.anahtar} çağrılamadı:`, e instanceof Error ? e.message : e);
  }
}

/** Bir tur: vakti gelmiş ve bu dönem yapılmamış işleri sırayla çalıştırır. */
export async function turAt(an = new Date()): Promise<string[]> {
  const kayit = new Map((await prisma.zamanlanmisIs.findMany()).map((k) => [k.anahtar, k]));
  const calisan: string[] = [];
  for (const is of ISLER) {
    const k = kayit.get(is.anahtar);
    const donem = donemi(is.tur, an);
    // Bu dönemde yapıldı ya da yapılıyor. Hatalı biten iş yalnız tekrarı
    // zararsızsa ve bir saat geçtiyse yeniden denenir (bkz. isiSahiplen).
    const yeniden = k?.durum === 'HATA' && TEKRARI_ZARARSIZ.has(is.anahtar) && an.getTime() - k.basladiAt.getTime() >= 3_600_000;
    if (k?.donem === donem && !yeniden) continue;
    const vakit = vakitGeldiMi(is, an) || (is.anahtar === 'demo' && !(await genelDemoVar()));
    if (!vakit) continue;
    calisan.push(is.anahtar);
    if (is.yol) await ucuCagir(is);
    else await demoTazele();
  }
  // Demo tohumu değiştiyse (yeni sürüm canlıya çıktı) bir kez yeniden kur.
  // Demo hiç yoksa yukarıdaki günlük iş zaten kuruyor; burada beklenmez.
  const surumKaydi = kayit.get('demo-surum');
  if (surumKaydi?.donem !== DEMO_TOHUM_SURUMU && !calisan.includes('demo') && (await genelDemoVar())) {
    calisan.push('demo-surum');
    await demoTazele('demo-surum', DEMO_TOHUM_SURUMU);
  }
  // Ekip test hesapları açıldı (ya da sayısı değişti) ama henüz kurulmadıysa.
  // Dönem sayıya bağlı: aynı ayarla başarısız bir kurulum her turda tekrarlanmaz.
  const ekip = ekipTestAyari();
  const tazelendi = calisan.includes('demo') || calisan.includes('demo-surum');
  if (ekip && !tazelendi && kayit.get('ekip-test')?.donem !== ekip.donem && (await ekipTestEksik(ekip.sayi))) {
    calisan.push('ekip-test');
    await demoTazele('ekip-test', ekip.donem);
  }
  return calisan;
}

const KURESEL = globalThis as unknown as { __nextusZamanlayici?: boolean };

export function zamanlayiciyiBaslat(): void {
  if (KURESEL.__nextusZamanlayici) return;
  KURESEL.__nextusZamanlayici = true;
  if (!process.env.CRON_SECRET) {
    console.warn('[zamanlayıcı] CRON_SECRET yok — zamanlanmış işler çalışmayacak.');
    return;
  }
  let mesgul = false;
  const tik = async () => {
    if (mesgul) return;
    mesgul = true;
    try { await turAt(); } catch (e) { console.error('[zamanlayıcı] tur hatası:', e instanceof Error ? e.message : e); }
    finally { mesgul = false; }
  };
  // Sunucu dinlemeye başlasın diye ilk tur bir dakika sonra.
  setTimeout(tik, 60_000).unref?.();
  setInterval(tik, 5 * 60_000).unref?.();
  console.log('[zamanlayıcı] başladı: ' + ISLER.map((i) => i.anahtar).join(', '));
}
