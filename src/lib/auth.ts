import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyTOTP, hashRecoveryCode } from '@/lib/totp';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
        totp: { label: 'Doğrulama Kodu', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email as string, isActive: true },
          include: { tenant: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
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