// FİLO OPTİMİZASYONU — SAF HESAP
// Çalıştır:  node scripts/test-filo.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Bu ekranın çıktısı doğrudan bir MÜŞTERİ GÖRÜŞMESİNİN gündemi oluyor:
// "şu makine boşta duruyor", "şu paketi her ay aşıyorsunuz". Yanlış bir
// satır, bayiyi müşterinin karşısında yanlış bir cümle kurarken yakalar.
//
// İki kural bu yüzden testle kilitli:
//   1. SAYACI OKUNMAMIŞ cihaz "hiç basmıyor" SAYILMAZ. İkisini karıştırmak,
//      okunmayan makineyi müşterinin önüne "kullanmıyorsunuz" diye koymak.
//   2. Kullanılmayan DAHİL sayfa paraya çevrilmez; yalnız gerçekten
//      faturalanan AŞIM tutar olarak söylenir.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-filo-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/filo.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'filo.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { filoDurumu, filoOzeti, filoSira, HIC_BASMIYOR_SAYFA, AZ_KULLANIM_ORANI } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

/** Varsayılan: kiralık, 5.000 dahil siyah, ayda 4.000 basıyor → dengeli. */
const girdi = (ek = {}) => ({
  kiralik: true,
  aylikKira: 2000,
  dahilSiyah: 5000,
  dahilRenkli: 0,
  aylikSiyah: 4000,
  aylikRenkli: 0,
  renkliCihaz: false,
  asimFiyatSiyah: 0.5,
  asimFiyatRenkli: 2,
  ...ek,
});

console.log('\nFilo optimizasyonu — saf hesap\n');

// ── DENGELİ ──────────────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi());
  t('paketini makul kullanan cihaz dengeli', r.durum === 'DENGELI', r);
  t('kullanım oranı hesaplanıyor', Math.abs(r.kullanimOrani - 0.8) < 1e-9, r.kullanimOrani);
  t('dengelide aşım yok', r.asimSiyah === 0 && r.asimTutar === null, r);
}

// ── BOŞTA DURAN ──────────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi({ aylikSiyah: 0 }));
  t('★ hiç basmayan kiralık makine boşta', r.durum === 'HIC_BASMIYOR', r);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: HIC_BASMIYOR_SAYFA - 1 }));
  t('eşiğin altı da boşta sayılır', r.durum === 'HIC_BASMIYOR', r);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: HIC_BASMIYOR_SAYFA }));
  t('eşiğin kendisi boşta DEĞİL', r.durum !== 'HIC_BASMIYOR', r);
}
{
  // ★ En kritik ayrım: okuma yok ≠ hiç basmıyor.
  const r = filoDurumu(girdi({ aylikSiyah: null, aylikRenkli: null }));
  t('★ sayacı okunmamış cihaz BOŞTA sayılmıyor', r.durum === 'BILINMIYOR' && r.sebep === 'OKUMA_YOK', r);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: 0, aylikKira: 0 }));
  t('★ kirası olmayan makinenin boşta durması hüküm değil', r.durum === 'BILINMIYOR' && r.sebep === 'KIRA_YOK', r);
}
{
  // Paket tanımsız ama makine boşta: yine de söylenir, kira ödeniyor.
  const r = filoDurumu(girdi({ aylikSiyah: 0, dahilSiyah: 0 }));
  t('★ paketsiz makine de boşta duruyorsa söylenir', r.durum === 'HIC_BASMIYOR', r);
  t('paketsizde kullanım oranı yok', r.kullanimOrani === null, r.kullanimOrani);
}

// ── AŞIM ─────────────────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi({ aylikSiyah: 7000 }));
  t('★ paketi aşan cihaz işaretleniyor', r.durum === 'ASIM', r);
  t('aşan sayfa doğru', r.asimSiyah === 2000, r.asimSiyah);
  t('★ aşım tutarı birim fiyattan', r.asimTutar === 1000, r.asimTutar);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: 7000, asimFiyatSiyah: null }));
  t('★ fiyat bilinmiyorsa TUTAR ÜRETİLMİYOR', r.durum === 'ASIM' && r.asimTutar === null, r);
  t('ama aşan sayfa yine söyleniyor', r.asimSiyah === 2000, r.asimSiyah);
}
{
  // Siyah paketi artıyor, renkli paketi aşılıyor: birbirini KAPATMAZ.
  const r = filoDurumu(girdi({
    dahilSiyah: 5000, dahilRenkli: 500,
    aylikSiyah: 1000, aylikRenkli: 900,
    renkliCihaz: true,
  }));
  t('★ siyahın artanı renklinin aşımını kapatmıyor', r.durum === 'ASIM' && r.asimRenkli === 400, r);
  t('siyahta aşım yok', r.asimSiyah === 0, r.asimSiyah);
  t('aşım tutarı renkli fiyatından', r.asimTutar === 800, r.asimTutar);
}

