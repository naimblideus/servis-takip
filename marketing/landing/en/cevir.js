// Türkçe tanıtım sayfasından İNGİLİZCE sürüm üretir.
//
// NEDEN AYRI BİR HTML DOSYASI YOK:
// İki dilli bir pazarlama sayfasının en sık bozulma şekli, iki HTML dosyasının
// zamanla birbirinden ayrı düşmesidir — TR'ye eklenen bölüm EN'de aylarca
// eksik kalır. Bu yüzden tek kaynak nextus-servis.html'dir; İngilizce sürüm
// build sırasında BELLEKTE üretilir. Diske ikinci bir HTML yazılmaz.
//
// SÖZLÜK KAPISI: Kaynakta çevirisi olmayan bir metin kalırsa üretim DURUR
// (build-landing.js hata verir). Yani Türkçe sayfaya yeni bir cümle eklendiği
// anda "sozluk.json'a İngilizcesini de yaz" uyarısı gelir; sessizce Türkçe
// metin İngilizce sayfaya sızamaz.
const fs = require('fs');
const path = require('path');

// Kaynak HTML CRLF; sözlük JSON'u LF. Çok satırlı bir paragrafta bu fark
// anahtarı tutmaz hale getirir, o yüzden iki taraf da LF'e indirgenir.
const LF = (s) => s.replace(/\r\n/g, '\n');
const SOZLUK = {};
for (const [tr, en] of Object.entries(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'sozluk.json'), 'utf8')),
)) {
  SOZLUK[LF(tr)] = en;
}

// Çevrilebilir sayılan nitelikler — çıkarma betiğiyle aynı liste.
const NITELIKLER = ['placeholder', 'aria-label', 'title', 'alt', 'data-label'];

const HARF = /[A-Za-zÇĞİÖŞÜçğıöşü]/;

/**
 * HARFSİZ düğümler: sayı biçimi. Sözlükten geçmezler (çeviri değil, biçim
 * işi) ama İngilizce sayfada TÜRKÇE biçimde kalamazlar — "₺1.500" okuyan bir
 * İngiliz ziyaretçi fiyatı "bir nokta beş lira" sanar, bin kat yanılır.
 *
 * Bu düğümler JS açılışta çoğunu ZATEN üzerine yazıyor; yine de düzeltiliyor,
 * çünkü ilk boyamada ve JS kapalıyken ekranda duran sayı budur.
 */
const SAYI = {
  '%1': '1%',
  '%10': '10%',
  '%30': '30%',
  '1.749': '1,749',
  '2.099': '2,099',
  '5.249': '5,249',
  '2,1×': '2.1×',
  '2,5×': '2.5×',
  '7,5×': '7.5×',
  '₺1.500': '₺1,500',
  '₺6.000': '₺6,000',
  '₺9.000': '₺9,000',
  '₺2.974': '₺2,974',
  '₺32.400': '₺32,400',
  '₺35.688': '₺35,688',
  '₺39.912': '₺39,912',
  '₺108.000': '₺108,000',
};
// Türkçe biçimli sayı: binlik "1.500" · ondalık "2,1" · önde yüzde "%10".
// Virgülden sonra iki basamak daha gelirse bu zaten İngilizce binliktir ("1,500").
const TR_SAYI = /\d\.\d{3}|\d,\d(?!\d\d)|%\s?\d/;

/**
 * Gövdedeki metin düğümlerini ve nitelikleri sözlükten çevirir.
 * Baştaki/sondaki boşluk korunur: HTML'de girinti anlamlıdır (inline
 * elemanlar arasındaki tek boşluk kelimeleri birbirine yapıştırmasın).
 */
function govdeyiCevir(govde, eksik) {
  let out = govde.replace(/>([^<>]+)</g, (tam, ic) => {
    const cekirdek = ic.trim();
    if (!cekirdek) return tam;

    let en;
    if (HARF.test(cekirdek)) {
      en = SOZLUK[LF(cekirdek)];
    } else if (TR_SAYI.test(cekirdek)) {
      en = SAYI[cekirdek];
    } else {
      return tam; // düz sayı, ok, noktalama — biçim farkı yok
    }
    if (en === undefined) { eksik.add(LF(cekirdek)); return tam; }

    const bas = ic.slice(0, ic.length - ic.trimStart().length);
    const son = ic.slice(ic.trimEnd().length);
    return '>' + bas + en + son + '<';
  });

  for (const ad of NITELIKLER) {
    const re = new RegExp('(?<![-\\w])' + ad + '="([^"]+)"', 'g');
    out = out.replace(re, (tam, deger) => {
      const cekirdek = deger.trim();
      if (!cekirdek || !HARF.test(cekirdek)) return tam;
      const en = SOZLUK[LF(cekirdek)];
      if (en === undefined) { eksik.add(LF(cekirdek)); return tam; }
      return ad + '="' + en + '"';
    });
  }
  return out;
}

