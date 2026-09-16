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
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { modelNotu, type ModelNotu } from '@/lib/rapor-metin';

interface ModelStat {
  brand: string; model: string; deviceCount: number; withAge: number;
  avgAgeMonths: number | null; failuresPerDeviceYear: number | null;
  totalFailures: number; totalPlanned: number; uncategorizedRatio: number;
  topFaults: { code: string; count: number }[];
  avgPartsCost: number | null; reliable: boolean; note: string | null; notKod: ModelNotu | null;
}

export default function ModelGuvenilirlikPage() {
  const t = useT();
  const b = useBicim();
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
      <Link href="/reports" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>{t.yenileme.geri}</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>{t.modelGuvenilirlik.baslik}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        {doldur(t.modelGuvenilirlik.altOn, { n: ozet.months })} <b>{t.modelGuvenilirlik.altVurgu}</b>{' '}
        {t.modelGuvenilirlik.altSon}
      </p>

      {/* Rapor ekranda kalırsa iş görmez. Bu tablo müşteriye giderken
          veya alım kararı verilirken kullanılıyor — indirilebilmeli.
          CSV ekrandakiyle AYNI uçtan, aynı sıradan üretiliyor. */}
      <a href="/api/reports/model-reliability?format=csv"
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 0.9rem', marginBottom: '1rem',
          background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem',
          textDecoration: 'none', whiteSpace: 'nowrap' }}>
        {t.genel.excelIndir}
      </a>
      {yukleniyor ? (
        <div style={{ ...kutu, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>{t.genel.yukleniyor}</div>
      ) : (
        <>
          <div style={{ ...kutu, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{ozet.guvenilirModel}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t.modelGuvenilirlik.yorumlanabilir}</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#9ca3af' }}>{ozet.toplamModel}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t.modelGuvenilirlik.toplamModel}</div>
            </div>
            <button type="button" onClick={() => setHepsi(h => !h)}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e5e7eb',
                borderRadius: '0.45rem', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.82rem', color: '#374151' }}>
              {hepsi ? t.modelGuvenilirlik.sadeceYorumlanabilir : t.modelGuvenilirlik.veriYetersizGoster}
            </button>
          </div>

          {gosterilen.length === 0 ? (
            <div style={{ ...kutu, textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              {t.modelGuvenilirlik.bos}
            </div>
          ) : (
            <div style={{ ...kutu, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '46rem' }}>
                <thead>
                  <tr className="table-header">
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>{t.modelGuvenilirlik.sutunMarkaModel}</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>{t.modelGuvenilirlik.sutunCihaz}</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>{t.modelGuvenilirlik.sutunOrtYas}</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>{t.modelGuvenilirlik.sutunArizaOrani}</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>{t.modelGuvenilirlik.sutunEnSikAriza}</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>{doldur(t.modelGuvenilirlik.sutunOrtParca, { s: b.simge })}</th>
                  </tr>
                </thead>
                <tbody>
                  {gosterilen.map(m => (
                    <tr key={`${m.brand}|${m.model}`} style={{ borderBottom: '1px solid #f3f4f6',
                      backgroundColor: m.reliable ? undefined : '#fafafa' }}>
                      <td style={{ padding: '0.6rem 0.65rem' }}>
                        <div style={{ fontWeight: 600 }}>{m.brand} {m.model}</div>
                        {m.notKod && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{modelNotu(t, b, m.notKod)}</div>}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right' }}>
                        {m.deviceCount}
                        {m.withAge < m.deviceCount && (
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{doldur(t.modelGuvenilirlik.yasiBilinen, { n: m.withAge })}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', color: m.avgAgeMonths === null ? '#d1d5db' : undefined }}>
                        {m.avgAgeMonths === null ? '—' : doldur(t.modelGuvenilirlik.yilBirimi, { n: b.sayi(m.avgAgeMonths / 12, 1) })}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', fontWeight: 700,
                        color: m.failuresPerDeviceYear === null ? '#d1d5db'
                          : m.failuresPerDeviceYear >= 2 ? '#b91c1c' : m.failuresPerDeviceYear >= 1 ? '#b45309' : '#15803d' }}>
                        {m.failuresPerDeviceYear === null ? '—' : m.failuresPerDeviceYear}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', color: '#374151' }}>
                        {m.topFaults.length === 0
                          ? '—'
                          : m.topFaults.map((f) => `${(t.ariza as Record<string, string>)[f.code] ?? f.code} (${f.count})`).join(', ')}
                      </td>
                      <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', color: m.avgPartsCost === null ? '#d1d5db' : undefined }}>
                        {m.avgPartsCost === null ? '—' : b.sayi(m.avgPartsCost)}
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
