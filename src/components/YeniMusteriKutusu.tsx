'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

export interface EklenenMusteri {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

/**
 * Aranan müşteri listede yoksa yerinde açılan kutu: ad + telefon → "Kaydet ve seç".
 * Fiş ekranı ve cihaz formu ortak kullanır; kural sunucuda (lib/musteri-ekle).
 * Numara zaten kayıtlıysa sunucu mevcut müşteriyi döner: o seçilir, `vardi` true.
 *
 * Telefon zorunlu kalır: müşteriye ulaşmanın yolu ve müşteri kaydı onun üstüne
 * kurulu. Kısaltılan şey ekran (müşteri sayfasına gidip dönmek), veri değil.
 *
 * Kutu çoğu yerde bir <form>'un içinde durur: Enter formu göndermesin diye
 * kendi düğmesine bağlanır, düğmeler type="button".
 */
export default function YeniMusteriKutusu({
  ilk,
  onSecildi,
  onIptal,
}: {
  ilk: { ad: string; telefon: string };
  onSecildi: (musteri: EklenenMusteri, vardi: boolean) => void;
  onIptal: () => void;
}) {
  const sz = useT();
  const [m, setM] = useState(ilk);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const eksik = !m.ad.trim() || !m.telefon.trim();

  const kaydet = async () => {
    if (kaydediliyor || eksik) return;
    setHata(null);
    setKaydediliyor(true);
    try {
      const r = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: m.ad, phone: m.telefon }),
      });
      const d = await r.json().catch(() => ({}));
      const kayit = r.ok ? d : d.kod === 'MUSTERI_TELEFON_KAYITLI' ? d.musteri : null;
      if (!kayit?.id) {
        setHata(d.error || sz.genel.baglantiHatasi);
        return;
      }
      onSecildi({ id: kayit.id, name: kayit.name, phone: kayit.phone, address: kayit.address ?? null }, !r.ok);
    } catch {
      setHata(sz.genel.baglantiHatasi);
    } finally {
      setKaydediliyor(false);
    }
  };

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      kaydet();
    }
  };

  return (
    <div style={{ marginBottom: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '0.9rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div>
          <label style={LABEL}>{sz.fisYeni.musteriAdi}</label>
          <input style={INPUT} value={m.ad} autoFocus={!m.ad} onChange={(e) => setM({ ...m, ad: e.target.value })} onKeyDown={enter} />
        </div>
        <div>
          <label style={LABEL}>{sz.fisDetay.telefon}</label>
          <input
            style={INPUT}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus={!!m.ad}
            value={m.telefon}
            placeholder={sz.musteri.telefonYer}
            onChange={(e) => setM({ ...m, telefon: e.target.value })}
            onKeyDown={enter}
          />
        </div>
      </div>
      {hata && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {hata}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={kaydet}
          disabled={kaydediliyor || eksik}
          style={{ padding: '0.55rem 1.1rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', opacity: kaydediliyor || eksik ? 0.6 : 1 }}
        >
          {kaydediliyor ? sz.genel.kaydediliyor : sz.fisYeni.yeniMusteriKaydet}
        </button>
        <button
          type="button"
          onClick={onIptal}
          style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}
        >
          {sz.genel.iptal}
        </button>
      </div>
    </div>
  );
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };

/** Arama kutusuna numara yazıldıysa numara telefona, ad boş gelir. */
export function aramadanIlk(q: string): { ad: string; telefon: string } {
  const s = q.trim();
  return /^[\d\s+()-]{7,}$/.test(s) ? { ad: '', telefon: s } : { ad: s, telefon: '' };
}
