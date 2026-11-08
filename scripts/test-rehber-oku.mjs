// TELEFON REHBERİ OKUYUCU — kaydı olmayan bayinin müşteri listesi
// Çalıştır:  node scripts/test-rehber-oku.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Hiç Excel tutmamış bayinin listesi telefonunun rehberindedir. iPhone,
// Android ve Google Kişiler .vcf dosyasını üç ayrı biçimde yazıyor; biri
// bozuk okunursa bayi kendi müşterisini tanımaz hâle gelir. Burada:
//   · iPhone (vCard 3.0): grup önekli TEL, ORG, cep numarası önce;
//   · Android (vCard 2.1): QUOTED-PRINTABLE Türkçe harfler ve "=" ile
//     biten yumuşak satır sonu;
//   · vCard 4.0: "tel:" URI'si; katlanmış satır; kaçışlı virgül/noktalı virgül;
//   · FN yoksa N'den ad; telefonu olmayan kişi atlanır; CRLF;
//   · müşteri adı: firma yazılıysa firma, kişi yetkili olur;
//   · uç ve ekran: yalnız işaretlenen kişiler gider, teknisyen kullanamaz.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const ayni = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

const { ice, temizle } = derle({ girisler: ['src/lib/rehber-oku.ts'], onEk: 'st-rehber-' });
try {
  const { rehberOku, musteriAdi, TOPLU_AZAMI } = await ice('lib/rehber-oku');

  const vcf = [
    // iPhone (3.0)
    'BEGIN:VCARD', 'VERSION:3.0', 'PRODID:-//Apple Inc.//iPhone OS 17.0//EN',
    'N:Öztürk;Çağrı;;;', 'FN:Çağrı Öztürk', 'ORG:Yıldız Muhasebe Ltd. Şti.;',
    'TEL;type=WORK;type=VOICE:0212 555 44 33',
    'item1.TEL;type=CELL;type=VOICE;type=pref:+90 532 111 22 33',
    'END:VCARD',
    // Android (2.1) — QUOTED-PRINTABLE, yumuşak satır sonu
    'BEGIN:VCARD', 'VERSION:2.1',
    'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C5=9Eahin;Mehmet;;;',
    'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Mehmet =C5=9Eahin =C4=B0=',
    'stanbul',
    'TEL;CELL:0533 222 33 44',
    'END:VCARD',
    // vCard 4.0 — tel: URI
    'BEGIN:VCARD', 'VERSION:4.0', 'FN:Deniz Hukuk Bürosu',
    'TEL;VALUE=uri;TYPE="cell,voice":tel:+90-534-333-44-55',
    'END:VCARD',
    // Telefonsuz kişi — atlanır
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Annem', 'EMAIL:anne@ornek.com', 'END:VCARD',
    // Katlanmış satır + kaçış
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Ege Bilgisayar ve Kırtasiye San. Tic. Ltd. ', ' Şti.',
    'ORG:Ege\\, Kırtasiye\\; Ofis;Satış', 'TEL:05345556677', 'END:VCARD',
    // FN yok, yalnız N (ön ek ile)
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Kaya;Ayşe;;Dr.;', 'TEL;TYPE=HOME:0216 444 33 22', 'END:VCARD',
  ].join('\r\n');

  const k = rehberOku(vcf);
  console.log('\n★ OKUMA\n');
  t('5 kişi (telefonsuz "Annem" atlandı)', k.length === 5 && !k.some((x) => x.ad === 'Annem'), k.map((x) => x.ad));
  const [iphone, android, v4, ege, kaya] = k;
  t('★ iPhone: ad, firma; cep numarası önce', iphone.ad === 'Çağrı Öztürk' && iphone.firma === 'Yıldız Muhasebe Ltd. Şti.' && ayni(iphone.telefonlar, ['+90 532 111 22 33', '0212 555 44 33']), iphone);
  t('★ Android: QUOTED-PRINTABLE Türkçe harf + yumuşak satır sonu', android.ad === 'Mehmet Şahin İstanbul' && android.telefonlar[0] === '0533 222 33 44', android);
  t('vCard 4.0: "tel:" öneki atıldı', v4.ad === 'Deniz Hukuk Bürosu' && v4.telefonlar[0] === '+90-534-333-44-55', v4);
  t('katlanmış satır birleşti', ege.ad === 'Ege Bilgisayar ve Kırtasiye San. Tic. Ltd. Şti.', ege.ad);
  t('kaçışlı virgül ve noktalı virgül çözüldü, ORG ilk bileşen', ege.firma === 'Ege, Kırtasiye; Ofis', ege.firma);
  t('FN yoksa N\'den ad (ön ek dahil)', kaya.ad === 'Dr. Ayşe Kaya', kaya.ad);
  t('LF satır sonu da okunur', rehberOku(vcf.replace(/\r\n/g, '\n')).length === 5);
  t('vCard olmayan metin boş liste', rehberOku('merhaba\ndünya').length === 0);

  console.log('\n★ MÜŞTERİ ADI\n');
  t('firma varsa müşteri firma, kişi yetkili', ayni(musteriAdi(iphone), { ad: 'Yıldız Muhasebe Ltd. Şti.', yetkili: 'Çağrı Öztürk' }));
  t('firma yoksa kişinin adı', ayni(musteriAdi(android), { ad: 'Mehmet Şahin İstanbul', yetkili: null }));
  t('toplu sınır 500 (sunucu ile aynı)', TOPLU_AZAMI === 500 && /import \{ TOPLU_AZAMI \} from '@\/lib\/rehber-oku'/.test(oku('src/lib/musteri-ekle.ts')));

  console.log('\n★ UÇ VE EKRAN (kaynak)\n');
  const uc = oku('src/app/api/customers/toplu/route.ts');
  t('★ teknisyen toplu müşteri ekleyemez (yönetici ve ön büro)', /me\.role !== 'ADMIN' && me\.role !== 'FRONT_DESK'/.test(uc));
  t('uç 500 sınırını uygular, ortak kuralı çağırır', /kisiler\.length > TOPLU_AZAMI/.test(uc) && /musterileriEkle\(/.test(uc));
  t('denetime kişi verisi değil yalnız sayılar yazılır', /newValue: sonuc/.test(uc));
  const ekran = oku('src/components/RehberdenEkle.tsx');
  t('★ dosyadan gelen kişiler işaretsiz başlar (rehberde akraba/arkadaş var)', /kur\(kisiler, false\)/.test(ekran) && /kur\(kisiler, true\)/.test(ekran));
  t('rehber seçici yalnız destekleyen tarayıcıda görünür', /'contacts' in navigator && 'ContactsManager' in window/.test(ekran));
  t('yalnız işaretli ve kayıtlı olmayanlar gönderilir', /s\.secili && !varMi\(s\)/.test(ekran));
  t('müşteri listesi boşken rehber kapısı var', /href="\/customers\/rehber"/.test(oku('src/components/MusteriBaslangic.tsx')));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
} finally {
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
