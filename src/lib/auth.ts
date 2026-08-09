import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyTOTP, hashRecoveryCode } from '@/lib/totp';
import { writeAudit } from '@/lib/audit';

/**
 * ── KURUMSAL GİRİŞ (SSO) ─────────────────────────────────────────────────
 * Google Workspace ve Microsoft Entra ID ile giriş. Büyük müşterinin BT'si
 * "kullanıcılarımız ayrı bir şifre tutmasın, hesabı kapatınca erişim de
 * kapansın" ister; bunun cevabı SSO'dur.
 *
 * TEMEL KURAL: SSO KULLANICI OLUŞTURMAZ. Google/Microsoft hesabı olan herkes
 * sisteme giremez — yalnızca bayinin panelinde ZATEN TANIMLI ve AKTİF bir
 * kullanıcının e-postasıyla gelen giriş kabul edilir. Kullanıcı yönetimi
 * bayide kalır; SSO sadece şifrenin yerini alır.
 *
 * Sağlayıcılar yalnız ortam değişkenleri tanımlıysa açılır — anahtar yoksa
 * giriş ekranında düğme de görünmez, uygulama açılışta patlamaz.
 */
const ssoSaglayicilari = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  ssoSaglayicilari.push(Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    allowDangerousEmailAccountLinking: false,
  }));
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  ssoSaglayicilari.push(MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    // Varsayılanı BİLEREK daraltıyoruz: next-auth'un varsayılanı "common",
    // yani kişisel Microsoft hesapları da girebilir. Kişisel bir hesap iş
    // e-postasıyla açılabildiği için bu bir risktir. "organizations" yalnız
    // iş/okul hesaplarına izin verir. Tek bir firmaya kilitlemek için
    // AUTH_MICROSOFT_ENTRA_ID_ISSUER'a firmanın dizin kimliğini verin.
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
      || 'https://login.microsoftonline.com/organizations/v2.0',
  }));
}

/** Giriş ekranı hangi SSO düğmelerini göstereceğini buradan öğrenir. */
export const AKTIF_SSO = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  microsoft: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET),
};

/**
 * SSO ile gelen e-postayı tanımlı kullanıcıya bağlar.
 * Tek bir aktif eşleşme yoksa giriş REDDEDİLİR — belirsizliği tahminle çözmeyiz.
 */
async function ssoKullaniciBul(eposta: string) {
  const adaylar = await prisma.user.findMany({
    where: { email: { equals: eposta, mode: 'insensitive' }, isActive: true },
    include: { tenant: { select: { name: true, isActive: true, deletedAt: true } } },
  });
  const uygun = adaylar.filter((u) => u.tenant.isActive && !u.tenant.deletedAt);
  if (uygun.length !== 1) return { user: null, sebep: uygun.length === 0 ? 'tanimsiz' : 'coklu' };
  return { user: uygun[0], sebep: null };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...ssoSaglayicilari,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
        totp: { label: 'Doğrulama Kodu', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // E-posta bayi bazında benzersiz (@@unique([tenantId, email])) — yani AYNI
        // e-posta iki bayide olabilir. findFirst yalnız birini döndürdüğü için
        // ikinci bayideki kullanıcı hiç giremezdi. Şifresi tutan adayı arıyoruz.
        const adaylar = await prisma.user.findMany({
          where: { email: credentials.email as string, isActive: true },
          include: { tenant: true },
        });
        if (adaylar.length === 0) return null;

        let user: (typeof adaylar)[number] | null = null;
        for (const aday of adaylar) {
          if (await bcrypt.compare(credentials.password as string, aday.passwordHash)) { user = aday; break; }
        }
        if (!user) return null;

        // ── İKİ ADIMLI DOĞRULAMA ──
        // Açıksa şifre TEK BAŞINA yetmez: geçerli TOTP kodu ya da tek-kullanımlık kurtarma kodu şart.
        if (user.totpEnabled && user.totpSecret) {
          const raw = String((credentials as any).totp || '').trim();
          if (!raw) return null;

          const counter = verifyTOTP(user.totpSecret, raw, { lastCounter: user.totpLastCounter });
          if (counter != null) {
            // Aynı kodun ikinci kez kullanılmasını engelle
            await prisma.user.update({ where: { id: user.id }, data: { totpLastCounter: counter } });
          } else {
            // Kurtarma kodu — telefon kaybolduğunda; kullanılan kod listeden düşer
            const h = hashRecoveryCode(raw);
            const codes = user.recoveryCodes || [];
            if (!codes.includes(h)) return null;
            await prisma.user.update({
              where: { id: user.id },
              data: { recoveryCodes: codes.filter((c) => c !== h) },
            });
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: (user as any).tenant.name,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * SSO kapısı. Credentials girişi authorize()'da zaten doğrulandı; burada
     * yalnız OAuth girişleri süzülür. Reddedince kullanıcıya SEBEBİ söylenir
     * (giriş ekranı ?hata= ile karşılık gösterir) — "bir hata oluştu" diyen
     * bir SSO, BT ekibinin gününü yakar.
     */
    async signIn({ user, account }) {
      if (!account || account.provider === 'credentials') return true;

      const eposta = user.email?.trim().toLowerCase();
      if (!eposta) return '/login?hata=sso-eposta-yok';

      const { user: kayitli, sebep } = await ssoKullaniciBul(eposta);
      if (!kayitli) return `/login?hata=sso-${sebep}`;

      // Son giriş için ayrı bir sütun yok; denetim kaydı zaten "kim ne zaman girdi"yi tutuyor.
      await writeAudit({
        tenantId: kayitli.tenantId,
        userId: kayitli.id,
        action: 'GIRIS_SSO',
        entityType: 'User',
        entityId: kayitli.id,
        newValue: { saglayici: account.provider, eposta },
        actorType: 'USER',
        actorName: kayitli.name ?? kayitli.email,
      });
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
      }
      // SSO'da `user` Google/Microsoft profilidir; rol ve bayi bilgisi onda yok.
      // Oturumun yetkileri HER ZAMAN kendi kullanıcı kaydımızdan gelir.
      if (account && account.provider !== 'credentials') {
        const eposta = (user?.email ?? token.email)?.toString().trim().toLowerCase();
        const { user: kayitli } = eposta ? await ssoKullaniciBul(eposta) : { user: null };
        if (!kayitli) return null; // eşleşme yoksa oturum kurulmaz
        token.id = kayitli.id;
        token.role = kayitli.role;
        token.tenantId = kayitli.tenantId;
        token.tenantName = kayitli.tenant.name;
        token.name = kayitli.name;
        token.email = kayitli.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenantName = token.tenantName;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
});