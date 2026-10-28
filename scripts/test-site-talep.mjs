// MAĞAZA SİTESİNDEN SERVİS TALEBİ — lib/site-talep.ts + /api/shop/talep
// Çalıştır:  node scripts/test-site-talep.mjs   (sunucu ya da veritabanı gerekmez)
//
// NEDEN BU TEST
// Talebi sitede kimliği doğrulanmamış biri yazıyor. Yanlış cihaza arıza
// yazılmamalı, doğrudan fiş açılmamalı (müşteri paneliyle aynı kural: bayi
// onaylar) ve mağaza aynı talebi yeniden gönderirse ikinci kayıt açılmamalı.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KOK, derle } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice } = derle({ girisler: ['src/lib/site-talep.ts'], onEk: 'st-site-talep-' });
const { cihazSec, talepAciklamasi, talepEtiketi } = await ice('lib/site-talep');

console.log('\nCihaz seçimi');
const c = (id, brand, model) => ({ id, brand, model });
const iki = [c('a', 'Pantum', 'M6700DW'), c('b', 'Kyocera', 'ECOSYS M2040dn')];
t('★ model tek cihaza oturur → o cihaz', cihazSec(iki, 'pantum m6700') === 'a');
t('model yalnız cihazın modeliyle de eşleşir (marka yazılmamış)', cihazSec(iki, 'M2040dn') === 'b');
t('★ belirsiz model → cihazsız (yanlış cihaza arıza yazılmaz)', cihazSec([c('a', 'Pantum', 'M6700DW'), c('b', 'Pantum', 'M6700DW')], 'M6700') === null);
t('eşleşmeyen model → cihazsız', cihazSec(iki, 'HP LaserJet') === null);
t('model yazılmadı, tek cihaz → o cihaz', cihazSec([c('a', 'Pantum', 'P2500')], '') === 'a');
t('★ model yazılmadı, iki cihaz → cihazsız', cihazSec(iki, '') === null);
t('model yazıldı ama tek cihaz başka model → cihazsız', cihazSec([c('a', 'Pantum', 'P2500')], 'Kyocera') === null);

console.log('\nAçıklama');
const a = talepAciklamasi({ talepId: 'abc123xyz9', ad: 'Ayşe', telefon: '05321112233', model: 'M6700', mesaj: 'Kağıt sıkıştırıyor' });
t('kim, cihaz, mesaj ve talep etiketi tek metinde', a.includes('Ayşe') && a.includes('Cihaz: M6700') && a.includes('Kağıt sıkıştırıyor') && a.endsWith(talepEtiketi('abc123xyz9')), a);
t('açıklama 1000 karakteri aşmaz', talepAciklamasi({ talepId: 'abc123xyz9', ad: 'x', telefon: '1', model: '', mesaj: 'y'.repeat(5000) }).length <= 1000);

console.log('\nUç (kaynak)');
const uc = readFileSync(join(KOK, 'src/app/api/shop/talep/route.ts'), 'utf8');
t('★ mağaza jetonu olmadan çalışmaz', /if \(!shopServisYetkili\(req\)\) return/.test(uc));
t('★ doğrudan fiş açmaz: müşteri talepleri kuyruğuna (PortalRequest ARIZA) düşer', !/serviceTicket\.create/.test(uc) && /portalRequest\.create/.test(uc) && /tur: 'ARIZA'/.test(uc));
t('müşteri telefonla eşleşir (son 10 hane), yabancıya kart açılmaz', /findCustomerByPhone\(tenantId, telefon\)/.test(uc) && !/customer\.create/.test(uc));
t('aynı talep ikinci kez kayıt açmaz', /talepEtiketi\(talepId\)/.test(uc) && /if \(onceki\) return/.test(uc));
t('yalnız servis talebi kayıt açar', /if \(g\.tur !== 'SERVIS'\) return/.test(uc));

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exitCode = kaldi ? 1 : 0;
