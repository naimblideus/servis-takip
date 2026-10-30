'use client';

/**
 * KURULUM SİHİRBAZI — teknisyen müşteri ofisinde, 10 dakika.
 *
 * Kod üret → müşterinin bilgisayarında Win+R'ye tek satır → bu ekran
 * birkaç saniyede bir sorar ve adım adım gösterir: bağlandı, N adres
 * taranıyor, M yazıcı bulundu, günlük çalışma kuruldu. Yazıcı görünmezse
 * sebebi tarayıcının ölçtüğünden söylenir (SNMP kapalı, başka alt ağ...);
 * çözüm aynı ekranda: IP'yi yaz, yeni kod üret.
 */
import { useEffect, useRef, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { waUrl } from '@/lib/share';
import type { KurulumIpucuSatiri, TaramaTanisi } from '@/lib/sayac-tarama';

interface Durum {
  id: string; kod: string; kodBitis: string; hedef: string | null;
  kullanildiAt: string | null; bilgisayar: string | null;
  nabiz: { asama?: string; hedefSayisi?: number | null; at?: string } | null;
  tarama: null | {
    id: string; createdAt: string; taranan: number; bulunan: number; eslesen: number; tani: TaramaTanisi | null;
    cihazlar: { ip: string; marka: string | null; model: string | null; seri: string | null; durum: string }[];
    ipuclari: KurulumIpucuSatiri[];
  };
}

const kart: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '1rem' };
const GECIKME_MS = 3 * 60_000;

/** Yazıcının bildirdiği model çoğu zaman markayı da içeriyor ("Pantum BP5100DN"); marka iki kez yazılmasın. */
function cihazAdi(marka: string | null, model: string | null): string {
  if (!model) return marka || '—';
  if (!marka) return model;
  const m = model.toLowerCase(), k = marka.toLowerCase();
  return m === k || m.startsWith(`${k} `) ? model : `${marka} ${model}`;
}

