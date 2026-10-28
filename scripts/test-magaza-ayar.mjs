// MAĞAZA AYARLARI VEKİLİ — Servis → Nextus Mağaza /api/servis/* (lib/magaza-ayar)
// Çalıştır:  node scripts/test-magaza-ayar.mjs   (sunucu ya da veritabanı gerekmez)
//
// NEDEN BU TEST
// Servis ve mağaza ayrı dağıtılıyor: Servis yeni ekranla canlıya çıkarken
// mağaza eski sürümde kalabilir. O zaman uç yoktur (Next'in HTML 404 sayfası);
// ekran çökmemeli, "mağaza yok" da dememeli: "mağaza güncelleniyor" demeli.
// Mağazanın kendi JSON 404'ü ise gerçekten "bu bayiye bağlı mağaza yok"tur.
import http from 'node:http';
import { derle } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice } = derle({ girisler: ['src/lib/magaza-ayar.ts'], onEk: 'st-magaza-ayar-' });
const { magazaIstegi, magazaYanitiCevir } = await ice('lib/magaza-ayar');

// Sahte mağaza: yola göre farklı yanıt; gelen yetki başlığını ve gövdeyi kaydeder.
let son = null;
const sunucu = http.createServer((req, res) => {
  let govde = '';
  req.on('data', (c) => { govde += c; });
  req.on('end', () => {
    son = { yetki: req.headers.authorization, govde, yol: req.url, yontem: req.method };
    const json = (kod, j) => { res.writeHead(kod, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (req.url.startsWith('/eski')) { res.writeHead(404, { 'content-type': 'text/html' }); res.end('<html>404</html>'); }
    else if (req.url.startsWith('/yok')) json(404, { ok: false, hata: 'Bu bayiye bağlı mağaza bulunamadı.' });
    else if (req.url.startsWith('/yetkisiz')) json(401, { ok: false, hata: 'Yetkisiz istek.' });
    else if (req.url.startsWith('/sinir')) json(429, { ok: false, hata: 'Çok sık.' });
    else if (req.url.startsWith('/kural')) json(422, { ok: false, hata: 'IBAN hatalı: bir rakam yanlış görünüyor.' });
    else json(200, { ok: true, ayar: { telefon: '1' } });
  });
});
await new Promise((r) => sunucu.listen(0, '127.0.0.1', r));
const adres = `http://127.0.0.1:${sunucu.address().port}`;
const JETON = 'j'.repeat(40);

try {
  console.log('\nAyar yok');
  delete process.env.MAGAZA_API_URL;
  process.env.SHOP_SERVICE_TOKEN = JETON;
  t('MAGAZA_API_URL yok → AYAR_YOK (istek atılmaz)', (await magazaIstegi('/api/servis/ayarlar')).durum === 'AYAR_YOK');
  process.env.MAGAZA_API_URL = adres;
  process.env.SHOP_SERVICE_TOKEN = 'kisa';
  t('jeton 24 karakterden kısa → AYAR_YOK', (await magazaIstegi('/api/servis/ayarlar')).durum === 'AYAR_YOK');
  process.env.SHOP_SERVICE_TOKEN = JETON;

  console.log('\nYanıtlar');
  const ok = await magazaIstegi('/api/servis/ayarlar?tenantId=x', { method: 'POST', json: { islem: 'KAYDET' } });
  t('başarılı yanıt aynen geçer', ok.durum === 'TAMAM' && ok.kod === 200 && ok.govde.ok === true, ok);
  t('jeton Bearer başlığında gider', son?.yetki === `Bearer ${JETON}`);
  t('JSON gövde gider', JSON.parse(son?.govde || '{}').islem === 'KAYDET');

  const eski = await magazaIstegi('/eski/api/servis/ayarlar');
  t('★ eski mağaza (HTML 404) → GUNCELLENIYOR, çökme yok', eski.durum === 'GUNCELLENIYOR', eski);
  t('ekrana GUNCELLENIYOR kodu gider', magazaYanitiCevir(eski).govde.kod === 'GUNCELLENIYOR');

  const yok = magazaYanitiCevir(await magazaIstegi('/yok'));
  t('★ mağazanın JSON 404\'ü → MAGAZA_YOK (güncelleniyor değil)', yok.kod === 404 && yok.govde.kod === 'MAGAZA_YOK', yok);
  t('mağaza jetonu reddederse → AYAR_YOK', magazaYanitiCevir(await magazaIstegi('/yetkisiz')).govde.kod === 'AYAR_YOK');
  t('hız sınırı → SINIR', magazaYanitiCevir(await magazaIstegi('/sinir')).govde.kod === 'SINIR');
  const kural = magazaYanitiCevir(await magazaIstegi('/kural'));
  t('★ kural hatası mağazanın mesajıyla aynen döner', kural.kod === 422 && kural.govde.hata === 'IBAN hatalı: bir rakam yanlış görünüyor.', kural);

  process.env.MAGAZA_API_URL = 'http://127.0.0.1:1';
  t('mağazaya ulaşılamıyor → ULASILAMADI', (await magazaIstegi('/api/servis/ayarlar', { zamanAsimiMs: 3000 })).durum === 'ULASILAMADI');
} finally {
  sunucu.closeAllConnections?.();
  await new Promise((r) => sunucu.close(r));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exitCode = kaldi ? 1 : 0;
