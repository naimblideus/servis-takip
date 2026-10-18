/**
 * WHATSAPP KURULUM DURUMU — süper adminin "ne doğru, ne yanlış, sıradaki adım ne" listesi.
 *
 * ── NEDEN SAF ────────────────────────────────────────────────────────────
 * Meta kurulumu tek seferde bitmiyor: ortam değişkeni, numara kaydı, şablon
 * onayı, webhook aboneliği ayrı ayrı ekranlarda. Bir halka eksikse mesaj
 * sessizce düşüyor ve sebebi ancak Meta'nın İngilizce hata kodunda görünüyor.
 * Bu dosya yalnız GERÇEKLERİ alır (env var/yok, Meta cevabı, son mesaj zamanı)
 * ve sıralı bir kontrol listesi döner; Meta'ya, veritabanına, process.env'e
 * dokunmaz — test (test-whatsapp-saglik) her durumu sahte girdiyle sınar.
 *
 * ── METİNLER ─────────────────────────────────────────────────────────────
 * Başlık ve çözüm SÖZLÜK ANAHTARIDIR (superAdmin.whatsapp.m.*) + parametre;
 * sayfa kullanıcının dilinde doldurur. `ayrinti` Meta'nın ham cümlesidir
 * (ret sebebi, hata metni) — çevrilmez, olduğu gibi gösterilir.
 *
 * ── GİZLİ DEĞER YOK ──────────────────────────────────────────────────────
 * Girdi jeton / uygulama sırrı / doğrulama jetonunun DEĞERİNİ almaz, yalnız
 * var/yok bilgisini. Böylece liste nereye giderse gitsin sır sızmaz.
 */
import { SABLONLAR } from '@/lib/whatsapp-sablon';
import { MAGAZA_SABLONLARI } from '@/lib/whatsapp-sablon-magaza';

export type SaglikDurumu = 'tamam' | 'uyari' | 'hata' | 'bekliyor';

export interface SaglikMaddesi {
  /** Sabit kimlik (test ve React anahtarı). */
  anahtar: string;
  durum: SaglikDurumu;
  /** superAdmin.whatsapp.m altındaki anahtar. */
  baslik: string;
  baslikParam?: Record<string, string | number>;
  /** Sıradaki adım — superAdmin.whatsapp.m altındaki anahtar; her şey yolundaysa null. */
  cozum: string | null;
  cozumParam?: Record<string, string | number>;
  /** Meta'nın ham metni (ret sebebi, hata) — çevrilmez. */
  ayrinti?: string | null;
}

export interface MetaSablon {
  name: string;
  status?: string;
  language?: string;
  category?: string;
  rejected_reason?: string | null;
  components?: { type?: string; text?: string }[];
}

type MetaHata = { ok: false; error: string; kod: number | null };

export interface SaglikGirdisi {
  env: {
    token: boolean;
    phoneId: boolean;
    appSecret: boolean;
    verifyToken: boolean;
    wabaId: boolean;
    /** Gizli olmayan değerler. */
    template: string | null;
    templateSayac: string | null;
    lang: string | null;
  };
  /** GET /{PHONE_ID} cevabı; sorgulanmadıysa null. */
  telefon: { ok: true; veri: Record<string, any> } | MetaHata | null;
  /** GET /{WABA_ID}/message_templates cevabı; sorgulanmadıysa null. */
  sablonlar: { ok: true; liste: MetaSablon[] } | MetaHata | null;
  /** Webhook'tan gelen son müşteri mesajı. */
  sonGelen: Date | string | null;
  /** Webhook'tan gelen son teslim/okundu bildirimi. */
  sonDurum: Date | string | null;
  /** Son başarısız WhatsApp gönderimleri (yenisi önce). */
  sonHatalar: { error: string | null; createdAt?: Date | string | null }[];
  simdi?: Date;
}

/** Meta şablon metnindeki {{n}} sayısı (benzersiz). */
export function degiskenSayisi(metin: string): number {
  return new Set([...metin.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1])).size;
}

const sade = (s: string) => s.replace(/\s+/g, ' ').trim();

/** "+1 555-…" — Meta'nın verdiği test numaraları hep bu bloktan. */
export function testNumarasiMi(gorunen: string | null | undefined): boolean {
  const d = (gorunen || '').replace(/\D/g, '');
  return d.startsWith('1555');
}

