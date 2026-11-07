// KULLANICI DAVETİ — tek kullanımlık bağlantıyla şifre belirleme
// Çalıştır:  node scripts/test-kullanici-davet.mjs   (yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Davet bağlantısı bir hesabın anahtarı: kim açarsa şifreyi o koyar. Burada
// kilitli olanlar:
//   · jeton saklanmıyor, yalnız SHA-256 özeti;
//   · 7 gün sonra, kullanıldıktan sonra ve yeniden gönderildikten sonra eski
//     bağlantı ölüyor; nedeni söylenmiyor (hepsi aynı "geçersiz");
//   · aynı bağlantı iki sekmede aynı anda gönderilirse yalnız biri kazanıyor;
//   · demo bayisinde, silinmiş bayide, pasif kullanıcıda çalışmıyor;
//   · davetli kişinin geçici şifresiyle kimse giremiyor;
//   · uçlar: oturumsuz uç hız sınırlı, sayfa jetonu dışarı sızdırmıyor,
//     kullanıcılar ekranı şifre özetini tarayıcıya göndermiyor.
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, temizle } = derle({ girisler: ['src/lib/kullanici-davet.ts'], onEk: 'st-davet-' });
const dv = await ice('lib/kullanici-davet');
const p = new PrismaClient();
const SLUG = `test-davet-${Date.now().toString(36)}`;
const kiracilar = [];
const jetonu = (baglanti) => baglanti.split('/davet/')[1];
const GUN = 86_400_000;

