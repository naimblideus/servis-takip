// PANTUM TOPLANTISI ÖNCESİ DENETİM — bulunan hataların geri gelmemesi için kilitler.
// (2026-10-15 denetimi: ilk ziyarette sayfa yenileme, mükerrer kira, ortak demoda
// vitrin tüketimi, büyük/küçük harf duyarlı giriş, İngilizce çoğul, vb.)
// Kaynak düzeyinde ve saf fonksiyon düzeyinde; veritabanı ve sunucu gerekmez.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (y) => readFileSync(join(KOK, y), 'utf8');
let gecti = 0, kaldi = 0;
const t = (ad, ok, ek) => { if (ok) { gecti++; console.log(`  ✓ ${ad}`); } else { kaldi++; console.log(`  ✗ ${ad}${ek !== undefined ? ' — ' + JSON.stringify(ek) : ''}`); } };

console.log('\nİlk ziyaret (QR ile gelen bayi)\n');
{
  const sw = oku('src/components/ServiceWorkerKurulum.tsx');
  t('★ sayfa yalnız "Güncelle"ye basılınca yenilenir (ilk kurulumdaki devralma yenilemez)', /if \(!guncelleIstendi\.current \|\| tazelendi\) return;/.test(sw) && /guncelleIstendi\.current = true; yeniSurum\.postMessage\('HEMEN_GUNCELLE'\)/.test(sw));
  const isci = oku('public/sw.js');
  const kurulum = isci.slice(isci.indexOf("addEventListener('install'"), isci.indexOf("addEventListener('activate'"));
  t('★ service worker kurulumda kendiliğinden devralmıyor (skipWaiting yalnız HEMEN_GUNCELLE ile)', !/skipWaiting/.test(kurulum) && /HEMEN_GUNCELLE'\) self\.skipWaiting\(\)/.test(isci));
}

console.log('\nEtkinlik teklifi her yoldan (demo üzerinden gelen de)\n');
{
  const p = oku('public/pantum.html');
  t('★ /pantum etkinlik çerezini yazar', /document\.cookie = 'etk=pantum; path=\/; max-age=2592000; samesite=lax'/.test(p));
  t('★ İngilizce seçimi uygulamanın dil çerezine geçer (Çince telefon dahil)', /document\.cookie = 'dil=' \+ d/.test(p) && /uygula\(ilk, ilk === 'en' \|\| istek === 'tr'\)/.test(p));
  t('★ etkinlik adı büyük harfte İngilizce kuralla (MEETİNG değil)', /<p class="etiket" lang="en">Pantum Premium Partners Meeting 2026<\/p>/.test(p));
  const k = oku('src/lib/kayit.ts');
  t('★ kodsuz kayıt saatlik tavanı etkinlik kayıtlarını saymaz', /etkinlikDisi = etk \? \{\} : \{ NOT:/.test(k));
  t('★ aynı firma adıyla eşzamanlı kayıtta ad çakışırsa yeniden dener', /P2002' && String\(hata\.meta\?\.target \?\? ''\)\.includes\('slug'\)/.test(k));
  const r = oku('src/app/api/kayit/route.ts');
  t('★ kayıt ucu kodu yoksa etkinlik çerezine bakar (GET ve POST)', (r.match(/ETKINLIK_CEREZI\)\?\.value/g) ?? []).length >= 2);
  t('★ beklenmeyen hatada bayinin bilgisi kaybolmaz (talep)', /catch \(e\) \{[\s\S]{0,200}return talebeCevir\(d\.veri, etk, 'yogun'\)/.test(r));
  const sayfa = oku('src/app/kayit/page.tsx');
  t('★ /kayit ilk HTML\'de çerezdeki etkinliği de çözer', /cookies\(\)\)\.get\(ETKINLIK_CEREZI\)/.test(sayfa));
  t('demo turu ve giriş sayfası etkinliğin süresini /api/kayit\'ten alır', /fetch\('\/api\/kayit'\)/.test(oku('src/components/DemoTuru.tsx')) && /fetch\('\/api\/kayit'\)/.test(oku('src/app/login/page.tsx')));
}

console.log('\nKalabalık (tek otel IP, yüzlerce kayıt)\n');
{
  const tm = oku('src/lib/tenant-manager.ts');
  t('★ hesap tek iç içe yazmayla açılır (5 sn işlem zamanlayıcısı yok)', !/prisma\.\$transaction\(/.test(tm) && /users: \{\s*create:/.test(tm));
  t('★ kayıt şifre özeti maliyet 10 (12 sunucuyu kilitliyordu)', /bcrypt\.hash\(input\.password \|\| tempPassword, 10\)/.test(tm));
  t('yeni bayinin ilk faturası 00001', /nextInvoiceSeq: 0/.test(tm) && existsSync(join(KOK, 'prisma/migrations/20261015100000_fatura_sayaci/migration.sql')));
  const a = oku('src/lib/auth.ts');
  t('★ giriş e-postası büyük/küçük harf duyarsız (lower=lower, ILIKE değil)', /lower\("email"\) = \$\{eposta\}/.test(a) && !/mode: 'insensitive'/.test(a));
  t('★ yanlış şifre sınırı e-postaya bağlı ve demo kilitlenmez', /girisKilitli\(eposta\)/.test(a) && /girisHatasi\(eposta, adaylar\.some\(\(a\) => \(a as any\)\.tenant\?\.demo( && !\(a as any\)\.tenant\?\.ekipTest)?\)\)/.test(a));
  const c = oku('src/app/api/auth/2fa/check/route.ts');
  t('2FA kontrolü IP + e-posta ile sınırlı (salonda herkes aynı IP)', /2fa-check:\$\{clientIp\(req\)\}:\$\{eposta\}/.test(c));
  const s = oku('src/lib/sifre-sifirlama.ts');
  t('şifre yardımı: e-posta kapalıyken IP sınırı yok', s.indexOf("if (!gmailAyarli()) return { durum: 'EPOSTA_KAPALI' };") < s.indexOf("return { durum: 'SINIR' }"));
}

console.log('\nPara (mükerrer fatura yok)\n');
{
  const inv = oku('src/lib/invoicing.ts');
  // Saf fonksiyonu kaynaktan çalıştır.
  const govde = inv.slice(inv.indexOf('export function kiraKesilir'), inv.indexOf('export const kiraIsaretiKosulu'))
    .replace(/export function kiraKesilir\(d: KiraCihazi, period: string, donemSonu\?: Date\): boolean/, 'function kiraKesilir(d, period, donemSonu)');
  const kiraKesilir = new Function(`${govde}; return kiraKesilir;`)();
  const cihaz = (son, kurulus = new Date('2026-01-01')) => ({ isRental: true, monthlyRent: 1000, lastInvoicedPeriod: son, createdAt: kurulus });
  t('★ bu dönemin kirası işaret önceki dönemdeyse kesilir', kiraKesilir(cihaz('2026-09'), '2026-10', new Date('2026-11-01')));
  t('★ geçmiş dönem kesimi kirayı İKİNCİ kez yazmaz', !kiraKesilir(cihaz('2026-10'), '2026-07', new Date('2026-08-01')));
  t('★ aynı dönem iki kez kesilmez', !kiraKesilir(cihaz('2026-10'), '2026-10', new Date('2026-11-01')));
  t('dönem bittikten sonra kurulan cihazın o döneme kirası yok', !kiraKesilir(cihaz(null, new Date('2026-10-05')), '2026-09', new Date('2026-10-01')));
  t('kiralık değil ya da kira 0 → kira yok', !kiraKesilir({ ...cihaz(null), isRental: false }, '2026-10') && !kiraKesilir({ ...cihaz(null), monthlyRent: 0 }, '2026-10'));
  t('★ kira işareti yalnız ileri gider (updateMany koşulu)', /lastInvoicedPeriod: \{ lt: period \}/.test(inv) && /\.\.\.kiraIsaretiKosulu\(period\)/.test(inv));
  t('★ dönem kesimi, fatura ve Kaçan Gelir aynı kuralı kullanır', /kiraKesilir\(d, period, end\)/.test(oku('src/lib/period-charges.ts')) && /kiraKesilir\(d, period, end\)/.test(oku('src/app/api/revenue-risk/route.ts')));
  t('★ başka bayinin müşterisine cihaz bağlanamaz', /customer\.findFirst\(\{ where: \{ id: String\(body\.customerId \?\? ''\), tenantId: user\.tenantId \}/.test(oku('src/app/api/devices/route.ts')));
}

console.log('\nOrtak demo (400 kişi aynı hesapta)\n');
{
  t('★ demoda dil seçimi ortak kullanıcının kaydına yazılmaz', /if \(kullaniciId && !\(oturum\?\.user as any\)\?\.demo\)/.test(oku('src/app/api/locale/route.ts')));
  const l = oku('src/app/(dashboard)/layout.tsx');
  t('★ demoda WhatsApp/arama bağlantıları gerçek numaraya gitmez, metin gösterilir', /demo\?: boolean \} \| undefined\)\?\.demo( \|\| ekipTest\))? && <DemoBaglantiKoruma \/>/.test(l)
    && /wa\\\.me/.test(oku('src/components/DemoBaglantiKoruma.tsx')));
  t('★ demoda faturala/onayla/ekle/toner gönder önizleme gösterir (vitrin tükenmez)', /if \(demo\) \{\s*setMsg\(hedefDonem/.test(oku('src/app/(dashboard)/kacan-gelir/page.tsx'))
    && /if \(demo\) \{ setHata\(null\); setBilgi\(doldur\(t\.demoOnizleme\.cihaz/.test(oku('src/app/(dashboard)/sayac-tarayici/page.tsx'))
    && /if \(demo\) \{ setBilgi\(\{ metin: t\.demoOnizleme\.toner/.test(oku('src/app/(dashboard)/sarf/page.tsx')));
  const d = oku('src/components/DemoTuru.tsx');
  t('★ demo turunun 4. durağı kırmızı zarar uyarısının olduğu sayfa', /href: '\/sozlesmeler\/karlilik'/.test(d) && !/'\/cihaz-karlilik'/.test(d));
  t('demo fotoğrafı (DEMO-MEDIA) kırık değil', /startsWith\('DEMO-'\)/.test(oku('src/app/api/whatsapp/media/[id]/route.ts')) && existsSync(join(KOK, 'public/demo/sayac-foto.svg')));
}

console.log('\nİngilizce (Pantum merkezi)\n');
{
  const s = oku('src/lib/i18n/sozluk.ts');
  const govde = s.slice(s.indexOf('export function doldur'), s.indexOf('\n}', s.indexOf('export function doldur')) + 2)
    .replace('export function doldur(metin: string, degerler: Record<string, string | number>): string', 'function doldur(metin, degerler)');
  const doldur = new Function(`${govde}; return doldur;`)();
  t('★ tekil: "1 machine is"', doldur('{n} {n|machine is|machines are} asking', { n: 1 }) === '1 machine is asking');
  t('★ çoğul: "3 machines are"', doldur('{n} {n|machine is|machines are} asking', { n: 3 }) === '3 machines are asking');
  t('sayı olmayan değer çoğul kalır, düz yer tutucu bozulmaz', doldur('{x} {x|a|b} {y}', { x: 'abc', y: 'z' }) === 'abc b z');
  const en = oku('src/lib/i18n/en.ts');
  t('★ İngilizcede "{n} devices/machines/readings/days" kalıbı tekil biçimsiz kalmadı', !/\{n\} (devices|machines|readings|days)\b/.test(en));
  t('şüpheli okuma ve durgunluk cümleleri ekranda sözlükten kuruluyor', /t\.kacanGelir\.supheliKat/.test(oku('src/app/(dashboard)/kacan-gelir/page.tsx')) && /t\.sayacTuru\.dususAciklama/.test(oku('src/app/(dashboard)/sayac-turu/page.tsx')));
  t('sekme başlığı dilde (kök düzen)', /export async function generateMetadata\(\): Promise<Metadata>/.test(oku('src/app/layout.tsx')));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
