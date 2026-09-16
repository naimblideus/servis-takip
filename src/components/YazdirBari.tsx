'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * YAZDIRMA ÖNİZLEME BARI — üç ekranda birden kullanılıyor.
 *
 * ── NİYE TEK BİLEŞEN ─────────────────────────────────────────────────────
 * Aynı bar üç yerde ayrı ayrı yazılmıştı (fiş, toplu icmal, cihaz dökümü) ve
 * üçü de aynı kusuru taşıyordu: bar EKRAN genişliğinde, düğmeler en sağda,
 * altındaki A4 sayfa ise 794 pikselde ortada duruyordu. Geniş ekranda
 * "Yazdır" düğmesi belgenin metrelerce sağında kalıyor, ekran iki ayrı
 * hizadan oluşuyordu. Ayrı ayrı düzeltmek, dördüncü ekran eklendiğinde aynı
 * kusurun geri gelmesi demekti.
 *
 * ── HİZA BELGEYE GÖRE ────────────────────────────────────────────────────
 * Barın İÇİ de 794 piksel ve ortalanmış. Böylece "← Geri" belgenin sol
 * kenarıyla, "Yazdır" sağ kenarıyla aynı hizada duruyor: ekran tek bir
 * belge gibi okunuyor.
 *
 * Yazdırırken bar görünmez (`no-print`).
 */
export interface YazdirBariProps {
  /** Sol taraftaki başlık — ne yazdırılıyor. */
  baslik: string;
  /** Başlığın yanındaki sessiz ayrıntı: "12 fiş", "9 cihaz". */
  ayrinti?: string;
  /** Geri dönülecek yer. Verilmezse tarayıcı geçmişi kullanılır. */
  geriHref?: string;
  geriMetin?: string;
  /** Yazdır düğmesinden ÖNCE gelen ek denetimler. */
  children?: ReactNode;
}

/** A4 dikey genişliği (96 dpi). Belgelerin hepsi bu genişlikte. */
const A4 = 794;

/**
 * Belge sarmalayıcısının yan boşluğu (`.print-wrapper { padding: 2.5rem }`).
 * Barın içi TAM olarak belgenin kutusuna oturmalı; yoksa geniş ekranda 794
 * pikselde, dar ekranda ise boşluk farkı kadar kayar. Bu yüzden genişlik
 * "en fazla A4, ama ekran darsa iki yandan 2.5rem içeride" diye yazılıyor —
 * belgenin kendisiyle aynı kural.
 */
const KUTU: React.CSSProperties = {
  width: `min(${A4}px, calc(100% - 5rem))`,
  marginInline: 'auto',
};

export default function YazdirBari({
  baslik, ayrinti, geriHref, geriMetin = 'Geri', children,
}: YazdirBariProps) {
  return (
    <div className="no-print sticky top-0 z-20 border-b border-gray-700 bg-gray-800 print:hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-3 py-3"
        style={KUTU}
      >
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white">{baslik}</span>
          {ayrinti && <span className="ml-2 text-sm text-gray-400">{ayrinti}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {geriHref ? (
            <Link href={geriHref}
              className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
              ← {geriMetin}
            </Link>
          ) : (
            <button type="button" onClick={() => window.history.back()}
              className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
              ← {geriMetin}
            </button>
          )}

          {children}

          <button type="button" onClick={() => window.print()}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
