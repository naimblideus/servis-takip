'use client';

import { useState } from 'react';
import { useDil } from '@/lib/i18n/client';
import { magazaKurulumMetni } from '@/lib/magaza-kurulum-metin';

/**
 * "MAĞAZA PANELİNE GİRİN" — mağazası kurulu bayinin kendi paneline kapısı.
 *
 * Panel ayrı uygulamada ve girişi tek kullanımlık davetle (her cihaza ayrı
 * oturum). Eskiden davet yalnız platform sahibinden WhatsApp'la geliyordu:
 * bayi fiyat düzeltmek ya da yasal bilgileri girmek için birini beklerdi.
 * Burada kurulum ucu yeniden çağrılır; uç idempotent, mevcut mağaza için
 * yalnız yeni davet döner. Bağlantı ekranda düğme olarak gösterilir —
 * istekten sonra pencereyi kendiliğinden açmak tarayıcıda engellenebiliyor.
 *
 * KISAYOLLAR: aynı davet `?devam=/yonetim/…` ile paneli doğrudan o ekranda
 * açar. Davet tek kullanımlık ama mağaza, girişli tarayıcıdan gelen ikinci
 * kısayolu da istenen ekrana geçirir (nextus-magaza davet rotası).
 */
const KISAYOLLAR = [
  { yol: '/yonetim/sabah', ad: 'kisaSabah' },
  { yol: '/yonetim/kampanya', ad: 'kisaKampanya' },
  { yol: '/yonetim/siparisler', ad: 'kisaSiparis' },
  { yol: '/yonetim/ayarlar', ad: 'kisaAyarlar' },
] as const;

function hedefli(davet: string, yol: string): string {
  try {
    const u = new URL(davet);
    u.searchParams.set('devam', yol);
    return u.toString();
  } catch {
    return davet;
  }
}

export function PanelGiris() {
  const { dil } = useDil();
  const m = magazaKurulumMetni(dil);
  const [bekliyor, setBekliyor] = useState(false);
  const [davet, setDavet] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState('');
  const [hata, setHata] = useState('');

  async function iste() {
    setBekliyor(true);
    setHata('');
    setBilgi('');
    try {
      const r = await fetch('/api/magaza/kurulum', { method: 'POST' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setHata(j?.kod === 'YETKI' ? m.yoneticiDegil : j?.kod === 'DEMO' ? m.demo : m.hata);
        return;
      }
      if (j.durum === 'HAZIR' && j.davet) setDavet(j.davet);
      else setBilgi(j.durum === 'ADRES_BEKLIYOR' ? m.adresBaglaniyorAlt : m.panelTalep);
    } catch {
      setHata(m.hata);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.9rem 1rem', marginTop: 14 }}>
      {davet ? (
        <div role="status">
          <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>✓ {m.panelHazir}</div>
          <a
            href={davet}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setTimeout(() => setDavet(null), 60_000)}
            style={{
              display: 'inline-block', marginTop: 8, padding: '0.6rem 1rem', background: '#16a34a', color: 'white',
              borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
            }}
          >
            {m.paneliAc} →
          </a>
          <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: 10 }}>{m.kisayolBaslik}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {KISAYOLLAR.map((k) => (
              <a
                key={k.yol}
                href={hedefli(davet, k.yol)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827',
                  fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', background: 'white',
                }}
              >
                {m[k.ad]}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={iste}
            disabled={bekliyor}
            style={{
              padding: '0.6rem 1rem', background: bekliyor ? '#e5e7eb' : '#111827', color: bekliyor ? '#374151' : 'white',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', cursor: bekliyor ? 'wait' : 'pointer',
            }}
          >
            {bekliyor ? m.panelHazirlaniyor : m.panelDugme}
          </button>
          <span style={{ color: '#4b5563', fontSize: '0.82rem', flex: '1 1 260px', lineHeight: 1.5 }}>{m.panelAlt}</span>
        </div>
      )}
      {(bilgi || hata) && (
        <p role={hata ? 'alert' : 'status'} style={{ color: hata ? '#b91c1c' : '#1e3a8a', fontSize: '0.83rem', margin: '0.6rem 0 0' }}>
          {hata || bilgi}
        </p>
      )}
    </div>
  );
}
