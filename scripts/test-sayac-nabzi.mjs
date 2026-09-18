// SAYAÇ NABZI — SAF HESAP
// Çalıştır:  node scripts/test-sayac-nabzi.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Bu kontrol bir ALARM üretiyor ve alarmın iki yönde de yanlış olması pahalı:
//
//   ÇOK ÇALARSA kimse bakmaz, gerçek arıza da görülmez. Ayda bir gönderen
//   filoya günlük eşik uygularsanız alarm her hafta çalar ve susturulur.
//   HİÇ ÇALMAZSA sayaçlar sessizce akmaz, ay sonunda faturalar eksik kesilir.
//
// Testin asıl konusu bu yüzden EŞİĞİN BAYİNİN KENDİ RİTMİNDEN çıkması ve
// hüküm verilmeyen hâller:
//   · az veriden eşik uydurulmamalı,
//   · tek bayide "köprü öldü" denmemeli, çünkü ayırt edilemez,
//   · saatlik filo ile aylık filo aynı eşiğe tabi olmamalı.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-nabiz-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sayac-nabzi.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'sayac-nabzi.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { nabizDurumu, nabizOzeti, EN_AZ_OKUMA, TABAN_SESSIZLIK_SAAT, RITIM_KATI } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SIMDI = new Date(Date.UTC(2026, 8, 18, 12, 0));
const saatOnce = (n) => new Date(SIMDI.getTime() - n * 3_600_000);

/** Düzenli gönderen bir filo: `sayi` damga, `aralik` saat arayla. */
const ritim = (aralik, sayi, sonSessizlikSaat = aralik) => {
  const out = [];
  for (let i = 0; i < sayi; i++) out.push(saatOnce(sonSessizlikSaat + i * aralik));
  return out;
};
const bayi = (damgalar, id = 'b1', ad = 'Bayi') => ({ bayiId: id, bayiAd: ad, damgalar });

console.log('\nSayaç nabzı — saf hesap\n');

// ── RİTİM YOKSA HÜKÜM YOK ────────────────────────────────────────────────
{
  const r = nabizDurumu(bayi([]), SIMDI);
  t('hiç e-posta yoksa ritim yok', r.durum === 'RITIM_YOK' && r.sessizlikSaat === null, r);
}
{
  const r = nabizDurumu(bayi(ritim(24, EN_AZ_OKUMA - 1, 500)), SIMDI);
  t('★ az veriden eşik UYDURULMUYOR', r.durum === 'RITIM_YOK' && r.esikSaat === null, r);
  t('★ ama sessizlik yine de söyleniyor', r.sessizlikSaat === 500, r.sessizlikSaat);
}
{
  const r = nabizDurumu(bayi(ritim(24, EN_AZ_OKUMA)), SIMDI);
  t('veri yeterli olunca ritim ölçülüyor', r.durum !== 'RITIM_YOK' && r.beklenenAralikSaat === 24, r);
}

{
  // ★ Gerçek veride yakalandı: demo tohumu bütün okumaları tek anda yazınca
  // ortanca aralık 0 çıkıyor ve kod yine de hüküm veriyordu. Sıfır bir tempo
  // değil, temponun hiç gözlenmemiş olmasıdır. Toplu içe aktarma ve geri
  // doldurma da aynı izi bırakır.
  const ayniAn = new Date(SIMDI.getTime() - 100 * 3_600_000);
  const r = nabizDurumu(bayi([ayniAn, ayniAn, ayniAn, ayniAn]), SIMDI);
  t('★ tek anda düşmüş damgalardan ritim ÜRETİLMİYOR',
    r.durum === 'RITIM_YOK' && r.beklenenAralikSaat === null && r.esikSaat === null, r);
  t('toplu yazımda da sessizlik yine söyleniyor', r.sessizlikSaat === 100, r.sessizlikSaat);
}

