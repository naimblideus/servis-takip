'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { forecastChannel } from '@/lib/toner';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

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
  const t = useT();
  const b = useBicim();
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
    else { const d = await res.json().catch(() => ({})); alert(doldur(t.fisler.hata, { n: d.error || t.toner.kaydedilemedi })); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '0.25rem' };

  const Channel = ({ f, label }: { f: ReturnType<typeof forecastChannel>; label: string }) => {
    if (!f) return null;
    if (f.needsSetup) {
      return (
        <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
          {doldur(t.toner.kurulumGerek, { kanal: label })}
        </div>
      );
    }
    const pct = f.remainingPct;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
          <span style={{ color: '#374151', fontWeight: 600 }}>{label}</span>
          <span style={{ color: barColor(pct), fontWeight: 700 }}>
            {doldur(t.toner.kalan, { yuzde: pct ?? 0, kalan: b.sayi(f.remaining ?? 0), toplam: b.sayi(f.yield) })}
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
        <h2 style={{ fontWeight: 600, margin: 0 }}>{t.toner.baslik}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {configured && (
            <button onClick={() => post({ markChanged: true })} disabled={saving}
              style={{ padding: '0.45rem 0.9rem', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {t.toner.degisti}
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)}
            style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            {open ? t.fisPanel.paneliKapat : (configured ? t.toner.verimAyarla : t.toner.kur)}
          </button>
        </div>
      </div>

      {!configured && !open && (
        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
          {t.toner.tanitimOn} <b>{t.toner.tanitimVurgu}</b>{t.toner.tanitimSon}
        </p>
      )}

      {configured && (
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: open ? '1rem' : 0 }}>
          <Channel f={fb} label={t.toner.siyahToner} />
          <Channel f={fc} label={t.toner.renkliToner} />
          {props.tonerChangedAt && (
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {doldur(t.toner.sonDegisim, { tarih: b.tarih(props.tonerChangedAt) })} <a href="/sarf" style={{ color: '#2563eb', textDecoration: 'none' }}>{t.toner.sarfTakibi}</a>
            </div>
          )}
        </div>
      )}

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
          <div>
            <label style={lbl}>{t.toner.siyahVerim}</label>
            <input type="number" min="0" step="100" style={inp} value={yb} onChange={(e) => setYb(e.target.value)} placeholder={t.toner.siyahVerimOrnek} />
          </div>
          <div>
            <label style={lbl}>{t.toner.renkliVerim}</label>
            <input type="number" min="0" step="100" style={inp} value={yc} onChange={(e) => setYc(e.target.value)} placeholder={t.toner.renkliVerimOrnek} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => post({ tonerYieldBlack: yb, tonerYieldColor: yc })} disabled={saving}
              style={{ flex: 1, padding: '0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? t.genel.kaydediliyor : t.toner.verimiKaydet}
            </button>
            <button onClick={() => post({ tonerYieldBlack: yb, tonerYieldColor: yc, markChanged: true })} disabled={saving}
              style={{ flex: 1, padding: '0.6rem', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {t.toner.kaydetVeTak}
            </button>
          </div>
          <p style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>
            {t.toner.verimAciklama}
          </p>
        </div>
      )}
    </div>
  );
}
