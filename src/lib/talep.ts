/**
 * TALEP — sitedeki iki kapı (iletişim formu ve kendi kendine kayıt) aynı yere yazar:
 * önce VERİTABANI (süper admin → Talepler), sonra varsa Nexus CRM.
 *
 * Talep her koşulda Lead tablosuna yazılır; CRM aktarımı bunun ÜSTÜNE ek bir
 * adımdır ve başarısız olması talebi kaybettirmez (bkz. api/talep geçmişi:
 * CRM kapalıyken talepler yalnız konsola yazılıp kayboluyordu).
 *
 * .env (isteğe bağlı):
 *   NEXUS_CRM_URL="https://crm.alanadin.com/api/lead"
 *   NEXUS_CRM_TOKEN="<CRM'deki WEBHOOK_TOKEN>"
 */
import { prisma } from '@/lib/prisma';

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
}

/**
 * Talebi kaydeder ve CRM'e iletir. Veritabanı yazımı başarısızsa FIRLATIR
 * (çağıran ziyaretçiye hata göstermeli); CRM hatası yutulur, talep kayıtlı kalır.
 * `kaynak` CRM'de talebin hangi kapıdan geldiğini söyler.
 */
export async function talepKaydet(veri: TalepGirdisi, kaynak: 'landing' | 'kayit'): Promise<{ id: string }> {
  const lead = await prisma.lead.create({
    data: {
      firma: kirp(veri.firma),
      yetkili: kirp(veri.ad ?? veri.yetkili),
      telefon: kirp(veri.telefon, 40),
      eposta: kirp(veri.eposta, 120),
      cihazSayisi: kirp(veri.cihazSayisi ?? veri.cihaz, 40),
      mesaj: kirp(veri.mesaj, 2000),
      kaynak: kirp(veri.utm_source, 80) ?? (kaynak === 'kayit' ? 'kayit' : null),
      kampanya: kirp(veri.utm_campaign, 120),
    },
    select: { id: true },
  });

  const url = process.env.NEXUS_CRM_URL;
  if (!url) return lead;
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
    await prisma.lead.update({ where: { id: lead.id }, data: { crmDurum: 'aktarildi' } });
  } catch (e) {
    console.error('[talep] CRM\'e iletilemedi (talep kayıtlı):', (e as Error).message);
    await prisma.lead.update({ where: { id: lead.id }, data: { crmDurum: 'hata' } }).catch(() => {});
  }
  return lead;
}
