// CRM SİNYALİ — kurulum ilerlemesi ve "Sorun bildir" kayıtları CRM'e NASIL gider (saf kural + kaynak denetimi)
// Çalıştır:  node scripts/test-crm-sinyal.mjs   (veritabanı ya da sunucu gerekmez)
//
// NEDEN BU TEST
// CRM (crm.nextusservis.com) bu sinyallerle satışın takibini kurar, Müşteri Akışı'nda kurulumu
// gösterir ve bayinin ürün içinden yazdığı sorunu Merkez'e geri bildirim olarak düşer. Anahtar
// kayarsa CRM aynı şeyi her gün yeniden işler (sabah listesi şişer) ya da hiç işlemez (sinyal kaybolur);
// tür kayarsa sorun "öneri" diye sentezlenir. Demo kiracı CRM'e müşteri diye düşmemeli.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'st-crm-sinyal-'));
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/crm-sinyal.ts'),
      '--outDir', g, '--rootDir', join(KOK, 'src/lib'), '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  const c = await import(pathToFileURL(join(g, 'crm-sinyal.js')).href);

  console.log('\n★ KURULUM\n');
  const k = (zorunluTamam, hazir = false, sonraki = 'SAYAC') => ({
    tenantId: 'tn1',
    kurulum: { zorunluTamam, zorunluToplam: 5, hazir, sonrakiAdim: sonraki ? { kod: sonraki } : null },
  });
  t('hiç adım yoksa kurulum sinyali yok (deneme başladı zaten gidiyor)', c.kurulumSinyali(k(0)) === null);
  const ilk = c.kurulumSinyali(k(3));
  t('3/5 → KURULUM_ILERLEDI, başlıkta sayı', ilk?.tur === 'KURULUM_ILERLEDI' && ilk.baslik === 'Kurulum 3/5', ilk);
  t('sıradaki adım okunur adla yazılır', ilk?.detay === 'Sıradaki: sayaç okuma', ilk?.detay);
  t('anahtar adım sayısını taşır: aynı gün tekrar → aynı anahtar, ilerleyince yeni', ilk?.anahtar === 'KURULUM:tn1:3' && c.kurulumSinyali(k(4)).anahtar === 'KURULUM:tn1:4');
  const tamam = c.kurulumSinyali(k(5, true, null));
  t('hazır → KURULUM_TAMAM, kiracı başına bir kez', tamam?.tur === 'KURULUM_TAMAM' && tamam.anahtar === 'KURULUM_TAMAM:tn1', tamam);

  console.log('\n★ SORUN BİLDİR → MERKEZ GERİ BİLDİRİMİ\n');
  const sorun = (ek) => ({
    id: 'sr1', tur: 'DURDURUYOR', kutu: null, neYapiyordu: 'Fatura kesiyordum', neOldu: 'Kaydet tuşu dönüp duruyor',
    sayfa: '/faturalar/yeni?musteri=abc', kullaniciAd: 'Ayşe', rol: 'TECHNICIAN', ...ek,
  });
  const s1 = c.sorunSinyali(sorun());
  t('tür SORUN_BILDIRDI, anahtar ve kaynak kaydın kimliğinden', s1.tur === 'SORUN_BILDIRDI' && s1.anahtar === 'SORUN:sr1' && s1.geriBildirim.kaynakRef === 'servis-sorun:sr1', s1);
  t('işi durduran → başlıkta yazar, geri bildirim türü SORUN', s1.baslik.includes('durduruyor') && s1.geriBildirim.tur === 'SORUN');
  t('metin: ne yapıyordu + ne oldu + sayfa (sorgusu atılır)', s1.geriBildirim.metin === 'Ne yapıyordu: Fatura kesiyordum\nNe oldu: Kaydet tuşu dönüp duruyor\nSayfa: /faturalar/yeni', s1.geriBildirim.metin);
  t('kimden: ad + rol', s1.geriBildirim.kimden === 'Ayşe (technician)', s1.geriBildirim.kimden);
  t('öneri → İSTEK', c.sorunSinyali(sorun({ tur: 'ONERI' })).geriBildirim.tur === 'ISTEK');
  t('ayıklanmışsa kutu kazanır: BILGI_EKSIGI → SORU', c.sorunSinyali(sorun({ kutu: 'BILGI_EKSIGI' })).geriBildirim.tur === 'SORU');
  t('ayıklanmışsa kutu kazanır: öneri ama HATA kutusunda → SORUN', c.sorunSinyali(sorun({ tur: 'ONERI', kutu: 'HATA' })).geriBildirim.tur === 'SORUN');
  t('ekran görüntüsü gönderilmez', !JSON.stringify(s1).includes('data:image'));

  console.log('\n★ GÖNDERİM (kaynak)\n');
  const rota = readFileSync(join(KOK, 'src/app/api/cron/crm-sinyal/route.ts'), 'utf8');
  t('demo kiracılar CRM\'e gitmez', /demo:\s*false/.test(rota) && (rota.match(/demo:\s*false/g) || []).length >= 3);
  t('firma adı da gider (CRM\'de yoksa açılsın)', /JSON\.stringify\(\{\s*urun:\s*"nexus-servis",\s*telefon,\s*firma/.test(rota));
  t('kurulum aynı ölçüden (kurulumListesi) hesaplanır', rota.includes('kurulumListesi()') && rota.includes('kurulumSinyali('));
  t('CRM adresi yoksa ağır hesaba girilmez', /if \(process\.env\.NEXUS_CRM_OLAY\)/.test(rota));
  t('CRM çağrısı zaman aşımlı (fatura yolunu beklemez)', /AbortSignal\.timeout\(/.test(rota));
} catch (e) {
  kaldi++;
  console.log('  ✗ test çöktü —', e);
} finally {
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
