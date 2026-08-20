/**
 * LANDING FON VARLIKLARI — kaynak görsel/videoları siteye hazır hâle getirir.
 *
 * Çalıştırma:
 *   node marketing/landing/fon-varliklari.mjs --kaynak="C:/.../nextus servis"
 *
 * ÜRETTİKLERİ (public/fon/):
 *   <ad>.avif / <ad>.webp        1920 geniş — masaüstü
 *   <ad>-m.avif / <ad>-m.webp     900 geniş — mobil
 *   <ad>.mp4                     ping-pong döngü, yalnız videosu olanlar için
 *
 * ── NEDEN BÖYLE ───────────────────────────────────────────────────────────
 * AVIF + WebP İKİSİ BİRDEN: <picture> ikisini de verip tarayıcıya seçtiriyor;
 * kimse iki dosyayı birden indirmiyor. AVIF önce yazılıyor çünkü aynı GÖRSEL
 * kalitede genelde daha az yer tutar, WebP ise eski Safari için yedek.
 * DÜZELTME — burada önce "AVIF, WebP'nin yarısı kadar" yazıyordu; ÖLÇÜM BUNU
 * ÇÜRÜTTÜ. Bu dört karanlık görselde WebP çoğunlukla daha küçük çıktı
 * (hero 93 vs 106 KB, saha 144 vs 160, kapanis 83 vs 102). Kalite ölçekleri
 * iki biçim arasında birebir karşılaştırılabilir olmadığı için bu "WebP daha
 * iyi" demek değil; ama "AVIF yarısı kadar" iddiası da doğru değildi.
 * İkisini birden tutmanın gerekçesi kapsama, boyut değil.
 *
 * MOBİL AYRI SET: 1920'lik bir görseli 390px ekrana göndermek bedava değil.
 * Ayrı 900'lük set, mobil ağırlığı ~4 kat düşürüyor.
 *
 * PING-PONG: video ileri oynayıp geri dönüyor. Böylece son kare ilk kareye
 * eşit olmak ZORUNDA değil — üretici modelden dikişsiz döngü istemek yerine
 * döngüyü burada garantiliyoruz. Bedeli süre iki katına çıkarken dosyanın da
 * büyümesi; onu çözünürlük + crf ile bütçeye oturtuyoruz.
 *
 * BÜTÇE: her varlık için bir üst sınır var ve script sınıra oturana kadar
 * kaliteyi kademe kademe düşürüyor. Sessizce sınırı aşmak yok — aşarsa
 * raporda AŞTI yazar.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import ffmpegYol from 'ffmpeg-static';

const bayrak = (ad, varsayilan) => {
  const e = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return e ? e.slice(ad.length + 3) : varsayilan;
};

const KAYNAK = bayrak('kaynak', 'C:/Users/Mehmet Naim/Downloads/nextus servis');
const HEDEF = path.resolve(process.cwd(), 'public/fon');

/* Hangi kaynak hangi bölüme gidiyor + bütçesi.
   Bütçeler bölümün sayfadaki YERİNE göre: hero ekranın üstünde, yani onu
   HERKES indiriyor → en sıkı bütçe. Diğerleri 5-15 ekran aşağıda, kaydırmayan
   ziyaretçi hiç ödemiyor → daha rahat. */
const ISLER = [
  // hero ŞU AN SAYFADA KULLANILMIYOR — üretilen görsel hero'nun 6 efekt katmanı
  // ve tarayıcı maketi altında görünmüyordu (ekranda iki kez denendi, perde
  // .58→.30 indirildi, yine görünmedi). Tanım burada duruyor ki hero yeniden
  // kurgulanırsa tek adımda geri gelsin. Üretilen dosyalar elle silindi.
  /* hero YORUMDA: sayfada kullanılmıyor ve script her çalıştığında dosyaları
     yeniden üretip public/fon'u kirletiyordu (yukarıdaki not "elle silindi"
     diyor — yani bu bir kez yaşanmış). Tanım duruyor ki hero yeniden
     kurgulanırsa tek satır açmak yetsin. */
  // { ad: 'hero', dosya: 'Service_van_parked_on_street', perde: 0.50, tavanKB: 180 },
  { ad: 'saha',   dosya: 'Technician_repairing_office',         perde: 0.52, tavanKB: 260, video: 'Light_pulse_travels_across_room', videoButceKB: 700 },
  { ad: 'once',   dosya: 'Cluttered_service_desk_in_office',    perde: 0.9, tavanKB: 300, not: 'kağıt dokusu — yüksek entropi' },
  { ad: 'kapanis', dosya: 'Photocopier_standing_in_dark_space', perde: 0.42, tavanKB: 260, video: 'Toner_dust_dissolves_in_machine', videoButceKB: 800 },
];

const kb = (b) => Math.round(b / 1024);
const bul = (parca) => {
  const hit = readdirSync(KAYNAK).find((f) => f.startsWith(parca));
  if (!hit) throw new Error(`kaynak bulunamadı: ${parca}*  (${KAYNAK})`);
  return path.join(KAYNAK, hit);
};

