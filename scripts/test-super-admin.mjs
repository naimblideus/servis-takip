// SÜPER ADMİN KONSOLU — dil bütünlüğü ve paket adları
// Çalıştır:  node scripts/test-super-admin.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
//
// 1. YARIM ÇEVİRİ. Bu ekranlar platformun kendi konsolu; ekibe İngilizce
//    konuşan biri katıldığında panelin yarısı Türkçe kalırsa iş göremez.
//    Ekrana gömülü tek bir Türkçe cümle testi kırar.
//
// 2. NÖBETÇİ KODLARI İLE SÖZLÜK AYRIŞMASI. Sistem durumu artık KOD dönüyor,
//    cümleyi sözlük kuruyor. Yeni bir kontrol eklenip sözlüğe yazılmazsa
//    ekranda BOŞ satır kalır — hiçbir yerde hata çıkmaz, sadece arıza
//    görünmez olur. Nöbetçinin kendisi sessizce kör olur.
//
// 3. PAKET ADI UYUŞMAZLIĞI — bu gerçekten yaşandı. Panel içindeki eski süper
//    admin ekranı kendi listesini taşıyordu: starter / standard / pro.
//    "standard" ve "pro" modules.ts'te yok; PLAN_MODULES[plan] boş kümeye
//    düşüyor ve o bayinin BÜTÜN eklenti modülleri (faturalama, rota, takip,
//    kaçan gelir, raporlar, pazar, müşteri paneli, mağaza) sessizce
//    kapanıyordu. Paket adları tek kaynaktan gelmek zorunda.
//
// 4. İÇ İÇE <html>. (super-admin) yerleşimi kendi <html><body> çiftini
//    açıyordu; kök yerleşim zaten bir tane açtığı için tarayıcı ikincisini
//    atıyor ve oradaki lang sessizce yok sayılıyordu — dil seçimi bu
//    ekranlarda hiç çalışmıyordu.
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

