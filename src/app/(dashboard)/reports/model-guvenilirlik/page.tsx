'use client';

/**
 * Marka / Model Güvenilirliği.
 *
 * Bayi için: "hangi modeli almaya devam edeyim".
 * Aynı ekran, çok bayiye açıldığında üreticiye (Canon / Konica / Pantum)
 * sunulacak raporun birebir aynısıdır — bu yüzden aynı motoru kullanır.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { faultLabel } from '@/lib/fault-categories';

interface ModelStat {
  brand: string; model: string; deviceCount: number; withAge: number;
  avgAgeMonths: number | null; failuresPerDeviceYear: number | null;
  totalFailures: number; totalPlanned: number; uncategorizedRatio: number;
  topFaults: { code: string; count: number }[];
  avgPartsCost: number | null; reliable: boolean; note: string | null;
}

export default function ModelGuvenilirlikPage() {
  const [models, setModels] = useState<ModelStat[]>([]);
  const [ozet, setOzet] = useState({ toplamModel: 0, guvenilirModel: 0, months: 12 });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hepsi, setHepsi] = useState(false);

  useEffect(() => {
    fetch('/api/reports/model-reliability')
      .then(r => r.json())
      .then(d => {
        setModels(d.models || []);
        setOzet({ toplamModel: d.toplamModel, guvenilirModel: d.guvenilirModel, months: d.months });
        setYukleniyor(false);
      })
      .catch(() => setYukleniyor(false));
  }, []);

  const kutu: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.1rem', marginBottom: '0.9rem',
  };
  const gosterilen = hepsi ? models : models.filter(m => m.reliable);

  return (
    <div style={{ maxWidth: '62rem' }}>
      <Link href="/reports" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>← Raporlar</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>Marka / Model Güvenilirliği</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        Son {ozet.months} ayda hangi model ne sıklıkta bozuldu. <b>Periyodik bakım arıza sayılmaz.</b>
        Yeterli veri olmayan modellerde sayı üretilmez — sebebi yazılır.
      </p>

      {yukleniyor ? (
        <div style={{ ...kutu, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Yükleniyor…</div>
      ) : (
        <>
          <div style={{ ...kutu, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{ozet.guvenilirModel}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>yorumlanabilir model</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#9ca3af' }}>{ozet.toplamModel}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>toplam model</div>
            </div>
            <button type="button" onClick={() => setHepsi(h => !h)}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e5e7eb',
                borderRadius: '0.45rem', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.82rem', color: '#374151' }}>
              {hepsi ? 'Sadece yorumlanabilirler' : 'Veri yetersizleri de göster'}
            </button>
          </div>

          {gosterilen.length === 0 ? (
            <div style={{ ...kutu, textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Henüz yorumlanabilir model yok. Arıza kategorisi ve cihaz yaşı doldukça bu rapor canlanır.
            </div>
          ) : (
            <div style={{ ...kutu, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '46rem' }}>
                <thead>
                  <tr className="table-header">
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Marka / Model</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Cihaz</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Ort. yaş</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Cihaz-yılı başına arıza</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>En sık arıza</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Ort. parça ₺</th>
                  </tr>
                </thead>
                <tbody>
                  {gosterilen.map(m => (
                    <tr key={`${m.brand}|${m.model}`} style={{ borderBottom: '1px solid #f3f4f6',
                      backgroundColor: m.reliable ? undefined : '#fafafa' }}>
                      <td style={{ padding: '0.6rem 0.65rem' }}>
                        <div style={{ fontWeight: 600 }}>{m.brand} {m.model}</div>
                        {m.note && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{m.note}</div>}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right' }}>
                        {m.deviceCount}
                        {m.withAge < m.deviceCount && (
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{m.withAge} yaşı bilinen</div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', color: m.avgAgeMonths === null ? '#d1d5db' : undefined }}>
                        {m.avgAgeMonths === null ? '—' : `${(m.avgAgeMonths / 12).toFixed(1)} yıl`}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', fontWeight: 700,
                        color: m.failuresPerDeviceYear === null ? '#d1d5db'
                          : m.failuresPerDeviceYear >= 2 ? '#b91c1c' : m.failuresPerDeviceYear >= 1 ? '#b45309' : '#15803d' }}>
                        {m.failuresPerDeviceYear === null ? '—' : m.failuresPerDeviceYear}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', color: '#374151' }}>
                        {m.topFaults.length === 0 ? '—' : m.topFaults.map(f => `${faultLabel(f.code)} (${f.count})`).join(', ')}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', color: m.avgPartsCost === null ? '#d1d5db' : undefined }}>
                        {m.avgPartsCost === null ? '—' : m.avgPartsCost.toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
