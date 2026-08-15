/**
 * Depoya sır sızmış mı — commit ÖNCESİ tarama.
 *
 * NEDEN VAR: bu depo herkese açık (github.com/naimblideus/servis-takip).
 * 2026-08-15'te kurulum belgesine paylaşılan sır yazılıp push'landı; sır
 * kullanılmadan fark edildiği için gerçek açık oluşmadı ama değer yakıldı.
 * Belgeye "sır yazma" diye not düşmek yetmez — kontrol makinede olmalı.
 *
 * Çalıştırma:  node scripts/sir-tarama.mjs
 * Çıkış kodu:  0 temiz · 1 şüpheli bulgu var
 *
 * Taranan: git'in TAKİP ETTİĞİ dosyalar (.env zaten .gitignore'da, orayı
 * taramak yanlış alarm üretir).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const KALIPLAR = [
  { ad: 'uzun hex (32+ hane) — paylaşılan sır / anahtar', re: /\b[0-9a-f]{32,}\b/i },
  { ad: 'AWS erişim anahtarı', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { ad: 'OpenAI/Anthropic anahtarı', re: /\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})\b/ },
  { ad: 'Google API anahtarı', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { ad: 'özel anahtar bloğu', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { ad: 'bağlantı dizesinde şifre', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/i },
  { ad: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

// Gerçek sır olmayan, kalıba uyan bilinen değerler.
const BEYAZ_LISTE = [
  /example|ornek|placeholder|BURAYA|degistir|xxxx/i,
  /postgres(ql)?:\/\/postgres:postgres123@localhost/i,   // yerel geliştirme
  /postgres(ql)?:\/\/(kullanici|user):(sifre|password)@/i, // belgelerdeki şablon
  /app\.notion\.(com|so)\//i,                            // Notion sayfa kimliği — kimlik bilgisi değil
];

const ATLA = /^(package-lock\.json|.*\.(png|jpg|jpeg|gif|ico|webp|mp4|woff2?|pdf|zip))$/i;

const dosyalar = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter((s) => s && !ATLA.test(s));

let bulgu = 0;
for (const dosya of dosyalar) {
  let metin;
  try { metin = readFileSync(dosya, 'utf8'); } catch { continue; }
  if (metin.includes('\0')) continue; // ikili dosya

  metin.split(/\r?\n/).forEach((satir, i) => {
    if (satir.length > 2000) return;                       // minified/veri satırı
    if (BEYAZ_LISTE.some((b) => b.test(satir))) return;
    for (const k of KALIPLAR) {
      const m = satir.match(k.re);
      if (!m) continue;
      bulgu++;
      const gizli = m[0].length > 12 ? m[0].slice(0, 6) + '…' + m[0].slice(-4) : m[0];
      console.log(`${dosya}:${i + 1}  [${k.ad}]  ${gizli}`);
      break;
    }
  });
}

if (bulgu) {
  console.log(`\n${bulgu} şüpheli değer bulundu. Depo HERKESE AÇIK — commit etmeden önce çıkar.`);
  console.log('Yanlış alarmsa scripts/sir-tarama.mjs içindeki BEYAZ_LISTE\'ye ekle.');
  process.exit(1);
}
console.log('temiz — takip edilen dosyalarda sır kalıbı yok');
