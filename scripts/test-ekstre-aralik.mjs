// EKSTRE ARALIĞI — dönem + devreden bakiye (lib/ekstre-aralik)
// Çalıştır:  node scripts/test-ekstre-aralik.mjs
//
// NEDEN BU TEST
// Eski müşterinin ekstresi ekranda ve kâğıtta bütün geçmişi döküyordu. Artık
// dönem seçiliyor; öncesi tek "devreden bakiye" satırı. Bakiye ASLA değişmemeli.
import { derle } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice } = derle({ girisler: ['src/lib/ekstre-aralik.ts'], onEk: 'st-ekstre-aralik-' });
const e = await ice('lib/ekstre-aralik');

console.log('\nARALIK\n');
const an = new Date('2026-10-26T09:00:00Z');
t('son 3 ay: iki ay önceki ayın 1\'i (26 Eki → 1 Ağu)', e.aralikCoz('SON3', an).bas === '2026-08-01');
t('yıl geçişi: 15 Şubat → 1 Aralık', e.aralikCoz('SON3', new Date('2026-02-15T09:00:00Z')).bas === '2025-12-01');
t('bu yıl: 1 Ocak', e.aralikCoz('BU_YIL', an).bas === '2026-01-01');
t('tümü sınırsız', e.aralikCoz('TUMU', an).bas === null && e.aralikCoz('TUMU', an).bit === null);
t('özel: ters girilen tarihler düzelir', JSON.stringify(e.aralikCoz('OZEL', an, '2026-09-30', '2026-01-01')) === JSON.stringify({ bas: '2026-01-01', bit: '2026-09-30' }));
t('özel: geçersiz gün yok sayılır', e.aralikCoz('OZEL', an, '2026-02-31', 'x').bas === null);
t('İstanbul günü: 31 Ara 22:30 UTC = 1 Ocak', e.istanbulGunu('2025-12-31T22:30:00Z') === '2026-01-01');

console.log('\nKESİT\n');
const s = (tip, tutar, tarih) => ({ tip, tutar, tarih });
const hepsi = [
  s('BORC', 1000, '2025-03-18T10:00:00Z'),
  s('BORC', 2000, '2026-04-01T10:00:00Z'),
  s('ODEME', 1500, '2026-04-21T10:00:00Z'),
  s('BORC', 500, '2026-09-17T10:00:00Z'),
  s('ODEME', 200, '2026-10-01T10:00:00Z'),
  s('BORC', 999, '2026-11-05T10:00:00Z'),
];
const tam = e.ekstreKes(hepsi, null, null);
const k = e.ekstreKes(hepsi, '2026-08-01', null);
t('★ aralık bakiyeyi değiştirmez (devir + dönem = tümü)', k.kapanis === tam.kapanis, { k: k.kapanis, tam: tam.kapanis });
t('devir = öncekilerin bakiyesi (1000 + 2000 − 1500)', k.devir === 1500 && k.onceki === 3);
t('dönemde yalnız ağustos sonrası satırlar', k.satirlar.length === 3 && k.donemBorc === 1499 && k.donemOdeme === 200);
const b = e.ekstreKes(hepsi, '2026-08-01', '2026-10-31');
t('bitişten sonrası sayılmaz', b.satirlar.length === 2 && b.kapanis === 1800, b);
t('sıra korunur (ekran yeniden eskiye verir)', e.ekstreKes([...hepsi].reverse(), '2026-08-01', null).satirlar[0].tutar === 999);

