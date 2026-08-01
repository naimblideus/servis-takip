'use client';

/**
 * Cihaz Yaşı — toplu kurulum tarihi girişi.
 *
 * Tasarım kararları:
 *  - Teknisyenin fiş akışına DOKUNULMADI. Bu, bayi sahibinin tek oturumda
 *    bitirebileceği isteğe bağlı bir ekran.
 *  - Kaydet butonu yok: tarih girilir girilmez kaydedilir (sürtünme sıfır).
 *  - Aynı müşterinin cihazları yan yana + "seçili olanlara uygula" ile
 *    100 cihaz tek tarihle bitebilir.
 *  - Üstte kapsam çubuğu: ilerlemeyi görmek işi bitirme hissi verir.
 *  - Zorlama yok, uyarı yok. Bilinmeyen tarih BOŞ kalır — tahmin yazılmaz.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface Row {
  id: string; brand: string; model: string; serialNo: string;
  customer: { name: string } | null;
}

export default function KurulumTarihiPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [toplam, setToplam] = useState(0);
  const [dolu, setDolu] = useState(0);
  const [q, setQ] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [topluTarih, setTopluTarih] = useState('');
  const [sonKayit, setSonKayit] = useState<string | null>(null);

  const bugun = useMemo(
    () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    [],
  );

  const yukle = useCallback(async (arama: string) => {
    setYukleniyor(true);
    const r = await fetch(`/api/devices/install-date?take=60&q=${encodeURIComponent(arama)}`);
    const d = await r.json();
    setRows(d.devices || []);
    setToplam(d.toplam || 0);
    setDolu(d.dolu || 0);
    setSecili(new Set());
    setYukleniyor(false);
  }, []);

  useEffect(() => { yukle(''); }, [yukle]);

  // Tarih ata (tek cihaz ya da seçili grup) — anında kaydeder
  const ata = async (ids: string[], tarih: string) => {
    if (!ids.length || !tarih) return;
    const r = await fetch('/api/devices/install-date', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, installedAt: tarih }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Kaydedilemedi'); return; }
    setDolu(d.dolu);
    setRows(prev => prev.filter(x => !ids.includes(x.id)));   // tamamlananlar listeden düşer
    setSecili(new Set());
    setSonKayit(`${d.guncellenen} cihaz kaydedildi`);
    window.setTimeout(() => setSonKayit(null), 2000);
  };

  const pct = toplam ? Math.round((dolu / toplam) * 100) : 0;
  const eksik = toplam - dolu;

  const kutu: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem',
  };
  const inp: React.CSSProperties = {
    padding: '0.4rem 0.55rem', border: '1px solid #d1d5db',
    borderRadius: '0.4rem', fontSize: '0.85rem', outline: 'none',
  };

  return (
    <div style={{ maxWidth: '60rem' }}>
      <Link href="/devices" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>← Cihazlar</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>Cihaz Yaşı</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        Cihazın müşteride çalışmaya başladığı tarih. Girildikçe arıza geçmişi anlam kazanır —
        hangi cihaz kaçıncı yılında sorun çıkarıyor görünür. <b>Bilmiyorsanız boş bırakın.</b>
      </p>

      {/* Kapsam — ilerlemeyi görmek işi bitirtir */}
      <div style={kutu}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, color: pct === 100 ? '#15803d' : '#111827' }}>%{pct}</span>
          <span style={{ fontSize: '0.9rem', color: '#374151' }}>{dolu} / {toplam} cihazın yaşı biliniyor</span>
          {eksik > 0 && <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>· {eksik} eksik</span>}
          {sonKayit && <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>✓ {sonKayit}</span>}
        </div>
        <div style={{ marginTop: '0.6rem', height: '8px', borderRadius: '9999px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: '9999px',
            backgroundColor: pct === 100 ? '#16a34a' : '#3b82f6',
            transition: 'width .4s cubic-bezier(.4,0,.2,1), background-color .3s',
          }} />
        </div>
      </div>

      {/* Toplu uygulama — aynı müşterinin cihazları genelde aynı tarihte kurulur */}
      <div style={kutu}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, flex: '1 1 12rem' }} placeholder="Müşteri, marka, model veya seri no ara…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') yukle(q); }} />
          <button type="button" onClick={() => yukle(q)} className="btn-secondary" style={{ padding: '0.4rem 0.9rem' }}>Ara</button>
          <span style={{ width: '1px', height: '1.5rem', backgroundColor: '#e5e7eb' }} />
          <input type="date" max={bugun} style={inp} value={topluTarih}
            onChange={e => setTopluTarih(e.target.value)} />
          <button type="button" className="btn-primary" style={{ padding: '0.45rem 1rem' }}
            disabled={!secili.size || !topluTarih}
            onClick={() => ata([...secili], topluTarih)}>
            Seçili {secili.size || ''} cihaza uygula
          </button>
        </div>
      </div>

      {/* Liste */}
      <div style={{ ...kutu, padding: 0, overflow: 'hidden' }}>
        {yukleniyor ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>✓</div>
            <div style={{ fontWeight: 600, color: '#15803d' }}>
              {eksik === 0 ? 'Tüm cihazların yaşı girildi' : 'Bu aramada eksik cihaz yok'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr className="table-header">
                <th style={{ width: '2.5rem', padding: '0.6rem' }}>
                  <input type="checkbox"
                    checked={secili.size === rows.length && rows.length > 0}
                    onChange={e => setSecili(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />
                </th>
                <th style={{ padding: '0.6rem', textAlign: 'left' }}>Müşteri</th>
                <th style={{ padding: '0.6rem', textAlign: 'left' }}>Cihaz</th>
                <th style={{ padding: '0.6rem', textAlign: 'left' }}>Seri No</th>
                <th style={{ padding: '0.6rem', textAlign: 'left', width: '10rem' }}>Kurulum Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem 0.6rem' }}>
                    <input type="checkbox" checked={secili.has(r.id)}
                      onChange={e => {
                        const s = new Set(secili);
                        e.target.checked ? s.add(r.id) : s.delete(r.id);
                        setSecili(s);
                      }} />
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', color: '#374151' }}>{r.customer?.name || '—'}</td>
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: 500 }}>{r.brand} {r.model}</td>
                  <td style={{ padding: '0.5rem 0.6rem', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.serialNo}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>
                    {/* Kaydet butonu yok — tarih seçilir seçilmez kaydedilir */}
                    <input type="date" max={bugun} style={{ ...inp, width: '100%' }}
                      onChange={e => { if (e.target.value) ata([r.id], e.target.value); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length >= 60 && (
        <p style={{ fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center' }}>
          İlk 60 cihaz gösteriliyor — girdikçe liste kısalır, kalanlar gelir.
        </p>
      )}
    </div>
  );
}
