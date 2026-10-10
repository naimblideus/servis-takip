/**
 * KENDİ KENDİNE KAYIT — siteden 14 günlük deneme hesabı.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Deneme hesabını yalnız süper admin açabiliyordu: ziyaretçi WhatsApp'tan
 * yazıyor, biri hesabı elle açıp şifreyi geri gönderiyordu. Tek bölgede iş
 * görür; bütün Türkiye'ye satarken gece 23:00'te Van'dan yazan servisi
 * sabaha bekletmek, onu kaybetmek demek. Artık hesap anında açılıyor; açılan
 * her hesap Talepler ekranına ve CRM'e düşüyor ki satış ekibi arasın.
 *
 * ── SINIRLAR ─────────────────────────────────────────────────────────────
 *   · Deneme paketi: bütün modüller açık, 2 kullanıcı (sitede yazılı koşul).
 *   · Aynı e-postayla ikinci hesap açılmaz: giriş e-postayla bayi arıyor;
 *     iki bayide aynı adres + aynı şifre girişi belirsiz bırakırdı.
 *   · Hız: IP başına 10 dakikada 5 deneme ve günde 3 hesap; bütün sitede
 *     saatte en fazla 20 kendi kendine hesap (bot dalgasına karşı tavan).
 *     IP'si bilinmeyen istek (yerel geliştirme; canlıda vekil her zaman
 *     yazar) IP sınırına girmez, genel tavana girer.
 *   · Süper admin kapatabilir (PlatformSettings.kayitAcik).
 */
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { createTenant, generateSlug } from '@/lib/tenant-manager';
import { talepKaydet } from '@/lib/talep';
import { writeAudit } from '@/lib/audit';
import { ILLER } from '@/lib/iller';

export type KayitHataKodu =
  | 'KAYIT_ALAN_EKSIK' | 'KAYIT_EPOSTA_GECERSIZ' | 'KAYIT_TELEFON_GECERSIZ'
  | 'KAYIT_SIFRE_KISA' | 'KAYIT_ONAY_YOK';

export interface KayitVerisi {
  firma: string;
  ad: string;
  telefon: string;
  eposta: string;
  sifre: string;
  il: string | null;
}

/** Türkiye cep telefonu → 05XXXXXXXXX. Sabit hat ya da yabancı numara null. */
export function cepTelefonu(ham: unknown): string | null {
  const d = String(ham ?? '').replace(/\D/g, '');
  let n = d;
  if (d.length === 12 && d.startsWith('90')) n = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('5')) n = '0' + d;
  return /^05\d{9}$/.test(n) ? n : null;
}

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const metin = (v: unknown, azami: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, azami) : '');

export function kayitDogrula(ham: unknown): { ok: true; veri: KayitVerisi } | { ok: false; kod: KayitHataKodu } {
  const g = (ham ?? {}) as Record<string, unknown>;
  const firma = metin(g.firma, 120);
  const ad = metin(g.ad, 80);
  const eposta = metin(g.eposta, 120).toLowerCase();
  const sifre = typeof g.sifre === 'string' ? g.sifre : '';
  if (firma.length < 2 || ad.length < 2 || !g.telefon || !eposta) return { ok: false, kod: 'KAYIT_ALAN_EKSIK' };
  if (!EPOSTA.test(eposta)) return { ok: false, kod: 'KAYIT_EPOSTA_GECERSIZ' };
  const telefon = cepTelefonu(g.telefon);
  if (!telefon) return { ok: false, kod: 'KAYIT_TELEFON_GECERSIZ' };
  // bcrypt 72 baytın ötesini görmez: daha uzun şifre sessizce kırpılırdı.
  if (sifre.length < 8 || Buffer.byteLength(sifre, 'utf8') > 72) return { ok: false, kod: 'KAYIT_SIFRE_KISA' };
  if (g.onay !== true) return { ok: false, kod: 'KAYIT_ONAY_YOK' };
  const ilHam = metin(g.il, 40);
  const il = (ILLER as readonly string[]).includes(ilHam) ? ilHam : null;
  return { ok: true, veri: { firma, ad, telefon, eposta, sifre, il } };
}

// ── HIZ SINIRI (bellekte; tek sunucu) ──────────────────────────────────
const DENEME_PENCERE = 10 * 60_000;
const DENEME_AZAMI = 5;
const GUNLUK_HESAP_AZAMI = 3;
const SAATLIK_GENEL_AZAMI = 20;
const denemeler = new Map<string, number[]>();
const hesaplar = new Map<string, number[]>();

