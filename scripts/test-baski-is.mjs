// BASKI İŞİ — durum geçişleri, para kapısı, iş numarası, iş hesabı
// Çalıştır:  node scripts/test-baski-is.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Panoda her kartta tek düğme var; o düğmenin nereye götürdüğü, kimin
// basabileceği ve ne zaman BASAMAYACAĞI parayı doğrudan etkiliyor:
//   · Parası alınmamış iş teslim edilirse para kaybolur ("sonra öderim").
//   · Parası alınmış iş iptal edilirse kasa tutmaz.
//   · İstemcinin gönderdiği tutara güvenilirse sipariş sayfasından 1 ₺'lik
//     poster siparişi gelir.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-is-'));
let B;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/baski-is.ts'), join(KOK, 'src/lib/baski-fiyat.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  const y = join(g, 'baski-is.js');
  writeFileSync(y, readFileSync(y, 'utf8').replace("from './baski-fiyat'", "from './baski-fiyat.js'"), 'utf8');
  B = await import(pathToFileURL(y).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const { AKIS, DURUMLAR, sonrakiDurum, gecisIzinli, odemeGecerli, odemeDurumu, kalan, isNo, isNoCoz, sonrakiNo, ILK_NO,
  gecikiyorMu, haberBekliyorMu, bitisGerekliMi, isHesapla, isDurumu, kanal } = B;

const bag = (ek = {}) => ({ rol: 'FRONT_DESK', toplam: 10000, odenen: 10000, cari: false, bitisGerekli: false, ...ek });
const izin = (a, b, ek) => gecisIzinli(a, b, bag(ek));

console.log('\nBaskı işi\n');

// ── AKIŞ ────────────────────────────────────────────────────────────────
{
  t('akış sırası: Gelen → Sırada → Baskıda → Bitiş → Hazır → Teslim', AKIS.join() === 'GELEN,SIRADA,BASKIDA,BITIS,HAZIR,TESLIM');
  t('sonraki adım: bitişsiz iş Baskıda\'dan Hazır\'a', sonrakiDurum('BASKIDA', false) === 'HAZIR');
  t('★ bitişli iş Baskıda\'dan Bitiş\'e', sonrakiDurum('BASKIDA', true) === 'BITIS' && sonrakiDurum('BITIS', true) === 'HAZIR');
  t('teslim ve iptalden sonraki adım yok', sonrakiDurum('TESLIM', false) === null && sonrakiDurum('IPTAL', false) === null);
  t('her "sonraki adım" izinli (parası alınmış işte)', AKIS.slice(0, -1).every((d) => izin(d, sonrakiDurum(d, true), { bitisGerekli: true }).ok));
  t('★ adım atlanmıyor (Sırada → Teslim, Gelen → Baskıda)', izin('SIRADA', 'TESLIM').kod === 'GECIS_YOK' && izin('GELEN', 'BASKIDA').kod === 'GECIS_YOK');
  t('bitiş gerekse de "bitişe gerek kalmadı" (Baskıda → Hazır)', izin('BASKIDA', 'HAZIR', { bitisGerekli: true }).ok);
  t('geri bir adım (yanlış dokunuş)', izin('BASKIDA', 'SIRADA').ok && izin('TESLIM', 'HAZIR').ok);
  t('bitişsiz işte Hazır\'dan geri Baskıda\'ya', izin('HAZIR', 'BASKIDA').ok);
  t('aynı duruma geçiş yok', izin('HAZIR', 'HAZIR').kod === 'GECIS_YOK');
  t('durum adı normalleşiyor', isDurumu('HAZIR') === 'HAZIR' && isDurumu('hazir') === null && kanal('X') === 'TEZGAH' && kanal('ONLINE') === 'ONLINE');
  t('DURUMLAR akış + iptal', DURUMLAR.length === 7 && DURUMLAR.includes('IPTAL'));
}

// ── PARA KAPISI ─────────────────────────────────────────────────────────
{
  t('★ parası alınmamış iş teslim edilmiyor', izin('HAZIR', 'TESLIM', { odenen: 5000 }).kod === 'ODEME_EKSIK');
  t('tamamı ödenmiş iş teslim ediliyor', izin('HAZIR', 'TESLIM').ok);
  t('★ cari müşterinin işi ödemesiz teslim ediliyor (borç cariye)', izin('HAZIR', 'TESLIM', { odenen: 0, cari: true }).ok);
  t('★ parası alınmış iş iptal edilmiyor: önce iade', izin('SIRADA', 'IPTAL', { odenen: 1 }).kod === 'ODENMIS_IPTAL');
  t('ödenmemiş iş iptal ediliyor', izin('BASKIDA', 'IPTAL', { odenen: 0 }).ok);
  t('teslim edilmiş iş iptal edilmiyor', izin('TESLIM', 'IPTAL', { odenen: 0 }).kod === 'GECIS_YOK');
  t('★ tahmini fiyatlı online iş onaylanmadan kabul edilmiyor', izin('GELEN', 'SIRADA', { tahmini: true }).kod === 'FIYAT_TAHMINI' && izin('GELEN', 'SIRADA').ok);
}

// ── ROLLER ──────────────────────────────────────────────────────────────
{
  const op = (a, b, ek) => izin(a, b, { rol: 'TECHNICIAN', ...ek });
  t('★ operatör üretim adımlarını atıyor', op('SIRADA', 'BASKIDA').ok && op('BASKIDA', 'BITIS', { bitisGerekli: true }).ok && op('BITIS', 'HAZIR').ok && op('BASKIDA', 'HAZIR').ok);
  t('★ operatör kabul, teslim, iptal yapmıyor', op('GELEN', 'SIRADA').kod === 'YETKI_YOK' && op('HAZIR', 'TESLIM').kod === 'YETKI_YOK' && op('SIRADA', 'IPTAL', { odenen: 0 }).kod === 'YETKI_YOK');
  t('operatör teslimi geri almıyor', op('TESLIM', 'HAZIR').kod === 'YETKI_YOK');
  t('★ iptalden dönüş yalnız yöneticide, Sırada\'ya', izin('IPTAL', 'SIRADA').kod === 'YETKI_YOK' && izin('IPTAL', 'SIRADA', { rol: 'ADMIN' }).ok && izin('IPTAL', 'HAZIR', { rol: 'ADMIN' }).kod === 'GECIS_YOK');
}

// ── ÖDEME ───────────────────────────────────────────────────────────────
{
  const is = { toplam: 10000, odenen: 4000, durum: 'HAZIR' };
  t('geçerli ödeme', odemeGecerli({ tutar: 6000, yol: 'NAKIT' }, is).ok);
  t('★ kalanı aşan ödeme reddediliyor (para üstü kasada)', odemeGecerli({ tutar: 6001, yol: 'NAKIT' }, is).kod === 'FAZLA_ODEME');
  t('kuruş tam sayı, pozitif', ['1.5', 0, -5, 'x', null].every((x) => odemeGecerli({ tutar: x, yol: 'KART' }, is).kod === 'TUTAR_GECERSIZ'));
  t('bilinmeyen yol reddediliyor (cari ödeme değil)', odemeGecerli({ tutar: 100, yol: 'CARI' }, is).kod === 'YOL_GECERSIZ');
  t('iptal edilmiş işe ödeme girilmiyor', odemeGecerli({ tutar: 100, yol: 'NAKIT' }, { ...is, durum: 'IPTAL' }).kod === 'IS_KAPALI');
  t('teslim edilmiş (cari) işe ödeme giriliyor', odemeGecerli({ tutar: 100, yol: 'HAVALE' }, { ...is, durum: 'TESLIM' }).ok);
  t('ödeme durumu', odemeDurumu(10000, 0) === 'BEKLIYOR' && odemeDurumu(10000, 1) === 'KISMI' && odemeDurumu(10000, 10000) === 'ODENDI' && odemeDurumu(10000, 0, true) === 'CARI');
  t('kalan eksiye düşmüyor', kalan(100, 150) === 0 && kalan(100, 30) === 70);
}

// ── İŞ NUMARASI ─────────────────────────────────────────────────────────
{
  t('★ ilk iş B-1001', sonrakiNo(null) === ILK_NO && isNo(sonrakiNo(null)) === 'B-1001');
  t('sonraki numara', sonrakiNo(1041) === 1042);
  t('bozuk en büyük numara ilk numaraya düşüyor', sonrakiNo(NaN) === ILK_NO && sonrakiNo(5) === ILK_NO);
  t('arama: "B-1042", "b1042", "1042"', isNoCoz('B-1042') === 1042 && isNoCoz('b1042') === 1042 && isNoCoz(' 1042 ') === 1042 && isNoCoz('B 1042') === 1042);
  t('arama: tanınmayan metin null', isNoCoz('Ahmet') === null && isNoCoz('') === null && isNoCoz(null) === null);
}

// ── ZAMAN ───────────────────────────────────────────────────────────────
{
  const simdi = new Date('2026-11-02T12:00:00Z');
  const once = '2026-11-02T11:00:00Z';
  t('★ söz verilen saat geçti, iş hazır değil: gecikiyor', gecikiyorMu({ durum: 'BASKIDA', sozVerilenAt: once }, simdi));
  t('hazır, teslim, iptal ve saatsiz iş gecikmiyor', ['HAZIR', 'TESLIM', 'IPTAL'].every((d) => !gecikiyorMu({ durum: d, sozVerilenAt: once }, simdi)) && !gecikiyorMu({ durum: 'SIRADA', sozVerilenAt: null }, simdi));
  t('★ hazır ama haber verilmemiş', haberBekliyorMu({ durum: 'HAZIR', haberVerildiAt: null }) && !haberBekliyorMu({ durum: 'HAZIR', haberVerildiAt: simdi }) && !haberBekliyorMu({ durum: 'BASKIDA', haberVerildiAt: null }));
}

// ── İŞ HESABI ───────────────────────────────────────────────────────────
{
  const urunler = [
    { id: 'a4', ad: 'A4 Renkli', kategori: 'FOTOKOPI', fiyatModeli: 'SAYFA', kademeler: [{ min: 1, fiyat: 500 }],
      secenekler: [{ kod: 'cilt', ad: 'Cilt', degerler: [{ kod: 'yok', ad: 'Ciltsiz', tur: 'CARPAN', deger: 1, varsayilan: true }, { kod: 'spiral', ad: 'Spiral', tur: 'BIRIM', taban: 'NUSHA', deger: 3000 }] }] },
    { id: 'poster', ad: 'Poster', kategori: 'BUYUK_BASKI', fiyatModeli: 'ALAN', kademeler: [{ min: 1, fiyat: 30000 }] },
    { id: 'spiral', ad: 'Spiral cilt', kategori: 'CILT', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 3000 }] },
    { id: 'fiyatsiz', ad: 'Kaşe', kategori: 'DIGER', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 0 }] },
    { id: 'pasif', ad: 'Eski', kategori: 'DIGER', fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 100 }], aktif: false },
  ];
  const r = isHesapla(urunler, [
    { urunId: 'a4', adet: 2, sayfa: 10, tutar: 1 },
    { urunId: 'poster', adet: 1, enCm: 50, boyCm: 70 },
  ], { personel: true });
  t('★ iş tutarı fiyat listesinden: 2×10×5 ₺ + 0,35 m²×300 ₺ = 205 ₺', r.ok && r.toplam === 10000 + 10500, r);
  t('KDV parçaları toplanıyor', r.kdvHaric + r.kdv === r.toplam);
  t('kalem özeti ve seçimler kaydediliyor', r.kalemler[0].ozet === 'A4 Renkli · 2 nüsha · 10 sf · Ciltsiz' && r.kalemler[0].secimler.cilt === 'yok', r.kalemler[0]);
  t('kalem ölçüleri modele göre (poster: sayfa yok, ölçü var)', r.kalemler[1].sayfa === null && r.kalemler[1].enCm === 50 && r.kalemler[0].enCm === null);
  t('★ personel girişinde fiyat tahmini değil', r.tahmini === false);
  const online = isHesapla(urunler, [{ urunId: 'a4', adet: 1, sayfa: 10 }], { personel: false });
  t('★ müşteriden gelen sayfa sayısı tahmini; dosyadan okunduysa değil', online.tahmini === true && isHesapla(urunler, [{ urunId: 'a4', adet: 1, sayfa: 10, sayfaDosyadan: true }], { personel: false }).tahmini === false);
  t('bitişsiz iş', r.bitisGerekli === false);
  t('★ spiral seçilen iş bitişe gidiyor', isHesapla(urunler, [{ urunId: 'a4', adet: 1, sayfa: 10, secimler: { cilt: 'spiral' } }], { personel: true }).bitisGerekli === true);
  t('cilt ürünü de bitiş işi', isHesapla(urunler, [{ urunId: 'spiral', adet: 1 }], { personel: true }).bitisGerekli === true);
  t('★ fiyatsız ürünle iş açılmıyor (hangi kalem olduğu söyleniyor)', (() => { const x = isHesapla(urunler, [{ urunId: 'a4', adet: 1, sayfa: 1 }, { urunId: 'fiyatsiz', adet: 1 }], { personel: true }); return x.kod === 'FIYAT_YOK' && x.sira === 1; })());
  t('pasif, başka kiracının ya da olmayan ürün reddediliyor', isHesapla(urunler, [{ urunId: 'pasif', adet: 1 }], { personel: true }).kod === 'URUN_YOK' && isHesapla(urunler, [{ urunId: 'yok', adet: 1 }], { personel: true }).kod === 'URUN_YOK');
  t('kalemsiz ya da 50\'den çok kalemli iş reddediliyor', isHesapla(urunler, [], { personel: true }).kod === 'KALEM_YOK' && isHesapla(urunler, Array(51).fill({ urunId: 'spiral', adet: 1 }), { personel: true }).kod === 'KALEM_YOK');
  t('seçenek hatası grubuyla dönüyor', isHesapla(urunler, [{ urunId: 'a4', adet: 1, sayfa: 1, secimler: { cilt: 'tel' } }], { personel: true }).grup === 'cilt');
  t('bitisGerekliMi: etkisiz seçim (ciltsiz) bitiş değil', !bitisGerekliMi([{ kategori: 'FOTOKOPI', secilenler: [{ grup: 'cilt', kod: 'yok' }] }]));
}

