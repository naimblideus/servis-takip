/**
 * SES ÇEKİRDEĞİ — çağrıdan kimlik, kiracı kararı, gelen arama, numara.
 *
 * ── NEDEN AYRI KLASÖR ────────────────────────────────────────────────────
 * Aynı telefon/WhatsApp ajanı Servis'ten sonra Frigora'ya ve Nextus Klinik'e
 * de gidecek. Bu klasör ALAN BİLMEZ: fiş, cihaz, hasta, soğuk oda yok;
 * Prisma yok, `@/lib/...` içe aktarımı yok. Alan bağımlı kısım uyarlayıcıdan
 * (`uc.ts` → SesUyarlayici) gelir. İleride tek pakete taşınabilsin diye
 * bilerek böyle; şimdilik depo içinde duruyor.
 *
 * Bu dosya SAFtır (crypto bile yok).
 */

/** Ajanın her araç cevabı: söylenecek cümle + gerekiyorsa insana devir. */
export interface AracCevabi {
  ok: boolean;
  /** Asistanın AYNEN söyleyeceği cümle. */
  soyle: string;
  /** true: cümleden sonra aktarma aracı çağrılır. */
  devret?: boolean;
  /** Arayan tanındı mı (ad ya da başka bilgi TAŞIMAZ). */
  tanindi?: boolean;
}

/**
 * Arayanın son 10 hanesi. Gizli numara ("anonymous"), SIP adresi ya da 10
 * haneden kısa değer → '' (tanınmadı). SIP adresindeki sunucu rakamlarını
 * numara sanmak, rastgele bir müşteriyi "tanımak" olurdu.
 */
export function son10(numara: unknown): string {
  if (typeof numara !== 'string') return '';
  const t = numara.trim();
  if (!t || /^(anonymous|unknown|private|restricted|unavailable)$/i.test(t) || /^sips?:/i.test(t)) return '';
  const r = t.replace(/[^0-9]/g, '');
  return r.length >= 10 ? r.slice(-10) : '';
}

/**
 * Aktarma numarası → +90XXXXXXXXXX. Yalnız Türkiye: sabit hat (2/3/4),
 * cep (5), 0850 ve 0800. 0900 (ücretli hat) ve yurt dışı REDDEDİLİR: aktarma
 * platformun hattından aranıyor, kötü niyetli bir numara fatura dolandırıcılığı olurdu.
 */
export function e164TR(metin: unknown): string | null {
  if (typeof metin !== 'string') return null;
  let r = metin.trim().replace(/[\s().-]/g, '');
  if (!r) return null;
  if (r.startsWith('+')) {
    if (!r.startsWith('+90')) return null;
    r = r.slice(3);
  } else if (r.startsWith('0090')) {
    r = r.slice(4);
  } else if (r.startsWith('90') && r.length === 12) {
    r = r.slice(2);
  } else if (r.startsWith('0') && r.length === 11) {
    r = r.slice(1);
  }
  if (!/^\d{10}$/.test(r)) return null;
  if (r.startsWith('900')) return null;
  if (!/^[2345]/.test(r) && !/^8(50|00)/.test(r)) return null;
  return `+90${r}`;
}

/** Retell hat numarası → yalnız rakam (10-15 hane). Platform ekibi girer; her ülke olabilir. */
export function hatNumarasiSade(metin: unknown): string | null {
  if (typeof metin !== 'string') return null;
  const t = metin.trim();
  if (!/^\+?[\d\s().-]+$/.test(t)) return null;
  const r = t.replace(/[^0-9]/g, '');
  return r.length >= 10 && r.length <= 15 ? r : null;
}

export interface CagriBaglami {
  agentId: string | null;
  callId: string | null;
  /** '' = numara yok/gizli → arayan tanınmadı sayılır. */
  arayanSon10: string;
  arananNumara: string | null;
}

const metinAl = (v: unknown, n = 200): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;

/**
 * Retell araç çağrısı gövdesi: `{ name, call: {...}, args: {...} }`.
 *
 * KİMLİK YALNIZ `call`'DAN. Gövdenin kökündeki `from_number` ya da modelin
 * doldurduğu `args.telefon` gibi değerler OKUNMAZ: arayan "benim numaram
 * şu" diyerek başkasının kaydını sorduramaz. `call` yoksa gövde geçersizdir.
 */
