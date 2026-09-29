// NİLVERA UYARLAYICISI — e-Fatura / e-Arşiv otomatik gönderim
// Çalıştır:  node scripts/test-entegrator-nilvera.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Uyarlayıcı Nilvera'nın yayımlanmış sözleşmesine göre yazıldı
// (developer.nilvera.com). Burada o sözleşmeyi TAKLİT eden yerel bir sunucu
// kuruluyor ve uyarlayıcının gönderdiği her istek kaydedilip denetleniyor.
// Gerçek hesapla deneme yerine geçmez; ama sözleşmeden sapmayı ve hata
// yönetimini kilitler. En pahalı iki hata:
//
//   · 409'U HATA SAYMAK. Bağlantı, belge kabul edildikten SONRA koparsa
//     tekrar deneme 409 alır. Hata sayılırsa kesilmiş fatura
//     "gönderilemedi" görünür ve bayi aynı faturayı ikinci kez keser.
//   · YANLIŞ ORTAMA GİTMEK. Test modunda canlı ortama giden belge müşteriye
//     gerçek fatura olarak ulaşır.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-nilvera-'));
let mod;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/entegrator.ts'), join(KOK, 'src/lib/ubl.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  const yol = join(g, 'entegrator.js');
  writeFileSync(yol, readFileSync(yol, 'utf8').replace("from '@/lib/ubl'", "from './ubl.js'"), 'utf8');
  mod = await import(pathToFileURL(yol).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { NilveraEntegrator, entegratorBul, SAGLAYICILAR, nilveraEfaturaDurumu, nilveraEarsivDurumu, nilveraHataMetni } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── SAHTE NİLVERA ────────────────────────────────────────────────────────
const istekler = [];
let cevap = { status: 200, body: {} };
let asil = false; // true iken sunucu hiç cevap vermez (zaman aşımı)
const sunucu = http.createServer((req, res) => {
  const parca = [];
  req.on('data', (d) => parca.push(d));
  req.on('end', () => {
    istekler.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(parca).toString('utf8') });
    if (asil) return;
    res.writeHead(cevap.status, { 'content-type': 'application/json' });
    res.end(typeof cevap.body === 'string' ? cevap.body : JSON.stringify(cevap.body));
  });
});
await new Promise((ok) => sunucu.listen(0, '127.0.0.1', ok));
const PORT = sunucu.address().port;
const adres = { test: `http://127.0.0.1:${PORT}/t`, canli: `http://127.0.0.1:${PORT}/c` };
const ent = new NilveraEntegrator({ adres, zamanAsimiMs: 1500 });
const kimlik = { kullanici: '', parola: 'test-anahtari-123', test: true };

const ETTN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const belge = (ek = {}, alici = {}) => ({
  senaryo: 'TEMELFATURA', faturaTipi: 'SATIS', ettn: ETTN, gibNo: 'NXS2026000000007', tarih: '2026-09-29', paraBirimi: 'TRY',
  satici: { unvan: 'Demo Fotokopi Ltd', vkn: '1234567890', vergiDairesi: 'Kadıköy', adres: 'Moda Cd. 1', il: 'İstanbul', ilce: 'Kadıköy', telefon: '', eposta: '', etiket: 'urn:mail:defaultgb@demo.com.tr' },
  alici: { unvan: 'Müşteri AŞ', kimlikTuru: 'VKN', kimlikNo: '9876543210', vergiDairesi: 'Beşiktaş', adres: 'Barbaros 5', il: 'İstanbul', ilce: 'Beşiktaş', eposta: '', etiket: 'urn:mail:defaultpk@musteri.com.tr', ...alici },
  satirlar: [{ sira: 1, aciklama: 'Eylül kira', miktar: 1, birim: 'C62', birimFiyat: 1000, tutar: 1000, kdvOrani: 20, kdvTutari: 200 }],
  kdvOzeti: [{ oran: 20, matrah: 1000, tutar: 200 }],
  toplamlar: { matrah: 1000, kdv: 200, genelToplam: 1200 },
  not: null,
  ...ek,
});
const son = () => istekler[istekler.length - 1];

console.log('\nNilvera uyarlayıcısı\n');

