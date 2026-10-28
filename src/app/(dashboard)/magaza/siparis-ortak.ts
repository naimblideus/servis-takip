/**
 * MAĞAZA SİPARİŞLERİ — "Bugün" listesi ile "Siparişler" ekranının ortak
 * parçaları: mağazadan gelen sipariş biçimi, okuma/işlem istekleri, düğme
 * görünümü. Kurallar mağazada (nextus-magaza lib/siparis-islem.ts); sıradaki
 * adım da oradan hesaplanmış gelir (lib/siparis-adim.ts) — burada yeniden
 * yazılmaz.
 */
import type { MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';

export type SiparisAdimi = 'ODEME_ONAY' | 'DUKKAN_TESLIM' | 'ONAY' | 'KUYRUK' | 'GEL_AL' | 'TEKNISYEN' | 'KARGO' | 'TESLIM';

export interface Siparis {
  id: string;
  no: string;
  durum: string;
  adim: SiparisAdimi | null;
  tarih: string;
  alici: { ad: string; telefon: string; turu: string; adres: string; il: string | null; ilce: string | null };
  musteri: { id: string; kaynak: string | null } | null;
  odeme: { yontem: string; durum: string };
  odemeServiste: boolean;
  teslimat: string;
  toplam: number;
  paraBirimi: string;
  kapandi: boolean;
  settleHata: string | null;
  kargo: { firma: string | null; takip: string | null };
  whatsappIzin: boolean;
  hazirBildirimAt: string | null;
  takipLink: string | null;
  waLink: string | null;
  hazirWaLink: string | null;
  satirlar: { ad: string; sku: string; adet: number; tutar: number; bagli: boolean }[];
}

export interface SiparisVerisi {
  filtre: string;
  bagli: boolean;
  otomatikWa: boolean;
  kargoFirmalari: string[];
  vitrin: string | null;
  sayilar: Record<string, number>;
  siparisler: Siparis[];
}

export type IslemAdi =
  | 'ONAYLA'
  | 'ODEME_GELDI'
  | 'ODEME_GELDI_ONAYLA'
  | 'PARASI_ALINDI_TESLIM'
  | 'HAZIRLANIYOR'
  | 'KARGOYA_VER'
  | 'TESLIM_EDILDI'
  | 'IPTAL'
  | 'HAZIR_HABER';

export interface IslemSonucu {
  ok: boolean;
  mesaj?: string;
  uyari?: boolean;
  bildirim?: string | null;
  zaman?: string;
  hata?: string;
  kod?: string;
  siparis?: Siparis | null;
}

/** Listeyi oku. Durum değiştirmez: sonucu döner (bağlantı sorunu = kod). */
export async function siparisleriGetir(filtre: string): Promise<{ veri: SiparisVerisi } | { kod: string }> {
  try {
    const r = await fetch(`/api/magaza/siparisler?filtre=${encodeURIComponent(filtre)}`, { cache: 'no-store' });
    const g = (await r.json().catch(() => null)) as (SiparisVerisi & { ok?: boolean; kod?: string }) | null;
    if (!r.ok || !g || g.ok === false) return { kod: g?.kod ?? 'GENEL' };
    return { veri: g };
  } catch {
    return { kod: 'ULASILAMADI' };
  }
}

export async function siparisIslemi(islem: IslemAdi, orderId: string, kargo?: { firma: string; takip: string }): Promise<IslemSonucu> {
  try {
    const r = await fetch('/api/magaza/siparisler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ islem, orderId, ...(kargo ? { kargo } : {}) }),
    });
    const g = (await r.json().catch(() => null)) as IslemSonucu | null;
    if (!g) return { ok: false, kod: 'GENEL' };
    return { ...g, ok: r.ok && g.ok !== false };
  } catch {
    return { ok: false, kod: 'ULASILAMADI' };
  }
}

/** Siteden gelen talep (servis, kiralama, teklif) — mağazanın /api/servis/talepler biçimi. */
export interface SiteTalebi {
  id: string;
  tur: 'SERVIS' | 'KIRALAMA' | 'TEKLIF' | 'DIGER';
  ad: string;
  telefon: string;
  konu: string | null;
  mesaj: string | null;
  tarih: string;
  /** Servis talebi Servis'e iletildiyse sonucu (mağazanın cümlesi). */
  servisSonuc: string | null;
  /** Hazır cevapla WhatsApp; sabit hatta null (aranır). */
  waLink: string | null;
}

export async function talepleriGetir(): Promise<{ talepler: SiteTalebi[] } | { kod: string }> {
  try {
    const r = await fetch('/api/magaza/talepler', { cache: 'no-store' });
    const g = (await r.json().catch(() => null)) as { ok?: boolean; kod?: string; talepler?: SiteTalebi[] } | null;
    if (!r.ok || !g || g.ok === false || !Array.isArray(g.talepler)) return { kod: g?.kod ?? 'GENEL' };
    return { talepler: g.talepler };
  } catch {
    return { kod: 'ULASILAMADI' };
  }
}

/** YAZILDI: panelin sabah listesinden de düşer. KAPANDI: iş bitti. */
export async function talepIsaretle(talepId: string, durum: 'YAZILDI' | 'KAPANDI'): Promise<IslemSonucu> {
  try {
    const r = await fetch('/api/magaza/talepler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talepId, durum }),
    });
    const g = (await r.json().catch(() => null)) as IslemSonucu | null;
    return { ...(g ?? {}), ok: r.ok && !!g && g.ok !== false };
  } catch {
    return { ok: false, kod: 'ULASILAMADI' };
  }
}

/**
 * Mağazanın kargo bildirimi cevabı bu cümleyle başlıyorsa müşteriye otomatik
 * WhatsApp gitti (nextus-magaza lib/siparis-islem.ts → siparisDurumuYaz).
 */
export const KARGO_OTOMATIK_GITTI = 'Müşteriye kargo bildirimi gönderildi';

/** Bağlantı / kapı kodunun ekrandaki cümlesi. */
export function kodMetni(kod: string | undefined, sm: MagazaSiparisMetni): string {
  const k = `kod${kod ?? 'GENEL'}` as keyof MagazaSiparisMetni;
  return sm[k] ?? sm.kodGENEL;
}

export const dugme = (renk: string, cerceve = false): React.CSSProperties => ({
  minHeight: 44, padding: '0.55rem 1rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
  background: cerceve ? 'white' : renk, color: cerceve ? renk : 'white', border: `1px solid ${renk}`,
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
});

export const MAVI = '#1d4ed8';
export const YESIL = '#0e9f6e';
export const KIRMIZI = '#b42318';
