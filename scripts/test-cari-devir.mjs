// CARİ DEVİR — açılış bakiyesi ve geçmiş faturalar
// Çalıştır:  node scripts/test-cari-devir.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Bu aracın yapabileceği hataların hepsi PARA hatası ve hepsi sessiz:
//
//   1. BORCU İKİYE KATLAMAK. Açılış bakiyesi ve geçmiş fatura AYNI borcu
//      anlatıyor. İkisi de yüklenirse müşteri iki kat borçlu görünür; bayi
//      müşterisini arar, rezil olur, "program yanlış hesaplıyor" der.
//   2. AYNI DOSYAYI İKİ KEZ YÜKLEMEK. Bayi "oldu mu acaba" deyip tekrar
//      basar. Borç ikiye katlanmamalı.
//   3. GELİR UYDURMAK. Devir bir satış değil, devreden bakiye. Gelir
//      yazılırsa göç ayının cirosu şişer ve bayi vergisini yanlış hesaplar.
//   4. GEÇMİŞ FATURAYI TEKRAR GÖNDERMEK. Eski sistemde zaten kesildi;
//      e-Fatura ekranında "gönderilecek" diye çıkarsa müşteriye ikinci kez
//      fatura gider.
//   5. YANLIŞ MÜŞTERİYE BORÇ YAZMAK. Aynı adda iki müşteri varsa tahmin
//      edilmemeli.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try { await fetch(`${KOK}/api/rozetler`); } catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect(); process.exit(0);
}

const SLUG = 'test-cari-devir';

