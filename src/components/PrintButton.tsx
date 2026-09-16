'use client';

import YazdirBari from './YazdirBari';

/** Servis fişi yazdırma önizlemesinin üst barı. */
export default function PrintButton({ ticketId }: { ticketId: string }) {
    return (
        <YazdirBari
            baslik="Fiş önizleme"
            geriHref={`/tickets/${ticketId}`}
            geriMetin="Fişe dön"
        />
    );
}
