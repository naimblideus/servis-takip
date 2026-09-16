'use client';

import Link from 'next/link';
import YazdirBari from './YazdirBari';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

/**
 * Cihaz dökümü / sayaç föyü yazdırma barı.
 *
 * İki hali var: sayaç sütunu DOLU (döküm) ve BOŞ (teknisyenin elle
 * dolduracağı föy). Aradaki geçiş burada duruyor, çünkü bayi hangisini
 * istediğini genelde önizlemeyi görünce anlıyor.
 */
export default function DokumPrintButton({ customerId, blank, count }: { customerId: string; blank: boolean; count: number }) {
    const t = useT();
    return (
        <YazdirBari
            baslik={blank ? t.ortak.sayacFoyu : t.ortak.cihazDokumu}
            ayrinti={doldur(t.ortak.cihazAdet, { n: count })}
            geriHref={`/customers/${customerId}`}
            geriMetin={t.genel.musteri}
        >
            <Link
                href={`/customers/${customerId}/cihaz-dokumu${blank ? '' : '?bos=1'}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
            >
                {blank ? t.ortak.sayacliHali : t.ortak.sayacBos}
            </Link>
        </YazdirBari>
    );
}
