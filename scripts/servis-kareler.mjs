/**
 * NEXTUS SERVİS — KARE BORU HATTI — kaynaktan bağımsız varlık üretimi.
 *
 *   node scripts/servis-kareler.mjs
 *   node scripts/servis-kareler.mjs "C:/.../yeni kareler" --mb=6 --kare=140
 *   node scripts/servis-kareler.mjs --ters          (dizi tersine döner)
 *
 * Çıktı:  public/servis/f-001.webp … + public/servis-m/… + kaynak HTML'e gömülü sayılar
 *
 * Betik ÜÇ şeyi tahmin etmez, ÖLÇER:
 *   1. Kaç kare var           → klasörü okur, dosya adı kalıbına bağlı değildir
 *   2. Letterbox kaç piksel   → satır satır parlaklık tarar (--kirp=N ile ezilebilir)
 *   3. Hangi ayar bütçeye sığar → 12 temsili kareyle tahmin eder, sonra TEK tam tur atar
 *
 * ── LETTERBOX ─────────────────────────────────────────────────────────────
 * Kaynakta üstte/altta siyah şerit olabilir ve ortada kaybolabilir; kaydırırken
 * bu bir hata gibi görünür. Bu yüzden şerit ölçülür ve kırpma TÜM karelere EŞİT
 * uygulanır — yalnız etkilenenleri kırpmak kadrajı ortada zıplatırdı.
 *   İlk kaynak (1920x1080): üst 4 px tam siyah + 1 px geçiş → 8 px kırpıldı.
 *   İkinci kaynak (1280x720): şerit YOK → kırpma 0.
 *
 * ── KODEK ─────────────────────────────────────────────────────────────────
 * WebP. AVIF ölçüldü (q42/1280 → 3.70 MB) ama bu görsellerde kazancı küçük,
 * buna karşılık Safari 16.4 altında çözülmüyor; canvas dizisi tek bir
 * çözülemeyen kareyle kırılır. Pazarlama sayfasında bu risk alınmaz.
 *
 * ── KALİTE TAVANI ─────────────────────────────────────────────────────────
 * Kaynak zaten kayıplı (ezgif JPEG). Ölçüm: 1920x1080 kaynağın ortancası
 * 63 KB — o çözünürlükte görsel olarak kayıpsız JPEG ~450-700 KB olurdu.
 * Yani q72'nin üstüne çıkmak yeni detay eklemez, mevcut bozulmayı daha sadık
 * kodlar. Kalite yükseltmek istiyorsan çözüm daha iyi KAYNAK, daha yüksek q değil.
 */

import { createRequire } from 'node:module'
import { mkdir, rm, readdir, stat, access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

// ── Girdi ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const bayrak = (ad, varsayilan) => {
  const b = argv.find((a) => a.startsWith(`--${ad}=`))
  return b ? b.split('=')[1] : varsayilan
}

const KAYNAK = argv.find((a) => !a.startsWith('--')) ?? 'C:/Users/Mehmet Naim/Downloads/servis takip.mp4'
/** Kareleri okuyacağımız KLASÖR. Girdi video ise çıkarılan geçici klasör buraya yazılır. */
let KAYNAK_DIZIN = KAYNAK
const HEDEF = path.resolve(process.cwd(), bayrak('cikti', 'public/servis'))
const SABIT = path.resolve(process.cwd(), 'marketing/landing/nextus-servis.html')

const HEDEF_BAYT = Number(bayrak('mb', '4')) * 1024 * 1024
const ISTENEN_KARE = Number(bayrak('kare', '120'))
const ISTENEN_GENISLIK = Number(bayrak('genislik', '1280'))
const ISTENEN_KALITE = Number(bayrak('kalite', '72'))
const KIRP_AYAR = bayrak('kirp', 'auto')

// MOBİL AYRI DİZİ: mobil daha önce masaüstü karelerini indirip 375px'te
// gösteriyordu — saf israf. Artık kendi çözünürlüğünde ayrı dizi üretiliyor.
// 800px seçildi çünkü 375px ekran × dpr2 = 750px arka bellek; 800 onu karşılar.
const MOBIL_GENISLIK = Number(bayrak('mobil-genislik', '800'))
const MOBIL_KARE = Number(bayrak('mobil-kare', '96'))
const MOBIL_KALITE = Number(bayrak('mobil-kalite', '72'))

