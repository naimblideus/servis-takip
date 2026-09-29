import type { EBelge, BelgeDurumu, Senaryo } from '@/lib/fatura-belgesi';
import { ublUret } from '@/lib/ubl';

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
  /**
   * Kullanıcı adı/parola gerekiyor mu. Elden gönderimde hiçbir servise
   * bağlanılmadığı için gerekmiyor; zorunlu tutsaydık bayi olmayan bir
   * hesabın bilgilerini uydurmak zorunda kalırdı.
   */
  readonly kimlikGerekir: boolean;
  /**
   * Kimlik biçimi. API anahtarıyla çalışan sağlayıcıda kullanıcı adı
   * istenmez; anahtar parola alanında aynı şifrelemeyle saklanır.
   */
  readonly kimlikTuru?: 'KULLANICI_PAROLA' | 'API_ANAHTARI';
  gonder(belge: EBelge, kimlik: EntegratorKimligi): Promise<GonderimSonucu>;
  /** Senaryo verilirse doğru uç sorulur (e-Fatura ile e-Arşiv ayrı). */
  durumSor(ettn: string, kimlik: EntegratorKimligi, senaryo?: Senaryo | null): Promise<DurumSonucu>;
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
  // Gerçek gönderimin provası: kimlik girme adımı da denensin.
  readonly kimlikGerekir = true;

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

/**
 * ELDEN GÖNDERİM — entegratör bağlantısı YOKken yasal faturayı kesmenin
 * yolu.
 *
 * Bayi her hâlükârda bir entegratörle ya da GİB portalıyla çalışıyor
 * (yasal zorunluluk). Eksik olan tek şey O SERVİSE OTOMATİK BAĞLANMAK.
 * Bu sağlayıcı seçildiğinde sistem belgeye numarasını veriyor, UBL
 * XML'ini üretiyor ve bayi o dosyayı kendi portalına yüklüyor. Fatura
 * yasal olarak kesilmiş oluyor, kayıt burada duruyor.
 *
 * Hiçbir şey GÖNDERMEDİĞİ için bayiye "gönderildi" demiyor: notu
 * "XML'i entegratör portalına yükleyin" diyor ve ekranda da böyle
 * yazıyor. Yüklenmediği hâlde yüklenmiş sanılırsa fatura hiç kesilmemiş
 * olur — bu yüzden dil burada çok net.
 */
export class EldenEntegrator implements Entegrator {
  readonly ad = 'ELDEN';
  readonly kimlikGerekir = false;

  async gonder(belge: EBelge): Promise<GonderimSonucu> {
    return {
      ok: true,
      referans: belge.gibNo,
      not: 'Belge numarası verildi. XML dosyasını indirip entegratör portalınıza YÜKLEYİN — sistem kendi başına göndermez.',
    };
  }

  async durumSor(): Promise<DurumSonucu> {
    // Bağlı olmadığımız bir servisin durumunu bilemeyiz; tahmin etmek
    // yerine bilmediğimizi söylüyoruz.
    return { ok: false, hata: 'Elden gönderimde durum sorulamaz — entegratör portalınızdan bakın.' };
  }
}

// ── NİLVERA ──────────────────────────────────────────────────────────────

/**
 * NİLVERA — GİB özel entegratörü, açık REST API.
 *
 * Sözleşme yayımlanmış belgeden (developer.nilvera.com, API v1):
 *   e-Fatura : POST /einvoice/Send/Xml?Alias=<alıcı etiketi>   multipart "file"
 *              GET  /einvoice/Sale/{UUID}/Status
 *   e-Arşiv  : POST /earchive/Send/Xml                          multipart "file"
 *              GET  /earchive/Invoices/{UUID}/Status
 *   Kimlik   : Authorization: Bearer <API anahtarı>
 *   Yanıt    : 200 { UUID, InvoiceNumber } · 409 "istek sistemde zaten var"
 *
 * Gönderilen XML, elden gönderimde indirilen XML'in AYNISI (lib/ubl.ts):
 * iki ayrı doğruluk kaynağı yok. Test ve canlı ortamın anahtarları AYRI;
 * test modunda test ortamına gidilir.
 *
 * ── 409 BAŞARIDIR ────────────────────────────────────────────────────────
 * Hat, hata sonrası tekrar denemede AYNI numara ve ETTN'yi kullanıyor (GİB
 * sırasında boşluk olamaz). Bağlantı, belge kabul EDİLDİKTEN SONRA koparsa
 * tekrar deneme 409 alır. Bunu hata saymak kesilmiş faturayı "gönderilemedi"
 * gösterir ve bayi aynı faturayı başka yoldan ikinci kez keser.
 *
 * ── DOĞRULAMA SINIRI ─────────────────────────────────────────────────────
 * Bu uyarlayıcı yayımlanmış sözleşmeye göre yazıldı ve o sözleşmeyi taklit
 * eden bir sunucuya karşı test edildi; gerçek bir Nilvera hesabıyla henüz
 * denenmedi. İlk gönderim test modunda yapılmalı.
 */
