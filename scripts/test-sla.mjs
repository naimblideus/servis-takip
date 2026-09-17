// SLA ÖLÇÜMÜ — çalışma saati, duraklama ve ihlal kuralları
// Çalıştır:  node scripts/test-sla.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Büyük müşterinin sözleşmesindeki tek cümle her şeyi belirler: "4 saat
// içinde müdahale, 24 saat içinde çözüm". Bu ölçümün yanlış olması iki
// yönde de pahalıdır:
//
//   ÇOK KATI ölçersek (duvar saati) bayi haksız yere suçlu çıkar — cuma
//   17:30'da açılan fiş pazartesi 09:00'da 63 saat gecikmiş görünür ve
//   rapor çöpe gider.
//   ÇOK GEVŞEK ölçersek (her duraklamayı düşersek) rapor bayiyi aklar,
//   müşteri ilk denetlemede uyuşmazlığı görür ve bir daha güvenmez.
//
// Ölçülen şeyler:
//   1. Mesai dışı, hafta sonu ve tatil sayılmaz.
//   2. YAZ SAATİ — Avrupa'da yılda iki kez saat kayar; naif hesap bir saat
//      şaşar ve o gün açılan her fişin raporu yanlış çıkar.
//   3. Duraklama YALNIZCA sözleşme öyle diyorsa düşülür ve yalnız çalışma
//      saatine denk gelen kısmı (gece beklenen parça iki kez düşülmesin).
//   4. TÜRETİLMİŞ geçmiş ölçüme girmez — uydurulmuş damgadan uyum oranı
//      üretmek raporun tamamını değersizleştirir.
//   5. Bozuk takvim SIFIR süre değil NULL üretir: sıfır "hemen müdahale
//      edildi" diye okunur ve ihlali gizler.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sla-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/sla.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'sla.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const {
  calismaDakikasi, slaOlcumu, olaylariCikar, slaOzeti, yerelDamga, anaCevir,
  takvimGecerli, VARSAYILAN_TAKVIM,
} = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