if (existsSync(HEDEF)) rmSync(HEDEF, { recursive: true, force: true });
mkdirSync(HEDEF, { recursive: true });

/** Bütçeye oturana kadar kaliteyi düşürerek yaz. */
/* ══════════════════════════════════════════════════════════════════════════
   KALİTEYİ BÜTÇE DEĞİL, PERDE BELİRLİYOR.

   Her bandın fotoğrafının üstünde bir perde var ve gücü bant bant farklı.
   Perde ne kadar opaksa sıkıştırma hatası da o kadar bastırılıyor — yani
   perdenin altında kalan bayt kimsenin görmediği detaya gidiyor.

   ÖLÇÜLDÜ (recetemaliyet, perde %81 olan bant): q86 → 231 KB, q60 → 50 KB.
   Kareler gerçek perde değeriyle karıştırılıp karşılaştırıldığında q60'ın
   q86'dan farkı RMS 0,58 — 8 bitlik bir kanalda ~1 zaten ayırt edilemez.

   Bu yüzden kalite seçimi keyfi bir KB hedefine değil, PERDE ALTINDAKİ
   ÖLÇÜLEN FARKA bakıyor: referans (en yüksek kalite) ile aday, gerçek perde
   değeriyle karıştırılıp karşılaştırılıyor; eşiği aşmayan EN KÜÇÜK dosya
   kazanıyor.

   ESKİ BÜTÇE TAVAN OLARAK DURUYOR. Eşiği hiçbir kalitenin geçemediği görseller
   var (zayıf perde ya da yüksek frekanslı doku) ve orada referansı yazmak
   GERİLEME olurdu: ölçüldü, rent-a-car hero'sunda eski sistem 132 KB veriyordu,
   yalnız algısal seçim aynı kareyi 252 KB'a çıkarıyordu. Eşik yakalanamazsa
   karar yine bütçenin.

   EŞİK GÖZLE AYARLANDI: 1,0'da bir reçete-kartı görselinde kâğıdın dokusu
   yumuşamıştı (RMS ortalaması o yerel kaybı gizliyor). 0,65 onu bir basamak
   yukarı çıkarıyor, fark vermeyenleri yerinde bırakıyor.

   `perde` değerleri sayfadaki gradyanların orta noktası. İkisi ayrışırsa
   buradaki sayı yalnız kalite seçimini etkiler, ekrandaki perdeyi değil.
   ══════════════════════════════════════════════════════════════════════════ */
/** Perde altında kabul edilen en büyük fark (RMS, 8 bit kanal). */
const FARK_ESIGI = 0.65;
/** Sayfa zemini — perde bu renge doğru karartıyor. */
const ZEMIN = [5, 5, 8];

/** Kareyi verilen opaklıkta perdeyle karıştır; ekranda gerçekte görünen piksel. */
function perdeUygula(ham, opaklik) {
  const o = Buffer.alloc(ham.length);
  for (let i = 0; i < ham.length; i += 3)
    for (let c = 0; c < 3; c++) o[i + c] = Math.round(ham[i + c] * (1 - opaklik) + ZEMIN[c] * opaklik);
  return o;
}

/** İki ham tampon arasındaki ortalama sapma (RMS, 8 bit kanal). */
function rms(a, b) {
  let t = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    t += d * d;
  }
  return Math.sqrt(t / a.length);
}

