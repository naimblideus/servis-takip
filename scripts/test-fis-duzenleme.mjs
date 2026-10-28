// FİŞ DÜZENLEME — "Kaydet" eski toplamı geri yazmıyor mu?
// Çalıştır:  node scripts/test-fis-duzenleme.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST (ölçülmüş para kaybı)
// Fiş toplamı ₺950 (1 toner). "+ Ekle" ile ikinci toner eklenince parça paneli
// toplamı ₺1.900 yapıyordu; ama durum paneli ilk açılıştaki ₺950'yi tutuyordu.
// Teknisyen "Düzenle"de yalnız "Yapılan İşlem"i değiştirip Kaydet'e basınca
// gövdede totalCost "950.00" gidiyor, sunucu toplamı 950'ye GERİ çekiyordu.
// Ödeme Takibi de ₺950 gösteriyor, WhatsApp "Hazır" mesajı eski tutarı
// yazıyordu. Telefonda ilk parçada toplam ₺0, mesajda tutar satırı yoktu.
//
// Kural (lib/fis-duzenleme.ts): yalnız DEĞİŞEN alan gider; tutar yalnız
// kullanıcı kutuya YAZDIYSA. Ekranlar ise sunucudaki son tutarı gösterir.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-fisduz-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/fis-duzenleme.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { fisDuzenGovdesi } = await import(pathToFileURL(join(g, 'fis-duzenleme.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const acilis = {
  assignedUserId: 'u1', paymentStatus: 'UNPAID', totalCost: '950.00',
  issueText: 'Kağıt sıkıştırıyor', actionText: '', notes: '', createdAt: '2026-10-14T09:30',
};

console.log('\n★ ÖLÇÜLMÜŞ HATA: yalnız "Yapılan İşlem" değişti\n');
{
  // Panel açıkken parça eklendi (sunucuda toplam 1.900) — tampon hâlâ 950.
  const g1 = fisDuzenGovdesi(acilis, { ...acilis, actionText: 'Toner değişti' }, false);
  t('★ gövdede totalCost YOK (eski 950 geri yazılmıyor)', !('totalCost' in g1), g1);
  t('yalnız değişen alan gidiyor', JSON.stringify(g1) === JSON.stringify({ actionText: 'Toner değişti' }), g1);
  t('ödeme durumu da gitmiyor (arada ödeme eklenmiş olabilir)', !('paymentStatus' in g1), g1);
  t('★ fiş tarihi değişmediyse gitmiyor (her kayıtta saniyesini kaybetmesin)', !('createdAt' in g1), g1);
}

console.log('\nTUTAR YALNIZ KULLANICI YAZDIYSA\n');
{
  const g1 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '1900' }, true);
  t('kutuya yazılan tutar gidiyor', g1.totalCost === '1900.00', g1);
  const g2 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '1900' }, false);
  t('kutu arka planda (parçalardan) değiştiyse gitmiyor', !('totalCost' in g2), g2);
  const g3 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '' }, true);
  t('boşaltılmış kutu gönderilmiyor (NaN kayıt hatası olurdu)', !('totalCost' in g3), g3);
  const g4 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '-5' }, true);
  t('eksi tutar gönderilmiyor', !('totalCost' in g4), g4);
  const g5 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '1250,5' }, true);
  t('virgüllü ondalık okunuyor', g5.totalCost === '1250.50', g5);
  const g6 = fisDuzenGovdesi(acilis, { ...acilis, totalCost: '0' }, true);
  t('bilerek sıfırlanan tutar gidiyor', g6.totalCost === '0.00', g6);
}

console.log('\nDİĞER ALANLAR\n');
{
  t('hiçbir şey değişmediyse gövde boş (istek atılmaz)', Object.keys(fisDuzenGovdesi(acilis, { ...acilis }, false)).length === 0);
  const g1 = fisDuzenGovdesi(acilis, { ...acilis, assignedUserId: '' }, false);
  t('teknisyen ataması kaldırılabiliyor', g1.assignedUserId === '', g1);
  const g2 = fisDuzenGovdesi(acilis, { ...acilis, paymentStatus: 'PAID', notes: 'not' }, false);
  t('birden çok değişen alan birlikte gidiyor', g2.paymentStatus === 'PAID' && g2.notes === 'not' && Object.keys(g2).length === 2, g2);
  const g3 = fisDuzenGovdesi(acilis, { ...acilis, createdAt: '2026-10-13T08:00' }, false);
  t('değişen fiş tarihi ISO olarak gidiyor', g3.createdAt === new Date('2026-10-13T08:00').toISOString(), g3);
  const g4 = fisDuzenGovdesi(acilis, { ...acilis, createdAt: '' }, false);
  t('boşaltılan tarih gönderilmiyor', !('createdAt' in g4), g4);
  const g5 = fisDuzenGovdesi(acilis, { ...acilis, hataKodu: ' E-02 ', planlananTarih: '2026-10-29', bosKartusAdet: '3' }, false);
  t('saha ekleri: hata kodu kırpılıp, gün ve boş kartuş gidiyor', g5.hataKodu === 'E-02' && g5.planlananTarih === '2026-10-29' && g5.bosKartusAdet === '3', g5);
  const g6 = fisDuzenGovdesi({ ...acilis, hataKodu: 'E-02' }, { ...acilis, hataKodu: '' }, false);
  t('saha ekleri: boşaltılan hata kodu temizlenmek üzere gidiyor', g6.hataKodu === '', g6);
  t('saha ekleri: dokunulmayan ek gönderilmiyor', !('hataKodu' in fisDuzenGovdesi(acilis, { ...acilis }, false)));
}

console.log('\nEKRANLAR SUNUCUDAKİ SON TUTARI GÖSTERİYOR (kaynak denetimi)\n');
{
  const durum = readFileSync(join(KOK, 'src/components/TicketStatusPanel.tsx'), 'utf8');
  const odeme = readFileSync(join(KOK, 'src/components/TicketPaymentPanel.tsx'), 'utf8');
  const parca = readFileSync(join(KOK, 'src/components/TicketPartsPanel.tsx'), 'utf8');
  t('★ WhatsApp mesajı tamponu değil sunucudaki tutarı yazıyor', /totalCost: currentTotalCost/.test(durum) && !/totalCost: Number\(totalCost\)/.test(durum));
  t('Kaydet gövdesi fisDuzenGovdesi\'nden geliyor', /fisDuzenGovdesi\(acilis/.test(durum) && !/body: JSON\.stringify\(\{\s*assignedUserId,\s*paymentStatus,\s*totalCost/.test(durum));
  t('panel açılırken tampon sunucudan dolduruluyor', /const paneliAcKapa/.test(durum) && /onClick=\{paneliAcKapa\}/.test(durum));
  t('tutar kutusuna yazınca "elle" işaretleniyor', /setToplamElle\(true\)/.test(durum));
  t('★ Ödeme Takibi toplam değişince yeniden yükleniyor', /\[ticketId, initialTotalCost\]/.test(odeme) && /setTotalCost\(initialTotalCost\)/.test(odeme));
  t('★ parça çıkarma reddedilirse kullanıcıya söyleniyor (demoda 403 sessiz kalıyordu)', /const removePart[\s\S]{0,400}if \(!r\.ok\)[\s\S]{0,200}alert\(/.test(parca));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