// ── AZ KULLANIM ──────────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi({ aylikSiyah: 1000 }));
  t('★ paketin yarısından azını kullanan cihaz', r.durum === 'AZ_KULLANIM', r);
  t('kullanılmayan sayfa söyleniyor', r.kullanilmayanSayfa === 4000, r.kullanilmayanSayfa);
  t('★ kullanılmayan sayfa PARAYA ÇEVRİLMİYOR', r.asimTutar === null, r);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: 5000 * AZ_KULLANIM_ORANI }));
  t('eşiğin kendisi az kullanım DEĞİL', r.durum === 'DENGELI', r);
}
{
  const r = filoDurumu(girdi({ aylikSiyah: 1000, dahilSiyah: 0 }));
  t('★ paketi tanımsız cihazda az kullanım ÖLÇÜLMÜYOR',
    r.durum === 'BILINMIYOR' && r.sebep === 'DAHIL_SAYFA_YOK', r);
}

// ── KAPSAM DIŞI ──────────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi({ kiralik: false }));
  t('★ satılmış cihazın kira hükmü yok', r.durum === 'BILINMIYOR' && r.sebep === 'KIRALIK_DEGIL', r);
}

// ── RENKLİ GEREKSİZ ──────────────────────────────────────────────────────
{
  const r = filoDurumu(girdi({
    renkliCihaz: true, dahilRenkli: 500,
    aylikSiyah: 4000, aylikRenkli: 10,
  }));
  t('★ renkli makinede renkli basılmıyorsa işaretleniyor', r.renkliGereksiz === true, r);
}
{
  const r = filoDurumu(girdi({ renkliCihaz: true, dahilRenkli: 500, aylikSiyah: 4000, aylikRenkli: 400 }));
  t('renkli gerçekten kullanılıyorsa işaretlenmiyor', r.renkliGereksiz === false, r);
}
{
  const r = filoDurumu(girdi({ renkliCihaz: false, aylikRenkli: 0 }));
  t('★ siyah-beyaz makineye "renkli gereksiz" denmiyor', r.renkliGereksiz === false, r);
}

// ── SIRALAMA ─────────────────────────────────────────────────────────────
t('★ boşta duran en üstte', filoSira({ durum: 'HIC_BASMIYOR' }) < filoSira({ durum: 'ASIM' }));
t('aşım az kullanımdan önce', filoSira({ durum: 'ASIM' }) < filoSira({ durum: 'AZ_KULLANIM' }));
t('bilinmeyen en altta', filoSira({ durum: 'BILINMIYOR' }) > filoSira({ durum: 'DENGELI' }));

// ── ÖZET ─────────────────────────────────────────────────────────────────
{
  const liste = [
    filoDurumu(girdi({ aylikSiyah: 0 })),
    filoDurumu(girdi({ aylikSiyah: 7000 })),
    filoDurumu(girdi({ aylikSiyah: 7000, asimFiyatSiyah: null })),
    filoDurumu(girdi({ aylikSiyah: 1000 })),
    filoDurumu(girdi()),
    filoDurumu(girdi({ aylikSiyah: null, aylikRenkli: null })),
  ];
  const o = filoOzeti(liste);
  t('özet durumları sayıyor',
    o.bostaDuran === 1 && o.asimli === 2 && o.azKullanim === 1 && o.dengeli === 1 && o.bilinmeyen === 1, o);
  t('★ okuması olmayan cihaz ayrıca sayılıyor', o.okumasiz === 1, o.okumasiz);
  t('aylık aşım tutarı toplanıyor', o.aylikAsimTutari === 1000, o.aylikAsimTutari);
  t('★ tutarı hesaplanamayan aşım ayrıca sayılıyor', o.fiyatsizAsim === 1, o.fiyatsizAsim);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