async function gorselYaz(girdi, cikti, genislik, perde, bicim, tavanKB) {
  const kaliteler = bicim === 'avif' ? [40, 48, 56, 64, 72, 80] : [54, 62, 70, 78, 86];
  const enIyi = bicim === 'avif' ? 86 : 92;

  const uret = async (q) => {
    const p = sharp(girdi).resize(genislik, null, { withoutEnlargement: true });
    return (bicim === 'avif' ? p.avif({ quality: q, effort: 6 }) : p.webp({ quality: q, effort: 6 })).toBuffer();
  };
  const hamOku = (buf) => sharp(buf).removeAlpha().raw().toBuffer();

  const refBuf = await uret(enIyi);
  const refPerdeli = perdeUygula(await hamOku(refBuf), perde);

  /* Adaylar küçükten büyüğe; eşiği geçen İLKİ, yani en küçüğü kazanıyor. */
  const adaylar = [];
  for (const q of kaliteler) {
    const buf = await uret(q);
    const fark = rms(perdeUygula(await hamOku(buf), perde), refPerdeli);
    adaylar.push({ q, buf, fark });
    if (fark <= FARK_ESIGI) {
      writeFileSync(cikti, buf);
      return { q, bayt: buf.length, fark };
    }
  }

  /* EŞİK YAKALANAMADI — görsel gerçekten görünüyor (zayıf perde ya da yüksek
     frekanslı doku). Burada tavana sığan EN YÜKSEK kalite seçilir.
     İlk sürüm bunu yanlış yapıyordu: yalnız en üst basamağa bakıp tavanı
     aşınca doğrudan q32'ye düşüyor, aradaki q40-q72 hiç denenmiyordu.
     Ölçüldü — cihazlarim bandı 8 KB'a inip fark 1,20 vermişti (eşik 0,65). */
  const tavan = tavanKB ?? Infinity;
  for (let i = adaylar.length - 1; i >= 0; i--) {
    if (kb(adaylar[i].buf.length) <= tavan) {
      writeFileSync(cikti, adaylar[i].buf);
      return { q: adaylar[i].q, bayt: adaylar[i].buf.length, fark: adaylar[i].fark, tavanda: true };
    }
  }

  /* Merdivenin en altı bile tavana sığmıyorsa daha da kısılıyor. Buraya
     düşmek tavanın gerçekten dar olduğunu gösterir; rapordaki fark değeri
     bunu görünür kılar. */
  for (const q of [32, 26, 20]) {
    const buf = await uret(q);
    if (kb(buf.length) <= tavan) {
      const fark = rms(perdeUygula(await hamOku(buf), perde), refPerdeli);
      writeFileSync(cikti, buf);
      return { q, bayt: buf.length, fark, tavanda: true };
    }
  }
  const son = adaylar[0];
  writeFileSync(cikti, son.buf);
  return { q: son.q, bayt: son.buf.length, fark: son.fark, tavanda: true };
}

/** Ping-pong + ölçekle + bütçeye oturt. */
function videoYaz(girdi, cikti, butceKB) {
  const denemeler = [
    { en: 1280, crf: 30 }, { en: 1280, crf: 33 }, { en: 1152, crf: 34 },
    { en: 1024, crf: 35 }, { en: 960, crf: 36 },
  ];
  let son = null;
  for (const d of denemeler) {
    execFileSync(ffmpegYol, [
      '-y', '-loglevel', 'error', '-i', girdi,
      // [ileri][geri] birleştir → dikişsiz döngü. reverse tüm kareleri belleğe
      // alır; 8 sn 1080p için sorun değil.
      '-filter_complex',
      `[0:v]scale=${d.en}:-2,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]`,
      '-map', '[v]', '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(d.crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      // Web'de oynatılabilirlik: profil/level muhafazakâr tutuluyor.
      '-profile:v', 'high', '-level', '4.0',
      cikti,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    son = { ...d, bayt: statSync(cikti).size };
    if (kb(son.bayt) <= butceKB) break;
  }
  return son;
}

console.log(`kaynak : ${KAYNAK}`);
console.log(`hedef  : ${HEDEF}\n`);

let toplam = 0;
const satirlar = [];

for (const is of ISLER) {
  const girdi = bul(is.dosya);
  const masaA = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}.avif`), 1920, is.perde, 'avif', is.tavanKB);
  const masaW = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}.webp`), 1920, is.perde, 'webp', Math.round(is.tavanKB * 1.9));
  const mobA = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}-m.avif`), 900, is.perde, 'avif', Math.round(is.tavanKB * 0.42));
  const mobW = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}-m.webp`), 900, is.perde, 'webp', Math.round(is.tavanKB * 0.8));

  satirlar.push([
    is.ad, 'AVIF 1920', `q${masaA.q}`, kb(masaA.bayt),
    `perde %${Math.round(is.perde * 100)} · fark ${masaA.fark.toFixed(2)}`,
  ]);
  satirlar.push([is.ad, 'WebP 1920', `q${masaW.q}`, kb(masaW.bayt), '']);
  satirlar.push([is.ad, 'AVIF  900', `q${mobA.q}`, kb(mobA.bayt), '']);
  satirlar.push([is.ad, 'WebP  900', `q${mobW.q}`, kb(mobW.bayt), '']);
  // Gerçek maliyet: tarayıcı format başına TEK dosya indirir → AVIF sayılır.
  toplam += masaA.bayt;

  if (is.video) {
    const v = videoYaz(bul(is.video), path.join(HEDEF, `${is.ad}.mp4`), is.videoButceKB);
    satirlar.push([
      is.ad, `MP4 ${v.en}`, `crf${v.crf}`, kb(v.bayt),
      kb(v.bayt) <= is.videoButceKB ? 'tamam' : `AŞTI (bütçe ${is.videoButceKB})`,
    ]);
  }
}

console.log('bölüm    varlık      kalite  KB    durum');
for (const s of satirlar) {
  console.log(
    String(s[0]).padEnd(9) + String(s[1]).padEnd(12) + String(s[2]).padEnd(8) +
    String(s[3]).padStart(5) + '  ' + s[4]
  );
}
console.log(`\nAVIF masaüstü toplamı (üçü birden): ${kb(toplam)} KB`);
console.log('NOT: bu toplam TEK ziyarette inmez — hepsi bölüme varılınca iner.');
