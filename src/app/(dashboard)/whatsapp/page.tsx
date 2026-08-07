'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FAULT_CATEGORIES } from '@/lib/fault-categories';

interface Msg {
  id: string;
  fromPhone: string;
  contactName: string | null;
  text: string | null;
  hasMedia: boolean;
  mediaType: string | null;
  receivedAt: string;
  handled: boolean;
  isFaultReport: boolean;
  autoReplied: boolean;
  readingId: string | null;
  ticketId: string | null;
  // Sistemin önerisi — fiş AÇILMAZ, yalnızca önerilir. Bayi onaylar veya düzeltir.
  suggestion: {
    deviceId: string | null;
    device: { id: string; brand: string; model: string; serialNo: string; location: string | null } | null;
    category: string | null;
    categoryLabel: string | null;
    confidence: number;
    source: string | null;
  } | null;
  customer: { id: string; name: string; phone: string; deviceCount: number; openTickets: number } | null;
}

interface Dev {
  id: string; brand: string; model: string; location: string | null;
  hasColor: boolean; counterBlack: number | null; counterColor: number | null;
}

/** Öneri düzeltme panelindeki cihaz listesi — /api/customers/[id]/devices çıktısı */
interface FixDev {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
}

export default function WhatsAppInboxPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Sayaç işleme paneli
  const [reading, setReading] = useState<string | null>(null); // açık olan mesaj id'si
  const [devices, setDevices] = useState<Dev[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [selDev, setSelDev] = useState('');
  const [cb, setCb] = useState('');
  const [cc, setCc] = useState('');
  const [reset, setReset] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);

  // Öneri düzeltme paneli — bayi sistemin önerisini değiştirdiğinde kullanılır
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixDevs, setFixDevs] = useState<FixDev[]>([]);
  const [fixDev, setFixDev] = useState('');
  const [fixCat, setFixCat] = useState('');
  const [fixLoading, setFixLoading] = useState(false);

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
      if (!r.ok) { alert(d.error || 'İşlem yapılamadı'); return null; }
      setNaming(null); setNewName(''); load();
      return d;
    } finally { setBusy(null); }
  };

  /** Sayaç panelini aç: müşterinin kiralık cihazlarını getir (Sayaç Turu ile aynı uç). */
  const openReading = async (m: Msg) => {
    setReading(m.id); setSelDev(''); setCb(''); setCc(''); setReset(false); setReadErr(null);
    if (!m.customer) return;
    setDevLoading(true);
    try {
      const r = await fetch(`/api/readings/bulk?customerId=${m.customer.id}`);
      const d = await r.json();
      const list: Dev[] = d.devices || d.items || [];
      setDevices(list);
      if (list.length === 1) setSelDev(list[0].id); // tek cihaz varsa seçtirme
    } catch { setDevices([]); } finally { setDevLoading(false); }
  };

  /**
   * Düzeltme panelini aç. Öneri ne diyorsa onunla BAŞLAR — bayi yalnızca yanlış olanı
   * değiştirir. Boş formdan başlatmak, doğru öneriyi de yeniden yazdırmak demektir.
   */
  const openFix = async (m: Msg) => {
    setFixing(m.id);
    setFixDev(m.suggestion?.deviceId ?? '');
    setFixCat(m.suggestion?.category ?? '');
    if (!m.customer) return;
    setFixLoading(true);
    try {
      const r = await fetch(`/api/customers/${m.customer.id}/devices`);
      const d = await r.json();
      setFixDevs(Array.isArray(d) ? d : []);
    } catch { setFixDevs([]); } finally { setFixLoading(false); }
  };

  const saveReading = async (m: Msg) => {
    setReadErr(null);
    const dev = devices.find(d => d.id === selDev);
    if (!dev) { setReadErr('Cihaz seçin'); return; }
    if (cb === '') { setReadErr('Siyah sayacı yazın'); return; }
    const d = await act({
      action: 'saveReading', messageId: m.id, deviceId: selDev,
      counterBlack: cb, counterColor: dev.hasColor ? (cc || 0) : 0, reset,
    });
    if (d?.ok) { setReading(null); if (d.warning) alert('⚠️ ' + d.warning); }
    else setReadErr('Kaydedilemedi — sayaç önceki değerden küçükse "sayaç sıfırlandı" işaretleyin');
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
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.95rem', boxSizing: 'border-box',
  };
  const chip = (bg: string, fg: string, bd: string): React.CSSProperties => ({
    fontSize: '0.7rem', fontWeight: 700, color: fg, background: bg,
    border: `1px solid ${bd}`, borderRadius: 999, padding: '2px 8px',
  });

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
        Müşteri yazdığında kim olduğunu, kaç cihazı olduğunu ve açık fişi olup olmadığını burada görürsünüz.
        Sayaç fotoğrafı geldiyse tek ekrandan cihaza işleyebilirsiniz.
        WhatsApp uygulamanız normal çalışmaya devam eder.
      </p>

      {loading && <div style={{ color: '#9ca3af' }}>Yükleniyor…</div>}

      {!loading && items.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '2.5rem 1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{showAll ? 'Hiç mesaj yok' : 'Bekleyen mesaj yok'}</div>
          <div style={{ fontSize: '0.85rem' }}>WhatsApp numaranız bağlıysa gelen mesajlar burada listelenir.</div>
        </div>
      )}

      {items.map(m => (
        <div key={m.id} style={{ ...card, opacity: m.handled ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {m.customer ? m.customer.name : (m.contactName || 'Bilinmeyen numara')}
              {!m.customer && <span style={chip('#fffbeb', '#b45309', '#fde68a')}>sistemde yok</span>}
              {m.isFaultReport && <span style={chip('#fef2f2', '#b91c1c', '#fecaca')}>arıza bildirimi</span>}
              {m.readingId && <span style={chip('#ecfdf5', '#047857', '#a7f3d0')}>sayaç işlendi</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{fmtTime(m.receivedAt)}</div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
            📞 0{m.fromPhone.slice(-10)}
            {m.customer && (
              <> · {m.customer.deviceCount} cihaz
                {m.customer.openTickets > 0 && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {m.customer.openTickets} açık fiş</span>}
              </>
            )}
            {m.autoReplied && <span style={{ color: '#059669' }}> · otomatik cevap gönderildi</span>}
          </div>

          {(m.text || m.hasMedia) && (
            <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {m.text || <i style={{ color: '#94a3b8' }}>(metin yok)</i>}
            </div>
          )}

          {/* Fotoğraf — sunucuda saklanmaz, bakıldığı anda Meta'dan çekilir */}
          {m.hasMedia && m.mediaType === 'image' && (
            <img src={`/api/whatsapp/media/${m.id}`} alt="Müşterinin gönderdiği fotoğraf"
              style={{ marginTop: '0.6rem', maxWidth: '100%', maxHeight: 380, borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'block' }} />
          )}
          {m.hasMedia && m.mediaType !== 'image' && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#64748b' }}>
              📎 Dosya gönderdi — WhatsApp uygulamanızdan açın
            </div>
          )}

          {/* ── ÖNERİ KARTI ──
              Sistem fişi AÇMAZ; "şu cihaz, şu arıza" diye önerir. Bayi tek dokunuşla
              onaylar ya da düzeltir. O dokunuş aynı zamanda ETİKET üretir:
              önerilen değer mesajda, seçilen değer fişte kalır. */}
          {m.suggestion && !m.ticketId && m.customer && (
            <div style={{ marginTop: '0.7rem', padding: '0.75rem 0.9rem', background: '#f0fdf4',
              border: '1px solid #86efac', borderRadius: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#15803d' }}>Fiş önerisi</span>
                <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                  %{Math.round(m.suggestion.confidence * 100)} güven
                  {m.suggestion.source === 'rule' ? ' · kural' : ''}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#14532d', marginBottom: '0.6rem' }}>
                {m.suggestion.device
                  ? <><b>{m.suggestion.device.brand} {m.suggestion.device.model}</b>
                      {m.suggestion.device.location ? ` — ${m.suggestion.device.location}` : ''}</>
                  : <i style={{ color: '#65a30d' }}>Cihaz belirlenemedi, siz seçin</i>}
                {' · '}
                {m.suggestion.categoryLabel
                  ? <b>{m.suggestion.categoryLabel}</b>
                  : <i style={{ color: '#65a30d' }}>Kategori belirlenemedi</i>}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => act({
                    action: 'createTicket', messageId: m.id,
                    deviceId: m.suggestion!.deviceId, faultCategory: m.suggestion!.category,
                  })}
                  disabled={busy === m.id || !m.suggestion.deviceId || !m.suggestion.category}
                  title={!m.suggestion.deviceId || !m.suggestion.category
                    ? 'Eksik alan var — "Düzelt" ile tamamlayın' : 'Bu öneriyle fiş aç'}
                  style={{ padding: '0.45rem 0.9rem', background: '#16a34a', color: 'white', border: 'none',
                    borderRadius: '0.45rem', fontWeight: 700, fontSize: '0.82rem',
                    cursor: 'pointer', opacity: (m.suggestion.deviceId && m.suggestion.category) ? 1 : 0.45 }}>
                  ✓ Fiş aç
                </button>
                <button onClick={() => openFix(m)}
                  style={{ padding: '0.45rem 0.9rem', background: 'white', color: '#15803d',
                    border: '1px solid #86efac', borderRadius: '0.45rem', fontWeight: 600,
                    fontSize: '0.82rem', cursor: 'pointer' }}>
                  Düzelt
                </button>
              </div>

              {/* Düzeltme SAYFA İÇİNDE yapılır. Bayiyi başka bir forma gönderirsek mesaj
                  fişe bağlanmaz; öneri ile seçim arasındaki fark — yani ETİKET — kaybolur. */}
              {fixing === m.id && (
                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem',
                  paddingTop: '0.6rem', borderTop: '1px dashed #86efac' }}>
                  <select value={fixDev} onChange={e => setFixDev(e.target.value)} style={inp}>
                    <option value="">{fixLoading ? 'Cihazlar yükleniyor…' : 'Cihaz seçin'}</option>
                    {fixDevs.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.brand} {d.model}{d.location ? ` — ${d.location}` : ''} · {d.serialNo}
                      </option>
                    ))}
                  </select>
                  <select value={fixCat} onChange={e => setFixCat(e.target.value)} style={inp}>
                    <option value="">Arıza kategorisi seçin</option>
                    {FAULT_CATEGORIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        const d = await act({
                          action: 'createTicket', messageId: m.id,
                          deviceId: fixDev, faultCategory: fixCat,
                        });
                        if (d?.ok) setFixing(null);
                      }}
                      disabled={busy === m.id || !fixDev || !fixCat}
                      style={{ padding: '0.45rem 0.9rem', background: '#16a34a', color: 'white', border: 'none',
                        borderRadius: '0.45rem', fontWeight: 700, fontSize: '0.82rem',
                        cursor: 'pointer', opacity: (fixDev && fixCat) ? 1 : 0.45 }}>
                      ✓ Düzeltilmiş haliyle fiş aç
                    </button>
                    <button onClick={() => setFixing(null)}
                      style={{ padding: '0.45rem 0.9rem', background: 'white', color: '#475569',
                        border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontWeight: 600,
                        fontSize: '0.82rem', cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {m.ticketId && (
            <div style={{ marginTop: '0.7rem', fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
              ✓ Bu mesajdan fiş açıldı — <Link href={`/tickets/${m.ticketId}`} style={{ color: '#15803d' }}>fişi aç</Link>
            </div>
          )}

          {/* Sayaç işleme paneli */}
          {reading === m.id && (
            <div style={{ marginTop: '0.75rem', padding: '0.9rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.6rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#075985', marginBottom: '0.6rem' }}>
                Sayacı cihaza işle
              </div>
              {devLoading && <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>Cihazlar yükleniyor…</div>}
              {!devLoading && devices.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: '#b45309' }}>Bu müşteride kiralık cihaz yok.</div>
              )}
              {!devLoading && devices.length > 0 && (
                <>
                  <select value={selDev} onChange={e => setSelDev(e.target.value)} style={{ ...inp, marginBottom: '0.6rem' }}>
                    <option value="">Cihaz seçin…</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.brand} {d.model}{d.location ? ` — ${d.location}` : ''}
                        {d.counterBlack != null ? ` (son: ${d.counterBlack.toLocaleString('tr-TR')})` : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>⚫ Siyah sayaç</label>
                      <input value={cb} onChange={e => setCb(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric" placeholder="örn. 108491" style={inp} />
                    </div>
                    {devices.find(d => d.id === selDev)?.hasColor && (
                      <div style={{ flex: 1, minWidth: 130 }}>
                        <label style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>🟣 Renkli sayaç</label>
                        <input value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))}
                          inputMode="numeric" placeholder="örn. 24310" style={inp} />
                      </div>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#0369a1', marginTop: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={reset} onChange={e => setReset(e.target.checked)} />
                    Sayaç sıfırlandı (yeni değer eskisinden küçükse)
                  </label>
                  {readErr && <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.5rem' }}>{readErr}</div>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
                    <button onClick={() => saveReading(m)} disabled={busy === m.id}
                      style={{ padding: '0.55rem 1.1rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                      {busy === m.id ? 'Kaydediliyor…' : 'Sayacı kaydet'}
                    </button>
                    <button onClick={() => setReading(null)}
                      style={{ padding: '0.55rem 0.9rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {naming === m.id ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                placeholder="Müşteri / firma adı" style={{ ...inp, flex: 1, minWidth: 180 }} />
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
                <>
                  {m.hasMedia && m.mediaType === 'image' && !m.readingId && (
                    <button onClick={() => openReading(m)}
                      style={{ padding: '0.45rem 0.9rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                      📷 Sayaç olarak işle
                    </button>
                  )}
                  {m.isFaultReport && (
                    <Link href={`/tickets/new?customerId=${m.customer.id}`}
                      style={{ padding: '0.45rem 0.9rem', background: '#dc2626', color: 'white', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                      + Fiş aç
                    </Link>
                  )}
                  <Link href={`/customers/${m.customer.id}`}
                    style={{ padding: '0.45rem 0.9rem', background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                    Müşteriye git →
                  </Link>
                </>
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
