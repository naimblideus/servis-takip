'use client';

import { useEffect, useMemo, useState } from 'react';

interface Cust { id: string; name: string }
type Field = 'monthlyRent' | 'pricePerBlack' | 'pricePerColor' | 'overagePriceBlack' | 'overagePriceColor';

const FIELD_OPTS: { key: Field; label: string; hint: string }[] = [
  { key: 'monthlyRent', label: 'Aylık kira', hint: 'Sabit aylık bedel' },
  { key: 'pricePerBlack', label: 'Sayfa fiyatı (S/B)', hint: 'Siyah-beyaz baskı' },
  { key: 'pricePerColor', label: 'Sayfa fiyatı (Renkli)', hint: 'Renkli baskı' },
  { key: 'overagePriceBlack', label: 'Aşım (S/B)', hint: 'Dahil paketi aşan S/B' },
  { key: 'overagePriceColor', label: 'Aşım (Renkli)', hint: 'Dahil paketi aşan renkli' },
];

const money = (n: number, d = 2) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function TopluZamPage() {
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('15');
  const [fields, setFields] = useState<Field[]>(['monthlyRent']);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d: any) => {
      setCustomers(Array.isArray(d) ? d : d.customers || []);
    }).catch(() => {});
  }, []);

  const toggle = (f: Field) =>
    setFields((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));

  const canRun = useMemo(() => Number(value) !== 0 && fields.length > 0, [value, fields]);

  const call = async (dryRun: boolean) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/devices/bulk-price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId || undefined, mode, value: Number(value), fields, dryRun }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'İşlem yapılamadı'); setBusy(false); return; }
      setPreview(d);
      if (!dryRun) setApplied(true);
    } catch { setErr('Sunucuya bağlanılamadı'); }
    setBusy(false);
  };

  const custName = customers.find((c) => c.id === customerId)?.name;

  return (
    <div style={{ padding: '1.5rem 1.25rem 3rem', maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #app-sidebar { display: none !important; }
          #app-main { padding: 0 !important; }
          body { background: #fff !important; }
          .zam-print { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print">
        <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB' }}>Fiyatlandırma</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.022em', margin: '.3rem 0 .35rem', color: '#0B1533' }}>Toplu Zam</h1>
        <p style={{ color: '#5B6479', fontSize: '.9rem', margin: '0 0 1.4rem', lineHeight: 1.55 }}>
          Kiralık cihazların fiyatlarını tek işlemde güncelle. <b>Önce önizleme çıkar</b>, listeyi gör, sonra uygula.
        </p>
      </div>

      {/* Ayarlar */}
      {!applied && (
        <div className="no-print" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: '1.25rem 1.35rem', marginBottom: '1.1rem' }}>
          <div style={{ display: 'grid', gap: '1.1rem' }}>
            <div>
              <label style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB', display: 'block', marginBottom: 6 }}>Kimlere</label>
              <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPreview(null); }}
                style={{ width: '100%', padding: '.6rem .85rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '.95rem', background: 'white' }}>
                <option value="">Tüm müşteriler (tüm kiralık cihazlar)</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB', display: 'block', marginBottom: 6 }}>Ne kadar</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['percent', 'amount'] as const).map((m) => (
                    <button key={m} onClick={() => { setMode(m); setPreview(null); }}
                      style={{
                        padding: '.55rem 1rem', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                        border: `1px solid ${mode === m ? '#0F2253' : '#e5e7eb'}`,
                        background: mode === m ? '#0F2253' : 'white', color: mode === m ? 'white' : '#5B6479',
                      }}>{m === 'percent' ? 'Yüzde (%)' : 'Tutar (₺)'}</button>
                  ))}
                </div>
                <input inputMode="decimal" value={value}
                  onChange={(e) => { setValue(e.target.value.replace(',', '.')); setPreview(null); }}
                  style={{ width: 120, padding: '.6rem .85rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '1rem', textAlign: 'right', fontFamily: 'monospace' }} />
                <span style={{ color: '#8A93AB', fontSize: '.9rem' }}>{mode === 'percent' ? '% zam' : '₺ ekle'}</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB', display: 'block', marginBottom: 6 }}>Hangi fiyatlar</label>
              <div style={{ display: 'grid', gap: 6 }}>
                {FIELD_OPTS.map((f) => (
                  <label key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '.6rem .75rem', borderRadius: 10, cursor: 'pointer',
                    background: fields.includes(f.key) ? '#F0F7F4' : '#F7F9FC',
                    border: `1px solid ${fields.includes(f.key) ? '#A7E3C8' : 'transparent'}`,
                  }}>
                    <input type="checkbox" checked={fields.includes(f.key)} onChange={() => { toggle(f.key); setPreview(null); }} />
                    <span style={{ fontWeight: 600, fontSize: '.9rem', color: '#0B1533' }}>{f.label}</span>
                    <span style={{ fontSize: '.78rem', color: '#9AA3B8', marginLeft: 'auto' }}>{f.hint}</span>
                  </label>
                ))}
              </div>
            </div>

            {err && <div style={{ color: '#B91C1C', fontSize: '.88rem' }}>{err}</div>}

            <button onClick={() => call(true)} disabled={!canRun || busy}
              style={{
                padding: '.8rem', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '.95rem',
                background: canRun ? '#0F2253' : '#D1D5DB', color: 'white', cursor: canRun ? 'pointer' : 'not-allowed',
              }}>
              {busy ? 'Hesaplanıyor…' : 'Önizleme çıkar'}
            </button>
          </div>
        </div>
      )}

      {/* Önizleme / Sonuç */}
      {preview && (
        <div className="zam-print" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: '1.25rem 1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', paddingBottom: '.9rem', borderBottom: '2px solid #0F2253', marginBottom: '.9rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0B1533' }}>
                {applied ? '✓ Zam uygulandı' : 'Zam Önizleme'}
              </div>
              <div style={{ fontSize: '.82rem', color: '#5B6479', marginTop: 3 }}>
                {custName || 'Tüm müşteriler'} · {preview.mode === 'percent' ? `%${preview.value}` : `+₺${preview.value}`} · {preview.fieldLabels.join(', ')}
              </div>
            </div>
            <div style={{ fontSize: '.82rem', color: '#8A93AB', textAlign: 'right' }}>
              {new Date().toLocaleDateString('tr-TR')}<br />{preview.deviceCount} cihaz
            </div>
          </div>

          {preview.deviceCount === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#5B6479' }}>
              Güncellenecek cihaz bulunamadı.
              {preview.skippedEmpty > 0 && <div style={{ fontSize: '.82rem', color: '#B45309', marginTop: 8 }}>
                {preview.skippedEmpty} alanda fiyat girilmemiş — zam yapılamadı.
              </div>}
            </div>
          ) : (
            <>
              {preview.monthlyDiff > 0 && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: '#F0F7F4', border: '1px solid #A7E3C8', borderRadius: 12, padding: '.8rem 1rem', marginBottom: '.9rem' }}>
                  <div><div style={{ fontSize: '.72rem', color: '#5B6479', fontWeight: 600 }}>Aylık kira toplamı</div>
                    <div style={{ fontWeight: 800, color: '#0B1533' }}>₺{money(preview.oldMonthlyTotal)} → ₺{money(preview.newMonthlyTotal)}</div></div>
                  <div><div style={{ fontSize: '.72rem', color: '#5B6479', fontWeight: 600 }}>Aylık artış</div>
                    <div style={{ fontWeight: 800, color: '#0B6B4A' }}>+₺{money(preview.monthlyDiff)}</div></div>
                  <div><div style={{ fontSize: '.72rem', color: '#5B6479', fontWeight: 600 }}>Yıllık etki</div>
                    <div style={{ fontWeight: 800, color: '#0B6B4A' }}>+₺{money(preview.monthlyDiff * 12)}</div></div>
                </div>
              )}

              {preview.skippedEmpty > 0 && (
                <div className="no-print" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 10, padding: '.6rem .8rem', fontSize: '.8rem', marginBottom: '.9rem' }}>
                  ⚠️ {preview.skippedEmpty} alanda fiyat girilmemiş (cihazda ve firma varsayılanında) — o alanlara zam uygulanmadı.
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F7F9FC' }}>
                      <th style={{ textAlign: 'left', padding: '.5rem .6rem', fontSize: '.7rem', fontWeight: 800, color: '#5B6479', textTransform: 'uppercase', letterSpacing: '.05em' }}>Müşteri / Cihaz</th>
                      <th style={{ textAlign: 'left', padding: '.5rem .6rem', fontSize: '.7rem', fontWeight: 800, color: '#5B6479', textTransform: 'uppercase', letterSpacing: '.05em' }}>Alan</th>
                      <th style={{ textAlign: 'right', padding: '.5rem .6rem', fontSize: '.7rem', fontWeight: 800, color: '#5B6479', textTransform: 'uppercase', letterSpacing: '.05em' }}>Eski → Yeni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r: any) => (
                      Object.entries(r.changes).map(([f, ch]: any, i) => (
                        <tr key={`${r.id}-${f}`} style={{ borderBottom: '1px solid #eef2f7' }}>
                          {i === 0 && (
                            <td rowSpan={Object.keys(r.changes).length} style={{ padding: '.5rem .6rem', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 700, color: '#0B1533' }}>{r.device}</div>
                              <div style={{ fontSize: '.75rem', color: '#8A93AB' }}>{r.customerName}{r.location ? ` · 📍 ${r.location}` : ''}</div>
                            </td>
                          )}
                          <td style={{ padding: '.5rem .6rem', color: '#5B6479' }}>
                            {FIELD_OPTS.find((x) => x.key === f)?.label || f}
                          </td>
                          <td style={{ padding: '.5rem .6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                            <span style={{ color: '#9AA3B8' }}>{ch.old == null ? '—' : money(ch.old, f === 'monthlyRent' ? 2 : 4)}</span>
                            <span style={{ color: '#9AA3B8' }}> → </span>
                            <b style={{ color: '#0B6B4A' }}>{money(ch.next, f === 'monthlyRent' ? 2 : 4)}</b>
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="no-print" style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end', marginTop: '1.1rem', flexWrap: 'wrap' }}>
                {!applied ? (
                  <>
                    <button onClick={() => setPreview(null)}
                      style={{ padding: '.7rem 1.2rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                      Vazgeç
                    </button>
                    <button onClick={() => { if (confirm(`${preview.deviceCount} cihazın fiyatı güncellenecek. Onaylıyor musunuz?`)) call(false); }} disabled={busy}
                      style={{ padding: '.7rem 1.4rem', background: '#0E9F6E', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>
                      {busy ? 'Uygulanıyor…' : 'Zammı uygula'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setApplied(false); setPreview(null); }}
                      style={{ padding: '.7rem 1.2rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                      Yeni zam
                    </button>
                    <button onClick={() => window.print()}
                      style={{ padding: '.7rem 1.4rem', background: '#0F2253', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>
                      🖨️ Zam listesini yazdır
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
