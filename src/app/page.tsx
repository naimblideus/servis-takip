import type { Metadata } from 'next';
import Landing from './_landing/Landing';

export const metadata: Metadata = {
  title: 'Nextus Servis — Kiralık Cihaz Servis & Sayaç-Kira Yönetimi',
  description:
    'Fotokopi/yazıcı kiralama ve servis bayileri için: sayacı okur, kira + servisi tek faturada otomatik birleştirir, kaçan geliri yakalar. 14 gün ücretsiz, kart yok.',
};

/**
 * Halka açık ana sayfa (landing).
 *
 * BURADA auth() ÇAĞRILMAZ — ve bu bilinçli. auth() çerez okuyor, çerez okumak
 * sayfayı DİNAMİK yapıyor: 555 KB'lık pazarlama sayfası her ziyaretçi için
 * sunucuda sıfırdan üretiliyor, hiçbir katmanda önbelleğe girmiyordu
 * (Cache-Control: no-store). 2 çekirdekli sunucuda bu, açılışı gözle görülür
 * yavaşlatıyordu.
 *
 * Girişli kullanıcıyı panele gönderme işi middleware'e taşındı: orada oturum
 * çerezine bakılıp yönlendirme yapılıyor, sayfa statik kalıyor.
 */
export default function HomePage() {
  return <Landing />;
}