/** Yön — bayrakla ya da dosyanın başındaki sabitle. true: patlatılmış → bütün. */
const TERS = argv.includes('--ters')

const RESIM = /\.(jpe?g|png|webp)$/i
const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i

// ── Yardımcılar ────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(3, '0')
const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'
const kb = (b) => (b / 1024).toFixed(0) + ' KB'

/** Doğal sıralama: dosya adındaki sayıya göre (frame-9 < frame-10). */
function dogalSirala(a, b) {
  const sa = a.match(/\d+/g)?.map(Number) ?? []
  const sb = b.match(/\d+/g)?.map(Number) ?? []
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const d = (sa[i] ?? 0) - (sb[i] ?? 0)
    if (d) return d
  }
  return a.localeCompare(b)
}

/** Kaynaktaki kareleri bul — dosya adı kalıbına BAĞLI DEĞİL. */
async function kareleriBul() {
  const hepsi = (await readdir(KAYNAK_DIZIN)).filter((f) => RESIM.test(f)).sort(dogalSirala)
  if (!hepsi.length) throw new Error(`Kaynakta görüntü yok: ${KAYNAK_DIZIN}`)
  return hepsi
}

/** Üst/alt siyah şeridi ÖLÇ. Örnek karelerde tarar, en büyüğü döner. */
async function letterboxOlc(dosyalar) {
  const ESIK = 40
  const BAK = 24
  const ornek = [0, 1, 0.25, 0.45, 0.46, 0.5, 0.75, 1].map((o) =>
    typeof o === 'number' && o <= 1 ? Math.min(dosyalar.length - 1, Math.round(o * (dosyalar.length - 1))) : o
  )
  let enUst = 0
  let enAlt = 0
  for (const i of [...new Set(ornek)]) {
    const { data, info } = await sharp(path.join(KAYNAK_DIZIN, dosyalar[i]))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const satir = (y) => {
      let t = 0
      for (let x = 0; x < info.width; x++) t += data[y * info.width + x]
      return t / info.width
    }
    let u = 0
    let a = 0
    while (u < BAK && satir(u) < ESIK) u++
    while (a < BAK && satir(info.height - 1 - a) < ESIK) a++
    enUst = Math.max(enUst, u)
    enAlt = Math.max(enAlt, a)
  }
  // Tam siyah satırların ardında bir de yarı karanlık GEÇİŞ satırı olur; +2 pay.
  const ham = Math.max(enUst, enAlt)
  return ham === 0 ? 0 : ham + 2 + ((ham + 2) % 2) // çift sayıya yuvarla
}

/** N kare için kaynak indeksleri — iki uç DA dahil, aralık eşit.
 *  Son karenin (tam patlatılmış görünüm) mutlaka dizide olması şart. */
function secim(toplam, n) {
  const s = []
  for (let i = 0; i < n; i++) s.push(Math.round((i * (toplam - 1)) / (n - 1)))
  return TERS ? s.reverse() : s
}

/** Eşzamanlı ama sınırlı — hepsini birden açmak belleği şişirir. */
async function havuz(isler, esZaman = 8) {
  let sonraki = 0
  const isci = async () => {
    while (sonraki < isler.length) await isler[sonraki++]()
  }
  await Promise.all(Array.from({ length: Math.min(esZaman, isler.length) }, isci))
}

/** Tek karelik dönüşüm zinciri — tahmin ve üretim AYNI zinciri kullanır. */
function boru(dosya, { kirp, genislik, kalite }, olcu) {
  let p = sharp(dosya)
  if (kirp > 0) p = p.extract({ left: 0, top: kirp, width: olcu.w, height: olcu.h - kirp * 2 })
  return p.resize({ width: genislik, withoutEnlargement: true }).webp({ quality: kalite, effort: 6 })
}

/** 12 temsili kareyle kare-başı ortalama boyutu TAHMİN et (tam tur atmadan). */
async function tahmin(dosyalar, ayar, olcu) {
  const n = dosyalar.length
  const ornek = [0.01, 0.09, 0.17, 0.26, 0.34, 0.43, 0.51, 0.6, 0.69, 0.79, 0.89, 1].map((o) =>
    Math.round(o * (n - 1))
  )
  let t = 0
  for (const i of ornek) t += (await boru(path.join(KAYNAK_DIZIN, dosyalar[i]), ayar, olcu).toBuffer()).length
  return t / ornek.length
}

