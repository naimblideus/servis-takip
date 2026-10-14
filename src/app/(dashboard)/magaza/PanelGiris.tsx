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
 */
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
            onClick={() => setTimeout(() => setDavet(null), 500)}
            style={{
              display: 'inline-block', marginTop: 8, padding: '0.6rem 1rem', background: '#16a34a', color: 'white',
              borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
            }}
          >
            {m.paneliAc} →
          </a>
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
