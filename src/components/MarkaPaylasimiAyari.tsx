'use client';

/**
 * ÜRETİCİ İLE PAYLAŞIM — Ayarlar'da iki anahtar (yalnız yönetici):
 *   · Üretici ile anonim veri paylaş (oemDataSharing)
 *   · Adımı üreticiye göster (markaAdIzni) — yalnız ilki açıkken
 * Basınca kaydedilir; kaydedilemezse anahtar eski yerine döner (ekran yalan
 * söylemesin). Uç: /api/settings/marka-paylasimi (denetim kaydı yazar).
 * Yönetici değilse uç 403 döner ve kart hiç çizilmez.
 */
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';

interface Durum { oemDataSharing: boolean; markaAdIzni: boolean }

export default function MarkaPaylasimiAyari() {
  const t = useT();
  const a = t.ayarlar;
  const [d, setD] = useState<Durum | null>(null);
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    fetch('/api/settings/marka-paylasimi')
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => { if (x && typeof x.oemDataSharing === 'boolean') setD({ oemDataSharing: x.oemDataSharing, markaAdIzni: x.markaAdIzni === true }); })
      .catch(() => {});
  }, []);

  const degistir = async (istek: Partial<Durum>) => {
    if (!d) return;
    const once = d;
    setD({ ...d, ...istek, ...(istek.oemDataSharing === false ? { markaAdIzni: false } : {}) });
    setMesaj(null); setMesgul(true);
    const r = await fetch('/api/settings/marka-paylasimi', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(istek),
    }).catch(() => null);
    setMesgul(false);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j) { setD({ oemDataSharing: j.oemDataSharing, markaAdIzni: j.markaAdIzni }); setMesaj({ ok: true, metin: a.ureticiKaydedildi }); return; }
    setD(once);
    setMesaj({ ok: false, metin: j?.error ?? t.genel.baglantiHatasi });
  };

  if (!d) return null;
  const kutu = { marginTop: '0.2rem', width: 20, height: 20, cursor: 'pointer', flexShrink: 0 } as const;
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
      <h2 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{a.ureticiBaslik}</h2>
      <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.9rem', lineHeight: 1.6 }}>{a.ureticiAlt}</p>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', minHeight: 44, marginBottom: '0.5rem' }}>
        <input type="checkbox" checked={d.oemDataSharing} disabled={mesgul} style={kutu}
          onChange={(e) => degistir({ oemDataSharing: e.target.checked })} />
        <span style={{ fontSize: '0.875rem' }}>
          <b>{a.ureticiPaylas}</b>
          <span style={{ display: 'block', color: '#6b7280', fontSize: '0.78rem', marginTop: '0.15rem', lineHeight: 1.5 }}>{a.ureticiPaylasAlt}</span>
        </span>
      </label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: d.oemDataSharing ? 'pointer' : 'not-allowed', minHeight: 44, opacity: d.oemDataSharing ? 1 : 0.5 }}>
        <input type="checkbox" checked={d.markaAdIzni} disabled={mesgul || !d.oemDataSharing} style={kutu}
          onChange={(e) => degistir({ markaAdIzni: e.target.checked })} />
        <span style={{ fontSize: '0.875rem' }}>
          <b>{a.ureticiAd}</b>
          <span style={{ display: 'block', color: '#6b7280', fontSize: '0.78rem', marginTop: '0.15rem', lineHeight: 1.5 }}>{a.ureticiAdAlt}</span>
        </span>
      </label>
      {mesaj && <p role={mesaj.ok ? 'status' : 'alert'} style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: mesaj.ok ? '#166534' : '#b91c1c' }}>{mesaj.metin}</p>}
    </div>
  );
}
