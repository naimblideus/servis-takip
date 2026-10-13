import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Şifremi unuttum — Nextus Servis',
  robots: { index: false },
};

export default function SifremiUnuttumDuzeni({ children }: { children: React.ReactNode }) {
  return children;
}
