/**
 * WHATSAPP CLOUD API — Meta'ya giden her çağrının TEK kapısı.
 *
 * ── NEDEN TEK KAPI ───────────────────────────────────────────────────────
 * Şablon (whatsapp.ts), serbest metin (whatsapp-out.ts) ve süper admin
 * sağlık kontrolü ayrı ayrı fetch yazıyordu: biri mesaj kimliğini (wamid)
 * atıyor, öteki hata kodunu metne gömüyordu. Mesaj kimliği olmadan Meta'nın
 * sonradan gönderdiği "teslim edildi / okundu / iletilemedi" bildirimi hiçbir
 * kayda bağlanamaz; hata kodu olmadan bayiye "(#131030) Recipient phone number
 * not in allowed list" gibi bir İngilizce cümle düşer.
 *
 * ── SÜRÜM ────────────────────────────────────────────────────────────────
 * Graph API sürümleri ~2 yıl yaşar; sabit "v21.0" bir gün sessizce kapanır.
 * WHATSAPP_GRAPH_SURUM ile değiştirilebilir. WHATSAPP_GRAPH_KOK yalnız testte
 * (sahte Meta sunucusu).
 */
export const GRAPH_SURUM = process.env.WHATSAPP_GRAPH_SURUM || 'v23.0';
export const GRAPH = process.env.WHATSAPP_GRAPH_KOK || `https://graph.facebook.com/${GRAPH_SURUM}`;

export type MetaSonuc =
  | { ok: true; id: string | null }
  | { ok: false; error: string; kod: number | null };

