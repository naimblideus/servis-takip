'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Msg {
  id: string;
  fromPhone: string;
  contactName: string | null;
  text: string | null;
  hasMedia: boolean;
  mediaType: string | null;
  receivedAt: string;
  handled: boolean;
  customer: { id: string; name: string; phone: string; deviceCount: number; openTickets: number } | null;
}

export default function WhatsAppInboxPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/whatsapp/inbox${showAll ? '?all=1' : ''}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const act = async (body: any) => {
    setBusy(body.messageId);
    try {
      const r = await fetch('/api/whatsapp/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) alert(d.error || 'İşlem yapılamadı');
      else { setNaming(null); setNewName(''); load(); }
    } finally { setBusy(null); }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) + ' ' +
        d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const card: React.CSSProperties = {
    background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '1rem 1.15rem', marginBottom: '0.75rem',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.35rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>💬 WhatsApp'tan Gelenler</h1>
        <button onClick={() => setShowAll(!showAll)}
          style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          {showAll ? 'Sadece bekleyenler' : 'Tümünü göster'}
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 0, marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Müşteri WhatsApp'tan yazdığında burada kim olduğunu, kaç cihazı olduğunu ve açık fişi olup olmadığını görürsünüz.
        WhatsApp uygulamanız normal çalışmaya devam eder — burası cevap yeri değil, <b>tanıma</b> yeridir.
      </p>

      {loading && <div style={{ color: '#9ca3af' }}>Yükleniyor…</div>}

      {!loading && items.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{showAll ? 'Hiç mesaj yok' : 'Bekleyen mesaj yok'}</div>
          <div style={{ fontSize: '0.85rem' }}>
            WhatsApp numaranız bağlıysa gelen mesajlar burada listelenir.
          </div>
        </div>
      )}

      {items.map(m => (
        <div key={m.id} style={{ ...card, opacity: m.handled ? 0.6 : 1, borderLeft: `4px solid ${m.customer ? '#16a34a' : '#f59e0b'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {m.customer ? m.customer.name : (m.contactName || 'Bilinmeyen numara')}
              {!m.customer && (
                <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '2px 8px' }}>
                  sistemde yok
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtTime(m.receivedAt)}</div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
            📞 0{m.fromPhone.slice(-10)}
            {m.customer && (
              <> · {m.customer.deviceCount} cihaz
                {m.customer.openTickets > 0 && (
                  <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {m.customer.openTickets} açık fiş</span>
                )}
              </>
            )}
          </div>

          {(m.text || m.hasMedia) && (
            <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {m.text || <i style={{ color: '#94a3b8' }}>(metin yok)</i>}
              {m.hasMedia && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                  📎 {m.mediaType === 'image' ? 'Fotoğraf' : 'Dosya'} gönderdi — WhatsApp uygulamanızdan açın
                </div>
              )}
            </div>
          )}

          {naming === m.id ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                placeholder="Müşteri / firma adı"
                style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.88rem' }} />
              <button onClick={() => act({ action: 'addCustomer', messageId: m.id, name: newName })}
                disabled={busy === m.id || !newName.trim()}
                style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: newName.trim() ? 1 : 0.5 }}>
                Kaydet
              </button>
              <button onClick={() => { setNaming(null); setNewName(''); }}
                style={{ padding: '0.5rem 0.8rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
                Vazgeç
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
              {m.customer ? (
                <Link href={`/customers/${m.customer.id}`}
                  style={{ padding: '0.45rem 0.9rem', background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                  Müşteriye git →
                </Link>
              ) : (
                <button onClick={() => { setNaming(m.id); setNewName(m.contactName || ''); }}
                  style={{ padding: '0.45rem 0.9rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Müşteri olarak ekle
                </button>
              )}
              <a href={`https://wa.me/${m.fromPhone}`} target="_blank" rel="noreferrer"
                style={{ padding: '0.45rem 0.9rem', background: 'white', color: '#15803d', border: '1px solid #86efac', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                WhatsApp'ta aç
              </a>
              <button onClick={() => act({ action: 'handled', messageId: m.id, handled: !m.handled })}
                disabled={busy === m.id}
                style={{ padding: '0.45rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.82rem', color: '#6b7280', cursor: 'pointer' }}>
                {m.handled ? 'Geri al' : '✓ İlgilenildi'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
