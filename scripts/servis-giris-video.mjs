/**
 * GİRİŞ SAYFASI DÖNGÜ VİDEOSU — tek seferlik üretim.
 *
 *   node scripts/servis-giris-video.mjs ["C:/yol/video.mp4"]
 *
 * Çıktı: public/giris/cihaz.mp4 · cihaz-poster.webp
 *
 * ── NEDEN KARE DİZİSİ DEĞİL ───────────────────────────────────────────────
 * Landing'deki patlatma bölümü 192 WebP kare kullanıyor (10,4 MB) çünkü
 * kaydırmaya bağlı scrub RASTGELE ERİŞİM ister. Giriş sayfasında böyle bir
 * ihtiyaç yok: video kendiliğinden dönüyor. Sıradan bir <video> hem çok daha
 * küçük, hem donanımla çözülüyor, hem de sıfır JS istiyor.
 *
 * ── NEDEN PING-PONG ───────────────────────────────────────────────────────
 * Kaynak "bütün makine → patlatılmış" yönünde ilerliyor. Düz döngüde son
 * kareden ilk kareye sert kesme olur ve göze batar. İleri + ters birleştirince
 * dikişsiz döner: makine açılır, sonra toplanır. Servis ürünü için de doğru
 * metafor. Süre iki katına çıkar (8 sn → 16 sn) ama boyut ~2× değil, çünkü
 * ters bölüm de aynı içeriği taşıdığı için çok iyi sıkışıyor.
 *
 * ── BOYUT ─────────────────────────────────────────────────────────────────
 * Bu bir GİRİŞ sayfası; ağır olamaz. Panel yalnız lg ve üstünde görünüyor
 * (mobilde `hidden`), yani mobil maliyeti sıfır. Yine de hedef: MP4 ≤ 2 MB.
 * Video arka planda ve perdenin altında duruyor, bu yüzden yüksek CRF
 * gözle fark edilmiyor.
 *
 * ── NEDEN TEK FORMAT (WebM YOK) ───────────────────────────────────────────
 * VP9 denendi ve ÖLÇÜLDÜ: crf38 → 2,62 MB · crf44 → 1,67 MB · crf50 → 1,04 MB.
 * H.264 crf30 ise 1,33 MB. Yani VP9 ancak çok agresif ayarda ve sadece
 * 0,29 MB kazandırıyor. İki kodek bakımı, iki kat üretim süresi ve <source>
 * sırası riski bu kazanç için değmez. H.264 her yerde donanımla çözülüyor.
 */

import { createRequire } from 'node:module'
import { mkdir, rm, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ffmpeg = require('ffmpeg-static')
const sharp = require('sharp')

const KAYNAK =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ??
  'C:/Users/Mehmet Naim/Downloads/servis takip.mp4'
const HEDEF = path.resolve(process.cwd(), 'public/giris')

const GENISLIK = 1280 // panel lg'de ~960px; ghost olarak kullanıldığı için fazlası israf
const CRF = 30 // perdenin altında; 30 gözle fark edilmiyor
const HEDEF_BAYT = 2 * 1024 * 1024

const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'

async function boyut(p) {
  try {
    return (await stat(p)).size
  } catch {
    return 0
  }
}

async function main() {
  await rm(HEDEF, { recursive: true, force: true })
  await mkdir(HEDEF, { recursive: true })

  const mp4 = path.join(HEDEF, 'cihaz.mp4')
  const poster = path.join(HEDEF, 'cihaz-poster.webp')

  // Ping-pong: kaynağı kendisinin tersiyle birleştir.
  // reverse tüm kareleri belleğe alır; 8 sn 1080p için sorun değil.
  const suzgec =
    `[0:v]scale=${GENISLIK}:-2,setsar=1,split[a][b];` +
    `[b]reverse[r];` +
    `[a][r]concat=n=2:v=1[v]`

  console.log(`Kaynak : ${KAYNAK}`)
  console.log(`Süzgeç : ping-pong (ileri + ters), ${GENISLIK}px, CRF ${CRF}`)

  execFileSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-i', KAYNAK,
     '-filter_complex', suzgec, '-map', '[v]',
     '-an', // ses YOK: otomatik oynatma sessiz olmalı, ses parçası da gereksiz ağırlık
     '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
     '-crf', String(CRF), '-preset', 'slow',
     '-movflags', '+faststart', // ilk kare için tüm dosyayı beklemesin
     mp4],
    { maxBuffer: 1 << 24 }
  )

  // Poster: ilk kare. Azaltılmış harekette video hiç indirilmez, bu gösterilir.
  const ilkKare = path.join(HEDEF, '_ilk.png')
  execFileSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-i', KAYNAK, '-vf', `select=eq(n\\,0),scale=${GENISLIK}:-2`,
     '-vframes', '1', ilkKare],
    { maxBuffer: 1 << 24 }
  )
  await sharp(ilkKare).webp({ quality: 74 }).toFile(poster)
  await rm(ilkKare, { force: true })

  const b1 = await boyut(mp4)
  const b3 = await boyut(poster)

  console.log('')
  console.log(`  MP4    : ${mb(b1)}  ${b1 <= HEDEF_BAYT ? '✓ sınır içinde' : '✗ 2 MB üstünde'}`)
  console.log(`  Poster : ${mb(b3)}`)
  if (b1 > HEDEF_BAYT) {
    console.log('  CRF değerini yükselt ya da GENISLIK düşür.')
  }
}

main().catch((e) => {
  console.error('HATA:', e.message)
  process.exit(1)
})
