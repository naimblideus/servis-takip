'use client';

/**
 * Yenileme Fırsatları — cihaz yaşı girmenin karşılığı.
 *
 * Döngü: yaş gir → fırsat gör → yeni cihaz sat → daha çok veri gir.
 * Ödül rozet değil, satış listesi.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Aday {
  id: string; baslik: string; serialNo: string; musteri: string | null;
  yasAy: number | null; yasBelirsiz: boolean;
  ariza: number; planli: number; parcaMaliyet: number; gelir: number;
  sebepler: string[]; skor: number;
}
interface Veri {
  months: number; toplamCihaz: number; yasiBilinen: number;
  yasKapsamPct: number; yasEksikFirsat: number; adaylar: Aday[];
}

export default function YenilemePage() {
  const [d, setD] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    fetch('/api/reports/renewal')
      .then(r => r.json())
      .then(x => { setD(x); setYukleniyor(false); })
      .catch(() => setYukleniyor(false));
  }, []);

  const kutu: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.1rem', marginBottom: '0.9rem',
  };

  return (
    <div style={{ maxWidth: '58rem' }}>
      <Link href="/reports" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>← Raporlar</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>Yenileme Fırsatları</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        Size kazandırdığından fazla masraf çıkaran veya yaşlanıp sürekli bozulan cihazlar.
        Her satırın <b>gerekçesi</b> yazılıdır — müşteriye giderken kullanabilirsiniz.
      </p>

      {yukleniyor ? (
        <div style={{ ...kutu, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Yükleniyor…</div>
      ) : !d ? (
        <div style={{ ...kutu, color: '#b91c1c' }}>Rapor alınamadı.</div>
      ) : (
        <>
          {/* Kapsam — veri girmenin karşılığını açıkça göster */}
          <div style={{ ...kutu, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{d.adaylar.length}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>fırsat bulundu</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: d.yasKapsamPct >= 80 ? '#15803d' : '#b45309' }}>
                %{d.yasKapsamPct}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>cihaz yaşı kapsamı</div>
            </div>
            {d.yasEksikFirsat > 0 && (
              <div style={{ marginLeft: 'auto', fontSize: '0.85rem', backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '0.5rem 0.8rem', color: '#92400e' }}>
                <b>{d.yasEksikFirsat} cihaz</b> sık arızalı ama yaşı bilinmiyor —{' '}
                <Link href="/devices/kurulum-tarihi" style={{ color: '#92400e', fontWeight: 700 }}>
                  yaşlarını girerseniz
                </Link>{' '}
                bu listeye eklenebilirler.
              </div>
            )}
          </div>

          {d.adaylar.length === 0 ? (
            <div style={{ ...kutu, textAlign: 'center', padding: '2.2rem' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>✓</div>
              <div style={{ fontWeight: 600, color: '#15803d' }}>Şu an yenileme adayı cihaz yok</div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem' }}>
                {d.yasKapsamPct < 80
                  ? 'Cihaz yaşları girildikçe bu liste zenginleşir.'
                  : 'Filo sağlıklı görünüyor.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {d.adaylar.map((a, i) => (
                <div key={a.id} style={{ ...kutu, borderLeft: `3px solid ${i < 3 ? '#dc2626' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.baslik}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {a.musteri || '—'} · <span style={{ fontFamily: 'monospace' }}>{a.serialNo}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#6b7280' }}>
                      {a.yasAy !== null && (
                        <div>{Math.floor(a.yasAy / 12)} yaşında{a.yasBelirsiz ? ' (±1 yıl)' : ''}</div>
                      )}
                      <div>{a.ariza} arıza{a.planli ? ` · ${a.planli} planlı` : ''}</div>
                    </div>
                  </div>
                  <ul style={{ margin: '0.55rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {a.sebepler.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
