'use client';

import { useCallback, useEffect, useState } from 'react';

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

const tl = (n: number | null | undefined) =>
  n === null || n === undefined ? '—'
    : `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gg = (s: string) => new Date(s).toLocaleDateString('tr-TR');

function donemAdi(d: string) {
  const [y, m] = d.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}
function donemKaydir(d: string, n: number) {
  const [y, m] = d.split('-').map(Number);
  const t = new Date(y, m - 1 + n, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

export default function KdvPage() {
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
      if (!r.ok) throw new Error(j.error || 'Yüklenemedi');
      setVeri(j); setHata(null);
    } catch (e: any) { setHata(e.message); }
    setYukleniyor(false);
  }, []);
  useEffect(() => { yukle(donem); }, [donem, yukle]);

  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>KDV Özeti</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.25rem' }}>
        Bu dönem ne kadar KDV ödeyeceksin — muhasebecine verilecek rakam.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button onClick={() => setDonem(donemKaydir(donem, -1))}
          style={{ padding: '0.45rem 0.8rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 700, minWidth: '9rem', textAlign: 'center' }}>{donemAdi(donem)}</span>
        <button onClick={() => setDonem(donemKaydir(donem, 1))}
          style={{ padding: '0.45rem 0.8rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>→</button>
        {yukleniyor && <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>yükleniyor…</span>}
      </div>

      {veri && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <Kutu baslik="Satış KDV'si" buyuk={tl(veri.satis.kdv)}
              alt={`${veri.satis.adet} fatura · matrah ${tl(veri.satis.matrah)}`} renk="#0f2253" />
            <Kutu baslik="Alış KDV'si" buyuk={tl(veri.alis.kdv)}
              alt={`${veri.alis.adet} gider · matrah ${tl(veri.alis.matrah)}`} renk="#0f2253" />
            {veri.odenecek > 0 ? (
              <Kutu baslik="Ödenecek KDV" buyuk={tl(veri.odenecek)} alt="Satış − Alış" renk="#b45309" vurgu />
            ) : (
              <Kutu baslik="Devreden KDV" buyuk={tl(veri.devreden)}
                alt={veri.devreden > 0 ? 'Alış satıştan fazla — sonraki döneme devreder' : 'Bu dönem KDV çıkmadı'}
                renk="#15803d" vurgu />
            )}
          </div>

          {/* ── KAPSAM DIŞI OLANLAR ─────────────────────────────────────
              Sessizce dışarıda bırakmak, bayiye olduğundan farklı bir
              rakam göstermek demek. */}
          {(veri.kdvsizGider.adet > 0 || veri.kapsamDisi.faturasizFis > 0) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
              <b style={{ fontSize: '0.85rem', color: '#92400e' }}>Bu rakama girmeyenler</b>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: '#92400e' }}>
                {veri.kdvsizGider.adet > 0 && (
                  <li>
                    <b>{veri.kdvsizGider.adet} giderin KDV&apos;si girilmemiş</b> (toplam {tl(veri.kdvsizGider.tutar)}).
                    Muhasebe → Giderler&apos;den KDV oranını yazarsan alış KDV&apos;si artar, ödeyeceğin düşer.
                  </li>
                )}
                {veri.kapsamDisi.faturasizFis > 0 && (
                  <li>
                    <b>{veri.kapsamDisi.faturasizFis} ücretli servis fişi faturalanmamış.</b>
                    Fatura kesilince satış KDV&apos;si de artar.
                  </li>
                )}
              </ul>
            </div>
          )}

          {veri.satisOranlari.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Satış KDV&apos;si oran oran</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>{['Oran', 'Matrah', 'KDV'].map((h) => (
                      <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {veri.satisOranlari.map((r: any) => (
                      <tr key={r.oran} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>%{r.oran}</td>
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
            {([['yok', 'Özet'], ['satis', `Satış (${veri.satis.adet})`], ['alis', `Alış (${veri.giderler.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDetay(k as any)}
                style={{
                  padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid ' + (detay === k ? '#0f2253' : '#d1d5db'),
                  background: detay === k ? '#0f2253' : 'white', color: detay === k ? 'white' : '#374151',
                }}>{l}</button>
            ))}
          </div>

          {detay === 'satis' && (
            <Liste basliklar={['Fatura No', 'Tarih', 'Matrah', 'Oran', 'KDV']}
              satirlar={veri.faturalar.map((f: any) => [f.no, gg(f.tarih), tl(f.matrah), `%${f.oran}`, tl(f.kdv)])} />
          )}
          {detay === 'alis' && (
            <Liste basliklar={['Açıklama', 'Satıcı', 'Fatura No', 'Tarih', 'Tutar', 'KDV']}
              satirlar={veri.giderler.map((g: any) => [
                g.aciklama, g.satici || '—', g.faturaNo || '—', gg(g.tarih), tl(g.tutar),
                g.kdv === null ? 'girilmemiş' : tl(g.kdv),
              ])} />
          )}

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
            {veri.kapsamDisi.aciklama} Satış tarafı fatura tarihine göre hesaplanır (tahsil edilip
            edilmediğine bakılmaz). Göçte aktarılan eski sistem faturaları bu rakama girmez.
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

function Liste({ basliklar, satirlar }: { basliklar: string[]; satirlar: any[][] }) {
  if (!satirlar.length) {
    return <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>Bu dönemde kayıt yok.</div>;
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
