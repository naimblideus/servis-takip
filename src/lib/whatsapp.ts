// Toplu WhatsApp — Meta WhatsApp Cloud API, ONAYLI şablon (template) ile.
// 24s penceresi dışındaki proaktif mesajlar için Meta ONAYLI şablon ZORUNLUDUR (serbest metin gönderilemez).
// Env: WHATSAPP_TOKEN (kalıcı erişim token), WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE (şablon adı), WHATSAPP_LANG (örn 'tr').
const GRAPH = 'https://graph.facebook.com/v21.0';

export interface WaItem { phone: string; params: string[]; } // params = şablon body değişkenleri {{1}},{{2}}...
export interface WaResult { ok: boolean; sent: number; failed: number; skippedInvalid: number; errors: string[] }

export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE);
}

/** E.164 — Cloud API ülke koduyla ister: 90XXXXXXXXXX. Geçersizse null. */
export function waApiPhone(raw: string | null | undefined): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return /^90\d{10}$/.test(d) ? d : null;
}

async function sendOne(phone: string, params: string[]): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN!, phoneId = process.env.WHATSAPP_PHONE_ID!;
  const template = process.env.WHATSAPP_TEMPLATE!, lang = process.env.WHATSAPP_LANG || 'tr';
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: params.length ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: p })) }] : [],
    },
  };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const e: any = await res.json().catch(() => ({}));
    return { ok: false, error: e?.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ağ hatası' };
  }
}

export async function sendBulkWhatsApp(items: WaItem[]): Promise<WaResult> {
  if (!waConfigured()) return { ok: false, sent: 0, failed: 0, skippedInvalid: items.length, errors: ['WhatsApp API ayarlı değil (WHATSAPP_*).'] };

  const valid = items
    .map(i => ({ no: waApiPhone(i.phone), params: i.params }))
    .filter((i): i is { no: string; params: string[] } => !!i.no);
  const skippedInvalid = items.length - valid.length;

  let sent = 0, failed = 0;
  const errors: string[] = [];
  const BATCH = 10; // rate-limit dostu küçük gruplar
  for (let i = 0; i < valid.length; i += BATCH) {
    const chunk = valid.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(c => sendOne(c.no, c.params)));
    for (const r of results) {
      if (r.ok) sent++;
      else { failed++; if (r.error && errors.length < 5) errors.push(r.error); }
    }
  }
  return { ok: sent > 0, sent, failed, skippedInvalid, errors };
}
