'use client';

/**
 * KURUMSAL GRUP EKRANI.
 *
 * Bu ekranın okuyucusu iki kişi:
 *   · BAYİ — "bu büyük hesap bana ne getiriyor, hangi şubede sorun var?"
 *   · GENEL MÜDÜRLÜK — yıl sonu görüşmesinde masaya konan tek sayfa.
 *
 * İkincisi yüzünden ekran neyi ölçemediğini de yazmak zorunda: okunmamış
 * sayaç "0 sayfa" gösterilirse rapor ilk itirazda çöker. Sayfası bilinmeyen
 * şube listede kalır ve "okunmadı" yazar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Grup { id: string; ad: string; not: string | null; sube: number }
interface Sube {
  musteriId: string; musteri: string;
  cihaz: number; okunanCihaz: number;
  siyah: number | null; renkli: number | null;
  ariza: number; planli: number;
  slaMudahaleYuzde: number | null; slaCozumYuzde: number | null; slaOlculen: number;
  donemFaturasi: number; bakiye: number;
}
interface Toplam {
  sube: number; cihaz: number; okunanCihaz: number; okunmayanCihaz: number;
  siyah: number | null; renkli: number | null; toplamSayfa: number | null; renkliPayi: number | null;
  ariza: number; planli: number;
  slaMudahaleYuzde: number | null; slaCozumYuzde: number | null; slaOlculen: number; slaSozluSube: number;
  donemFaturasi: number; bakiye: number; bakiyeliSube: number;
}
interface Veri { gruplar: Grup[]; grup?: Grup; donem?: string; subeler?: Sube[]; toplam?: Toplam }
interface Aday { id: string; name: string; groupId: string | null }

export default function KurumsalPage() {
  const t = useT();
  const b = useBicim();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [grupId, setGrupId] = useState('');
  const [ay, setAy] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [yeniAcik, setYeniAcik] = useState(false);
  const [yeniAd, setYeniAd] = useState('');
  const [yeniNot, setYeniNot] = useState('');
  const [arama, setArama] = useState('');
  const [adaylar, setAdaylar] = useState<Aday[]>([]);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    const q = grupId ? `?grup=${grupId}&donem=${ay}` : '';
    fetch(`/api/kurumsal${q}`)
      .then((r) => r.json())
      .then((d) => {
        setVeri(d?.gruplar ? d : null);
        // İlk açılışta ilk grup seçili gelsin — boş ekran kimseye bir şey söylemez.
        if (!grupId && d?.gruplar?.length) setGrupId(d.gruplar[0].id);
      })
      .catch(() => setVeri(null))
      .finally(() => setYukleniyor(false));
  }, [grupId, ay]);
  useEffect(() => { yukle(); }, [yukle]);

  const gonder = async (govde: Record<string, unknown>) => {
    const r = await fetch('/api/kurumsal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d?.error || d?.kod || ''); return false; }
    return true;
  };

  const aramaYap = useCallback(async (metin: string) => {
    setArama(metin);
    if (!grupId || metin.trim().length < 2) { setAdaylar([]); return; }
    const r = await fetch(`/api/kurumsal?grup=${grupId}&ara=${encodeURIComponent(metin)}`);
    const d = await r.json().catch(() => ({}));
    setAdaylar(Array.isArray(d?.musteriler) ? d.musteriler : []);
  }, [grupId]);

  const aylar = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const sayfa = (n: number | null) => (n === null ? t.kurumsal.okunmadi : b.sayi(n));
  const yuzde = (n: number | null) => (n === null ? t.kurumsal.sozYok : b.yuzde(n, 0));
  const uyumRenk = (n: number | null) => (n === null ? '#9ca3af' : n >= 95 ? '#047857' : n >= 85 ? '#b45309' : '#b91c1c');

  const gruplar = veri?.gruplar ?? [];
  const toplam = veri?.toplam;
  const subeler = veri?.subeler ?? [];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.kurumsal.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 700 }}>{t.kurumsal.alt}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {gruplar.length > 0 && (
            <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
              {t.kurumsal.grup}&nbsp;
              <select value={grupId} onChange={(e) => setGrupId(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
                {gruplar.map((g) => <option key={g.id} value={g.id}>{g.ad} ({g.sube})</option>)}
              </select>
            </label>
          )}
          <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
            {t.kurumsal.donem}&nbsp;
            <select value={ay} onChange={(e) => setAy(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
              {aylar.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <button onClick={() => setYeniAcik((v) => !v)}
            style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', background: '#4f46e5', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {t.kurumsal.yeniGrup}
          </button>
        </div>
      </div>

      {yeniAcik && (
        <div style={{ marginTop: '1rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder={t.kurumsal.grupAdi}
            style={{ padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', minWidth: 220 }} />
          <input value={yeniNot} onChange={(e) => setYeniNot(e.target.value)} placeholder={t.kurumsal.grupNotu}
            style={{ padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', minWidth: 260, flex: 1 }} />
          <button
            onClick={async () => {
              if (!yeniAd.trim()) return;
              if (await gonder({ islem: 'grup-ac', ad: yeniAd, not: yeniNot })) {
                setYeniAd(''); setYeniNot(''); setYeniAcik(false); setGrupId(''); yukle();
              }
            }}
            style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: 'none', background: '#047857', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {t.kurumsal.olustur}
          </button>
          <button onClick={() => setYeniAcik(false)}
            style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            {t.kurumsal.vazgec}
          </button>
        </div>
      )}

      {yukleniyor && <div style={{ color: '#6b7280', marginTop: '1.5rem' }}>{t.kurumsal.yukleniyor}</div>}

      {/* HİÇ GRUP YOKSA: ekran ne olduğunu ve ne yapılacağını anlatır. */}
      {!yukleniyor && gruplar.length === 0 && (
        <div style={{ marginTop: '1.25rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{t.kurumsal.bosBaslik}</div>
          <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.65, marginTop: '0.5rem', maxWidth: 700 }}>{t.kurumsal.bosAlt}</p>
        </div>
      )}

      {!yukleniyor && toplam && veri?.grup && (
        <>
          {/* ── ÖZET ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(9.5rem,1fr))', gap: '0.75rem', margin: '1.25rem 0' }}>
            {[
              { l: t.kurumsal.subeSayisi, v: b.sayi(toplam.sube), alt: '', c: '#111827' },
              { l: t.kurumsal.cihazSayisi, v: b.sayi(toplam.cihaz), alt: toplam.okunmayanCihaz ? `${b.sayi(toplam.okunmayanCihaz)} ${t.kurumsal.okunmadi}` : '', c: '#111827' },
              {
                l: t.kurumsal.toplamSayfa,
                v: sayfa(toplam.toplamSayfa),
                // Yüzde işaretinin yeri dile göre değişir (%10 / 10%): elle
                // yazmak İngilizce ekranda "%10 colour" üretiyordu.
                alt: toplam.renkliPayi === null ? '' : `${b.yuzde(toplam.renkliPayi, 0)} ${t.kurumsal.renkliPayi}`,
                c: '#111827',
              },
              { l: t.kurumsal.arizaSayisi, v: b.sayi(toplam.ariza), alt: '', c: toplam.ariza ? '#b45309' : '#047857' },
              { l: t.kurumsal.slaMudahale, v: yuzde(toplam.slaMudahaleYuzde), alt: '', c: uyumRenk(toplam.slaMudahaleYuzde) },
              { l: t.kurumsal.slaCozum, v: yuzde(toplam.slaCozumYuzde), alt: '', c: uyumRenk(toplam.slaCozumYuzde) },
              { l: t.kurumsal.donemFaturasi, v: b.para(toplam.donemFaturasi), alt: '', c: '#111827' },
              { l: t.kurumsal.acikBakiye, v: b.para(toplam.bakiye), alt: '', c: toplam.bakiye > 0.005 ? '#b91c1c' : '#047857' },
            ].map((k) => (
              <div key={k.l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{k.l}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: k.c }}>{k.v}</div>
                {k.alt && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{k.alt}</div>}
              </div>
            ))}
          </div>

          {/* ── ŞUBELER ──────────────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', minWidth: '58rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.73rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.kurumsal.sutunSube}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunCihaz}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunSiyah}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunRenkli}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunToplam}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunAriza}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunPlanli}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunSlaMudahale}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunSlaCozum}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunFatura}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.kurumsal.sutunBakiye}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }} />
                </tr>
              </thead>
              <tbody>
                {subeler.map((s) => {
                  const top = s.siyah === null && s.renkli === null ? null : (s.siyah ?? 0) + (s.renkli ?? 0);
                  return (
                    <tr key={s.musteriId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}>{s.musteri}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>
                        {b.sayi(s.cihaz)}
                        {s.cihaz > s.okunanCihaz && (
                          <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}> ({b.sayi(s.cihaz - s.okunanCihaz)} {t.kurumsal.okunmadi})</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: s.siyah === null ? '#9ca3af' : '#111827' }}>{sayfa(s.siyah)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: s.renkli === null ? '#9ca3af' : '#111827' }}>{sayfa(s.renkli)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: top === null ? '#9ca3af' : '#111827' }}>{sayfa(top)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: s.ariza ? '#b45309' : '#6b7280' }}>{b.sayi(s.ariza)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: '#6b7280' }}>{b.sayi(s.planli)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: uyumRenk(s.slaMudahaleYuzde), fontSize: s.slaMudahaleYuzde === null ? '0.76rem' : '0.85rem' }}>
                        {yuzde(s.slaMudahaleYuzde)}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: uyumRenk(s.slaCozumYuzde), fontSize: s.slaCozumYuzde === null ? '0.76rem' : '0.85rem' }}>
                        {yuzde(s.slaCozumYuzde)}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.para(s.donemFaturasi)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: s.bakiye > 0.005 ? '#b91c1c' : '#6b7280' }}>{b.para(s.bakiye)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>
                        <button
                          onClick={async () => {
                            if (!confirm(doldur(t.kurumsal.cikarOnay, { ad: s.musteri }))) return;
                            if (await gonder({ islem: 'sube-cikar', musteriId: s.musteriId })) yukle();
                          }}
                          style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: '0.74rem', cursor: 'pointer' }}>
                          {t.kurumsal.cikar}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!subeler.length && (
                  <tr><td colSpan={12} style={{ padding: '1.25rem 0.9rem', color: '#6b7280' }}>{t.kurumsal.subeYok}</td></tr>
                )}
                {subeler.length > 1 && (
                  <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb', fontWeight: 800 }}>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{t.kurumsal.toplamSatiri}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(toplam.cihaz)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{sayfa(toplam.siyah)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{sayfa(toplam.renkli)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{sayfa(toplam.toplamSayfa)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(toplam.ariza)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(toplam.planli)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: uyumRenk(toplam.slaMudahaleYuzde) }}>{yuzde(toplam.slaMudahaleYuzde)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: uyumRenk(toplam.slaCozumYuzde) }}>{yuzde(toplam.slaCozumYuzde)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.para(toplam.donemFaturasi)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: toplam.bakiye > 0.005 ? '#b91c1c' : '#111827' }}>{b.para(toplam.bakiye)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── ŞUBE EKLE ────────────────────────────────────────────── */}
          <div style={{ marginTop: '1.25rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>{t.kurumsal.subeEkle}</div>
            <input value={arama} onChange={(e) => aramaYap(e.target.value)} placeholder={t.kurumsal.subeAra}
              style={{ padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', width: '100%', maxWidth: 380 }} />
            {arama.trim().length >= 2 && (
              <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {adaylar.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem' }}>
                    <span style={{ minWidth: 220 }}>{a.name}</span>
                    {a.groupId ? (
                      <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{t.kurumsal.zatenBu}</span>
                    ) : (
                      <button
                        onClick={async () => {
                          if (await gonder({ islem: 'sube-ekle', grupId, musteriId: a.id })) { setArama(''); setAdaylar([]); yukle(); }
                        }}
                        style={{ padding: '0.25rem 0.7rem', borderRadius: 6, border: 'none', background: '#4f46e5', color: 'white', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        {t.kurumsal.ekle}
                      </button>
                    )}
                  </div>
                ))}
                {!adaylar.length && <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{t.kurumsal.sonucYok}</div>}
              </div>
            )}
          </div>

          {/* ── KAPSAM ───────────────────────────────────────────────── */}
          <div style={{ marginTop: '1.25rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.15rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>{t.kurumsal.kapsamBaslik}</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.75 }}>
              <li>{t.kurumsal.kapsam1}</li>
              <li>{doldur(t.kurumsal.kapsam2, { n: b.sayi(toplam.okunmayanCihaz) })}</li>
              <li>{t.kurumsal.kapsam3}</li>
              <li>{doldur(t.kurumsal.kapsam4, { n: b.sayi(toplam.slaSozluSube), t: b.sayi(toplam.sube) })}</li>
              <li>{t.kurumsal.kapsam5}</li>
              <li>{t.kurumsal.kapsam6}</li>
            </ul>
            <button
              onClick={async () => {
                if (!veri.grup) return;
                if (!confirm(doldur(t.kurumsal.grupSilOnay, { ad: veri.grup.ad }))) return;
                if (await gonder({ islem: 'grup-sil', grupId })) { setGrupId(''); yukle(); }
              }}
              style={{ marginTop: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: 8, border: '1px solid #fecaca', background: 'white', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
              {t.kurumsal.grupSil}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
