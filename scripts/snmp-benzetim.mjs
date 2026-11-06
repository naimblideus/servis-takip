// SNMP BENZETİMİ — gerçek yazıcı olmadan tarayıcı kurulumunu prova etmek için.
//
// Çalıştır:  node scripts/snmp-benzetim.mjs [--port 161] [--sayfa 0] [--taban 20]
//
// Bu bilgisayarın döngü adreslerinde (127.0.0.x) üç "cihaz" açar:
//   127.0.0.20  Pantum tek renkli (SNMP açık)            → sayaç + toner okunur
//   127.0.0.21  Kyocera renkli (SNMP açık, renk ayrımı)  → siyah/renkli ayrı okunur
//   127.0.0.22  SNMP'si KAPALI yazıcı (yalnız 9100 açık) → kurulum ekranı "SNMP kapalı" demeli
// Döngü adresi tarayıcının kendi ağ taramasına girmez; panelde "Yazıcının IP
// adresi" kutusuna 127.0.0.20,127.0.0.21,127.0.0.22 yazılır (farklı alt ağdaki
// yazıcının provası). --sayfa N her cihazın sayacına N sayfa ekler (ikinci ay).
// --taban 40 adresleri 127.0.0.40/41/42 yapar (test, prova açıkken çakışmasın).
//
// Paket kodlaması scripts/test-sayac-tarayici.mjs'teki sahte cihazla aynı;
// burada yalnız elle prova için ayakta duran sürümü.
import dgram from 'node:dgram';
import net from 'node:net';

const arg = (ad, varsayilan) => { const i = process.argv.indexOf(`--${ad}`); return i > 0 ? process.argv[i + 1] : varsayilan; };
const PORT = Number(arg('port', 161));
const EK = Number(arg('sayfa', 0));
const T = Number(arg('taban', 20));
const ip = (n) => `127.0.0.${T + n}`;

const tlv = (tag, d) => { const u = d.length; const uz = u < 0x80 ? [u] : u < 0x100 ? [0x81, u] : [0x82, u >> 8, u & 0xff]; return Buffer.from([tag, ...uz, ...d]); };
const intB = (n) => { const b = []; let x = BigInt(n); do { b.unshift(Number(x & 0xffn)); x >>= 8n; } while (x > 0n); if (b[0] & 0x80) b.unshift(0); return b; };
const oidB = (oid) => { const p = oid.split('.').map(Number); const o = [40 * p[0] + p[1]]; for (const a of p.slice(2)) { const q = [a & 0x7f]; let v = Math.floor(a / 128); while (v > 0) { q.unshift(0x80 | (v & 0x7f)); v = Math.floor(v / 128); } o.push(...q); } return o; };
const deger = (d) => d.t === 'str' ? tlv(0x04, [...Buffer.from(d.v, 'utf8')]) : d.t === 'hex' ? tlv(0x04, [...Buffer.from(d.v, 'hex')])
  : d.t === 'oid' ? tlv(0x06, oidB(d.v)) : d.t === 'cnt' ? tlv(0x41, intB(d.v)) : tlv(0x02, intB(d.v));
const oku = (b, i) => { const tag = b[i]; let u = b[i + 1]; let j = i + 2; if (u & 0x80) { const k = u & 0x7f; u = 0; for (let x = 0; x < k; x++) u = (u << 8) | b[j++]; } return { tag, d: b.subarray(j, j + u), son: j + u }; };
const cocuk = (d) => { const l = []; let i = 0; while (i < d.length) { const x = oku(d, i); l.push(x); i = x.son; } return l; };
const oidCoz = (d) => { const p = [Math.floor(d[0] / 40), d[0] % 40]; let v = 0; for (const x of d.subarray(1)) { v = v * 128 + (x & 0x7f); if (!(x & 0x80)) { p.push(v); v = 0; } } return p.join('.'); };
const kars = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if (x[i] === undefined) return -1; if (y[i] === undefined) return 1; if (x[i] !== y[i]) return x[i] - y[i]; } return 0; };

function ajan(ip, mib, ad) {
  const sirali = Object.keys(mib).sort(kars);
  const s = dgram.createSocket('udp4');
  s.on('message', (m, uzak) => {
    try {
      const [ver, top, pdu] = cocuk(oku(m, 0).d);
      if (Buffer.from(top.d).toString() !== 'public') return;
      const [rid, , , vbl] = cocuk(pdu.d);
      const cevap = cocuk(vbl.d).map((vb) => {
        const o = oidCoz(cocuk(vb.d)[0].d);
        if (pdu.tag === 0xa1) {
          const n = sirali.find((k) => kars(k, o) > 0);
          return n ? tlv(0x30, [...tlv(0x06, oidB(n)), ...deger(mib[n])]) : tlv(0x30, [...tlv(0x06, oidB(o)), 0x82, 0x00]);
        }
        return mib[o] ? tlv(0x30, [...tlv(0x06, oidB(o)), ...deger(mib[o])]) : tlv(0x30, [...tlv(0x06, oidB(o)), 0x80, 0x00]);
      });
      const govde = [...tlv(0x02, [...rid.d]), ...tlv(0x02, [0]), ...tlv(0x02, [0]), ...tlv(0x30, Buffer.concat(cevap))];
      s.send(tlv(0x30, [...tlv(0x02, [...ver.d]), ...tlv(0x04, [...top.d]), ...tlv(0xa2, govde)]), uzak.port, uzak.address);
      console.log(`${new Date().toLocaleTimeString('tr-TR')}  ${ad} (${ip}) soruldu`);
    } catch { /* bozuk paket */ }
  });
  return new Promise((ok, hata) => { s.once('error', hata); s.bind(PORT, ip, () => ok(s)); });
}

