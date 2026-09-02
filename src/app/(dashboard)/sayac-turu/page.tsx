'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';

interface Cust { id: string; name: string; phone?: string }
interface Row {
  id: string; brand: string; model: string; serialNo: string; location: string;
  lastBlack: number | null; lastColor: number | null; hasColor: boolean; readAt: string | null;
}
interface RowState { black: string; color: string; reset: boolean; done?: boolean; err?: string | null; code?: string }

const nf = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('tr-TR'));
const money = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SayacTuruPage() {
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [q, setQ] = useState('');
  const [cust, setCust] = useState<Cust | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [st, setSt] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ saved: number; failed: number; totalCost: number } | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d: any) => {
      setCustomers(Array.isArray(d) ? d : d.customers || []);
    }).catch(() => {});
  }, []);

  // Sayacı gelmeyen cihazlar — panel kartı buraya iniyor. Kart "7 cihaz" der;
  // burada "kim, hangi cihaz, kaç gündür" görünür ve tıklayınca o müşterinin
  // sayaç listesi açılır. Ölçüt kartla aynı (35+ gün), uç bunu garanti eder.
  const [eksik, setEksik] = useState<{
    esikGun: number; toplam: number;
    musteriler: { id: string; name: string; phone: string;
      cihazlar: { id: string; ad: string; seri: string; yer: string | null; gunOnce: number | null }[] }[];
  } | null>(null);
  useEffect(() => {
    fetch('/api/sayac/eksik').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setEksik(d); }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers.slice(0, 8);
    return customers.filter((c) => c.name?.toLowerCase().includes(s) || (c.phone || '').includes(s)).slice(0, 8);
  }, [customers, q]);

  const load = useCallback(async (c: Cust) => {
    setCust(c); setLoading(true); setSummary(null); setRows([]); setSt({});
    try {
      const r = await fetch(`/api/readings/bulk?customerId=${c.id}`);
      const d = await r.json();
      if (r.ok) {
        setRows(d.devices || []);
        const init: Record<string, RowState> = {};
        for (const dev of d.devices || []) init[dev.id] = { black: '', color: '', reset: false };
        setSt(init);
      } else alert(d.error || 'Cihazlar alınamadı');
    } catch { alert('Sunucuya bağlanılamadı'); }
    setLoading(false);
  }, []);

  const setVal = (id: string, k: 'black' | 'color', v: string) =>
    setSt((s) => ({ ...s, [id]: { ...s[id], [k]: v.replace(/[^\d]/g, ''), err: null } }));

  // Doldurulmuş + henüz kaydedilmemiş satırlar
  const pending = rows.filter((r) => !st[r.id]?.done && (st[r.id]?.black || '').length > 0);
  const doneCount = rows.filter((r) => st[r.id]?.done).length;

  const save = async () => {
    if (!pending.length) return;
    setSaving(true);
    try {
      const payload = pending.map((r) => ({
        deviceId: r.id,
        counterBlack: Number(st[r.id].black),
        counterColor: r.hasColor && st[r.id].color ? Number(st[r.id].color) : (r.lastColor ?? 0),
        reset: !!st[r.id].reset,
      }));
      const res = await fetch('/api/readings/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'Kaydedilemedi'); setSaving(false); return; }

      setSt((s) => {
        const next = { ...s };
        for (const r of d.results || []) {
          next[r.deviceId] = r.ok
            ? { ...next[r.deviceId], done: true, err: null }
            : { ...next[r.deviceId], done: false, err: r.error, code: r.code };
        }
        return next;
      });
      setSummary({ saved: d.saved, failed: d.failed, totalCost: d.totalCost });
    } catch { alert('Sunucuya bağlanılamadı'); }
    setSaving(false);
  };

  // ── Müşteri seçimi ──
  if (!cust) {
    return (
      <div style={{ padding: '1.5rem 1.25rem 2rem', maxWidth: 620, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB' }}>Saha</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.022em', margin: '.3rem 0 .35rem', color: '#0B1533' }}>Sayaç Turu</h1>
        <p style={{ color: '#5B6479', fontSize: '.9rem', margin: '0 0 1.25rem', lineHeight: 1.55 }}>
          Müşteri seç — tüm kiralık cihazları tek listede çıkar, sadece yeni rakamları yaz.
        </p>

        {/* Sayacı gelmeyen cihazlar: "kimi arayacağım" listesi. Sıfırsa hiç
            görünmez — boş bir uyarı kutusu, olmayan sorunu varmış gibi gösterir. */}
        {eksik && eksik.toplam > 0 && (
          <div style={{ marginBottom: '1.25rem', borderRadius: 14, border: '1px solid #fecaca', background: '#fff7f7', padding: '.85rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '.95rem' }}>
                📟 {eksik.toplam} cihazın {eksik.esikGun}+ gündür sayacı yok
              </div>
              <div style={{ fontSize: '.72rem', color: '#8A93AB' }}>{eksik.musteriler.length} müşteri</div>
            </div>
            <p style={{ margin: '.25rem 0 .6rem', fontSize: '.78rem', color: '#7f1d1d', lineHeight: 1.5 }}>
              Sayacı gelmeyen makineden o ay para kazanılmaz. Müşteriye tıkla, sayacı yaz.
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {eksik.musteriler.slice(0, 12).map((m) => (
                <button key={m.id} type="button"
                  onClick={() => load({ id: m.id, name: m.name, phone: m.phone } as Cust)}
                  style={{ textAlign: 'left', background: '#fff', border: '1px solid #fde2e2', borderRadius: 10, padding: '.55rem .7rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '.86rem' }}>
                    <span style={{ fontWeight: 700, color: '#0B1533' }}>{m.name}</span>
                    <span style={{ color: '#991b1b', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.cihazlar.length} cihaz</span>
                  </div>
                  <div style={{ fontSize: '.72rem', color: '#5B6479', marginTop: 2 }}>
                    {m.cihazlar.slice(0, 3).map((c) => `${c.ad} · ${c.gunOnce == null ? 'hiç okunmadı' : `${c.gunOnce} gün`}`).join('  ·  ')}
                    {m.cihazlar.length > 3 ? `  · +${m.cihazlar.length - 3}` : ''}
                    {m.phone ? `  ·  ☎ ${m.phone}` : ''}
                  </div>
                </button>
              ))}
              {eksik.musteriler.length > 12 && (
                <div style={{ fontSize: '.72rem', color: '#8A93AB' }}>+{eksik.musteriler.length - 12} müşteri daha — arama kutusundan bul</div>
              )}
            </div>
          </div>
        )}

        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri ara…"
          style={{ width: '100%', padding: '.7rem .9rem', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: '1rem', boxSizing: 'border-box', outline: 'none' }} />

        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {filtered.map((c) => (
            <button key={c.id} onClick={() => load(c)}
              style={{ textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '.85rem 1rem', cursor: 'pointer', fontSize: '.95rem', fontWeight: 600, color: '#0B1533' }}>
              {c.name}
              {c.phone && <span style={{ color: '#9AA3B8', fontWeight: 400, fontSize: '.82rem' }}> · {c.phone}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p style={{ color: '#9AA3B8', fontSize: '.9rem', textAlign: 'center', padding: '1.5rem' }}>Müşteri bulunamadı.</p>}
        </div>
      </div>
    );
  }

  // ── Sayaç listesi ──
  return (
    <div style={{ padding: '1.25rem 1rem 6.5rem', maxWidth: 820, margin: '0 auto' }}>
      <button onClick={() => { setCust(null); setRows([]); setSt({}); setSummary(null); }}
        style={{ background: 'none', border: 'none', color: '#8A93AB', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>← Müşteri değiştir</button>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-.02em', margin: '.4rem 0 .2rem', color: '#0B1533' }}>{cust.name}</h1>
      <p style={{ color: '#5B6479', fontSize: '.85rem', margin: '0 0 1rem' }}>
        {rows.length} kiralık cihaz{doneCount > 0 && <> · <b style={{ color: '#0B6B4A' }}>{doneCount} okundu</b></>}
      </p>

      {summary && (
        <div style={{ background: summary.failed ? '#FEF6E7' : '#E7F6EF', border: `1px solid ${summary.failed ? '#FDE68A' : '#A7E3C8'}`, borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', fontSize: '.9rem', color: summary.failed ? '#8A5A08' : '#0B6B4A' }}>
          <b>{summary.saved} cihaz kaydedildi</b>
          {summary.failed > 0 && <> · <b>{summary.failed} satırda sorun var</b> (aşağıda kırmızı)</>}
          {summary.totalCost > 0 && <> · Bu turun sayaç bedeli: <b>{money(summary.totalCost)}</b></>}
        </div>
      )}

      {loading ? <p style={{ color: '#9AA3B8' }}>Yükleniyor…</p> : rows.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center', color: '#5B6479' }}>
          Bu müşteride kiralık cihaz yok.<br />
          <Link href="/devices" style={{ color: '#2563eb', fontSize: '.9rem' }}>Cihazlara git →</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r, i) => {
            const s = st[r.id] || { black: '', color: '', reset: false };
            const prevLoc = i > 0 ? rows[i - 1].location : null;
            const showLoc = r.location && r.location !== prevLoc;
            const nb = s.black ? Number(s.black) : null;
            const diff = nb != null && r.lastBlack != null ? nb - r.lastBlack : null;

            return (
              <div key={r.id}>
                {showLoc && (
                  <div style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB', margin: '.7rem 0 .35rem' }}>
                    📍 {r.location}
                  </div>
                )}
                <div style={{
                  background: s.done ? '#F3FBF7' : 'white',
                  border: `1px solid ${s.err ? '#FCA5A5' : s.done ? '#A7E3C8' : '#e5e7eb'}`,
                  borderRadius: 14, padding: '.75rem .85rem',
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontWeight: 700, fontSize: '.92rem', color: '#0B1533' }}>
                        {s.done && <span style={{ color: '#0B6B4A' }}>✓ </span>}{r.brand} {r.model}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#8A93AB', marginTop: 2 }}>
                        Önceki: ⚫ {nf(r.lastBlack)}{r.hasColor && <> · 🟣 {nf(r.lastColor)}</>}
                        {r.readAt && <span style={{ color: '#0B6B4A' }}> · bu ay okundu</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input inputMode="numeric" value={s.black} disabled={s.done}
                        onChange={(e) => setVal(r.id, 'black', e.target.value)}
                        placeholder="⚫ yeni"
                        style={{ width: r.hasColor ? 96 : 130, padding: '.55rem .6rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '1rem', textAlign: 'right', fontFamily: 'monospace', background: s.done ? '#F3FBF7' : 'white' }} />
                      {r.hasColor && (
                        <input inputMode="numeric" value={s.color} disabled={s.done}
                          onChange={(e) => setVal(r.id, 'color', e.target.value)}
                          placeholder="🟣 yeni"
                          style={{ width: 96, padding: '.55rem .6rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '1rem', textAlign: 'right', fontFamily: 'monospace', background: s.done ? '#F3FBF7' : 'white' }} />
                      )}
                    </div>
                  </div>

                  {diff != null && !s.done && (
                    <div style={{ fontSize: '.78rem', marginTop: 6, color: diff < 0 ? '#B91C1C' : '#0B6B4A', fontWeight: 600 }}>
                      {diff < 0 ? `⚠ ${nf(diff)} — sayaç düşük görünüyor` : `+${nf(diff)} sayfa`}
                    </div>
                  )}

                  {s.err && (
                    <div style={{ marginTop: 8, background: '#FDECEC', border: '1px solid #FCA5A5', borderRadius: 10, padding: '.55rem .7rem' }}>
                      <div style={{ color: '#9B1C1C', fontSize: '.8rem', lineHeight: 1.45 }}>{s.err}</div>
                      {s.code === 'COUNTER_DECREASE' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: '.8rem', color: '#7C2D12', cursor: 'pointer' }}>
                          <input type="checkbox" checked={s.reset}
                            onChange={(e) => setSt((x) => ({ ...x, [r.id]: { ...x[r.id], reset: e.target.checked } }))} />
                          Sayaç sıfırlandı / cihaz değişti — yine de kaydet
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sabit kaydet çubuğu */}
      {rows.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 46,
          background: 'white', borderTop: '1px solid rgba(15,34,83,.1)',
          padding: '.7rem 1rem calc(.7rem + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -6px 20px -14px rgba(15,34,83,.35)',
        }}
          className="md:pb-3">
          <div style={{ flex: 1, fontSize: '.85rem', color: '#5B6479' }}>
            <b style={{ color: '#0B1533' }}>{doneCount}/{rows.length}</b> okundu
            {pending.length > 0 && <> · {pending.length} kaydedilecek</>}
          </div>
          <button onClick={save} disabled={saving || pending.length === 0}
            style={{
              padding: '.75rem 1.4rem', borderRadius: 999, border: 'none',
              background: pending.length ? '#0E9F6E' : '#D1D5DB', color: 'white',
              fontWeight: 800, fontSize: '.95rem', cursor: pending.length ? 'pointer' : 'not-allowed',
            }}>
            {saving ? 'Kaydediliyor…' : `Kaydet${pending.length ? ` (${pending.length})` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
