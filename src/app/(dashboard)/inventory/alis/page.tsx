'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * PARÇA ALIŞI — stoğun nereden, kaça geldiği.
 *
 * ── NEDEN AYRI EKRAN ─────────────────────────────────────────────────────
 * Stok listesindeki "alış fiyatı" alanını elle düzeltmek, o parçanın
 * maliyetini ezmek demek. Bayi aynı toneri üç ayrı tedarikçiden üç ayrı
 * fiyata alıyor; tek alan bunu taşıyamıyor. Ölçüldü: 688 parçanın 670'inde
 * alış fiyatı sıfır — çünkü tek alanı doldurmanın kimseye faydası yoktu.
 *
 * Burada her alış AYRI kayıt. Karşılığında iki şey çıkıyor: elindeki
 * stoğun gerçek ortalama maliyeti, ve aynı parçayı kimden kaça aldığın.
 */

type Parca = { id: string; sku: string; name: string; stockQty: number; buyPrice: number; avgCost: number | null; group: string | null };
type Alis = { id: string; quantity: number; unitCost: number; supplier: string | null; invoiceNo: string | null; purchasedAt: string; avgAfter: number | null; note: string | null };
type Tedarikci = { tedarikci: string; alisSayisi: number; toplamAdet: number; ortalamaFiyat: number; enUcuz: number; enPahali: number; sonAlis: string };

const tl = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gg = (s: string) => new Date(s).toLocaleDateString('tr-TR');
const bugun = () => new Date().toISOString().slice(0, 10);

