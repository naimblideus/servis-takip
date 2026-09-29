'use client';

/**
 * DENEME ŞERİDİ — denemedeki yöneticiye kalan gün.
 *
 * Eskiden bayi süresinin ne zaman dolacağını bilmiyordu; dolduğu an erişim
 * kilitleniyordu. Satın almaya karar vermiş biri için en kötü sürpriz.
 * Son 3 günde kırmızı. Abonelik ekranında zaten kalan gün yazdığı için
 * orada çizilmez.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

export default function DenemeSeridi({ kalanGun }: { kalanGun: number }) {
  const t = useT();
  const yol = usePathname();
  if (yol === '/abonelik') return null;
  const acil = kalanGun <= 3;
  return (
    <div className="print:hidden" role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
        padding: '0.55rem 1rem', fontSize: '0.85rem',
        background: acil ? '#fef2f2' : '#fffbeb', borderBottom: `1px solid ${acil ? '#fecaca' : '#fde68a'}`,
        color: acil ? '#991b1b' : '#92400e',
      }}>
      <span style={{ fontWeight: 600 }}>
        {kalanGun === 0 ? t.abonelik.denemeBugun : doldur(t.abonelik.denemeKalan, { n: kalanGun })}
      </span>
      <Link href="/abonelik" style={{ fontWeight: 700, color: acil ? '#991b1b' : '#92400e' }}>{t.abonelik.seritLink}</Link>
    </div>
  );
}
