'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * TEKLİFLER — aday müşteriye fiyat çıkarmanın başladığı yer.
 *
 * Sektörde teklif hâlâ çok sayfalı Excel'lerle kuruluyor. Burada teklif,
 * ölçülen sayfa maliyeti ve hedef marjdan çıkıyor.
 */

const DURUM: Record<string, { etiket: string; zemin: string; yazi: string }> = {
  TASLAK: { etiket: 'taslak', zemin: '#f3f4f6', yazi: '#374151' },
  GONDERILDI: { etiket: 'gönderildi', zemin: '#dbeafe', yazi: '#1e40af' },
  KAZANILDI: { etiket: 'kazanıldı', zemin: '#dcfce7', yazi: '#166534' },
  KAYBEDILDI: { etiket: 'kaybedildi', zemin: '#fef2f2', yazi: '#991b1b' },
};

const gg = (s: string) => new Date(s).toLocaleDateString('tr-TR');

export default function TekliflerPage() {
  const [veri, setVeri] = useState<any>(null);
  const [form, setForm] = useState({ musteriAdi: '', yetkili: '', telefon: '', eposta: '' });
  const [aciliyor, setAciliyor] = useState(false);
  const [formAcik, setFormAcik] = useState(false);

  const yukle = async () => setVeri(await (await fetch('/api/teklifler')).json());
  useEffect(() => { yukle(); }, []);

  const olustur = async () => {
    if (!form.musteriAdi.trim()) return;
    setAciliyor(true);
    const r = await fetch('/api/teklifler', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) alert(d.error || 'Açılamadı');
    else window.location.href = `/teklifler/${d.id}`;
    setAciliyor(false);
  };

  if (!veri) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;

  const inp: React.CSSProperties = {
    padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '0.45rem',
    fontSize: '0.88rem', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>Teklifler</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
            Aday müşterinin makinelerini gir, fiyat maliyetten çıksın. Sıradaki numara{' '}
            <b style={{ fontFamily: 'monospace' }}>{veri.siradakiNo}</b>.
          </p>
        </div>
        <button onClick={() => setFormAcik(!formAcik)}
          style={{ background: '#0f2253', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
          {formAcik ? 'İptal' : '+ Yeni Teklif'}
        </button>
      </div>

      {formAcik && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.7rem' }}>
            <input style={inp} placeholder="Firma adı *" value={form.musteriAdi} onChange={(e) => setForm({ ...form, musteriAdi: e.target.value })} />
            <input style={inp} placeholder="Yetkili" value={form.yetkili} onChange={(e) => setForm({ ...form, yetkili: e.target.value })} />
            <input style={inp} placeholder="Telefon" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
            <input style={inp} placeholder="E-posta" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
          </div>
          <button onClick={olustur} disabled={aciliyor || !form.musteriAdi.trim()}
            style={{
              marginTop: '0.8rem', padding: '0.55rem 1.1rem', borderRadius: '0.45rem', border: 'none',
              background: form.musteriAdi.trim() ? '#0f2253' : '#9ca3af', color: 'white', fontWeight: 700,
              fontSize: '0.88rem', cursor: form.musteriAdi.trim() ? 'pointer' : 'not-allowed',
            }}>
            {aciliyor ? 'Açılıyor…' : 'Teklifi aç ve makineleri gir'}
          </button>
        </div>
      )}

      {veri.teklifler.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
          Henüz teklif yok. Aday müşterinin makinelerini ve şu an ödediğini girersen,
          sayfa maliyetini çıkarıp fiyat öneriyoruz.
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {veri.teklifler.map((t: any) => {
            const d = DURUM[t.durum] ?? DURUM.TASLAK;
            return (
              <Link key={t.id} href={`/teklifler/${t.id}`} style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap',
                padding: '0.85rem 1rem', borderBottom: '1px solid #f3f4f6', textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, borderRadius: '999px', padding: '0.15rem 0.55rem',
                  background: d.zemin, color: d.yazi, whiteSpace: 'nowrap',
                }}>{d.etiket}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>{t.teklifNo}</span>
                <span style={{ flex: 1, minWidth: '9rem', fontWeight: 600 }}>{t.musteriAdi}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{t.satirSayisi} makine</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{gg(t.createdAt)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
