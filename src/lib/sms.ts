// Toplu SMS — Netgsm "n:n" (kişiye özel mesaj) XML API.
// Tek tıkla seçili herkese ayrı ayrı (kişiselleştirilmiş) SMS gönderir.
// Env (platform geneli): NETGSM_USER, NETGSM_PASS, NETGSM_HEADER (Netgsm'de ONAYLI gönderici başlığı).
const NETGSM_URL = 'https://api.netgsm.com.tr/sms/send/xml';

export interface SmsItem { phone: string; message: string; }
export interface SmsResult { ok: boolean; code: string; jobId?: string; sent: number; error?: string; }

const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Netgsm için 10 haneli yerel form (5XXXXXXXXX). Geçersizse null. */
export function netgsmPhone(raw: string | null | undefined): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('90')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? d : null;
}

export function smsConfigured(): boolean {
  return !!(process.env.NETGSM_USER && process.env.NETGSM_PASS && process.env.NETGSM_HEADER);
}

export async function sendBulkSms(items: SmsItem[]): Promise<SmsResult> {
  const user = process.env.NETGSM_USER, pass = process.env.NETGSM_PASS, header = process.env.NETGSM_HEADER;
  if (!user || !pass || !header) return { ok: false, code: 'NO_CONFIG', sent: 0, error: 'SMS sağlayıcı ayarlı değil (NETGSM_*).' };

  const valid = items
    .map(i => ({ no: netgsmPhone(i.phone), msg: i.message }))
    .filter((i): i is { no: string; msg: string } => !!i.no);
  if (!valid.length) return { ok: false, code: 'NO_VALID', sent: 0, error: 'Geçerli numara yok.' };

  const mp = valid.map(v => `<mp><msg><![CDATA[${v.msg}]]></msg><no>${v.no}</no></mp>`).join('');
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mainbody><header>` +
    `<company dil="TR">Netgsm</company>` +
    `<usercode>${esc(user)}</usercode>` +
    `<password>${esc(pass)}</password>` +
    `<type>n:n</type>` +
    `<msgheader>${esc(header)}</msgheader>` +
    `<encoding>TR</encoding>` +
    `</header><body>${mp}</body></mainbody>`;

  let res: Response;
  try {
    res = await fetch(NETGSM_URL, { method: 'POST', headers: { 'Content-Type': 'application/xml; charset=UTF-8' }, body: xml });
  } catch (e: any) {
    return { ok: false, code: 'NETWORK', sent: 0, error: e?.message || 'Ağ hatası' };
  }
  const text = (await res.text()).trim();
  const code = text.split(/\s+/)[0];
  // Netgsm: "00 <bulkid>" = başarılı; 2 haneli diğer kodlar = hata (20/30/40/50/51/70/80/85...)
  if (code === '00') return { ok: true, code, jobId: text.split(/\s+/)[1], sent: valid.length };
  return { ok: false, code, sent: 0, error: `Netgsm hata kodu: ${code}` };
}
