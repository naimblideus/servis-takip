'use client';

export default function PrintNowButton() {
  return (
    <button
      className="no-print"
      onClick={() => window.print()}
      style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 50,
        padding: '0.5rem 1.1rem', backgroundColor: '#1e40af', color: 'white',
        border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      }}
    >
      🖨️ Yazdır
    </button>
  );
}
