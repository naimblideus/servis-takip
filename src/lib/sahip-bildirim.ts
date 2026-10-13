/**
 * SAHİBE BİLDİRİM — platform sahibine (süper admin) e-posta.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Siteden açılan deneme hesabı ve iletişim formu yalnız süper admin →
 * Talepler ekranına düşüyordu. Kimse sürekli o ekrana bakamaz; bakılmayan
 * kayıt da aynı gün aranmaz ve deneme sessizce ölür. Artık her yeni kayıt
 * anında, her sabah da bir özet (lib/sahip-ozet.ts) e-postayla gelir.
 *
 * ── NASIL ────────────────────────────────────────────────────────────────
 * Gmail API, yalnız `gmail.send` izniyle: platform sahibinin kendi Gmail
 * hesabından kendisine. Ayrı bir e-posta sunucusu ya da üçüncü taraf servis
 * yok; telefondaki Gmail bildirimi anında düşer. Anahtar bir kez alınır:
 *   node scripts/gmail-bildirim-yetki.mjs  → satırlar panoya → Coolify.
 *
 * Ortam: BILDIRIM_GMAIL_CLIENT_ID, BILDIRIM_GMAIL_CLIENT_SECRET,
 *        BILDIRIM_GMAIL_REFRESH_TOKEN, BILDIRIM_EPOSTA (alıcı).
 * Tanımlı değilse hiçbir şey gönderilmez ve hiçbir akış durmaz.
 */

const tokenAdresi = () => process.env.BILDIRIM_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const gmailKoku = () => process.env.BILDIRIM_GMAIL_KOK || 'https://gmail.googleapis.com';

/** Gmail ile gönderim mümkün mü (alıcıdan bağımsız: şifre sıfırlama da bunu kullanır). */
export function gmailAyarli(): boolean {
  return Boolean(
    process.env.BILDIRIM_GMAIL_CLIENT_ID && process.env.BILDIRIM_GMAIL_CLIENT_SECRET
    && process.env.BILDIRIM_GMAIL_REFRESH_TOKEN,
  );
}

export function bildirimAyarli(): boolean {
  return gmailAyarli() && Boolean(process.env.BILDIRIM_EPOSTA);
}

/** Panel bağlantıları için sitenin adresi. */
export function siteAdresi(): string {
  return (process.env.NEXTAUTH_URL || 'https://nextusservis.com').replace(/\/+$/, '');
}

let jeton: { deger: string; bitis: number } | null = null;

/** Testler için: önbellekteki erişim jetonunu unut. */
export function jetonuUnut(): void {
  jeton = null;
}

async function erisimJetonu(): Promise<string> {
  if (jeton && Date.now() < jeton.bitis) return jeton.deger;
  const y = await fetch(tokenAdresi(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.BILDIRIM_GMAIL_CLIENT_ID ?? '',
      client_secret: process.env.BILDIRIM_GMAIL_CLIENT_SECRET ?? '',
      refresh_token: process.env.BILDIRIM_GMAIL_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  });
  const v = (await y.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!y.ok || !v.access_token) throw new Error(`Google jetonu alınamadı (${v.error ?? y.status})`);
  jeton = { deger: v.access_token, bitis: Date.now() + Math.max(60, (v.expires_in ?? 3600) - 120) * 1000 };
  return jeton.deger;
}

const b64 = (metin: string) => Buffer.from(metin, 'utf8').toString('base64');

/** Başlık enjeksiyonu olmasın: alıcı ve konu tek satır. */
const tekSatir = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

/**
 * Platform sahibine düz metin e-posta. Boş (null) satırlar atlanır.
 * Asla fırlatmaz: bildirim, kaydı ya da işi durdurmamalı.
 */
export async function sahibeEposta(konu: string, satirlar: (string | null | undefined)[]): Promise<'gonderildi' | 'kapali' | 'hata'> {
  if (!bildirimAyarli()) return 'kapali';
  return epostaGonder(process.env.BILDIRIM_EPOSTA ?? '', konu, satirlar);
}

/**
 * Herhangi bir alıcıya düz metin e-posta (platform sahibinin Gmail'inden).
 * Şu an tek kullanıcısı şifre sıfırlama bağlantısı. Asla fırlatmaz.
 */
export async function epostaGonder(aliciHam: string, konu: string, satirlar: (string | null | undefined)[]): Promise<'gonderildi' | 'kapali' | 'hata'> {
  if (!gmailAyarli()) return 'kapali';
  try {
    const alici = tekSatir(aliciHam);
    const govde = b64(satirlar.filter((s): s is string => s !== null && s !== undefined).join('\r\n')).match(/.{1,76}/g)?.join('\r\n') ?? '';
    const ileti = [
      `To: ${alici}`,
      `Subject: =?UTF-8?B?${b64(tekSatir(konu))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      govde,
    ].join('\r\n');
    const gonder = async () => fetch(`${gmailKoku()}/gmail/v1/users/me/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await erisimJetonu()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(ileti, 'utf8').toString('base64url') }),
      signal: AbortSignal.timeout(10000),
    });
    let y = await gonder();
    // Jeton süresinden önce iptal edilmiş olabilir: bir kez tazeleyip dene.
    if (y.status === 401) { jeton = null; y = await gonder(); }
    if (!y.ok) throw new Error(`Gmail ${y.status}`);
    return 'gonderildi';
  } catch (e) {
    console.error('[bildirim] e-posta gönderilemedi:', e instanceof Error ? e.message : e);
    return 'hata';
  }
}

/** "05321112233" → WhatsApp sohbet bağlantısı; cep değilse null. */
export function whatsappBaglantisi(telefon: string | null | undefined): string | null {
  const d = String(telefon ?? '').replace(/\D/g, '');
  const n = d.length === 11 && d.startsWith('05') ? '9' + d : d.length === 12 && d.startsWith('905') ? d : null;
  return n ? `https://wa.me/${n}` : null;
}
