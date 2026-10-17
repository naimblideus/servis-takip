'use client';

/**
 * ANKET FORMU — müşterinin telefonunda.
 *
 * Tek soru, on bir büyük düğme. Telefonda iki satır (0–5, 6–10): tek satırda
 * düğme parmaktan küçük kalıyordu. Yorum isteğe bağlı; puan seçilmeden
 * "Gönder" basılamaz.
 *
 * <form> BİLEREK yok: sayfa tam yüklenmeden basılan bir form, yorumu adres
 * satırına (GET) yazardı. Düğme yalnız sayfa canlıyken iş görür.
 */
import { useState } from 'react';
import { sozluk, doldur, type Dil } from '@/lib/i18n/sozluk';
import { YORUM_AZAMI } from '@/lib/memnuniyet';

const PUANLAR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function AnketFormu({
  ticketId, anahtar, dil, bayiAdi, bayiTelefon,
}: {
  ticketId: string;
  anahtar: string;
  dil: Dil;
  bayiAdi: string;
  bayiTelefon: string | null;
}) {
  const sz = sozluk(dil).memnuniyet;
  const [puan, setPuan] = useState<number | null>(null);
  const [yorum, setYorum] = useState('');
  const [durum, setDurum] = useState<'FORM' | 'GONDERILIYOR' | 'TAMAM' | 'ZATEN'>('FORM');
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async () => {
    if (puan === null) { setHata(sz.puanSecin); return; }
    setDurum('GONDERILIYOR');
    setHata(null);
    try {
      const r = await fetch(`/api/public/anket/${encodeURIComponent(ticketId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Hata cümlesi sayfanın dilinde gelsin diye dil de gidiyor.
        body: JSON.stringify({ t: anahtar, puan, yorum, dil }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok) { setDurum(d?.durum === 'ZATEN' ? 'ZATEN' : 'TAMAM'); return; }
      setHata(d?.error || sz.gonderilemedi);
      setDurum('FORM');
    } catch {
      setHata(sz.baglantiHatasi);
      setDurum('FORM');
    }
  };

  if (durum === 'TAMAM' || durum === 'ZATEN') {
    const tel = bayiTelefon ? bayiTelefon.replace(/[^\d+]/g, '') : '';
    return (
      <div role="status" style={{ textAlign: 'center', padding: '0.75rem 0' }}>
        <div aria-hidden className="sa-check" style={{ fontSize: '2.5rem' }}>✅</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.5rem 0 0.35rem' }}>
          {durum === 'ZATEN' ? sz.zatenBaslik : sz.tesekkurBaslik}
        </h1>
        <p style={{ color: '#53617B', fontSize: '0.95rem', lineHeight: 1.55, margin: 0 }}>
          {durum === 'ZATEN' ? sz.zatenAlt : doldur(sz.tesekkurAlt, { bayi: bayiAdi })}
        </p>
        {/* Memnun olmayan müşteriye söz vermiyoruz ("sizi arayacağız"), yol gösteriyoruz. */}
        {durum === 'TAMAM' && puan !== null && puan <= 6 && tel && (
          <div style={{ marginTop: '1.1rem' }}>
            <p style={{ color: '#33405C', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 0.6rem' }}>{sz.dusukPuanAlt}</p>
            <a href={`tel:${tel}`} className="btn-primary" style={{ minHeight: 48, padding: '0.75rem 1.4rem', fontSize: '1rem' }}>
              {sz.bizeUlasin}
            </a>
          </div>
        )}
      </div>
    );
  }

  const gonderiyor = durum === 'GONDERILIYOR';

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, margin: '0 0 0.35rem' }}>{sz.soru}</h1>
      <p style={{ color: '#6C7A93', fontSize: '0.88rem', margin: '0 0 1rem' }}>{sz.olcekAlt}</p>

      <div role="radiogroup" aria-label={sz.soru} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.45rem' }}>
        {PUANLAR.map((p) => {
          const secili = puan === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={secili}
              aria-label={doldur(sz.puanAria, { n: p })}
              disabled={gonderiyor}
              onClick={() => { setPuan(p); setHata(null); }}
              style={{
                minHeight: 52, borderRadius: 12, fontSize: '1.15rem', fontWeight: 800,
                border: secili ? '2px solid #0F2253' : '1px solid #CFD7E4',
                background: secili ? '#0F2253' : '#FFFFFF',
                color: secili ? '#FFFFFF' : '#0F1E33',
                cursor: gonderiyor ? 'default' : 'pointer',
                fontVariantNumeric: 'tabular-nums',
                transition: 'background-color .12s ease, color .12s ease',
              }}
            >
              {p}
            </button>
          );
        })}
      </div>
      <div aria-hidden style={{ display: 'flex', justifyContent: 'space-between', color: '#6C7A93', fontSize: '0.78rem', marginTop: '0.45rem' }}>
        <span>{`0 · ${sz.olcekSol}`}</span>
        <span>{`${sz.olcekSag} · 10`}</span>
      </div>

      <label style={{ display: 'block', marginTop: '1.25rem' }}>
        <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#33405C', marginBottom: '0.4rem' }}>{sz.yorumEtiket}</span>
        {/* Yazı 16 px: daha küçüğü iOS'ta sayfayı yakınlaştırıyor. */}
        <textarea
          value={yorum}
          maxLength={YORUM_AZAMI}
          rows={4}
          disabled={gonderiyor}
          placeholder={sz.yorumYer}
          onChange={(e) => setYorum(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.8rem', border: '1px solid #CFD7E4', borderRadius: 12, fontSize: '16px', lineHeight: 1.45, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <span style={{ display: 'block', textAlign: 'right', color: '#98A3B8', fontSize: '0.75rem', marginTop: 2 }}>
          {`${yorum.length}/${YORUM_AZAMI}`}
        </span>
      </label>

      {hata && (
        <p role="alert" style={{ color: '#B93333', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>{hata}</p>
      )}

      <button
        type="button"
        onClick={gonder}
        disabled={puan === null || gonderiyor}
        className="btn-primary"
        style={{ width: '100%', minHeight: 52, marginTop: '0.9rem', fontSize: '1.05rem' }}
      >
        {gonderiyor ? sz.gonderiliyor : sz.gonder}
      </button>
    </div>
  );
}
