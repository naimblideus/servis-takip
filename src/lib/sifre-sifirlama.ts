/**
 * ŞİFRE SIFIRLAMA — "Şifremi unuttum".
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Siteden kendi kendine açılan hesapların şifresini unutan bayinin tek yolu
 * WhatsApp'tan yazıp şifreyi bize değiştirtmekti. Bir etkinlikte telefondan
 * aceleyle açılan yüzlerce hesapta bu yürümez: giremeyen bayi denemeyi
 * bırakır. Artık bağlantı e-postasına gider, şifresini kendisi yeniler.
 *
 * ── KURALLAR ─────────────────────────────────────────────────────────────
 *   · Cevap her zaman aynı: adres kayıtlı olsun olmasın "gönderdik" denir
 *     (hangi e-postanın müşterimiz olduğu dışarıdan öğrenilemez).
 *   · Bağlantı 30 dakika geçerli, tek kullanımlık. Jeton saklanmaz, yalnız
 *     SHA-256 özeti. Yeni şifre girilince o adresin bütün bağlantıları ölür.
 *   · Aynı adres birden çok bayide kullanıcıysa (e-posta bayi başına
 *     benzersiz) hepsinin şifresi birlikte yenilenir: adresin sahibi o.
 *   · Demo bayileri ve kapatılmış kullanıcılar sıfırlanmaz.
 *   · Hız: IP başına 15 dakikada 5, adres başına saatte 3 istek.
 *   · E-posta gönderimi kurulu değilse (Gmail anahtarı yok) bağlantı
 *     üretilmez; ekran WhatsApp'a yönlendirir.
 */
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { epostaGonder, gmailAyarli, siteAdresi } from '@/lib/sahip-bildirim';
import { writeAudit } from '@/lib/audit';

export const GECERLILIK_DK = 30;
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ozet = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

// ── HIZ SINIRI (bellekte; tek sunucu) ──────────────────────────────────
const ipIstekleri = new Map<string, number[]>();
const adresIstekleri = new Map<string, number[]>();
function sayac(m: Map<string, number[]>, anahtar: string, pencere: number, azami: number, simdi: number): boolean {
  if (m.size > 5000) m.clear();
  const l = (m.get(anahtar) ?? []).filter((t) => simdi - t < pencere);
  m.set(anahtar, l);
  if (l.length >= azami) return false;
  l.push(simdi);
  return true;
}
export function sifirlamaSiniriniSifirla(): void {
  ipIstekleri.clear();
  adresIstekleri.clear();
}

export type IstekSonucu =
  | { durum: 'TAMAM' } // kayıtlıysa bağlantı gitti (kayıtlı olmasa da aynı cevap)
  | { durum: 'GECERSIZ' } // e-posta biçimi bozuk
  | { durum: 'SINIR' }
  | { durum: 'EPOSTA_KAPALI' }; // gönderim kurulu değil: WhatsApp

