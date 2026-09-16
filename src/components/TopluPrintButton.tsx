'use client';

import YazdirBari from './YazdirBari';

/** Toplu icmal yazdırma önizlemesinin üst barı. */
export default function TopluPrintButton({ count }: { count: number }) {
    return <YazdirBari baslik="İcmal önizleme" ayrinti={`${count} fiş`} />;
}