/**
 * Script bloğu. Buradaki metinler sözlükten GEÇMEZ — JS dizeleri parça parça
 * birleştiriliyor ("60" + " cihaz × " + "₺1.500"), yani cümlenin tamamı hiçbir
 * yerde tek parça durmuyor. Bu yüzden birebir, sayı guard'lı değişim listesi.
 *
 * SAYI BİÇİMİ de burada değişir: TR binlik ayırıcı "." / ondalık "," iken
 * İngilizce sayfada binlik "," / ondalık "." olur. Yüzde işareti de sayının
 * ARKASINA geçer (%10 → 10%).
 */
const JS_DEGISIM = [
  // — sayı biçimi —
  ["replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.')", "replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')", 2],
  ["(a / 1000000).toFixed(1).replace('.', ',') + 'M'", "(a / 1000000).toFixed(1) + 'M'", 1],
  ["function dec1(n) { return n.toFixed(1).replace('.', ','); }", "function dec1(n) { return n.toFixed(1); }", 1],
  [".toFixed(2).replace('.', ','))", ".toFixed(2))", 2],

  // — paket adları (ROI kartında ekrana yazılır) —
  ["name: 'Başlangıç',   base: 1749", "name: 'Starter',      base: 1749", 1],
  ["name: 'Profesyonel', base: 2099", "name: 'Professional', base: 2099", 1],
  ["name: 'Kurumsal',    base: 5249", "name: 'Enterprise',   base: 5249", 1],

  // — fiyat kartı —
  ["per.textContent = '/ yıl';", "per.textContent = '/ year';", 1],
  ["per.textContent = '/ ay';", "per.textContent = '/ month';", 1],
  ["' cihaz</strong> · ₺'", "' devices</strong> · ₺'", 2],
  ["' taban'", "' base'", 3],
  ["'/ay</strong> → yıllık <strong>₺'", "'/month</strong> → <strong>₺'", 1],
  ["'</strong> + KDV (2 ay bedava)'", "'</strong> a year + VAT (2 months free)'", 1],
  ["'/ay</strong> + KDV'", "'/month</strong> + VAT'", 1],

  // — kaçan gelir hesabı —
  ["'⚠️ Zayıf'", "'⚠️ Weak'", 1],
  ["'🆗 İdare eder'", "'🆗 Fair'", 1],
  ["'✓ Çok iyi'", "'✓ Very good'", 1],
  ["'⚡ Mükemmel'", "'⚡ Excellent'", 1],
  ["'🚀 Olağanüstü'", "'🚀 Outstanding'", 1],
  ["pm < 1 ? '< 1 ay' : (pm < 12 ? dec1(pm) + ' ay' : dec1(pm / 12) + ' yıl')",
   "pm < 1 ? '< 1 month' : (pm < 12 ? dec1(pm) + ' months' : dec1(pm / 12) + ' years')", 1],
  ["vdMiss.textContent = '%' + missPct;", "vdMiss.textContent = missPct + '%';", 1],
  ["devices + ' cihaz × ' + tl(billPer) + ' × %' + missPct;",
   "devices + ' devices × ' + tl(billPer) + ' × ' + missPct + '%';", 1],
  ["tl(recovered) + ' geri kazanım'", "tl(recovered) + ' recovered'", 1],
  ["devices + ' cihaz: '", "devices + ' devices: '", 1],
  ["' (dahil adedin içinde)'", "' (within the included count)'", 1],
  ["' / 5 yıl'", "' / 5 years'", 1],

  // — talep formu —
  ["'Firma adı ve telefon gerekli.'", "'Company name and phone number are required.'", 1],
  ["'Gönderiliyor…'", "'Sending…'", 1],
  ["'Aldık. En kısa sürede arayacağız.'", "'Got it. We will call you shortly.'", 1],
  ["'Bağlantı kurulamadı — WhatsApp üzerinden iletiyoruz.'",
   "'Could not connect — we are sending this over WhatsApp.'", 1],
  ["'Merhaba, Nextus Servis için bilgi istiyorum.\\nFirma: '",
   "'Hello, I would like information about Nextus Servis.\\nCompany: '", 1],
  ["'\\nTelefon: '", "'\\nPhone: '", 1],
  ["'\\nCihaz: '", "'\\nDevices: '", 1],

  // Talebin hangi sayfadan geldiği ayrılabilsin.
  ["get('utm_source') || 'landing'", "get('utm_source') || 'landing-en'", 1],
];

/**
 * WhatsApp derin bağlantılarındaki hazır mesajlar. Uzun olan önce gelir ki
 * kısa olan uzunun içine denk gelip onu bozmasın.
 */
