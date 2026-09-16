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
import { bicimYap, VARSAYILAN_BIRIM, type ParaBirimi } from '../bicim';

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
  return useMemo(() => bicimYap(dil, birim), [dil, birim]);
}
