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
import { sozluk, dilMi, DIL_CEREZI, VARSAYILAN_DIL, type Dil, type Sozluk } from './sozluk';
import { bicimYap, VARSAYILAN_BIRIM, type ParaBirimi } from '../bicim';

export interface DilBaglami {
  dil: Dil;
  birim: ParaBirimi;
  /** ISO 3166-1 alpha-2; TR'ye özgü modüller (e-Fatura, KDV) buna göre kapılanır. */
  ulke: string;
  /**
   * BAYİNİN dili — kullanıcının değil.
   *
   * Müşteriye giden her şey (WhatsApp mesajı, SMS, fatura, makbuz) bununla
   * yazılır: Türk bir bayinin İngilizce arayüz kullanan çalışanı düğmeye
   * bastığında müşteriye İngilizce mesaj gitmesi yanlış olurdu. Verilmezse
   * kullanıcının diline düşer (tek dilli kurulumda ikisi zaten aynı).
   */
  bayiDili: Dil;
}

const Baglam = createContext<DilBaglami>({
  dil: VARSAYILAN_DIL, birim: VARSAYILAN_BIRIM, ulke: 'TR', bayiDili: VARSAYILAN_DIL,
});

export function LocaleProvider({
  dil, birim, ulke, bayiDili, children,
}: { dil: Dil; birim?: ParaBirimi; ulke?: string; bayiDili?: Dil; children: ReactNode }) {
  const ust = useContext(Baglam);
  const deger = useMemo<DilBaglami>(() => ({
    dil,
    birim: birim ?? ust.birim,
    ulke: ulke ?? ust.ulke,
    bayiDili: bayiDili ?? dil,
  }), [dil, birim, ulke, bayiDili, ust.birim, ust.ulke]);
  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useDil(): DilBaglami {
  return useContext(Baglam);
}

/**
 * Sağlayıcı YOKKEN dil. Kök hata sınırı ve 404 gibi ekranlar layout'un
 * dışında çiziliyor; bağlamı okusalardı herkese Türkçe çıkarlardı.
 * Doğrudan çerezi okuyoruz — sunucudaki `sunucuDili` ile aynı çerez.
 */
export function cerezDili(): Dil {
  if (typeof document === 'undefined') return VARSAYILAN_DIL;
  const m = document.cookie.match(new RegExp(`(?:^|; )${DIL_CEREZI}=([^;]*)`));
  const d = m ? decodeURIComponent(m[1]) : '';
  return dilMi(d) ? d : VARSAYILAN_DIL;
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

/**
 * MÜŞTERİYE giden metin için sözlük + biçimlendirici: bayinin dilinde.
 * WhatsApp/SMS düğmeleri bunu kullanır, `useT()`/`useBicim()`i değil.
 */
export function useMusteriDili() {
  const { bayiDili, birim } = useContext(Baglam);
  return useMemo(() => ({
    dil: bayiDili, sz: sozluk(bayiDili), b: bicimYap(bayiDili, birim),
  }), [bayiDili, birim]);
}
