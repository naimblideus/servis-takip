'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * TEKLİF DÜZENLEME — bayinin ekranı.
 *
 * Burada MALİYET VE MARJ GÖRÜNÜYOR. Müşteriye verilecek çıktı ayrı sayfada
 * ve orada ikisi de yok — yanlışlıkla maliyetli bir kâğıdı müşteriye
 * uzatmanın yolu olmamalı.
 *
 * ── EKRANIN SÖYLEDİĞİ CÜMLE ──────────────────────────────────────────────
 * "Şu an sayfa başına ₺0,42 ödüyorsunuz; biz ₺0,29 veriyoruz, yılda
 *  ₺38.000 kalıyor." Bu cümle ancak müşterinin bugünkü ödemesi girilince
 * kurulabiliyor — girilmezse tasarruf hiç gösterilmiyor.
 */

type Satir = {
  id?: string; marka: string; model: string; adet: number;
  aylikSayfaSb: number; aylikSayfaRenkli: number;
  mevcutAylikTutar: string; onerilenKira: string;
  onerilenSayfaSb: string; onerilenSayfaRenkli: string;
};

const tl = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kurus = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const yuzde = (n: number) => `%${(n * 100).toFixed(1).replace('.', ',')}`;
const bos = (): Satir => ({
  marka: '', model: '', adet: 1, aylikSayfaSb: 0, aylikSayfaRenkli: 0,
  mevcutAylikTutar: '', onerilenKira: '', onerilenSayfaSb: '', onerilenSayfaRenkli: '',
});

