'use client';

import { signOut } from 'next-auth/react';

// Tam ekran erişim kilidi — abonelik askıda/bitti veya bakım modunda gösterilir.
export default function AccessLock({ title, message, contactEmail, showLogout = true }: { title: string; message: string; contactEmail?: string | null; showLogout?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, width: '100%', background: 'white', borderRadius: 16, padding: '2.25rem 2rem', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0', color: '#0f172a' }}>{title}</h1>
        <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1rem' }}>{message}</p>
        {contactEmail && <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>İletişim: <b>{contactEmail}</b></p>}
        {showLogout && (
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ marginTop: '1.4rem', padding: '0.6rem 1.4rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Çıkış Yap
          </button>
        )}
      </div>
    </div>
  );
}