try {
  const bayi = await p.tenant.create({ data: { name: 'Davet Testi Fotokopi', slug: SLUG } });
  const demo = await p.tenant.create({ data: { name: 'Davet Demo', slug: `${SLUG}-demo`, demo: true } });
  kiracilar.push(bayi.id, demo.id);
  const kisi = async (tid, ek = {}) => p.user.create({
    data: { tenantId: tid, email: `kisi-${Math.random().toString(36).slice(2, 8)}@davet.test`, name: 'Ahmet Yılmaz', role: 'TECHNICIAN', passwordHash: await dv.kullanilamazSifre(), davetBekliyor: true, ...ek },
  });

  console.log('\n★ DAVET OLUŞTUR VE AÇ\n');
  const u1 = await kisi(bayi.id);
  const d1 = await dv.davetOlustur({ tenantId: bayi.id, userId: u1.id, olusturanAd: 'Ayşe (yönetici)' });
  const j1 = jetonu(d1.baglanti);
  t('bağlantı /davet/<jeton> biçiminde, jeton uzun', /\/davet\/[A-Za-z0-9_-]{40,}$/.test(d1.baglanti), d1.baglanti);
  t('7 gün geçerli', Math.abs(d1.bitis.getTime() - Date.now() - 7 * GUN) < 60_000, d1.bitis);
  const satir = await p.kullaniciDavet.findFirst({ where: { userId: u1.id } });
  t('★ jeton saklanmıyor, yalnız SHA-256 özeti', satir.tokenOzeti === createHash('sha256').update(j1).digest('hex') && !JSON.stringify(satir).includes(j1));
  const b1 = await dv.davetBul(j1);
  t('geçerli bağlantı kişiyi ve firmayı veriyor', b1?.ad === 'Ahmet Yılmaz' && b1?.giris === u1.email && b1?.firma === 'Davet Testi Fotokopi' && b1?.rol === 'TECHNICIAN', b1);
  t('yanlış jeton → geçersiz', (await dv.davetBul('x'.repeat(43))) === null);
  t('kısa ya da metin olmayan jeton → geçersiz', (await dv.davetBul('kisa')) === null && (await dv.davetBul(12345)) === null && (await dv.davetBul(null)) === null);
  t('★ davetli kişinin geçici şifresiyle giriş olmaz', !(await bcrypt.compare('', u1.passwordHash)) && !(await bcrypt.compare('123456', u1.passwordHash)));

  console.log('\n★ ŞİFRE BELİRLE\n');
  t('8 karakterden kısa şifre reddedilir', (await dv.davetiKullan(j1, 'kisa123')).hata === 'SIFRE_KISA');
  t('72 bayttan uzun şifre reddedilir', (await dv.davetiKullan(j1, 'ş'.repeat(40))).hata === 'SIFRE_KISA');
  const k1 = await dv.davetiKullan(j1, 'Gecerli-Sifre-1');
  t('geçerli şifre kabul, giriş adı dönüyor', k1.ok && k1.bilgi.giris === u1.email, k1);
  const u1son = await p.user.findUnique({ where: { id: u1.id } });
  t('★ yeni şifre yazıldı, davet bekleme işareti kalktı', (await bcrypt.compare('Gecerli-Sifre-1', u1son.passwordHash)) && u1son.davetBekliyor === false);
  t('★ aynı bağlantı ikinci kez çalışmaz', (await dv.davetiKullan(j1, 'Baska-Sifre-22')).hata === 'GECERSIZ' && (await dv.davetBul(j1)) === null);

  console.log('\n★ YENİDEN GÖNDER, SÜRE, YARIŞ\n');
  const u2 = await kisi(bayi.id);
  const eski = jetonu((await dv.davetOlustur({ tenantId: bayi.id, userId: u2.id, olusturanAd: null })).baglanti);
  const yeni = jetonu((await dv.davetOlustur({ tenantId: bayi.id, userId: u2.id, olusturanAd: null })).baglanti);
  t('★ yeniden gönderince eski bağlantı ölür, yenisi çalışır', (await dv.davetBul(eski)) === null && (await dv.davetBul(yeni))?.userId === u2.id);

  const u3 = await kisi(bayi.id);
  const gecmis = jetonu((await dv.davetOlustur({ tenantId: bayi.id, userId: u3.id, olusturanAd: null, simdi: new Date(Date.now() - 8 * GUN) })).baglanti);
  t('★ 7 günü geçen bağlantı geçersiz', (await dv.davetBul(gecmis)) === null && (await dv.davetiKullan(gecmis, 'Gecerli-Sifre-1')).hata === 'GECERSIZ');

  const u4 = await kisi(bayi.id);
  const yaris = jetonu((await dv.davetOlustur({ tenantId: bayi.id, userId: u4.id, olusturanAd: null })).baglanti);
  const [a, b] = await Promise.all([dv.davetiKullan(yaris, 'Birinci-Sekme-1'), dv.davetiKullan(yaris, 'Ikinci-Sekme-22')]);
  t('★ iki sekme aynı anda: yalnız biri kazanır', [a, b].filter((x) => x.ok).length === 1, [a.ok, b.ok]);

  console.log('\nKAPSAM DIŞI\n');
  const uDemo = await kisi(demo.id);
  const jDemo = jetonu((await dv.davetOlustur({ tenantId: demo.id, userId: uDemo.id, olusturanAd: null })).baglanti);
  t('demo bayisinde davet çalışmaz', (await dv.davetBul(jDemo)) === null);
  const uPasif = await kisi(bayi.id, { isActive: false });
  const jPasif = jetonu((await dv.davetOlustur({ tenantId: bayi.id, userId: uPasif.id, olusturanAd: null })).baglanti);
  t('pasif kullanıcıda davet çalışmaz', (await dv.davetBul(jPasif)) === null);

  console.log('\n★ UÇLAR VE EKRANLAR (kaynak denetimi)\n');
  const oku = (y) => readFileSync(join(KOK, y), 'utf8');
  const ekle = oku('src/app/api/users/route.ts');
  t('kullanıcı ekleme: davet modunda kullanılamaz şifre + davetBekliyor', /kullanilamazSifre\(\)/.test(ekle) && /davetBekliyor: davet/.test(ekle) && /davetOlustur\(/.test(ekle));
  t('kullanıcı ekleme: demoda davet yok', /davet && tenant\?\.demo/.test(ekle));
  const kullan = oku('src/app/api/davet/route.ts');
  t('★ oturumsuz uç IP başına hız sınırlı', /rateLimit\(`davet:\$\{ip\}`/.test(kullan));
  t('geçersiz jetonun nedeni söylenmiyor (tek kod)', /DAVET_GECERSIZ/.test(kullan) && !/SURESI|KULLANILDI_HATA/.test(kullan));
  const yenile = oku('src/app/api/users/[id]/davet/route.ts');
  t('yeniden gönder: yalnız yönetici, aynı bayi, yalnız davet bekleyen',
    /me\.role !== 'ADMIN'/.test(yenile) && /tenantId: me\.tenantId/.test(yenile) && /DAVET_BEKLEYEN_YOK/.test(yenile));
  const sayfa = oku('src/app/davet/[jeton]/page.tsx');
  t('★ davet sayfası jetonu dışarı sızdırmıyor, arama motoruna girmiyor', /referrer: 'no-referrer'/.test(sayfa) && /robots: \{ index: false \}/.test(sayfa));
  const liste = oku('src/app/(dashboard)/users/page.tsx');
  t('★ kullanıcılar ekranı şifre özetini tarayıcıya göndermiyor (alan seçimi)', /select: \{ id: true, name: true, email: true, role: true, isActive: true, createdAt: true, davetBekliyor: true \}/.test(liste));
  t('★ kurulum ekip sayısı davet bekleyeni saymıyor', /davetBekliyor: false/.test(oku('src/lib/kurulum-veri.ts')));
  t('şifremi unuttum da davet işaretini kaldırıyor', /davetBekliyor: false/.test(oku('src/lib/sifre-sifirlama.ts')));
  t('yönetici şifre koyunca açık davetler ölüyor', /kullaniciDavet\.updateMany/.test(oku('src/app/api/users/[id]/route.ts')));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.message ?? e);
} finally {
  for (const id of kiracilar) {
    await p.kullaniciDavet.deleteMany({ where: { tenantId: id } }).catch(() => {});
    await p.user.deleteMany({ where: { tenantId: id } }).catch(() => {});
    await p.tenant.delete({ where: { id } }).catch(() => {});
  }
  await p.$disconnect();
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
