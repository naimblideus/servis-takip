'use client';

/**
 * DİL — İSTEMCİ BAĞLAMI.
 *
 * Sunucu bileşeni çerezden dili, bayiden para birimini ve ülkeyi okuyup
 * buraya verir; istemci bileşenleri `useT()` ile sözlüğü, `useBicim()` ile
 * dile ve birime bağlı biçimlendiricileri alır. Hiçbir bileşen 'tr-TR' ya da
 * '₺' yazmak zorunda kalmaz.
 *
 * Sağlayıcı iç içe geçebilir: kökte yalnız dil (giriş sayfası için), panelde
 * dil + bayinin para birimi + ülke. İçteki kazanır.
 *
 * Sağlayıcı YOKSA Türkçe/TRY/TR varsayılır — yeni bir sayfa sağlayıcının
 * dışında kalırsa çökmesin, Türkçe açılsın.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { sozluk, VARSAYILAN_DIL, type Dil, type Sozluk } from './sozluk';
import {
  para, sayi, yuzde, tarih, tarihSaat, kisaTarih, ayYil,
  VARSAYILAN_BIRIM, type ParaBirimi,
} from '../bicim';

export interface DilBaglami {
  dil: Dil;
  birim: ParaBirimi;
  /** ISO 3166-1 alpha-2; TR'ye özgü modüller (e-Fatura, KDV) buna göre kapılanır. */
  ulke: string;
}

const Baglam = createContext<DilBaglami>({ dil: VARSAYILAN_DIL, birim: VARSAYILAN_BIRIM, ulke: 'TR' });

export function LocaleProvider({
  dil, birim, ulke, children,
}: { dil: Dil; birim?: ParaBirimi; ulke?: string; children: ReactNode }) {
  const ust = useContext(Baglam);
  const deger = useMemo<DilBaglami>(() => ({
    dil,
    birim: birim ?? ust.birim,
    ulke: ulke ?? ust.ulke,
  }), [dil, birim, ulke, ust.birim, ust.ulke]);
  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useDil(): DilBaglami {
  return useContext(Baglam);
}

export function useT(): Sozluk {
  const { dil } = useContext(Baglam);
  return useMemo(() => sozluk(dil), [dil]);
}

/** Dile ve bayinin para birimine BAĞLI biçimlendiriciler. */
export function useBicim() {
  const { dil, birim } = useContext(Baglam);
  return useMemo(() => ({
    para: (n: number | string | null | undefined, kesir?: number) => para(n, { dil, birim, kesir }),
    sayi: (n: number | string | null | undefined, kesir?: number) => sayi(n, dil, kesir),
    yuzde: (n: number | null | undefined, kesir?: number) => yuzde(n, dil, kesir),
    tarih: (d: Date | string | number | null | undefined) => tarih(d, dil),
    tarihSaat: (d: Date | string | number | null | undefined) => tarihSaat(d, dil),
    kisaTarih: (d: Date | string | number | null | undefined) => kisaTarih(d, dil),
    ayYil: (d: Date | string | number | null | undefined) => ayYil(d, dil),
    dil, birim,
  }), [dil, birim]);
}
