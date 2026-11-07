/**
 * KULLANICI DAVETİ — yönetici şifre yazıp söylemez.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Kurulum görüşmesi uzaktan yapılıyor. Eskiden yönetici her teknisyen için
 * bir şifre uydurup telefonda söylüyordu: yavaş, unutuluyor, aynı şifre
 * herkese veriliyordu. Artık yönetici adı ve rolü yazar, kişiye WhatsApp'tan
 * tek kullanımlık bağlantı gider; şifresini kendisi koyar, doğrudan girer.
 * Süper admin yeni bayiyi açarken sahibe de aynı bağlantı gider.
 *
 * ── KURALLAR ─────────────────────────────────────────────────────────────
 *   · Jeton saklanmaz, yalnız SHA-256 özeti (sifre-sifirlama.ts ile aynı).
 *   · 7 gün geçerli, tek kullanımlık. Yeniden gönderilince eski bağlantılar
 *     ölür; kullanılınca kişinin bütün açık davetleri ölür.
 *   · Geçersiz bağlantının NEDENİ söylenmez: yok, süresi geçmiş, kullanılmış
 *     aynı cümleyi alır (bağlantı deneyene bilgi vermesin).
 *   · Davetli kişinin şifresi kullanılamaz bir rastgele özettir: bağlantıyı
 *     açmadan kimse o hesaba giremez.
 *   · Demo bayisinde, silinmiş bayide ve pasif kullanıcıda davet çalışmaz.
 *   · Şifre en az 8 karakter, en çok 72 bayt (bcrypt sınırı; sifre-sifirlama ile aynı).
 */
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { siteAdresi } from '@/lib/sahip-bildirim';

export const DAVET_GUN = 7;
export const DAVET_SIFRE_EN_AZ = 8;
const GUN = 86_400_000;

const ozet = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
const jetonBicimi = (j: unknown): j is string => typeof j === 'string' && j.length >= 20 && j.length <= 100;

/** Davetli kişinin geçici şifre özeti: kimsenin bilmediği rastgele değer. */
export async function kullanilamazSifre(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString('base64url'), 10);
}

export function davetBaglantisi(jeton: string): string {
  return `${siteAdresi()}/davet/${jeton}`;
}

/**
 * Yeni davet: kişinin açık davetlerini öldürür, yenisini yazar. Bağlantı
 * yalnız burada, bir kez görünür (jeton saklanmıyor).
 */
export async function davetOlustur(o: {
  tenantId: string;
  userId: string;
  olusturanAd: string | null;
  simdi?: Date;
}): Promise<{ baglanti: string; bitis: Date }> {
  const simdi = o.simdi ?? new Date();
  const jeton = randomBytes(32).toString('base64url');
  const bitis = new Date(simdi.getTime() + DAVET_GUN * GUN);
  await prisma.$transaction([
    prisma.kullaniciDavet.updateMany({ where: { userId: o.userId, kullanildi: null, bitis: { gt: simdi } }, data: { bitis: simdi } }),
    prisma.kullaniciDavet.create({
      data: { tenantId: o.tenantId, userId: o.userId, tokenOzeti: ozet(jeton), bitis, olusturanAd: o.olusturanAd?.slice(0, 120) ?? null },
    }),
  ]);
  return { baglanti: davetBaglantisi(jeton), bitis };
}

export type DavetBilgisi = {
  davetId: string;
  userId: string;
  tenantId: string;
  ad: string;
  /** Giriş adı (User.email): kişi bunu ve yeni şifresini yazarak girer. */
  giris: string;
  rol: string;
  firma: string;
};

/** Bağlantı açılınca: geçerliyse kimin olduğu, değilse null (nedeni söylenmez). */
export async function davetBul(jeton: unknown, simdi: Date = new Date()): Promise<DavetBilgisi | null> {
  if (!jetonBicimi(jeton)) return null;
  const d = await prisma.kullaniciDavet.findUnique({
    where: { tokenOzeti: ozet(jeton) },
    select: {
      id: true, tenantId: true, kullanildi: true, bitis: true,
      user: { select: { id: true, name: true, email: true, role: true, isActive: true, tenantId: true, tenant: { select: { name: true, demo: true, deletedAt: true } } } },
    },
  });
  if (!d || d.kullanildi || d.bitis.getTime() <= simdi.getTime()) return null;
  const u = d.user;
  if (!u.isActive || u.tenantId !== d.tenantId || u.tenant.demo || u.tenant.deletedAt) return null;
  return { davetId: d.id, userId: u.id, tenantId: u.tenantId, ad: u.name, giris: u.email, rol: u.role, firma: u.tenant.name };
}

export type DavetSonucu =
  | { ok: true; bilgi: DavetBilgisi }
  | { ok: false; hata: 'GECERSIZ' | 'SIFRE_KISA' };

/**
 * Şifreyi koy. Aynı bağlantı iki sekmede aynı anda gönderilirse yalnız biri
 * kazanır (koşullu güncelleme: kullanildi IS NULL).
 */
export async function davetiKullan(jeton: unknown, sifre: unknown, simdi: Date = new Date()): Promise<DavetSonucu> {
  if (typeof sifre !== 'string' || sifre.length < DAVET_SIFRE_EN_AZ || Buffer.byteLength(sifre, 'utf8') > 72) {
    return { ok: false, hata: 'SIFRE_KISA' };
  }
  const bilgi = await davetBul(jeton, simdi);
  if (!bilgi) return { ok: false, hata: 'GECERSIZ' };

  const passwordHash = await bcrypt.hash(sifre, 12);
  const kazanan = await prisma.kullaniciDavet.updateMany({
    where: { id: bilgi.davetId, kullanildi: null, bitis: { gt: simdi } },
    data: { kullanildi: simdi },
  });
  if (kazanan.count !== 1) return { ok: false, hata: 'GECERSIZ' };

  await prisma.$transaction([
    prisma.user.update({ where: { id: bilgi.userId }, data: { passwordHash, davetBekliyor: false } }),
    prisma.kullaniciDavet.updateMany({ where: { userId: bilgi.userId, kullanildi: null }, data: { bitis: simdi } }),
  ]);
  return { ok: true, bilgi };
}
