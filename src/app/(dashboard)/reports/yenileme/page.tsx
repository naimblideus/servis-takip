'use client';

/**
 * Yenileme Fırsatları — cihaz yaşı girmenin karşılığı.
 *
 * Döngü: yaş gir → fırsat gör → yeni cihaz sat → daha çok veri gir.
 * Ödül rozet değil, satış listesi.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { yenilemeSebebi, type YenilemeSebebi } from '@/lib/rapor-metin';

interface Aday {
  id: string; baslik: string; serialNo: string; musteri: string | null;
  yasAy: number | null; yasBelirsiz: boolean;
  ariza: number; planli: number; parcaMaliyet: number; gelir: number;
  sebepler: YenilemeSebebi[]; skor: number;
}
interface Veri {
  months: number; toplamCihaz: number; yasiBilinen: number;
  yasKapsamPct: number; yasEksikFirsat: number; adaylar: Aday[];
}

export default function YenilemePage() {
  const t = useT();
  const b = useBicim();
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
      <Link href="/reports" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>{t.yenileme.geri}</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>{t.yenileme.baslik}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        {t.yenileme.altOn} <b>{t.yenileme.altVurgu}</b> {t.yenileme.altSon}
      </p>

      {/* Rapor ekranda kalırsa iş görmez. Bu tablo müşteriye giderken
          veya alım kararı verilirken kullanılıyor — indirilebilmeli.
          CSV ekrandakiyle AYNI uçtan, aynı sıradan üretiliyor. */}
      <a href="/api/reports/renewal?format=csv"
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 0.9rem', marginBottom: '1rem',
          background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem',
          textDecoration: 'none', whiteSpace: 'nowrap' }}>
        {t.genel.excelIndir}
      </a>
      {yukleniyor ? (
        <div style={{ ...kutu, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>{t.genel.yukleniyor}</div>
      ) : !d ? (
        <div style={{ ...kutu, color: '#b91c1c' }}>{t.yenileme.alinamadi}</div>
      ) : (
        <>
          {/* Kapsam — veri girmenin karşılığını açıkça göster */}
          <div style={{ ...kutu, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{d.adaylar.length}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t.yenileme.firsatBulundu}</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: d.yasKapsamPct >= 80 ? '#15803d' : '#b45309' }}>
                {b.yuzde(d.yasKapsamPct)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t.yenileme.yasKapsami}</div>
            </div>
            {d.yasEksikFirsat > 0 && (
              <div style={{ marginLeft: 'auto', fontSize: '0.85rem', backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '0.5rem 0.8rem', color: '#92400e' }}>
                <b>{doldur(t.yenileme.yasEksikVurgu, { n: d.yasEksikFirsat })}</b> {t.yenileme.yasEksikOrta}{' '}
                <Link href="/devices/kurulum-tarihi" style={{ color: '#92400e', fontWeight: 700 }}>
                  {t.yenileme.yasEksikLink}
                </Link>{' '}
                {t.yenileme.yasEksikSon}
              </div>
            )}
          </div>

          {d.adaylar.length === 0 ? (
            <div style={{ ...kutu, textAlign: 'center', padding: '2.2rem' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>✓</div>
              <div style={{ fontWeight: 600, color: '#15803d' }}>{t.yenileme.adayYok}</div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem' }}>
                {d.yasKapsamPct < 80 ? t.yenileme.adayYokAz : t.yenileme.adayYokSaglikli}
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
                        <div>{doldur(t.yenileme.yasinda, { n: Math.floor(a.yasAy / 12) })}{a.yasBelirsiz ? t.yenileme.yasBelirsiz : ''}</div>
                      )}
                      <div>{doldur(t.yenileme.arizaAdet, { n: a.ariza })}{a.planli ? doldur(t.yenileme.planliAdet, { n: a.planli }) : ''}</div>
                    </div>
                  </div>
                  <ul style={{ margin: '0.55rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#374151' }}>
                    {a.sebepler.map((s, j) => <li key={j}>{yenilemeSebebi(t, b, s)}</li>)}
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
