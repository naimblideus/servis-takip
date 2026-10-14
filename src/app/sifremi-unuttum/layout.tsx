import type { Metadata } from 'next';
import { sunucuDili } from '@/lib/i18n/sunucu';

export async function generateMetadata(): Promise<Metadata> {
  const en = (await sunucuDili()) === 'en';
  return { title: en ? 'Forgot password — Nextus Servis' : 'Şifremi unuttum — Nextus Servis', robots: { index: false } };
}

export default function SifremiUnuttumDuzeni({ children }: { children: React.ReactNode }) {
  return children;
}
