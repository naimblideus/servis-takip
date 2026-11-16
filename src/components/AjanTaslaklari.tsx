'use client';

/*
 * TELEFON AJANININ TASLAKLARI — gelen kutusunun en ustu.
 *
 * Ajan fis ACMAZ; yalniz taslak birakir. Fisi bayi buradan, "Fise cevir"
 * ile acar (cihazi secer, teknisyen onerisini kabul eder ya da degistirir).
 * Teknisyen onerisi panel acilinca hesaplanir: liste hafif kalir.
 *
 * Butun metinler lib/telefon-ajani-metin.ts'ten (TR/EN).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FAULT_CATEGORIES } from '@/lib/fault-categories';
import { useT, useBicim, useDil } from '@/lib/i18n/client';
import { ajanMetni, doldurMetin, gerekceMetni, numaraGoster } from '@/lib/telefon-ajani-metin';
import type { OneriVerisi, TaslakSayaci } from '@/lib/telefon-ajani';

interface Satir {
  id: string;
  kanal: string;
  durum: string;
  kapanisYolu: string | null;
  createdAt: string;
  arayanSon10: string;
  musteri: { id: string; name: string } | null;
  cihaz: { id: string; brand: string; model: string; serialNo: string } | null;
  cihazNeden: string | null;
  soylenenSeriNo: string | null;
  soylenenModel: string | null;
  arizaMetni: string;
  faultCategory: string | null;
  arayanAdi: string | null;
  firmaAdi: string | null;
  acil: boolean;
  fis: { id: string; ticketNumber: string } | null;
  redSebebi: string | null;
}

interface Ayrinti {
  taslak: { id: string; durum: string; deviceId: string | null; arizaMetni: string; faultCategory: string | null; acil: boolean; birdenCokMusteri: boolean };
  musteriler: { id: string; name: string }[];
  adaylar: { id: string; brand: string; model: string; serialNo: string; location: string | null; customerId: string }[];
  teknisyenler: { id: string; name: string }[];
  oneri: { teknisyenId: string; veri: OneriVerisi } | null;
}

interface Form {
  deviceId: string;
  assignedUserId: string;
  issueText: string;
  faultCategory: string;
  priority: string;
}

const ONCELIK = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export default function AjanTaslaklari({ gizliBosken = false, gecmisVar = false }: { gizliBosken?: boolean; gecmisVar?: boolean }) {
  const t = useT();
  const b = useBicim();
  const { dil } = useDil();
  const m = ajanMetni(dil);

  const [secim, setSecim] = useState<'BEKLIYOR' | 'HEPSI'>('BEKLIYOR');
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [sayac, setSayac] = useState<{ buAy: TaslakSayaci; toplam: TaslakSayaci } | null>(null);
  const [panel, setPanel] = useState<{ id: string; tur: 'onay' | 'red' } | null>(null);
  const [ayrinti, setAyrinti] = useState<Ayrinti | null>(null);
  const [form, setForm] = useState<Form>({ deviceId: '', assignedUserId: '', issueText: '', faultCategory: '', priority: 'NORMAL' });
  const [sebep, setSebep] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ metin: string; fisId?: string } | null>(null);

  const yukle = useCallback(async () => {
    try {
      const r = await fetch(`/api/telefon-ajani/taslaklar?durum=${secim}`);
      if (!r.ok) return;
      const d = await r.json();
      setListe(d.taslaklar ?? []);
      setSayac(d.sayac ?? null);
    } catch {
      /* ag hatasi: eski liste kalsin */
    }
  }, [secim]);

  useEffect(() => {
    yukle();
    const id = window.setInterval(yukle, 60_000);
    return () => window.clearInterval(id);
  }, [yukle]);

  const panelAc = async (s: Satir) => {
    setHata(null);
    setSonuc(null);
    setPanel({ id: s.id, tur: 'onay' });
    setAyrinti(null);
    try {
      const r = await fetch(`/api/telefon-ajani/taslaklar/${s.id}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHata(d.error || m.hata);
        return;
      }
      const a = d as Ayrinti;
      setAyrinti(a);
      setForm({
        deviceId: a.taslak.deviceId ?? (a.adaylar.length === 1 ? a.adaylar[0].id : ''),
        assignedUserId: a.oneri?.teknisyenId ?? '',
        issueText: a.taslak.arizaMetni,
        faultCategory: a.taslak.faultCategory ?? '',
        priority: a.taslak.acil ? 'HIGH' : 'NORMAL',
      });
    } catch {
      setHata(m.hata);
    }
  };

  const gonder = async (id: string, govde: Record<string, unknown>) => {
    setMesgul(true);
    setHata(null);
    try {
      const r = await fetch(`/api/telefon-ajani/taslaklar/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHata(d.error || m.hata);
        return;
      }
      setPanel(null);
      setAyrinti(null);
      setSebep('');
      setSonuc(
        govde.islem === 'onayla'
          ? { metin: doldurMetin(m.acildi, { no: d.ticketNumber }), fisId: d.ticketId }
          : { metin: m.reddedildi },
      );
      yukle();
    } finally {
      setMesgul(false);
    }
  };

  const bekleyen = sayac?.toplam.bekleyen ?? 0;
  if (gizliBosken && secim === 'BEKLIYOR' && liste !== null && liste.length === 0 && !sonuc) return null;
  if (gizliBosken && liste === null) return null;

  const kart: React.CSSProperties = {
    background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '1rem 1.15rem', marginBottom: '1rem', border: '1px solid #c7d2fe',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.92rem', boxSizing: 'border-box', background: 'white',
  };
  const etiket: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', marginBottom: 4, display: 'block' };
  const cip = (bg: string, fg: string): React.CSSProperties => ({
    fontSize: '0.7rem', fontWeight: 700, color: fg, background: bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
  });
  const dugme = (ana: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.84rem', fontWeight: 700, cursor: mesgul ? 'wait' : 'pointer',
    background: ana ? '#0f2253' : 'white', color: ana ? 'white' : '#374151', border: `1px solid ${ana ? '#0f2253' : '#d1d5db'}`,
  });
  const kategoriAdi = (k: string | null) =>
    k ? ((t.ariza as Record<string, string>)[k] ?? FAULT_CATEGORIES.find((c) => c.code === k)?.label ?? k) : m.kategoriYok;
  const ust = sayac?.buAy;

  return (
    <section style={kart} aria-label={m.kart.baslik}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f2253' }}>
          {m.kart.baslik}
          {bekleyen > 0 && <span style={{ ...cip('#fee2e2', '#991b1b'), marginLeft: 8 }}>{bekleyen}</span>}
        </h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {gecmisVar ? (
            (['BEKLIYOR', 'HEPSI'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSecim(s)} aria-pressed={secim === s} style={dugme(secim === s)}>
                {s === 'BEKLIYOR' ? m.kart.bekleyenler : m.kart.gecmis}
              </button>
            ))
          ) : (
            <Link href="/telefon-ajani" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4338ca' }}>{m.kart.sayfaya}</Link>
          )}
        </div>
      </div>
      {ust && (
        <p style={{ margin: '0 0 0.75rem', color: '#4b5563', fontSize: '0.85rem' }}>
          {doldurMetin(m.kart.buAy, { acilan: ust.acilan, onaylanan: ust.onaylanan })}
        </p>
      )}

      {sonuc && (
        <div role="status" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
          {sonuc.metin}{' '}
          {sonuc.fisId && <Link href={`/tickets/${sonuc.fisId}`} style={{ fontWeight: 700, color: '#065f46' }}>{m.fiseGit}</Link>}
        </div>
      )}

      {liste === null && <div style={{ color: '#9ca3af', fontSize: '0.88rem' }}>{m.yukleniyor}</div>}
      {liste !== null && liste.length === 0 && <div style={{ color: '#6b7280', fontSize: '0.88rem' }}>{m.kart.bos}</div>}

      {liste?.map((s) => {
        const acik = panel?.id === s.id;
        const soylenen = [s.soylenenModel, s.soylenenSeriNo].filter(Boolean).join(' · ');
        return (
          <article key={s.id} style={{ borderTop: '1px solid #eef2ff', padding: '0.7rem 0' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <span style={cip(s.kanal === 'TELEFON' ? '#e0e7ff' : '#dcfce7', s.kanal === 'TELEFON' ? '#3730a3' : '#166534')}>
                {m.kanal[s.kanal] ?? s.kanal}
              </span>
              {s.acil && <span style={cip('#fee2e2', '#991b1b')}>{m.acil}</span>}
              {s.durum !== 'BEKLIYOR' && (
                <span style={cip('#f3f4f6', '#374151')}>
                  {m.durum[s.durum] ?? s.durum}
                  {s.kapanisYolu === 'MESAJ' ? ` · ${m.mesajdan}` : ''}
                </span>
              )}
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{b.tarihSaat(s.createdAt)}</span>
            </div>
            <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
              {s.musteri ? s.musteri.name : s.firmaAdi ? doldurMetin(m.firma, { ad: s.firmaAdi }) : m.taninmayan}
              <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.84rem' }}>
                {' · '}{s.arayanSon10 ? numaraGoster(s.arayanSon10) : m.numaraGizli}
                {s.arayanAdi ? ` · ${doldurMetin(m.arayan, { ad: s.arayanAdi })}` : ''}
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', color: '#374151', marginTop: 2 }}>
              {s.cihaz ? (
                <span>
                  {s.cihaz.brand} {s.cihaz.model} · {s.cihaz.serialNo}
                  {s.cihazNeden ? <span style={{ color: '#6b7280' }}>{` (${m.cihazNeden[s.cihazNeden] ?? s.cihazNeden})`}</span> : null}
                </span>
              ) : soylenen ? (
                doldurMetin(m.soylenen, { metin: soylenen })
              ) : (
                <span style={{ color: '#b45309' }}>{m.cihazBelirsiz}</span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#111827', marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.arizaMetni}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{kategoriAdi(s.faultCategory)}</div>
            {s.fis && (
              <Link href={`/tickets/${s.fis.id}`} style={{ fontSize: '0.84rem', fontWeight: 700, color: '#4338ca' }}>
                {s.fis.ticketNumber}
              </Link>
            )}
            {s.redSebebi && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.redSebebi}</div>}

            {s.durum === 'BEKLIYOR' && !acik && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => panelAc(s)} style={dugme(true)}>{m.fiseCevir}</button>
                <button type="button" onClick={() => { setHata(null); setSonuc(null); setPanel({ id: s.id, tur: 'red' }); }} style={dugme(false)}>{m.reddet}</button>
              </div>
            )}

            {acik && panel?.tur === 'red' && (
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                <label style={etiket} htmlFor={`red-${s.id}`}>{m.redSebebi}</label>
                <input id={`red-${s.id}`} value={sebep} onChange={(e) => setSebep(e.target.value)} maxLength={300} style={inp} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={mesgul} onClick={() => gonder(s.id, { islem: 'reddet', sebep })} style={dugme(true)}>{m.reddet}</button>
                  <button type="button" onClick={() => setPanel(null)} style={dugme(false)}>{m.vazgec}</button>
                </div>
              </div>
            )}

            {acik && panel?.tur === 'onay' && (
              <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 8, padding: '0.75rem', display: 'grid', gap: 10 }}>
                {!ayrinti && !hata && <div style={{ color: '#9ca3af', fontSize: '0.86rem' }}>{m.yukleniyor}</div>}
                {ayrinti && (
                  <>
                    {ayrinti.taslak.birdenCokMusteri && (
                      <div style={{ fontSize: '0.82rem', color: '#b45309' }}>{m.birdenCokMusteri}</div>
                    )}
                    <div>
                      <label style={etiket} htmlFor={`cihaz-${s.id}`}>{m.cihaz}</label>
                      {ayrinti.adaylar.length ? (
                        <select id={`cihaz-${s.id}`} value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} style={inp}>
                          <option value="">{m.cihazSecin}</option>
                          {ayrinti.adaylar.map((c) => (
                            <option key={c.id} value={c.id}>
                              {`${c.brand} ${c.model} · ${c.serialNo}${c.location ? ` · ${c.location}` : ''}`}
                              {ayrinti.musteriler.length > 1 ? ` · ${ayrinti.musteriler.find((x) => x.id === c.customerId)?.name ?? ''}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: '0.84rem', color: '#b45309' }}>{m.adayYok}</div>
                      )}
                    </div>
                    <div>
                      <label style={etiket} htmlFor={`tek-${s.id}`}>{m.teknisyen}</label>
                      <select id={`tek-${s.id}`} value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} style={inp}>
                        <option value="">{m.atamaYok}</option>
                        {ayrinti.teknisyenler.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}{ayrinti.oneri?.teknisyenId === u.id ? ` · ${m.oneri}` : ''}
                          </option>
                        ))}
                      </select>
                      {ayrinti.oneri && (
                        <div style={{ fontSize: '0.78rem', color: '#4338ca', marginTop: 4 }}>
                          {m.oneri}: {gerekceMetni(ayrinti.oneri.veri, m)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={etiket} htmlFor={`ariza-${s.id}`}>{m.ariza}</label>
                      <textarea id={`ariza-${s.id}`} value={form.issueText} onChange={(e) => setForm({ ...form, issueText: e.target.value })} rows={3} maxLength={2000} style={{ ...inp, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      <div>
                        <label style={etiket} htmlFor={`kat-${s.id}`}>{m.kategori}</label>
                        <select id={`kat-${s.id}`} value={form.faultCategory} onChange={(e) => setForm({ ...form, faultCategory: e.target.value })} style={inp}>
                          <option value="">{m.kategoriYok}</option>
                          {FAULT_CATEGORIES.map((c) => (
                            <option key={c.code} value={c.code}>{kategoriAdi(c.code)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={etiket} htmlFor={`onc-${s.id}`}>{m.oncelik}</label>
                        <select id={`onc-${s.id}`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={inp}>
                          {ONCELIK.map((p) => (
                            <option key={p} value={p}>{m.oncelikler[p]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
                {hata && <div role="alert" style={{ color: '#b91c1c', fontSize: '0.86rem' }}>{hata}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ayrinti && ayrinti.adaylar.length > 0 && (
                    <button type="button" disabled={mesgul || !form.deviceId} onClick={() => gonder(s.id, { islem: 'onayla', ...form })} style={{ ...dugme(true), opacity: form.deviceId ? 1 : 0.5 }}>
                      {m.fisiAc}
                    </button>
                  )}
                  <button type="button" onClick={() => { setPanel({ id: s.id, tur: 'red' }); setHata(null); }} style={dugme(false)}>{m.reddet}</button>
                  <button type="button" onClick={() => { setPanel(null); setAyrinti(null); setHata(null); }} style={dugme(false)}>{m.vazgec}</button>
                </div>
              </div>
            )}
            {acik && panel?.tur === 'red' && hata && <div role="alert" style={{ color: '#b91c1c', fontSize: '0.86rem', marginTop: 6 }}>{hata}</div>}
          </article>
        );
      })}
    </section>
  );
}
