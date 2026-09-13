import type { EBelge, BelgeDurumu } from '@/lib/fatura-belgesi';

/**
 * ENTEGRATÖR ARAYÜZÜ — e-Faturayı GİB'e ulaştıran servis sağlayıcı.
 *
 * ── NEDEN ARAYÜZ ─────────────────────────────────────────────────────────
 * Hangi özel entegratörle çalışılacağı ticari bir karar ve henüz
 * verilmedi. O karar beklenirken gönderim hattının GERİ KALANI yazılabilir
 * ve test edilebilir: numara atama, durum makinesi, hata gösterimi,
 * tekrar deneme. Karar verilince yazılacak tek şey bu arayüzün bir
 * uygulaması — geri kalan her şey yerinde duruyor.
 *
 * Bu dosyada hiçbir firmaya özel alan adı YOK. Uyarlayıcı, kanonik belgeyi
 * (lib/fatura-belgesi.ts) o firmanın istediği şekle çeviren yerdir.
 */

export type EntegratorKimligi = {
  kullanici: string;
  parola: string;
  /** Test/canlı ayrımı — çoğu entegratörde ayrı adres. */
  test: boolean;
};

export type GonderimSonucu =
  | { ok: true; referans: string | null; not?: string }
  | { ok: false; hata: string; tekrarDenenebilir: boolean };

export type DurumSonucu =
  | { ok: true; durum: BelgeDurumu; not?: string | null }
  | { ok: false; hata: string };

export interface Entegrator {
  readonly ad: string;
  gonder(belge: EBelge, kimlik: EntegratorKimligi): Promise<GonderimSonucu>;
  durumSor(ettn: string, kimlik: EntegratorKimligi): Promise<DurumSonucu>;
}

/**
 * TEST ENTEGRATÖRÜ — sözleşme olmadan gönderim hattını çalıştırmak için.
 *
 * Gerçek bir servise BAĞLANMAZ. Davranışı belgenin içeriğinden
 * TÜRETİLİYOR ki test edilebilir olsun:
 *   · alıcı VKN'si "0" ile bitiyorsa → RED (kalıcı hata)
 *   · alıcı VKN'si "9" ile bitiyorsa → geçici hata (tekrar denenebilir)
 *   · diğerleri → gönderildi
 *
 * Bayiye "test" olduğu ekranda açıkça yazıyor: test modunda gönderilen
 * belge GİB'e ULAŞMAZ ve müşteriye fatura GİTMEZ.
 */
export class TestEntegrator implements Entegrator {
  readonly ad = 'TEST';

  async gonder(belge: EBelge): Promise<GonderimSonucu> {
    const son = belge.alici.kimlikNo.slice(-1);
    if (son === '0') {
      return { ok: false, hata: 'TEST: alıcı bilgileri GİB kaydıyla eşleşmedi', tekrarDenenebilir: false };
    }
    if (son === '9') {
      return { ok: false, hata: 'TEST: servis geçici olarak yanıt vermiyor', tekrarDenenebilir: true };
    }
    return { ok: true, referans: `TEST-${belge.ettn.slice(0, 8)}`, not: 'Test modunda gönderildi — GİB\'e ulaşmadı.' };
  }

  async durumSor(ettn: string): Promise<DurumSonucu> {
    // Son karakteri çift olanlar kabul, tek olanlar hâlâ beklemede:
    // durum makinesinin iki yolunu da test edebilmek için.
    const n = parseInt(ettn.replace(/\D/g, '').slice(-1) || '0', 10);
    return n % 2 === 0
      ? { ok: true, durum: 'KABUL', not: 'TEST: kabul edildi' }
      : { ok: true, durum: 'GONDERILDI', not: 'TEST: alıcı cevabı bekleniyor' };
  }
}

const KAYITLI: Record<string, () => Entegrator> = {
  TEST: () => new TestEntegrator(),
};

/** Tanımlı sağlayıcılar — ayarlar ekranı bu listeden seçtiriyor. */
export const SAGLAYICILAR = Object.keys(KAYITLI);

/**
 * Sağlayıcı adından uyarlayıcı üretir.
 *
 * BİLİNMEYEN SAĞLAYICI SESSİZCE TESTE DÜŞMÜYOR: öyle olsaydı bayi gerçek
 * fatura gönderdiğini sanarken hiçbir şey göndermemiş olurdu.
 */
export function entegratorBul(ad: string | null | undefined): Entegrator | null {
  const k = (ad ?? '').trim().toUpperCase();
  const f = KAYITLI[k];
  return f ? f() : null;
}