async function giris(eposta) {
  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: eposta, password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (y.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  return cs.join('; ');
}

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG,
      users: {
        create: [
          { email: 'devir@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'devir-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });

  const musteriKur = (ad, tel) => p.customer.create({ data: { tenantId: tenant.id, name: ad, phone: tel } });
  const borclu = await musteriKur('Çetin Kırtasiye', '5551110001');
  const alacakli = await musteriKur('Peşinci Ofis', '5551110002');
  const faturali = await musteriKur('Yıldız Müşavirlik', '5551110003');
  // Aynı adda iki müşteri — tahmin edilmemeli.
  await musteriKur('İkiz Firma', '5551110004');
  await musteriKur('İkiz Firma', '5551110005');

  const cerez = await giris('devir@test.local');
  const cerezTek = await giris('devir-tek@test.local');

  const gonder = (csv, tur, dryRun, ek = {}, ck = cerez) => fetch(`${KOK}/api/import/devir`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ck },
    body: JSON.stringify({ csv, tur, dryRun, ...ek }),
  });
  const bakiyeAl = async (id) => {
    const e = await p.accountEntry.groupBy({ by: ['type'], where: { tenantId: tenant.id, customerId: id }, _sum: { amount: true } });
    const f = await p.customerInvoice.findMany({
      where: { tenantId: tenant.id, customerId: id, deletedAt: null, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] } },
      select: { totalAmount: true, paidAmount: true },
    });
    const servis = e.reduce((s, g) => s + (g.type === 'SALE' ? 1 : -1) * Number(g._sum.amount ?? 0), 0);
    const fat = f.reduce((s, x) => s + Number(x.totalAmount) - Number(x.paidAmount), 0);
    return Math.round((servis + fat) * 100) / 100;
  };

  console.log('\nYETKİ\n');
  {
    const y = await gonder('Müşteri;Bakiye\nÇetin Kırtasiye;100', 'bakiye', true, {}, cerezTek);
    t('teknisyen devir aktaramıyor', y.status === 403, y.status);
    const y2 = await fetch(`${KOK}/api/import/devir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'x', tur: 'bakiye', dryRun: true }),
    });
    t('girişsiz reddediliyor', y2.status === 401 || y2.status === 403, y2.status);
    const y3 = await gonder('Müşteri;Bakiye\nA;1', 'baska', true);
    t('bilinmeyen tür reddediliyor', y3.status === 400, y3.status);
  }

  console.log('\nÖNİZLEME HİÇBİR ŞEY YAZMIYOR\n');
  {
    const csv = 'MÜŞTERİ;BAKİYE\nÇetin Kırtasiye;5.000,00';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('önizleme 1 satır buluyor', d.yazilacak === 1, d);
    t('★ büyük harfli Türkçe başlık okunuyor (BAKİYE)', d.yazilacak === 1 && d.borcToplam === 5000, d);
    t('veritabanına hiçbir şey yazılmadı', (await bakiyeAl(borclu.id)) === 0);
    t('gelir yazmayacağı önizlemede söyleniyor', /GELİR YAZMAZ/.test(d.not || ''), d.not);
  }

  console.log('\n★ AÇILIŞ BAKİYESİ — BORÇ DOĞRU, GELİR YOK\n');
  {
    const csv = [
      'Müşteri;Telefon;Bakiye',
      'Çetin Kırtasiye;5551110001;5.000,00',
      'Peşinci Ofis;5551110002;-1.250,50',
    ].join('\n');
    const y = await gonder(csv, 'bakiye', false, { tarih: '01.09.2026' });
    const d = await y.json();
    t('aktarım tamamlandı', y.ok && d.yazilan === 2, d);
    t('borçlu müşterinin bakiyesi 5.000', (await bakiyeAl(borclu.id)) === 5000, await bakiyeAl(borclu.id));
    t('★ eksi bakiye ALACAK olarak yazıldı (-1.250,50)', (await bakiyeAl(alacakli.id)) === -1250.5, await bakiyeAl(alacakli.id));

    const kayitlar = await p.accountEntry.findMany({
      where: { tenantId: tenant.id }, select: { type: true, amount: true, importKey: true, date: true, product: true },
    });
    t('eksi bakiye SALE değil PAYMENT', kayitlar.find((k) => Number(k.amount) === 1250.5)?.type === 'PAYMENT', kayitlar);
    // YEREL tarihle karşılaştır: 01.09.2026 00:00 (UTC+3) ISO'da
    // 2026-08-31T21:00Z görünür — ilk yazdığımda bunu kaçırdım ve test
    // ürün doğruyken kırmızı verdi.
    const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    t('devir tarihi kullanıldı', kayitlar.every((k) => yerel(k.date) === '2026-09-01'), kayitlar.map((k) => yerel(k.date)));
    t('kayıt göç işaretli', kayitlar.every((k) => (k.importKey || '').startsWith('acilis:')), kayitlar.map((k) => k.importKey));

    const gelir = await p.financialTransaction.count({ where: { tenantId: tenant.id } });
    t('★ HİÇ GELİR YAZILMADI (devir satış değil)', gelir === 0, gelir);
  }

  console.log('\n★ AYNI DOSYAYI İKİ KEZ YÜKLEMEK BORCU KATLAMIYOR\n');
  {
    const csv = 'Müşteri;Telefon;Bakiye\nÇetin Kırtasiye;5551110001;5.000,00';
    await gonder(csv, 'bakiye', false, { tarih: '01.09.2026' });
    t('★ bakiye hâlâ 5.000 (10.000 DEĞİL)', (await bakiyeAl(borclu.id)) === 5000, await bakiyeAl(borclu.id));
    const adet = await p.accountEntry.count({ where: { tenantId: tenant.id, customerId: borclu.id } });
    t('tek kayıt var, ikincisi eklenmedi', adet === 1, adet);
  }
  {
    // Rakam düzeltilirse GÜNCELLENMELİ, ikinci kayıt açılmamalı.
    const csv = 'Müşteri;Telefon;Bakiye\nÇetin Kırtasiye;5551110001;4.200,00';
    await gonder(csv, 'bakiye', false, { tarih: '01.09.2026' });
    t('düzeltilen bakiye güncelleniyor', (await bakiyeAl(borclu.id)) === 4200, await bakiyeAl(borclu.id));
    t('yine tek kayıt', (await p.accountEntry.count({ where: { tenantId: tenant.id, customerId: borclu.id } })) === 1);
  }

  console.log('\nGEÇMİŞ FATURALAR\n');
  {
    const csv = [
      'Cari;Telefon;Fatura No;Tarih;Tutar;Ödenen',
      'Yıldız Müşavirlik;5551110003;ESKI-2026-001;15.07.2026;3.000,00;3.000,00',
      'Yıldız Müşavirlik;5551110003;ESKI-2026-002;15.08.2026;2.500,00;1.000,00',
      // Bilerek GEÇMİŞ bir tarih: gelecek tarihli fatura zaten reddediliyor
      // (ayrı testi var), burada test edilen şey açık borcun doğru toplanması.
      'Yıldız Müşavirlik;5551110003;ESKI-2026-003;05.09.2026;1.800,00;0',
    ].join('\n');
    const y = await gonder(csv, 'fatura', false);
    const d = await y.json();
    t('üç fatura yazıldı', y.ok && d.yazilan === 3, d);
    // Açık borç: 0 + 1.500 + 1.800 = 3.300
    t('★ açık borç 3.300 (ödenmiş fatura borç üretmiyor)', (await bakiyeAl(faturali.id)) === 3300, await bakiyeAl(faturali.id));

    const fatura = await p.customerInvoice.findMany({
      where: { tenantId: tenant.id, customerId: faturali.id },
      orderBy: { invoiceNumber: 'asc' },
      select: { invoiceNumber: true, status: true, totalAmount: true, paidAmount: true, eBelgeDurum: true, period: true, vatAmount: true, subtotal: true },
    });
    t('durumlar doğru (PAID/PARTIAL/OPEN)', fatura.map((f) => f.status).join(',') === 'PAID,PARTIAL,OPEN', fatura.map((f) => f.status));
    t('dönem tarihten türetildi', fatura.map((f) => f.period).join(',') === '2026-07,2026-08,2026-09', fatura.map((f) => f.period));
    t('★ eski sistemde kesildi diye işaretli', fatura.every((f) => f.eBelgeDurum === 'ESKI_SISTEM'), fatura.map((f) => f.eBelgeDurum));
    // KDV ayrımı eski sistemde kaldı — UYDURULMUYOR.
    t('KDV uydurulmadı (matrah = toplam, KDV 0)',
      fatura.every((f) => Number(f.vatAmount) === 0 && Number(f.subtotal) === Number(f.totalAmount)), fatura[0]);

    const gelir = await p.financialTransaction.count({ where: { tenantId: tenant.id } });
    t('★ geçmiş fatura da gelir yazmadı', gelir === 0, gelir);
  }

  console.log('\n★ GEÇMİŞ FATURA TEKRAR GÖNDERİLMEYECEK\n');
  {
    const y = await fetch(`${KOK}/api/invoices/e-belge`, { headers: { cookie: cerez } });
    const d = await y.json();
    t('e-Fatura ekranı 200 dönüyor', y.ok, y.status);
    t('★ eski sistem faturaları gönderilecekler listesinde YOK', d.toplam === 0, { toplam: d.toplam, faturalar: d.faturalar?.map((f) => f.invoiceNumber) });
  }

  console.log('\n★ ÇİFT BORÇ KORUMASI\n');
  {
    // Faturası olan müşteriye bir de açılış bakiyesi → borç ikiye katlanırdı.
    const csv = 'Müşteri;Telefon;Bakiye\nYıldız Müşavirlik;5551110003;3.300,00';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('★ açık devir faturası olan müşteriye bakiye yazılmıyor', d.yazilacak === 0 && d.hatali === 1, d);
    t('sebebi açıkça yazıyor', /ikiye katlan/.test((d.hatalar || [])[0]?.hata || ''), (d.hatalar || [])[0]);
    t('borç değişmedi', (await bakiyeAl(faturali.id)) === 3300);
  }
  {
    // Açılış bakiyesi olan müşteriye bir de açık fatura → aynı tuzak.
    const csv = 'Müşteri;Telefon;Fatura No;Tarih;Tutar;Ödenen\nÇetin Kırtasiye;5551110001;ESKI-2026-009;15.08.2026;1.000,00;0';
    const d = await (await gonder(csv, 'fatura', true)).json();
    t('★ açılış bakiyesi olan müşteriye açık fatura yazılmıyor', d.yazilacak === 0 && d.hatali === 1, d);
    t('sebebi açıkça yazıyor', /ikiye katlan/.test((d.hatalar || [])[0]?.hata || ''), (d.hatalar || [])[0]);
  }
  {
    // TAMAMEN ÖDENMİŞ geçmiş fatura borç üretmiyor → çakışma SAYILMAMALI.
    const csv = 'Müşteri;Telefon;Fatura No;Tarih;Tutar;Ödenen\nÇetin Kırtasiye;5551110001;ESKI-2026-010;15.06.2026;900,00;900,00';
    const d = await (await gonder(csv, 'fatura', true)).json();
    t('★ ödenmiş geçmiş fatura çakışma sayılmıyor (kayıt olarak girebilir)', d.yazilacak === 1, d);
  }

  console.log('\n★ YANLIŞ MÜŞTERİYE BORÇ YAZILMIYOR\n');
  {
    const csv = 'Müşteri;Bakiye\nİkiz Firma;1.000,00';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('★ aynı adda iki müşteri varsa tahmin edilmiyor', d.yazilacak === 0 && d.hatali === 1, d);
    t('telefon istenmesi söyleniyor', /telefon/i.test((d.hatalar || [])[0]?.hata || ''), (d.hatalar || [])[0]);
  }
  {
    const csv = 'Müşteri;Bakiye\nOlmayan Firma;1.000,00';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('bulunamayan müşteri bildiriliyor', d.yazilacak === 0 && (d.eslesmeyenMusteri || []).includes('Olmayan Firma'), d);
  }
  {
    // Telefon varsa ad farklı yazılsa bile doğru müşteriye gider.
    const csv = 'Müşteri;Telefon;Bakiye\nCETIN KIRTASIYE LTD;5551110001;4.200,00';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('telefon eşleşmesi addan önce geliyor', d.yazilacak === 1, d);
  }

  console.log('\nBOZUK SATIRLAR\n');
  {
    const csv = [
      'Müşteri;Telefon;Fatura No;Tarih;Tutar;Ödenen',
      'Yıldız Müşavirlik;5551110003;;15.08.2026;100;0',
      'Yıldız Müşavirlik;5551110003;X-1;;100;0',
      'Yıldız Müşavirlik;5551110003;X-2;15.08.2026;abc;0',
      'Yıldız Müşavirlik;5551110003;X-3;15.08.2026;100;150',
      'Yıldız Müşavirlik;5551110003;X-4;01.01.2099;100;0',
      'Yıldız Müşavirlik;5551110003;ESKI-2026-001;15.08.2026;100;100',
    ].join('\n');
    const d = await (await gonder(csv, 'fatura', true)).json();
    t('fatura no / tarih / tutar / fazla ödeme / gelecek tarih ayıklanıyor', d.hatali === 6, d);
    t('var olan fatura numarası tekrar yazılmıyor',
      (d.hatalar || []).some((h) => /zaten var/.test(h.hata)), d.hatalar);
  }
  {
    const y = await gonder('Marka;Model\nKyocera;M2540', 'bakiye', true);
    const d = await y.json();
    t('yanlış dosya yüklenirse ne gerektiği söyleniyor', y.status === 400 && /Bakiye/.test(d.error || ''), d);
  }
  {
    const csv = 'Müşteri;Telefon;Bakiye\nÇetin Kırtasiye;5551110001;100\nÇetin Kırtasiye;5551110001;200';
    const d = await (await gonder(csv, 'bakiye', true)).json();
    t('aynı müşteri dosyada iki kez — ikincisi eleniyor', d.yazilacak === 1 && d.hatali === 1, d);
  }
  {
    const y = await gonder('Müşteri;Bakiye\nÇetin Kırtasiye;100', 'bakiye', true, { tarih: '01.01.2099' });
    t('gelecek devir tarihi reddediliyor', y.status === 400, y.status);
  }

  console.log('\nMUHASEBE EKRANIYLA AYNI RAKAM\n');
  {
    const y = await fetch(`${KOK}/api/disa-aktar?tur=cari`, { headers: { cookie: cerez } });
    const metin = Buffer.from(await y.arrayBuffer()).toString('utf8');
    const satir = metin.split('\r\n').find((x) => x.includes('Çetin Kırtasiye'));
    const a = satir.split(';');
    t('★ devir bakiyesi cari dosyasında görünüyor', a[6] === '4200,00', a);
    const y2 = metin.split('\r\n').find((x) => x.includes('Yıldız'));
    t('★ geçmiş faturaların açık borcu da görünüyor', y2.split(';')[6] === '3300,00', y2);
  }
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