export default function TeklifPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [veri, setVeri] = useState<any>(null);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Form HAM satırlardan doldurulur (kullanıcının yazdığı değerler),
  // hesap ayrı alanda durur. Formu hesaptan doldurmak, adetle çarpılmış
  // sayfa sayısını kullanıcının kutusuna geri yazardı.
  useEffect(() => {
    fetch(`/api/teklifler/${id}`).then((r) => r.json()).then((d) => {
      if (d.error) { alert(d.error); return; }
      setVeri(d);
      setSatirlar(d.hamSatirlar ?? []);
    });
  }, [id]);

  const kaydet = async (ek: Record<string, unknown> = {}) => {
    setKaydediliyor(true);
    const r = await fetch(`/api/teklifler/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ satirlar, ...ek }),
    });
    const d = await r.json();
    if (!r.ok) alert(d.error || 'Kaydedilemedi');
    else {
      setVeri(d);
      // Kaydetmeden sonra formu sunucunun kabul ettiği hâlle tazele:
      // ekranda duran değerle veritabanındaki ayrışmasın.
      const taze = await (await fetch(`/api/teklifler/${id}`)).json();
      setVeri(taze);
      setSatirlar(taze.hamSatirlar ?? []);
    }
    setKaydediliyor(false);
  };

  if (!veri) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;

  const o = veri.ozet;
  const t = veri.teklif;
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.35rem 0.45rem', border: '1px solid #d1d5db',
    borderRadius: '0.35rem', fontSize: '0.82rem', boxSizing: 'border-box',
  };
  const th: React.CSSProperties = { padding: '0.5rem 0.4rem', fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textAlign: 'left' };
  const guncelle = (i: number, alan: keyof Satir, deger: any) =>
    setSatirlar((s) => s.map((x, j) => (j === i ? { ...x, [alan]: deger } : x)));

  return (
    <div style={{ padding: '2rem', maxWidth: 1200 }}>
      <Link href="/teklifler" style={{ fontSize: '0.82rem', color: '#2563eb', textDecoration: 'none' }}>← Teklifler</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', margin: '0.5rem 0 1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 'bold', margin: 0 }}>{t.musteriAdi}</h1>
          <p style={{ color: '#6b7280', margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
            <span style={{ fontFamily: 'monospace' }}>{t.teklifNo}</span>
            {t.yetkili && ` · ${t.yetkili}`}{t.telefon && ` · ${t.telefon}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a href={`/teklifler/${id}/yazdir`} target="_blank" rel="noreferrer"
            style={{ padding: '0.55rem 1rem', borderRadius: '0.45rem', border: '1px solid #0f2253', background: 'white', color: '#0f2253', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
            Müşteri çıktısı →
          </a>
          <select value={t.durum} onChange={(e) => kaydet({ durum: e.target.value })}
            style={{ padding: '0.55rem 0.7rem', borderRadius: '0.45rem', border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
            <option value="TASLAK">Taslak</option>
            <option value="GONDERILDI">Gönderildi</option>
            <option value="KAZANILDI">Kazanıldı</option>
            <option value="KAYBEDILDI">Kaybedildi</option>
          </select>
        </div>
      </div>

      {/* ── ÖZET ── müşteriye söylenecek cümlenin rakamları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          ['Makine', o.makineSayisi, '#374151'],
          ['Aylık sayfa', o.aylikSayfa.toLocaleString('tr-TR'), '#374151'],
          ['Şu an ödediği', o.mevcutAylik === null ? '—' : tl(o.mevcutAylik), '#374151'],
          ['Bizim teklifimiz', o.teklifAylik === null ? '—' : tl(o.teklifAylik), '#0f2253'],
          ['Yıllık tasarruf', o.yillikTasarruf === null ? '—' : tl(o.yillikTasarruf),
            o.yillikTasarruf === null ? '#9ca3af' : o.yillikTasarruf > 0 ? '#15803d' : '#b91c1c'],
        ].map(([l, v, c]: any) => (
          <div key={l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{l}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── BAYİYE ÖZEL ── müşteri çıktısında YOK */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
        <b>Yalnız sana:</b>{' '}
        {o.bizimMarj !== null
          ? <>Bu teklifte marjın <b>{yuzde(o.bizimMarj)}</b> (hedef {yuzde(veri.hedefMarj)}). </>
          : <>Marj hesaplanamıyor — {o.olculmeyenSatir} satırda sayfa maliyeti ölçülmemiş. </>}
        <div style={{ marginTop: '0.4rem' }}>
          ⚠ Hesap yalnız <b>sarf maliyetini</b> kapsıyor. Müşteri çıktısında ise
          &ldquo;periyodik bakım ve servis işçiliği dahil&rdquo; yazıyor — <b>servis payını fiyata
          kendin eklemelisin</b>. Ziyaret sıklığını aday müşterinin makineleri için
          bilmiyoruz ve tahmin etmiyoruz; bilseydik uydurma bir servis maliyeti
          fiyatın içine girerdi.
        </div>
        {o.mevcutBilinmeyenSatir > 0 && (
          <div style={{ marginTop: '0.4rem' }}>
            <b style={{ color: '#92400e' }}>{o.mevcutBilinmeyenSatir} makinede müşterinin bugünkü ödemesi girilmemiş</b> — tasarruf rakamı bu yüzden çıkmıyor.
          </div>
        )}
      </div>

      {/* ── MAKİNELER ── */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={th}>Marka</th>
              <th style={th}>Model</th>
              <th style={{ ...th, width: '4rem' }}>Adet</th>
              <th style={{ ...th, width: '6.5rem' }}>Aylık S/B</th>
              <th style={{ ...th, width: '6.5rem' }}>Aylık renkli</th>
              <th style={{ ...th, width: '8rem' }}>Şu an ödediği</th>
              <th style={{ ...th, width: '7rem' }}>Kira (elle)</th>
              <th style={{ ...th, width: '7rem' }}>Sayfa S/B (elle)</th>
              <th style={{ ...th, width: '3rem' }} />
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td style={{ padding: '0.25rem' }}><input style={inp} value={s.marka} onChange={(e) => guncelle(i, 'marka', e.target.value)} placeholder="Kyocera" /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} value={s.model} onChange={(e) => guncelle(i, 'model', e.target.value)} placeholder="M2540" /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="numeric" value={s.adet} onChange={(e) => guncelle(i, 'adet', parseInt(e.target.value) || 1)} /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="numeric" value={s.aylikSayfaSb} onChange={(e) => guncelle(i, 'aylikSayfaSb', parseInt(e.target.value) || 0)} /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="numeric" value={s.aylikSayfaRenkli} onChange={(e) => guncelle(i, 'aylikSayfaRenkli', parseInt(e.target.value) || 0)} /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="decimal" value={s.mevcutAylikTutar} onChange={(e) => guncelle(i, 'mevcutAylikTutar', e.target.value)} placeholder="bilinmiyor" /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="decimal" value={s.onerilenKira} onChange={(e) => guncelle(i, 'onerilenKira', e.target.value)} placeholder="otomatik" /></td>
                <td style={{ padding: '0.25rem' }}><input style={inp} inputMode="decimal" value={s.onerilenSayfaSb} onChange={(e) => guncelle(i, 'onerilenSayfaSb', e.target.value)} placeholder="otomatik" /></td>
                <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                  <button onClick={() => setSatirlar((x) => x.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 0.25rem 0.25rem', flexWrap: 'wrap' }}>
          <button onClick={() => setSatirlar((s) => [...s, bos()])}
            style={{ padding: '0.45rem 0.9rem', borderRadius: '0.45rem', border: '1px dashed #9ca3af', background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer' }}>
            + Makine ekle
          </button>
          <button onClick={() => kaydet()} disabled={kaydediliyor}
            style={{ padding: '0.45rem 1.1rem', borderRadius: '0.45rem', border: 'none', background: '#0f2253', color: 'white', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}>
            {kaydediliyor ? 'Hesaplanıyor…' : 'Kaydet ve hesapla'}
          </button>
        </div>
      </div>

      {/* ── HESAP ── satır satır, kaynağıyla */}
      {o.satirlar.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.7rem' }}>Hesap</h2>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {o.satirlar.map((s: any, i: number) => (
              <div key={i} style={{
                borderLeft: '3px solid ' + (s.maliyetOlculdu ? '#16a34a' : '#f59e0b'),
                paddingLeft: '0.7rem', fontSize: '0.84rem',
              }}>
                <div style={{ fontWeight: 700 }}>{s.marka} {s.model} {s.adet > 1 && `× ${s.adet}`}</div>
                <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', color: '#374151', marginTop: 2 }}>
                  <span>{s.aylikSayfa.toLocaleString('tr-TR')} sayfa/ay</span>
                  {s.mevcutSayfaMaliyeti !== null && <span>şu an <b>{kurus(s.mevcutSayfaMaliyeti)}</b>/sayfa</span>}
                  {s.teklifSayfaSb !== null && <span>bizde <b>{kurus(s.teklifSayfaSb)}</b>/sayfa</span>}
                  {s.teklifAylik !== null && <span>aylık <b>{tl(s.teklifAylik)}</b></span>}
                  {s.aylikTasarruf !== null && (
                    <span style={{ color: s.aylikTasarruf > 0 ? '#15803d' : '#b91c1c' }}>
                      {s.aylikTasarruf > 0 ? 'tasarruf' : 'fark'} <b>{tl(Math.abs(s.aylikTasarruf))}</b>/ay
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', color: s.maliyetOlculdu ? '#15803d' : '#b45309', marginTop: 2 }}>
                  {s.maliyetOlculdu
                    ? `Maliyet ölçüldü (${s.gozlem} toner gözlemi) · teklif ${s.teklifKaynagi === 'ELLE' ? 'elle girildi' : 'hedef marjdan hesaplandı'}`
                    : 'Bu modelin sayfa maliyeti henüz ölçülmedi — fiyatı elle yaz. Uydurma maliyetten fiyat çıkarmıyoruz.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
