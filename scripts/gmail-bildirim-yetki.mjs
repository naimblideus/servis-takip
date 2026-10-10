/* Sahibe bildirim e-postası (lib/sahip-bildirim.ts) için Gmail bağlantısı — bir kez çalıştırılır.

   Kullanım (kendi bilgisayarında):
     node scripts/gmail-bildirim-yetki.mjs                       İndirilenler'deki en yeni client_secret_*.json
     node scripts/gmail-bildirim-yetki.mjs <client_secret.json>

   Google Cloud'daki "Desktop" OAuth istemcisi yeter (kişisel sitedeki takvim
   bağlantısında indirilen dosya). Tarayıcı açılır, izin verilir; YALNIZ
   "e-posta gönder" izni istenir (okuma yok, takvim yok). Bağlantı kanıtı
   olarak kendine bir deneme e-postası gönderilir. Coolify'a yapıştırılacak
   satırlar PANOYA kopyalanır; gizli değerler ekrana yazılmaz. */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec, spawn } from 'node:child_process';

const PORT = 8098;
const YONLENDIRME = `http://localhost:${PORT}`;
const KAPSAMLAR = ['https://www.googleapis.com/auth/gmail.send', 'openid', 'email'].join(' ');

function istemciBilgisi(dosya) {
  if (!dosya) {
    const klasor = path.join(os.homedir(), 'Downloads');
    const adaylar = fs.existsSync(klasor)
      ? fs.readdirSync(klasor).filter((f) => /^client_secret.*\.json$/i.test(f))
          .map((f) => path.join(klasor, f))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      : [];
    dosya = adaylar[0];
    if (!dosya) return null;
  }
  const v = JSON.parse(fs.readFileSync(dosya, 'utf8'));
  const k = v.installed || v.web || {};
  if (!k.client_id || !k.client_secret) throw new Error('Dosyada client_id / client_secret yok: ' + dosya);
  return { id: k.client_id, gizli: k.client_secret, kaynak: path.basename(dosya) };
}

function panoyaKopyala(metin) {
  const komut = process.platform === 'win32' ? ['clip', []]
    : process.platform === 'darwin' ? ['pbcopy', []]
    : ['xclip', ['-selection', 'clipboard']];
  return new Promise((coz) => {
    try {
      const s = spawn(komut[0], komut[1], { stdio: ['pipe', 'ignore', 'ignore'] });
      s.on('error', () => coz(false));
      s.on('close', (kod) => coz(kod === 0));
      s.stdin.end(metin);
    } catch { coz(false); }
  });
}

const hesapEpostasi = (idJeton) => {
  try { return JSON.parse(Buffer.from(String(idJeton).split('.')[1], 'base64url').toString('utf8')).email || null; }
  catch { return null; }
};

const b64 = (m) => Buffer.from(m, 'utf8').toString('base64');