console.log('\nYALNIZ ÖDENMEMİŞLER\n');
const x = (id, kaynak, tip, tutar, tarih) => ({ id, kaynak, tip, tutar, tarih, aciklama: id });
const karma = [
  x('s1', 'SERVIS', 'BORC', 1000, '2025-03-18T10:00:00Z'),
  x('s2', 'SERVIS', 'BORC', 2000, '2025-05-01T10:00:00Z'),
  x('s3', 'SERVIS', 'BORC', 500, '2026-09-17T10:00:00Z'),
  x('p1', 'SERVIS', 'ODEME', 2500, '2026-04-21T10:00:00Z'),
  x('f1', 'FATURA', 'BORC', 3000, '2026-08-28T10:00:00Z'),
  x('f1-pay', 'FATURA', 'ODEME', 3000, '2026-08-28T10:00:00Z'),
  x('f2', 'FATURA', 'BORC', 3176.16, '2026-10-01T10:00:00Z'),
  x('f3', 'FATURA', 'BORC', 1000, '2026-09-01T10:00:00Z'),
  x('f3-pay', 'FATURA', 'ODEME', 400, '2026-09-01T10:00:00Z'),
];
const a = e.acikKalemler(karma);
t('★ ödenmemişler toplamı = ekstre bakiyesi', a.toplam === e.ekstreKes(karma, null, null).kapanis, { a: a.toplam, b: e.ekstreKes(karma, null, null).kapanis });
t('servis tahsilatı en eski borçtan düşülür (s1 kapandı, s2 yarım)', !a.kalemler.find((k) => k.id === 's1') && a.kalemler.find((k) => k.id === 's2')?.kalan === 500);
t('ödenmiş fatura listede yok, kısmi ödenen kalanıyla var', !a.kalemler.find((k) => k.id === 'f1') && a.kalemler.find((k) => k.id === 'f3')?.kalan === 600);
t('eskiden yeniye sıralı', a.kalemler.map((k) => k.id).join(',') === 's2,f3,s3,f2', a.kalemler.map((k) => k.id));
const fazla = e.acikKalemler([x('s1', 'SERVIS', 'BORC', 100, '2026-01-01T10:00:00Z'), x('p', 'SERVIS', 'ODEME', 250, '2026-02-01T10:00:00Z')]);
t('servis fazla ödemesi eksi satır', fazla.kalemler.length === 1 && fazla.kalemler[0].fazlaOdeme && fazla.toplam === -150);

console.log('\nBAĞLI TAHSİLAT\n');
const y = (id, tip, tutar, tarih, bagli) => ({ id, kaynak: 'SERVIS', tip, tutar, tarih, aciklama: id, bagli });
const bagli = e.acikKalemler([
  y('eski', 'BORC', 1000, '2026-01-01T10:00:00Z', 'fisA'),
  y('yeni', 'BORC', 800, '2026-05-01T10:00:00Z', 'fisB'),
  y('o', 'ODEME', 800, '2026-05-02T10:00:00Z', 'fisB'),
]);
t('★ fişten alınan tahsilat O fişi kapatır (en eskiyi değil)', bagli.kalemler.length === 1 && bagli.kalemler[0].id === 'eski', bagli.kalemler.map((k) => k.id));
const pesin = e.acikKalemler([
  y('eski', 'BORC', 1000, '2026-01-01T10:00:00Z', null),
  y('toner', 'BORC', 1250, '2026-06-25T09:00:00Z', null),
  y('drum', 'BORC', 1750, '2026-06-25T09:00:00Z', null),
  y('pesin', 'ODEME', 3000, '2026-06-25T09:00:00Z', null),
]);
t('★ peşin barkodlu satış kendi satırlarını kapatır', pesin.kalemler.length === 1 && pesin.kalemler[0].id === 'eski', pesin.kalemler.map((k) => k.id));
const artan = e.acikKalemler([
  y('a', 'BORC', 500, '2026-01-01T10:00:00Z', 'fisA'),
  y('b', 'BORC', 700, '2026-02-01T10:00:00Z', 'fisB'),
  y('o', 'ODEME', 900, '2026-02-02T10:00:00Z', 'fisB'),
]);
t('fişe fazla ödenen artan en eski borçtan düşer', artan.kalemler.length === 1 && artan.kalemler[0].id === 'a' && artan.kalemler[0].kalan === 300 && artan.toplam === 300, artan.kalemler);
const fat = e.acikKalemler([
  { id: 'f', kaynak: 'FATURA', tip: 'BORC', tutar: 1000, tarih: '2026-10-01T10:00:00Z', aciklama: 'f', bagli: 'f' },
  { id: 'f-pay-1', kaynak: 'FATURA', tip: 'ODEME', tutar: 400, tarih: '2026-10-20T10:00:00Z', aciklama: 'p', bagli: 'f' },
  { id: 'f-pay-2', kaynak: 'FATURA', tip: 'ODEME', tutar: 600, tarih: '2026-10-25T10:00:00Z', aciklama: 'p', bagli: 'f' },
]);
t('fatura birden çok tahsilatla kapanır', fat.kalemler.length === 0 && fat.toplam === 0);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
