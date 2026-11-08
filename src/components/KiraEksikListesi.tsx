'use client';

import { useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { trNumber, trInt } from '@/lib/sheet-import';

type Cihaz = { id: string; brand: string; model: string; serialNo: string; musteri: string };

/**
 * FATURA ÖNCESİ: KİRA BİLGİSİ EKSİK KİRALIK CİHAZLAR (lib/kira-sarti)
 *
 * Kaydı olmayan bayide cihaz sahada "kiralık" diye tanımlanır; kira bilgisi
 * ilk faturada sorulur. Satırda kira, dahil sayfa ve sayfa fiyatı yazılır,
 * kaydedilen satır listeden düşer. Sayılar Türk yazımıyla okunur ("1.250",
 * "0,45"); tarayıcının sayı alanı virgülü kabul etmediği için metin kutusu.
 */
export default function KiraEksikListesi({ cihazlar, toplam }: { cihazlar: Cihaz[]; toplam: number }) {
  const t = useT();
  const k = t.kiraEksik;
  const b = useBicim();
  const [liste, setListe] = useState(cihazlar);
  const [deger, setDeger] = useState<Record<string, { kira: string; dahil: string; fiyat: string }>>({});
  const [hata, setHata] = useState<Record<string, string>>({});
  const [mesgul, setMesgul] = useState<string | null>(null);
  if (!liste.length) return null;

  const al = (id: string) => deger[id] ?? { kira: '', dahil: '', fiyat: '' };
  const yaz = (id: string, alan: 'kira' | 'dahil' | 'fiyat', v: string) => setDeger((d) => ({ ...d, [id]: { ...al(id), [alan]: v } }));

  const kaydet = async (id: string) => {
    const v = al(id);
    const kira = trNumber(v.kira), dahil = trInt(v.dahil), fiyat = trNumber(v.fiyat);
    if (!(kira && kira > 0) && !(fiyat && fiyat > 0)) { setHata((h) => ({ ...h, [id]: k.enAzBiri })); return; }
    setMesgul(id); setHata((h) => ({ ...h, [id]: '' }));
    try {
      const govde: Record<string, number> = {};
      if (kira && kira > 0) govde.monthlyRent = kira;
      if (dahil != null && dahil >= 0) govde.includedBlack = dahil;
      if (fiyat && fiyat > 0) govde.pricePerBlack = fiyat;
      const r = await fetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHata((h) => ({ ...h, [id]: d.error || t.genel.baglantiHatasi })); return; }
      setListe((l) => l.filter((c) => c.id !== id));
    } catch {
      setHata((h) => ({ ...h, [id]: t.genel.baglantiHatasi }));
    } finally {
      setMesgul(null);
    }
  };

  const kutu: React.CSSProperties = { width: '100%', minHeight: 40, padding: '.4rem .55rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box' };
  const etiket: React.CSSProperties = { display: 'block', fontSize: '.7rem', fontWeight: 700, color: '#78350F', marginBottom: 2 };
  return (
    <section aria-labelledby="kira-eksik" style={{ padding: '.9rem 1.4rem', borderBottom: '1px solid #eef2f7', background: '#FFFBEB' }}>
      <h3 id="kira-eksik" style={{ fontWeight: 800, fontSize: '.95rem', color: '#78350F' }}>{doldur(k.baslik, { n: toplam })}</h3>
      <p style={{ fontSize: '.8rem', color: '#92400E', margin: '.25rem 0 .7rem', lineHeight: 1.5 }}>{k.aciklama}</p>
      <div style={{ display: 'grid', gap: '.7rem' }}>
        {liste.map((c) => (
          <div key={c.id} style={{ background: 'white', border: '1px solid #FDE68A', borderRadius: 10, padding: '.6rem .7rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#0B1533' }}>{c.musteri}</div>
            <div style={{ fontSize: '.75rem', color: '#5B6479', marginBottom: '.45rem' }}>{c.brand} {c.model}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '.5rem' }}>
              <label><span style={etiket}>{doldur(k.kira, { birim: b.simge })}</span>
                <input style={kutu} inputMode="decimal" value={al(c.id).kira} onChange={(e) => yaz(c.id, 'kira', e.target.value)} /></label>
              <label><span style={etiket}>{k.dahil}</span>
                <input style={kutu} inputMode="numeric" value={al(c.id).dahil} onChange={(e) => yaz(c.id, 'dahil', e.target.value)} /></label>
              <label><span style={etiket}>{doldur(k.fiyat, { birim: b.simge })}</span>
                <input style={kutu} inputMode="decimal" value={al(c.id).fiyat} onChange={(e) => yaz(c.id, 'fiyat', e.target.value)} /></label>
            </div>
            {hata[c.id] && <p role="alert" style={{ color: '#B91C1C', fontSize: '.78rem', marginTop: '.35rem' }}>{hata[c.id]}</p>}
            <button type="button" onClick={() => kaydet(c.id)} disabled={mesgul === c.id}
              style={{ marginTop: '.5rem', minHeight: 40, padding: '.4rem .9rem', background: '#B45309', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', opacity: mesgul === c.id ? .6 : 1 }}>
              {mesgul === c.id ? t.genel.kaydediliyor : k.kaydet}
            </button>
          </div>
        ))}
      </div>
      {toplam > cihazlar.length && <p style={{ fontSize: '.75rem', color: '#92400E', marginTop: '.5rem' }}>{doldur(k.dahaFazla, { n: toplam - cihazlar.length })}</p>}
    </section>
  );
}