export const NILVERA_ADRES = { test: 'https://apitest.nilvera.com', canli: 'https://api.nilvera.com' } as const;

type Getir = (url: string, init?: RequestInit) => Promise<Response>;

function jsonMu(metin: string): Record<string, any> | null {
  try {
    const j = JSON.parse(metin);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

/** Sağlayıcının hata gövdesinden okunur tek satır. */
export function nilveraHataMetni(metin: string): string {
  const j = jsonMu(metin);
  if (j) {
    const liste = Array.isArray(j.Errors) ? j.Errors : Array.isArray(j.errors) ? j.errors : null;
    if (liste?.length) {
      return liste.map((e: any) => [e?.Code, e?.Description ?? e?.Message, e?.Detail].filter(Boolean).join(' ')).join(' · ').slice(0, 400);
    }
    const tek = j.Message ?? j.message ?? j.Description ?? j.detail ?? j.title;
    if (typeof tek === 'string') return tek.slice(0, 400);
  }
  return metin.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * e-Fatura durumu. Alıcının cevabı zarfın durumundan önce gelir: ulaşmış
 * ama reddedilmiş fatura RED'dir.
 */
export function nilveraEfaturaDurumu(j: Record<string, any> | null): DurumSonucu {
  if (!j) return { ok: false, hata: 'Nilvera durum yanıtı okunamadı' };
  const cevap = j.Answer?.AnswerCode;
  const kod = j.InvoiceStatus?.Code;
  const not = [j.InvoiceStatus?.Description, j.InvoiceStatus?.DetailDescription, j.Answer?.AnswerNote, j.Answer?.Description]
    .filter((x) => typeof x === 'string' && x.trim()).join(' · ') || null;
  if (cevap === 'rejected') return { ok: true, durum: 'RED', not: not ?? 'Alıcı faturayı reddetti' };
  if (cevap === 'approved' || cevap === 'documentAnsweredAutomatically') return { ok: true, durum: 'KABUL', not };
  if (cevap === 'waitingForApproval') return { ok: true, durum: 'GONDERILDI', not: not ?? 'Alıcının cevabı bekleniyor' };
  // Zarf GİB'de hata aldıysa fatura yasal olarak ulaşmamıştır; bayi bilmeli.
  if (kod === 'error') return { ok: true, durum: 'RED', not: `GİB/entegratör hatası: ${not ?? 'ayrıntı yok'}` };
  if (kod === 'succeed') return { ok: true, durum: 'KABUL', not: not ?? 'Alıcıya ulaştı' };
  return { ok: true, durum: 'GONDERILDI', not };
}

export function nilveraEarsivDurumu(j: Record<string, any> | null): DurumSonucu {
  if (!j) return { ok: false, hata: 'Nilvera durum yanıtı okunamadı' };
  const not = typeof j.StatusDetail === 'string' && j.StatusDetail.trim() ? j.StatusDetail.trim() : null;
  if (j.CancelStatus === true) return { ok: true, durum: 'RED', not: not ?? 'e-Arşiv fatura iptal edilmiş' };
  if (j.StatusCode === 'error') return { ok: true, durum: 'RED', not: `GİB/entegratör hatası: ${not ?? 'ayrıntı yok'}` };
  if (j.StatusCode === 'succeed') return { ok: true, durum: 'KABUL', not: not ?? (j.ReportStatus === 'Reported' ? 'GİB\'e raporlandı' : null) };
  return { ok: true, durum: 'GONDERILDI', not };
}

export class NilveraEntegrator implements Entegrator {
  readonly ad = 'NILVERA';
  readonly kimlikGerekir = true;
  readonly kimlikTuru = 'API_ANAHTARI' as const;

  constructor(private readonly secenek: { getir?: Getir; adres?: { test: string; canli: string }; zamanAsimiMs?: number } = {}) {}

  private kok(k: EntegratorKimligi): string {
    const a = this.secenek.adres ?? NILVERA_ADRES;
    return (k.test ? a.test : a.canli).replace(/\/+$/, '');
  }

  private istek(url: string, init: RequestInit): Promise<Response> {
    const getir = this.secenek.getir ?? fetch;
    return getir(url, { ...init, signal: AbortSignal.timeout(this.secenek.zamanAsimiMs ?? 30_000) });
  }

  async gonder(belge: EBelge, k: EntegratorKimligi): Promise<GonderimSonucu> {
    const anahtar = k.parola.trim();
    if (!anahtar) return { ok: false, hata: 'Nilvera API anahtarı girilmemiş (Ayarlar → e-Fatura).', tekrarDenenebilir: true };

    let yol: string;
    if (belge.senaryo === 'TEMELFATURA') {
      // e-Faturanın zarfı alıcının posta kutusuna gider; etiket yoksa gidecek
      // adres yok. İstek atmadan duruluyor: numara zaten ayrıldı ve korunuyor.
      if (!belge.alici.etiket) {
        return {
          ok: false,
          hata: 'Alıcının GİB etiketi (posta kutusu) bilinmiyor. Müşterinin e-Fatura mükellefiyetini yeniden sorgulayın; etiket gelmeden e-Fatura gönderilemez.',
          tekrarDenenebilir: true,
        };
      }
      yol = `/einvoice/Send/Xml?Alias=${encodeURIComponent(belge.alici.etiket)}`;
    } else {
      yol = '/earchive/Send/Xml';
    }

    const govde = new FormData();
    govde.append('file', new Blob([ublUret(belge)], { type: 'application/xml' }), `${belge.ettn}.xml`);

    let y: Response;
    try {
      y = await this.istek(this.kok(k) + yol, {
        method: 'POST',
        headers: { Authorization: `Bearer ${anahtar}`, Accept: 'application/json' },
        body: govde,
      });
    } catch (e) {
      return { ok: false, hata: `Nilvera'ya ulaşılamadı: ${e instanceof Error ? e.message : String(e)}`, tekrarDenenebilir: true };
    }
    const metin = await y.text().catch(() => '');

    if (y.ok) {
      const j = jsonMu(metin);
      const uuid = typeof j?.UUID === 'string' ? j.UUID : null;
      const no = typeof j?.InvoiceNumber === 'string' ? j.InvoiceNumber : null;
      // Numara sırası bizde tutuluyor; entegratör başka numara verdiyse
      // bayi bunu bilmeli, yoksa iki sistemde iki numara dolaşır.
      const not = no && no !== belge.gibNo ? `Nilvera belgeyi ${no} numarasıyla kaydetti (sistemdeki: ${belge.gibNo}).` : undefined;
      return { ok: true, referans: uuid ?? belge.ettn, not };
    }
    if (y.status === 409) {
      return { ok: true, referans: belge.ettn, not: 'Belge Nilvera\'da zaten kayıtlı — önceki deneme ulaşmış, ikinci kez gönderilmedi.' };
    }
    const detay = nilveraHataMetni(metin);
    if (y.status === 401 || y.status === 403) {
      return {
        ok: false,
        hata: `Nilvera API anahtarını reddetti (${y.status}). Test modunda test ortamının, canlıda canlı ortamın anahtarı girilmeli.${detay ? ` ${detay}` : ''}`,
        tekrarDenenebilir: true,
      };
    }
    if (y.status === 400 || y.status === 404 || y.status === 422) {
      return { ok: false, hata: `Nilvera belgeyi kabul etmedi (${y.status})${detay ? `: ${detay}` : ''}`, tekrarDenenebilir: false };
    }
    return { ok: false, hata: `Nilvera geçici hata verdi (${y.status})${detay ? `: ${detay}` : ''}`, tekrarDenenebilir: true };
  }

  async durumSor(ettn: string, k: EntegratorKimligi, senaryo?: Senaryo | null): Promise<DurumSonucu> {
    const anahtar = k.parola.trim();
    if (!anahtar) return { ok: false, hata: 'Nilvera API anahtarı girilmemiş' };
    const earsiv = senaryo === 'EARSIVFATURA';
    const yol = earsiv
      ? `/earchive/Invoices/${encodeURIComponent(ettn)}/Status`
      : `/einvoice/Sale/${encodeURIComponent(ettn)}/Status`;
    let y: Response;
    try {
      y = await this.istek(this.kok(k) + yol, { method: 'GET', headers: { Authorization: `Bearer ${anahtar}`, Accept: 'application/json' } });
    } catch (e) {
      return { ok: false, hata: `Nilvera'ya ulaşılamadı: ${e instanceof Error ? e.message : String(e)}` };
    }
    const metin = await y.text().catch(() => '');
    if (!y.ok) return { ok: false, hata: `Nilvera durum sorgusu başarısız (${y.status})${nilveraHataMetni(metin) ? `: ${nilveraHataMetni(metin)}` : ''}` };
    const j = jsonMu(metin);
    return earsiv ? nilveraEarsivDurumu(j) : nilveraEfaturaDurumu(j);
  }
}

const KAYITLI: Record<string, () => Entegrator> = {
  TEST: () => new TestEntegrator(),
  ELDEN: () => new EldenEntegrator(),
  NILVERA: () => new NilveraEntegrator(),
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
