'use client';

/**
 * TOPLU CİHAZ AYARI EKRANI.
 *
 * Periyodik bakım ve filo optimizasyonu ekranlarının ikisi de cihazda
 * yazılı iki değere dayanıyor: sözleşmedeki DAHİL sayfa ve bakım EŞİĞİ.
 * Bin makinelik parkta bunları tek tek girmek kimsenin yapmayacağı iştir,
 * girilmeyince de iki ekran boş kalır.
 *
 * Ekranın en önemli davranışı ÖNİZLEME: hiçbir şey yazılmadan önce kaç
 * cihazın değişeceği, kaçının zaten dolu olduğu için atlandığı ve — ezme
 * açıksa — kaç cihazın ÜZERİNE yazılacağı söylenir. Toplu yazma tek tıkla
 * yüzlerce pazarlıklı değeri silebilir.
 */
import { useCallback, useEffect, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

type Alan = 'includedBlack' | 'includedColor' | 'pmIntervalPages' | 'pmIntervalMonths';

interface Satir {
  id: string; etiket: string; musteri: string;
  degisim: Partial<Record<Alan, { eski: number | null; yeni: number }>>;
}
interface Plan {
  satirlar: Satir[];
  taranan: number;
  atlanan: { DOLU: number; AYNI: number; KIRALIK_DEGIL: number };
  ezilecek: number;
  uygulandi?: boolean;
  guncellenen?: number;
}
interface Musteri { id: string; name: string }
interface ModelSatiri { marka: string; model: string }

export default function TopluAyarPage() {
  const t = useT();
  const b = useBicim();
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [modeller, setModeller] = useState<ModelSatiri[]>([]);
  const [musteriId, setMusteriId] = useState('');
  const [model, setModel] = useState('');
  const [yalnizKiralik, setYalnizKiralik] = useState(true);
  const [yalnizBos, setYalnizBos] = useState(true);
  const [degerler, setDegerler] = useState<Record<Alan, string>>({
    includedBlack: '', includedColor: '', pmIntervalPages: '', pmIntervalMonths: '',
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d) => {
      setMusteriler(Array.isArray(d) ? d : d.customers || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/devices/bulk-settings${musteriId ? `?musteri=${musteriId}` : ''}`)
      .then((r) => r.json())
      .then((d) => setModeller(Array.isArray(d?.modeller) ? d.modeller : []))
      .catch(() => setModeller([]));
    setModel('');
  }, [musteriId]);

  const govde = useCallback((dryRun: boolean) => ({
    degerler: Object.fromEntries(
      (Object.keys(degerler) as Alan[]).filter((a) => degerler[a] !== '').map((a) => [a, Number(degerler[a])]),
    ),
    musteriId: musteriId || null,
    model: model || null,
    yalnizBos, yalnizKiralik, dryRun,
  }), [degerler, musteriId, model, yalnizBos, yalnizKiralik]);

  const gonder = async (dryRun: boolean) => {
    setCalisiyor(true); setMesaj(null);
    try {
      const r = await fetch('/api/devices/bulk-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde(dryRun)),
      });
      const d = await r.json();
      if (!r.ok) { setMesaj(d?.error || ''); setPlan(null); return; }
      setPlan(d);
      if (!dryRun) setMesaj(doldur(t.topluAyar.tamam, { n: b.sayi(d.guncellenen ?? 0) }));
    } catch {
      setMesaj('');
    } finally {
      setCalisiyor(false);
    }
  };

  const uygula = async () => {
    if (!plan?.satirlar.length) return;
    const onay = doldur(t.topluAyar.uygulaOnay, {
      n: b.sayi(plan.satirlar.length), e: b.sayi(plan.ezilecek),
    });
    if (!confirm(onay)) return;
    await gonder(false);
  };

  const alanAdi = (a: Alan) => ({
    includedBlack: t.topluAyar.dahilSiyah,
    includedColor: t.topluAyar.dahilRenkli,
    pmIntervalPages: t.topluAyar.bakimSayfa,
    pmIntervalMonths: t.topluAyar.bakimAy,
  }[a]);

  const kutu: React.CSSProperties = {
    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.15rem',
  };
  const giris: React.CSSProperties = {
    padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', width: '100%',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1080, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.topluAyar.baslik}</h1>
      <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 720 }}>{t.topluAyar.alt}</p>
      <p style={{ color: '#4f46e5', margin: '0.35rem 0 0', fontSize: '0.83rem', fontWeight: 600 }}>{t.topluAyar.farkNotu}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(19rem,1fr))', gap: '1rem', marginTop: '1.25rem' }}>
        {/* ── SÜZGEÇ ───────────────────────────────────────────────── */}
        <div style={kutu}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.75rem' }}>{t.topluAyar.suzgecBaslik}</div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280', fontWeight: 700 }}>{t.topluAyar.musteri}</label>
          <select value={musteriId} onChange={(e) => setMusteriId(e.target.value)} style={{ ...giris, marginBottom: '0.7rem' }}>
            <option value="">{t.topluAyar.tumMusteriler}</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280', fontWeight: 700 }}>{t.topluAyar.model}</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...giris, marginBottom: '0.7rem' }}>
            <option value="">{t.topluAyar.tumModeller}</option>
            {modeller.map((m) => <option key={m.model} value={m.model}>{m.marka} {m.model}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            <input type="checkbox" checked={yalnizKiralik} onChange={(e) => setYalnizKiralik(e.target.checked)} />
            {t.topluAyar.yalnizKiralik}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={yalnizBos} onChange={(e) => setYalnizBos(e.target.checked)} />
            {t.topluAyar.yalnizBos}
          </label>
          {/* Ezme açıkken uyarı görünür: sessizce üzerine yazmak kabul edilemez. */}
          {!yalnizBos && (
            <div style={{ marginTop: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: '0.55rem 0.7rem', fontSize: '0.78rem' }}>
              {t.topluAyar.yalnizBosUyari}
            </div>
          )}
        </div>

        {/* ── DEĞERLER ─────────────────────────────────────────────── */}
        <div style={kutu}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.75rem' }}>{t.topluAyar.degerBaslik}</div>
          {(['includedBlack', 'includedColor', 'pmIntervalPages', 'pmIntervalMonths'] as Alan[]).map((a) => (
            <div key={a} style={{ marginBottom: '0.6rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280', fontWeight: 700 }}>{alanAdi(a)}</label>
              <input type="number" min={0} value={degerler[a]}
                onChange={(e) => setDegerler((d) => ({ ...d, [a]: e.target.value }))}
                style={giris} />
            </div>
          ))}
          <div style={{ color: '#6b7280', fontSize: '0.76rem', lineHeight: 1.6 }}>
            {t.topluAyar.bosBirak}<br />{t.topluAyar.sifirNotu}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
            <button onClick={() => gonder(true)} disabled={calisiyor}
              style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer' }}>
              {t.topluAyar.onizle}
            </button>
            <button onClick={uygula} disabled={calisiyor || !plan?.satirlar.length}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                background: plan?.satirlar.length ? '#047857' : '#d1d5db',
                color: 'white', fontSize: '0.86rem', fontWeight: 700,
                cursor: plan?.satirlar.length ? 'pointer' : 'not-allowed',
              }}>
              {t.topluAyar.uygula}
            </button>
          </div>
          {mesaj && <div style={{ marginTop: '0.6rem', color: '#047857', fontSize: '0.84rem', fontWeight: 600 }}>{mesaj}</div>}
        </div>
      </div>

      {/* ── ÖNİZLEME ─────────────────────────────────────────────── */}
      {plan && (
        <>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '1.5rem 0 0.5rem' }}>{t.topluAyar.onizlemeBaslik}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(9rem,1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
            {[
              { l: t.topluAyar.degisecek, v: plan.satirlar.length, c: '#047857' },
              { l: t.topluAyar.taranan, v: plan.taranan, c: '#111827' },
              { l: t.topluAyar.ezilecek, v: plan.ezilecek, c: plan.ezilecek ? '#b91c1c' : '#6b7280' },
              { l: t.topluAyar.atlananDolu, v: plan.atlanan.DOLU, c: '#6b7280' },
              { l: t.topluAyar.atlananAyni, v: plan.atlanan.AYNI, c: '#6b7280' },
              { l: t.topluAyar.atlananKiralikDegil, v: plan.atlanan.KIRALIK_DEGIL, c: '#6b7280' },
            ].map((k) => (
              <div key={k.l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.71rem', color: '#6b7280', fontWeight: 700 }}>{k.l}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.c }}>{b.sayi(k.v)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', minWidth: '38rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.73rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.topluAyar.sutunCihaz}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.topluAyar.sutunMusteri}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.topluAyar.sutunDegisim}</th>
                </tr>
              </thead>
              <tbody>
                {plan.satirlar.slice(0, 200).map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.55rem 0.9rem', fontWeight: 600 }}>{s.etiket}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#4b5563' }}>{s.musteri}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#4b5563', fontSize: '0.8rem' }}>
                      {(Object.keys(s.degisim) as Alan[]).map((a) => (
                        <div key={a}>
                          {alanAdi(a)}: <span style={{ color: '#9ca3af' }}>{s.degisim[a]!.eski === null ? '—' : b.sayi(s.degisim[a]!.eski!)}</span>
                          {' → '}
                          <b>{b.sayi(s.degisim[a]!.yeni)}</b>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                {!plan.satirlar.length && (
                  <tr><td colSpan={3} style={{ padding: '1.25rem 0.9rem', color: '#6b7280' }}>{t.topluAyar.degisiklikYok}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ marginTop: '1.5rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.15rem' }}>
        <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>{t.topluAyar.notBaslik}</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.75 }}>
          <li>{t.topluAyar.not1}</li>
          <li>{t.topluAyar.not2}</li>
          <li>{t.topluAyar.not3}</li>
          <li>{t.topluAyar.not4}</li>
          <li>{t.topluAyar.not5}</li>
        </ul>
      </div>
    </div>
  );
}