export async function sifirlamaIste(ham: unknown, ip: string | null, dil: 'tr' | 'en', simdi = Date.now()): Promise<IstekSonucu> {
  const eposta = (typeof ham === 'string' ? ham : '').trim().toLowerCase().slice(0, 120);
  if (!EPOSTA.test(eposta)) return { durum: 'GECERSIZ' };
  if (ip && !sayac(ipIstekleri, ip, 15 * 60_000, 5, simdi)) return { durum: 'SINIR' };
  if (!gmailAyarli()) return { durum: 'EPOSTA_KAPALI' };
  // Adres sınırı dolunca da "TAMAM": sınır, adresin kayıtlı olup olmadığını ele vermesin.
  if (!sayac(adresIstekleri, eposta, 60 * 60_000, 3, simdi)) return { durum: 'TAMAM' };

  const kullanicilar = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u."id" FROM "User" u JOIN "Tenant" t ON t."id" = u."tenantId"
    WHERE lower(u."email") = ${eposta} AND u."isActive" = true AND t."demo" = false AND t."deletedAt" IS NULL`;
  if (!kullanicilar.length) return { durum: 'TAMAM' };

  const jeton = randomBytes(32).toString('base64url');
  await prisma.sifreSifirlama.create({
    data: { eposta, tokenOzeti: ozet(jeton), bitis: new Date(simdi + GECERLILIK_DK * 60_000), ip: ip?.slice(0, 60) ?? null },
  });
  const baglanti = `${siteAdresi()}/sifre-yenile?t=${jeton}`;
  const metin = dil === 'en'
    ? {
        konu: 'Nextus Servis — reset your password',
        satirlar: [
          'Someone (hopefully you) asked to reset the password of your Nextus Servis account.',
          '', `Set a new password here (valid for ${GECERLILIK_DK} minutes, works once):`, baglanti, '',
          'If you did not ask for this, ignore this e-mail; your password stays the same.',
        ],
      }
    : {
        konu: 'Nextus Servis — şifre yenileme',
        satirlar: [
          'Nextus Servis hesabınızın şifresini yenilemek için bir istek aldık.',
          '', `Yeni şifrenizi buradan belirleyin (${GECERLILIK_DK} dakika geçerli, bir kez kullanılır):`, baglanti, '',
          'Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.',
        ],
      };
  await epostaGonder(eposta, metin.konu, metin.satirlar);
  return { durum: 'TAMAM' };
}

export type YenilemeSonucu = { durum: 'TAMAM'; eposta: string } | { durum: 'GECERSIZ' } | { durum: 'SIFRE_KISA' };

/** Bağlantıdaki jeton hâlâ geçerli mi (ekran formu açmadan önce sorar). */
export async function baglantiGecerli(jeton: unknown, simdi = Date.now()): Promise<boolean> {
  if (typeof jeton !== 'string' || jeton.length < 20 || jeton.length > 100) return false;
  const k = await prisma.sifreSifirlama.findUnique({ where: { tokenOzeti: ozet(jeton) }, select: { bitis: true, kullanildi: true } });
  return Boolean(k && !k.kullanildi && k.bitis.getTime() > simdi);
}

export async function sifreYenile(jeton: unknown, sifre: unknown, ip: string | null, simdi = Date.now()): Promise<YenilemeSonucu> {
  if (typeof jeton !== 'string' || jeton.length < 20 || jeton.length > 100) return { durum: 'GECERSIZ' };
  // bcrypt 72 baytın ötesini görmez: daha uzun şifre sessizce kırpılırdı.
  if (typeof sifre !== 'string' || sifre.length < 8 || Buffer.byteLength(sifre, 'utf8') > 72) return { durum: 'SIFRE_KISA' };

  // Tek kullanım: "henüz kullanılmamış ve süresi geçmemiş" koşuluyla işaretle.
  // Aynı bağlantı iki sekmeden aynı anda gönderilse de yalnız biri geçer.
  const k = await prisma.sifreSifirlama.findUnique({ where: { tokenOzeti: ozet(jeton) } });
  if (!k) return { durum: 'GECERSIZ' };
  const isaret = await prisma.sifreSifirlama.updateMany({
    where: { id: k.id, kullanildi: null, bitis: { gt: new Date(simdi) } },
    data: { kullanildi: new Date(simdi) },
  });
  if (isaret.count !== 1) return { durum: 'GECERSIZ' };

  const kullanicilar = await prisma.$queryRaw<{ id: string; tenantId: string; name: string }[]>`
    SELECT u."id", u."tenantId", u."name" FROM "User" u JOIN "Tenant" t ON t."id" = u."tenantId"
    WHERE lower(u."email") = ${k.eposta} AND u."isActive" = true AND t."demo" = false AND t."deletedAt" IS NULL`;
  if (!kullanicilar.length) return { durum: 'GECERSIZ' };

  const passwordHash = await bcrypt.hash(sifre, 12);
  await prisma.user.updateMany({ where: { id: { in: kullanicilar.map((u) => u.id) } }, data: { passwordHash } });
  // Aynı adrese giden öteki bağlantılar da ölür.
  await prisma.sifreSifirlama.updateMany({ where: { eposta: k.eposta, kullanildi: null }, data: { kullanildi: new Date(simdi) } });
  for (const u of kullanicilar) {
    await writeAudit({
      tenantId: u.tenantId, userId: u.id, action: 'SIFRE_SIFIRLANDI', entityType: 'User', entityId: u.id,
      newValue: { kanal: 'eposta' }, ipAddress: ip, actorType: 'USER', actorName: u.name,
    }).catch(() => {});
  }
  return { durum: 'TAMAM', eposta: k.eposta };
}
