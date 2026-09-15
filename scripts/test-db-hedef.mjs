// HANGİ VERİTABANINA BAĞLIYIZ — hedef özeti ve parola maskesi
// Çalıştır:  node scripts/test-db-hedef.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu özet iki yere gidiyor: süper admin paneline ve ALARM_WEBHOOK_URL ile
// DIŞARIYA. Yani bağlantı dizesinin parolası buradan sızarsa, üretim
// veritabanının parolası bir Slack/Discord kanalına düşer. Test ettiklerim:
//
//   1. PAROLA HİÇBİR ÇIKTIDA GEÇMİYOR — normal, özel karakterli, boş,
//      yüzde-kodlu parolalar dahil.
//   2. YEREL ADRES ANLAŞILIYOR (localhost/127.0.0.1/::1) — üretimde bu
//      "veritabanı bağlı değil" demenin teknik karşılığı.
//   3. BOZUK GİRDİ PATLATMIYOR — nöbetçi kontrolü, okuyamadığı bir adres
//      yüzünden çökerse bütün sistem durumu ekranı kararır.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-hedef-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/db-hedef.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { hedefOzeti, parolayiGizle } = await import(pathToFileURL(join(g, 'db-hedef.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
/** Özetin TAMAMINDA parola geçmiyor mu? */
const parolasiz = (ozet, parola) =>
  ozet !== null && !JSON.stringify(ozet).includes(parola);

console.log('\n★ PAROLA HİÇBİR ÇIKTIDA GEÇMİYOR\n');
{
  const p = 'CokGizliParola123';
  const o = hedefOzeti(`postgresql://postgres:${p}@db.example.com:5432/servis_takip`);
  t('★ düz parola özete sızmıyor', parolasiz(o, p), o);
  t('sunucu doğru', o.sunucu === 'db.example.com:5432', o);
  t('veritabanı adı doğru', o.veritabani === 'servis_takip', o);
  t('kullanıcı doğru', o.kullanici === 'postgres', o);

  const ozel = 'p%40ss%3Aword%21';
  const o2 = hedefOzeti(`postgres://user:${ozel}@10.0.0.4/db`);
  t('★ yüzde-kodlu parola sızmıyor (ham hali)', parolasiz(o2, ozel), o2);
  t('★ yüzde-kodlu parola sızmıyor (çözülmüş hali)', parolasiz(o2, 'p@ss:word!'), o2);

  const o3 = hedefOzeti('postgresql://kullanıcı:şifre@sunucu:5432/veri');
  t('★ türkçe karakterli parola sızmıyor', parolasiz(o3, 'şifre'), o3);

  // Parolası olmayan bağlantı da geçerli — çıktı yine bozulmamalı.
  const o4 = hedefOzeti('postgresql://postgres@postgres-servis:5432/app');
  t('parolasız bağlantı okunuyor', o4.kullanici === 'postgres' && o4.sunucu === 'postgres-servis:5432', o4);
}

console.log('\n★ YEREL ADRES ANLAŞILIYOR\n');
{
  t('localhost yerel', hedefOzeti('postgresql://u:p@localhost:5432/d').yerel === true);
  t('127.0.0.1 yerel', hedefOzeti('postgresql://u:p@127.0.0.1:5432/d').yerel === true);
  t('★ IPv6 ::1 yerel (köşeli parantez soyuluyor)', hedefOzeti('postgresql://u:p@[::1]:5432/d').yerel === true,
    hedefOzeti('postgresql://u:p@[::1]:5432/d'));
  t('IPv6 sunucu adresi parantezsiz yazılıyor', hedefOzeti('postgresql://u:p@[::1]:5432/d').sunucu === '::1:5432');
  t('★ coolify servis adı YEREL DEĞİL', hedefOzeti('postgresql://u:p@servis-takip-db:5432/d').yerel === false);
  t('localhost benzeri ad yerel sayılmıyor', hedefOzeti('postgresql://u:p@localhost.dev:5432/d').yerel === false);
}

console.log('\n★ EKSİK PARÇALAR UYDURULMUYOR\n');
{
  t('port yoksa postgres varsayılanı', hedefOzeti('postgresql://u:p@sunucu/d').sunucu === 'sunucu:5432');
  t('veritabanı adı yoksa soru işareti', hedefOzeti('postgresql://u:p@sunucu:5432/').veritabani === '?');
  t('kullanıcı yoksa soru işareti', hedefOzeti('postgresql://sunucu:5432/d').kullanici === '?',
    hedefOzeti('postgresql://sunucu:5432/d'));
  t('yol bozuk yüzde kodu içerse de patlamıyor', hedefOzeti('postgresql://u:p@sunucu/%zz').veritabani === '%zz',
    hedefOzeti('postgresql://u:p@sunucu/%zz'));
}

console.log('\n★ BOZUK GİRDİ PATLATMIYOR\n');
{
  t('tanımsız → null', hedefOzeti(undefined) === null);
  t('boş metin → null', hedefOzeti('') === null);
  t('★ URL olmayan metin → null (hata fırlatmıyor)', hedefOzeti('bu bir adres değil') === null);
  t('sunucusuz dize → null', hedefOzeti('postgresql:///sadece-yol') === null);
}

console.log('\n★ HATA METNİNDEKİ PAROLA MASKELENİYOR\n');
{
  const h = 'Can\'t reach database server at postgresql://postgres:GizliParola@db:5432/app';
  const m = parolayiGizle(h);
  t('★ hata metnindeki parola maskeleniyor', !m.includes('GizliParola'), m);
  t('sunucu adı okunur kalıyor', m.includes('db:5432'), m);
  t('kullanıcı adı korunuyor', m.includes('postgres:***@'), m);
  t('parolasız dizeye dokunulmuyor', parolayiGizle('postgres://u@db:5432/app') === 'postgres://u@db:5432/app');
  t('parola içermeyen hata metni değişmiyor',
    parolayiGizle('Connection timed out') === 'Connection timed out');
  t('★ aynı metindeki iki dize de maskeleniyor',
    !parolayiGizle('a postgres://u:bir@h/d b postgres://u:iki@h/d').match(/bir|iki/));
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
