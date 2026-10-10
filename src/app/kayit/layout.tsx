import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '14 gün ücretsiz deneyin — Nextus Servis',
  description: 'Kiralık cihaz ve teknik servis yazılımı. Hesabınız hemen açılır; kredi kartı istenmez.',
};

export default function KayitDuzeni({ children }: { children: React.ReactNode }) {
  return children;
}
