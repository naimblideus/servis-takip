/**
 * TALEP — sitedeki iki kapı (iletişim formu ve kendi kendine kayıt) aynı yere yazar:
 * önce VERİTABANI (süper admin → Talepler), sonra platform sahibine e-posta
 * (lib/sahip-bildirim.ts) ve varsa Nexus CRM.
 *
 * Talep her koşulda Lead tablosuna yazılır; e-posta ve CRM bunun ÜSTÜNE ek
 * adımlardır ve başarısız olmaları talebi kaybettirmez (bkz. api/talep geçmişi:
 * CRM kapalıyken talepler yalnız konsola yazılıp kayboluyordu).
 *
 * .env (isteğe bağlı):
 *   NEXUS_CRM_URL="https://crm.alanadin.com/api/lead"
 *   NEXUS_CRM_TOKEN="<CRM'deki WEBHOOK_TOKEN>"
 */
import { prisma } from '@/lib/prisma';
import { sahibeEposta, siteAdresi, whatsappBaglantisi } from '@/lib/sahip-bildirim';

/** Aşırı uzun alanların veritabanını şişirmesini önle (bot/kötü niyetli gönderim). */
const kirp = (v: unknown, n = 200): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, n) : null;
};

export interface TalepGirdisi {
  firma?: unknown;
  ad?: unknown;
  yetkili?: unknown;
  telefon?: unknown;
  eposta?: unknown;
  cihazSayisi?: unknown;
  cihaz?: unknown;
  mesaj?: unknown;
  utm_source?: unknown;
  utm_campaign?: unknown;
  /** Kayıtta seçilen il (e-posta konusunda görünür; Lead'e mesajla girer). */
  il?: unknown;
}

/** Platform sahibine giden e-posta: kimi, nereden, nasıl aramalı. */
/** landing: iletişim formu · kayit: hesap açıldı · kayit-sinir: sınıra takıldı, hesabı biz açacağız. */
export type TalepKaynagi = 'landing' | 'kayit' | 'kayit-sinir' | 'magaza';

function bildirimMetni(veri: TalepGirdisi, kaynak: TalepKaynagi) {
  const firma = kirp(veri.firma) ?? kirp(veri.ad) ?? 'Adsız';
  const il = kirp(veri.il, 40);
  const telefon = kirp(veri.telefon, 40);
  const wa = whatsappBaglantisi(telefon);
  const etkinlik = kirp(veri.utm_campaign, 120);
  const konu = kaynak === 'kayit'
    ? `Yeni deneme hesabı: ${firma}${il ? ` (${il})` : ''}`
    : kaynak === 'kayit-sinir'
      ? `HESABI SİZ AÇIN: ${firma}${il ? ` (${il})` : ''}`
      : kaynak === 'magaza'
        ? `MAĞAZA İSTEDİ: ${firma}${il ? ` (${il})` : ''}`
        : `Siteden talep: ${firma}`;
  const satirlar = [
    kaynak === 'kayit'
      ? `${kirp(veri.ad) ?? 'Bir servis'} siteden deneme hesabı açtı. Bugün arayın; kurulumda (müşteri/cihaz listesi, ağ tarayıcı) yardım edin.`
      : kaynak === 'kayit-sinir'
        ? `${kirp(veri.ad) ?? 'Bir servis'} deneme hesabı açmak istedi ama aynı ağdan çok kayıt geldiği için hesap otomatik açılmadı. Süper admin → Bayiler → Yeni bayi ile açın, giriş bilgisini WhatsApp'tan gönderin. Ekranda "hesabınızı biz açacağız" yazdı.`
        : kaynak === 'magaza'
          ? `${kirp(veri.ad) ?? 'Bir bayi'} Servis panelindeki Mağaza ekranından "Mağazamı kurun"a bastı. Bugün arayın: adres, yasal bilgiler ve yayına alma.`
          : 'Ana sayfadaki formdan talep geldi.',
    etkinlik ? `Etkinlik: ${etkinlik}` : null,
    '',
    `Firma: ${firma}`,
    kirp(veri.ad ?? veri.yetkili) ? `Yetkili: ${kirp(veri.ad ?? veri.yetkili)}` : null,
    il ? `İl: ${il}` : null,
    telefon ? `Telefon: ${telefon}` : null,
    wa ? `WhatsApp: ${wa}` : null,
    kirp(veri.eposta, 120) ? `E-posta: ${kirp(veri.eposta, 120)}` : null,
    kirp(veri.cihazSayisi ?? veri.cihaz, 40) ? `Cihaz sayısı: ${kirp(veri.cihazSayisi ?? veri.cihaz, 40)}` : null,
    (kaynak === 'landing' || kaynak === 'magaza') && kirp(veri.mesaj, 2000) ? `\n${kaynak === 'magaza' ? 'Kurulum' : 'Mesaj'}:\n${kirp(veri.mesaj, 2000)}` : null,
    '',
    `Talepler: ${siteAdresi()}/super-admin/talepler`,
  ];
  return { konu, satirlar };
}

