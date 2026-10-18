// ŞABLONLARI META'YA GÖNDER — eksikler açılır, olanlara dokunulmaz. Sahte Meta ile.
// Çalıştır:  npx tsx --tsconfig tsconfig.json scripts/test-whatsapp-sablon-olustur.mts
// Veritabanı gerekmez.
import http from 'node:http';

let gecti = 0, kaldi = 0;
const t = (ad: string, kosul: unknown, detay?: unknown) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay).slice(0, 500)}` : ''}`); }
};

const istekler: { yontem: string; yol: string; govde: any }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
let listeHata = false;
const reddet = new Set<string>();
const sahte = http.createServer((q, c) => {
  let g = '';
  q.on('data', (x) => { g += x; });
  q.on('end', () => {
    const govde = g ? JSON.parse(g) : null;
    istekler.push({ yontem: q.method ?? '', yol: q.url ?? '', govde });
    c.setHeader('content-type', 'application/json');
    if (q.method === 'GET') {
      if (listeHata) { c.statusCode = 400; c.end(JSON.stringify({ error: { code: 100, message: 'Unsupported get request' } })); return; }
      c.end(JSON.stringify({ data: [
        { name: 'borc_hatirlatma', status: 'APPROVED', language: 'tr' },
        { name: 'magaza_yeni_siparis', status: 'PENDING', language: 'tr' },
        { name: 'magaza_stok_geldi', status: 'APPROVED', language: 'en' }, // dil farklı: Türkçesi eksik
      ] }));
      return;
    }
    if (reddet.has(govde?.name)) { c.statusCode = 400; c.end(JSON.stringify({ error: { code: 100, message: 'Invalid parameter', error_data: { details: 'Body has too many variables' } } })); return; }
    c.end(JSON.stringify({ id: 'tpl-' + govde?.name, status: 'PENDING', category: 'UTILITY' }));
  });
});
await new Promise<void>((r) => sahte.listen(0, '127.0.0.1', () => r()));
Object.assign(process.env, { WHATSAPP_GRAPH_KOK: `http://127.0.0.1:${(sahte.address() as { port: number }).port}`, WHATSAPP_TOKEN: 'test' });

const o = await import('../src/lib/whatsapp-sablon-olustur');

console.log('\nListe ve gövde');
const tum = o.tumSablonlar();
t('7 şablon (2 hatırlatma + 5 mağaza)', tum.length === 7, tum.map((s) => s.ad));
t('ortamdaki ad kullanılır', o.tumSablonlar({ template: 'borc_v2' })[0].ad === 'borc_v2');
for (const s of tum) {
  const g = o.olusturmaGovdesi(s);
  const n = Math.max(0, ...[...s.metin.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
  t(`${s.ad}: UTILITY/tr, BODY + ${n} örnek`, g.category === 'UTILITY' && g.language === 'tr' && g.components[0].type === 'BODY' && (g.components[0] as { example?: { body_text: string[][] } }).example?.body_text[0].length === n);
}

console.log('\nEksikleri gönder');
reddet.add('magaza_teslime_hazir');
const r = await o.eksikSablonlariOlustur('waba-1');
const posts = istekler.filter((i) => i.yontem === 'POST');
t('ok', r.ok, r);
if (r.ok) {
  const by = Object.fromEntries(r.sonuclar.map((s) => [s.ad, s]));
  t('onaylı olan gönderilmedi (zaten-var, APPROVED)', by.borc_hatirlatma?.sonuc === 'zaten-var' && by.borc_hatirlatma.durum === 'APPROVED');
  t('onay bekleyen gönderilmedi (zaten-var, PENDING)', by.magaza_yeni_siparis?.sonuc === 'zaten-var' && by.magaza_yeni_siparis.durum === 'PENDING');
  t('yalnız İngilizcesi olan Türkçe olarak açıldı', by.magaza_stok_geldi?.sonuc === 'olusturuldu');
  t('Meta reddi okunur sebeple döndü', by.magaza_teslime_hazir?.sonuc === 'hata' && /too many variables/.test(by.magaza_teslime_hazir.hata ?? ''), by.magaza_teslime_hazir);
  t('POST yalnız eksik 5 şablon için', posts.length === 5 && posts.every((p) => p.yol === '/waba-1/message_templates'), posts.map((p) => p.govde?.name));
}

console.log('\nListe okunamazsa');
listeHata = true;
const once = istekler.filter((i) => i.yontem === 'POST').length;
const r2 = await o.eksikSablonlariOlustur('waba-1');
t('hata döner, hiçbir şablon açılmaz (kör gönderim yok)', !r2.ok && istekler.filter((i) => i.yontem === 'POST').length === once, r2);

await new Promise<void>((r) => sahte.close(() => r()));
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exitCode = kaldi ? 1 : 0;
