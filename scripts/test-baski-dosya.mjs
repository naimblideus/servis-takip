// BASKI DOSYALARI — R2 imzası, yükleme kuralları, ön kontrol
// Çalıştır:  node scripts/test-baski-dosya.mjs   (sunucu, veritabanı ve R2 gerekmez)
//
// NEDEN BU TEST
//   · İmza AWS SDK'sız, elle kuruluyor (lib/r2). Tek karakterlik hata her
//     yüklemeyi 403'e çevirir ve bunu ancak canlıda, müşteri dosya
//     gönderirken görürüz. AWS'nin belgelerindeki örnek imzalarla sınanıyor.
//   · Tür ve boyut sınırı sunucuda: tarayıcıdaki denetim atlanabilir.
//   · Yarım kalmış yükleme "yüklendi" görünürse iş eksik dosyayla basılır.
//   · Sayfa sayısı dosyadan okunuyor; yanlış okuma yanlış fiyat demek.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-dosya-'));
let R, D;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['r2', 'baski-dosya', 'baski-is', 'baski-fiyat'].map((k) => join(KOK, `src/lib/${k}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck', '--types', 'node',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  for (const k of ['baski-dosya', 'baski-is']) {
    const y = join(g, `${k}.js`);
    writeFileSync(y, readFileSync(y, 'utf8').replace(/from '\.\/([\w-]+)'/g, "from './$1.js'"), 'utf8');
  }
  const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
  [R, D] = await Promise.all(['r2', 'baski-dosya'].map(al));
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\nR2 imzası (AWS örnek imzaları)\n');
{
  // AWS belgeleri, "Signature Version 4: Examples". Anahtarlar belgedeki ÖRNEK anahtarlardır.
  const kimlik = { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' };
  const simdi = new Date('2013-05-24T00:00:00Z');
  const sunucu = 'examplebucket.s3.amazonaws.com';
  const s = R.sorguImzasi({ yontem: 'GET', sunucu, yol: '/test.txt', saniye: 86400, kimlik, simdi });
  t('★ sorguyla imzalı adres AWS örneğiyle aynı', s.endsWith('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'), s);
  t('sorguda süre, kimlik kapsamı ve imzalı başlık var', /X-Amz-Expires=86400/.test(s) && /X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request/.test(s) && /X-Amz-SignedHeaders=host/.test(s));
  const imza = (b) => /Signature=([0-9a-f]{64})$/.exec(b.authorization)?.[1];
  const a = R.baslikImzasi({ yontem: 'GET', sunucu, yol: '/test.txt', basliklar: { Range: 'bytes=0-9' }, kimlik, simdi });
  t('★ başlıkla imza: nesne okuma örneği', imza(a) === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', a.authorization);
  const b = R.baslikImzasi({ yontem: 'GET', sunucu, yol: '/', sorgu: { lifecycle: '' }, kimlik, simdi });
  t('★ başlıkla imza: değersiz sorgu (?lifecycle; çok parçalı açma ?uploads ile aynı biçim)', imza(b) === 'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543', b.authorization);
  const c = R.baslikImzasi({ yontem: 'GET', sunucu, yol: '/', sorgu: { 'max-keys': '2', prefix: 'J' }, kimlik, simdi });
  t('★ başlıkla imza: sorgu sıralı ve kodlu', imza(c) === '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7', c.authorization);
  t('host başlığı elle gönderilmiyor (fetch kendi yazar)', !('host' in a) && a['x-amz-date'] === '20130524T000000Z');
  t('kodlama RFC 3986: boşluk %20, / %2F, ~ düz, * kodlu', R.kodla('a b/c~*') === 'a%20b%2Fc~%2A');
}

console.log('\nR2 ayarı ve adresler\n');
{
  const tam = { R2_ENDPOINT: 'https://hesap.r2.cloudflarestorage.com/', R2_BUCKET: 'baski', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' };
  const a = R.r2Ayari(tam);
  t('ayar okunuyor, sondaki / atılıyor, bölge auto', a && a.endpoint === 'https://hesap.r2.cloudflarestorage.com' && a.region === 'auto');
  for (const k of Object.keys(tam)) t(`★ ${k} eksikse yükleme kapalı`, R.r2Ayari({ ...tam, [k]: '' }) === null);
  t('yol içeren endpoint reddediliyor (bucket ayrı yazılır)', R.r2Ayari({ ...tam, R2_ENDPOINT: 'https://x.test/baski' }) === null);
  const u = R.parcaAdresi(a, 't/k1/i1/d1/dosya adi.pdf', 'YUK+1', 3, 3600);
  t('★ parça adresi: bucket yolda, anahtar kodlu, parça no ve yükleme kimliği imzalı sorguda',
    u.startsWith('https://hesap.r2.cloudflarestorage.com/baski/t/k1/i1/d1/dosya%20adi.pdf?') && /partNumber=3/.test(u) && /uploadId=YUK%2B1/.test(u) && /X-Amz-Signature=[0-9a-f]{64}$/.test(u), u);
  const i = R.indirmeAdresi(a, 't/k1/i1/d1/x.pdf', 'Öğrenci tezi.pdf', 300);
  t('★ indirme adresi 5 dakikalık ve dosya olarak iner', /X-Amz-Expires=300/.test(i) && /response-content-disposition=attachment/.test(i), i);
  t('Türkçe dosya adı başlıkta korunuyor (UTF-8) ve ASCII yedeği var', decodeURIComponent(i).includes("filename*=UTF-8''%C3%96%C4%9Frenci%20tezi.pdf") && decodeURIComponent(i).includes('filename="__renci tezi.pdf"'), decodeURIComponent(i));
  t('prova satır içi açılabiliyor', /response-content-disposition=inline/.test(R.indirmeAdresi(a, 'x', 'p.png', 300, true)));
}

console.log('\nDepo çağrıları (sahte R2 ile uçtan uca)\n');
{
  const { sahteR2 } = await import(pathToFileURL(join(KOK, 'scripts/sahte-r2.mjs')).href);
  const depo = sahteR2(9417);
  const endpoint = await depo.baslat();
  try {
    const a = R.r2Ayari({ R2_ENDPOINT: endpoint, R2_BUCKET: 'deneme', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' });
    const anahtar = 't/k1/i1/d1/Tez (son).pdf';
    const kimlik = await R.yuklemeBaslat(a, anahtar, 'application/pdf');
    t('yükleme açılıyor ve kimlik okunuyor', typeof kimlik === 'string' && kimlik.length > 8, kimlik);
    const p1 = Buffer.alloc(D.PARCA_BOYU, 1), p2 = Buffer.from('son parça');
    const koy = async (no, govde) => (await fetch(R.parcaAdresi(a, anahtar, kimlik, no, 600), { method: 'PUT', body: govde })).status;
    t('★ parçalar imzalı adrese doğrudan yükleniyor', (await koy(1, p1)) === 200 && (await koy(2, p2)) === 200);
    const parcalar = await R.parcalariOku(a, anahtar, kimlik);
    t('★ parça listesi depodan okunuyor (sıra, boyut, tırnaklı ETag)', parcalar.length === 2 && parcalar[0].no === 1 && parcalar[0].boyut === p1.length && parcalar[1].boyut === p2.length && /^"[0-9a-f]{32}"$/.test(parcalar[0].etag), parcalar);
    t('okunan parçalar boyutla tutuyor', D.parcalarTam(parcalar, p1.length + p2.length) && !D.parcalarTam(parcalar, p1.length));
    await R.yuklemeBitir(a, anahtar, kimlik, parcalar);
    const inen = await fetch(R.indirmeAdresi(a, anahtar, 'Tez (son).pdf', 300));
    const govde = Buffer.from(await inen.arrayBuffer());
    t('★ kapatılan dosya indiriliyor: içerik bayt bayt aynı', inen.status === 200 && govde.length === p1.length + p2.length && govde.subarray(p1.length).toString() === 'son parça');
    t('indirmede dosya adı başlığı geliyor', /attachment; filename="Tez \(son\)\.pdf"/.test(inen.headers.get('content-disposition') ?? ''), inen.headers.get('content-disposition'));
    t('imzasız istek reddediliyor', (await fetch(`${endpoint}/deneme/${encodeURIComponent(anahtar)}`)).status === 403);
    t('★ silinen dosya artık inmiyor; ikinci silme de başarılı', (await R.nesneSil(a, anahtar)) && (await fetch(R.indirmeAdresi(a, anahtar, 'x.pdf', 300))).status === 404 && (await R.nesneSil(a, anahtar)));
    const yarim = await R.yuklemeBaslat(a, 't/k1/i1/d2/yarim.pdf', 'application/pdf');
    await fetch(R.parcaAdresi(a, 't/k1/i1/d2/yarim.pdf', yarim, 1, 600), { method: 'PUT', body: 'x' });
    await R.yuklemeIptal(a, 't/k1/i1/d2/yarim.pdf', yarim);
    let dustu = false;
    try { await R.parcalariOku(a, 't/k1/i1/d2/yarim.pdf', yarim); } catch (e) { dustu = e instanceof R.R2Hatasi; }
    t('★ vazgeçilen yükleme depoda kalmıyor', dustu && depo.nesneSayisi() === 0, depo.nesneSayisi());
    let hata = null;
    try { await R.yuklemeBitir(a, anahtar, 'olmayan', [{ no: 1, etag: '"x"' }]); } catch (e) { hata = e; }
    t('depo hatası sessiz geçmiyor', hata instanceof R.R2Hatasi);
  } finally {
    await depo.kapat();
  }
}

console.log('\nYükleme kuralları\n');
{
  const { dosyaTuru, gorunenAd, nesneAnahtari, yuklemeGecerli, parcaSayisi, parcalarTam, saklamaDoldu, DOSYA_AZAMI, IS_AZAMI, IS_DOSYA_SAYISI, PARCA_BOYU } = D;
  t('PDF, JPG, PNG, TIFF kabul', ['a.pdf', 'b.JPG', 'c.jpeg', 'd.png', 'e.tif', 'f.TIFF'].every((x) => dosyaTuru(x)));
  t('★ başka tür kabul edilmiyor (exe, html, svg, uzantısız, çift uzantı)', ['a.exe', 'b.html', 'c.svg', 'd', 'e.pdf.exe', 'f.docx'].every((x) => dosyaTuru(x) === null));
  t('tür uzantıdan, tarayıcının sözünden değil', dosyaTuru('x.tif') === 'image/tiff');
  t('ad: yol ve denetim karakteri atılıyor', gorunenAd('C:\\Users\\a\\tez\u0000.pdf') === 'tez.pdf' && gorunenAd('../../etc/passwd') === 'passwd' && gorunenAd('') === 'dosya');
  const k = nesneAnahtari('kiraci1', 'is1', 'dosya1', '../Öğrenci tezi (son).pdf');
  t('★ anahtar kiracı klasöründe ve yalnız güvenli karakter', k.startsWith('t/kiraci1/is1/dosya1/') && /^[A-Za-z0-9._/-]+$/.test(k) && !k.includes('..'), k);
  const is = { durum: 'SIRADA', mevcutSayi: 0, mevcutBoyut: 0 };
  const iyi = yuklemeGecerli({ ad: 'tez.pdf', boyut: 20 * 1024 * 1024 }, is, 'MUSTERI');
  t('geçerli yükleme: tür ve parça sayısı', iyi.ok && iyi.mime === 'application/pdf' && iyi.parca === 3, iyi);
  t('★ 300 MB üstü reddediliyor', yuklemeGecerli({ ad: 'a.pdf', boyut: DOSYA_AZAMI + 1 }, is, 'MUSTERI').kod === 'DOSYA_BUYUK' && yuklemeGecerli({ ad: 'a.pdf', boyut: DOSYA_AZAMI }, is, 'MUSTERI').ok);
  t('boş, eksi ve sayı olmayan boyut reddediliyor', [0, -5, 'abc', 1.5, null].every((b) => yuklemeGecerli({ ad: 'a.pdf', boyut: b }, is, 'MUSTERI').kod === 'DOSYA_BUYUK'));
  t('★ iş başına 1 GB ve 20 dosya sınırı', yuklemeGecerli({ ad: 'a.pdf', boyut: 10 }, { ...is, mevcutBoyut: IS_AZAMI - 5 }, 'MUSTERI').kod === 'DOSYA_COK'
    && yuklemeGecerli({ ad: 'a.pdf', boyut: 10 }, { ...is, mevcutSayi: IS_DOSYA_SAYISI }, 'MUSTERI').kod === 'DOSYA_COK');
  t('★ müşteri iş baskıya girince dosya ekleyemiyor, personel ekleyebiliyor',
    yuklemeGecerli({ ad: 'a.pdf', boyut: 10 }, { ...is, durum: 'BASKIDA' }, 'MUSTERI').kod === 'DOSYA_IS_KAPALI' && yuklemeGecerli({ ad: 'a.pdf', boyut: 10 }, { ...is, durum: 'BASKIDA' }, 'PERSONEL').ok);
  t('★ kapanmış işe kimse dosya ekleyemiyor', ['TESLIM', 'IPTAL'].every((d) => ['MUSTERI', 'PERSONEL'].every((kim) => !yuklemeGecerli({ ad: 'a.pdf', boyut: 10 }, { ...is, durum: d }, kim).ok)));
  t('parça sayısı: küçük dosya tek parça, sınırda taşma yok', parcaSayisi(1) === 1 && parcaSayisi(PARCA_BOYU) === 1 && parcaSayisi(PARCA_BOYU + 1) === 2 && parcaSayisi(DOSYA_AZAMI) === 38);
  const b = PARCA_BOYU * 2 + 100;
  t('★ parçalar tamsa yükleme kapanır', parcalarTam([{ no: 1, boyut: PARCA_BOYU }, { no: 2, boyut: PARCA_BOYU }, { no: 3, boyut: 100 }], b));
  t('★ eksik parça, atlanan sıra ya da tutmayan boyut kapanmaz', !parcalarTam([{ no: 1, boyut: PARCA_BOYU }, { no: 2, boyut: PARCA_BOYU }], b)
    && !parcalarTam([{ no: 1, boyut: PARCA_BOYU }, { no: 3, boyut: PARCA_BOYU }, { no: 4, boyut: 100 }], b)
    && !parcalarTam([{ no: 1, boyut: PARCA_BOYU }, { no: 2, boyut: PARCA_BOYU }, { no: 3, boyut: 99 }], b));
  const gun = (n) => new Date(Date.UTC(2026, 10, 10) - n * 86_400_000);
  const simdi = new Date(Date.UTC(2026, 10, 10));
  t('★ teslimden 30 gün sonra dosya silinir, 29. günde durur', saklamaDoldu({ durum: 'TESLIM', teslimAt: gun(31), iptalAt: null }, 30, simdi) && !saklamaDoldu({ durum: 'TESLIM', teslimAt: gun(29), iptalAt: null }, 30, simdi));
  t('iptal edilen iş iptal tarihinden sayılır', saklamaDoldu({ durum: 'IPTAL', teslimAt: null, iptalAt: gun(40) }, 30, simdi));
  t('★ açık işin dosyası ne kadar eski olursa olsun silinmez', !saklamaDoldu({ durum: 'HAZIR', teslimAt: gun(400), iptalAt: gun(400) }, 30, simdi));
}

console.log('\nÖn kontrol\n');
{
  const { pdfSayfaSay, pdfOlcu, ebatAdi, dpiDusukMu } = D;
  const pdf = (n, ek = '') => `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [${Array.from({ length: n }, (_, i) => `${i + 3} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`
    + Array.from({ length: n }, (_, i) => `${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\n`).join('') + ek;
  t('★ sayfa sayısı sayfa ağacından', pdfSayfaSay(pdf(12)) === 12 && pdfSayfaSay(pdf(1)) === 1);
  t('★ yer imi sayısı (/Outlines /Count) sayfa sanılmıyor', pdfSayfaSay(pdf(3, '99 0 obj\n<< /Type /Outlines /Count 250 /First 5 0 R >>\nendobj\n')) === 3);
  const agac = '1 0 obj\n<< /Type /Pages /Count 40 /Kids [2 0 R 3 0 R] >>\nendobj\n2 0 obj\n<< /Type /Pages /Parent 1 0 R /Count 25 /Kids [] >>\nendobj\n3 0 obj\n<< /Parent 1 0 R /Kids [] /Count 15 /Type /Pages >>\nendobj\n';
  t('★ iç içe sayfa ağacında kökün sayısı (en büyük)', pdfSayfaSay(agac) === 40);
  t('iç sözlükteki /Count kök sanılmıyor', pdfSayfaSay('1 0 obj\n<< /Type /Pages /Resources << /X << /Count 900 >> >> /Count 7 /Kids [] >>\nendobj') === 7);
  t('sayaç dolaylı başvuruysa atlanıp sayfa nesneleri sayılıyor', pdfSayfaSay('<< /Type /Pages /Count 9 0 R >> << /Type /Page >> << /Type /Page >>') === 2);
  t('★ okunamayan dosyada null (müşteri elle yazar)', pdfSayfaSay('%PDF-1.7 sıkıştırılmış içerik') === null && pdfSayfaSay('') === null);
  const o = pdfOlcu(pdf(1));
  t('ölçü milimetreye çevriliyor: A4', o && o.enMm === 210 && o.boyMm === 297 && ebatAdi(o.enMm, o.boyMm) === 'A4', o);
  t('yatay A3 tanınıyor, tanınmayan ölçü mm olarak', ebatAdi(420, 297) === 'A3' && ebatAdi(250, 350) === '250×350 mm');
  t('kutusu olmayan dosyada ölçü yok', pdfOlcu('<< /Type /Page >>') === null);
  t('★ küçük görsel büyük baskıda uyarı veriyor', dpiDusukMu(800, 600, 100, 70) && !dpiDusukMu(6000, 4000, 100, 70));
  t('yan çevrilmiş görsel haksız yere uyarılmıyor', !dpiDusukMu(1800, 1200, 20, 30));
  t('ölçü ya da piksel yoksa uyarı yok', !dpiDusukMu(0, 0, 100, 70) && !dpiDusukMu(800, 600, 0, 0));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
