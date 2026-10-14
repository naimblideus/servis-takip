'use client';

import { useState } from 'react';
import { useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { magazaKurulumMetni } from '@/lib/magaza-kurulum-metin';

type Sonuc =
  | { durum: 'HAZIR'; davet: string; urun: number }
  | { durum: 'ADRES_BEKLIYOR'; urun: number }
  | { durum: 'TALEP' };

/**
 * "MAĞAZAMI KURUN" — tek dokunuş. Sonuç ne olursa olsun bayiye ne olacağı
 * söylenir; hiçbir durumda "iletişime geçin" deyip boş bırakılmaz.
 */
export function MagazaIste({ yonetici }: { yonetici: boolean }) {
  const { dil } = useDil();
  const m = magazaKurulumMetni(dil);
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [hata, setHata] = useState('');

  async function iste() {
    setBekliyor(true);
    setHata('');
    try {
      const r = await fetch('/api/magaza/kurulum', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setHata(j?.kod === 'YETKI' ? m.yoneticiDegil : j?.kod === 'DEMO' ? m.demo : m.hata);
        return;
      }
      // Sayfa YENİLENMEZ: yenilense kurulu-mağaza görünümüne geçer ve tek
      // kullanımlık panel bağlantısı bayi görmeden kaybolurdu (yerelde
      // görüldü). Durum özeti bir sonraki ziyarette gelir.
      setSonuc(j as Sonuc);
    } catch {
      setHata(m.hata);
    } finally {
      setBekliyor(false);
    }
  }

  const kutu = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem', marginTop: 12 } as const;

  if (sonuc) {
    return (
      <div style={{ ...kutu, borderColor: '#86efac', background: '#f0fdf4' }} role="status">
        <div style={{ fontWeight: 700, color: '#166534' }}>
          ✓{' '}
          {sonuc.durum === 'HAZIR'
            ? sonuc.urun > 0
              ? doldur(m.hazir, { n: sonuc.urun })
              : m.hazirBos
            : sonuc.durum === 'ADRES_BEKLIYOR'
              ? doldur(m.adresBekliyor, { n: sonuc.urun })
              : m.talepAlindi}
        </div>
        {sonuc.durum === 'HAZIR' && (
          <>
            <a
              href={sonuc.davet}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', marginTop: 10, padding: '0.7rem 1.1rem', background: '#16a34a', color: 'white',
                borderRadius: 8, fontWeight: 700, textDecoration: 'none',
              }}
            >
              {m.paneliAc}
            </a>
            <p style={{ color: '#166534', fontSize: '0.83rem', margin: '0.6rem 0 0' }}>{m.hazirAlt}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={kutu}>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{m.baslik}</div>
      <p style={{ color: '#4b5563', fontSize: '0.88rem', margin: '0.35rem 0 0.8rem', lineHeight: 1.6 }}>{m.alt}</p>
      {yonetici ? (
        <button
          type="button"
          onClick={iste}
          disabled={bekliyor}
          style={{
            padding: '0.8rem 1.3rem', background: bekliyor ? '#7dd3fc' : '#0ea5e9', color: 'white', border: 'none',
            borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: bekliyor ? 'wait' : 'pointer',
          }}
        >
          {bekliyor ? m.kuruluyor : m.dugme}
        </button>
      ) : (
        <p style={{ color: '#92400e', fontSize: '0.85rem', margin: 0 }}>{m.yoneticiDegil}</p>
      )}
      {hata && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0.6rem 0 0' }}>
          {hata}
        </p>
      )}
    </div>
  );
}
