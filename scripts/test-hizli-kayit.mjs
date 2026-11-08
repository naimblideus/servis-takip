// HIZLI KAYIT — kaydı olmayan bayinin ilk çağrısı
// Çalıştır:  node scripts/test-hizli-kayit.mjs   (yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Hiç kaydı olmayan bayide ilk haftaların her çağrısı "yeni müşteri", cihaz
// da çoğu zaman bilinmiyor. Eskiden fiş ekranında yeni müşteri ekleme yoktu
// ve hızlı cihaz eklemede seri no zorunluydu: tezgah fişi açamıyordu. Burada
// kilitli olanlar:
//   · müşteri telefonu aktarımla aynı biçimde saklanır, aynı numara ikinci
//     müşteri açmaz (mevcut müşteri döner), başka bayinin müşterisi görünmez;
//   · rehberden toplu eklemede kayıtlı numara atlanır, 500 sınırı uygulanır;
//   · seri no'su bilinmeyen cihaz geçici kimlik (GEC-…) alır, "seri bekliyor"
//     sayılır; Excel'in seri no'suz satırı (IMP-…) da öyle;
//   · uçlar: cihaz ucu boş seriye geçici kimlik verir ve seri çakışmasında
//     kodlu hata döner; fiş ekranında yeni müşteri satırı var, cihaz alanları
//     zorunlu değil.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

const { ice, temizle } = derle({ girisler: ['src/lib/musteri-ekle.ts', 'src/lib/gecici-kimlik.ts'], onEk: 'st-hizli-' });
const me = await ice('lib/musteri-ekle');
const gk = await ice('lib/gecici-kimlik');
const p = new PrismaClient();
const SLUG = `test-hizli-${Date.now().toString(36)}`;
const kiracilar = [];