export default function KurulumSihirbazi({ onBitti }: { onBitti?: (taramaId: string) => void }) {
  const t = useT();
  const tk = t.tarayici.kurulum;
  const tt = t.tarayici;
  const b = useBicim();
  const [hedef, setHedef] = useState('');
  const [topluluk, setTopluluk] = useState('');
  const [durum, setDurum] = useState<Durum | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kopya, setKopya] = useState(false);
  const [simdi, setSimdi] = useState(() => Date.now());
  const uretildi = useRef(0);
  const bildirildi = useRef<string | null>(null);

  const site = typeof window !== 'undefined' ? window.location.origin : '';
  const komut = durum ? `powershell -ep bypass -c "irm ${site}/k/${durum.kod} | iex"` : '';

  const uret = async () => {
    setMesgul(true); setHata(null); setKopya(false);
    try {
      const r = await fetch('/api/sayac/tarayici/kurulum', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hedef, topluluk }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setHata(j.error ?? tt.kaydedilemedi); return; }
      uretildi.current = Date.now();
      setDurum({ ...j, kullanildiAt: null, bilgisayar: null, nabiz: null, tarama: null });
    } finally {
      setMesgul(false);
    }
  };

  // Canlı geri bildirim: tarama bitene kadar 3 sn'de bir sor.
  const bitti = Boolean(durum?.tarama);
  useEffect(() => {
    if (!durum || bitti) return;
    const id = durum.id;
    const z = setInterval(async () => {
      setSimdi(Date.now());
      const r = await fetch(`/api/sayac/tarayici/kurulum?id=${id}`, { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setDurum(await r.json());
    }, 3000);
    return () => clearInterval(z);
  }, [durum?.id, bitti]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tarama gelince sayfanın geri kalanı (son taramalar, ekleme kutusu) tazelensin.
  useEffect(() => {
    if (durum?.tarama && bildirildi.current !== durum.tarama.id) {
      bildirildi.current = durum.tarama.id;
      onBitti?.(durum.tarama.id);
    }
  }, [durum?.tarama, onBitti]);

  const kopyala = async () => {
    try { await navigator.clipboard.writeText(komut); setKopya(true); } catch { window.prompt('', komut); }
  };

  const ipucuMetni = (i: KurulumIpucuSatiri) =>
    doldur((tk.ipucu as Record<string, string>)[i.kod] ?? i.kod, { ipler: (i.ipler ?? []).join(', '), n: i.n ?? 0, aralik: i.aralik ?? '' });

  const asama = durum?.nabiz?.asama;
  const baglandi = Boolean(durum?.kullanildiAt);
  const taraniyor = baglandi && !bitti && (asama === 'BASLADI' || asama === 'GONDERILIYOR');
  const gecikti = durum && !baglandi && simdi - uretildi.current > GECIKME_MS;
  const tr = durum?.tarama;
  const sorunsuz = tr && tr.bulunan > 0 && tr.ipuclari.every((i) => i.kod === 'BUYUK_AG');

  const Satir = ({ ok, bekliyor, children }: { ok: boolean; bekliyor?: boolean; children: React.ReactNode }) => (
    <li style={{ display: 'flex', gap: '0.55rem', alignItems: 'baseline', color: ok ? '#065f46' : bekliyor ? '#1e40af' : '#9ca3af', fontWeight: ok || bekliyor ? 600 : 400 }}>
      <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{ok ? '✓' : bekliyor ? '…' : '○'}</span>
      <span>{children}</span>
    </li>
  );

  return (
    <section style={{ ...kart, borderColor: '#bfdbfe' }} id="kurulum">
      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{tk.baslik}</h2>
      <p style={{ color: '#4b5563', margin: '0.3rem 0 0.9rem', fontSize: '0.9rem', maxWidth: 760 }}>{tk.alt}</p>

      {/* ── Hedef + kod üret ── */}
      <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 560 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
          {tk.ipEtiket}
          <input value={hedef} onChange={(e) => setHedef(e.target.value)} placeholder={tk.ipOrnek} inputMode="decimal"
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'ui-monospace, monospace' }} />
        </label>
        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{tk.ipYardim}</span>
        <details>
          <summary style={{ fontSize: '0.82rem', color: '#4b5563', cursor: 'pointer' }}>{tk.gelismis}</summary>
          <input value={topluluk} onChange={(e) => setTopluluk(e.target.value)} placeholder="public" aria-label={tk.gelismis}
            style={{ marginTop: 6, padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, width: 220, fontFamily: 'ui-monospace, monospace' }} />
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>{tk.toplulukYardim}</div>
        </details>
        <div>
          <button type="button" onClick={uret} disabled={mesgul}
            style={{ padding: '0.6rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: mesgul ? 'default' : 'pointer', opacity: mesgul ? 0.6 : 1 }}>
            {durum ? tk.yeniden : tk.uret}
          </button>
        </div>
        {hata && <div role="alert" style={{ color: '#991b1b', fontSize: '0.86rem' }}>{hata}</div>}
      </div>

      {/* ── Komut ── */}
      {durum && (
        <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
          <ol style={{ margin: '0 0 0.7rem', paddingLeft: '1.2rem', listStyle: 'decimal', color: '#374151', fontSize: '0.92rem', lineHeight: 1.65 }}>
            <li>{tk.adim1}</li><li>{tk.adim2}</li><li>{tk.adim3}</li>
          </ol>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <code data-komut style={{ flex: '1 1 420px', minWidth: 0, background: '#0b1220', color: '#e7ecf3', borderRadius: 10, padding: '0.75rem 0.9rem', fontSize: '0.88rem', overflowWrap: 'anywhere', userSelect: 'all' }}>{komut}</code>
            <button type="button" onClick={kopyala}
              style={{ padding: '0.55rem 1rem', background: kopya ? '#16a34a' : 'white', color: kopya ? 'white' : '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              {kopya ? tk.kopyalandi : tk.kopyala}
            </button>
            <a href={waUrl(null, doldur(tk.waMetin, { komut }))} target="_blank" rel="noopener"
              style={{ padding: '0.55rem 1rem', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              {tk.waGonder}
            </a>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.4rem' }}>
            {doldur(tk.kodBilgi, { kod: durum.kod, saat: b.tarihSaat(durum.kodBitis) })}
          </div>

          {/* ── Canlı durum ── */}
          <ul aria-live="polite" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.35rem', fontSize: '0.92rem' }}>
            <Satir ok>{tk.durumKod}</Satir>
            <Satir ok={baglandi} bekliyor={!baglandi}>
              {baglandi ? doldur(tk.durumBaglandi, { bilgisayar: durum.bilgisayar ?? '—' }) : tk.durumBekle}
            </Satir>
            <Satir ok={bitti} bekliyor={taraniyor}>
              {bitti ? `${tk.durumBitti} — ${tr!.bulunan ? doldur(tk.sonuc, { bulunan: tr!.bulunan, eslesen: tr!.eslesen }) : tk.sonucYok}`
                : taraniyor && durum.nabiz?.hedefSayisi != null ? doldur(tk.durumTaraniyor, { n: durum.nabiz.hedefSayisi }) : tk.durumTarama}
            </Satir>
            {bitti && tr!.tani?.gunluk != null && (
              <Satir ok={tr!.tani.gunluk}>{tr!.tani.gunluk ? tk.durumGunluk : tk.durumGunlukYok}</Satir>
            )}
          </ul>
          {taraniyor && <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>{tk.basladiAmaBitmedi}</p>}

          {gecikti && (
            <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.9rem', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.86rem' }}>
              <strong>{tk.gecikti.baslik}</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                {tk.gecikti.maddeler.map((m: string) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* ── Sonuç ── */}
          {tr && (
            <div style={{ marginTop: '1rem' }}>
              {sorunsuz && (
                <div role="status" style={{ padding: '0.75rem 0.9rem', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'block' }}>✓ {tk.tamamBaslik}</strong>
                  <span style={{ fontSize: '0.86rem' }}>{tk.tamamAlt}</span>
                </div>
              )}
              {tr.cihazlar.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem', display: 'grid', gap: '0.3rem', fontSize: '0.86rem' }}>
                  {tr.cihazlar.map((c) => (
                    <li key={c.ip} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{cihazAdi(c.marka, c.model)}</span>
                      <span style={{ color: '#9ca3af', fontFamily: 'ui-monospace, monospace' }}>{c.ip}{c.seri ? ` · ${c.seri}` : ''}</span>
                      <span style={{ color: c.durum === 'ESLESMEDI' || c.durum === 'HATA' ? '#991b1b' : '#065f46', fontWeight: 600 }}>
                        {(tt.durum as Record<string, string>)[c.durum] ?? c.durum}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {tr.ipuclari.length > 0 && (
                <div style={{ padding: '0.75rem 0.9rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{tk.neYapmali}</strong>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.86rem', color: '#374151', display: 'grid', gap: '0.35rem' }}>
                    {tr.ipuclari.map((i) => <li key={i.kod} data-ipucu={i.kod}>{ipucuMetni(i)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