const PRT = '1.3.6.1.2.1.43';
const KYO = '1.3.6.1.4.1.1347.42.3.1.2.1.1';
const PANTUM = {
  '1.3.6.1.2.1.1.1.0': { t: 'str', v: 'Pantum BP5100DN Series' },
  '1.3.6.1.2.1.1.2.0': { t: 'oid', v: '1.3.6.1.4.1.40093.1.1' },
  '1.3.6.1.2.1.25.3.2.1.3.1': { t: 'str', v: 'Pantum BP5100DN' },
  [`${PRT}.5.1.1.17.1`]: { t: 'str', v: 'BNZ-PANTUM-0001' },
  [`${PRT}.10.2.1.4.1.1`]: { t: 'cnt', v: 52340 + EK },
  [`${PRT}.11.1.1.6.1.1`]: { t: 'str', v: 'Black Toner Cartridge' },
  [`${PRT}.11.1.1.6.1.2`]: { t: 'str', v: 'Drum Unit' },
  [`${PRT}.11.1.1.8.1.1`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.8.1.2`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.9.1.1`]: { t: 'int', v: 12 },
  [`${PRT}.11.1.1.9.1.2`]: { t: 'int', v: 64 },
  [`${PRT}.12.1.1.4.1.1`]: { t: 'str', v: 'black' },
  '1.3.6.1.2.1.25.3.2.1.5.1': { t: 'int', v: 3 },
  '1.3.6.1.2.1.25.3.5.1.2.1': { t: 'hex', v: '20' }, // toner az
};
const KYOCERA = {
  '1.3.6.1.2.1.1.1.0': { t: 'str', v: 'KYOCERA Document Solutions Printing System' },
  '1.3.6.1.2.1.1.2.0': { t: 'oid', v: '1.3.6.1.4.1.1347.41' },
  '1.3.6.1.2.1.25.3.2.1.3.1': { t: 'str', v: 'TASKalfa 2553ci' },
  [`${PRT}.5.1.1.17.1`]: { t: 'str', v: 'BNZ-KYO-0002' },
  [`${PRT}.10.2.1.4.1.1`]: { t: 'cnt', v: 120000 + 2 * EK },
  [`${PRT}.11.1.1.6.1.1`]: { t: 'str', v: 'Black Toner' },
  [`${PRT}.11.1.1.6.1.2`]: { t: 'str', v: 'Cyan Toner' },
  [`${PRT}.11.1.1.8.1.1`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.8.1.2`]: { t: 'int', v: 100 },
  [`${PRT}.11.1.1.9.1.1`]: { t: 'int', v: 55 },
  [`${PRT}.11.1.1.9.1.2`]: { t: 'int', v: 40 },
  [`${PRT}.12.1.1.4.1.1`]: { t: 'str', v: 'black' },
  [`${PRT}.12.1.1.4.1.2`]: { t: 'str', v: 'cyan' },
  [`${PRT}.12.1.1.4.1.3`]: { t: 'str', v: 'magenta' },
  [`${PRT}.12.1.1.4.1.4`]: { t: 'str', v: 'yellow' },
  '1.3.6.1.2.1.25.3.2.1.5.1': { t: 'int', v: 2 },
  // Kyocera'nın kendi dalı: siyah (kip 1) + renkli (kip 3) = toplam.
  [`${KYO}.1.1`]: { t: 'int', v: 80000 + EK },
  [`${KYO}.1.3`]: { t: 'int', v: 40000 + EK },
};

const acik = [];
for (const [adres, mib, ad] of [[ip(0), PANTUM, 'Pantum BP5100DN'], [ip(1), KYOCERA, 'Kyocera TASKalfa 2553ci']]) {
  try { acik.push(await ajan(adres, mib, ad)); console.log(`✓ ${ad} hazır: ${adres}:${PORT}/udp`); }
  catch (e) { console.log(`✗ ${ad} açılamadı (${adres}:${PORT}): ${e.message}`); }
}
// SNMP'si kapalı yazıcı: yalnız ham baskı kapısı (9100) açık.
const kapali = net.createServer((c) => c.end()).listen(9100, ip(2), () => console.log(`✓ SNMP kapalı yazıcı hazır: ${ip(2)}:9100/tcp (SNMP cevabı yok)`));
kapali.on('error', (e) => console.log('✗ 9100 açılamadı:', e.message));
console.log(`\nSayaçlara eklenen sayfa: ${EK}. Durdurmak için Ctrl+C.\n`);
