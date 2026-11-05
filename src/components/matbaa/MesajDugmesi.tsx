'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Tek dokunuşla WhatsApp: bağlantı açılır, metin hazır gelir, gönderen
 * personeldir. Bağlantı gerçek <a>: window.open pencere engelleyiciye takılır.
 * Dokunuş işin geçmişine yazılır; "hazır" mesajı Bugün'deki satırı kapatır.
 */
export default function MesajDugmesi({ isId, tur, url, etiket, ikincil = false }: { isId: string; tur: string; url: string; etiket: string; ikincil?: boolean }) {
  const router = useRouter();

  function kaydet() {
    // keepalive: telefonda WhatsApp açılınca sayfa arka plana düşer, istek kesilmesin.
    fetch(`/api/matbaa/isler/${isId}/mesaj`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tur }) })
      .then(() => router.refresh()).catch(() => {});
  }

  // Demoda koruma (DemoBaglantiKoruma) tıklamayı önden alıp önizleme açıyor; satır yine kapansın.
  const bag = useRef<HTMLAnchorElement>(null);
  const sonKaydet = useRef(kaydet);
  useEffect(() => { sonKaydet.current = kaydet; });
  useEffect(() => {
    const a = bag.current;
    if (!a) return;
    const dinle = () => sonKaydet.current();
    a.addEventListener('demo-baglanti', dinle);
    return () => a.removeEventListener('demo-baglanti', dinle);
  }, []);

  return (
    <a ref={bag} href={url} target="_blank" rel="noopener noreferrer" onClick={kaydet}
      className={ikincil
        ? 'inline-block shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
        : 'inline-block shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800'}>
      {etiket}
    </a>
  );
}