export function cagriBaglami(govde: unknown): CagriBaglami | null {
  if (!govde || typeof govde !== 'object') return null;
  const call = (govde as Record<string, unknown>).call;
  if (!call || typeof call !== 'object' || Array.isArray(call)) return null;
  const c = call as Record<string, unknown>;
  return {
    agentId: metinAl(c.agent_id),
    callId: metinAl(c.call_id),
    arayanSon10: son10(c.from_number),
    arananNumara: metinAl(c.to_number, 40),
  };
}

/** Araç adı ve argümanları. Argümanlar yalnız İÇERİK taşır, kimlik değil. */
export function aracCagrisi(govde: unknown): { ad: string | null; args: Record<string, unknown> } {
  const g = (govde && typeof govde === 'object' ? govde : {}) as Record<string, unknown>;
  const a = g.args;
  return {
    ad: metinAl(g.name, 60),
    args: a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {},
  };
}

export type KiraciKarari = { tur: 'RED' } | { tur: 'ACIK' | 'KAPALI'; tenantId: string };

/**
 * Araç çağrısının kiracısı. Eşleşme YALNIZ ajan kimliğiyle aranır (kurulumda
 * bizim yazdığımız değer). Bilinmeyen ya da eksik ajan kimliği → RED;
 * numaraya bakıp tahmin edilmez (gövdedeki numara bize ait değildir).
 */
export function kiraciKarari(
  agentId: string | null,
  eslesme: { tenantId: string; acik: boolean; kiraciEtkin: boolean } | null,
): KiraciKarari {
  if (!agentId || !eslesme) return { tur: 'RED' };
  return { tur: eslesme.acik && eslesme.kiraciEtkin ? 'ACIK' : 'KAPALI', tenantId: eslesme.tenantId };
}

/** Kiracı çalışır durumda mı: kapalı, askıda ya da silinmiş kiracıda ajan kapalı sayılır. */
export function kiraciEtkin(t: { isActive?: boolean | null; isSuspended?: boolean | null; deletedAt?: Date | null } | null): boolean {
  return Boolean(t && t.isActive !== false && !t.isSuspended && !t.deletedAt);
}

/**
 * GELEN ARAMA — hangi ajan konuşacak (Retell inbound webhook cevabı).
 *
 * Numaranın varsayılan ajanı "yalnız aktarma" ajanıdır; asıl ajana YALNIZ
 * bu cevapla geçilir. Uç düşerse, imza tutmazsa ya da kiracı kapalıysa arama
 * aktarma ajanında kalır: bot konuşmaz, hat kapanmaz. Silinmiş kiracının
 * hattı reddedilir (hat artık kimsenin değil).
 */
export function gelenAramaYaniti(
  e: {
    acik: boolean;
    kiraciEtkin: boolean;
    kiraciSilindi: boolean;
    asilAgentId: string | null;
    aktarmaAgentId: string | null;
  } | null,
): { call_inbound: { override_agent_id?: string; reject?: true } } {
  if (!e) return { call_inbound: {} };
  if (e.kiraciSilindi) return { call_inbound: { reject: true } };
  if (e.acik && e.kiraciEtkin && e.asilAgentId) return { call_inbound: { override_agent_id: e.asilAgentId } };
  if (e.aktarmaAgentId) return { call_inbound: { override_agent_id: e.aktarmaAgentId } };
  return { call_inbound: {} };
}

/**
 * Basit sayaç: anahtar başına pencere içinde en çok `max` deneme (ör. bir
 * çağrıda en çok 3 kayıt sorgusu — sıralı numaralar tahmin edilmesin).
 * Tek sunucu süreci için; çok sunucuda sınır sunucu başına olur.
 */
export function sinirlayici(max: number, pencereMs: number) {
  const kayit = new Map<string, { n: number; bas: number }>();
  return (anahtar: string | null, simdi = Date.now()): boolean => {
    if (!anahtar) return false;
    if (kayit.size > 2000) {
      for (const [k, v] of kayit) if (simdi - v.bas > pencereMs) kayit.delete(k);
    }
    const v = kayit.get(anahtar);
    if (!v || simdi - v.bas > pencereMs) {
      kayit.set(anahtar, { n: 1, bas: simdi });
      return true;
    }
    if (v.n >= max) return false;
    v.n++;
    return true;
  };
}