/** Hata metnindeki "(#131030)" kodunu çıkar (NotificationLog.error biçimi). */
export function hataKodu(metin: string | null | undefined): number | null {
  const m = (metin || '').match(/#(\d{1,7})\)?/);
  return m ? Number(m[1]) : null;
}

function sureMaddesi(an: Date, simdi: Date): { baslikEk: 'Dk' | 'Sa' | 'Gun'; n: number } {
  const dk = Math.max(0, Math.floor((simdi.getTime() - an.getTime()) / 60000));
  if (dk < 60) return { baslikEk: 'Dk', n: dk };
  if (dk < 48 * 60) return { baslikEk: 'Sa', n: Math.floor(dk / 60) };
  return { baslikEk: 'Gun', n: Math.floor(dk / 1440) };
}

const tarih = (x: Date | string | null | undefined): Date | null => {
  if (!x) return null;
  const d = x instanceof Date ? x : new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function saglikListesi(g: SaglikGirdisi): SaglikMaddesi[] {
  const simdi = g.simdi ?? new Date();
  const L: SaglikMaddesi[] = [];
  const e = g.env;

  // ── 1. Ortam değişkenleri (Coolify) ──────────────────────────────────
  // Sıra bilerek "gönderim için şart olandan" başlıyor: jeton ve numara
  // kimliği olmadan başka hiçbir kontrol anlamlı değil.
  const envMaddesi = (anahtar: string, var_: boolean, ad: string, yoksa: SaglikDurumu, neden: string) =>
    L.push(var_
      ? { anahtar, durum: 'tamam', baslik: 'envVar', baslikParam: { ad }, cozum: null }
      : { anahtar, durum: yoksa, baslik: neden, baslikParam: { ad }, cozum: 'envEkle', cozumParam: { ad } });
  envMaddesi('env_token', e.token, 'WHATSAPP_TOKEN', 'hata', 'envYokGonderim');
  envMaddesi('env_phone', e.phoneId, 'WHATSAPP_PHONE_ID', 'hata', 'envYokGonderim');
  envMaddesi('env_secret', e.appSecret, 'WHATSAPP_APP_SECRET', 'hata', 'envYokWebhook');
  envMaddesi('env_verify', e.verifyToken, 'WHATSAPP_VERIFY_TOKEN', 'hata', 'envYokDogrulama');

  // Şablon adları: kod SABLONLAR'daki adı bekliyor; env farklıysa Meta'da o adla aranır.
  const sablonEnv = (anahtar: string, deger: string | null, envAd: string, beklenen: string, yoksa: SaglikDurumu) => {
    if (!deger) L.push({ anahtar, durum: yoksa, baslik: 'envYokSablon', baslikParam: { ad: envAd, sablon: beklenen }, cozum: 'envEkleDeger', cozumParam: { ad: envAd, deger: beklenen } });
    else if (deger !== beklenen) L.push({ anahtar, durum: 'uyari', baslik: 'envSablonFarkli', baslikParam: { ad: envAd, deger, beklenen }, cozum: 'envEkleDeger', cozumParam: { ad: envAd, deger: beklenen } });
    else L.push({ anahtar, durum: 'tamam', baslik: 'envVarDeger', baslikParam: { ad: envAd, deger }, cozum: null });
  };
  sablonEnv('env_sablon_borc', e.template, 'WHATSAPP_TEMPLATE', SABLONLAR.borc.ad, 'hata');
  sablonEnv('env_sablon_sayac', e.templateSayac, 'WHATSAPP_TEMPLATE_SAYAC', SABLONLAR.sayac.ad, 'uyari');

  const dil = e.lang || 'tr';
  L.push(dil === 'tr'
    ? { anahtar: 'env_dil', durum: 'tamam', baslik: 'dilTamam', baslikParam: { dil }, cozum: null }
    : { anahtar: 'env_dil', durum: 'uyari', baslik: 'dilFarkli', baslikParam: { dil }, cozum: 'envEkleDeger', cozumParam: { ad: 'WHATSAPP_LANG', deger: 'tr' } });

  // ── 2. Numara (Meta) ─────────────────────────────────────────────────
  const t = g.telefon;
  if (!t) {
    L.push({ anahtar: 'numara', durum: 'bekliyor', baslik: 'numaraBekliyor', cozum: 'once_env' });
  } else if (!t.ok) {
    const cozum = t.kod === 190 || t.kod === 0 ? 'jetonYenile' : t.kod === 100 ? 'phoneIdKontrol' : t.kod === 131005 || t.kod === 10 ? 'jetonIzin' : 'metaTekrar';
    L.push({ anahtar: 'numara', durum: 'hata', baslik: 'numaraHata', cozum, ayrinti: t.error });
  } else {
    const v = t.veri || {};
    L.push({
      anahtar: 'numara', durum: 'tamam', baslik: 'numaraTamam',
      baslikParam: { numara: String(v.display_phone_number ?? '?'), ad: String(v.verified_name ?? '?') }, cozum: null,
      ayrinti: v.messaging_limit_tier ? `messaging_limit_tier: ${v.messaging_limit_tier}` : null,
    });
    if (testNumarasiMi(v.display_phone_number)) {
      L.push({ anahtar: 'test_numarasi', durum: 'uyari', baslik: 'testNumarasi', cozum: 'testListesi' });
    }
    const kalite = String(v.quality_rating ?? '').toUpperCase();
    if (kalite === 'RED' || kalite === 'YELLOW') {
      L.push({ anahtar: 'kalite', durum: 'uyari', baslik: kalite === 'RED' ? 'kaliteKirmizi' : 'kaliteSari', cozum: 'kaliteCozum' });
    } else {
      L.push({ anahtar: 'kalite', durum: 'tamam', baslik: kalite === 'GREEN' ? 'kaliteYesil' : 'kaliteYok', baslikParam: { deger: kalite || '—' }, cozum: null });
    }
    const kod = String(v.code_verification_status ?? '').toUpperCase();
    if (kod && kod !== 'VERIFIED') {
      L.push({ anahtar: 'kod_dogrulama', durum: 'uyari', baslik: 'kodDogrulanmadi', baslikParam: { deger: kod }, cozum: 'kodDogrula' });
    } else if (kod) {
      L.push({ anahtar: 'kod_dogrulama', durum: 'tamam', baslik: 'kodDogrulandi', cozum: null });
    }
    const ad = String(v.name_status ?? '').toUpperCase();
    if (ad === 'DECLINED') {
      L.push({ anahtar: 'gorunen_ad', durum: 'hata', baslik: 'adReddedildi', baslikParam: { deger: ad }, cozum: 'adCozum' });
    } else if (ad === 'PENDING_REVIEW' || ad === 'NONE') {
      L.push({ anahtar: 'gorunen_ad', durum: 'uyari', baslik: 'adBekliyor', baslikParam: { deger: ad }, cozum: 'adCozum' });
    } else if (ad) {
      L.push({ anahtar: 'gorunen_ad', durum: 'tamam', baslik: 'adTamam', baslikParam: { deger: ad }, cozum: null });
    }
  }

  // ── 3. Şablon onayı (yalnız WABA kimliği varsa okunabilir) ──────────
  if (!e.wabaId) {
    L.push({ anahtar: 'env_waba', durum: 'uyari', baslik: 'wabaYok', cozum: 'wabaEkle' });
  }
  const s = g.sablonlar;
  // Hatırlatma şablonları (adı ortamdan değişebilir) + Nextus Mağaza'nın
  // bildirim şablonları (adı sabit; mağaza /api/shop/bildirim'e bu adla yollar).
  const denetlenecek = [
    ...(['borc', 'sayac'] as const).map((tur) => ({
      anahtar: `sablon_${tur}`,
      tanim: SABLONLAR[tur] as { ad: string; metin: string },
      ad: (tur === 'borc' ? e.template : e.templateSayac) || SABLONLAR[tur].ad,
    })),
    ...Object.entries(MAGAZA_SABLONLARI).map(([k, tanim]) => ({ anahtar: `sablon_magaza_${k}`, tanim, ad: tanim.ad })),
  ];
  for (const { anahtar, tanim, ad } of denetlenecek) {
    if (!s) {
      L.push({ anahtar, durum: 'bekliyor', baslik: 'sablonBilinmiyor', baslikParam: { ad }, cozum: e.wabaId ? 'once_env' : 'wabaEkle' });
      continue;
    }
    if (!s.ok) {
      L.push({ anahtar, durum: 'uyari', baslik: 'sablonOkunamadi', baslikParam: { ad }, cozum: s.kod === 100 ? 'wabaKontrol' : 'metaTekrar', ayrinti: s.error });
      continue;
    }
    const ayni = s.liste.filter((x) => x.name === ad);
    const bulunan = ayni.find((x) => (x.language || '') === dil) ?? null;
    if (!ayni.length) {
      L.push({ anahtar, durum: 'hata', baslik: 'sablonYok', baslikParam: { ad }, cozum: 'sablonOlustur', cozumParam: { ad } });
      continue;
    }
    if (!bulunan) {
      L.push({ anahtar, durum: 'hata', baslik: 'sablonDilYok', baslikParam: { ad, dil, diller: ayni.map((x) => x.language).join(', ') }, cozum: 'sablonOlustur', cozumParam: { ad } });
      continue;
    }
    const govde = (bulunan.components || []).find((c) => String(c.type).toUpperCase() === 'BODY')?.text ?? '';
    const metaSayi = degiskenSayisi(govde);
    const kodSayi = degiskenSayisi(tanim.metin);
    const durum = String(bulunan.status ?? '').toUpperCase();
    if (durum === 'REJECTED') {
      L.push({ anahtar, durum: 'hata', baslik: 'sablonReddedildi', baslikParam: { ad }, cozum: 'sablonReddedildiCozum', ayrinti: bulunan.rejected_reason || null });
    } else if (durum === 'DISABLED') {
      L.push({ anahtar, durum: 'hata', baslik: 'sablonKapali', baslikParam: { ad }, cozum: 'sablonOlustur', cozumParam: { ad } });
    } else if (metaSayi !== kodSayi) {
      // Meta'daki metin farklı sayıda değişken bekliyor: her gönderim #132000 ile düşer.
      L.push({ anahtar, durum: 'hata', baslik: 'sablonDegiskenFarkli', baslikParam: { ad, meta: metaSayi, kod: kodSayi }, cozum: 'sablonOlustur', cozumParam: { ad }, ayrinti: govde || null });
    } else if (durum === 'PENDING' || durum === 'IN_APPEAL') {
      L.push({ anahtar, durum: 'uyari', baslik: 'sablonBekliyor', baslikParam: { ad, durum }, cozum: 'sablonBekle' });
    } else if (durum === 'PAUSED') {
      L.push({ anahtar, durum: 'uyari', baslik: 'sablonDuraklatildi', baslikParam: { ad }, cozum: 'kaliteCozum' });
    } else if (durum === 'APPROVED') {
      if (sade(govde) !== sade(tanim.metin)) {
        // Değişken sayısı aynı → mesaj gider; yalnız müşterinin gördüğü metin koddakinden farklı.
        L.push({ anahtar, durum: 'uyari', baslik: 'sablonMetinFarkli', baslikParam: { ad }, cozum: null, ayrinti: govde || null });
      } else {
        L.push({ anahtar, durum: 'tamam', baslik: 'sablonOnayli', baslikParam: { ad }, cozum: null });
      }
    } else {
      L.push({ anahtar, durum: 'uyari', baslik: 'sablonDurum', baslikParam: { ad, durum: durum || '?' }, cozum: 'sablonBekle' });
    }
  }

  // ── 4. Webhook (gelen mesaj / teslim bildirimi) ─────────────────────
  const gelen = tarih(g.sonGelen);
  const durumAn = tarih(g.sonDurum);
  if (gelen) {
    const s1 = sureMaddesi(gelen, simdi);
    L.push({ anahtar: 'webhook', durum: 'tamam', baslik: `webhookGelen${s1.baslikEk}`, baslikParam: { n: s1.n }, cozum: null });
  } else if (durumAn) {
    const s1 = sureMaddesi(durumAn, simdi);
    L.push({ anahtar: 'webhook', durum: 'tamam', baslik: `webhookDurum${s1.baslikEk}`, baslikParam: { n: s1.n }, cozum: 'webhookMusteriNotu' });
  } else {
    L.push({ anahtar: 'webhook', durum: e.appSecret && e.verifyToken ? 'uyari' : 'hata', baslik: 'webhookHicYok', cozum: 'webhookAbone' });
  }

  // ── 5. Son başarısız gönderimler ─────────────────────────────────────
  if (g.sonHatalar.length) {
    const son = g.sonHatalar[0];
    const kod = hataKodu(son.error);
    const cozum = kod === 131030 ? 'testListesi' : kod === 132001 ? 'sablonOlustur' : kod === 132000 ? 'sablonOlustur' : kod === 190 ? 'jetonYenile' : kod === 131047 ? 'pencere24' : null;
    L.push({
      anahtar: 'son_hatalar', durum: 'uyari', baslik: 'sonHatalar', baslikParam: { n: g.sonHatalar.length },
      cozum, cozumParam: { ad: e.template || SABLONLAR.borc.ad }, ayrinti: son.error,
    });
  } else {
    L.push({ anahtar: 'son_hatalar', durum: 'tamam', baslik: 'sonHataYok', cozum: null });
  }

  return L;
}

/** Listenin özeti: en kötü durum (başlık rozeti için). */
export function genelDurum(L: SaglikMaddesi[]): SaglikDurumu {
  if (L.some((x) => x.durum === 'hata')) return 'hata';
  if (L.some((x) => x.durum === 'uyari')) return 'uyari';
  if (L.some((x) => x.durum === 'bekliyor')) return 'bekliyor';
  return 'tamam';
}

/** Gizli olmayan kimliği de son 4 hanesiyle göster (ekran görüntüsünde tam kimlik dolaşmasın). */
export function maskele(deger: string | null | undefined): string | null {
  if (!deger) return null;
  return deger.length <= 4 ? '••••' : `••••${deger.slice(-4)}`;
}
