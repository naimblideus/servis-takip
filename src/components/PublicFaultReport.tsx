'use client';

import { useState } from 'react';

// Müşteri cihazdaki QR'ı okutunca (oturumsuz) gördüğü arıza-bildirim formu.
export default function PublicFaultReport({ code, deviceName, tenantName }: { code: string; deviceName: string; tenantName: string }) {
  const [form, setForm] = useState({ name: '', phone: '', issue: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ ticketNumber: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (form.issue.trim().length < 5) { setErr('Lütfen arızayı kısaca açıklayın.'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/public/fault-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...form }),
      });
      const d = await r.json();
      if (r.ok) setDone({ ticketNumber: d.ticketNumber });
      else setErr(d.error || 'Gönderilemedi');
    } catch { setErr('Bağlantı hatası'); }
    setSending(false);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.7rem 0.85rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '1rem', boxSizing: 'border-box', marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600, color: '#374151' };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.25rem', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 460, marginTop: '2.5vh' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', borderRadius: '1rem 1rem 0 0', padding: '1.4rem 1.5rem' }}>
          <div style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 700, letterSpacing: '0.04em' }}>{tenantName}</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 4 }}>Arıza Bildir</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 2 }}>📠 {deviceName}</div>
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 1rem 1rem', padding: '1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.5rem' }}>✅</div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d', margin: '0.5rem 0' }}>Bildiriminiz alındı</h2>
              <p style={{ color: '#374151', fontSize: '0.95rem', margin: 0 }}>
                Servis kaydınız oluşturuldu: <b style={{ fontFamily: 'monospace' }}>{done.ticketNumber}</b>
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                En kısa sürede sizinle iletişime geçilecektir. Teşekkür ederiz.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: 0, marginBottom: '1rem' }}>
                Cihazınızla ilgili sorunu yazın; servis ekibi en kısa sürede ilgilenecek.
              </p>
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={lbl}>Arıza / Sorun *</label>
                <textarea rows={4} style={inp} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} placeholder="Örn: Kağıt sıkışıyor, baskı silik çıkıyor…" />
              </div>
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={lbl}>Adınız (opsiyonel)</label>
                <input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad Soyad" />
              </div>
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={lbl}>Telefon (opsiyonel)</label>
                <input style={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XX XX" inputMode="tel" />
              </div>
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: 0 }}>{err}</p>}
              <button type="submit" disabled={sending} style={{ width: '100%', padding: '0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Gönderiliyor…' : 'Arıza Bildir'}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.72rem', marginTop: '0.9rem' }}>Servora ile güçlendirilmiştir</p>
      </div>
    </div>
  );
}