const WA_DEGISIM = [
  ['Merhaba%20Mehmet%20Naim%2C%20Nextus%20Servis%20hakkinda%20konusmak%20istiyorum',
   'Hello%20Mehmet%20Naim%2C%20I%20would%20like%20to%20talk%20about%20Nextus%20Servis'],
  ['Merhaba%2C%20Baslangic%20paketi%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum',
   'Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20on%20the%20Starter%20plan'],
  ['Merhaba%2C%20Profesyonel%20paket%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum',
   'Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20on%20the%20Professional%20plan'],
  ['Merhaba%2C%20Nextus%20Servis%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum',
   'Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20of%20Nextus%20Servis'],
  ['Merhaba%2C%20kurulus%20donemi%20kurulum%20paketi%20hakkinda%20bilgi%20istiyorum',
   'Hello%2C%20I%20would%20like%20information%20about%20the%20founding-period%20setup%20package'],
  ['Merhaba%2C%20cihaz%20sayima%20gore%20hangi%20paket%20uygun%20ogrenmek%20istiyorum',
   'Hello%2C%20I%20would%20like%20to%20know%20which%20plan%20fits%20my%20device%20count'],
  ['Merhaba%2C%20Nextus%20Servis%20demosu%20ve%20fiyat%20bilgisi%20istiyorum',
   'Hello%2C%20I%20would%20like%20a%20demo%20of%20Nextus%20Servis%20and%20pricing'],
  ['Merhaba%2C%20Nextus%20Servis%20hakkinda%20bilgi%20istiyorum',
   'Hello%2C%20I%20would%20like%20information%20about%20Nextus%20Servis'],
  ['Merhaba%2C%20Nextus%20Servis%20canli%20demo%20istiyorum',
   'Hello%2C%20I%20would%20like%20a%20live%20demo%20of%20Nextus%20Servis'],
  ['Merhaba%2C%20Nextus%20Servis%20demosu%20istiyorum',
   'Hello%2C%20I%20would%20like%20a%20demo%20of%20Nextus%20Servis'],
  ['Merhaba%2C%20Kurumsal%20paket%20icin%20gorusmek%20istiyorum',
   'Hello%2C%20I%20would%20like%20to%20talk%20about%20the%20Enterprise%20plan'],
];

/**
 * Telefon numarası. Sözlükten geçen iki satırda ("WhatsApp: …", "Telefon: …")
 * uluslararası biçim zaten var; geriye harfsiz olduğu için sözlüğe hiç girmemiş
 * iki düğüm kalıyor. Yurt dışından bakan biri "0552" ile arayamaz.
 */
const TELEFON = ['0552 696 17 03', '+90 552 696 17 03', 2];

// Dil seçici: İngilizce sayfada Türkçeye geri döner.
const DIL_DEGISIM = [
  ['<a href="/en" class="btn btn-ghost btn-sm dil-sec" hreflang="en" lang="en" aria-label="Switch to English">EN</a>',
   '<a href="/" class="btn btn-ghost btn-sm dil-sec" hreflang="tr" lang="tr" aria-label="Türkçe sürüme geç">TR</a>', 1],
  ['<a href="/en" class="nav-link-m" hreflang="en" lang="en">English</a>',
   '<a href="/" class="nav-link-m" hreflang="tr" lang="tr">Türkçe</a>', 1],
];

function guardliDegistir(metin, eski, yeni, adet, nerede) {
  const parca = metin.split(eski);
  if (parca.length - 1 !== adet) {
    throw new Error(
      `[${nerede}] beklenen ${adet} eşleşme, bulunan ${parca.length - 1}: ${JSON.stringify(eski.slice(0, 90))}`,
    );
  }
  return parca.join(yeni);
}

/**
 * @param {string} govde  nextus-servis.html'in <body>…<script> arası
 * @param {string} js     <script>…</script> arası
 * @returns {{ govde: string, js: string, eksik: string[] }}
 */
function ingilizceYap(govde, js) {
  const eksik = new Set();
  let g = govdeyiCevir(govde, eksik);

  for (const [eski, yeni, adet] of DIL_DEGISIM) g = guardliDegistir(g, eski, yeni, adet, 'dil');
  g = guardliDegistir(g, TELEFON[0], TELEFON[1], TELEFON[2], 'telefon');

  let j = js;
  for (const [eski, yeni, adet] of JS_DEGISIM) j = guardliDegistir(j, eski, yeni, adet, 'js');

  // WhatsApp bağlantıları hem gövdede hem script'te geçebiliyor.
  for (const [eski, yeni] of WA_DEGISIM) {
    g = g.split(eski).join(yeni);
    j = j.split(eski).join(yeni);
  }

  return { govde: g, js: j, eksik: [...eksik] };
}

module.exports = { ingilizceYap, SOZLUK };