async function denemeEpostasi(erisim, kime) {
  const ileti = [
    `To: ${kime}`,
    `Subject: =?UTF-8?B?${b64('Nextus Servis bildirimleri bağlandı')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64('Bu e-posta geldiyse bağlantı çalışıyor.\r\n\r\nCoolify\'a satırları yapıştırıp Redeploy edince:\r\n· siteden açılan her deneme hesabı ve gelen her talep anında,\r\n· her sabah 08:30\'da "bugün kimi aramalı" özeti\r\nbu adrese gelecek.'),
  ].join('\r\n');
  const y = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + erisim, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(ileti, 'utf8').toString('base64url') }),
  });
  return y.ok;
}

let istemci;
try { istemci = istemciBilgisi(process.argv[2]); }
catch (h) { console.error(h.message); process.exit(1); }
if (!istemci) {
  console.error('client_secret_*.json bulunamadı. Google Cloud Console → APIs & Services → Credentials →');
  console.error('"Desktop" istemcinin yanındaki indir düğmesi; sonra bu komutu tekrar çalıştırın.');
  process.exit(1);
}

const izinAdresi = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: istemci.id, redirect_uri: YONLENDIRME, response_type: 'code',
  scope: KAPSAMLAR, access_type: 'offline', prompt: 'consent',
});

const SAYFA = (baslik, alt, renk) => `<!doctype html><meta charset="utf-8"><title>${baslik}</title>
<body style="font-family:system-ui;background:#0b0f17;color:#e6ecf5;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h1 style="color:${renk}">${baslik}</h1><p>${alt}</p></div>`;

const sunucu = http.createServer(async (istek, cevap) => {
  const adres = new URL(istek.url, YONLENDIRME);
  const kod = adres.searchParams.get('code');
  const hata = adres.searchParams.get('error');
  if (hata) {
    cevap.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    cevap.end(SAYFA('İzin verilmedi', 'Pencereyi kapatıp tekrar deneyebilirsiniz.', '#E5876A'));
    console.error('\nİzin reddedildi:', hata);
    sunucu.close(); process.exit(1);
  }
  if (!kod) { cevap.writeHead(204); cevap.end(); return; }
  try {
    const y = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: kod, client_id: istemci.id, client_secret: istemci.gizli, redirect_uri: YONLENDIRME, grant_type: 'authorization_code' }),
    });
    const v = await y.json();
    if (!v.refresh_token) throw new Error('Google yenileme jetonu vermedi (' + (v.error || y.status) + ').');
    if (!String(v.scope || '').includes('gmail.send')) throw new Error('E-posta gönderme izni verilmedi; izin ekranında kutuyu işaretleyin.');
    const eposta = hesapEpostasi(v.id_token);
    const deneme = eposta ? await denemeEpostasi(v.access_token, eposta) : false;

    cevap.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    cevap.end(SAYFA('Bağlandı', 'Bu pencereyi kapatabilirsiniz. Gerisi terminalde.', '#3DB8BC'));
    sunucu.close();

    const satirlar = [
      `BILDIRIM_GMAIL_CLIENT_ID=${istemci.id}`,
      `BILDIRIM_GMAIL_CLIENT_SECRET=${istemci.gizli}`,
      `BILDIRIM_GMAIL_REFRESH_TOKEN=${v.refresh_token}`,
      eposta ? `BILDIRIM_EPOSTA=${eposta}` : null,
    ].filter(Boolean).join('\n') + '\n';

    console.log('\n=== GMAIL BAĞLANDI ===');
    console.log('Hesap:          ' + (eposta || '(e-posta okunamadı — BILDIRIM_EPOSTA satırını elle ekleyin)'));
    console.log('Deneme e-postası: ' + (deneme ? 'gönderildi — gelen kutunuza bakın' : 'GÖNDERİLEMEDİ'));
    if (await panoyaKopyala(satirlar)) {
      console.log('\nCoolify satırları PANOYA kopyalandı (gizli değerler ekrana yazılmadı).');
    } else {
      const dosya = path.join(os.homedir(), 'nextus-bildirim-ortam.txt');
      fs.writeFileSync(dosya, satirlar, { mode: 0o600 });
      console.log('\nPanoya kopyalanamadı; satırlar şu dosyada: ' + dosya + ' — yapıştırdıktan sonra SİLİN.');
    }
    console.log('\nŞimdi: Coolify → servis-takip → Environment Variables → Developer view → en alta yapıştır → Save → Redeploy.');
    process.exit(0);
  } catch (h) {
    cevap.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    cevap.end(SAYFA('Hata', String(h.message || h), '#E5876A'));
    console.error('\nHATA:', h.message || h);
    sunucu.close(); process.exit(1);
  }
});

sunucu.listen(PORT, () => {
  console.log('Google istemcisi: ' + istemci.kaynak);
  console.log('\nTarayıcı açılıyor. Google hesabınızla izin verin (yalnız e-posta gönderme).');
  console.log('Açılmazsa şu adresi elle açın:\n\n' + izinAdresi + '\n');
  const ac = process.platform === 'win32' ? `start "" "${izinAdresi}"` : process.platform === 'darwin' ? `open "${izinAdresi}"` : `xdg-open "${izinAdresi}"`;
  exec(ac);
});