/** İstenen ayardan başlayıp bütçeye sığana kadar inen aday listesi.
 *  Sıra bilinçli: önce KALİTE, sonra KARE, en son GENİŞLİK.
 *  Gerekçe: genişlik düşünce her karede detay kaybolur ve geri gelmez;
 *  kare sayısı akıcılığı etkiler ama tek tek kareler net kalır. */
function adaylar() {
  const liste = []
  const kaliteler = [ISTENEN_KALITE, ISTENEN_KALITE - 4, ISTENEN_KALITE - 8, ISTENEN_KALITE - 12]
  const kareler = [ISTENEN_KARE, Math.round(ISTENEN_KARE * 0.9), Math.round(ISTENEN_KARE * 0.8), Math.round(ISTENEN_KARE * 0.7)]
  const genislikler = [ISTENEN_GENISLIK, Math.round(ISTENEN_GENISLIK * 0.9), Math.round(ISTENEN_GENISLIK * 0.8)]
  for (const g of genislikler)
    for (const k of kareler)
      for (const q of kaliteler)
        if (q >= 52) liste.push({ genislik: g, kalite: q, kare: k })
  return liste
}

async function uret(dosyalar, ayar, olcu, hedef = HEDEF) {
  await rm(hedef, { recursive: true, force: true })
  await mkdir(hedef, { recursive: true })
  const sira = secim(dosyalar.length, ayar.kare)
  let ciktiOlcu = null
  await havuz(
    sira.map((idx, i) => async () => {
      const bilgi = await boru(path.join(KAYNAK_DIZIN, dosyalar[idx]), ayar, olcu).toFile(
        path.join(hedef, `f-${pad(i + 1)}.webp`)
      )
      if (i === 0) ciktiOlcu = { w: bilgi.width, h: bilgi.height }
    })
  )
  const dizin = await readdir(hedef)
  let toplam = 0
  const boyutlar = []
  for (const d of dizin) {
    const s = await stat(path.join(hedef, d))
    toplam += s.size
    boyutlar.push({ ad: d, boyut: s.size })
  }
  boyutlar.sort((a, b) => b.boyut - a.boyut)
  return { toplam, adet: dizin.length, enBuyuk: boyutlar[0], enKucuk: boyutlar.at(-1), ciktiOlcu }
}

/** Kare sayısı bileşene ELLE yazılmaz — sürüklenip hatalı olmasın diye buradan üretilir. */
/** Kare sayısı bileşene ELLE yazılmaz — sürüklenip hatalı olmasın diye buradan üretilir. */
/**
 * Kare sayıları bileşene ELLE yazılmaz.
 *
 * Bu landing tek kaynaktan üretiliyor (marketing/landing/nextus-servis.html →
 * build-landing.js → src/app/_landing/Landing.tsx) ve JS'i string olarak
 * tutuyor; import edilebilecek bir TS sabit dosyası yok. Bu yüzden sayılar
 * bölümün data-* özniteliklerine YAZILIYOR ve tarayıcıdaki kod oradan okuyor.
 * Böylece dizi yeniden üretildiğinde sayılar kendiliğinden güncelleniyor.
 */
async function sabitYaz(masa, mobil) {
  const { readFile } = await import('node:fs/promises')
  let html = await readFile(SABIT, 'utf8')

  const yeniler = {
    'data-adet': masa.adet,
    'data-genislik': masa.ciktiOlcu.w,
    'data-yukseklik': masa.ciktiOlcu.h,
    'data-madet': mobil.adet,
    'data-mgenislik': mobil.ciktiOlcu.w,
    'data-myukseklik': mobil.ciktiOlcu.h,
  }

  let bulunan = 0
  for (const [ad, deger] of Object.entries(yeniler)) {
    const kalip = new RegExp(`(id="patlatma"[^>]*?${ad}=")\\d+(")`, 's')
    if (kalip.test(html)) {
      html = html.replace(kalip, `$1${deger}$2`)
      bulunan += 1
    }
  }

  if (bulunan === 0) {
    console.log(`  UYARI: kaynak HTML icinde id="patlatma" bolumu bulunamadi — sayilar yazilamadi.`)
    console.log('  Bölüm eklendikten sonra betiği yeniden çalıştır.')
    return
  }
  await writeFile(SABIT, html, 'utf8')
  console.log(`  kaynak HTML güncellendi: ${bulunan}/6 öznitelik`)
}

