/**
 * SES ÇEKİRDEĞİ — Retell'in çağırdığı iki ucun işleyicisi (Next'ten bağımsız).
 *
 * Rota dosyası ince kalır: ham gövdeyi ve başlıkları verir, dönen
 * `{ durum, govde }`yi yanıta çevirir. Doğrulama, kimlik ve kiracı kararı
 * BURADA ve her ürün için aynı; alana bağlı tek şey `SesUyarlayici`.
 *
 * Yeni bir ürün (Frigora, Klinik) bağlarken yazılacak tek şey uyarlayıcıdır:
 *   kiraciBul   → ajan kimliğinden kiracı (kurulumda yazılan kimlik)
 *   aracCalistir→ alanın araçları (Servis: taslak aç, fiş durumu…)
 *   hataCevabi  → aksaklıkta söylenecek cümle (alanın dilinde)
 *   gelenArama  → hat numarasından hangi ajanın konuşacağı
 */
import { aracCagrisi, cagriBaglami, type AracCevabi } from './cagri';
import { aracSirriGecerli, retellImzasiGecerli } from './imza';
import { SIR_BASLIGI } from './retell-govde';

export interface AracBaglami {
  tenantId: string;
  callId: string | null;
  /** Retell çağrı kaydından (call.from_number). '' = tanınmadı/gizli. */
  arayanSon10: string;
  /** Ajan açık VE kiracı etkin. Kapalıysa uyarlayıcı her araçta aktarmalı. */
  acik: boolean;
}

export interface SesUyarlayici {
  kiraciBul(agentId: string | null): Promise<{ tenantId: string; acik: boolean } | null>;
  aracCalistir(b: AracBaglami, ad: string | null, args: Record<string, unknown>): Promise<AracCevabi>;
  hataCevabi(): AracCevabi;
  gelenArama(arananNumara: unknown): Promise<{ call_inbound: Record<string, unknown> }>;
}

export interface UcGirdisi {
  ham: string;
  baslik: (ad: string) => string | null;
  /** VOICE_TOOL_SECRET ve RETELL_API_KEY — tanımsızsa uçlar kapalı. */
  sir: string | undefined;
  anahtar: string | undefined;
}

export interface UcCevabi {
  durum: number;
  govde: unknown;
}

/**
 * Araç çağrısı. Sır VE Retell imzası tutmalı (fail-closed). Kiracı yalnız
 * `call.agent_id`'den; müşteri kimliği yalnız `call.from_number`'dan.
 * Her hata cümleli döner: boş yanıt, asistanın ortada susması demek.
 */
export async function aracIstegi(g: UcGirdisi, u: SesUyarlayici): Promise<UcCevabi> {
  const sirTamam = aracSirriGecerli(g.baslik(SIR_BASLIGI), g.sir);
  const imzaTamam = retellImzasiGecerli(g.ham, g.baslik('x-retell-signature'), g.anahtar);
  if (!sirTamam || !imzaTamam) return { durum: 401, govde: { ok: false } };

  let govde: unknown;
  try {
    govde = JSON.parse(g.ham);
  } catch {
    return { durum: 200, govde: u.hataCevabi() };
  }
  const baglam = cagriBaglami(govde);
  if (!baglam) return { durum: 200, govde: u.hataCevabi() };

  try {
    const kiraci = await u.kiraciBul(baglam.agentId);
    if (!kiraci) return { durum: 200, govde: u.hataCevabi() };
    const { ad, args } = aracCagrisi(govde);
    const cevap = await u.aracCalistir(
      { tenantId: kiraci.tenantId, callId: baglam.callId, arayanSon10: baglam.arayanSon10, acik: kiraci.acik },
      ad,
      args,
    );
    return { durum: 200, govde: cevap };
  } catch (e) {
    console.error('[ses-cekirdek] arac:', (e as Error)?.message);
    return { durum: 200, govde: u.hataCevabi() };
  }
}

/**
 * Retell olayı. `call_inbound` → hangi ajan konuşacak; öteki olaylar yalnız
 * alındı (hiçbir şey saklanmaz). İmza zorunlu. Hata olursa boş cevap:
 * Retell numaranın varsayılanına (aktarma ajanı) döner, hat kapanmaz.
 */
export async function olayIstegi(g: Omit<UcGirdisi, 'sir'>, u: Pick<SesUyarlayici, 'gelenArama'>): Promise<UcCevabi> {
  if (!retellImzasiGecerli(g.ham, g.baslik('x-retell-signature'), g.anahtar)) return { durum: 401, govde: { ok: false } };
  let govde: { event?: unknown; call_inbound?: { to_number?: unknown } } | null = null;
  try {
    govde = JSON.parse(g.ham);
  } catch {
    return { durum: 204, govde: null };
  }
  if (govde?.event !== 'call_inbound') return { durum: 204, govde: null };
  try {
    return { durum: 200, govde: await u.gelenArama(govde.call_inbound?.to_number) };
  } catch (e) {
    console.error('[ses-cekirdek] gelen arama:', (e as Error)?.message);
    return { durum: 200, govde: { call_inbound: {} } };
  }
}
