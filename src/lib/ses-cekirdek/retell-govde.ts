/**
 * SES ÇEKİRDEĞİ — Retell gövdeleri, araç tanımı kalıpları, kurulum kapıları.
 *
 * Alan bilmez: komut metnini, araç adlarını ve cümleleri alan (Servis,
 * Frigora, Klinik) verir; burası yalnız Retell'in beklediği biçimi ve
 * bütün ürünlerde aynı olması gereken güvenli varsayılanları kurar.
 * Bu dosya SAFtır.
 */
import { e164TR, son10 } from './cagri';

/** Ses kayıtlarının Retell'de kalacağı gün (KVKK). Boş bırakmak süresiz demek. */
export const SES_SAKLAMA_GUN = 30;
/** Sessiz hatta ne kadar beklenir — Retell varsayılanı 10 dk, fatura sızdırır. */
export const SESSIZLIK_MS = 25_000;
/** Çağrı tavanı — varsayılan 1 saat; takılan çağrı pahalıya patlar. */
export const MAKS_CAGRI_MS = 12 * 60_000;
/** Araç cevabı bu sürede gelmezse Retell hata sayar (varsayılanı 120 sn). */
export const ARAC_ZAMAN_ASIMI_MS = 8_000;
/** Araç ucunun beklediği sır başlığı. Sorgu dizesinden sır KABUL EDİLMEZ (loglara düşer). */
export const SIR_BASLIGI = 'x-nextus-tool-secret';
/** Sırrın en kısa uzunluğu. Altındaysa uç tamamen kapalıdır. */
export const SIR_EN_AZ = 16;
/**
 * Araç parametresi olarak KULLANILAMAYACAK adlar. Model bu adlarla bir
 * değer doldurursa gövdedeki gerçek çağrı alanlarıyla karışabilirdi
 * (ör. args.from_number ile kimlik taklidi).
 */
export const YASAK_PARAMETRELER = ['call', 'name', 'agent_id', 'from_number', 'to_number', 'call_id'];

export type RetellArac = Record<string, unknown>;

/** Bizim araç ucumuzu çağıran araç. Sır BAŞLIKTA. */
export function ozelArac(p: {
  ad: string;
  aciklama: string;
  url: string;
  sir: string;
  parametreler: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}): RetellArac {
  return {
    type: 'custom',
    name: p.ad,
    description: p.aciklama,
    url: p.url,
    method: 'POST',
    headers: { [SIR_BASLIGI]: p.sir },
    parameters: p.parametreler,
    // Araç ~100 ms'de döner; "bir saniye bakıyorum" dedirtmek cevabı geciktirir.
    speak_during_execution: false,
    speak_after_execution: true,
    timeout_ms: ARAC_ZAMAN_ASIMI_MS,
  };
}

/** Sabit numaraya soğuk aktarma. Numara E.164 (+ ile) gider. */
export function aktarmaAraci(numara: string, p: { ad: string; aciklama: string }): RetellArac {
  return {
    type: 'transfer_call',
    name: p.ad,
    description: p.aciklama,
    transfer_destination: { type: 'predefined', number: numara.startsWith('+') ? numara : `+${numara}` },
    transfer_option: { type: 'cold_transfer' },
  };
}

export function bitirmeAraci(p: { ad: string; aciklama: string }): RetellArac {
  return { type: 'end_call', name: p.ad, description: p.aciklama };
}

/** Retell LLM kaydının gövdesi (komut metni ve araçlar orada durur). Açılış modele bırakılmaz. */
export function llmGovdesi(g: { prompt: string; araclar: RetellArac[]; acilis: string }) {
  return {
    general_prompt: g.prompt,
    general_tools: g.araclar,
    start_speaker: 'agent',
    begin_message: g.acilis,
  };
}

/**
 * Ajan ayarı. Retell varsayılanları bize açık: sessiz hatta 10 dk bekleme,
 * 1 saatlik çağrı tavanı, Los Angeles saati, süresiz kayıt saklama. Hepsi
 * burada kapatılır. `webhook_url` AÇIKÇA bizim uca verilir: verilmezse
 * Retell hesap düzeyindeki adresi kullanır ve aynı hesaptaki başka bir
 * ürüne görüşmeler gider. Yapay ortam sesi bilerek YOK (insan taklidi).
 */
