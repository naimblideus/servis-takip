'use client';

import { useEffect, useState } from 'react';

export default function TwoFactorCard() {
  const [status, setStatus] = useState<{ enabled: boolean; recoveryLeft: number } | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const load = () => fetch('/api/auth/2fa').then((r) => r.json()).then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  const call = async (action: string, extra: any = {}) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/auth/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'İşlem yapılamadı'); setBusy(false); return null; }
      setBusy(false);
      return d;
    } catch { setErr('Sunucuya bağlanılamadı'); setBusy(false); return null; }
  };

  const startSetup = async () => {
    const d = await call('setup');
    if (d) { setSetup({ qr: d.qr, secret: d.secret }); setCode(''); }
  };

  const enable = async () => {
    const d = await call('enable', { code });
    if (d) { setCodes(d.recoveryCodes); setSetup(null); setCode(''); load(); }
  };

  const disable = async () => {
    const d = await call('disable', { code, password });
    if (d) { setDisabling(false); setCode(''); setPassword(''); load(); }
  };

  const card: React.CSSProperties = {
    marginTop: '1.5rem', backgroundColor: 'white', borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem',
    borderLeft: `4px solid ${status?.enabled ? '#10b981' : '#94a3b8'}`,
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '1rem', boxSizing: 'border-box',
  };

  // Kurtarma kodları — SADECE BİR KEZ gösterilir
  if (codes) {
    return (
      <div style={{ ...card, borderLeftColor: '#f59e0b' }}>
                <h2 style={{ fontWeight: 600, marginBottom: '0.35rem' }}>🔑 Kurtarma Kodlarınız</h2>
        <p style={{ fontSize: '0.85rem', color: '#b45309', lineHeight: 1.6, marginBottom: '0.9rem' }}>
          <b>Bu kodlar bir daha gösterilmeyecek.</b> Telefonunuzu kaybederseniz giriş yapmanın tek yolu bunlar.
          Bir yere yazın ya da ekran görüntüsü alın. Her kod bir kez kullanılır.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8,
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.9rem', marginBottom: '0.9rem',
        }}>
          {codes.map((c) => (
            <code key={c} style={{ fontFamily: 'monospace', fontSize: '0.95rem', letterSpacing: '.05em', color: '#0f2253' }}>{c}</code>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
            style={{ padding: '0.6rem 1.1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
            📋 Kopyala
          </button>
          <button onClick={() => setCodes(null)}
            style={{ padding: '0.6rem 1.1rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>
            Kaydettim, kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <h2 style={{ fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        🔐 İki Adımlı Doğrulama
        {status?.enabled
          ? <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 700, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 10px' }}>Açık</span>
          : <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, padding: '2px 10px' }}>İsteğe bağlı · Kapalı</span>}
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '0.9rem' }}>
        {status?.enabled
          ? <>Girişte şifrenizin yanında telefonunuzdaki 6 haneli kod istenir. Şifreniz çalınsa bile hesabınıza girilemez. Kalan kurtarma kodu: <b>{status.recoveryLeft}</b> · İstediğiniz zaman kapatabilirsiniz.</>
          : <>
            <b>Zorunlu değildir</b> — açmazsanız giriş şu anki gibi devam eder. Açarsanız, şifreniz çalınsa bile
            hesabınıza girilemez: girişte telefonunuzdaki 6 haneli kod da istenir.
            Kurulum 1 dakika (QR okutup kodu yazmanız yeterli).
          </>}
      </p>

      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{err}</div>}

      {/* Kurulum: QR + kod doğrulama */}
      {setup && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.1rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <img src={setup.qr} alt="QR kod" style={{ width: 190, height: 190, borderRadius: 10, background: 'white', border: '1px solid #e2e8f0' }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <ol style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.8, paddingLeft: '1.1rem', margin: 0 }}>
                <li>Telefonunda <b>Google Authenticator</b> (ya da benzeri) uygulamasını aç</li>
                <li><b>+</b> → <b>QR kodu tara</b> ile soldaki kodu okut</li>
                <li>Uygulamada çıkan <b>6 haneli kodu</b> aşağıya yaz</li>
              </ol>
              <details style={{ marginTop: '0.7rem' }}>
                <summary style={{ fontSize: '0.78rem', color: '#6b7280', cursor: 'pointer' }}>QR okutamıyorum</summary>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6, wordBreak: 'break-all' }}>
                  Uygulamaya elle şu anahtarı girin:<br />
                  <code style={{ fontFamily: 'monospace', color: '#0f2253' }}>{setup.secret}</code>
                </p>
              </details>

              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" placeholder="000000" autoFocus
                style={{ ...inp, marginTop: '0.8rem', textAlign: 'center', letterSpacing: '.4em', fontFamily: 'monospace', fontSize: '1.15rem' }} />

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                <button onClick={enable} disabled={busy || code.length !== 6}
                  style={{ flex: 1, padding: '0.65rem', background: code.length === 6 ? '#10b981' : '#d1d5db', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'not-allowed' }}>
                  {busy ? 'Doğrulanıyor…' : 'Doğrula ve Aç'}
                </button>
                <button onClick={() => { setSetup(null); setCode(''); setErr(null); }}
                  style={{ padding: '0.65rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kapatma: şifre + kod ister */}
      {disabling && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '1rem', marginBottom: '0.9rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: '0.7rem' }}>
            Güvenlik için şifrenizi ve güncel doğrulama kodunu girin.
          </p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifreniz" style={{ ...inp, marginBottom: '0.5rem' }} />
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000"
            style={{ ...inp, textAlign: 'center', letterSpacing: '.3em', fontFamily: 'monospace' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
            <button onClick={disable} disabled={busy || !password || code.length !== 6}
              style={{ flex: 1, padding: '0.6rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', opacity: (!password || code.length !== 6) ? 0.5 : 1 }}>
              Kapat
            </button>
            <button onClick={() => { setDisabling(false); setCode(''); setPassword(''); setErr(null); }}
              style={{ padding: '0.6rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Ana aksiyon */}
      {!setup && !disabling && (
        status?.enabled ? (
          <button onClick={() => setDisabling(true)}
            style={{ padding: '0.6rem 1.1rem', background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
            İki adımlı doğrulamayı kapat
          </button>
        ) : (
          <button onClick={startSetup} disabled={busy}
            style={{ padding: '0.7rem 1.3rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Hazırlanıyor…' : '🔐 Kur ve Aç'}
          </button>
        )
      )}
    </div>
  );
}