try {
  console.log('\n★ GEÇİCİ SERİ\n');
  const s1 = gk.geciciSeri(), s2 = gk.geciciSeri();
  t('geçici seri GEC- ile başlar, 12 karakter', /^GEC-[A-Z2-9]{8}$/.test(s1), s1);
  t('iki geçici seri farklı', s1 !== s2);
  t('karışan karakter yok (0, O, 1, I)', !/[01OI]/.test(s1.slice(4)));
  t('GEC- seri bekliyor', gk.seriBekliyor(s1));
  t('IMP- (Excel seri no\'suz satır) seri bekliyor', gk.seriBekliyor('IMP-ABC123'));
  t('boş seri bekliyor', gk.seriBekliyor('') && gk.seriBekliyor(null));
  t('gerçek seri beklemiyor', !gk.seriBekliyor('W5X123456'));
  t('"Bilinmiyor" model tanımlanmalı', gk.cihazTanimlanmali({ serialNo: 'W5X1', brand: 'Canon', model: 'Bilinmiyor' }));
  t('tam bilgili cihaz tanımlanmış', !gk.cihazTanimlanmali({ serialNo: 'W5X1', brand: 'Canon', model: 'iR 2425' }));

  console.log('\n★ TELEFON BİÇİMİ\n');
  t('"0532 111 22 33" → 5321112233', me.musteriTelefonu('0532 111 22 33') === '5321112233');
  t('"+90 532 111 22 33" → 5321112233', me.musteriTelefonu('+90 532 111 22 33') === '5321112233');
  t('çok kısa numara geçersiz', me.musteriTelefonu('12345') === '');
  t('harf geçersiz', me.musteriTelefonu('yok') === '');

  const bayi = await p.tenant.create({ data: { name: 'Hızlı Kayıt Fotokopi', slug: SLUG } });
  const komsu = await p.tenant.create({ data: { name: 'Komşu Bayi', slug: `${SLUG}-k` } });
  kiracilar.push(bayi.id, komsu.id);

  console.log('\n★ TEK MÜŞTERİ\n');
  const a = await me.musteriEkle(bayi.id, { ad: '  Aydın Kırtasiye ', telefon: '0532 111 22 33' });
  t('yeni müşteri açılır', a.durum === 'YENI', a);
  t('ad kırpılır, telefon aktarım biçiminde', a.musteri?.name === 'Aydın Kırtasiye' && a.musteri?.phone === '5321112233', a.musteri);
  const b = await me.musteriEkle(bayi.id, { ad: 'Başka Ad', telefon: '+90 (532) 111-22-33' });
  t('★ aynı numara başka biçimde: yeni kayıt yok, mevcut döner', b.durum === 'VAR' && b.musteri?.id === a.musteri?.id, b);
  await p.customer.create({ data: { tenantId: bayi.id, name: 'Eski Kayıt', phone: '0216 555 44 33' } });
  const c = await me.musteriEkle(bayi.id, { ad: 'Eski Kayıt 2', telefon: '0216 555 44 33' });
  t('ham biçimde saklı eski kayıt da bulunur', c.durum === 'VAR' && c.musteri?.name === 'Eski Kayıt', c);
  const k = await me.musteriEkle(komsu.id, { ad: 'Komşunun Müşterisi', telefon: '0532 111 22 33' });
  t('★ başka bayide aynı numara ayrı müşteri (sızma yok)', k.durum === 'YENI' && k.musteri?.id !== a.musteri?.id, k);
  t('ad boşsa hata kodu', (await me.musteriEkle(bayi.id, { ad: '  ', telefon: '05321112244' })).kod === 'MUSTERI_ADI_GEREKLI');
  t('telefon geçersizse hata kodu', (await me.musteriEkle(bayi.id, { ad: 'X', telefon: '12' })).kod === 'GECERSIZ_TELEFON_NUMARASI');
  const e = await me.musteriEkle(bayi.id, { ad: 'E-postalı', telefon: '05321112255', eposta: ' Muhasebe@Ornek.COM ' });
  const eKayit = await p.customer.findUnique({ where: { id: e.musteri.id }, select: { email: true } });
  t('e-posta küçük harfle yazılır', eKayit?.email === 'muhasebe@ornek.com', eKayit);

  console.log('\n★ REHBERDEN TOPLU\n');
  const r = await me.musterileriEkle(bayi.id, [
    { ad: 'Çağrı Öztürk', telefon: '0533 222 33 44' },
    { ad: 'Çağrı Öztürk (iş)', telefon: '+905332223344' }, // aynı numara listede iki kez
    { ad: 'Aydın tekrar', telefon: '05321112233' },        // kayıtlı
    { ad: 'Numarasız', telefon: '' },
    { ad: '', telefon: '05334445566' },
    { ad: 'Selin Ak', telefon: '0212 444 55 66' },
  ]);
  // Listede iki kez geçen numara tek kişidir: bir kez eklenir, "zaten var" sayılmaz.
  t('★ 2 yeni, 1 zaten kayıtlı, 2 geçersiz; listedeki tekrar birleşir', r.eklenen === 2 && r.zatenVar === 1 && r.gecersiz === 2, r);
  // Excel'den telefonsuz gelmiş müşteri: rehberde aynı ad varsa telefon tamamlanır, ikinci müşteri açılmaz.
  const yer = await p.customer.create({ data: { tenantId: bayi.id, name: 'Deniz Hukuk Bürosu', phone: 'BOS-1A2B3C4D' } });
  const rt = await me.musterileriEkle(bayi.id, [{ ad: 'deniz hukuk bürosu', telefon: '0538 111 00 99', yetkili: 'Av. Deniz' }]);
  const yer2 = await p.customer.findUnique({ where: { id: yer.id }, select: { phone: true, contactPerson: true } });
  t('★ telefonsuz (BOS-) müşterinin telefonu rehberden tamamlanır, yeni müşteri yok',
    rt.eklenen === 0 && rt.telefonuTamamlanan === 1 && yer2?.phone === '5381110099' && yer2?.contactPerson === 'Av. Deniz', { rt, yer2 });
  const ry = await me.musterileriEkle(bayi.id, [{ ad: 'Yıldız Muhasebe', telefon: '05337778899', yetkili: 'Ayşe Kaya' }]);
  const yk = await p.customer.findFirst({ where: { tenantId: bayi.id, phone: '5337778899' }, select: { name: true, contactPerson: true } });
  t('rehberdeki firma müşteri, kişi yetkili olarak yazılır', ry.eklenen === 1 && yk?.name === 'Yıldız Muhasebe' && yk?.contactPerson === 'Ayşe Kaya', yk);
  const r2 = await me.musterileriEkle(bayi.id, [{ ad: 'Çağrı Öztürk', telefon: '05332223344' }]);
  t('aynı liste ikinci kez: hiçbiri eklenmez', r2.eklenen === 0 && r2.zatenVar === 1, r2);
  const cok = Array.from({ length: me.TOPLU_AZAMI + 20 }, (_, i) => ({ ad: `Kişi ${i}`, telefon: `0544${String(1000000 + i)}` }));
  const r3 = await me.musterileriEkle(bayi.id, cok);
  t(`en çok ${me.TOPLU_AZAMI} kişi işlenir`, r3.eklenen + r3.zatenVar + r3.gecersiz === me.TOPLU_AZAMI, r3);
  const komsuSayi = await p.customer.count({ where: { tenantId: komsu.id } });
  t('toplu ekleme başka bayiye yazmaz', komsuSayi === 1, komsuSayi);

  console.log('\n★ UÇLAR VE EKRAN (kaynak)\n');
  const cihazUcu = oku('src/app/api/devices/route.ts');
  t('cihaz ucu boş seriye geçici kimlik verir', /seri \|\| geciciSeri\(\)/.test(cihazUcu));
  t('cihaz ucu boş marka/modele "Bilinmiyor" yazar', /nz\.brand \|\| BILINMIYOR/.test(cihazUcu) && /nz\.model \|\| BILINMIYOR/.test(cihazUcu));
  t('cihaz ucu seri çakışmasında SERI_KAYITLI döner', /'BARKOD_KAYITLI' : 'SERI_KAYITLI', 409\)/.test(cihazUcu));
  const musteriUcu = oku('src/app/api/customers/route.ts');
  t('müşteri ucu ortak kuralı kullanır, kayıtlıda 409 + mevcut müşteri', /musteriEkle\(/.test(musteriUcu) && /MUSTERI_TELEFON_KAYITLI', 409, \{ ek: \{ musteri/.test(musteriUcu));
  const fis = oku('src/app/(dashboard)/tickets/new/page.tsx');
  t('fiş ekranında "＋ Yeni müşteri" satırı var', /sz\.fisYeni\.yeniMusteri/.test(fis) && /yeniMusteriKaydet/.test(fis));
  const modal = fis.slice(fis.indexOf('function QuickAddDeviceModal'), fis.indexOf('// ─── Ana Sayfa'));
  t('★ hızlı cihazda marka, model, seri zorunlu değil', !/<input required/.test(modal), modal.match(/<input required[^>]*/g));
  t('yeni müşteri kutusunda Enter fişi göndermez', /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); yeniMusteriKaydet\(\); \}/.test(fis));
  console.log('\n★ CİHAZI SAHADA TANIMLA (kaynak)\n');
  const kart = oku('src/components/CihazTanimla.tsx');
  t('★ "Kiralık mı" yalnız değişirse gönderilir (Excel\'den gelen kira silinmez)', /if \(kiralik !== cihaz\.isRental\) govde\.isRental = kiralik;/.test(kart));
  t('kamerayla seri okutma var, boş seri gönderilmez', /<CameraScanner onDetect=/.test(kart) && /if \(seri\.trim\(\)\) govde\.serialNo/.test(kart));
  const fisDetay = oku('src/app/(dashboard)/tickets/[id]/page.tsx');
  const cihazDetay = oku('src/app/(dashboard)/devices/[id]/page.tsx');
  t('fiş detayında ve cihaz kartında, yalnız tanımlanması gereken cihazda görünür',
    /cihazTanimlanmali\(ticket\.device\) && \(/.test(fisDetay) && /cihazTanimlanmali\(device\) && \(/.test(cihazDetay));
  t('geçici seri ekranda "Seri no bekliyor" yazar', /seriBekliyor\(ticket\.device\.serialNo\) \? sz\.fisYeni\.seriBekliyor/.test(fisDetay));
  t('cihaz güncellemede seri çakışması kodlu hata', /'BARKOD_KAYITLI' : 'SERI_KAYITLI', 409\)/.test(oku('src/app/api/devices/[id]/route.ts')));

  const tr = oku('src/lib/i18n/tr.ts');
  t('ilk adım Excel\'e değil müşterilere gider', /key: 'hasCustomers', icon: '👤', href: '\/customers'/.test(oku('src/components/Onboarding.tsx')));
  t('kurulum CIHAZ adımı müşterilere gider', /CIHAZ: '\/customers'/.test(oku('src/lib/kurulum.ts')));
  t('satış günü mesajı liste şart koşmuyor', /Listeniz yoksa gerek yok/.test(oku('src/lib/kurulum-metin.ts')));
  t('müşteri listesi boşken "nasıl başlanır" gösterilir', /MusteriBaslangic/.test(oku('src/app/(dashboard)/customers/page.tsx')) && /baslangic: \{/.test(tr));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
} finally {
  for (const id of kiracilar) await p.tenant.delete({ where: { id } }).catch(() => {});
  await p.$disconnect();
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
