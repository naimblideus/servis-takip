'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Thread { listingId: string; buyerTenantId: string; role: 'seller' | 'buyer'; counterpartyName: string; listingTitle: string; listingStatus: string; lastBody: string; lastAt: string; mineLast: boolean; }
interface Msg { id: string; body: string; senderName: string | null; mine: boolean; createdAt: string; }

export default function MesajlarPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/market/threads'); if (r.ok) { const d = await r.json(); setThreads(d.threads || []); } } catch { /* yoksay */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = async (t: Thread) => {
    setSel(t); setMsgs([]);
    try {
      const r = await fetch(`/api/market/messages?listingId=${t.listingId}&buyer=${encodeURIComponent(t.buyerTenantId)}`);
      if (r.ok) { const d = await r.json(); setMsgs(d.messages || []); }
    } catch { /* yoksay */ }
  };

  const reply = async () => {
    if (!sel || !text.trim()) return;
    setSending(true);
    try {
      const body: any = { listingId: sel.listingId, body: text.trim() };
      if (sel.role === 'seller') body.toTenantId = sel.buyerTenantId;
      const r = await fetch('/api/market/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { setText(''); openThread(sel); loadThreads(); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || 'Gönderilemedi'); }
    } catch { alert('Sunucuya bağlanılamadı'); }
    setSending(false);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 980, margin: '0 auto' }}>
      <Link href="/market" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>← Pazar</Link>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.25rem 0 1rem' }}>💬 Pazar Mesajları</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Thread listesi */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? <p style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>Yükleniyor…</p> : threads.length === 0 ? (
            <p style={{ padding: '1.25rem', color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center' }}>Henüz mesaj yok.</p>
          ) : threads.map((t) => {
            const key = `${t.listingId}|${t.buyerTenantId}`;
            const active = sel && `${sel.listingId}|${sel.buyerTenantId}` === key;
            return (
              <div key={key} onClick={() => openThread(t)} style={{ padding: '0.7rem 0.85rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: active ? '#eff6ff' : 'white', borderLeft: active ? '3px solid #2563eb' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.counterpartyName}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: t.role === 'seller' ? '#15803d' : '#1d4ed8' }}>{t.role === 'seller' ? 'SATICI' : 'ALICI'}</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.listingTitle}</div>
                <div style={{ fontSize: '0.74rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.mineLast ? 'Sen: ' : ''}{t.lastBody}</div>
              </div>
            );
          })}
        </div>

        {/* Konuşma */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', minHeight: '50vh', display: 'flex', flexDirection: 'column' }}>
          {!sel ? (
            <div style={{ margin: 'auto', color: '#9ca3af', fontSize: '0.9rem' }}>Soldan bir konuşma seç</div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 8, marginBottom: 10 }}>
                <Link href={`/market/${sel.listingId}`} style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', textDecoration: 'none' }}>{sel.listingTitle}</Link>
                <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{sel.counterpartyName} ile ({sel.role === 'seller' ? 'sen satıcısın' : 'sen alıcısın'})</div>
              </div>
              <div style={{ flex: 1, display: 'grid', gap: 6, overflowY: 'auto', maxHeight: '52vh', alignContent: 'start' }}>
                {msgs.map((m) => (
                  <div key={m.id} style={{ justifySelf: m.mine ? 'end' : 'start', maxWidth: '80%', background: m.mine ? '#dcfce7' : '#f3f4f6', borderRadius: 10, padding: '0.45rem 0.7rem' }}>
                    <div style={{ fontSize: '0.88rem', color: '#111827', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    <div style={{ fontSize: '0.64rem', color: '#9ca3af', marginTop: 2 }}>{m.mine ? 'Sen' : (m.senderName || sel.counterpartyName)} · {new Date(m.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                ))}
                {msgs.length === 0 && <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Mesaj yok.</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reply(); }} placeholder="Yanıt yaz…" style={{ flex: 1, padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
                <button onClick={reply} disabled={sending || !text.trim()} style={{ padding: '0.6rem 1.1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: (sending || !text.trim()) ? 0.6 : 1 }}>Gönder</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
