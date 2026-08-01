'use client';

/**
 * Fiş kaydedildiğinde çıkan kısa tamamlanma anı.
 *
 * Neden burada: form dolunca kutlamak, "doldurdum" hissini ödüllendirir —
 * asıl iş fişin KAYDEDİLMESİDİR. Ödül gerçek tamamlanma anına bağlı olmalı.
 *
 * Bilinçli olarak yok: puan, rozet, "bu hafta N fiş" sayacı, sıralama.
 * Bunlar adet üretmeyi ödüllendirir ve veri kalitesini bozar.
 */
export default function SaveSuccess({ ticketNumber }: { ticketNumber?: string }) {
  return (
    <div
      className="sa-overlay"
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="sa-burst"
        style={{
          backgroundColor: 'white', borderRadius: '1rem', padding: '1.75rem 2.25rem',
          boxShadow: '0 20px 45px rgba(0,0,0,0.22)', textAlign: 'center', maxWidth: '20rem',
        }}
      >
        <div style={{ position: 'relative', width: '3.5rem', height: '3.5rem', margin: '0 auto 0.85rem' }}>
          {/* genişleyen halka — tek seferlik, sessiz */}
          <span className="sa-ring" aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: '9999px',
            border: '2px solid #16a34a',
          }} />
          <div style={{
            width: '100%', height: '100%', borderRadius: '9999px',
            backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.75rem', color: '#16a34a', fontWeight: 700,
          }}>✓</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#14532d' }}>Fiş kaydedildi</div>
        {ticketNumber && (
          <div style={{ marginTop: '0.2rem', fontSize: '0.85rem', color: '#6b7280' }}>{ticketNumber}</div>
        )}
      </div>
    </div>
  );
}
