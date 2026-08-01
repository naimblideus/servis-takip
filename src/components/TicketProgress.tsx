'use client';

/**
 * Fiş tamamlanma göstergesi.
 *
 * Amaç: teknisyene "ne kaldı" sorusunu tek bakışta göstermek ve tamamlandığında
 * küçük bir tamamlanma hissi vermek. Zorlama yerine geri bildirim —
 * doğru doldurmayı ceza değil, akış teşvik eder.
 *
 * Abartılı kutlama YOK: tek bir onay + yumuşak dolum. Sahada günde 30 fiş açan
 * biri için gösterişli animasyon üçüncü seferde sinir bozucu olur.
 */
import { useEffect, useRef, useState } from 'react';

interface Step { label: string; done: boolean }

export default function TicketProgress({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const complete = doneCount === total && total > 0;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // Sadece "tamamlandı" ANINDA kutla; her render'da değil.
  const [celebrate, setCelebrate] = useState(false);
  const wasComplete = useRef(false);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setCelebrate(true);
      const t = window.setTimeout(() => setCelebrate(false), 900);
      wasComplete.current = true;
      return () => window.clearTimeout(t);
    }
    if (!complete) wasComplete.current = false;
  }, [complete]);

  const next = steps.find((s) => !s.done);

  return (
    <div
      className={celebrate ? 'sa-pop' : undefined}
      style={{
        backgroundColor: complete ? '#f0fdf4' : 'white',
        border: `1px solid ${complete ? '#86efac' : '#e5e7eb'}`,
        borderRadius: '0.75rem', padding: '0.85rem 1.1rem', marginBottom: '1rem',
        transition: 'background-color .25s ease, border-color .25s ease',
      }}
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: complete ? '#15803d' : '#374151' }}>
          {complete ? '✓ Fiş hazır — kaydedebilirsiniz' : `${doneCount}/${total} tamam`}
        </span>
        {!complete && next && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>sıradaki: {next.label}</span>
        )}
      </div>

      <div style={{ marginTop: '0.55rem', height: '6px', borderRadius: '9999px',
        backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
        <div
          className={celebrate ? 'sa-sheen' : undefined}
          style={{
            height: '100%', width: `${pct}%`, borderRadius: '9999px',
            backgroundColor: complete ? '#16a34a' : '#3b82f6',
            transition: 'width .35s cubic-bezier(.4,0,.2,1), background-color .25s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem', marginTop: '0.5rem' }}>
        {steps.map((s) => (
          <span key={s.label} style={{
            fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: s.done ? '#15803d' : '#9ca3af',
          }}>
            <span aria-hidden="true">{s.done ? '✓' : '○'}</span>{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
