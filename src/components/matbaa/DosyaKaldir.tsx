'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDil } from '@/lib/i18n/client';
import { matbaaMetni } from '@/lib/matbaa-metin';

/** Yanlış yüklenen dosyayı kaldırır (onay sorar; içerik depodan silinir). */
export default function DosyaKaldir({ id }: { id: string }) {
  const router = useRouter();
  const { dil } = useDil();
  const m = matbaaMetni(dil);
  const [mesgul, setMesgul] = useState(false);
  async function kaldir() {
    if (!window.confirm(m.dosyaKaldirOnay)) return;
    setMesgul(true);
    await fetch(`/api/matbaa/dosyalar/${id}`, { method: 'DELETE' }).catch(() => null);
    setMesgul(false);
    router.refresh();
  }
  return <button type="button" onClick={kaldir} disabled={mesgul} className="text-xs text-gray-500 underline disabled:opacity-50">{m.dosyaKaldir}</button>;
}
