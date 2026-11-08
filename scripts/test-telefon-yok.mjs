// TELEFONU OLMAYAN MÜŞTERİ — "BOS-…" yer tutucusu nereye sızmamalı
// Çalıştır:  node scripts/test-telefon-yok.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Müşteri bayi içinde telefonla tekil ve telefon zorunlu. Telefonu olmayan
// müşteriye (eski programdan SQL aktarımı, artık telefonsuz Excel listesi de)
// "BOS-…" yer tutucusu yazılıyor. Bir bayide 305 müşterinin 124'ünde vardı ve
// ekranlar, faturalar "BOS-000070" basıyordu. Burada kilitli olanlar:
//   · yer tutucu hiçbir mesaj yolunda numara sayılmaz (WhatsApp bağlantısı,
//     WhatsApp API, vade hatırlatması);
//   · müşteri listesi/kartı, fiş, fiş çıktısı, fatura ve makbuz yer tutucuyu
//     basmaz; Ara/WhatsApp düğmeleri çizilmez;
//   · müşteri düzenlemede telefon boş bırakılırsa yer tutucu silinmez.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

const { ice, temizle } = derle({ girisler: ['src/lib/telefon.ts', 'src/lib/share.ts', 'src/lib/kurulum.ts'], onEk: 'st-telyok-' });
try {
  const tel = await ice('lib/telefon');
  const share = await ice('lib/share');
  const kur = await ice('lib/kurulum');

  console.log('\n★ YARDIMCI\n');
  for (const yt of ['BOS-000070', 'BOS-1A2B3C4D', 'bos-00ab12cd', '', null]) {
    t(`"${yt}" telefon sayılmaz`, tel.telefonYok(yt) && tel.telefonGoster(yt) === '' && tel.telefonGoster(yt, '—') === '—');
  }
  t('gerçek numara olduğu gibi gösterilir', !tel.telefonYok('5321112233') && tel.telefonGoster(' 5321112233 ') === '5321112233');

  console.log('\n★ MESAJ YOLLARI\n');
  for (const yt of ['BOS-000070', 'BOS-12345678', 'BOS-99999999']) {
    t(`${yt}: WhatsApp bağlantısı numara üretmez`, share.waPhone(yt) === '' && kur.waAdresi(yt, 'x') === null);
  }
  // WhatsApp API (lib/whatsapp) da yalnız 90 + 10 hane kabul ediyor: 8 karakterlik
  // yer tutucu özeti en çok 8 rakam içerir, 10'a ulaşamaz.
  const wa = oku('src/lib/whatsapp.ts');
  t('WhatsApp API 90 + 10 haneden başkasını reddediyor', /return \/\^90\\d\{10\}\$\/\.test\(d\) \? d : null;/.test(wa));
  t('Excel yer tutucusu 8 karakter (10 haneli numaraya dönüşemez)', /digest\('hex'\)\.slice\(0, 8\)/.test(oku('src/lib/sayfa-ice-aktar.ts')));
  t('★ vade hatırlatması telefonsuz müşteriyi atlar (her gün başarısız kayıt üretmez)', /telefonYok\(f\.customer\?\.phone\)/.test(oku('src/lib/vade-hatirlatma.ts')));

  console.log('\n★ EKRANLAR VE BELGELER (kaynak)\n');
  const yerler = [
    ['müşteri listesi', 'src/app/(dashboard)/customers/page.tsx', /telefonGoster\(c\.phone, '—'\)/],
    ['müşteri kartı', 'src/app/(dashboard)/customers/[id]/page.tsx', /telefonGoster\(customer\.phone, '—'\)/],
    ['fiş açma', 'src/app/(dashboard)/tickets/new/page.tsx', /telefonGoster\(selectedCustomer\.phone, '—'\)/],
    ['fiş detayı', 'src/app/(dashboard)/tickets/[id]/page.tsx', /telefonGoster\(ticket\.device\.customer\.phone, '—'\)/],
    ['fiş çıktısı', 'src/app/(dashboard)/tickets/[id]/print/page.tsx', /telefonGoster\(ticket\.device\.customer\.phone, '—'\)/],
    ['fatura', 'src/components/docs/InvoiceDocument.tsx', /telefonGoster\(c\.phone\) &&/],
    ['makbuz', 'src/components/docs/ReceiptDocument.tsx', /telefonGoster\(c\?\.phone\) &&/],
    ['Ara/WhatsApp düğmeleri', 'src/components/ContactActions.tsx', /const phone = telefonGoster\(hamTelefon\) \|\| null;/],
    ['fiş detayında durum bildirimi', 'src/app/(dashboard)/tickets/[id]/page.tsx', /!telefonYok\(ticket\.device\.customer\.phone\)/],
  ];
  for (const [ad, yol, re] of yerler) t(`${ad} yer tutucuyu basmıyor`, re.test(oku(yol)));
  const panel = oku('src/components/CustomerEditPanel.tsx');
  t('★ düzenlemede boş telefon gönderilmez (yer tutucu silinmez)', /phone: telefonGoster\(customer\.phone\)/.test(panel) && /form\.phone\.trim\(\) \? form : \{ \.\.\.form, phone: undefined \}/.test(panel));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
} finally {
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