function sayac(m: Map<string, number[]>, ip: string, pencere: number, simdi: number): number[] {
  const l = (m.get(ip) ?? []).filter((t) => simdi - t < pencere);
  m.set(ip, l);
  return l;
}

/** Bu IP şimdi deneyebilir mi; deneyebiliyorsa denemeyi sayar. */
export function denemeIzni(ip: string, simdi = Date.now()): boolean {
  if (denemeler.size > 5000) denemeler.clear();
  const l = sayac(denemeler, ip, DENEME_PENCERE, simdi);
  if (l.length >= DENEME_AZAMI) return false;
  if (sayac(hesaplar, ip, 86_400_000, simdi).length >= GUNLUK_HESAP_AZAMI) return false;
  l.push(simdi);
  return true;
}

/** Testler için. */
export function hizSiniriniSifirla(): void {
  denemeler.clear();
  hesaplar.clear();
}

/** Siteden açılan bayinin süper admin notu; saatlik tavan yalnız bunları sayar. */
export const KAYIT_NOTU = 'Siteden kendi kendine açıldı';

/** Aynı e-postayla aynı anda gelen iki istek iki hesap açmasın. */
const suren = new Set<string>();

export type KayitSonucu =
  | { durum: 'TAMAM'; tenantId: string }
  | { durum: 'KAPALI' }
  | { durum: 'EPOSTA_VAR' }
  | { durum: 'YOGUN' };

export async function kayitAc(veri: KayitVerisi, ip: string | null): Promise<KayitSonucu> {
  const ayar = await prisma.platformSettings.findFirst({ select: { kayitAcik: true, defaultTrialDays: true } });
  if (ayar && !ayar.kayitAcik) return { durum: 'KAPALI' };

  const saatOnce = new Date(Date.now() - 3_600_000);
  const sonSaat = await prisma.tenant.count({ where: { createdAt: { gte: saatOnce }, adminNotes: { startsWith: KAYIT_NOTU } } });
  if (sonSaat >= SAATLIK_GENEL_AZAMI) return { durum: 'YOGUN' };

  if (suren.has(veri.eposta)) return { durum: 'EPOSTA_VAR' };
  suren.add(veri.eposta);
  try {
    // Büyük/küçük harf duyarsız: "Ali@Firma.com" ile "ali@firma.com" aynı kişi.
    // ILIKE değil lower()=lower(): e-postadaki "_" ILIKE'ta joker olurdu.
    const var_ = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE lower("email") = ${veri.eposta} LIMIT 1`;
    if (var_.length) return { durum: 'EPOSTA_VAR' };

    // 'demo' ile başlayan adlar demo hesaplarına ayrılmış: gece demo tazelemesi
    // o adları siler (yalnız demo işaretliyse, ama yine de çakışmasın).
    const ham = generateSlug(veri.firma) || 'bayi';
    const taban = /^demo(-|$)/.test(ham) ? `bayi-${ham}`.slice(0, 50) : ham;
    const dolu = await prisma.tenant.findFirst({ where: { slug: taban }, select: { id: true } });
    const slug = dolu ? `${taban.slice(0, 43)}-${randomBytes(3).toString('hex')}` : taban;

    const { tenant, user } = await createTenant({
      name: veri.firma,
      slug,
      ownerName: veri.ad,
      phone: veri.telefon,
      email: veri.eposta,
      city: veri.il ?? undefined,
      plan: 'trial',
      trialDays: ayar?.defaultTrialDays ?? 14,
      password: veri.sifre,
      adminNotes: `${KAYIT_NOTU}${veri.il ? ` · ${veri.il}` : ''}`,
    });

    if (ip) sayac(hesaplar, ip, 86_400_000, Date.now()).push(Date.now());
    await writeAudit({
      tenantId: tenant.id, userId: user.id,
      action: 'KENDI_KAYDI', entityType: 'Tenant', entityId: tenant.id,
      newValue: { firma: veri.firma, il: veri.il },
      ipAddress: ip,
    });
    // Satış ekibi arasın: Talepler ekranı + sahibine anında e-posta + CRM.
    // Hesap açılmışken bu adımın hatası ziyaretçiye yansımaz.
    await talepKaydet({
      firma: veri.firma, ad: veri.ad, telefon: veri.telefon, eposta: veri.eposta, il: veri.il,
      mesaj: `Siteden 14 günlük deneme hesabı açtı${veri.il ? ` (${veri.il})` : ''}. Kurulum için arayın.`,
    }, 'kayit').catch((e) => console.error('[kayit] talep yazılamadı:', (e as Error).message));
    return { durum: 'TAMAM', tenantId: tenant.id };
  } finally {
    suren.delete(veri.eposta);
  }
}
