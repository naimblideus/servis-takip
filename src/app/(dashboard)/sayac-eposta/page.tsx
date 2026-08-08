'use client';

import { useEffect, useState, useCallback } from 'react';

interface Kayit {
  id: string;
  konu: string | null;
  gonderen: string | null;
  seri: string | null;
  siyah: number | null;
  renkli: number | null;
  durum: string;
  hata: string | null;
  tarih: string;
  onizleme: string;
}

interface Cihaz {
  id: string; brand: string; model: string; serialNo: string;
  location?: string | null; customer?: { name: string } | null;
}

export default function SayacEpostaPage() {
  const [items, setItems] = useState<Kayit[]>([]);
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hepsi, setHepsi] = useState(false);
  const [acik, setAcik] = useState<string | null>(null);
  const [dev, setDev] = useState('');
  const [cb, setCb] = useState('');
  const [cc, setCc] = useState('');
  const [reset, setReset] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/sayac/eposta/bekleyen${hepsi ? '?hepsi=1' : ''}`)
      .then(r => r.json()).then(d => setItems(d.items || []))
      .catch(() => {}).finally(() => setYukleniyor(false));
  }, [hepsi]);

  useEffect(() => { yukle(); }, [yukle]);
  useEffect(() => {
    fetch('/api/devices').then(r => r.json())
      .then(d => setCihazlar(Array.isArray(d) ? d : (d.devices ?? [])))
      .catch(() => {});
  }, []);

  /** Paneli açarken okunan değerlerle DOLDUR — bayi yalnızca yanlışı düzeltsin. */
  const ac = (k: Kayit) => {
    setAcik(k.id); setHata(null); setReset(false);
    setCb(k.siyah != null ? String(k.siyah) : '');
    setCc(k.renkli != null ? String(k.renkli) : '');
    // Seri okunduysa cihazı önceden seç
    const eslesen = k.seri ? cihazlar.find(c => c.serialNo === k.seri) : null;
    setDev(eslesen?.id ?? '');
  };

  const gonder = async (body: any) => {
    setMesgul(body.id); setHata(null);
    try {
      const r = await fetch('/api/sayac/eposta/bekleyen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setHata(d.error || 'İşlem yapılamadı'); return; }
      if (d.uyari) alert('⚠️ ' + d.uyari);
      setAcik(null); yukle();
    } finally { setMesgul(null); }
  };

  const tarih = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const card: React.CSSProperties = {
    background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '1rem 1.15rem', marginBottom: '0.75rem',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.95rem', boxSizing: 'border-box',
  };

  const bekleyen = items.filter(i => i.durum === 'BEKLIYOR' || i.durum === 'HATA').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
          📧 Cihazdan Gelen Sayaçlar
          {bekleyen > 0 && <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '3px 10px' }}>{bekleyen} bekliyor</span>}
        </h1>
        <button onClick={() => setHepsi(!hepsi)}
          style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          {hepsi ? 'Sadece bekleyenler' : 'Tümünü göster'}
        </button>
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Cihazlar sayaç raporunu e-postayla gönderiyor. Sistem seri numarasını tanıdığında
        sayacı <b>kendiliğinden</b> işliyor. Tanıyamadıklarını burada elle işlersiniz —
        böylece hiçbir sayaç kaybolmaz.
      </p>

      {yukleniyor && <div style={{ color: '#9ca3af' }}>Yükleniyor…</div>}

      {!yukleniyor && items.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
            {hepsi ? 'Hiç e-posta yok' : 'Bekleyen yok'}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Elle işlenmesi gereken sayaç e-postası yok. Gelenler otomatik işleniyor.
          </div>
        </div>
      )}

      {items.map(k => {
        const bekliyor = k.durum === 'BEKLIYOR' || k.durum === 'HATA';
        return (
          <div key={k.id} style={{ ...card, opacity: bekliyor ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {k.seri ? <>Seri: <code style={{ fontFamily: 'monospace' }}>{k.seri}</code></> : 'Seri tanınmadı'}
                {k.durum === 'ISLENDI' && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 8px' }}>işlendi</span>}
                {k.durum === 'HATA' && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '2px 8px' }}>hata</span>}
                {k.durum === 'ATLANDI' && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999, padding: '2px 8px' }}>atlandı</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{tarih(k.tarih)}</div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>
              {k.konu || '(konu yok)'}{k.gonderen ? ` · ${k.gonderen}` : ''}
              {(k.siyah != null || k.renkli != null) && (
                <> · okunan: {k.siyah != null ? `⚫ ${k.siyah.toLocaleString('tr-TR')}` : '⚫ —'}
                  {k.renkli != null ? ` · 🟣 ${k.renkli.toLocaleString('tr-TR')}` : ''}</>
              )}
            </div>

            {k.hata && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.4rem', padding: '0.5rem 0.7rem' }}>
                {k.hata}
              </div>
            )}

            <details style={{ marginTop: '0.6rem' }}>
              <summary style={{ fontSize: '0.78rem', color: '#6b7280', cursor: 'pointer' }}>E-posta içeriğini gör</summary>
              <div style={{ marginTop: '0.4rem', padding: '0.6rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 180, overflow: 'auto' }}>
                {k.onizleme}
              </div>
            </details>

            {acik === k.id ? (
              <div style={{ marginTop: '0.75rem', padding: '0.9rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.6rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#075985', marginBottom: '0.6rem' }}>Sayacı cihaza işle</div>
                <select value={dev} onChange={e => setDev(e.target.value)} style={{ ...inp, marginBottom: '0.6rem' }}>
                  <option value="">Cihaz seçin…</option>
                  {cihazlar.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.brand} {c.model} · {c.serialNo}{c.customer?.name ? ` — ${c.customer.name}` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>⚫ Siyah sayaç</label>
                    <input value={cb} onChange={e => setCb(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inp} />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>🟣 Renkli sayaç</label>
                    <input value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inp} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#0369a1', marginTop: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reset} onChange={e => setReset(e.target.checked)} />
                  Sayaç sıfırlandı (yeni değer eskisinden küçükse)
                </label>
                {hata && <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.5rem' }}>{hata}</div>}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                  <button onClick={() => gonder({ id: k.id, deviceId: dev, counterBlack: cb, counterColor: cc || 0, reset })}
                    disabled={mesgul === k.id || !dev || cb === ''}
                    style={{ padding: '0.55rem 1.1rem', background: (!dev || cb === '') ? '#cbd5e1' : '#0284c7', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: (!dev || cb === '') ? 'not-allowed' : 'pointer' }}>
                    {mesgul === k.id ? 'Kaydediliyor…' : 'Sayacı kaydet'}
                  </button>
                  <button onClick={() => setAcik(null)}
                    style={{ padding: '0.55rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : bekliyor && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                <button onClick={() => ac(k)}
                  style={{ padding: '0.45rem 0.9rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  Elle işle
                </button>
                <button onClick={() => gonder({ id: k.id, yoksay: true })} disabled={mesgul === k.id}
                  style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.82rem', color: '#6b7280', cursor: 'pointer' }}>
                  Bu sayaçla ilgilenme
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
