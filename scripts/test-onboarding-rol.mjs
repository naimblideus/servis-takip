// İLK GİRİŞ — ROL BAZLI ADIMLAR (teknisyen ve ön büro kendi üç işini görür)
// Çalıştır:  node scripts/test-onboarding-rol.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// İlk giriş rehberi herkese aynıydı: teknisyen "müşteri ekle, fatura kes,
// tahsilat al" listesini görüyor, düğmeye basınca menüsünde olmayan, kapalı
// sayfaya düşüyordu. Kilitli olanlar:
//   · her roldeki her adres o role AÇIK (menu-aileleri → hrefErisilir);
//   · teknisyen listesinde fatura, aktarma, muhasebe adımı yok;
//   · hangi ekranın hangi adımı tamamladığı (en uzun eşleşme kazanır);
//   · yönetici bugünkü listede kalır (ekipRolu null);
//   · iki dilde de her adımın başlığı, açıklaması, düğmesi ve anlatımı var.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, temizle } = derle({
  girisler: ['src/lib/rehber-rol.ts', 'src/lib/menu-aileleri.ts', 'src/lib/modules.ts', 'src/lib/i18n/tr.ts', 'src/lib/i18n/en.ts'],
  onEk: 'st-onboarding-rol-',
});
const rr = await ice('lib/rehber-rol');
const menu = await ice('lib/menu-aileleri');
const mod = await ice('lib/modules');
const { tr } = await ice('lib/i18n/tr');
const { en } = await ice('lib/i18n/en');

console.log('\n★ HER ADRES O ROLE AÇIK\n');
for (const rol of ['TECHNICIAN', 'FRONT_DESK']) {
  // Paket kapısı ayrı konu: bütün modüller açık bir bayi düşünülüyor.
  const erisim = { rol, ulke: 'TR', moduller: mod.ALL_MODULE_KEYS, whatsappKurulu: false, tur: 'BAYI' };
  for (const a of rr.ROL_ADIMLARI[rol]) {
    if (!a.href) { t(`${rol} · ${a.key}: eylem adımı (ekran değil)`, a.key === 'telefon'); continue; }
    t(`★ ${rol} · ${a.key} → ${a.href} açık`, menu.hrefErisilir(a.href, erisim));
  }
}
{
  const teknisyen = rr.ROL_ADIMLARI.TECHNICIAN.map((a) => a.href).filter(Boolean);
  const yasak = ['/invoices', '/import', '/accounting', '/customers/new', '/collections'];
  t('★ teknisyende fatura, aktarma, muhasebe adımı yok', !teknisyen.some((h) => yasak.some((y) => h === y || h.startsWith(`${y}/`))), teknisyen);
  const adminErisim = { rol: 'TECHNICIAN', ulke: 'TR', moduller: mod.ALL_MODULE_KEYS, whatsappKurulu: false, tur: 'BAYI' };
  t('karşılaştırma: sahibin "Excel aktar" adresi teknisyene kapalı (eski hata buydu)', !menu.hrefErisilir('/import', adminErisim));
}

console.log('\nHANGİ EKRAN HANGİ ADIMI TAMAMLAR\n');
{
  const y = rr.yolunAdimi;
  t('teknisyen /tickets → islerim', y('TECHNICIAN', '/tickets') === 'islerim');
  t('teknisyen /tickets/abc (fiş ayrıntısı) → islerim', y('TECHNICIAN', '/tickets/abc') === 'islerim');
  t('teknisyen /sayac-turu → sayac', y('TECHNICIAN', '/sayac-turu') === 'sayac');
  t('teknisyen /ticketsx başka ekran sayılmaz', y('TECHNICIAN', '/ticketsx') === null);
  t('★ ön büro /tickets/new → fis (en uzun eşleşme)', y('FRONT_DESK', '/tickets/new') === 'fis');
  t('ön büro /tickets → takip', y('FRONT_DESK', '/tickets') === 'takip');
  t('ön büro /customers/42 → musteri', y('FRONT_DESK', '/customers/42') === 'musteri');
  const set = new Set(['islerim']);
  const tel = rr.ROL_ADIMLARI.TECHNICIAN.find((a) => a.key === 'telefon');
  const isl = rr.ROL_ADIMLARI.TECHNICIAN.find((a) => a.key === 'islerim');
  t('telefon adımı uygulama kuruluysa tamam', rr.adimTamam(tel, set, true) && !rr.adimTamam(tel, set, false));
  t('ekran adımı açılınca tamam', rr.adimTamam(isl, set, false) && !rr.adimTamam(isl, new Set(), true));
  t('kayıt kişiye özel anahtarla', rr.ekipAdimAnahtari('u1') !== rr.ekipAdimAnahtari('u2'));
}

console.log('\nROL\n');
t('yönetici bugünkü listede kalır', rr.ekipRolu('ADMIN') === null && rr.ekipRolu('SUPER_ADMIN') === null);
t('teknisyen ve ön büro ekip rolü', rr.ekipRolu('TECHNICIAN') === 'TECHNICIAN' && rr.ekipRolu('FRONT_DESK') === 'FRONT_DESK');
t('bilinmeyen rol null', rr.ekipRolu('x') === null && rr.ekipRolu(undefined) === null);

console.log('\n★ İKİ DİLDE METİNLER\n');
for (const [dil, s] of [['tr', tr], ['en', en]]) {
  const e = s.rehber.ekip;
  for (const rol of ['TECHNICIAN', 'FRONT_DESK']) {
    const r = e?.[rol];
    t(`${dil} · ${rol}: giriş ve başlat düğmesi`, Boolean(e?.baslik && r?.giris && r?.baslat));
    for (const a of rr.ROL_ADIMLARI[rol]) {
      const m = r?.adimlar?.[a.key];
      t(`${dil} · ${rol} · ${a.key}: başlık, açıklama, düğme, anlatım`, Boolean(m?.title && m?.desc && m?.cta && Array.isArray(m?.how) && m.how.length > 0), m);
    }
  }
}

console.log('\nBAĞLANTILAR (kaynak denetimi)\n');
{
  const bilesen = readFileSync(join(KOK, 'src/components/Onboarding.tsx'), 'utf8');
  t('rehber rolü durum ucundan okuyor ve rol adımlarını kullanıyor', /ekipRolu\(data\?\.rol\)/.test(bilesen) && /ROL_ADIMLARI\[ekip\]/.test(bilesen));
  t('href yoksa (telefon) düğme nasıl yapılır\'ı açar, kapalı sayfaya gitmez', /c\.href \? go\(c\.href\) : setOpenHow/.test(bilesen));
  const uc = readFileSync(join(KOK, 'src/app/api/onboarding/status/route.ts'), 'utf8');
  t('durum ucu rolü ve kimliği dönüyor', /rol: user\.role/.test(uc) && /userId: user\.id/.test(uc));
}

temizle();
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
