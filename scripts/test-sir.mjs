// SIR SAKLAMA — entegratör parolası gibi geri okunması gereken sırlar
// Çalıştır:  node scripts/test-sir.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu dosya parola saklıyor. Üç şeyi kanıtlamak gerekiyor:
//
//   1. ANAHTAR YOKSA DÜZ METNE DÜŞMEMELİ. "Şimdilik böyle kalsın" diye
//      bırakılan düz parola en uzun yaşayan şeydir; yedeklere, loglara ve
//      veritabanı dökümlerine sızar.
//   2. KURCALANAN KAYIT ÇÖZÜLMEMELİ. Sessizce yanlış parola üretmek,
//      yanlış parolayla giriş denemek ve hesabı kilitlemek demek.
//   3. AYNI METİN HER SEFERİNDE FARKLI ŞİFRELENMELİ. Aynı çıktı, iki
//      bayinin aynı parolayı kullandığını ele verir.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sir-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/sir.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

// Testin kendi anahtarı — .env'dekine dokunmuyoruz.
const ANAHTAR = crypto.randomBytes(32).toString('hex');
process.env.SIR_ANAHTARI = ANAHTAR;

const { sirla, sirCoz, sirMaskesi, sirAnahtariVarMi, sirAnahtariUret } =
  await import(pathToFileURL(join(g, 'sir.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const patla = (f) => { try { f(); return null; } catch (e) { return e.message; } };

console.log('\nGİDİŞ GELİŞ\n');
{
  const s = sirla('gizli-parola-123');
  t('şifreli metin düz metni içermiyor', !s.includes('gizli-parola-123'), s.slice(0, 20));
  t('sürüm öneki var', s.startsWith('v1.'), s.slice(0, 6));
  t('geri çözülüyor', sirCoz(s) === 'gizli-parola-123', sirCoz(s));
  t('Türkçe karakter korunuyor', sirCoz(sirla('şifreÇĞİÖÜ')) === 'şifreÇĞİÖÜ');
  t('boş metin de çözülüyor', sirCoz(sirla('')) === '');
  t('uzun metin çözülüyor', sirCoz(sirla('x'.repeat(5000))).length === 5000);
}

console.log('\n★ AYNI PAROLA HER SEFERİNDE FARKLI ŞİFRELENİYOR\n');
{
  const a = sirla('ayni-parola'), b = sirla('ayni-parola');
  t('★ iki şifreleme farklı (aynı parola ele verilmiyor)', a !== b, { a: a.slice(0, 24), b: b.slice(0, 24) });
  t('ikisi de aynı metne çözülüyor', sirCoz(a) === 'ayni-parola' && sirCoz(b) === 'ayni-parola');
}

console.log('\n★ KURCALANAN KAYIT ÇÖZÜLMÜYOR\n');
{
  const s = sirla('gizli');
  const p = s.split('.');
  // Şifreli kısmın son baytını değiştir.
  const bozuk = Buffer.from(p[3], 'base64');
  bozuk[bozuk.length - 1] ^= 0xff;
  const kurcalanmis = [p[0], p[1], p[2], bozuk.toString('base64')].join('.');
  t('★ içerik değiştiyse null döner (yanlış parola ÜRETMİYOR)', sirCoz(kurcalanmis) === null);

  const etiketBozuk = [p[0], p[1], Buffer.from('0'.repeat(16)).toString('base64'), p[3]].join('.');
  t('bütünlük etiketi bozuksa null', sirCoz(etiketBozuk) === null);
  t('biçimsiz kayıt null', sirCoz('abc') === null && sirCoz('v1.a.b') === null);
  t('bilinmeyen sürüm null', sirCoz('v9.a.b.c') === null);
  t('boş/null girdi null', sirCoz(null) === null && sirCoz('') === null && sirCoz(undefined) === null);
}
{
  // Anahtar değişirse eski kayıt çözülmemeli — yanlış parola üretmemeli.
  const s = sirla('gizli');
  process.env.SIR_ANAHTARI = crypto.randomBytes(32).toString('hex');
  t('★ anahtar değişince eski kayıt çözülmüyor', sirCoz(s) === null);
  process.env.SIR_ANAHTARI = ANAHTAR;
  t('anahtar geri gelince yine çözülüyor', sirCoz(s) === 'gizli');
}

console.log('\n★ ANAHTAR YOKSA DÜZ METNE DÜŞMÜYOR\n');
{
  delete process.env.SIR_ANAHTARI;
  t('anahtar yok olarak bildiriliyor', sirAnahtariVarMi() === false);
  const h = patla(() => sirla('gizli'));
  t('★ şifreleme HATA veriyor, düz metin döndürmüyor', h !== null, h);
  t('sebebi ve çözümü yazıyor', /KAYDEDİLMEDİ/.test(h) && /\.env/.test(h), h);
  t('çözme de null (patlamıyor)', sirCoz('v1.a.b.c') === null);
  process.env.SIR_ANAHTARI = ANAHTAR;
  t('anahtar dönünce çalışıyor', sirAnahtariVarMi() === true);
}
{
  // Kısa/bozuk anahtar SESSİZCE kabul edilmemeli: zayıf anahtar türetip
  // şifrelemeyi olduğundan güçlü göstermek en kötüsü.
  process.env.SIR_ANAHTARI = 'kisa';
  t('★ kısa anahtar kabul edilmiyor', sirAnahtariVarMi() === false);
  t('kısa anahtarla şifreleme hata veriyor', patla(() => sirla('x')) !== null);
  process.env.SIR_ANAHTARI = 'z'.repeat(64); // onaltılık değil
  t('onaltılık olmayan anahtar kabul edilmiyor', sirAnahtariVarMi() === false);
  process.env.SIR_ANAHTARI = ANAHTAR;
}

console.log('\nMASKE VE ANAHTAR ÜRETİMİ\n');
{
  t('son 4 hane gösteriliyor', sirMaskesi('parola1234') === '••••1234', sirMaskesi('parola1234'));
  t('kısa parola tamamen maskeli', sirMaskesi('abc') === '••••', sirMaskesi('abc'));
  t('boş parola maskesi yok', sirMaskesi(null) === null && sirMaskesi('') === null);
  const a = sirAnahtariUret();
  t('üretilen anahtar 64 onaltılık', /^[0-9a-f]{64}$/.test(a), a.slice(0, 10));
  t('her üretim farklı', sirAnahtariUret() !== sirAnahtariUret());
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