// ── EŞİK RİTİMDEN ÇIKAR ──────────────────────────────────────────────────
{
  const r = nabizDurumu(bayi(ritim(1, 10, 5)), SIMDI);
  t('★ saatlik filoda 5 saatlik sessizlik alarm değil', r.durum === 'AKIYOR', r);
  t('taban eşik uygulanıyor', r.esikSaat === TABAN_SESSIZLIK_SAAT, r.esikSaat);
}
{
  const r = nabizDurumu(bayi(ritim(1, 10, TABAN_SESSIZLIK_SAAT + 1)), SIMDI);
  t('★ saatlik filoda tabanın üstü alarm', r.durum === 'SESSIZ', r);
}
{
  const r = nabizDurumu(bayi(ritim(24, 10, 60)), SIMDI);
  t('günlük filoda 60 saat alarm değil', r.durum === 'AKIYOR' && r.esikSaat === TABAN_SESSIZLIK_SAAT, r);
}
{
  const erken = nabizDurumu(bayi(ritim(168, 6, 200)), SIMDI);
  t('★ haftalık filoda 200 saat alarm DEĞİL', erken.durum === 'AKIYOR', erken);
  t('haftalık eşik ritimden çıkıyor', erken.esikSaat === Math.round(168 * RITIM_KATI), erken.esikSaat);
  const gec = nabizDurumu(bayi(ritim(168, 6, 300)), SIMDI);
  t('haftalık filoda 300 saat alarm', gec.durum === 'SESSIZ', gec);
}
{
  // Aylık filo. Eski sabit 14 günlük eşik burada her ay yanlış alarm verirdi;
  // düzeltilen asıl şey bu.
  const erken = nabizDurumu(bayi(ritim(730, 5, 400)), SIMDI);
  t('★ aylık filoda 400 saatlik sessizlik alarm DEĞİL', erken.durum === 'AKIYOR', erken);
  t('★ sabit 14 günlük eşik burada yanlış alarm verirdi', 400 > 14 * 24);
  const gec = nabizDurumu(bayi(ritim(730, 5, 1200)), SIMDI);
  t('aylık filoda bir buçuk tur geçince alarm', gec.durum === 'SESSIZ', gec);
}

// ── ORTANCA, ORTALAMA DEĞİL ──────────────────────────────────────────────
{
  // Günlük gönderen filo ama geçmişte bir kez 30 gün ara vermiş.
  const damgalar = [saatOnce(24), saatOnce(48), saatOnce(72), saatOnce(96), saatOnce(96 + 720)];
  const r = nabizDurumu(bayi(damgalar), SIMDI);
  t('★ tek uzun boşluk eşiği kaydırmıyor', r.beklenenAralikSaat === 24, r.beklenenAralikSaat);
}

// ── KÖPRÜ MÜ, BAYİ Mİ ────────────────────────────────────────────────────
{
  const o = nabizOzeti([
    nabizDurumu(bayi(ritim(24, 5, 200), 'a', 'A'), SIMDI),
    nabizDurumu(bayi(ritim(24, 5, 200), 'b', 'B'), SIMDI),
  ]);
  t('★ ritimli bayilerin HEPSİ sessizse köprü hükmü', o.kopruOlu === true, o);
  t('en uzun sessizlik raporlanıyor', o.enUzunSessizlikSaat === 200, o);
}
{
  const o = nabizOzeti([
    nabizDurumu(bayi(ritim(24, 5, 200), 'a', 'A'), SIMDI),
    nabizDurumu(bayi(ritim(24, 5, 2), 'b', 'B'), SIMDI),
  ]);
  t('★ biri akıyorsa köprü hükmü VERİLMİYOR', o.kopruOlu === false, o);
  t('sessiz ve akan ayrı sayılıyor', o.sessiz === 1 && o.akiyor === 1, o);
}
{
  // TEK bayi sessiz: köprü mü, o bayinin cihazları mı — ayırt edilemez.
  const o = nabizOzeti([nabizDurumu(bayi(ritim(24, 5, 200), 'a', 'A'), SIMDI)]);
  t('★ tek ritimli bayide köprü hükmü verilmiyor', o.kopruOlu === false, o);
  t('ama sessizlik yine raporlanıyor', o.sessiz === 1, o);
}
{
  const o = nabizOzeti([
    nabizDurumu(bayi(ritim(24, 5, 200), 'a', 'A'), SIMDI),
    nabizDurumu(bayi(ritim(24, 5, 200), 'b', 'B'), SIMDI),
    nabizDurumu(bayi(ritim(24, 1, 5), 'c', 'C'), SIMDI),
  ]);
  t('★ ritimsiz bayi hüküm kümesine girmiyor', o.ritimli === 2 && o.ritimsiz === 1, o);
  t('köprü hükmü ritimliler üzerinden veriliyor', o.kopruOlu === true, o);
}

// ── ÖZET ─────────────────────────────────────────────────────────────────
{
  const o = nabizOzeti([]);
  t('boş özette sayı uydurulmuyor',
    o.toplam === 0 && o.kopruOlu === false && o.enUzunSessizlikSaat === null, o);
}
{
  const o = nabizOzeti([nabizDurumu(bayi(ritim(24, 5, 2)), SIMDI)]);
  t('akan bayide en uzun sessizlik null', o.enUzunSessizlikSaat === null, o);
}

// ── SIRA VE BOZUK VERİ ───────────────────────────────────────────────────
{
  const r = nabizDurumu(bayi([saatOnce(10), saatOnce(100), saatOnce(50), saatOnce(150)]), SIMDI);
  t('damgalar sırasız gelse de doğru sıralanıyor', r.sessizlikSaat === 10, r.sessizlikSaat);
}
{
  const r = nabizDurumu(bayi([saatOnce(10), new Date('bozuk'), saatOnce(60), saatOnce(110)]), SIMDI);
  t('★ bozuk tarih hesabı çökertmiyor', r.durum !== undefined && r.sessizlikSaat === 10, r);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
