'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Sunucu sayfasını aralıkla tazeler (pano, TV). Sekme arka plandayken durur. */
export default function OtomatikYenile({ saniye = 30 }: { saniye?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, saniye * 1000);
    return () => clearInterval(id);
  }, [router, saniye]);
  return null;
}
