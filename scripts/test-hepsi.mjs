// TÜM TESTLER — tek komut, çöken test SAKLANMAZ.
// Çalıştır:  node scripts/test-hepsi.mjs   (önce `npm run dev`)
//
// NEDEN BU DOSYA
// Testleri elle bir kabuk döngüsüyle koşturuyordum ve o döngü çıktıdaki
// "X geçti, Y kaldı" satırını arıyordu. Bir test ÇÖKTÜĞÜNDE o satır hiç
// basılmıyor; döngü onu "farklı biçim" sayıp atlıyor ve toplam yine
// "0 kaldı" diyordu. Böylece kırmızı bir test bir tur boyunca görünmedi ve
// hatalı kod canlıya çıktı (e-Fatura listesini tamamen boşaltan SQL NULL
// hatası).
//
// Buradaki kural: ÇIKIŞ KODU sıfır değilse ya da özet satırı yoksa test
// BAŞARISIZDIR. Sessizce atlanan test diye bir şey yok.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BURASI = dirname(fileURLToPath(import.meta.url));
const KENDISI = 'test-hepsi.mjs';

const dosyalar = readdirSync(BURASI)
  .filter((f) => f.startsWith('test-') && f.endsWith('.mjs') && f !== KENDISI)
  .sort();

let toplamGecti = 0, toplamKaldi = 0;
const kirmizi = [];
const atlanan = [];
const ozetsiz = [];

for (const f of dosyalar) {
  const r = spawnSync(process.execPath, [join(BURASI, f)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const cikti = `${r.stdout || ''}${r.stderr || ''}`;

  // Sunucu ya da ortam değişkeni yoksa test kendini ATLIYOR — bu bir hata
  // değil ama sayılmalı, "geçti" gibi görünmemeli.
  if (/^ATLANDI:/m.test(cikti)) {
    atlanan.push(f);
    console.log(`  ⊘ ${f.padEnd(32)} atlandı`);
    continue;
  }

  const m = [...cikti.matchAll(/(\d+) geçti, (\d+) kaldı/g)].pop();
  const eski = [...cikti.matchAll(/(\d+) gecti, (\d+) kaldi/g)].pop();
  const s = m || eski;

  if (!s) {
    // Özet yok: test çökmüş ya da farklı biçimde yazılmış. İkisi de
    // "sessizce geçti" sayılamaz.
    ozetsiz.push(f);
    const sonSatir = cikti.trim().split('\n').filter(Boolean).pop() || '(çıktı yok)';
    console.log(`  ✗ ${f.padEnd(32)} ÖZET YOK (çıkış ${r.status}) — ${sonSatir.slice(0, 80)}`);
    continue;
  }

  const g = Number(s[1]), k = Number(s[2]);
  toplamGecti += g; toplamKaldi += k;
  if (k > 0 || r.status !== 0) {
    kirmizi.push({ f, g, k, cikis: r.status });
    console.log(`  ✗ ${f.padEnd(32)} ${g} geçti, ${k} kaldı (çıkış ${r.status})`);
  } else {
    console.log(`  ✓ ${f.padEnd(32)} ${g} geçti`);
  }
}

console.log(`\n${dosyalar.length} dosya · ${toplamGecti} geçti · ${toplamKaldi} kaldı`);
if (atlanan.length) console.log(`atlanan: ${atlanan.join(', ')}`);

if (kirmizi.length || ozetsiz.length) {
  if (kirmizi.length) console.log(`\nKIRMIZI: ${kirmizi.map((x) => x.f).join(', ')}`);
  if (ozetsiz.length) console.log(`ÖZET YOK (çökmüş olabilir): ${ozetsiz.join(', ')}`);
  process.exit(1);
}
console.log('hepsi yeşil');
