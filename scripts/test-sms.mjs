// Netgsm SMS hızlı testi — Coolify'dan BAĞIMSIZ, tek komutla doğrula.
// Kullanım (PowerShell):
//   $env:NETGSM_USER="..."; $env:NETGSM_PASS="..."; $env:NETGSM_HEADER="ONAYLI_BASLIK"; node scripts/test-sms.mjs 5XXXXXXXXX
// (Numarayı KENDİ telefonun yap; mesaj sana gelmeli.)

const target = process.argv[2];
const user = process.env.NETGSM_USER, pass = process.env.NETGSM_PASS, header = process.env.NETGSM_HEADER;

if (!user || !pass || !header) {
  console.error('❌ NETGSM_USER / NETGSM_PASS / NETGSM_HEADER ortam değişkenleri gerekli.');
  process.exit(1);
}
if (!target) {
  console.error('❌ Kullanım: node scripts/test-sms.mjs 5XXXXXXXXX');
  process.exit(1);
}

const no = target.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
if (!/^5\d{9}$/.test(no)) {
  console.error(`❌ Geçersiz numara: "${target}" → "${no}" (5XXXXXXXXX bekleniyor)`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const msg = 'Nexus Servis test mesaji. SMS entegrasyonu calisiyor.';
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<mainbody><header>` +
  `<company dil="TR">Netgsm</company>` +
  `<usercode>${esc(user)}</usercode>` +
  `<password>${esc(pass)}</password>` +
  `<type>n:n</type>` +
  `<msgheader>${esc(header)}</msgheader>` +
  `<encoding>TR</encoding>` +
  `</header><body><mp><msg><![CDATA[${msg}]]></msg><no>${no}</no></mp></body></mainbody>`;

const CODES = {
  '20': 'Mesaj metni/karakter veya POST sorunu',
  '30': 'Geçersiz kullanıcı/şifre VEYA bu hesapta API erişimi kapalı',
  '40': 'Gönderici başlığı (msgheader) hatalı/ONAYSIZ',
  '50': 'İYS kontrollü — abonelik/izin sorunu',
  '51': 'İYS: bu hesaba ait İYS markası yok',
  '70': 'Hatalı/eksik parametre',
  '80': 'Gönderim sınırı aşıldı',
  '85': 'Mükerrer gönderim sınırı',
};

console.log(`→ ${no} numarasına test SMS gönderiliyor (başlık: ${header})...`);
try {
  const res = await fetch('https://api.netgsm.com.tr/sms/send/xml', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
    body: xml,
  });
  const text = (await res.text()).trim();
  const code = text.split(/\s+/)[0];
  console.log('HTTP:', res.status, '| Netgsm yanıt:', text);
  if (code === '00') {
    console.log('✅ BAŞARILI (00) — SMS kuyruğa alındı. Telefonu kontrol et.');
  } else {
    console.log(`❌ HATA kodu: ${code} → ${CODES[code] || 'Bilinmeyen kod (Netgsm hata tablosuna bak)'}`);
  }
} catch (e) {
  console.error('❌ Ağ/bağlantı hatası:', e?.message);
  process.exit(1);
}
