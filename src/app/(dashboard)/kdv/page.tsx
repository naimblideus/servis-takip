'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

/**
 * KDV ÖZETİ
 *
 * Bayinin her ay başka bir ön muhasebe programı açma sebebi tek bir soru:
 * "bu ay ne kadar KDV ödeyeceğim?". Ekran o soruya cevap veriyor.
 *
 * NE OLMADIĞINI DA SÖYLÜYOR. Bu bir beyanname değil; tevkifat, istisna ve
 * devreden mahsubu kapsam dışı. Kapsam dışı kalan kayıtların SAYISI da
 * yazıyor — sessizce dışarıda bırakmak, bayiye olduğundan farklı bir rakam
 * göstermek demekti.
 */

function donemKaydir(d: string, n: number) {
  const [y, m] = d.split('-').map(Number);
  const t = new Date(y, m - 1 + n, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

export default function KdvPage() {
  const t = useT();
  const b = useBicim();
  const tl = (n: number | null | undefined) => b.para(n);
  const bugun = new Date();
  const [donem, setDonem] = useState(
    `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}`,
  );
  const [veri, setVeri] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [detay, setDetay] = useState<'yok' | 'satis' | 'alis'>('yok');

  const yukle = useCallback(async (d: string) => {
    setYukleniyor(true);
    try {
      const r = await fetch(`/api/kdv?donem=${d}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t.kdv.yuklenemedi);
      setVeri(j); setHata(null);
    } catch (e: any) { setHata(e.message); }
    setYukleniyor(false);
  }, [t.kdv.yuklenemedi]);
  useEffect(() => { yukle(donem); }, [donem, yukle]);

  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{t.kdv.baslik}</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.25rem' }}>{t.kdv.alt}</p>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button onClick={() => setDonem(donemKaydir(donem, -1))}
          style={{ padding: '0.45rem 0.8rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 700, minWidth: '9rem', textAlign: 'center' }}>{b.ayYil(new Date(Number(donem.slice(0, 4)), Number(donem.slice(5, 7)) - 1, 1))}</span>
        <button onClick={() => setDonem(donemKaydir(donem, 1))}
          style={{ padding: '0.45rem 0.8rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>→</button>
        {yukleniyor && <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{t.kdv.yukleniyorKucuk}</span>}
      </div>

      {veri && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <Kutu baslik={t.kdv.satisKdv} buyuk={tl(veri.satis.kdv)}
              alt={doldur(t.kdv.satisAlt, { n: veri.satis.adet, m: tl(veri.satis.matrah) })} renk="#0f2253" />
            <Kutu baslik={t.kdv.alisKdv} buyuk={tl(veri.alis.kdv)}
              alt={doldur(t.kdv.alisAlt, { n: veri.alis.adet, m: tl(veri.alis.matrah) })} renk="#0f2253" />
            {veri.odenecek > 0 ? (
              <Kutu baslik={t.kdv.odenecek} buyuk={tl(veri.odenecek)} alt={t.kdv.odenecekAlt} renk="#b45309" vurgu />
            ) : (
              <Kutu baslik={t.kdv.devreden} buyuk={tl(veri.devreden)}
                alt={veri.devreden > 0 ? t.kdv.devredenAlt : t.kdv.kdvCikmadi}
                renk="#15803d" vurgu />
            )}
          </div>

          {/* ── KAPSAM DIŞI OLANLAR ─────────────────────────────────────
              Sessizce dışarıda bırakmak, bayiye olduğundan farklı bir
              rakam göstermek demek. */}
          {(veri.kdvsizGider.adet > 0 || veri.kapsamDisi.faturasizFis > 0) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
              <b style={{ fontSize: '0.85rem', color: '#92400e' }}>{t.kdv.girmeyenler}</b>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: '#92400e' }}>
                {veri.kdvsizGider.adet > 0 && (
                  <li>
                    <b>{doldur(t.kdv.kdvsizVurgu, { n: veri.kdvsizGider.adet })}</b>{' '}
                    {doldur(t.kdv.kdvsizSon, { m: tl(veri.kdvsizGider.tutar) })}
                  </li>
                )}
                {veri.kapsamDisi.faturasizFis > 0 && (
                  <li>
                    <b>{doldur(t.kdv.faturasizVurgu, { n: veri.kapsamDisi.faturasizFis })}</b>{' '}
                    {t.kdv.faturasizSon}
                  </li>
                )}
              </ul>
            </div>
          )}

          {veri.satisOranlari.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.6rem' }}>{t.kdv.oranOran}</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>{[t.kdv.sutunOran, t.kdv.sutunMatrah, t.kdv.sutunKdv].map((h) => (
                      <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {veri.satisOranlari.map((r: any) => (
                      <tr key={r.oran} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{b.yuzde(r.oran)}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{tl(r.matrah)}</td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{tl(r.kdv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {([
              ['yok', t.kdv.sekmeOzet],
              ['satis', doldur(t.kdv.sekmeSatis, { n: veri.satis.adet })],
              ['alis', doldur(t.kdv.sekmeAlis, { n: veri.giderler.length })],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDetay(k as any)}
                style={{
                  padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (detay === k ? '#0f2253' : '#d1d5db'),
                  background: detay === k ? '#0f2253' : 'white', color: detay === k ? 'white' : '#374151',
                }}>{l}</button>
            ))}
          </div>

          {detay === 'satis' && (
            <Liste bos={t.kdv.donemBos}
              basliklar={[t.kdv.sutunFaturaNo, t.genel.tarih, t.kdv.sutunMatrah, t.kdv.sutunOran, t.kdv.sutunKdv]}
              satirlar={veri.faturalar.map((f: any) => [f.no, b.tarih(f.tarih), tl(f.matrah), b.yuzde(f.oran), tl(f.kdv)])} />
          )}
          {detay === 'alis' && (
            <Liste bos={t.kdv.donemBos}
              basliklar={[t.kdv.sutunAciklama, t.kdv.sutunSatici, t.kdv.sutunFaturaNo, t.genel.tarih, t.genel.tutar, t.kdv.sutunKdv]}
              satirlar={veri.giderler.map((g: any) => [
                g.aciklama, g.satici || '—', g.faturaNo || '—', b.tarih(g.tarih), tl(g.tutar),
                g.kdv === null ? t.kdv.girilmemis : tl(g.kdv),
              ])} />
          )}

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
            {t.kdv.beyannameDegil} {t.kdv.dipnot}
          </p>
        </>
      )}
    </div>
  );
}

function Kutu({ baslik, buyuk, alt, renk, vurgu }: any) {
  return (
    <div style={{
      background: vurgu ? '#f8fafc' : 'white',
      border: `1px solid ${vurgu ? '#cbd5e1' : '#e5e7eb'}`,
      borderRadius: '0.75rem', padding: '0.9rem',
    }}>
      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{baslik}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: renk, margin: '0.15rem 0' }}>{buyuk}</div>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{alt}</div>
    </div>
  );
}

function Liste({ basliklar, satirlar, bos }: { basliklar: string[]; satirlar: any[][]; bos: string }) {
  if (!satirlar.length) {
    return <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>{bos}</div>;
  }
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', minWidth: '34rem' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>{basliklar.map((h) => (
            <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {satirlar.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
              {r.map((c, j) => <td key={j} style={{ padding: '0.4rem 0.6rem' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