try {
  // ── KAYIT ──────────────────────────────────────────────────────────────
  t('sağlayıcı listesinde', SAGLAYICILAR.includes('NILVERA'));
  t('küçük harfle de bulunuyor', entegratorBul('nilvera') instanceof NilveraEntegrator);
  t('★ kimlik: kullanıcı adı değil API anahtarı', ent.kimlikTuru === 'API_ANAHTARI' && ent.kimlikGerekir === true);

  // ── e-FATURA GÖNDERİM ──────────────────────────────────────────────────
  cevap = { status: 200, body: { UUID: ETTN, InvoiceNumber: 'NXS2026000000007' } };
  let s = await ent.gonder(belge(), kimlik);
  let r = son();
  t('başarılı gönderim', s.ok === true && s.referans === ETTN && !s.not, s);
  t('★ yayımlanmış yol: POST /einvoice/Send/Xml', r.method === 'POST' && r.url.startsWith('/t/einvoice/Send/Xml?'), r.url);
  t('★ alıcı etiketi Alias parametresinde', new URL(r.url, 'http://x').searchParams.get('Alias') === 'urn:mail:defaultpk@musteri.com.tr', r.url);
  t('Bearer API anahtarı', r.headers.authorization === 'Bearer test-anahtari-123');
  t('multipart, alan adı "file"', /^multipart\/form-data/.test(r.headers['content-type']) && /name="file"; filename="3f2504e0-4f89-41d3-9a0c-0305e82c3301\.xml"/.test(r.body), r.headers['content-type']);
  t('★ gönderilen XML, UBL çıktısının kendisi (ETTN ve numara içinde)', r.body.includes(ETTN) && r.body.includes('NXS2026000000007') && r.body.includes('<Invoice'), r.body.slice(0, 200));

  s = await ent.gonder(belge(), { ...kimlik, test: false });
  t('★ test kapalıyken CANLI adrese gidiliyor, açıkken TEST adresine', son().url.startsWith('/c/einvoice/Send/Xml') && istekler.at(-2).url.startsWith('/t/'));

  // ── e-ARŞİV ────────────────────────────────────────────────────────────
  s = await ent.gonder(belge({ senaryo: 'EARSIVFATURA' }, { etiket: '' }), kimlik);
  t('★ e-Arşiv: /earchive/Send/Xml, Alias yok', s.ok && son().url === '/t/earchive/Send/Xml', son().url);

  // ── ÖN KONTROL ─────────────────────────────────────────────────────────
  const once = istekler.length;
  s = await ent.gonder(belge({}, { etiket: '' }), kimlik);
  t('★ e-Faturada alıcı etiketi yoksa İSTEK ATILMIYOR', s.ok === false && s.tekrarDenenebilir === true && /etiket/i.test(s.hata) && istekler.length === once, s);
  s = await ent.gonder(belge(), { ...kimlik, parola: '  ' });
  t('anahtar yoksa istek atılmıyor', s.ok === false && istekler.length === once);

  // ── YANITLAR ───────────────────────────────────────────────────────────
  cevap = { status: 409, body: { Errors: [{ Code: '409', Description: 'Kayıt zaten var' }] } };
  s = await ent.gonder(belge(), kimlik);
  t('★ 409 BAŞARI sayılıyor (önceki deneme ulaşmış)', s.ok === true && /zaten/i.test(s.not ?? ''), s);

  cevap = { status: 422, body: { Errors: [{ Code: '1450', Description: 'Alıcı VKN GİB kaydıyla eşleşmedi' }] } };
  s = await ent.gonder(belge(), kimlik);
  t('★ 422: kalıcı hata, sağlayıcının mesajı bayiye iletiliyor', s.ok === false && s.tekrarDenenebilir === false && s.hata.includes('Alıcı VKN GİB kaydıyla eşleşmedi'), s);

  cevap = { status: 400, body: { Message: 'Şema hatası: cbc:ID' } };
  s = await ent.gonder(belge(), kimlik);
  t('400: kalıcı, mesaj okunuyor', s.ok === false && s.tekrarDenenebilir === false && s.hata.includes('Şema hatası'), s);

  cevap = { status: 401, body: '' };
  s = await ent.gonder(belge(), kimlik);
  t('401: anahtar reddedildi, düzeltilince tekrar denenebilir', s.ok === false && s.tekrarDenenebilir === true && /anahtar/i.test(s.hata), s);

  cevap = { status: 503, body: '<html><body>Service Unavailable</body></html>' };
  s = await ent.gonder(belge(), kimlik);
  t('5xx geçici, HTML gövde düz metne çevriliyor', s.ok === false && s.tekrarDenenebilir === true && s.hata.includes('Service Unavailable') && !s.hata.includes('<'), s);

  cevap = { status: 200, body: { UUID: ETTN, InvoiceNumber: 'NIL2026000000099' } };
  s = await ent.gonder(belge(), kimlik);
  t('★ sağlayıcı farklı numara verdiyse bayiye söyleniyor', s.ok && /NIL2026000000099/.test(s.not ?? '') && /NXS2026000000007/.test(s.not ?? ''), s);

  // ── AĞ ─────────────────────────────────────────────────────────────────
  const kapali = new NilveraEntegrator({ adres: { test: 'http://127.0.0.1:1/t', canli: 'http://127.0.0.1:1/c' }, zamanAsimiMs: 1500 });
  s = await kapali.gonder(belge(), kimlik);
  t('ulaşılamayan sunucu: tekrar denenebilir', s.ok === false && s.tekrarDenenebilir === true, s);
  asil = true;
  const yavas = new NilveraEntegrator({ adres, zamanAsimiMs: 300 });
  s = await yavas.gonder(belge(), kimlik);
  t('★ cevap vermeyen sunucuda zaman aşımı (asılı kalmıyor)', s.ok === false && s.tekrarDenenebilir === true, s);
  asil = false;

  // ── DURUM ──────────────────────────────────────────────────────────────
  cevap = { status: 200, body: { InvoiceStatus: { Code: 'succeed', Description: 'Başarılı' }, Answer: { AnswerCode: 'approved' } } };
  let d = await ent.durumSor(ETTN, kimlik, 'TEMELFATURA');
  t('★ e-Fatura durumu: GET /einvoice/Sale/{UUID}/Status', son().method === 'GET' && son().url === `/t/einvoice/Sale/${ETTN}/Status`, son().url);
  t('onaylandı → KABUL', d.ok && d.durum === 'KABUL', d);
  cevap = { status: 200, body: { InvoiceStatus: { Code: 'succeed' }, Answer: { AnswerCode: 'rejected', AnswerNote: 'Tutar hatalı' } } };
  d = await ent.durumSor(ETTN, kimlik, 'TEMELFATURA');
  t('★ ulaşmış ama reddedilmiş → RED (cevap zarftan önce gelir)', d.ok && d.durum === 'RED' && /Tutar hatalı/.test(d.not), d);
  cevap = { status: 200, body: { InvoiceStatus: { Code: 'error', DetailDescription: 'Zarf şema hatası' } } };
  d = await ent.durumSor(ETTN, kimlik, 'TEMELFATURA');
  t('GİB zarf hatası → RED, sebebi notta', d.ok && d.durum === 'RED' && /Zarf şema hatası/.test(d.not), d);
  cevap = { status: 200, body: { InvoiceStatus: { Code: 'waiting' } } };
  d = await ent.durumSor(ETTN, kimlik, 'TEMELFATURA');
  t('bekliyor → GONDERILDI (nihai değil)', d.ok && d.durum === 'GONDERILDI', d);

  cevap = { status: 200, body: { StatusCode: 'succeed', ReportStatus: 'Reported', CancelStatus: false } };
  d = await ent.durumSor(ETTN, kimlik, 'EARSIVFATURA');
  t('★ e-Arşiv durumu: GET /earchive/Invoices/{UUID}/Status', son().url === `/t/earchive/Invoices/${ETTN}/Status`, son().url);
  t('e-Arşiv başarılı → KABUL', d.ok && d.durum === 'KABUL', d);
  cevap = { status: 200, body: { StatusCode: 'succeed', CancelStatus: true } };
  d = await ent.durumSor(ETTN, kimlik, 'EARSIVFATURA');
  t('★ iptal edilmiş e-Arşiv → RED', d.ok && d.durum === 'RED', d);

  cevap = { status: 404, body: { Message: 'Kayıt bulunamadı' } };
  d = await ent.durumSor(ETTN, kimlik, 'TEMELFATURA');
  t('★ durum sorgusu başarısızsa belgenin durumu DEĞİŞTİRİLMİYOR (ok:false)', d.ok === false && /Kayıt bulunamadı/.test(d.hata), d);

  // ── SAF EŞLEMELER ──────────────────────────────────────────────────────
  t('otomatik cevaplanmış → KABUL', nilveraEfaturaDurumu({ Answer: { AnswerCode: 'documentAnsweredAutomatically' } }).durum === 'KABUL');
  t('onay bekliyor → GONDERILDI', nilveraEfaturaDurumu({ InvoiceStatus: { Code: 'succeed' }, Answer: { AnswerCode: 'waitingForApproval' } }).durum === 'GONDERILDI');
  t('okunamayan yanıt → ok:false', nilveraEfaturaDurumu(null).ok === false && nilveraEarsivDurumu(null).ok === false);
  t('e-Arşiv hata → RED', nilveraEarsivDurumu({ StatusCode: 'error', StatusDetail: 'X' }).durum === 'RED');
  t('hata metni: Errors listesi birleştiriliyor', nilveraHataMetni(JSON.stringify({ Errors: [{ Code: 'A', Description: 'b' }, { Description: 'c' }] })) === 'A b · c');
} finally {
  sunucu.close();
}

// ── HAT BAĞLANTILARI ─────────────────────────────────────────────────────
{
  const hat = readFileSync(join(KOK, 'src/lib/e-belge-gonderim.ts'), 'utf8');
  t('★ alıcı etiketi veritabanından belgeye taşınıyor', /eInvoiceAlias: true/.test(hat));
  t('API anahtarlı sağlayıcıda kullanıcı adı aranmıyor', /kimlikTuru !== 'API_ANAHTARI'/.test(hat));
  t('durum sorgusuna senaryo geçiliyor', /f\.senaryo === 'TEMELFATURA' \|\| f\.senaryo === 'EARSIVFATURA' \? f\.senaryo : null/.test(hat));
  const belgeKodu = readFileSync(join(KOK, 'src/lib/fatura-belgesi.ts'), 'utf8');
  t('kanonik belgede alıcı etiketi var', /etiket: \(alici\.eInvoiceAlias \?\? ''\)\.trim\(\)/.test(belgeKodu));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
