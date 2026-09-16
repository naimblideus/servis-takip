/**
 * DİL KATMANI — saf kısım (sunucu ve istemci ortak).
 *
 * Burada `next/headers` YOK; bu dosya istemci bileşenlerinden de içe
 * aktarılıyor. Çerez okuma `sunucu.ts`'de, React bağlamı `client.tsx`'te.
 */
import { tr, type Sozluk } from './tr';
import { en } from './en';

export type { Sozluk };

export const DILLER = ['tr', 'en'] as const;
export type Dil = (typeof DILLER)[number];

export const VARSAYILAN_DIL: Dil = 'tr';

/** Dil tercihinin tutulduğu çerez. Bir yıl; her istekte veritabanına gitmesin. */
export const DIL_CEREZI = 'dil';

export const DIL_ADLARI: Record<Dil, string> = { tr: 'Türkçe', en: 'English' };

export function dilMi(x: unknown): x is Dil {
  return typeof x === 'string' && (DILLER as readonly string[]).includes(x);
}

const SOZLUKLER: Record<Dil, Sozluk> = { tr, en };

/** Bilinmeyen dilde Türkçe döner — boş ekran, yanlış dilden kötüdür. */
export function sozluk(dil: Dil | string | null | undefined): Sozluk {
  return dilMi(dil) ? SOZLUKLER[dil] : tr;
}

/**
 * Parametreli metin: '{n} gün kaldı' + {n: 3} → '3 gün kaldı'.
 *
 * Dize birleştirme (`${n} gün kaldı`) İngilizcede kelime sırasını bozar:
 * "3 days left" ile "{n} gün kaldı" aynı kalıba sığmaz, her dil kendi
 * sırasını sözlükte taşımalı. Bilinmeyen yer tutucu olduğu gibi kalır —
 * boş metin, eksik parametreden kötüdür.
 */
export function doldur(metin: string, degerler: Record<string, string | number>): string {
  return metin.replace(/\{(\w+)\}/g, (_, k) => (k in degerler ? String(degerler[k]) : `{${k}}`));
}