/** Türkiye yerel saatini ana çevirir (UTC+3, yaz saati yok). */
const tr = (s) => new Date(`${s}+03:00`);
const TAKVIM = { ...VARSAYILAN_TAKVIM };

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SAAT DİLİMİ ÇEVİRİSİ');
// ───────────────────────────────────────────────────────────────────────────
{
  const d = tr('2026-09-17T14:30:00');
  const y = yerelDamga(d, 'Europe/Istanbul');
  t('yerel damga: 17 Eylül 14:30', y.yil === 2026 && y.ay === 9 && y.gun === 17 && y.dakika === 14 * 60 + 30, y);
  t('hafta günü perşembe (4)', y.haftaGunu === 4, y.haftaGunu);

  const geri = anaCevir(2026, 9, 17, 14 * 60 + 30, 'Europe/Istanbul');
  t('★ ana çevir geri dönüşlü', geri.getTime() === d.getTime(), [geri.toISOString(), d.toISOString()]);

  // Gece yarısı: bazı ortamlar hour12:false ile '24' veriyor — 0 olmalı.
  const gy = yerelDamga(tr('2026-09-17T00:00:00'), 'Europe/Istanbul');
  t('★ gece yarısı 0 dakika (24 değil)', gy.dakika === 0, gy.dakika);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ÇALIŞMA DAKİKASI');
// ───────────────────────────────────────────────────────────────────────────
{
  t('aynı gün 10:00→12:00 = 120 dk',
    calismaDakikasi(tr('2026-09-17T10:00:00'), tr('2026-09-17T12:00:00'), TAKVIM) === 120);

  t('mesai öncesi başlayan iş 09:00\'da sayılır',
    calismaDakikasi(tr('2026-09-17T07:00:00'), tr('2026-09-17T10:00:00'), TAKVIM) === 60);

  t('mesai sonrası kısım sayılmaz',
    calismaDakikasi(tr('2026-09-17T17:00:00'), tr('2026-09-17T23:00:00'), TAKVIM) === 60);

  t('bir gün tam mesai = 540 dk',
    calismaDakikasi(tr('2026-09-17T00:00:00'), tr('2026-09-17T23:59:00'), TAKVIM) === 540);

  // ASIL MESELE: cuma akşamı açılan fiş.
  const cumaAksami = calismaDakikasi(tr('2026-09-18T17:30:00'), tr('2026-09-21T09:00:00'), TAKVIM);
  t('★ cuma 17:30 → pazartesi 09:00 = 30 dk (63 saat DEĞİL)', cumaAksami === 30, cumaAksami);

  t('★ hafta sonu tek başına 0 dk',
    calismaDakikasi(tr('2026-09-19T00:00:00'), tr('2026-09-21T00:00:00'), TAKVIM) === 0);

  const tatilli = { ...TAKVIM, tatiller: ['2026-09-18'] };
  t('★ tatil günü sayılmaz',
    calismaDakikasi(tr('2026-09-18T09:00:00'), tr('2026-09-18T18:00:00'), tatilli) === 0);
  t('tatil öncesi gün normal sayılır',
    calismaDakikasi(tr('2026-09-17T09:00:00'), tr('2026-09-17T18:00:00'), tatilli) === 540);

  t('ters aralık (son < bas) = 0',
    calismaDakikasi(tr('2026-09-17T12:00:00'), tr('2026-09-17T10:00:00'), TAKVIM) === 0);

  // Cumartesi de çalışan bayi
  const cmt = { ...TAKVIM, gunler: [1, 2, 3, 4, 5, 6] };
  t('cumartesi çalışan bayide cumartesi sayılır',
    calismaDakikasi(tr('2026-09-19T09:00:00'), tr('2026-09-19T18:00:00'), cmt) === 540);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ YAZ SAATİ (Avrupa bayisi)');
// ───────────────────────────────────────────────────────────────────────────
{
  // Avrupa'da saatler 29 Mart 2026 gecesi ileri alınır (02:00 → 03:00).
  const berlin = { ...TAKVIM, zamanDilimi: 'Europe/Berlin' };
  const pazartesi = new Date('2026-03-30T07:00:00Z'); // Berlin 09:00 (UTC+2)
  const y = yerelDamga(pazartesi, 'Europe/Berlin');
  t('★ geçişten SONRA fark UTC+2', y.dakika === 9 * 60 && y.gun === 30, y);

  const oncekiCuma = new Date('2026-03-27T16:00:00Z'); // Berlin 17:00 (UTC+1)
  const yc = yerelDamga(oncekiCuma, 'Europe/Berlin');
  t('★ geçişten ÖNCE fark UTC+1', yc.dakika === 17 * 60 && yc.gun === 27, yc);

  // Cuma 17:00 → pazartesi 09:00: cuma 17:00-18:00 = 60 dk. Saat kayması
  // hafta sonuna denk geliyor; naif hesap 60 yerine 0 ya da 120 verirdi.
  const sure = calismaDakikasi(oncekiCuma, pazartesi, berlin);
  t('★ yaz saati geçişi süreyi kaydırmıyor (60 dk)', sure === 60, sure);

  // Geçiş GÜNÜ içinde: 30 Mart pazartesi tam mesai yine 540 dk.
  t('geçişten sonraki ilk iş günü tam mesai 540 dk',
    calismaDakikasi(new Date('2026-03-30T00:00:00Z'), new Date('2026-03-30T23:00:00Z'), berlin) === 540);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ BOZUK TAKVİM SESSİZCE GEÇMİYOR');
// ───────────────────────────────────────────────────────────────────────────
{
  t('çalışılan gün yoksa geçersiz', takvimGecerli({ ...TAKVIM, gunler: [] }) === false);
  t('bitiş başlangıçtan küçükse geçersiz', takvimGecerli({ ...TAKVIM, bitisDk: 60 }) === false);
  t('★ geçersiz takvim null döner (0 DEĞİL)',
    calismaDakikasi(tr('2026-09-17T10:00:00'), tr('2026-09-17T12:00:00'), { ...TAKVIM, gunler: [] }) === null);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ AŞAMA GEÇMİŞİNDEN OLAY ÇIKARMA');
// ───────────────────────────────────────────────────────────────────────────
{
  const satir = (status, iso, kaynak = 'PANEL') => ({ status, changedAt: tr(iso), kaynak });
  const o = olaylariCikar([
    satir('NEW', '2026-09-17T09:10:00'),
    satir('IN_SERVICE', '2026-09-17T10:40:00'),
    satir('WAITING_FOR_PART', '2026-09-17T11:00:00'),
    satir('IN_SERVICE', '2026-09-18T10:00:00'),
    satir('READY', '2026-09-18T12:00:00'),
  ], tr('2026-09-17T09:00:00'));

  t('açılış NEW satırından', o.acilis.getTime() === tr('2026-09-17T09:10:00').getTime());
  t('ilk müdahale IN_SERVICE', o.ilkMudahale.getTime() === tr('2026-09-17T10:40:00').getTime());
  t('çözüm READY', o.cozum.getTime() === tr('2026-09-18T12:00:00').getTime());
  t('bir duraklama aralığı', o.duraklamalar.length === 1);
  t('duraklama kapandı', o.duraklamalar[0].son.getTime() === tr('2026-09-18T10:00:00').getTime());
  t('türetilmiş değil', o.turetilmis === false);

  // NEW satırı yoksa fişin kendi createdAt'i kullanılır.
  const o2 = olaylariCikar([satir('IN_SERVICE', '2026-09-17T11:00:00')], tr('2026-09-17T09:00:00'));
  t('★ NEW satırı yoksa açılış createdAt', o2.acilis.getTime() === tr('2026-09-17T09:00:00').getTime());

  const o3 = olaylariCikar([satir('NEW', '2026-09-17T09:00:00', 'GECMIS')], tr('2026-09-17T09:00:00'));
  t('★ GECMIS kaynaklı satır türetilmiş sayılır', o3.turetilmis === true);
  t('★ hiç geçmişi olmayan fiş de türetilmiş sayılır',
    olaylariCikar([], tr('2026-09-17T09:00:00')).turetilmis === true);

  // READY ve DELIVERED birlikteyse ÖNCE olan çözüm anıdır.
  const o4 = olaylariCikar([
    satir('NEW', '2026-09-17T09:00:00'),
    satir('READY', '2026-09-17T14:00:00'),
    satir('DELIVERED', '2026-09-18T11:00:00'),
  ], tr('2026-09-17T09:00:00'));
  t('çözüm anı READY (teslimden önce)', o4.cozum.getTime() === tr('2026-09-17T14:00:00').getTime());
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ÖLÇÜM VE İHLAL');
// ───────────────────────────────────────────────────────────────────────────
const SIMDI = tr('2026-09-25T12:00:00');
const HEDEF = { mudahaleDk: 240, cozumDk: 24 * 60, parcaDurdurur: false };
const olay = (p) => ({
  acilis: tr('2026-09-17T09:00:00'), ilkMudahale: null, cozum: null,
  duraklamalar: [], turetilmis: false, iptal: false, ...p,
});
{
  const o = slaOlcumu(olay({
    ilkMudahale: tr('2026-09-17T10:00:00'),
    cozum: tr('2026-09-17T15:00:00'),
  }), HEDEF, TAKVIM, SIMDI);
  t('müdahale 60 dk', o.mudahaleDk === 60, o.mudahaleDk);
  t('çözüm 360 dk', o.cozumDk === 360, o.cozumDk);
  t('ihlal yok', o.mudahaleIhlal === false && o.cozumIhlal === false);
  t('kapsamda', o.kapsamda === true);

  const gec = slaOlcumu(olay({
    ilkMudahale: tr('2026-09-18T12:00:00'), // ertesi gün
    cozum: tr('2026-09-18T17:00:00'),
  }), HEDEF, TAKVIM, SIMDI);
  // 17 Eyl 09:00→18:00 = 540, 18 Eyl 09:00→12:00 = 180 → 720 dk
  t('★ ertesi güne sarkan müdahale 720 dk', gec.mudahaleDk === 720, gec.mudahaleDk);
  t('★ 4 saatlik hedef ihlal', gec.mudahaleIhlal === true);

  // AÇIK İŞ: henüz müdahale edilmemiş ve hedef çoktan geçmiş.
  const acik = slaOlcumu(olay({}), HEDEF, TAKVIM, SIMDI);
  t('★ açık iş ihlali ertelemiyor', acik.mudahaleIhlal === true && acik.mudahaleAcik === true);

  // İPTAL: çözüm beklenmez.
  const iptal = slaOlcumu(olay({ ilkMudahale: tr('2026-09-17T10:00:00'), iptal: true }), HEDEF, TAKVIM, SIMDI);
  t('★ iptal fişte çözüm ihlali yok', iptal.cozumIhlal === null && iptal.cozumDk === null);
  t('iptal fişte müdahale yine ölçülür', iptal.mudahaleDk === 60);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ DURAKLAMA (parça bekleme)');
// ───────────────────────────────────────────────────────────────────────────
{
  const duraklamali = olay({
    ilkMudahale: tr('2026-09-17T10:00:00'),
    cozum: tr('2026-09-18T12:00:00'),
    // 17 Eyl 11:00 → 18 Eyl 10:00 arası parça bekleniyor
    duraklamalar: [{ bas: tr('2026-09-17T11:00:00'), son: tr('2026-09-18T10:00:00') }],
  });

  const katı = slaOlcumu(duraklamali, { ...HEDEF, parcaDurdurur: false }, TAKVIM, SIMDI);
  // 17 Eyl 09:00→18:00 = 540 + 18 Eyl 09:00→12:00 = 180 → 720
  t('saat durmuyorsa çözüm 720 dk', katı.cozumDk === 720, katı.cozumDk);

  const gevsek = slaOlcumu(duraklamali, { ...HEDEF, parcaDurdurur: true }, TAKVIM, SIMDI);
  // Duraklamanın ÇALIŞMA saatine denk gelen kısmı: 17 Eyl 11:00-18:00 = 420,
  // 18 Eyl 09:00-10:00 = 60 → 480. 720 - 480 = 240.
  t('★ saat duruyorsa yalnız MESAİ kısmı düşülür (240 dk)', gevsek.cozumDk === 240, gevsek.cozumDk);
  t('★ ham süre her iki durumda da aynı kalır',
    katı.cozumHamDk === 720 && gevsek.cozumHamDk === 720, [katı.cozumHamDk, gevsek.cozumHamDk]);

  // Gece beklenen parça iki kez düşülmemeli.
  const gece = slaOlcumu(olay({
    ilkMudahale: tr('2026-09-17T10:00:00'),
    cozum: tr('2026-09-18T10:00:00'),
    duraklamalar: [{ bas: tr('2026-09-17T18:00:00'), son: tr('2026-09-18T09:00:00') }],
  }), { ...HEDEF, parcaDurdurur: true }, TAKVIM, SIMDI);
  // 540 + 60 = 600; duraklama tamamen mesai dışı → düşülecek bir şey yok.
  t('★ mesai dışı duraklama süreyi düşürmüyor', gece.cozumDk === 600, gece.cozumDk);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ KAPSAM DIŞI KALMA SEBEPLERİ');
// ───────────────────────────────────────────────────────────────────────────
{
  const tur = slaOlcumu(olay({ turetilmis: true }), HEDEF, TAKVIM, SIMDI);
  t('★ türetilmiş geçmiş ölçüme girmiyor',
    tur.kapsamda === false && tur.disKalmaKodu === 'TURETILMIS_GECMIS');

  const hedefsiz = slaOlcumu(olay({}), { mudahaleDk: null, cozumDk: null, parcaDurdurur: false }, TAKVIM, SIMDI);
  t('★ hedefi olmayan fiş uyum oranına girmiyor',
    hedefsiz.kapsamda === false && hedefsiz.disKalmaKodu === 'HEDEF_YOK');

  const bozuk = slaOlcumu(olay({}), HEDEF, { ...TAKVIM, gunler: [] }, SIMDI);
  t('bozuk takvim kapsam dışı', bozuk.disKalmaKodu === 'TAKVIM_GECERSIZ');
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ÖZET');
// ───────────────────────────────────────────────────────────────────────────
{
  const iyi = slaOlcumu(olay({ ilkMudahale: tr('2026-09-17T10:00:00'), cozum: tr('2026-09-17T15:00:00') }), HEDEF, TAKVIM, SIMDI);
  const kotu = slaOlcumu(olay({ ilkMudahale: tr('2026-09-18T12:00:00'), cozum: tr('2026-09-21T12:00:00') }), HEDEF, TAKVIM, SIMDI);
  const disi = slaOlcumu(olay({ turetilmis: true }), HEDEF, TAKVIM, SIMDI);
  const o = slaOzeti([iyi, iyi, iyi, kotu, disi]);

  t('ölçülen 4 fiş', o.olculen === 4, o.olculen);
  t('türetilmiş dışı 1', o.turetilmisDisi === 1);
  t('müdahale ihlali 1', o.mudahaleIhlal === 1);
  t('★ uyum %75', o.mudahaleUyumYuzde === 75, o.mudahaleUyumYuzde);
  t('★ ortanca kullanılıyor (ortalama değil)', o.mudahaleOrtancaDk === 60, o.mudahaleOrtancaDk);

  const bos = slaOzeti([]);
  t('★ ölçülen yoksa uyum null (0 DEĞİL)', bos.mudahaleUyumYuzde === null, bos.mudahaleUyumYuzde);
  t('ölçülen yoksa ortanca null', bos.cozumOrtancaDk === null);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