export function ajanGovdesi(g: { webhookUrl: string; dil?: string; saatDilimi?: string; saklamaGun?: number }) {
  return {
    language: g.dil ?? 'tr-TR',
    end_call_after_silence_ms: SESSIZLIK_MS,
    max_call_duration_ms: MAKS_CAGRI_MS,
    timezone: g.saatDilimi ?? 'Europe/Istanbul',
    data_storage_retention_days: g.saklamaGun ?? SES_SAKLAMA_GUN,
    webhook_url: g.webhookUrl,
    webhook_events: ['call_ended'],
  };
}

/**
 * Araç ucunun DIŞARIDAN erişilen tabanı. Retell bizi internetten çağırır;
 * localhost ya da http adresle kurulan ajan aracı hiç çağıramaz. Sabit bir
 * adrese DÜŞÜLMEZ (geliştirme ortamındaki ajan canlıyı çağırırdı) ve http
 * adres https'e çevrilmez (yanlış ayarı saklardı).
 */
export function aracTabani(env: { VOICE_TOOL_BASE_URL?: string; NEXTAUTH_URL?: string }): string | null {
  const aday = (env.VOICE_TOOL_BASE_URL || '').trim() || (env.NEXTAUTH_URL || '').trim();
  if (!aday) return null;
  const t = aday.replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+/i.test(t)) return null;
  if (/^https:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(t) || /\.local(\/|$|:)/i.test(t)) return null;
  return t;
}

export function sirYeterli(sir: unknown): sir is string {
  return typeof sir === 'string' && sir.length >= SIR_EN_AZ;
}

/** Kiracı adı komut metnine girer: tırnak ve satır sonu temizlenir, kısaltılır. */
export function guvenliAd(s: unknown, yedek: string, n = 60): string {
  const t = String(s ?? '').replace(/[\r\n"`{}<>\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  return t || yedek;
}

/** Asistan adı: yalnız harf ve boşluk, 2-20 karakter; değilse yedek. */
export function asistanAdiTemizle(s: unknown, yedek = 'Deniz'): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return /^[\p{L} ]{2,20}$/u.test(t) ? t : yedek;
}

export type KurulumKodu =
  | 'ANAHTAR_YOK'
  | 'ARAC_ADRESI_YOK'
  | 'SIR_YOK'
  | 'AKTARMA_YOK'
  | 'SES_KIMLIGI_YOK'
  | 'HAT_YOK'
  | 'KIRACI_YOK'
  | 'RETELL_HATASI';

export interface KurulumOrtami {
  RETELL_API_KEY?: string;
  RETELL_VOICE_ID?: string;
  VOICE_TOOL_SECRET?: string;
  VOICE_TOOL_BASE_URL?: string;
  NEXTAUTH_URL?: string;
}

/**
 * Retell'e gitmeden önceki kapılar. Hepsi fail-closed: biri eksikse hiçbir
 * istek gönderilmez. AKTARMA zorunlu: bot kapalıyken hattın açık kalmasının
 * tek yolu aktarmadır. Aktarma numarası ajan hattıyla aynı olamaz (döngü).
 */
export function kurulumKapisi(
  env: KurulumOrtami,
  a: { aktarmaTelefonu: string | null; hatNumarasi: string | null },
  s: { yeniAjan: boolean; hatGerekli: boolean },
): KurulumKodu | null {
  if (!env.RETELL_API_KEY) return 'ANAHTAR_YOK';
  if (!aracTabani(env)) return 'ARAC_ADRESI_YOK';
  if (!sirYeterli(env.VOICE_TOOL_SECRET)) return 'SIR_YOK';
  const aktarma = e164TR(a.aktarmaTelefonu);
  if (!aktarma) return 'AKTARMA_YOK';
  if (a.hatNumarasi && son10(aktarma) === son10(a.hatNumarasi)) return 'AKTARMA_YOK';
  if (s.yeniAjan && !env.RETELL_VOICE_ID) return 'SES_KIMLIGI_YOK';
  if (s.hatGerekli && !a.hatNumarasi) return 'HAT_YOK';
  return null;
}
