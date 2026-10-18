/**
 * ŞABLONLARI META'YA GÖNDER — süper adminde tek düğme.
 *
 * Platformun tek numarası bütün bayilerin ve bütün mağazaların: şablonlar bir
 * kez onaylanır, sonra açılan her mağaza onları kendiliğinden kullanır. Elle
 * kurulumda 7 şablonun adı, gövdesi ve örnek değerleri Meta ekranına tek tek
 * kopyalanıyordu; bir harf hatası = o mesaj türü hiç gitmez (#132001) ya da
 * değişken sayısı tutmaz (#132000). Burada metin TEK KAYNAKTAN (whatsapp-sablon,
 * whatsapp-sablon-magaza) gider.
 *
 * ── NE YAPAR ─────────────────────────────────────────────────────────────
 * Meta'daki şablon listesi okunur; aynı adla Türkçe sürümü OLAN şablona
 * dokunulmaz (onay sürecindeki ya da onaylı bir şablonu yeniden göndermek
 * onu bozar). Yalnız eksikler POST /{WABA}/message_templates ile açılır,
 * kategori UTILITY, örnek değerlerle. Meta kategoriyi kendisi değiştirmesin
 * diye `allow_category_change` gönderilmez.
 */
import { metaGet, GRAPH } from '@/lib/whatsapp-graph';
import { SABLONLAR, type SablonTanimi } from '@/lib/whatsapp-sablon';
import { MAGAZA_SABLONLARI } from '@/lib/whatsapp-sablon-magaza';

export interface OlusturmaSonucu {
  ad: string;
  sonuc: 'olusturuldu' | 'zaten-var' | 'hata';
  /** Meta'nın verdiği durum (PENDING, APPROVED, REJECTED…), biliniyorsa. */
  durum: string | null;
  hata: string | null;
}

/**
 * Gönderilecek bütün şablonlar. Hatırlatma şablonlarının adı ortamdan
 * değişebiliyor (WHATSAPP_TEMPLATE / _SAYAC): kod o adla gönderdiği için Meta'da
 * o adla açılmalı. Mağaza şablonlarının adı sabit.
 */
export function tumSablonlar(env: { template?: string | null; templateSayac?: string | null } = {}): SablonTanimi[] {
  return [
    { ...SABLONLAR.borc, ad: env.template || SABLONLAR.borc.ad },
    { ...SABLONLAR.sayac, ad: env.templateSayac || SABLONLAR.sayac.ad },
    ...Object.values(MAGAZA_SABLONLARI),
  ];
}

/** Meta'nın şablon açma gövdesi. */
export function olusturmaGovdesi(s: SablonTanimi) {
  return {
    name: s.ad,
    language: s.dil,
    category: s.kategori,
    components: [
      {
        type: 'BODY',
        text: s.metin,
        ...(s.ornek.length ? { example: { body_text: [s.ornek] } } : {}),
      },
    ],
  };
}

export async function eksikSablonlariOlustur(
  wabaId: string,
  env: { template?: string | null; templateSayac?: string | null } = {}
): Promise<{ ok: true; sonuclar: OlusturmaSonucu[] } | { ok: false; hata: string }> {
  const waba = encodeURIComponent(wabaId);
  const liste = await metaGet(`${waba}/message_templates?fields=name,status,language&limit=200`);
  if (!liste.ok) return { ok: false, hata: liste.error };
  const mevcut = (liste.veri?.data ?? []) as { name?: string; status?: string; language?: string }[];

  const sonuclar: OlusturmaSonucu[] = [];
  for (const s of tumSablonlar(env)) {
    const var_ = mevcut.find((m) => m.name === s.ad && (m.language ?? '') === s.dil);
    if (var_) {
      sonuclar.push({ ad: s.ad, sonuc: 'zaten-var', durum: var_.status ?? null, hata: null });
      continue;
    }
    const r = await sablonAc(waba, s);
    sonuclar.push(
      r.ok
        ? { ad: s.ad, sonuc: 'olusturuldu', durum: r.durum ?? 'PENDING', hata: null }
        : { ad: s.ad, sonuc: 'hata', durum: null, hata: r.hata }
    );
  }
  return { ok: true, sonuclar };
}

/**
 * Şablon açma isteği. Ortak `metaPost` bilinen hata kodlarını genel bir cümleye
 * çeviriyor (#100 → "numara kimliği ya da parametre yanlış"); şablon reddinde
 * asıl bilgi Meta'nın kendi açıklamasında ("çok fazla değişken", "bu adla
 * şablon var"…). O yüzden burada Meta'nın cümlesi kodla birlikte AYNEN döner.
 */
async function sablonAc(waba: string, s: SablonTanimi): Promise<{ ok: true; durum: string | null } | { ok: false; hata: string }> {
  try {
    const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(olusturmaGovdesi(s)),
    });
    const j = (await res.json().catch(() => ({}))) as {
      status?: string;
      error?: { code?: number; message?: string; error_user_msg?: string; error_data?: { details?: string } };
    };
    if (res.ok) return { ok: true, durum: j.status ?? null };
    const e = j.error ?? {};
    const metin = e.error_user_msg || e.error_data?.details || e.message || `HTTP ${res.status}`;
    return { ok: false, hata: `${metin}${e.code != null ? ` (#${e.code})` : ''}` };
  } catch (err) {
    return { ok: false, hata: err instanceof Error ? err.message : 'Ağ hatası' };
  }
}
