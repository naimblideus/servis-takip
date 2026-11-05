// BASKI MESAJLARI VE MATBAA DEMOSU
// Çalıştır:  node scripts/test-baski-mesaj.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
//   · Müşteriye giden metinde yanlış tutar ya da eksik IBAN, tam da kaldırmak
//     istediğimiz WhatsApp turunu geri getirir.
//   · Henüz olmayan takip sayfasının bağlantısı metne sızarsa müşteri "açılmıyor" yazar.
//   · Demo tutarları elle yazılı (betik TypeScript motorunu yükleyemiyor). Fiyat
//     listesi değişip iş tutarı değişmezse demoda tutarlar sessizce yalan söyler.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-mesaj-'));
let M, B, F, O, C;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['baski-mesaj', 'baski-is', 'baski-fiyat', 'baski-cari', 'odeme-bilgisi'].map((k) => join(KOK, `src/lib/${k}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  for (const k of ['baski-mesaj', 'baski-is']) {
    const y = join(g, `${k}.js`);
    writeFileSync(y, readFileSync(y, 'utf8').replace(/from '\.\/([\w-]+)'/g, "from './$1.js'"), 'utf8');
  }
  const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
  [M, B, F, O, C] = await Promise.all(['baski-mesaj', 'baski-is', 'baski-fiyat', 'odeme-bilgisi', 'baski-cari'].map(al));
} finally {
  rmSync(g, { recursive: true, force: true });
}
const D = await import(pathToFileURL(join(KOK, 'scripts/seed-demo-matbaa.mjs')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');
const { mesajYaz, onerilenMesajlar, mesajTuru, MESAJ_TURLERI } = M;

console.log('\nBaskı mesajları\n');

const v = { isNo: 'B-1042', musteriAd: 'Ayşe', ozet: 'A4 · 2 nüsha', toplam: '₺570,00', kalan: '₺370,00', saat: '14:30', firma: 'Örnek Baskı', adres: 'Örnek Cad. 1', iban: 'TR330006100519786457841326', hesapAdi: 'Örnek Baskı' };
{
  const a = mesajYaz('ALINDI', v, 'tr');
  t('★ alındı: iş no, özet, tutar, saat, imza', ['B-1042', 'A4 · 2 nüsha', '₺570,00', '14:30', 'Örnek Baskı', 'Merhaba Ayşe,'].every((x) => a.includes(x)), a);
  t('★ takip bağlantısı verilmedikçe metinde bağlantı yok (sayfa Faz B)', !/https?:|Takip/.test(a));
  t('bağlantı verilince yazılıyor', mesajYaz('ALINDI', { ...v, takipUrl: 'https://x.test/b' }, 'tr').includes('https://x.test/b'));
  const h = mesajYaz('HAZIR', v, 'tr');
  t('★ hazır: kalan tutar ve adres', h.includes('hazır') && h.includes('₺370,00') && h.includes('Örnek Cad. 1'), h);
  t('ödenmiş işte hazır mesajı tutar söylemiyor', !/Ödenecek/.test(mesajYaz('HAZIR', { ...v, kalan: null }, 'tr')));
  const o = mesajYaz('ODEME', v, 'tr');
  t('★ ödeme: kalan tutar, okunur IBAN, alıcı, açıklamada iş no', o.includes('₺370,00') && o.includes('TR33 0006 1005 1978 6457 8413 26') && o.includes('Alıcı: Örnek Baskı') && o.includes('Açıklama: B-1042'), o);
  t('teşekkür', mesajYaz('TESEKKUR', v, 'tr').includes('teşekkür'));
  t('adsız müşteride selam bozulmuyor', mesajYaz('TESEKKUR', { ...v, musteriAd: null }, 'tr').startsWith('Merhaba,'));
  t('adressiz matbaada "Adres:" satırı yok; "null" yazılmıyor', !/Adres|null|undefined/.test(mesajYaz('HAZIR', { ...v, adres: null, kalan: null }, 'tr')));
  const turk = /[ğĞıİşŞöÖüÜçÇ]/;
  const enMetin = MESAJ_TURLERI.map((m) => mesajYaz(m, { ...v, ozet: 'x', firma: 'Shop', hesapAdi: 'Shop', adres: 'Road', musteriAd: 'Ann' }, 'en')).join('\n');
  t('★ İngilizce metinde Türkçe kalmadı', !turk.test(enMetin), enMetin);
  t('tür doğrulaması', mesajTuru('HAZIR') === 'HAZIR' && mesajTuru('X') === null && mesajTuru(undefined) === null);
}

// ── HANGİ DURUMDA HANGİ MESAJ ───────────────────────────────────────────
{
  const on = (d, ek = {}) => onerilenMesajlar(d, { kalan: 100, ibanVar: true, cari: false, ...ek }).join();
  t('★ açık işte ana düğme "alındı", borç varsa IBAN', on('SIRADA') === 'ALINDI,ODEME' && on('GELEN') === 'ALINDI,ODEME');
  t('★ hazır işte ana düğme "hazır"', on('HAZIR') === 'HAZIR,ODEME');
  t('★ IBAN girilmemişse ödeme mesajı yok (hesapsız ödeme bilgisi bir tur daha yazdırır)', on('HAZIR', { ibanVar: false }) === 'HAZIR');
  t('ödenmiş işte ödeme mesajı yok', on('HAZIR', { kalan: 0 }) === 'HAZIR');
  t('cari işe teslimden önce IBAN gönderilmiyor; teslimden sonra hatırlatılır', on('BASKIDA', { cari: true }) === 'ALINDI' && on('TESLIM', { cari: true }) === 'ODEME,TESEKKUR');
  t('teslim edilmiş ödenmiş iş: teşekkür', on('TESLIM', { kalan: 0 }) === 'TESEKKUR');
  t('iptal işe mesaj yok', on('IPTAL') === '');
}

// ── KAYNAK ──────────────────────────────────────────────────────────────
{
  const k = oku('src/lib/baski-is-kayit.ts');
  t('★ haberVerildiAt yalnız hazır işte hazır mesajıyla yazılıyor, ilk an korunuyor', /tur === 'HAZIR' && is\.durum === 'HAZIR'/.test(k) && /haberVerildiAt: null \}, data: \{ haberVerildiAt: new Date\(\)/.test(k));
  t('dokunuş geçmişe yazılıyor', /tur: 'BILDIRIM', metin: tur/.test(k));
  const uc = oku('src/app/api/matbaa/isler/[id]/mesaj/route.ts');
  t('★ operatör mesaj kaydedemiyor; uç mesaj göndermiyor', /requireMatbaaUser\(\['ADMIN', 'FRONT_DESK'\]\)/.test(uc) && !/fetch\(|sendWhats/i.test(uc));
  const dugme = oku('src/components/matbaa/MesajDugmesi.tsx');
  t('★ düğme gerçek bağlantı (pencere engelleyici), kayıt keepalive', /<a ref=\{bag\} href=\{url\}/.test(dugme) && /keepalive: true/.test(dugme) && !/window\.open\(/.test(dugme));
  t('★ demoda koruma tıklamayı alsa da satır kapanıyor', /dispatchEvent\(new Event\('demo-baglanti'\)\)/.test(oku('src/components/DemoBaglantiKoruma.tsx')) && /addEventListener\('demo-baglanti'/.test(dugme));
  t('Bugün "Haber ver" tek dokunuş', /tur === 'haber' \? <MesajDugmesi/.test(oku('src/app/(dashboard)/matbaa/page.tsx')));
  const ay = oku('src/app/(dashboard)/matbaa/isler/[id]/page.tsx');
  t('★ müşteriye giden metin bayinin dilinde ve para biriminde', /bicimYap\(bayiDili, is\.tenant\.currency\)/.test(ay) && /\}, bayiDili\)\)/.test(ay));
  t('operatör mesaj düğmesi görmüyor', /operator \|\| tahminiKabul \? \[\] : onerilenMesajlar/.test(ay));
}

// ── MATBAA DEMOSU ───────────────────────────────────────────────────────
console.log('\nMatbaa demosu\n');
{
  const { DEMO_URUNLERI, DEMO_ISLERI, MATBAA_SLUG } = D;
  const { urunTanimi, fiyatliMi, fiyatHesapla } = F;
  const { isHesapla, bugunSatirlari, AKIS, gecisIzinli, isDurumu } = B;
  const satirlar = DEMO_URUNLERI.map((u) => ({ ...u, id: u.sablonKodu, aktif: true }));

  t('demo adı demo öneki taşıyor (kayıt bu adları vermiyor)', /^demo(-|$)/.test(MATBAA_SLUG));
  const fiyatsiz = DEMO_URUNLERI.filter((u) => !fiyatliMi(urunTanimi(u))).map((u) => u.sablonKodu);
  t('★ fiyat listesinde tam iki fiyatsız ürün (uyarı görünsün)', fiyatsiz.join() === 'canvas,plan-a0', fiyatsiz);

  const yanlis = [];
  for (const d of DEMO_ISLERI) {
    const h = isHesapla(satirlar, d.kalemler.map((k) => ({ urunId: k.girdi.sablonKodu, adet: k.girdi.adet, sayfa: k.girdi.sayfa, enCm: k.girdi.enCm, boyCm: k.girdi.boyCm, secimler: k.girdi.secimler })), { personel: d.kanal !== 'ONLINE' });
    if (!h.ok || h.toplam !== d.toplam) yanlis.push({ no: d.no, yazili: d.toplam, motor: h.toplam ?? h.kod });
    else {
      if (h.kalemler[0].ozet !== d.kalemler[0].ozet) yanlis.push({ no: d.no, ozet: h.kalemler[0].ozet, yazili: d.kalemler[0].ozet });
      if (h.bitisGerekli !== (d.bitis === true)) yanlis.push({ no: d.no, bitis: h.bitisGerekli });
      if (h.tahmini !== (d.tahmini === true)) yanlis.push({ no: d.no, tahmini: h.tahmini });
    }
    const secim = d.kalemler[0].girdi;
    const u = urunTanimi(satirlar.find((x) => x.id === secim.sablonKodu));
    if (!fiyatHesapla(u, { ...secim }).ok) yanlis.push({ no: d.no, hesap: 'yok' });
  }
  t('★ her demo işinin tutarı, özeti, bitiş ve tahmini bayrağı fiyat motoruyla aynı', yanlis.length === 0, yanlis);

  const simdi = new Date();
  const gunSonu = new Date(+simdi + 12 * 3_600_000);
  const isler = DEMO_ISLERI.map((d) => ({
    id: String(d.no), durum: d.durum, toplam: d.toplam, odenen: (d.odeme ?? []).reduce((a, [, x]) => a + x, 0),
    customerId: d.musteri ?? null, odemeYolu: d.odemeYolu ?? null,
    sozVerilenAt: d.soz !== undefined ? new Date(+simdi + d.soz * 3_600_000) : null,
    haberVerildiAt: d.haber !== undefined ? new Date(+simdi + d.haber * 3_600_000) : null,
  }));
  const turler = new Set(bugunSatirlari(isler, simdi, gunSonu).map((s) => s.tur));
  t('★ Bugün listesinde beş satır türünün hepsi var', ['gelen', 'haber', 'gec', 'bugun', 'odeme'].every((x) => turler.has(x)), [...turler]);
  const sutunlar = new Set(DEMO_ISLERI.map((d) => d.durum));
  t('★ panoda her sütunda iş var', AKIS.every((x) => sutunlar.has(x)), [...sutunlar]);
  const yollar = new Set(DEMO_ISLERI.flatMap((d) => (d.odeme ?? []).filter(([, , s]) => s > -24).map(([y]) => y)));
  t('★ kasada bugün nakit, kart ve havale var', ['NAKIT', 'KART', 'HAVALE'].every((x) => yollar.has(x)), [...yollar]);
  t('cariye yazılan iş var, kayıtlı müşteriyle', DEMO_ISLERI.some((d) => d.odemeYolu === 'CARI' && d.musteri && d.durum === 'TESLIM'));
  t('iş numaraları tekil', new Set(DEMO_ISLERI.map((d) => d.no)).size === DEMO_ISLERI.length);
  const kurali = DEMO_ISLERI.filter((d) => d.durum === 'TESLIM').filter((d) => !gecisIzinli('HAZIR', 'TESLIM', {
    rol: 'FRONT_DESK', toplam: d.toplam, odenen: (d.odeme ?? []).reduce((a, [, x]) => a + x, 0), cari: !!d.musteri && d.odemeYolu === 'CARI', bitisGerekli: d.bitis === true,
  }).ok).map((d) => d.no);
  t('★ demoda teslim edilmiş iş para kuralına uyuyor', kurali.length === 0, kurali);
  t('durum adları geçerli', DEMO_ISLERI.every((d) => isDurumu(d.durum)));

  const kaynak = oku('scripts/seed-demo-matbaa.mjs');
  t('★ yalnız demo bayraklı kayıt siliniyor', /if \(!eski\.demo\) throw/.test(kaynak));
  const gece = Date.parse('2026-11-05T03:30:00+03:00'), oglen = Date.parse('2026-11-05T12:00:00+03:00');
  t('★ demo saatleri gece kurulumundan bağımsız: gün boyu aynı öğle', D.gununOglesi(gece) === oglen && D.gununOglesi(Date.parse('2026-11-05T23:50:00+03:00')) === oglen);
  t('★ bugünkü ödemeler gece kurulsa da bugünün kasasında (öğleden en çok 5 saat önce)', DEMO_ISLERI.flatMap((d) => d.odeme ?? []).filter(([, , x]) => x > -24).every(([, , x]) => x >= -5));
  t('hesap türü MATBAA, demo bayraklı', /hesapTuru: 'MATBAA'/.test(kaynak) && /demo: true/.test(kaynak));
  t('★ örnek IBAN kontrol toplamından geçiyor, gerçek banka kodu değil', (() => {
    const govde = '9999900000000000001234';
    let kalan = 0;
    for (const r of `${govde}292700`) kalan = (kalan * 10 + Number(r)) % 97;
    return O.ibanGecerli(`TR${String(98 - kalan).padStart(2, '0')}${govde}`) && /const govde = '9999900000000000001234'/.test(kaynak);
  })());
  const tohum = oku('scripts/seed-bayi-demo.mjs');
  t('★ gece tazelemesi matbaa demosunu kuruyor; kurulamazsa bayi demoları durmuyor', /import\('\.\/seed-demo-matbaa\.mjs'\)/.test(tohum) && /matbaa demosu kurulamadı/.test(tohum));
  t('imaj tohum dosyasını alıyor (seed-*.mjs)', /scripts\/seed-\*\.mjs/.test(oku('Dockerfile')));
  t('demo tohumu sürümü artırıldı', /DEMO_TOHUM_SURUMU = '2026-11-05-matbaa-demosu'/.test(oku('src/lib/zamanlayici.ts')));

  // Cari: tohumun yazdığı kayıtlar uzlaştırmada değişmemeli.
  const d = DEMO_ISLERI.find((x) => x.no === 1029);
  const T = new Date('2026-11-01T10:00:00Z'), P = new Date('2026-11-02T10:00:00Z');
  const plan = C.cariPlani(
    { id: 'i', no: d.no, durum: d.durum, toplam: d.toplam, customerId: 'm', createdAt: T, odemeler: [{ tutar: 45000, yol: 'HAVALE', tarih: P }], kim: null },
    [{ id: 'a', type: 'SALE', amount: d.toplam / 100, product: `Baskı B-${d.no}`, date: T, method: 'OPEN_ACCOUNT', customerId: 'm' },
      { id: 'b', type: 'PAYMENT', amount: 450, product: null, date: P, method: 'TRANSFER', customerId: 'm' }],
  );
  t('★ tohumun cari kayıtları uzlaştırmayla aynı biçimde', C.planBosMu(plan), plan);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
