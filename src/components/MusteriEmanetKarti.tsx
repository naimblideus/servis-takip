import Link from 'next/link';
import { musteriEmanetKisa } from '@/lib/emanet-veri';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';

/**
 * MÜŞTERİDE DURAN — müşteri sayfasında küçük kart: rafta kaç toner var ve
 * "Yedek bırak" kısayolu. Ayrıntı ve hareketler /emanet ekranında. Değer
 * (₺) yalnız yöneticiye (veri katmanı vermezse burada da yok).
 */
export default async function MusteriEmanetKarti({ tenantId, customerId, yonetici, sz, b }: {
  tenantId: string; customerId: string; yonetici: boolean; sz: Sozluk; b: Bicimleyici;
}) {
  const e = sz.emanet;
  const k = await musteriEmanetKisa(tenantId, customerId, { yonetici }).catch(() => null);
  if (!k) return null;
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontWeight: 600, margin: 0 }}>{e.baslik}</h2>
          <div style={{ fontSize: '0.85rem', color: k.bakiye > 0 ? '#0F2253' : '#6C7A93', marginTop: 4, fontWeight: k.bakiye > 0 ? 700 : 400 }}>
            {k.bakiye > 0 ? doldur(e.kartOzet, { n: k.bakiye }) : e.kartBos}
            {k.bakiye > 0 && k.deger !== null ? ` · ${b.para(k.deger, 0)}` : ''}
            {k.fazla ? ` · ${e.fazlaRozet}` : ''}
          </div>
          {k.kalemler.slice(0, 3).map((x) => (
            <div key={x.ad} style={{ fontSize: '0.78rem', color: '#53617B', marginTop: 2 }}>{x.ad} · {doldur(e.adet, { n: x.bakiye })}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {k.hareketVar && (
            <Link href={`/emanet?musteri=${customerId}`} style={{ padding: '0.55rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #CFD7E4', color: '#33405C', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>{e.defter}</Link>
          )}
          <Link href={`/emanet?musteri=${customerId}&islem=birak`} style={{ padding: '0.55rem 0.9rem', borderRadius: '0.5rem', background: '#0F2253', color: 'white', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>{e.yedekBirak}</Link>
        </div>
      </div>
    </div>
  );
}