// ── Video girdisi ──────────────────────────────────────────────────────────
// Neden video tercih edilir: ezgif gibi araçlardan gelen JPG kareler zaten bir
// kayıplı geçişten geçmiştir; onları WebP'ye çevirmek İKİNCİ kayıptır. Videodan
// PNG (kayıpsız) çıkarıp tek seferde WebP'ye kodlayınca zincirde tek kayıp kalır.
// ÖLÇÜLDÜ: 1920x1080 ezgif kaynağının ortancası 63 KB/kare — o çözünürlükte
// görsel olarak kayıpsız JPEG ~450-700 KB olurdu. Aradaki fark, parça
// kenarlarındaki blok ve halka artefaktları olarak birikiyordu.
const ffmpegYol = () => require('ffmpeg-static')
const ffprobeYol = () => require('ffprobe-static').path

/** Videonun GERÇEK kare sayısı ve ölçüsü. -count_frames yavaş ama kesin sayar;
 *  süre × fps tahmini değişken kare hızlı dosyalarda yanlış sonuç verir. */
function videoBilgi(video) {
  const ham = execFileSync(
    ffprobeYol(),
    ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
     '-show_entries', 'stream=nb_read_frames,width,height,avg_frame_rate',
     '-of', 'json', video],
    { maxBuffer: 1 << 24 }
  ).toString()
  const s = JSON.parse(ham).streams?.[0]
  if (!s) throw new Error('Videoda görüntü akışı bulunamadı')
  const [pay, payda] = String(s.avg_frame_rate || '0/1').split('/').map(Number)
  return {
    adet: Number(s.nb_read_frames),
    w: Number(s.width),
    h: Number(s.height),
    fps: payda ? pay / payda : 0,
  }
}

/**
 * Videodan YALNIZ ihtiyacımız olan kareleri PNG olarak çıkarır.
 * Tüm kareleri çıkarmak 1080p'de ~600 MB geçici dosya demek; select filtresiyle
 * tek geçişte sadece seçilenleri yazıyoruz. İki uç (ilk ve son kare) DA dahil.
 */
function videodanCikar(video, istenen) {
  const bilgi = videoBilgi(video)
  if (!bilgi.adet) throw new Error('Video kare sayısı okunamadı')
  const n = Math.min(istenen, bilgi.adet)
  const idx = []
  for (let i = 0; i < n; i++) idx.push(Math.round((i * (bilgi.adet - 1)) / (n - 1)))

  const gecici = path.join(os.tmpdir(), `nextus-kare-${process.pid}`)
  const filtre = idx.map((i) => `eq(n\,${i})`).join('+')

  execFileSync(
    ffmpegYol(),
    ['-y', '-loglevel', 'error', '-i', video,
     '-vf', `select='${filtre}'`, '-vsync', '0',
     path.join(gecici, 'k-%04d.png')],
    { maxBuffer: 1 << 24 }
  )
  return { gecici, bilgi, cikan: n }
}

