// MATBAANIN MÜŞTERİ TARAFI — sipariş sayfası, takip, prova, ayarlar
// Çalıştır:  node scripts/test-matbaa-online.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
//   · /b/* sayfaları ve /api/b/* uçları GİRİŞSİZ: kiracıyı istekten okuyan ya
//     da hız sınırı olmayan tek bir uç, bütün matbaaların kuyruğunu dışarıya açar.
//   · Takip sayfası müşteriye iç notu, personel adını ya da başkasının
//     telefonunu göstermemeli (kalıp: test-portal).
//   · Prova bağlantısı süreli ve tek kullanımlık olmalı; eski prova onaylanamamalı.
//   · Müşteriye giden metinler bayinin dilinde; İngilizce metinde Türkçe kalmamalı.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-matbaa-online-'));
let A, B, M, MM;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['matbaa-ayar', 'baski-is', 'baski-fiyat', 'baski-mesaj', 'odeme-bilgisi', 'matbaa-musteri-metin'].map((k) => join(KOK, `src/lib/${k}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  for (const k of ['matbaa-ayar', 'baski-is', 'baski-mesaj']) {
    const y = join(g, `${k}.js`);
    writeFileSync(y, readFileSync(y, 'utf8').replace(/from '\.\/([\w-]+)'/g, "from './$1.js'"), 'utf8');
  }
  const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
  [A, B, M, MM] = await Promise.all(['matbaa-ayar', 'baski-is', 'baski-mesaj', 'matbaa-musteri-metin'].map(al));
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');
const yuru = (d) => readdirSync(d).flatMap((f) => { const y = join(d, f); return statSync(y).isDirectory() ? yuru(y) : [y]; });

console.log('\nKısa ad ve adresler\n');
{
  const { kisaAdTemizle, kisaAdGecerli, jetonGecerli, siparisYolu, takipYolu, provaYolu, tamAdres } = A;
  t('ad kısa ada çevriliyor (Türkçe harf, boşluk, işaret)', kisaAdTemizle('Lider Dijital Baskı & Kopyalama') === 'lider-dijital-baski-kopyalama' && kisaAdTemizle('  ÇAĞ--Ofset! ') === 'cag-ofset');
  t('geçerli kısa adlar', ['lider-dijital', 'abc', 'matbaa2', 'a1-b2-c3'].every(kisaAdGecerli));
  t('★ geçersiz kısa ad reddediliyor (kısa, büyük harf, boşluk, çift tire, baş/son tire, eğik çizgi)',
    ['ab', 'Lider', 'lider dijital', 'a--b', '-abc', 'abc-', 'a/b', '../x', '', null, 'a'.repeat(41)].every((x) => !kisaAdGecerli(x)));
  t('★ sistem yollarıyla çakışan ad alınamıyor', ['api', 'admin', 'prova', 'login'].every((x) => !kisaAdGecerli(x)));
  t('★ jeton biçimi: 24 karakter base64url; başkası veritabanına gitmeden elenir', jetonGecerli('Ab3_-xyzAb3_-xyzAb3_-xyz') && ['', 'kisa', 'A'.repeat(23), 'A'.repeat(25), 'A'.repeat(23) + '/', null, "'; DROP--".padEnd(24, 'x')].every((x) => !jetonGecerli(x)));
  t('adresler tek yerden', siparisYolu('lider') === '/b/lider' && takipYolu('lider', 'J') === '/b/lider/is/J' && provaYolu('lider', 'J') === '/b/lider/prova/J');
  t('tam adres; kısa ad yoksa bağlantı da yok', tamAdres('https://x.test/', '/b/lider') === 'https://x.test/b/lider' && tamAdres('https://x.test', null) === null);
  t('saklama ve hazırlama süresi sınırlı', A.saklamaGunu(3) === 30 && A.saklamaGunu(90) === 90 && A.saklamaGunu('abc') === 30 && A.hazirlamaSaati(0) === 2 && A.hazirlamaSaati(24) === 24);
  const simdi = new Date('2026-11-10T08:00:00Z');
  t('★ söz verilen saat kabulden, en uzun hazırlama süresi kadar sonra', +A.sozSaati(simdi, [1, 24, null], 2) - +simdi === 24 * 3_600_000 && +A.sozSaati(simdi, [null], 3) - +simdi === 3 * 3_600_000 && +A.sozSaati(simdi, [], 2) - +simdi === 2 * 3_600_000);
}

console.log('\nHızlı yanıtlar ve kurulum listesi\n');
{
  const v = { firma: 'Örnek Baskı', siparisUrl: 'https://x.test/b/ornek', adres: 'Örnek Cad. 1', iban: 'TR330006100519786457841326', hesapAdi: 'Örnek Baskı', calisma: 'Hafta içi 09–19' };
  const l = A.hizliYanitlar(v, 'tr');
  t('beş yanıt: karşılama, fiyat, IBAN, adres, saat', l.map((x) => x.tur).join() === 'KARSILAMA,FIYAT,IBAN,ADRES,SAAT');
  t('★ karşılama mesajında sipariş bağlantısı var', l[0].metin.includes('https://x.test/b/ornek') && l[0].metin.includes('Örnek Baskı'));
  t('IBAN okunur biçimde ve alıcıyla', l[2].metin.includes('TR33 0006 1005 1978 6457 8413 26') && l[2].metin.includes('Alıcı: Örnek Baskı'));
  t('★ verisi olmayan yanıt listede yok (bağlantısız karşılama, IBAN\'sız ödeme bilgisi)', A.hizliYanitlar({ firma: 'X', siparisUrl: null }, 'tr').length === 0
    && A.hizliYanitlar({ ...v, iban: null, adres: ' ', calisma: null }, 'tr').map((x) => x.tur).join() === 'KARSILAMA,FIYAT');
  t('kendi karşılama metni: {baglanti} yerine adres', A.hizliYanitlar({ ...v, ozelKarsilama: 'Selam! Sipariş: {baglanti} bekleriz' }, 'tr')[0].metin === 'Selam! Sipariş: https://x.test/b/ornek bekleriz');
  t('★ kendi metninde bağlantı yeri yoksa sona ekleniyor', A.hizliYanitlar({ ...v, ozelKarsilama: 'Hoş geldiniz' }, 'tr')[0].metin === 'Hoş geldiniz\nhttps://x.test/b/ornek');
  const en = A.hizliYanitlar(v, 'en').map((x) => x.metin).join('\n').replace(/Örnek Baskı|Örnek Cad\. 1|Hafta içi 09–19/g, '');
  t('★ İngilizce yanıtlarda Türkçe kalmadı', !/[çğışöüÇĞİŞÖÜ]/.test(en), en);
  const k = (o) => A.kurulumDurumu({ fiyatliUrun: 0, kisaAd: null, siparisAcik: false, karsilamaKopyalandi: false, isSayisi: 0, ...o });
  t('yeni matbaada dört adım da açık', k({}).every((x) => !x.tamam) && k({}).map((x) => x.adim).join() === A.KURULUM_SIRASI.join());
  t('★ sipariş sayfası yalnız adres VARKEN ve AÇIKKEN tamam', !k({ kisaAd: 'ornek' })[1].tamam && !k({ siparisAcik: true })[1].tamam && k({ kisaAd: 'ornek', siparisAcik: true })[1].tamam);
  t('dördü de bitince liste kalkıyor', A.kurulumBitti(k({ fiyatliUrun: 3, kisaAd: 'o', siparisAcik: true, karsilamaKopyalandi: true, isSayisi: 1 })) && !A.kurulumBitti(k({ fiyatliUrun: 3 })));
}

console.log('\nTakip çizelgesi ve prova kuralları\n');
{
  const { takipAdimi, takipCizelgesi, provaYanitlanir, provaGorunum, provaSonTarihi, PROVA_GUN, bugunTuru, BUGUN_SIRASI } = B;
  t('altı iç durum müşteriye dört adım', ['GELEN', 'SIRADA'].every((d) => takipAdimi(d) === 'ALINDI') && ['BASKIDA', 'BITIS'].every((d) => takipAdimi(d) === 'HAZIRLANIYOR') && takipAdimi('HAZIR') === 'HAZIR' && takipAdimi('TESLIM') === 'TESLIM');
  const T = (s) => new Date(`2026-11-10T${s}:00Z`);
  const olaylar = [{ durumSonra: 'SIRADA', createdAt: T('09:00') }, { durumSonra: 'BASKIDA', createdAt: T('10:00') }, { durumSonra: 'HAZIR', createdAt: T('11:00') }, { durumSonra: 'BASKIDA', createdAt: T('11:30') }, { durumSonra: 'HAZIR', createdAt: T('12:30') }];
  const c = takipCizelgesi({ durum: 'HAZIR', createdAt: T('08:00'), teslimAt: null }, olaylar);
  t('★ çizelge: geçilen adımlar tamam, şimdiki işaretli, sonraki boş', c.map((x) => x.tamam).join() === 'true,true,true,false' && c.findIndex((x) => x.simdi) === 2 && c[3].zaman === null);
  t('★ iş geri alınıp yeniden hazırlandıysa SON hazır saati gösteriliyor', +c[2].zaman === +T('12:30') && +c[1].zaman === +T('11:30') && +c[0].zaman === +T('08:00'));
  t('iptal edilen işte çizelge yok', takipCizelgesi({ durum: 'IPTAL', createdAt: T('08:00') }, olaylar).length === 0);
  const simdi = T('12:00');
  const sonra = new Date(+simdi + 86_400_000), once = new Date(+simdi - 1000);
  t('bekleyen, süresi dolmamış prova yanıtlanır', provaYanitlanir({ durum: 'BEKLIYOR', sonTarih: sonra }, 'SIRADA', simdi).ok);
  t('★ yanıtlanmış prova ikinci kez yanıtlanamaz (tek kullanımlık)', ['ONAYLANDI', 'DUZELTME'].every((d) => provaYanitlanir({ durum: d, sonTarih: sonra }, 'SIRADA', simdi).kod === 'PROVA_YANITLANDI'));
  t('★ süresi dolan prova yanıtlanamaz', provaYanitlanir({ durum: 'BEKLIYOR', sonTarih: once }, 'SIRADA', simdi).kod === 'PROVA_SURESI_DOLDU' && provaYanitlanir({ durum: 'BEKLIYOR', sonTarih: simdi }, 'SIRADA', simdi).kod === 'PROVA_SURESI_DOLDU');
  t('★ iptal edilmiş ya da teslim edilmiş işin provası onaylanamaz', ['IPTAL', 'TESLIM'].every((d) => !provaYanitlanir({ durum: 'BEKLIYOR', sonTarih: sonra }, d, simdi).ok));
  t(`prova bağlantısı ${PROVA_GUN} gün geçerli`, +provaSonTarihi(simdi) - +simdi === PROVA_GUN * 86_400_000);
  t('ekranda süresi dolmuş prova ayrı yazılıyor', provaGorunum({ durum: 'BEKLIYOR', sonTarih: once }, simdi) === 'SURESI_DOLDU' && provaGorunum({ durum: 'BEKLIYOR', sonTarih: sonra }, simdi) === 'BEKLIYOR' && provaGorunum({ durum: 'DUZELTME', sonTarih: once }, simdi) === 'DUZELTME');
  const is = { id: 'a', durum: 'SIRADA', sozVerilenAt: null, haberVerildiAt: null, toplam: 100, odenen: 0, customerId: null, odemeYolu: null };
  const gunSonu = T('20:59');
  t('★ müşteri düzeltme istediyse iş Bugün\'de (kabulden hemen sonra)', bugunTuru({ ...is, sonProva: 'DUZELTME' }, simdi, gunSonu) === 'prova' && BUGUN_SIRASI.indexOf('prova') === 1);
  t('onaylanan ya da bekleyen prova Bugün\'e satır açmıyor', bugunTuru({ ...is, sonProva: 'ONAYLANDI' }, simdi, gunSonu) === null && bugunTuru({ ...is, sonProva: 'BEKLIYOR' }, simdi, gunSonu) === null);
  t('hazır olmuş işte düzeltme satırı kalmıyor (haber ver öne geçer)', bugunTuru({ ...is, durum: 'HAZIR', sonProva: 'DUZELTME' }, simdi, gunSonu) === 'haber');
}

console.log('\nMesajlar: takip ve prova bağlantısı\n');
{
  const v = { isNo: 'B-1042', musteriAd: 'Ayşe', toplam: '₺570,00', kalan: '₺370,00', firma: 'Örnek Baskı', takipUrl: 'https://x.test/b/ornek/is/J', provaUrl: 'https://x.test/b/ornek/prova/P' };
  t('★ alındı ve hazır mesajında takip bağlantısı', M.mesajYaz('ALINDI', v, 'tr').includes(v.takipUrl) && M.mesajYaz('HAZIR', v, 'tr').includes(v.takipUrl));
  const p = M.mesajYaz('PROVA', v, 'tr');
  t('★ prova mesajında PROVA bağlantısı var, takip bağlantısı yok', p.includes(v.provaUrl) && !p.includes(v.takipUrl) && p.includes('B-1042'), p);
  t('kısa adı olmayan matbaada bağlantı satırı yazılmıyor', !/https?:/.test(M.mesajYaz('HAZIR', { ...v, takipUrl: null }, 'tr')));
  const o = { kalan: 100, ibanVar: true, cari: false };
  t('★ onay bekleyen prova varsa ilk düğme prova', M.onerilenMesajlar('SIRADA', { ...o, provaBekliyor: true })[0] === 'PROVA' && !M.onerilenMesajlar('SIRADA', o).includes('PROVA'));
  t('hazır ve teslim edilmiş işte prova düğmesi yok', !M.onerilenMesajlar('HAZIR', { ...o, provaBekliyor: true }).includes('PROVA') && !M.onerilenMesajlar('TESLIM', { ...o, provaBekliyor: true }).includes('PROVA'));
  t('İngilizce prova mesajında Türkçe kalmadı', !/[çğışöüÇĞİŞÖÜ]/.test(M.mesajYaz('PROVA', { ...v, musteriAd: 'Ann', firma: 'Print Co' }, 'en')));
}

console.log('\nMüşteri metinleri\n');
{
  const duz = (o, on = '') => Object.entries(o).flatMap(([k, d]) => (typeof d === 'string' ? [[on + k, d]] : duz(d, `${on}${k}.`)));
  const tr = duz(MM.musteriMetni('tr')), en = duz(MM.musteriMetni('en'));
  t(`${tr.length} metin, iki dilde aynı anahtarlar`, JSON.stringify(tr.map((x) => x[0])) === JSON.stringify(en.map((x) => x[0])));
  t('★ İngilizce müşteri metninde Türkçe kalmadı', en.filter(([, d]) => /[çğışöüÇĞİŞÖÜ]/.test(d)).length === 0, en.filter(([, d]) => /[çğışöüÇĞİŞÖÜ]/.test(d)).map((x) => x[0]));
  t('boş metin yok', [...tr, ...en].every(([, d]) => d.trim() !== ''));
  const yer = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  t('★ yer tutucular iki dilde aynı', tr.every(([, d], i) => yer(d) === yer(en[i][1])), tr.filter(([, d], i) => yer(d) !== yer(en[i][1])).map((x) => x[0]));
}

console.log('\nKaynak denetimi: girişsiz uçlar ve sayfalar\n');
{
  const uclar = yuru(join(KOK, 'src/app/api/b')).filter((f) => f.endsWith('route.ts'));
  t(`${uclar.length} girişsiz uç var`, uclar.length >= 5, uclar.length);
  const kapi = oku('src/lib/baski-musteri-uc.ts');
  const korumasiz = uclar.filter((f) => { const s = readFileSync(f, 'utf8'); return !/sinirAsildi\(|dosyaCagirani\(|musteriIsi\(/.test(s); }).map((f) => f.slice(KOK.length + 1));
  t('★ /api/b altındaki her uç hız sınırından geçiyor', korumasiz.length === 0, korumasiz);
  const kiraciOkuyan = uclar.filter((f) => /tenantId\s*[:=]\s*(g|body|govde)\.|g\.tenantId|searchParams\.get\('tenant/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(KOK.length + 1));
  t('★ hiçbir girişsiz uç kiracıyı istekten okumuyor', kiraciOkuyan.length === 0, kiraciOkuyan);
  t('★ ortak kapı: işletme kısa addan, iş jetondan ve AYNI kiracıdan', /kisaAddanMatbaa\(String\(g\.kisaAd/.test(kapi) && /where: \{ jeton: g\.jeton, tenantId: m\.tenant\.id \}/.test(kapi) && /jetonGecerli\(g\.jeton\)/.test(kapi));
  t('★ hız sınırı vekilin yazdığı IP ile (sahte başlığa kanmıyor)', /istemciIp\(req\)/.test(kapi) && !/clientIp/.test(kapi));
  t('★ dosya uçlarında personel yolu matbaa kapısından geçiyor', /typeof g\.isId === 'string'[\s\S]{0,120}requireMatbaaUser\(\)/.test(kapi));
  const ayar = oku('src/lib/matbaa-ayar-kayit.ts');
  t('★ kapalı, askıda, silinmiş ya da matbaa olmayan işletmenin müşteri tarafı kapalı', /!tenant\.isActive \|\| tenant\.isSuspended \|\| tenant\.deletedAt \|\| hesapTuru\(tenant\.hesapTuru\) !== 'MATBAA'/.test(ayar));

  const sip = oku('src/app/api/b/siparis/route.ts');
  t('★ sipariş: sayfa kapalıysa iş açılmıyor', /!m \|\| !m\.ayar\.siparisAcik\) return baskiHatasi\('SIPARIS_KAPALI'/.test(sip));
  t('★ sipariş: bal küpü doluysa iş açılmıyor', /g\.web === 'string' && g\.web\.trim\(\)\) return/.test(sip) && sip.indexOf('g.web') < sip.indexOf('isOlustur('));
  t('★ sipariş: işletme başına da sınır var', /b:siparis-isletme:\$\{m\.tenant\.id\}/.test(sip));
  t('★ sipariş: müşteri olarak açılıyor (personel: false), tutar istekten okunmuyor', /\{ personel: false \}/.test(sip) && !/g\.(toplam|tutar|fiyat)/.test(sip));
  t('sipariş: havale yalnız ayar açık ve IBAN varken', /g\.odemeYolu === 'HAVALE' && m\.ayar\.havaleKabul && !!m\.tenant\.odemeIban/.test(sip));
  t('★ sipariş ad ve telefon istiyor', /AD_SOYAD_GEREKLI/.test(sip) && /TELEFON_GEREKLI/.test(sip));

  const takip = oku('src/lib/baski-takip.ts');
  const secim = /select: \{([\s\S]*?)\n    \},\n  \}\);/.exec(takip)?.[1] ?? '';
  t('★ takip sayfası iç notu, iptal nedenini, telefonu ve personel adını OKUMUYOR', secim.length > 100 && !/\bnot: true|iptalNedeni|telefon: true|olusturanAd|kullaniciAd|aliciAd|anahtar: true/.test(secim), secim.slice(0, 200));
  t('★ takip: iş yalnız kısa adın kiracısında aranıyor', /where: \{ jeton, tenantId: m\.tenant\.id \}/.test(takip));
  t('★ tutar kesinleşmeden IBAN gösterilmiyor', /!is\.tahmini && m\.ayar\.havaleKabul && m\.tenant\.odemeIban/.test(takip));
  const takipSayfa = oku('src/app/b/[kisaAd]/is/[jeton]/page.tsx');
  t('★ takip ve prova sayfaları arama motoruna kapalı', /index: false, follow: false/.test(takipSayfa) && /index: false, follow: false/.test(oku('src/app/b/[kisaAd]/prova/[jeton]/page.tsx')));
  t('takip sayfası veriyi istek başına bir kez okuyor', /const veri = cache\(takipVerisi\)/.test(takipSayfa));

  const prova = oku('src/lib/baski-prova.ts');
  t('★ prova yanıtı koşullu yazılıyor (bekliyor ve süresi dolmamış)', /updateMany\(\{ where: \{ id: r\.p\.id, tenantId, durum: 'BEKLIYOR', sonTarih: \{ gt: simdi \} \}/.test(prova) && /y\.count !== 1\) return false/.test(prova));
  t('★ yeni prova yüklenince eski bekleyen bağlantı kapanıyor', /updateMany\(\{ where: \{ isId, tenantId, durum: 'BEKLIYOR', sonTarih: \{ gt: simdi \} \}, data: \{ sonTarih: simdi \} \}\)/.test(prova));
  t('prova jetonu kriptografik rastgele', /randomBytes\(18\)\.toString\('base64url'\)/.test(prova));

  const kayit = oku('src/lib/baski-dosya-kayit.ts');
  t('★ yükleme kapanırken parçalar depodan sayılıyor (tarayıcının sözüne güvenilmiyor)', /parcalariOku\(r2, d\.anahtar, d\.yuklemeId\)/.test(kayit) && /!parcalarTam\(parcalar, d\.boyut\)\) return \{ ok: false, kod: 'YUKLEME_EKSIK' \}/.test(kayit));
  t('★ müşterinin yüklediği dosya prova sayılamıyor', /kim\.tur === 'PERSONEL' && g\.tur === 'PROVA' \? 'PROVA' : 'BASKI'/.test(kayit));
  t('★ yarım yüklemeler de sınıra sayılıyor', /durum: \{ in: \['HAZIR', 'YUKLENIYOR'\] \}/.test(kayit));
  t('★ dosya sorgularının hepsi kiracıya kapsamlı', (kayit.match(/baskiDosyasi\.(findFirst|updateMany|deleteMany)\(\{ where: \{[^}]*\}/g) ?? []).every((s) => /tenantId/.test(s)), (kayit.match(/baskiDosyasi\.(findFirst|updateMany|deleteMany)\(\{ where: \{[^}]*\}/g) ?? []).filter((s) => !/tenantId/.test(s)));
  t('★ depo silmesi başarısız olan dosya "silindi" işaretlenmiyor', /if \(!\(await nesneSil\(r2, d\.anahtar\)\)\) \{ hata\+\+; continue; \}/.test(kayit));
  const indir = oku('src/app/api/matbaa/dosyalar/[id]/route.ts');
  t('★ indirme oturum ve matbaa kapısından geçip imzalı adrese yönleniyor', /requireMatbaaUser\(\)/.test(indir) && /NextResponse\.redirect\(r\.url/.test(indir) && /no-store/.test(indir));
  t('★ dosyayı operatör kaldıramıyor', /DELETE[\s\S]*requireMatbaaUser\(\['ADMIN', 'FRONT_DESK'\]\)/.test(indir));
  t('saklama işi zamanlayıcıda ve CRON_SECRET istiyor', /anahtar: 'matbaa-temizlik'/.test(oku('src/lib/zamanlayici.ts')) && /if \(!secret\) return false/.test(oku('src/app/api/cron/matbaa-temizlik/route.ts')));
  t('★ ağır PDF kitaplığı yok: ön kontrol dosyanın metninden', !/pdfjs|pdf-lib/.test(oku('package.json')) && /pdfSayfaSay\(tam\)/.test(oku('src/lib/baski-yukle.ts')));
  t('AWS SDK yok: imza elle (lib/r2)', !/@aws-sdk/.test(oku('package.json')));

  const kabul = oku('src/lib/baski-is-kayit.ts');
  t('★ online iş kabul edilince söz verilen saat yazılıyor (yalnız boşsa)', /if \(is\.sozVerilenAt\) return null;/.test(kabul) && /once === 'GELEN' && sonra === 'SIRADA' \? await kabulSaati/.test(kabul) && /\.\.\.\(soz \? \{ sozVerilenAt: soz \} : \{\}\) \},/.test(kabul));
  const ayarUc = oku('src/app/api/matbaa/ayar/route.ts');
  t('★ sipariş sayfası ayarını yalnız sahip değiştiriyor', /requireMatbaaUser\(\['ADMIN'\]\)/.test(ayarUc));
  const fis = oku('src/app/(dashboard)/matbaa/isler/[id]/fis/page.tsx');
  t('★ fiş: iş kiracıya kapsamlı, operatör açamıyor, QR takip adresinden', /where: \{ id, tenantId: user\.tenantId \}/.test(fis) && /user\.role === 'TECHNICIAN'\) redirect/.test(fis) && /QRCode\.toString\(takip/.test(fis));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