async function crmeAktar(veri: TalepGirdisi, kaynak: TalepKaynagi, leadId: string): Promise<void> {
  const url = process.env.NEXUS_CRM_URL;
  if (!url) return;
  try {
    const cevap = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nexus-token': process.env.NEXUS_CRM_TOKEN ?? '' },
      body: JSON.stringify({
        ad: veri.firma || veri.ad,
        telefon: veri.telefon ?? null,
        eposta: veri.eposta ?? null,
        urun: 'nexus-servis',
        kaynak,
        kanal: veri.utm_source || null,
        mesaj: [veri.ad ? `Yetkili: ${veri.ad}` : null, veri.mesaj].filter(Boolean).join('\n'),
        utm: veri.utm_source ? `utm_source=${veri.utm_source}` : null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!cevap.ok) throw new Error(`CRM ${cevap.status}`);
    await prisma.lead.update({ where: { id: leadId }, data: { crmDurum: 'aktarildi' } });
  } catch (e) {
    console.error('[talep] CRM\'e iletilemedi (talep kayıtlı):', (e as Error).message);
    await prisma.lead.update({ where: { id: leadId }, data: { crmDurum: 'hata' } }).catch(() => {});
  }
}

/**
 * Talebi kaydeder, sahibine e-postayla bildirir ve CRM'e iletir. Veritabanı
 * yazımı başarısızsa FIRLATIR (çağıran ziyaretçiye hata göstermeli); e-posta
 * ve CRM hataları yutulur, talep kayıtlı kalır. `kaynak` talebin hangi
 * kapıdan geldiğini söyler.
 */
export async function talepKaydet(veri: TalepGirdisi, kaynak: TalepKaynagi, secenek: { sessiz?: boolean } = {}): Promise<{ id: string }> {
  const lead = await prisma.lead.create({
    data: {
      firma: kirp(veri.firma),
      yetkili: kirp(veri.ad ?? veri.yetkili),
      telefon: kirp(veri.telefon, 40),
      eposta: kirp(veri.eposta, 120),
      cihazSayisi: kirp(veri.cihazSayisi ?? veri.cihaz, 40),
      mesaj: kirp(veri.mesaj, 2000),
      kaynak: kirp(veri.utm_source, 80) ?? (kaynak === 'landing' ? null : 'kayit'),
      kampanya: kirp(veri.utm_campaign, 120),
    },
    select: { id: true },
  });

  const { konu, satirlar } = bildirimMetni(veri, kaynak);
  // sessiz: talep yine kayıtlı ve CRM'e gider; yalnız anında e-posta atılmaz (etkinlik kaydı).
  await Promise.allSettled([secenek.sessiz ? Promise.resolve('kapali') : sahibeEposta(konu, satirlar), crmeAktar(veri, kaynak, lead.id)]);
  return lead;
}