// ── Çalıştır ───────────────────────────────────────────────────────────────
async function main() {
  await access(KAYNAK).catch(() => {
    throw new Error(`Kaynak klasör bulunamadı: ${KAYNAK}`)
  })

  // Girdi video mu? Öyleyse kareleri kayıpsız PNG olarak çıkar, sonra normal akış.
  let geciciDizin = null
  if (VIDEO.test(KAYNAK)) {
    console.log('Girdi    : VİDEO — kareler kayıpsız PNG olarak çıkarılıyor…')
    await mkdir(path.join(os.tmpdir(), `nextus-kare-${process.pid}`), { recursive: true })
    const c = videodanCikar(KAYNAK, ISTENEN_KARE)
    geciciDizin = c.gecici
    KAYNAK_DIZIN = c.gecici
    console.log(
      `           video ${c.bilgi.w}x${c.bilgi.h} · ${c.bilgi.adet} kare · ${c.bilgi.fps.toFixed(2)} fps` +
        ` → ${c.cikan} kare çıkarıldı (PNG, kayıpsız)`
    )
  }

  const dosyalar = await kareleriBul()
  const m = await sharp(path.join(KAYNAK_DIZIN, dosyalar[0])).metadata()
  const olcu = { w: m.width, h: m.height }

  const kirp = KIRP_AYAR === 'auto' ? await letterboxOlc(dosyalar) : Number(KIRP_AYAR)

  console.log(`Kaynak   : ${KAYNAK}`)
  console.log(`Kare     : ${dosyalar.length} adet · ${olcu.w}x${olcu.h}`)
  console.log(
    `Letterbox: ${KIRP_AYAR === 'auto' ? 'ÖLÇÜLDÜ' : 'elle'} → üstten/alttan ${kirp}px` +
      (kirp ? ` (çıktı ${olcu.w}x${olcu.h - kirp * 2})` : ' — şerit yok, kırpma gerekmiyor')
  )
  console.log(`Bütçe    : ${mb(HEDEF_BAYT)}`)
  console.log(`İstenen  : ${ISTENEN_GENISLIK}px · kalite ${ISTENEN_KALITE} · ${ISTENEN_KARE} kare`)
  console.log(`Yön      : ${TERS ? 'TERS (patlatılmış → bütün)' : 'DÜZ (bütün → patlatılmış)'}\n`)

  // Tahmin turu: tam üretim yapmadan sığan en iyi ayarı bul.
  console.log('Tahmin turu (12 temsili kare):')
  let secilen = null
  for (const ayar of adaylar()) {
    const ort = await tahmin(dosyalar, { ...ayar, kirp }, olcu)
    const beklenen = ort * ayar.kare
    const sigar = beklenen <= HEDEF_BAYT
    console.log(
      `  ${ayar.genislik}px q${ayar.kalite} ${ayar.kare} kare → ${kb(ort)}/kare · ${mb(beklenen)} ${
        sigar ? '✓' : '✗'
      }`
    )
    if (sigar) {
      secilen = ayar
      break
    }
  }
  if (!secilen) throw new Error('Hiçbir aday bütçeye sığmadı. --mb değerini yükselt.')

  console.log(`\nSeçilen: ${secilen.genislik}px · kalite ${secilen.kalite} · ${secilen.kare} kare — üretiliyor…`)
  const s = await uret(dosyalar, { ...secilen, kirp }, olcu)

  // MOBİL DİZİ — mobil eskiden masaüstü karelerini indirip 375px'te gösteriyordu;
  // saf israftı. Artık kendi çözünürlüğünde ayrı üretiliyor.
  const mobilHedef = path.resolve(process.cwd(), bayrak('mobil-cikti', 'public/servis-m'))
  console.log(`Mobil    : ${MOBIL_GENISLIK}px · kalite ${MOBIL_KALITE} · ${MOBIL_KARE} kare — üretiliyor…`)
  const sm = await uret(
    dosyalar,
    { genislik: MOBIL_GENISLIK, kalite: MOBIL_KALITE, kare: MOBIL_KARE, kirp },
    olcu,
    mobilHedef
  )
  // --cikti verilmisse bu bir deneme kosusudur: gercek sabit dosyasina DOKUNMA.
  // (Bir kez uzerine yazip bileseni 24 kare/800x1403'e dusurdu — bir daha olmasin.)
  const denemeKosusu = argv.some((a) => a.startsWith('--cikti='))
  if (!denemeKosusu) await sabitYaz(s, sm)

  console.log('')
  console.log(s.toplam <= HEDEF_BAYT ? '✓ SINIR İÇİNDE' : '✗ SINIRIN ÜSTÜNDE')
  console.log(`  ${s.adet} kare · ${s.ciktiOlcu.w}x${s.ciktiOlcu.h} · kalite ${secilen.kalite} · ${mb(s.toplam)}`)
  console.log(`  en büyük ${s.enBuyuk.ad} ${kb(s.enBuyuk.boyut)} · en küçük ${kb(s.enKucuk.boyut)}`)
  console.log(
    `  MOBİL: ${sm.adet} kare · ${sm.ciktiOlcu.w}x${sm.ciktiOlcu.h} · kalite ${MOBIL_KALITE} · ${mb(sm.toplam)}`
  )
  console.log(`  TOPLAM disk: ${mb(s.toplam + sm.toplam)}`)
  if (denemeKosusu) console.log(`  DENEME KOSUSU — kaynak HTML degistirilmedi`)

  if (geciciDizin) {
    await rm(geciciDizin, { recursive: true, force: true })
    console.log('  geçici PNG klasörü silindi')
  }
}

main().catch((e) => {
  console.error('HATA:', e.message)
  process.exit(1)
})
