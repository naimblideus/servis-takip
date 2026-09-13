'use client';

import { use, useEffect, useState } from 'react';

/**
 * MÜŞTERİ ÇIKTISI.
 *
 * ── BURADA OLMAYAN ŞEYLER ────────────────────────────────────────────────
 * Maliyet YOK. Marj YOK. Ölçüm gözlem sayısı YOK. Bayinin iç rakamları bu
 * kâğıda hiç gelmiyor — yanlışlıkla maliyetli bir sayfayı müşteriye
 * uzatmanın yolu olmamalı. Bunun tek yolu, o alanları bu bileşene HİÇ
 * yazmamak; "gizle" ile değil.
 *
 * ── TASARRUF İDDİASI ─────────────────────────────────────────────────────
 * Müşterinin bugünkü ödemesi TAM olarak bilinmiyorsa tasarruf bölümü hiç
 * basılmıyor. Eksik veriden çıkan bir tasarruf rakamı, müşteriye
 * tutulamayacak bir söz vermek olurdu.
 */

const tl = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kurus = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

export default function TeklifCiktisi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [veri, setVeri] = useState<any>(null);
  const [bayi, setBayi] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/teklifler/${id}`).then((r) => r.json()).then(setVeri);
    fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).then(setBayi).catch(() => {});
  }, [id]);

  if (!veri || veri.error) {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>{veri?.error || 'Yükleniyor…'}</div>;
  }

  const t = veri.teklif;
  const o = veri.ozet;
  const gecerli = new Date(new Date(t.createdAt).getTime() + t.gecerlilikGun * 86400000);
  const tasarrufGosterilebilir = o.aylikTasarruf !== null && o.aylikTasarruf > 0;

  const th: React.CSSProperties = {
    padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: '#475569',
    fontWeight: 700, textAlign: 'left', borderBottom: '2px solid #0f2253',
  };
  const td: React.CSSProperties = { padding: '0.5rem 0.6rem', fontSize: '0.85rem', borderBottom: '1px solid #e5e7eb' };

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      <style>{`@media print { .yazdirma-gizle { display: none !important; } body { background: white; } }`}</style>

      <div className="yazdirma-gizle" style={{ padding: '0.75rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <button onClick={() => window.print()}
          style={{ padding: '0.5rem 1.1rem', borderRadius: '0.45rem', border: 'none', background: '#0f2253', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
          Yazdır / PDF
        </button>
        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
          Bu sayfada maliyet ve marj yok — olduğu gibi müşteriye verilebilir.
        </span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2.5rem 2rem', color: '#0f172a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap', borderBottom: '2px solid #0f2253', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{bayi?.name || 'Teklif'}</div>
            {bayi?.phone && <div style={{ fontSize: '0.82rem', color: '#475569' }}>{bayi.phone}</div>}
            {bayi?.email && <div style={{ fontSize: '0.82rem', color: '#475569' }}>{bayi.email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>TEKLİF</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{t.teklifNo}</div>
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              {new Date(t.createdAt).toLocaleDateString('tr-TR')}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>SAYIN</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t.musteriAdi}</div>
          {t.yetkili && <div style={{ fontSize: '0.85rem', color: '#475569' }}>{t.yetkili}</div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th style={th}>Makine</th>
              <th style={{ ...th, textAlign: 'right' }}>Adet</th>
              <th style={{ ...th, textAlign: 'right' }}>Aylık sayfa</th>
              <th style={{ ...th, textAlign: 'right' }}>Sayfa fiyatı</th>
              <th style={{ ...th, textAlign: 'right' }}>Aylık</th>
            </tr>
          </thead>
          <tbody>
            {o.satirlar.map((s: any, i: number) => (
              <tr key={i}>
                <td style={td}><b>{s.marka}</b> {s.model}</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.adet}</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.aylikSayfa.toLocaleString('tr-TR')}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {s.teklifSayfaSb !== null ? kurus(s.teklifSayfaSb) : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                  {s.teklifAylik !== null ? tl(s.teklifAylik) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {o.teklifAylik !== null && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none', paddingTop: '0.8rem' }}>
                  Aylık toplam
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', borderBottom: 'none', paddingTop: '0.8rem' }}>
                  {tl(o.teklifAylik)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* TASARRUF — yalnız TAM veriyle. Eksik veriden çıkan bir rakam,
            tutulamayacak bir söz olurdu. */}
        {tasarrufGosterilebilir && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.6rem', padding: '1rem 1.15rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700, marginBottom: '0.35rem' }}>
              MEVCUT DURUMUNUZA GÖRE
            </div>
            <div style={{ fontSize: '0.92rem', color: '#14532d', lineHeight: 1.7 }}>
              Şu anda aylık <b>{tl(o.mevcutAylik)}</b> ödüyorsunuz.
              Bu teklifle aylık <b>{tl(o.teklifAylik)}</b> —
              ayda <b>{tl(o.aylikTasarruf)}</b>, yılda <b>{tl(o.yillikTasarruf)}</b> kalıyor.
              {o.tasarrufYuzde !== null && ` (%${(o.tasarrufYuzde * 100).toFixed(0)})`}
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.8 }}>
          <div><b>Geçerlilik:</b> {gecerli.toLocaleDateString('tr-TR')} tarihine kadar.</div>
          <div><b>Fiyatlara dahil:</b> toner ve sarf malzemesi, periyodik bakım, servis işçiliği.</div>
          <div><b>Sayaç:</b> aylık okunur, aşan sayfa aynı birim fiyattan faturalanır.</div>
          <div>Fiyatlara KDV dahil değildir.</div>
        </div>

        {t.notlar && (
          <div style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
            {t.notlar}
          </div>
        )}
      </div>
    </div>
  );
}
