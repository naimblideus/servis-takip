'use client';

import YazdirBari from './YazdirBari';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

/** Toplu icmal yazdırma önizlemesinin üst barı. */
export default function TopluPrintButton({ count }: { count: number }) {
    const t = useT();
    return <YazdirBari baslik={t.ortak.icmalOnizleme} ayrinti={doldur(t.ortak.fisAdet, { n: count })} />;
}
