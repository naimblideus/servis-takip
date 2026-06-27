import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Landing from './_landing/Landing';

export const metadata: Metadata = {
  title: 'Servis Takip — Kiralık Cihaz Servis & Sayaç-Kira Yönetimi',
  description:
    'Fotokopi/yazıcı kiralama ve servis bayileri için: sayacı okur, kira + servisi tek faturada otomatik birleştirir, kaçan geliri yakalar. 14 gün ücretsiz, kart yok.',
};

// Halka açık ana sayfa (landing). Girişli kullanıcı doğrudan panele gider.
export default async function HomePage() {
  const session = await auth();
  if (session) redirect('/dashboard');
  return <Landing />;
}
