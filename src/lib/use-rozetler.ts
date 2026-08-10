'use client';

import { useEffect, useState } from 'react';

/**
 * Menü rozetleri — TEK yoklama, kaç bileşen kullanırsa kullansın.
 *
 * NEDEN MODÜL DÜZEYİNDE TEK ZAMANLAYICI: kenar menü ve alt menü aynı anda
 * mount oluyor (biri masaüstünde, diğeri mobilde GÖRÜNÜYOR ama ikisi de
 * yükleniyor). Her biri kendi setInterval'ini kursaydı aynı uca dakikada iki
 * istek giderdi. Abone sayısı sıfıra düşünce zamanlayıcı da duruyor.
 */

export interface Rozetler {
  market: number;
  sayacEposta: number;
  musteriBildirim: number;
}

const BOS: Rozetler = { market: 0, sayacEposta: 0, musteriBildirim: 0 };
const ARALIK_MS = 60_000;

let sonDeger: Rozetler = BOS;
let zamanlayici: ReturnType<typeof setInterval> | null = null;
const aboneler = new Set<(r: Rozetler) => void>();

async function getir() {
  try {
    const r = await fetch('/api/rozetler');
    if (!r.ok) return;
    const d = await r.json();
    sonDeger = {
      market: d.market || 0,
      sayacEposta: d.sayacEposta || 0,
      musteriBildirim: d.musteriBildirim || 0,
    };
    aboneler.forEach((f) => f(sonDeger));
  } catch { /* ağ hatası rozeti sıfırlamasın — eski değer kalsın */ }
}

export function useRozetler(): Rozetler {
  const [deger, setDeger] = useState<Rozetler>(sonDeger);

  useEffect(() => {
    aboneler.add(setDeger);
    if (!zamanlayici) {
      getir();
      zamanlayici = setInterval(getir, ARALIK_MS);
    }
    return () => {
      aboneler.delete(setDeger);
      if (aboneler.size === 0 && zamanlayici) {
        clearInterval(zamanlayici);
        zamanlayici = null;
      }
    };
  }, []);

  return deger;
}
