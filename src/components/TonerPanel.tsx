'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forecastChannel } from '@/lib/toner';

interface Props {
  deviceId: string;
  counterBlack: number | null;
  counterColor: number | null;
  tonerYieldBlack: number | null;
  tonerYieldColor: number | null;
  tonerResetBlack: number | null;
  tonerResetColor: number | null;
  tonerChangedAt: string | null;
}

function barColor(pct: number | null): string {
  if (pct == null) return '#94a3b8';
  if (pct <= 15) return '#dc2626';
  if (pct <= 40) return '#d97706';
  return '#059669';
}

export default function TonerPanel(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [yb, setYb] = useState(props.tonerYieldBlack != null ? String(props.tonerYieldBlack) : '');
  const [yc, setYc] = useState(props.tonerYieldColor != null ? String(props.tonerYieldColor) : '');

  const fb = forecastChannel({ yieldPages: props.tonerYieldBlack, reset: props.tonerResetBlack, current: props.counterBlack, rate: null, channel: 'black' });
  const fc = forecastChannel({ yieldPages: props.tonerYieldColor, reset: props.tonerResetColor, current: props.counterColor, rate: null, channel: 'color' });
  const configured = !!(props.tonerYieldBlack || props.tonerYieldColor);

  const post = async (extra: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/devices/${props.deviceId}/toner`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra),
    });
    setSaving(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); alert('Hata: ' + (d.error || 'Kaydedilemedi')); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '0.25rem' };

  const Channel = ({ f, label }: { f: ReturnType<typeof forecastChannel>; label: string }) => {
    if (!f) return null;
    if (f.needsSetup) {
      return (
        <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
          {label}: Verim girildi. Yeni toner takıldığında <b>“Toner Değişti”</b>ye basın; takip oradan başlar.
        </div>
      );
    }
    const pct = f.remainingPct;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
          <span style={{ color: '#374151', fontWeight: 600 }}>{label}</span>
          <span style={{ color: barColor(pct), fontWeight: 700 }}>
            ≈%{pct} kaldı · {(f.remaining ?? 0).toLocaleString('tr-TR')} / {f.yield.toLocaleString('tr-TR')} sf
          </span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, pct ?? 0))}%`, background: barColor(pct), borderRadius: 99 }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontWeight: 600, margin: 0 }}>🧴 Toner Takibi</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {configured && (
            <button onClick={() => post({ markChanged: true })} disabled={saving}
              style={{ padding: '0.45rem 0.9rem', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              ♻️ Toner Değişti
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)}
            style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            {open ? '✕ Kapat' : (configured ? '⚙️ Verim Ayarla' : '⚙️ Kur')}
          </button>
        </div>
      </div>

      {!configured && !open && (
        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
          Toner verimini (sayfa/toner) girip “Toner Değişti”yi işaretleyin; sistem sayaç hızından bu cihaza <b>kaç gün sonra toner gerekeceğini</b> tahmin eder.
        </p>
      )}

      {configured && (
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: open ? '1rem' : 0 }}>
          <Channel f={fb} label="⚫ Siyah toner" />
          <Channel f={fc} label="🟣 Renkli toner" />
          {props.tonerChangedAt && (
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              Son toner değişimi: {new Date(props.tonerChangedAt).toLocaleDateString('tr-TR')} · gün tahmini için <a href="/sarf" style={{ color: '#2563eb', textDecoration: 'none' }}>Sarf Takibi →</a>
            </div>
          )}
        </div>
      )}

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
          <div>
            <label style={lbl}>⚫ S/B toner verimi (sf)</label>
            <input type="number" min="0" step="100" style={inp} value={yb} onChange={(e) => setYb(e.target.value)} placeholder="örn. 6000" />
          </div>
          <div>
            <label style={lbl}>🟣 Renkli toner verimi (sf)</label>
            <input type="number" min="0" step="100" style={inp} value={yc} onChange={(e) => setYc(e.target.value)} placeholder="örn. 4000" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => post({ tonerYieldBlack: yb, tonerYieldColor: yc })} disabled={saving}
              style={{ flex: 1, padding: '0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Kaydediliyor…' : '💾 Verimi Kaydet'}
            </button>
            <button onClick={() => post({ tonerYieldBlack: yb, tonerYieldColor: yc, markChanged: true })} disabled={saving}
              style={{ flex: 1, padding: '0.6rem', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              Kaydet + ♻️ Toner Yeni Takıldı
            </button>
          </div>
          <p style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>
            Verim = bir tonerin bastığı sayfa (kutu/üretici değeri). “Toner Yeni Takıldı” o anki sayacı referans alır; kalan, sonraki okumalarla otomatik hesaplanır.
          </p>
        </div>
      )}
    </div>
  );
}
