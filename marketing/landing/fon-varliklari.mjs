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
import { mkdirSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
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
  { ad: 'hero',   dosya: 'Service_van_parked_on_street',        butceKB: 180, not: 'ŞU AN KULLANILMIYOR' },
  { ad: 'saha',   dosya: 'Technician_repairing_office',         butceKB: 260, video: 'Light_pulse_travels_across_room', videoButceKB: 700 },
  { ad: 'once',   dosya: 'Cluttered_service_desk_in_office',    butceKB: 300, not: 'kağıt dokusu — yüksek entropi' },
  { ad: 'kapanis', dosya: 'Photocopier_standing_in_dark_space', butceKB: 260, video: 'Toner_dust_dissolves_in_machine', videoButceKB: 800 },
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
async function gorselYaz(girdi, cikti, genislik, butceKB, bicim) {
  // Merdiven YÜKSEKTEN başlar. İlk turda q58 ile denendi ve dördü de bütçenin
  // ~6 katı altında kaldı (hero 27 KB / bütçe 180) — yani kaliteyi bedavaya
  // bırakıyorduk. Artık en iyisinden başlayıp bütçeye oturana kadar iniyor.
  const kaliteler = bicim === 'avif' ? [86, 80, 72, 64, 56, 48, 40] : [92, 86, 78, 70, 62, 54];
  let son = null;
  for (const q of kaliteler) {
    const p = sharp(girdi).resize(genislik, null, { withoutEnlargement: true });
    await (bicim === 'avif'
      ? p.avif({ quality: q, effort: 6 })
      : p.webp({ quality: q, effort: 6 })
    ).toFile(cikti);
    son = { q, bayt: statSync(cikti).size };
    if (kb(son.bayt) <= butceKB) break;
  }
  return son;
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
  const masaA = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}.avif`), 1920, is.butceKB, 'avif');
  const masaW = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}.webp`), 1920, Math.round(is.butceKB * 1.9), 'webp');
  const mobA = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}-m.avif`), 900, Math.round(is.butceKB * 0.42), 'avif');
  const mobW = await gorselYaz(girdi, path.join(HEDEF, `${is.ad}-m.webp`), 900, Math.round(is.butceKB * 0.8), 'webp');

  satirlar.push([
    is.ad, 'AVIF 1920', `q${masaA.q}`, kb(masaA.bayt),
    kb(masaA.bayt) <= is.butceKB ? 'tamam' : `AŞTI (bütçe ${is.butceKB})`,
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
console.log(`\nAVIF masaüstü toplamı (dördü birden): ${kb(toplam)} KB`);
console.log('NOT: bu toplam TEK ziyarette inmez — hero dışındakiler bölüme varılınca iner.');