/**
 * Meta hata kodları → bayinin anlayacağı cümle. Yalnız sık görülen ve bayinin
 * bir şey yapabileceği kodlar; bilinmeyen kodda Meta'nın kendi mesajı kalır.
 * Kaynak: developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const META_HATALARI: Record<number, { tr: string; en: string }> = {
  0: { tr: 'Meta oturumu doğrulanamadı (erişim jetonu).', en: 'Meta could not authenticate the request (access token).' },
  100: { tr: 'Meta isteği reddetti: telefon numarası kimliği ya da parametre yanlış.', en: 'Meta rejected the request: wrong phone number ID or parameter.' },
  190: { tr: 'WhatsApp erişim jetonunun süresi dolmuş ya da geçersiz. Kalıcı (System User) jeton girilmeli.', en: 'The WhatsApp access token has expired or is invalid. A permanent (System User) token is needed.' },
  368: { tr: 'Meta bu numarayı politika ihlali nedeniyle geçici olarak engelledi.', en: 'Meta has temporarily blocked this number for a policy violation.' },
  130429: { tr: 'Saniyedeki gönderim sınırı aşıldı; biraz sonra tekrar denenir.', en: 'The sending rate limit was hit; it will be retried shortly.' },
  131000: { tr: 'Meta tarafında bilinmeyen bir hata oldu; tekrar deneyin.', en: 'An unknown error occurred at Meta; try again.' },
  131005: { tr: 'Erişim jetonunun bu işlem için izni yok (whatsapp_business_messaging).', en: 'The access token lacks permission for this (whatsapp_business_messaging).' },
  131008: { tr: 'Zorunlu bir alan eksik.', en: 'A required field is missing.' },
  131009: { tr: 'Bir alanın değeri geçersiz.', en: 'A field has an invalid value.' },
  131026: { tr: 'Mesaj iletilemedi: numara WhatsApp kullanmıyor olabilir ya da uygulaması çok eski.', en: 'Message undeliverable: the number may not use WhatsApp or its app is too old.' },
  131030: { tr: 'Bu numara test listesinde değil. Meta test numarası yalnız kayıtlı (en çok 5) numaraya gönderir: WhatsApp → API Kurulumu → "Kime" listesine ekleyin.', en: 'This number is not on the test list. A Meta test number only sends to registered numbers (up to 5): add it under WhatsApp → API Setup → "To".' },
  131031: { tr: 'WhatsApp işletme hesabı kilitlendi; Meta İşletme Yöneticisi\'ne bakın.', en: 'The WhatsApp Business account is locked; check Meta Business Manager.' },
  131042: { tr: 'Meta ödeme yöntemi sorunu: İşletme hesabına geçerli bir ödeme yöntemi ekleyin.', en: 'Meta payment issue: add a valid payment method to the business account.' },
  131045: { tr: 'Numara kaydı eksik (sertifika); Meta\'da numarayı yeniden kaydedin.', en: 'The phone number registration is incomplete; re-register it at Meta.' },
  131047: { tr: 'Müşterinin son mesajından 24 saat geçti: serbest mesaj gönderilemez, onaylı şablon gerekir.', en: 'More than 24 hours since the customer’s last message: free text cannot be sent, an approved template is needed.' },
  131049: { tr: 'Meta bu mesajı iletmedi (müşteri son günlerde çok mesaj aldı). Birkaç gün sonra tekrar denenebilir.', en: 'Meta did not deliver this message (the customer got many messages recently). It can be retried in a few days.' },
  131050: { tr: 'Müşteri bu işletmeden pazarlama mesajı almayı durdurmuş.', en: 'The customer has stopped marketing messages from this business.' },
  131051: { tr: 'Bu mesaj türü desteklenmiyor.', en: 'This message type is not supported.' },
  131052: { tr: 'Müşterinin gönderdiği medya indirilemedi.', en: 'The customer’s media could not be downloaded.' },
  131053: { tr: 'Medya yüklenemedi.', en: 'The media could not be uploaded.' },
  131056: { tr: 'Aynı numaraya kısa sürede çok mesaj gitti; biraz bekleyin.', en: 'Too many messages to the same number in a short time; wait a little.' },
  132000: { tr: 'Şablondaki değişken sayısı gönderilenle uyuşmuyor.', en: 'The number of template variables does not match.' },
  132001: { tr: 'Şablon Meta\'da yok ya da bu dilde (tr) henüz onaylanmadı.', en: 'The template does not exist at Meta or is not approved yet in this language (tr).' },
  132005: { tr: 'Şablon metni değişkenlerle birlikte çok uzun.', en: 'The template text is too long with its variables.' },
  132007: { tr: 'Şablon içeriği Meta politikasına uymuyor.', en: 'The template content violates Meta policy.' },
  132012: { tr: 'Şablon değişkeninin biçimi yanlış.', en: 'A template variable has the wrong format.' },
  132015: { tr: 'Şablon düşük kalite nedeniyle duraklatıldı.', en: 'The template was paused for low quality.' },
  132016: { tr: 'Şablon kalıcı olarak devre dışı bırakıldı.', en: 'The template has been permanently disabled.' },
  133010: { tr: 'Telefon numarası Cloud API\'ye kayıtlı değil (register adımı yapılmamış).', en: 'The phone number is not registered with the Cloud API (register step missing).' },
  135000: { tr: 'Meta bilinmeyen bir parametre hatası verdi.', en: 'Meta returned a generic parameter error.' },
};

/** Kod + Meta'nın ham mesajı → gösterilecek cümle (bilinmeyen kodda ham mesaj kalır). */
export function waHataMetni(kod: number | null | undefined, ham?: string | null, dil: 'tr' | 'en' = 'tr'): string {
  const bilinen = kod != null ? META_HATALARI[kod] : undefined;
  if (bilinen) return `${bilinen[dil]}${kod ? ` (#${kod})` : ''}`;
  return (ham || (dil === 'en' ? 'Unknown WhatsApp error' : 'Bilinmeyen WhatsApp hatası')) + (kod ? ` (#${kod})` : '');
}

/** POST {GRAPH}/{yol} — mesaj gönderimi; başarıda Meta mesaj kimliği (wamid) döner. */
export async function metaPost(yol: string, govde: unknown): Promise<MetaSonuc> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, error: waHataMetni(190, 'WHATSAPP_TOKEN yok'), kod: 190 };
  try {
    const res = await fetch(`${GRAPH}/${yol}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: j?.messages?.[0]?.id ?? null };
    const kod = typeof j?.error?.code === 'number' ? j.error.code : null;
    return { ok: false, error: waHataMetni(kod, j?.error?.error_data?.details || j?.error?.message || `HTTP ${res.status}`), kod };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ağ hatası', kod: null };
  }
}

/** GET {GRAPH}/{yol} — sağlık kontrolü ve medya bilgisi için. */
export async function metaGet(yol: string): Promise<{ ok: true; veri: any } | { ok: false; error: string; kod: number | null }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, error: waHataMetni(190, 'WHATSAPP_TOKEN yok'), kod: 190 };
  try {
    const res = await fetch(`${GRAPH}/${yol}`, { headers: { Authorization: `Bearer ${token}` } });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, veri: j };
    const kod = typeof j?.error?.code === 'number' ? j.error.code : null;
    return { ok: false, error: waHataMetni(kod, j?.error?.message || `HTTP ${res.status}`), kod };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ağ hatası', kod: null };
  }
}
