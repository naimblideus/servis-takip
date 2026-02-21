'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
    publicCode: string;
    deviceName: string;
}

export default function DeviceQRCode({ publicCode, deviceName }: Props) {
    const [open, setOpen] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${publicCode}`;

    useEffect(() => {
        if (!open) return;
        generateQR();
    }, [open]);

    const generateQR = async () => {
        // QR kodu canvas'a çiz (harici kütüphane olmadan, Google Charts API ile)
        const size = 250;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrUrl)}&margin=10`;
        setQrDataUrl(url);
    };

    const printQR = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`
      <html>
        <head><title>QR - ${deviceName}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',sans-serif;margin:0">
          <div style="text-align:center;padding:2rem">
            <img src="${qrDataUrl}" width="300" height="300" />
            <h2 style="margin:1rem 0 0.25rem">${deviceName}</h2>
            <p style="color:#6b7280;font-size:0.9rem;margin:0">Kod: ${publicCode}</p>
            <p style="color:#9ca3af;font-size:0.75rem;margin-top:0.5rem">${qrUrl}</p>
          </div>
          <script>setTimeout(()=>window.print(),500)<\/script>
        </body>
      </html>
    `);
        w.document.close();
    };

    const downloadQR = async () => {
        try {
            const response = await fetch(qrDataUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR-${publicCode}.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            window.open(qrDataUrl, '_blank');
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={{
                padding: '0.5rem 0.875rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                QR Kod
            </button>

            {open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setOpen(false)}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '1rem', padding: '2rem',
                        width: '100%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        textAlign: 'center',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.25rem' }}>Cihaz QR Kodu</h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{deviceName}</p>

                        {/* QR Kodu */}
                        <div style={{
                            display: 'inline-block', padding: '1rem', backgroundColor: 'white',
                            border: '2px solid #e5e7eb', borderRadius: '0.75rem', marginBottom: '1rem',
                        }}>
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR Code" width={250} height={250} style={{ display: 'block' }} />
                            ) : (
                                <div style={{ width: 250, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Yükleniyor...</div>
                            )}
                        </div>

                        {/* Kod */}
                        <div style={{
                            backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.75rem',
                            marginBottom: '1rem', fontSize: '0.8rem',
                        }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Cihaz Kodu</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1rem', color: '#2563eb' }}>{publicCode}</div>
                            <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '0.5rem', wordBreak: 'break-all' }}>{qrUrl}</div>
                        </div>

                        {/* Butonlar */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={printQR} style={{
                                flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem',
                            }}>
                                🖨️ Yazdır
                            </button>
                            <button onClick={downloadQR} style={{
                                flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: 'white',
                                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem',
                            }}>
                                ⬇️ İndir
                            </button>
                            <button onClick={() => setOpen(false)} style={{
                                padding: '0.75rem 1rem', border: '1px solid #d1d5db', backgroundColor: 'white',
                                borderRadius: '0.5rem', cursor: 'pointer', color: '#374151',
                            }}>Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
    );
}
