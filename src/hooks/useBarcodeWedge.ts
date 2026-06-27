'use client';
import { useEffect, useRef } from 'react';

/**
 * USB barkod okuyucu (HID keyboard-wedge; 1D lazer veya 2D imager — Symbol/Zebra LS2208, DS2208 vb.)
 * klavye emülasyonu yapar: karakterleri çok hızlı "yazar" ve sonuna Enter koyar. Bu hook global
 * keydown'ı dinleyip hızlı diziyi (insan yazımından zamanlamayla ayırarak) yakalar; Enter'da onScan tetikler.
 *
 * - Bir INPUT/TEXTAREA odaktayken devre dışı kalır (elle yazım/okutma o alana gider, çakışma yok).
 * - interCharMs eşiği: okuyucu karakterleri <15ms'de basar, insan >80ms -> rahat ayrışır
 *   (yavaş/yüklü PC'lerde güvenli olsun diye varsayılan 50ms; gerekirse opts ile değiştirilebilir).
 * - minLength: çok kısa kazara dizileri eler.
 */
export function useBarcodeWedge(
  onScan: (code: string) => void,
  opts: { minLength?: number; interCharMs?: number; enabled?: boolean } = {}
) {
  const { minLength = 4, interCharMs = 50, enabled = true } = opts;
  const buf = useRef('');
  const last = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Alt/Meta basılıyken (ör. yanlış ayarlı okuyucunun gönderdiği Ctrl+T gibi kontrol
      // kombinasyonları) tuşu YOK SAY — barkod buffer'ı bozulmasın. (Tarayıcı kısayolunu JS
      // tamamen engelleyemez; asıl düzeltme okuyucu ayarındadır.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      const now = Date.now();
      if (now - last.current > interCharMs) buf.current = ''; // yavaş => insan, buffer'ı sıfırla
      last.current = now;

      if (e.key === 'Enter') {
        const code = buf.current.trim();
        buf.current = '';
        if (code.length >= minLength) {
          e.preventDefault();
          cb.current(code);
        }
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
    };
    window.addEventListener('keydown', onKey, true); // capture: input'lardan önce yakala
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, minLength, interCharMs]);
}
