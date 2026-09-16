'use client';

import YazdirBari from './YazdirBari';
import { useT } from '@/lib/i18n/client';

/** Servis fişi yazdırma önizlemesinin üst barı. */
export default function PrintButton({ ticketId }: { ticketId: string }) {
    const t = useT();
    return (
        <YazdirBari
            baslik={t.ortak.fisOnizleme}
            geriHref={`/tickets/${ticketId}`}
            geriMetin={t.ortak.fiseDon}
        />
    );
}
