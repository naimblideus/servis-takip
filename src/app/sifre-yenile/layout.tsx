import type { Metadata } from 'next';

// Adres çubuğunda tek kullanımlık jeton var: başka siteye "nereden geldim"
// bilgisiyle gitmesin, arama motoruna da girmesin.
export const metadata: Metadata = {
  title: 'Yeni şifre — Nextus Servis',
  referrer: 'no-referrer',
  robots: { index: false },
};

export default function SifreYenileDuzeni({ children }: { children: React.ReactNode }) {
  return children;
}
