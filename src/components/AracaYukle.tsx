'use client';

import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Teslimat {
  no: string;
  musteriId: string | null;
  alici: string;
  kalemler: { ad: string; adet: number }[];
}

/**
 * ARACA YÜKLENECEK — mağazada "Teknisyen getirsin" denmiş siparişler.
 * Üstte toplam yük (aynı ürün birleşik), altta sipariş başına müşteri ve
 * tek dokunuşla "Rotaya ekle". Sipariş yoksa hiç görünmez.
 */
export function AracaYukle({ rotada, ekle }: { rotada: string[]; ekle: (musteriId: string) => void }) {
  const t = useT();
  const [liste, setListe] = useState<Teslimat[]>([]);

  useEffect(() => {
    fetch('/api/rota/teslimatlar')
      .then((r) => r.json())
      .then((d) => setListe(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, []);

  const yuk = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of liste) for (const k of s.kalemler) m.set(k.ad, (m.get(k.ad) ?? 0) + k.adet);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [liste]);

  if (!liste.length) return null;
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '0.9rem 1rem', margin: '0.75rem 0' }}>
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400e' }}>
        {doldur(t.rota.aracaYukle, { n: liste.length })}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#78350f', marginTop: 4 }}>
        {yuk.map(([ad, adet]) => `${adet}× ${ad}`).join(' · ')}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {liste.map((s) => {
          const ekli = !!s.musteriId && rotada.includes(s.musteriId);
          return (
            <div key={s.no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem' }}>
              <span style={{ minWidth: 0 }}>
                <b>{s.alici}</b> <span style={{ color: '#92400e' }}>· {s.no}</span>
              </span>
              {s.musteriId && (
                <button
                  type="button"
                  disabled={ekli}
                  onClick={() => ekle(s.musteriId!)}
                  style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid #d97706', background: ekli ? 'transparent' : '#d97706', color: ekli ? '#92400e' : 'white', fontWeight: 700, fontSize: '0.8rem', cursor: ekli ? 'default' : 'pointer', flexShrink: 0 }}
                >
                  {ekli ? t.rota.rotada : t.rota.rotayaEkle}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
