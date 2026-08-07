/**
 * WhatsApp Cloud API — GİDEN taraf (serbest metin + medya indirme).
 *
 * Şablonlu toplu gönderim src/lib/whatsapp.ts içindedir. Burası farklı:
 * müşteri BİZE yazdıktan sonraki 24 saatlik "müşteri hizmetleri penceresi"nde
 * serbest metin gönderilebilir ve Meta bunu 1 Temmuz 2025'ten beri ÜCRETLENDİRMEZ.
 * Yani otomatik cevaplar bedavadır; şablon onayı da gerekmez.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';

export function waOutConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/**
 * 24 saatlik pencere içinde serbest metin gönder.
 * Pencere kapalıysa Meta hata döner — bu beklenen durumdur, sessizce false döneriz.
 */
export async function sendText(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!waOutConfigured()) return { ok: false, error: 'WhatsApp giden ayarlı değil (WHATSAPP_TOKEN/PHONE_ID)' };
  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        // preview_url kapalı: müşteriye giden mesajda link önizlemesi istemiyoruz
        text: { preview_url: false, body: body.slice(0, 4000) },
      }),
    });
    if (res.ok) return { ok: true };
    const e: any = await res.json().catch(() => ({}));
    return { ok: false, error: e?.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ağ hatası' };
  }
}

/**
 * Medya indir — SADECE bayi ekranda "göster" dediğinde çağrılır.
 *
 * Bilerek otomatik indirmiyoruz: müşteri fotoğrafları kişisel veridir ve her geleni
 * sunucuya çekmek hem KVKK yükü hem gereksiz disk/bant maliyetidir. Meta medyayı
 * kendi tarafında tutar; biz yalnızca kimliğini saklarız.
 *
 * İki adımlıdır: önce kimlikten geçici URL alınır, sonra o URL token ile indirilir.
 */
export async function downloadMedia(
  mediaId: string,
): Promise<{ ok: true; buffer: Buffer; contentType: string } | { ok: false; error: string }> {
  if (!waOutConfigured()) return { ok: false, error: 'WhatsApp ayarlı değil' };
  const token = process.env.WHATSAPP_TOKEN!;
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) return { ok: false, error: `Medya bilgisi alınamadı (HTTP ${metaRes.status})` };
    const meta: any = await metaRes.json();
    if (!meta?.url) return { ok: false, error: 'Medya adresi yok' };

    // Bu URL yalnızca aynı token ile ve kısa süre indirilebilir.
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) return { ok: false, error: `Medya indirilemedi (HTTP ${binRes.status})` };

    const buffer = Buffer.from(await binRes.arrayBuffer());
    return { ok: true, buffer, contentType: meta.mime_type || binRes.headers.get('content-type') || 'application/octet-stream' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Ağ hatası' };
  }
}

/**
 * Gelen metnin arıza bildirimi olup olmadığını tahmin et.
 *
 * Amaç fiş AÇMAK değil, gelen kutusunda öne çıkarmak. Bu yüzden yanlış pozitif
 * ucuz, yanlış negatif pahalı — liste geniş tutulmuştur.
 * Türkçe'de i/ı ayrımı yüzünden toLowerCase('tr') şart.
 */
const FAULT_WORDS = [
  'arıza', 'ariza', 'bozul', 'bozuk', 'çalışmıyor', 'calismiyor', 'çalışmadı', 'calismadi',
  'sıkış', 'sikis', 'kağıt sıkış', 'toner bitti', 'toner bit', 'yazmıyor', 'yazmiyor',
  'baskı almıyor', 'baski almiyor', 'hata veriyor', 'kırmızı yanıyor', 'kirmizi yaniyor',
  'servis', 'teknik', 'gelebilir mi', 'acil', 'kilitlen', 'açılmıyor', 'acilmiyor',
];

export function looksLikeFaultReport(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLocaleLowerCase('tr');
  return FAULT_WORDS.some((w) => t.includes(w));
}

/**
 * Metinden fiş numarası çıkar.
 *
 * ⚠️ Buradaki kalıp, fiş numarasının GERÇEK biçimine uymak zorunda.
 * Sistem numarayı `SF-{artan sayı}` olarak üretiyor (api/tickets/route.ts,
 * generateTicketNumber): SF-1, SF-760, SF-2847 — yani sabit uzunluk YOK.
 * Önceki kalıp "2026-0143" gibi en az 7 haneli bir yapı arıyordu ve hiçbir
 * gerçek fiş numarasıyla eşleşmiyordu; durum sorgusu bu yüzden hiç çalışmadı.
 *
 * İki kademe:
 *  1. "SF" ön eki varsa kesin sinyaldir — kaç haneli olursa olsun al.
 *  2. Ön ek yoksa yalnızca 3+ haneli tek başına duran sayıyı al. Tek/çift haneli
 *     sayılar günlük cümlelerde çok geçiyor ("2 gündür bozuk") ve yanlış
 *     eşleşme üretirdi.
 *
 * Yanlış pozitif ucuz: bulunan numara O MÜŞTERİNİN fişleri içinde aranıyor,
 * bulunamazsa hiç cevap gitmiyor.
 */
export function extractTicketNumber(text?: string | null): string | null {
  if (!text) return null;
  const onEkli = text.match(/\bSF[-\s]?(\d{1,7})\b/i);
  if (onEkli) return onEkli[1];
  const cıplak = text.match(/\b(\d{3,7})\b/);
  return cıplak ? cıplak[1] : null;
}
