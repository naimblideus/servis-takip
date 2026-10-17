// WHATSAPP KURULUM DURUMU — süper admin kontrol listesi
// Çalıştır:  node scripts/test-whatsapp-saglik.mjs   (veritabanı ve Meta gerekmez)
//
// NEDEN BU TEST
// Kurucu Meta kurulumunu bu listeye bakarak yapıyor; liste yanlış "tamam"
// derse demo günü mesaj sessizce düşer. Ayrıca bu uç kimlik bilgilerinin
// (jeton, uygulama sırrı, doğrulama jetonu) bulunduğu ortamı okuyor: değerleri
// cevaba ya da günlüğe sızarsa tek ekran görüntüsü platform numarasını
// başkasının eline verir. Kaynak kontrolü bunu kilitler.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-wa-saglik-'));
const KAYNAKLAR = ['whatsapp-graph', 'whatsapp-sablon', 'whatsapp-saglik'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8').replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'"));
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const { saglikListesi, genelDurum, maskele, degiskenSayisi, hataKodu, testNumarasiMi } = await al('whatsapp-saglik');
const { SABLONLAR } = await al('whatsapp-sablon');

// ── YARDIMCILAR ──────────────────────────────────────────────────────────
const TAM_ENV = { token: true, phoneId: true, appSecret: true, verifyToken: true, wabaId: true, template: 'borc_hatirlatma', templateSayac: 'sayac_hatirlatma', lang: 'tr' };
const BOS_ENV = { token: false, phoneId: false, appSecret: false, verifyToken: false, wabaId: false, template: null, templateSayac: null, lang: null };
const TELEFON = { ok: true, veri: { display_phone_number: '+90 850 000 00 00', verified_name: 'Nextus Servis', quality_rating: 'GREEN', code_verification_status: 'VERIFIED', name_status: 'APPROVED', messaging_limit_tier: 'TIER_1K' } };
const sablon = (tur, ek = {}) => ({ name: SABLONLAR[tur].ad, status: 'APPROVED', language: 'tr', category: 'UTILITY', components: [{ type: 'BODY', text: SABLONLAR[tur].metin }], ...ek });
const SIMDI = new Date('2026-10-15T12:00:00Z');
const girdi = (ek = {}) => ({
  env: TAM_ENV, telefon: TELEFON, sablonlar: { ok: true, liste: [sablon('borc'), sablon('sayac')] },
  sonGelen: new Date(SIMDI.getTime() - 5 * 60000), sonDurum: null, sonHatalar: [], simdi: SIMDI, ...ek,
});
const madde = (L, anahtar) => L.find((x) => x.anahtar === anahtar);

// Sözlük anahtarları gerçekten var mı (sayfa anahtarı ekrana basmasın).
const trKaynak = oku('src/lib/i18n/tr.ts');
const enKaynak = oku('src/lib/i18n/en.ts');
const bolum = (s) => { const i = s.indexOf('    whatsapp: {\n      menu:') >= 0 ? s.indexOf('    whatsapp: {\n      menu:') : s.indexOf('    whatsapp: {\r\n      menu:'); return i >= 0 ? s.slice(i, s.indexOf('\n    },', s.indexOf('      m: {', i))) : ''; };
const trM = bolum(trKaynak), enM = bolum(enKaynak);
const anahtarVar = (k) => new RegExp(`\\n\\s+${k}: '`).test(trM) && new RegExp(`\\n\\s+${k}: '`).test(enM);

// ── SAF MANTIK ───────────────────────────────────────────────────────────
console.log('\nKontrol listesi\n');
{
  const L = saglikListesi({ env: BOS_ENV, telefon: null, sablonlar: null, sonGelen: null, sonDurum: null, sonHatalar: [], simdi: SIMDI });
  t('★ hiç env yok → İLK madde jeton, kırmızı, "env ekle"', L[0].anahtar === 'env_token' && L[0].durum === 'hata' && L[0].cozum === 'envEkle' && L[0].cozumParam?.ad === 'WHATSAPP_TOKEN', L[0]);
  t('numara kimliği, uygulama sırrı, doğrulama jetonu da kırmızı', ['env_phone', 'env_secret', 'env_verify'].every((k) => madde(L, k)?.durum === 'hata'));
  t('Meta sorgulanmadı → numara "bekliyor"', madde(L, 'numara')?.durum === 'bekliyor');
  t('WABA yok → uyarı, şablonlar bekliyor', madde(L, 'env_waba')?.durum === 'uyari' && madde(L, 'sablon_borc')?.durum === 'bekliyor');
  t('genel durum: hata', genelDurum(L) === 'hata');
  t('★ hiç mesaj yok + sır yok → webhook kırmızı, "messages\'a abone ol" ipucu', madde(L, 'webhook')?.durum === 'hata' && madde(L, 'webhook')?.cozum === 'webhookAbone');
}
{
  const L = saglikListesi(girdi());
  t('★ her şey yerinde → hepsi tamam', genelDurum(L) === 'tamam', L.filter((x) => x.durum !== 'tamam'));
  t('webhook: son gelen 5 dk önce', madde(L, 'webhook')?.baslik === 'webhookGelenDk' && madde(L, 'webhook')?.baslikParam?.n === 5);
  t('numara adı ve görünen numara başlıkta', madde(L, 'numara')?.baslikParam?.ad === 'Nextus Servis');
}
{
  const L = saglikListesi(girdi({ sablonlar: { ok: true, liste: [sablon('borc', { status: 'PENDING' }), sablon('sayac')] } }));
  t('★ jeton tamam + şablon PENDING → sarı', madde(L, 'sablon_borc')?.durum === 'uyari' && madde(L, 'sablon_borc')?.baslik === 'sablonBekliyor');
  t('genel durum: uyarı', genelDurum(L) === 'uyari');
}
{
  const L = saglikListesi(girdi({ sablonlar: { ok: true, liste: [sablon('borc', { status: 'REJECTED', rejected_reason: 'INVALID_FORMAT' }), sablon('sayac')] } }));
  const m = madde(L, 'sablon_borc');
  t('★ REDDEDİLDİ → kırmızı ve sebep görünüyor', m?.durum === 'hata' && m?.ayrinti === 'INVALID_FORMAT', m);
}
{
  const eksik = sablon('sayac', { components: [{ type: 'BODY', text: 'Merhaba {{1}}, sayacınızı gönderin, teşekkürler.' }] });
  const L = saglikListesi(girdi({ sablonlar: { ok: true, liste: [sablon('borc'), eksik] } }));
  const m = madde(L, 'sablon_sayac');
  t('★ Meta metni farklı değişken sayısı → kırmızı (#132000)', m?.durum === 'hata' && m?.baslik === 'sablonDegiskenFarkli' && m?.baslikParam?.meta === 1 && m?.baslikParam?.kod === 3, m);
  const ayniSayi = sablon('borc', { components: [{ type: 'BODY', text: 'Sayın {{1}}, {{2}} bildirir: {{3}} TL gecikmiş ödemeniz var. Cevap yazabilirsiniz.' }] });
  const L2 = saglikListesi(girdi({ sablonlar: { ok: true, liste: [ayniSayi, sablon('sayac')] } }));
  t('metin farklı ama değişken sayısı aynı → sarı (mesaj gider)', madde(L2, 'sablon_borc')?.durum === 'uyari' && madde(L2, 'sablon_borc')?.baslik === 'sablonMetinFarkli');
  const L3 = saglikListesi(girdi({ sablonlar: { ok: true, liste: [sablon('sayac')] } }));
  t('şablon Meta\'da hiç yok → kırmızı, "oluştur"', madde(L3, 'sablon_borc')?.durum === 'hata' && madde(L3, 'sablon_borc')?.cozum === 'sablonOlustur');
  const L4 = saglikListesi(girdi({ sablonlar: { ok: true, liste: [sablon('borc', { language: 'en_US' }), sablon('sayac')] } }));
  t('şablon başka dilde → kırmızı', madde(L4, 'sablon_borc')?.baslik === 'sablonDilYok');
}
{
  const L = saglikListesi(girdi({ telefon: { ok: true, veri: { ...TELEFON.veri, quality_rating: 'RED' } } }));
  t('★ kalite KIRMIZI → uyarı', madde(L, 'kalite')?.durum === 'uyari' && madde(L, 'kalite')?.baslik === 'kaliteKirmizi');
  const L2 = saglikListesi(girdi({ telefon: { ok: true, veri: { ...TELEFON.veri, quality_rating: 'YELLOW', code_verification_status: 'NOT_VERIFIED', name_status: 'DECLINED' } } }));
  t('kalite SARI → uyarı; kod doğrulanmamış → uyarı; görünen ad reddedildi → kırmızı',
    madde(L2, 'kalite')?.durum === 'uyari' && madde(L2, 'kod_dogrulama')?.durum === 'uyari' && madde(L2, 'gorunen_ad')?.durum === 'hata');
  const L3 = saglikListesi(girdi({ telefon: { ok: true, veri: { ...TELEFON.veri, display_phone_number: '+1 555-010-1234' } } }));
  t('★ Meta test numarası → "Kime listesine ekle" uyarısı', madde(L3, 'test_numarasi')?.cozum === 'testListesi');
  const L4 = saglikListesi(girdi({ telefon: { ok: false, error: 'süresi dolmuş (#190)', kod: 190 } }));
  t('Meta 190 → numara kırmızı, jeton yenile', madde(L4, 'numara')?.durum === 'hata' && madde(L4, 'numara')?.cozum === 'jetonYenile');
}
{
  const L = saglikListesi(girdi({ sonGelen: null }));
  t('★ hiç gelen yok → webhook ipucu (messages aboneliği)', madde(L, 'webhook')?.durum === 'uyari' && madde(L, 'webhook')?.cozum === 'webhookAbone');
  const L2 = saglikListesi(girdi({ sonGelen: null, sonDurum: new Date(SIMDI.getTime() - 3 * 3600000) }));
  t('gelen yok ama teslim bildirimi var → webhook çalışıyor (saat)', madde(L2, 'webhook')?.durum === 'tamam' && madde(L2, 'webhook')?.baslik === 'webhookDurumSa' && madde(L2, 'webhook')?.baslikParam?.n === 3);
  const L3 = saglikListesi(girdi({ sonGelen: new Date(SIMDI.getTime() - 3 * 86400000).toISOString() }));
  t('metin tarih kabul ediliyor, gün birimi', madde(L3, 'webhook')?.baslik === 'webhookGelenGun' && madde(L3, 'webhook')?.baslikParam?.n === 3);
}
{
  const L = saglikListesi(girdi({ sonHatalar: [{ error: 'Bu numara test listesinde değil. (#131030)' }, { error: 'x' }] }));
  const m = madde(L, 'son_hatalar');
  t('son hatalar: sayı + 131030 için "Kime listesi"', m?.durum === 'uyari' && m?.baslikParam?.n === 2 && m?.cozum === 'testListesi', m);
  const L2 = saglikListesi(girdi({ env: { ...TAM_ENV, template: 'borc_v2' } }));
  t('env şablon adı koddakinden farklı → uyarı', madde(L2, 'env_sablon_borc')?.durum === 'uyari');
  const L3 = saglikListesi(girdi({ env: { ...TAM_ENV, wabaId: false }, sablonlar: null }));
  t('WABA yoksa şablon "bekliyor", gönderim kırmızıya dönmüyor', madde(L3, 'sablon_borc')?.durum === 'bekliyor' && madde(L3, 'env_waba')?.durum === 'uyari' && genelDurum(L3) === 'uyari');
}
{
  t('yardımcılar: değişken sayısı, hata kodu, test numarası, maske',
    degiskenSayisi('a {{1}} b {{2}} {{1}}') === 2 && hataKodu('x (#131030)') === 131030 && hataKodu('yok') === null
    && testNumarasiMi('+1 555-123') && !testNumarasiMi('+90 555') && maskele('123456789') === '••••6789' && maskele('') === null);
}

console.log('\nSözlük\n');
{
  const L = [
    ...saglikListesi({ env: BOS_ENV, telefon: null, sablonlar: null, sonGelen: null, sonDurum: null, sonHatalar: [{ error: '(#131047)' }], simdi: SIMDI }),
    ...saglikListesi(girdi({ telefon: { ok: true, veri: { ...TELEFON.veri, display_phone_number: '+1 555', quality_rating: 'RED', code_verification_status: 'EXPIRED', name_status: 'PENDING_REVIEW' } }, sablonlar: { ok: false, error: 'e', kod: 100 }, sonGelen: null, sonDurum: SIMDI })),
    ...saglikListesi(girdi({ telefon: { ok: false, error: 'e', kod: 100 }, env: { ...TAM_ENV, lang: 'en', template: 'x' } })),
  ];
  const anahtarlar = new Set(L.flatMap((x) => [x.baslik, x.cozum].filter(Boolean)));
  const eksik = [...anahtarlar].filter((k) => !anahtarVar(k));
  t(`★ listede kullanılan ${anahtarlar.size} anahtarın hepsi tr ve en sözlüğünde`, eksik.length === 0 && trM.length > 0, eksik);
  // Kodda geçen tüm başlık/çözüm anahtarları (dallarda kalanlar dahil).
  const kaynakAnahtarlari = [...oku('src/lib/whatsapp-saglik.ts').matchAll(/(?:baslik|cozum): '([A-Za-z_]+)'/g)].map((m) => m[1]);
  const kaynakEksik = [...new Set(kaynakAnahtarlari)].filter((k) => !anahtarVar(k));
  t('kaynaktaki her sabit başlık/çözüm anahtarı sözlükte', kaynakEksik.length === 0, kaynakEksik);
  const sure = ['webhookGelenDk', 'webhookGelenSa', 'webhookGelenGun', 'webhookDurumDk', 'webhookDurumSa', 'webhookDurumGun', 'envYokGonderim', 'envYokWebhook', 'envYokDogrulama'];
  t('süre ve env anahtarları sözlükte', sure.every(anahtarVar), sure.filter((k) => !anahtarVar(k)));
}

// ── KAYNAK: GİZLİ DEĞER SIZMIYOR ─────────────────────────────────────────
console.log('\nKaynak (gizli değer)\n');
{
  const uc = oku('src/app/api/super-admin/whatsapp/route.ts');
  const GIZLI = ['WHATSAPP_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'];
  for (const ad of GIZLI) {
    const satirlar = uc.split(/\r?\n/).filter((s) => s.includes(`process.env.${ad}`));
    // İzin verilen tek kullanım: var/yok (!!x ya da !x) — değerin kendisi asla.
    const kotu = satirlar.filter((s) => [...s.matchAll(new RegExp(`(!*)process\\.env\\.${ad}\\b`, 'g'))].some((m) => !m[1]));
    t(`★ ${ad}: yalnız var/yok olarak okunuyor (${satirlar.length} yer)`, kotu.length === 0, kotu);
  }
  t('★ uç günlüğe ortam değişkeni yazmıyor', !/console\.(log|error|warn|info)\([^)]*process\.env/.test(uc));
  t('★ cevapta process.env nesnesinin tamamı yok', !/process\.env\s*[,}\)]/.test(uc) && !/\.\.\.process\.env/.test(uc));
  t('süper admin değilse 401 (GET ve POST)', (uc.match(/getSuperAdminSession\(\)/g) || []).length >= 2 && (uc.match(/status: 401/g) || []).length >= 2);
  t('Meta yalnız jeton + kimlik varken çağrılıyor', /env\.token && phoneId \? metaGet/.test(uc) && /env\.token && wabaId \? metaGet/.test(uc));
  t('kimlikler maskeli dönüyor', /phoneIdMaske: maskele\(phoneId\)/.test(uc) && /wabaIdMaske: maskele\(wabaId\)/.test(uc) && !/phoneId: phoneId|wabaId: wabaId/.test(uc));
  t('test gönderimi: telefon waApiPhone ile, hız sınırı 20 / 10 dk', /waApiPhone\(/.test(uc) && /rateLimit\([^)]*20, 10 \* 60_000\)/.test(uc));
  t('hello_world en_US, değişkensiz', /name: 'hello_world', dil: 'en_US', degerler: \[\]/.test(uc));
  t('borç/sayaç şablonu örnek değerlerle ve env adıyla', /WHATSAPP_TEMPLATE \|\| SABLONLAR\.borc\.ad.*SABLONLAR\.borc\.ornek/.test(uc) && /WHATSAPP_TEMPLATE_SAYAC \|\| SABLONLAR\.sayac\.ad.*SABLONLAR\.sayac\.ornek/.test(uc));
  const sayfa = oku('src/app/(super-admin)/super-admin/whatsapp/page.tsx');
  t('sayfa webhook adresini ve "messages" alanını kopyalatıyor', sayfa.includes('https://nextusservis.com/api/whatsapp/webhook') && /deger="messages"/.test(sayfa));
  t('menüde bağlantı var', /\/super-admin\/whatsapp/.test(oku('src/components/super-admin/SuperAdminSidebar.tsx')));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
