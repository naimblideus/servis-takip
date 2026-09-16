'use client';

import Link from 'next/link';
import YazdirBari from './YazdirBari';

/**
 * Cihaz dökümü / sayaç föyü yazdırma barı.
 *
 * İki hali var: sayaç sütunu DOLU (döküm) ve BOŞ (teknisyenin elle
 * dolduracağı föy). Aradaki geçiş burada duruyor, çünkü bayi hangisini
 * istediğini genelde önizlemeyi görünce anlıyor.
 */
export default function DokumPrintButton({ customerId, blank, count }: { customerId: string; blank: boolean; count: number }) {
    return (
        <YazdirBari
            baslik={blank ? 'Sayaç föyü' : 'Cihaz dökümü'}
            ayrinti={`${count} cihaz`}
            geriHref={`/customers/${customerId}`}
            geriMetin="Müşteri"
        >
            <Link
                href={`/customers/${customerId}/cihaz-dokumu${blank ? '' : '?bos=1'}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
            >
                {blank ? 'Sayaçlı hali' : 'Sayaç sütunu boş'}
            </Link>
        </YazdirBari>
    );
}