// ── KAYNAK DENETİMİ ─────────────────────────────────────────────────────
{
  const k = readFileSync(join(KOK, 'src/lib/baski-is-kayit.ts'), 'utf8');
  t('★ iş açma tutarı sunucuda hesaplıyor (isHesapla), kiracının aktif ürünleriyle', /isHesapla\(urunler, girdi\.kalemler/.test(k) && /baskiUrunu\.findMany\(\{\s*where: \{ tenantId, id: \{ in:/.test(k) && /aktif: true/.test(k));
  t('★ müşteriden gelen iş GELEN\'de ve ONLINE başlıyor', /o\.personel \? kanalNormal\(girdi\.kanal\) : 'ONLINE'/.test(k) && /kanal === 'ONLINE' \? 'GELEN' : 'SIRADA'/.test(k));
  t('★ müşteri başka kiracınınsa iş açılmıyor', /customer\.findFirst\(\{ where: \{ id: girdi\.customerId, tenantId \}/.test(k));
  t('★ durum ve ödeme koşullu yazılıyor (aynı anda iki dokunuş iki adım atmaz)', /updateMany\(\{\s*where: \{ id: is\.id, tenantId, durum: once \}/.test(k) && /updateMany\(\{ where: \{ id: is\.id, tenantId, odenen: is\.odenen \}/.test(k));
  t('numara çakışmasında yeni numarayla tekrar', /isNoCakismasi\(e\)/.test(k) && /deneme >= DENEME/.test(k));
  t('★ tahmini iş çıkmazda kalmıyor: kabul sayfa sayısını onaylar, tutarı sunucuda yeniden hesaplar, tahmini kaldırır',
    /isHesapla\(urunler, is\.kalemler\.map/.test(k) && /durum: 'SIRADA', tahmini: false, kdvHaric: h\.kdvHaric/.test(k) && /where: \{ id: is\.id, tenantId, durum: 'GELEN' \}/.test(k));
  t('★ operatör kabul edemiyor', /kim\.role === 'TECHNICIAN'\) return \{ ok: false, kod: 'YETKI_YOK' \}/.test(k));
  const ayr = readFileSync(join(KOK, 'src/app/(dashboard)/matbaa/isler/[id]/page.tsx'), 'utf8');
  t('★ ayrıntıda kabul formu var; tutar kesinleşmeden müşteri mesajı önerilmiyor', /tahminiKabul && <KabulFormu/.test(ayr) && /operator \|\| tahminiKabul \? \[\] : onerilenMesajlar/.test(ayr));
  t('takip jetonu kriptografik rastgele', /randomBytes\(18\)\.toString\('base64url'\)/.test(k));
  t('her yazmadan sonra cari uzlaştırılıyor', (k.match(/await baskiIsiCariEsitle\(/g) ?? []).length === 4);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