export default function ParcaAlisPage() {
  const [parcalar, setParcalar] = useState<Parca[]>([]);
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState<Parca | null>(null);
  const [detay, setDetay] = useState<{ parca: Parca; alislar: Alis[]; tedarikciler: Tedarikci[] } | null>(null);
  const [form, setForm] = useState({ adet: '1', birimAlis: '', tedarikci: '', faturaNo: '', tarih: bugun(), not: '' });
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);

  useEffect(() => {
    fetch('/api/inventory').then((r) => r.json()).then((d) => setParcalar(Array.isArray(d) ? d : []));
  }, []);

  const detayYukle = async (p: Parca) => {
    setSecili(p); setSonuc(null);
    const r = await fetch(`/api/inventory/alis?partId=${p.id}`);
    setDetay(r.ok ? await r.json() : null);
  };

  const suzulen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    if (!q) return parcalar.slice(0, 40);
    return parcalar.filter((p) =>
      p.name.toLocaleLowerCase('tr').includes(q) || p.sku.toLocaleLowerCase('tr').includes(q),
    ).slice(0, 40);
  }, [parcalar, arama]);

  const kaydet = async () => {
    if (!secili) return;
    setKaydediliyor(true);
    const r = await fetch('/api/inventory/alis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId: secili.id, ...form }),
    });
    const d = await r.json();
    if (!r.ok) alert(d.error || 'Kaydedilemedi');
    else {
      setSonuc(d);
      setForm({ adet: '1', birimAlis: '', tedarikci: form.tedarikci, faturaNo: '', tarih: bugun(), not: '' });
      const liste = await (await fetch('/api/inventory')).json();
      setParcalar(Array.isArray(liste) ? liste : []);
      const yeni = (Array.isArray(liste) ? liste : []).find((x: Parca) => x.id === secili.id);
      if (yeni) setSecili(yeni);
      const rd = await fetch(`/api/inventory/alis?partId=${secili.id}`);
      setDetay(rd.ok ? await rd.json() : null);
    }
    setKaydediliyor(false);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '0.45rem', fontSize: '0.88rem', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' };

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Parça Alışı</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Her alışı ayrı kaydet. Elindeki stoğun gerçek ortalama maliyeti buradan çıkıyor —
        ve aynı parçayı kimden kaça aldığın. <Link href="/inventory" style={{ color: '#2563eb' }}>Stok listesi →</Link>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(16rem, 1fr) 2fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* ── PARÇA SEÇ ── */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem' }}>
          <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Parça ara (ad ya da kod)…" style={inp} />
          <div style={{ marginTop: '0.6rem', maxHeight: '26rem', overflowY: 'auto' }}>
            {suzulen.map((p) => (
              <button key={p.id} onClick={() => detayYukle(p)} style={{
                width: '100%', textAlign: 'left', padding: '0.5rem 0.6rem', border: 'none',
                borderRadius: '0.4rem', cursor: 'pointer', marginBottom: '0.15rem',
                background: secili?.id === p.id ? '#eff6ff' : 'transparent',
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{p.name}</div>
                <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>
                  {p.sku} · stok {p.stockQty}
                  {/* MALİYETİ BİLİNMEYEN PARÇA burada işaretleniyor: bayi hangi
                      satırları doldurması gerektiğini listeye bakarak görsün. */}
                  {!p.avgCost && !Number(p.buyPrice) && <span style={{ color: '#b45309', fontWeight: 700 }}> · maliyet yok</span>}
                </div>
              </button>
            ))}
            {suzulen.length === 0 && <p style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '0.5rem' }}>Parça bulunamadı.</p>}
          </div>
        </div>

        {/* ── ALIŞ FORMU + GEÇMİŞ ── */}
        <div>
          {!secili ? (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center', color: '#6b7280' }}>
              Soldan bir parça seç.
            </div>
          ) : (
            <>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{secili.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{secili.sku}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.4rem', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Stok</div>
                      <div style={{ fontWeight: 700 }}>{secili.stockQty}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Ortalama maliyet</div>
                      <div style={{ fontWeight: 700, color: secili.avgCost ? '#111827' : '#b45309' }}>
                        {secili.avgCost ? tl(secili.avgCost) : 'bilinmiyor'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Son alış</div>
                      <div style={{ fontWeight: 700 }}>{Number(secili.buyPrice) ? tl(Number(secili.buyPrice)) : '—'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.7rem' }}>
                  <div>
                    <label style={lbl}>Adet</label>
                    <input value={form.adet} onChange={(e) => setForm({ ...form, adet: e.target.value })} inputMode="numeric" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Birim alış (KDV hariç)</label>
                    <input value={form.birimAlis} onChange={(e) => setForm({ ...form, birimAlis: e.target.value })} inputMode="decimal" placeholder="0,00" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Tedarikçi</label>
                    <input value={form.tedarikci} onChange={(e) => setForm({ ...form, tedarikci: e.target.value })} placeholder="kimden aldın" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Fatura no</label>
                    <input value={form.faturaNo} onChange={(e) => setForm({ ...form, faturaNo: e.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Tarih</label>
                    <input type="date" value={form.tarih} onChange={(e) => setForm({ ...form, tarih: e.target.value })} style={inp} />
                  </div>
                </div>

                <button onClick={kaydet} disabled={kaydediliyor || !form.birimAlis}
                  style={{
                    marginTop: '0.9rem', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: 'none',
                    background: form.birimAlis ? '#0f2253' : '#9ca3af', color: 'white', fontWeight: 700,
                    fontSize: '0.88rem', cursor: form.birimAlis ? 'pointer' : 'not-allowed',
                  }}>
                  {kaydediliyor ? 'Kaydediliyor…' : 'Alışı kaydet ve stoğa ekle'}
                </button>

                {sonuc && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '0.5rem', padding: '0.65rem 0.85rem', marginTop: '0.8rem', fontSize: '0.84rem' }}>
                    ✓ Kaydedildi. Stok <b>{sonuc.yeniStok}</b>.{' '}
                    {sonuc.eskiOrtalama
                      ? <>Ortalama maliyet <b>{tl(sonuc.eskiOrtalama)} → {tl(sonuc.yeniOrtalama)}</b>
                        {sonuc.degisimYuzde !== null && <> (%{(sonuc.degisimYuzde * 100).toFixed(1).replace('.', ',')})</>}</>
                      : <>İlk alış — ortalama maliyet <b>{tl(sonuc.yeniOrtalama)}</b>.</>}
                  </div>
                )}
              </div>

              {/* ── TEDARİKÇİ KARŞILAŞTIRMASI ──
                  "Hep buradan alıyorum" cümlesinin doğru olup olmadığı ancak
                  yan yana konunca görünüyor. En ucuz üstte. */}
              {detay && detay.tedarikciler.length > 0 && (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.7rem' }}>Bu parçayı kimden kaça alıyorsun</h2>
                  <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.84rem' }}>
                    {detay.tedarikciler.map((t, i) => (
                      <div key={t.tedarikci} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 700, minWidth: '9rem', color: i === 0 ? '#15803d' : '#111827' }}>
                          {t.tedarikci}{i === 0 && detay.tedarikciler.length > 1 && ' ✓'}
                        </span>
                        <span style={{ fontWeight: 700 }}>{tl(t.ortalamaFiyat)}</span>
                        <span style={{ color: '#6b7280' }}>
                          {t.alisSayisi} alış · {t.toplamAdet} adet
                          {t.enUcuz !== t.enPahali && <> · {tl(t.enUcuz)}–{tl(t.enPahali)}</>}
                        </span>
                      </div>
                    ))}
                  </div>
                  {detay.tedarikciler.length > 1 && (
                    <p style={{ fontSize: '0.76rem', color: '#6b7280', margin: '0.6rem 0 0' }}>
                      En ucuzla en pahalı arasındaki fark adet başına{' '}
                      <b>{tl(detay.tedarikciler[detay.tedarikciler.length - 1].ortalamaFiyat - detay.tedarikciler[0].ortalamaFiyat)}</b>.
                    </p>
                  )}
                </div>
              )}

              {/* ── ALIŞ GEÇMİŞİ ── */}
              {detay && (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.7rem' }}>Alış geçmişi</h2>
                  {detay.alislar.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                      Henüz alış kaydı yok. Bu parçanın maliyeti
                      {Number(secili.buyPrice) ? ' son alış fiyatından tahmin ediliyor' : ' hiç bilinmiyor ve kârlılık hesabına girmiyor'}.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.83rem' }}>
                      {detay.alislar.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#6b7280', minWidth: '5.5rem' }}>{gg(a.purchasedAt)}</span>
                          <span style={{ minWidth: '3rem' }}>{a.quantity} ad.</span>
                          <span style={{ fontWeight: 700, minWidth: '5.5rem' }}>{tl(a.unitCost)}</span>
                          <span style={{ color: '#374151', minWidth: '8rem' }}>{a.supplier || '—'}</span>
                          {a.invoiceNo && <span style={{ color: '#9ca3af' }}>{a.invoiceNo}</span>}
                          {a.avgAfter !== null && <span style={{ color: '#6b7280' }}>ort. {tl(a.avgAfter)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.7 }}>
        Ortalama maliyet her alışta yeniden hesaplanıyor:
        <code style={{ margin: '0 0.3rem' }}>(eski stok × eski ortalama + adet × birim alış) ÷ (eski stok + adet)</code>.
        Parça kullanmak ortalamayı değiştirmiyor. Fişe parça eklendiğinde o günün maliyeti
        fişin içine yazılıyor — sonraki alışlar geçmiş kârlılığı değiştirmesin diye.
      </p>
    </div>
  );
}
