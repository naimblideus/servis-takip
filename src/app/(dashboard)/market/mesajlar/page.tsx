'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Thread { listingId: string; buyerTenantId: string; role: 'seller' | 'buyer'; counterpartyName: string; listingTitle: string; listingStatus: string; lastBody: string; lastAt: string; mineLast: boolean; }
interface Msg { id: string; body: string; senderName: string | null; mine: boolean; createdAt: string; }

export default function MesajlarPage() {
  const t = useT();
  const b = useBicim();
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
      else { const d = await r.json().catch(() => ({})); alert(d.error || t.pazar.gonderilemedi); }
    } catch { alert(t.excelAktar.sunucuYok); }
    setSending(false);
  };

  return (
    <div style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 1020, margin: '0 auto' }}>
      <Link href="/market" className="mk-back">{t.pazar.geriPazar}</Link>
      <div className="mk-eyebrow" style={{ marginTop: 10 }}>{t.pazar.iletisimUst}</div>
      <h1 className="mk-h1" style={{ marginBottom: '1.35rem' }}>{t.pazar.mesajBaslik}</h1>

      {/* Telefonda tek sütun: sabit 250 px'lik konuşma listesi + sağdaki
          panel 375 px'e sığmıyordu. Sohbet ekranı iki panelli düzende
          telefonda çalışmaz — alt alta konur, önce liste sonra konuşma. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(15.5rem,1fr))', gap: '1rem', alignItems: 'start' }}>
        {/* Konuşma listesi */}
        <div className="mk-panel" style={{ overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '.75rem', display: 'grid', gap: '.5rem' }}>
              {[0, 1, 2].map((i) => <div key={i} className="mk-sk" style={{ height: 58, borderRadius: 12 }} />)}
            </div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.7rem', marginBottom: '.4rem' }}>💬</div>
              <p style={{ color: 'var(--ink2)', fontSize: '.86rem', margin: 0, lineHeight: 1.55 }}>{t.pazar.mesajYokOn}<br />{t.pazar.mesajYokSon}</p>
            </div>
          ) : threads.map((th) => {
            const key = `${th.listingId}|${th.buyerTenantId}`;
            const active = !!sel && `${sel.listingId}|${sel.buyerTenantId}` === key;
            return (
              <div key={key} onClick={() => openThread(th)} className="mk-thread" data-on={active ? '1' : '0'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '.86rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.counterpartyName}</span>
                  <span className="mk-pill" style={{ background: th.role === 'seller' ? '#E7F6EF' : '#EAEDFB', color: th.role === 'seller' ? '#0B6B4A' : '#2E3A8C', fontSize: '.62rem' }}>
                    {th.role === 'seller' ? t.pazar.rolSatici : t.pazar.rolAlici}
                  </span>
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--ink2)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.listingTitle}</div>
                <div style={{ fontSize: '.74rem', color: 'var(--mut)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.mineLast ? t.pazar.senIkiNokta : ''}{th.lastBody}</div>
              </div>
            );
          })}
        </div>

        {/* Konuşma */}
        <div className="mk-panel" style={{ padding: '1.1rem 1.2rem', minHeight: '52vh', display: 'flex', flexDirection: 'column' }}>
          {!sel ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--mut)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '.4rem', opacity: .5 }}>💬</div>
              <div style={{ fontSize: '.9rem' }}>{t.pazar.konusmaSec}</div>
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 12 }}>
                <Link href={`/market/${sel.listingId}`} style={{ fontWeight: 700, fontSize: '.97rem', color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-.012em' }}>{sel.listingTitle}</Link>
                <div style={{ fontSize: '.77rem', color: 'var(--ink2)', marginTop: 2 }}>{doldur(t.pazar.konusmaIle, { ad: sel.counterpartyName })} {sel.role === 'seller' ? t.pazar.senSaticisin : t.pazar.senAlicisin}</div>
              </div>
              <div style={{ flex: 1, display: 'grid', gap: 7, overflowY: 'auto', maxHeight: '52vh', alignContent: 'start' }}>
                {msgs.map((m) => (
                  <div key={m.id} className={`mk-bub${m.mine ? ' mk-bub-me' : ''}`} style={{ justifySelf: m.mine ? 'end' : 'start' }}>
                    <div style={{ fontSize: '.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--mut)', marginTop: 4 }}>{m.mine ? t.pazar.sen : (m.senderName || sel.counterpartyName)} · {b.tarihSaat(m.createdAt)}</div>
                  </div>
                ))}
                {msgs.length === 0 && <div style={{ color: 'var(--mut)', fontSize: '.85rem' }}>{t.pazar.mesajYok}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reply(); }} placeholder={t.pazar.yanitYaz} className="mk-in" style={{ flex: 1 }} />
                <button onClick={reply} disabled={sending || !text.trim()} className="mk-btn mk-btn-g" style={{ padding: '.6rem .7rem .6rem 1.1rem' }}>
                  <span>{sending ? t.pazar.gonderiliyor : t.pazar.gonder}</span><span className="mk-ico">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