const g = mkdtempSync(join(tmpdir(), 'st-sa-'));
let sozlukMod, nobetciMetin;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/nobetci-metin.ts'), join(KOK, 'src/lib/yedek-metin.ts'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
  // tsc uzantısız bırakıyor; Node ESM uzantı ister.
  for (const [d, ...cift] of [
    ['i18n/sozluk.js', ["from './tr'", "from './tr.js'"], ["from './en'", "from './en.js'"]],
    ['nobetci-metin.js', ["from './i18n/sozluk'", "from './i18n/sozluk.js'"]],
    ['yedek-metin.js', ["from './i18n/sozluk'", "from './i18n/sozluk.js'"]],
  ]) {
    const yol = join(g, d);
    let icerik = readFileSync(yol, 'utf8');
    for (const [a, b] of cift) icerik = icerik.replace(a, b);
    writeFileSync(yol, icerik, 'utf8');
  }
  sozlukMod = await import(pathToFileURL(join(g, 'i18n/sozluk.js')).href);
  nobetciMetin = await import(pathToFileURL(join(g, 'nobetci-metin.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { sozluk } = sozlukMod;
const { kontrolAdi, kontrolMesaji, kontrolNedeni, nobetciOzeti } = nobetciMetin;
const DILLER = [['tr', sozluk('tr')], ['en', sozluk('en')]];

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const oku = (p) => readFileSync(join(KOK, p), 'utf8');

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ EKRANLARDA GÖMÜLÜ TÜRKÇE YOK');
// ───────────────────────────────────────────────────────────────────────────
/** Yorum satırlarını at: geliştirici notu Türkçe kalabilir, ekrana çıkmaz. */
function yorumsuz(s) {
  const out = [];
  let blok = false;
  for (const ham of s.split('\n')) {
    const d = ham.trim();
    if (blok) { if (d.includes('*/')) blok = false; continue; }
    if (d.startsWith('/*') || d.startsWith('{/*')) { if (!d.includes('*/')) blok = true; continue; }
    if (d.startsWith('//') || d.startsWith('*')) continue;
    out.push(ham);
  }
  return out.join('\n');
}

function ekranlar(kokGoreli) {
  const kok = join(KOK, kokGoreli);
  const out = [];
  const gez = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) gez(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  gez(kok);
  return out;
}

const DOSYALAR = [
  ...ekranlar('src/app/(super-admin)'),
  join(KOK, 'src/components/super-admin/SuperAdminSidebar.tsx'),
  join(KOK, 'src/app/(dashboard)/admin/page.tsx'),
];
// Slug üretimindeki harf dönüşümü: Türkçe harfi ASCII'ye çeviren tablo.
// Ekrana çıkmaz, çevrilmemeli — çevrilirse slug bozulur.
const IZINLI = /replace\(\/[ğüşıöç]\/g/;
const TR_HARF = /[ğĞıİşŞçÇöÖüÜ]/;

const kalinti = [];
for (const f of DOSYALAR) {
  const s = yorumsuz(oku(f.replace(KOK + '\\', '').replace(KOK + '/', '')));
  const kisa = f.split(/[\\/]/).slice(-3).join('/');
  for (const m of s.matchAll(/>([^<>{}\n]*[ğĞıİşŞçÇöÖüÜ][^<>{}\n]*)</g)) {
    if (m[1].trim()) kalinti.push(`${kisa} · metin · ${m[1].trim()}`);
  }
  for (const m of s.matchAll(/'([^'\\\n]*[ğĞıİşŞçÇöÖüÜ][^'\\\n]*)'/g)) {
    const satir = s.slice(Math.max(0, m.index - 40), m.index + 40);
    if (!IZINLI.test(satir) && TR_HARF.test(m[1])) kalinti.push(`${kisa} · dize · ${m[1]}`);
  }
  for (const m of s.matchAll(/"([^"\\\n]*[ğĞıİşŞçÇöÖüÜ][^"\\\n]*)"/g)) {
    kalinti.push(`${kisa} · dize · ${m[1]}`);
  }
}
t(`${DOSYALAR.length} süper admin dosyası tarandı`, DOSYALAR.length >= 14, DOSYALAR.length);
t('★ ekranlarda gömülü Türkçe metin yok', kalinti.length === 0, kalinti.slice(0, 6));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ NÖBETÇİ KODLARININ KARŞILIĞI VAR');
// ───────────────────────────────────────────────────────────────────────────
// Kodlar kaynaktan okunuyor: yeni bir kontrol eklendiğinde test onu kendi
// bulur, elle listeye yazmak gerekmez.
const metinKaynak = oku('src/lib/nobetci-metin.ts');
const mesajKodlari = [...new Set([...metinKaynak.matchAll(/kod: '([A-Z_]+)'/g)].map((m) => m[1]))];
// Yalnız NedenKod birleşiminden oku: KontrolAdi birleşimi de aynı biçimde
// yazılıyor, tüm dosyayı taramak ikisini karıştırır.
const nedenBlok = metinKaynak.slice(metinKaynak.indexOf('export type NedenKod ='));
const nedenKodlari = [...new Set(
  [...nedenBlok.slice(0, nedenBlok.indexOf(';')).matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]),
)];
const adKodlari = ['VERITABANI', 'DISK', 'FATURA_CRON', 'WHATSAPP', 'SAYAC_EPOSTA', 'BILDIRIM_KUYRUGU', 'DENETIM_KAYDI'];

// Her alanı dolu bir sahte bulgu: hangi kod hangi alanı okuyorsa bulur.
const SAHTE = {
  ms: 12, bayi: 3, hedef: 'nextus @ db.example', hata: 'ECONNREFUSED',
  yuzde: 91, bosGB: 3.2, cihaz: 44, adet: 7, gun: 9, n: 5,
};

t(`${mesajKodlari.length} mesaj kodu bulundu`, mesajKodlari.length >= 25, mesajKodlari.length);
t(`${nedenKodlari.length} neden kodu bulundu`, nedenKodlari.length >= 12, nedenKodlari.length);

for (const [dil, sz] of DILLER) {
  const bos = mesajKodlari.filter((kod) => {
    const c = kontrolMesaji(sz, { kod, ...SAHTE });
    return !c || c.length < 3;
  });
  t(`${dil}: her mesaj kodu cümle üretiyor`, bos.length === 0, bos);

  const yerTutucu = mesajKodlari.filter((kod) => /\{[a-zA-Z]+\}/.test(kontrolMesaji(sz, { kod, ...SAHTE })));
  t(`${dil}: ★ cümlede doldurulmamış {yer} kalmıyor`, yerTutucu.length === 0, yerTutucu);

  const nedensiz = nedenKodlari.filter((kod) => !kontrolNedeni(sz, kod));
  t(`${dil}: her neden kodunun karşılığı var`, nedensiz.length === 0, nedensiz);

  const adsiz = adKodlari.filter((kod) => !kontrolAdi(sz, kod));
  t(`${dil}: her kontrolün adı var`, adsiz.length === 0, adsiz);

  t(`${dil}: özet sorunsuzken "her şey yolunda" diyor`, nobetciOzeti(sz, 0, 0).length > 3);
  t(`${dil}: ★ özet kritik sayısını yazıyor`, /2/.test(nobetciOzeti(sz, 2, 1)), nobetciOzeti(sz, 2, 1));
}

// Kod var ama sözlükte yok → ekranda boş satır. Tersi de olur: sözlükte
// artık kullanılmayan anahtar birikir. İkisini de burada görüyoruz.
{
  const sz = sozluk('tr');
  const sozlukAnahtar = Object.keys(sz.nobetci.mesaj).length;
  t('sözlükteki mesaj sayısı kod sayısıyla aynı', sozlukAnahtar === mesajKodlari.length,
    { sozluk: sozlukAnahtar, kod: mesajKodlari.length });
  t('sözlükteki neden sayısı kod sayısıyla aynı', Object.keys(sz.nobetci.neden).length === nedenKodlari.length,
    { sozluk: Object.keys(sz.nobetci.neden).length, kod: nedenKodlari.length });
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ PAKET ADLARI TEK KAYNAKTAN');
// ───────────────────────────────────────────────────────────────────────────
{
  const moduller = oku('src/lib/modules.ts');
  const planlar = [...moduller.matchAll(/^\s{2}(\w+):\s*\[/gm)].map((m) => m[1])
    .filter((p) => ['trial', 'starter', 'professional', 'enterprise'].includes(p));
  t('PLAN_MODULES dört paketi tanıyor', planlar.length === 4, planlar);

  for (const [dil, sz] of DILLER) {
    const eksik = planlar.filter((p) => !sz.superAdmin.paket[p]);
    t(`${dil}: her paketin adı sözlükte var`, eksik.length === 0, eksik);
  }

  // Asıl kaza: eski ekranın kendi listesi. Artık PLAN_MODULES'ten türetiliyor.
  const eski = oku('src/app/(dashboard)/admin/page.tsx');
  t('★ eski panel kendi paket listesini taşımıyor', !/'standard'|'pro'/.test(eski));
  t('★ eski panel paketleri PLAN_MODULES’ten alıyor', /PLAN_MODULES/.test(eski));
  // Uç nokta de kapalı: ekran atlansa bile tanınmayan paket yazılamaz.
  const uc = oku('src/app/api/admin/tenants/route.ts');
  t('★ uç nokta tanınmayan paketi reddediyor', /paketGecerli/.test(uc) && /PLAN_MODULES/.test(uc));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ YERLEŞİM');
// ───────────────────────────────────────────────────────────────────────────
{
  // Yorumsuz okunuyor: dosyanın açıklama bloğu bu hatayı ANLATIYOR, o yüzden
  // içinde <html> geçiyor. Aranan şey gerçekten çizilen etiket.
  const yerlesim = yorumsuz(oku('src/app/(super-admin)/layout.tsx'));
  t('★ iç içe <html> yok', !/<html/.test(yerlesim));
  t('★ iç içe <body> yok', !/<body/.test(yerlesim));
  t('kenar çubuğu yine de duruyor', /SuperAdminSidebar/.test(yerlesim));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
