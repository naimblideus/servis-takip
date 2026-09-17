'use client';

/**
 * SLA UYUM EKRANI.
 *
 * Bu ekranın müşterisi iki kişi:
 *   · BAYİ — "bu ay sözümü tuttum mu, kimde tutmadım?"
 *   · BÜYÜK MÜŞTERİ — yıl sonu görüşmesinde masaya konan rapor.
 *
 * O yüzden ekran iki şeyi aynı anda yapmak zorunda: sorunu öne çıkarmak
 * (en çok ihlali olan müşteri en üstte) ve neyi ölçtüğünü açıkça yazmak.
 * Ölçüm sınırlarını gizleyen bir SLA raporu ilk denetimde çöker.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Olcum {
  kapsamda: boolean;
  disKalmaKodu: 'TURETILMIS_GECMIS' | 'TAKVIM_GECERSIZ' | 'HEDEF_YOK' | null;
  mudahaleHamDk: number | null; cozumHamDk: number | null;
  mudahaleDk: number | null; cozumDk: number | null;
  mudahaleIhlal: boolean | null; cozumIhlal: boolean | null;
  mudahaleAcik: boolean; cozumAcik: boolean;
}
interface Ozet {
  olculen: number; turetilmisDisi: number; hedefsizDisi: number;
  mudahaleOlculen: number; mudahaleIhlal: number;
  cozumOlculen: number; cozumIhlal: number;
  mudahaleUyumYuzde: number | null; cozumUyumYuzde: number | null;
  mudahaleOrtancaDk: number | null; cozumOrtancaDk: number | null;
}
interface Fis {
  id: string; ticketNumber: string; musteriId: string; musteri: string; cihaz: string;
  acilis: string; hedefMudahaleDk: number | null; hedefCozumDk: number | null;
  parcaDurdurur: boolean; olcum: Olcum;
}
interface MusteriSatiri {
  musteriId: string; musteri: string;
  hedefMudahaleDk: number | null; hedefCozumDk: number | null; ozet: Ozet;
}
interface Takvim {
  zamanDilimi: string; gunler: number[]; baslangicDk: number; bitisDk: number; tatiller: string[];
}
interface Veri {
  donem: string; ozet: Ozet; musteriler: MusteriSatiri[]; fisler: Fis[];
  takvim: Takvim; takvimSorunlu: boolean; hedefliSozlesme: number;
}

const GUN_KISA = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const GUN_KISA_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SlaPage() {
  const t = useT();
  const b = useBicim();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ay, setAy] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sadeceIhlal, setSadeceIhlal] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/sla?ay=${ay}`)
      .then((r) => r.json())
      .then((d) => setVeri(d?.ozet ? d : null))
      .catch(() => setVeri(null))
      .finally(() => setYukleniyor(false));
  }, [ay]);
  useEffect(() => { yukle(); }, [yukle]);

  /** Dakikayı okunur süreye çevirir: 90 → "1s 30dk". */
  const sure = (dk: number | null) => {
    if (dk === null || dk === undefined) return '—';
    if (dk < 60) return `${b.sayi(dk)} ${t.sla.dakikaKisa}`;
    const s = Math.floor(dk / 60), k = dk % 60;
    return k ? `${b.sayi(s)} ${t.sla.saatKisa} ${b.sayi(k)} ${t.sla.dakikaKisa}` : `${b.sayi(s)} ${t.sla.saatKisa}`;
  };

  const gunAdlari = (g: number[]) =>
    g.slice().sort((a, c) => a - c)
      .map((n) => (b.dil === 'en' ? GUN_KISA_EN[n] : GUN_KISA[n])).join(', ');
  const saat = (dk: number) => `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`;

  const fisler = useMemo(() => {
    if (!veri) return [];
    if (!sadeceIhlal) return veri.fisler;
    return veri.fisler.filter((f) => f.olcum.mudahaleIhlal || f.olcum.cozumIhlal);
  }, [veri, sadeceIhlal]);

  // Son 12 ay — dönem seçimi.
  const aylar = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const yuzde = (v: number | null) => (v === null ? '—' : b.yuzde(v, 1));
  const ihlalRenk = (v: boolean | null) => (v === null ? '#6b7280' : v ? '#b91c1c' : '#047857');

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.sla.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 620 }}>{t.sla.alt}</p>
        </div>
        <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          {t.sla.donem}&nbsp;
          <select value={ay} onChange={(e) => setAy(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
            {aylar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {yukleniyor && <div style={{ color: '#6b7280', marginTop: '1.5rem' }}>{t.sla.yukleniyor}</div>}

      {!yukleniyor && veri?.takvimSorunlu && (
        <div style={{ marginTop: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.86rem' }}>
          {t.sla.takvimSorunu}
        </div>
      )}

      {/* HİÇ SÖZ YOKSA: ekran sayı uydurmaz, ne yapılacağını söyler. */}
      {!yukleniyor && veri && veri.hedefliSozlesme === 0 && (
        <div style={{ marginTop: '1.25rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{t.sla.hedefYokBaslik}</div>
          <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.6, marginTop: '0.5rem', maxWidth: 680 }}>
            {t.sla.hedefYokAlt}
          </p>
          <Link href="/sozlesmeler" style={{ display: 'inline-block', marginTop: '0.75rem', color: '#4f46e5', fontWeight: 700, fontSize: '0.9rem' }}>
            {t.sla.sozlesmeyeGit}
          </Link>
        </div>
      )}

      {!yukleniyor && veri && veri.hedefliSozlesme > 0 && (
        <>
          {/* ── ÖZET ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(10rem,1fr))', gap: '0.75rem', margin: '1.25rem 0' }}>
            {[
              { l: t.sla.uyumMudahale, v: yuzde(veri.ozet.mudahaleUyumYuzde), alt: `${veri.ozet.mudahaleIhlal} ${t.sla.ihlal}`, c: veri.ozet.mudahaleIhlal ? '#b91c1c' : '#047857' },
              { l: t.sla.uyumCozum, v: yuzde(veri.ozet.cozumUyumYuzde), alt: `${veri.ozet.cozumIhlal} ${t.sla.ihlal}`, c: veri.ozet.cozumIhlal ? '#b91c1c' : '#047857' },
              { l: t.sla.ortancaMudahale, v: sure(veri.ozet.mudahaleOrtancaDk), alt: '', c: '#111827' },
              { l: t.sla.ortancaCozum, v: sure(veri.ozet.cozumOrtancaDk), alt: '', c: '#111827' },
              { l: t.sla.olculenFis, v: b.sayi(veri.ozet.olculen), alt: '', c: '#111827' },
            ].map((k) => (
              <div key={k.l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{k.l}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.c }}>{k.v}</div>
                {k.alt && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{k.alt}</div>}
              </div>
            ))}
          </div>

          {/* ── MÜŞTERİ BAZINDA ──────────────────────────────────────── */}
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '1.5rem 0 0.5rem' }}>{t.sla.musteriBaslik}</h2>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse', minWidth: '40rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.74rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.sla.sutunMusteri}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.sla.sutunHedef}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.sla.sutunFis}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.sla.sutunMudahale}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.sla.sutunCozum}</th>
                </tr>
              </thead>
              <tbody>
                {veri.musteriler.map((m) => (
                  <tr key={m.musteriId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}>{m.musteri}</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: '#6b7280', fontSize: '0.8rem' }}>
                      {m.hedefMudahaleDk === null && m.hedefCozumDk === null
                        ? t.sla.hedefYokKisa
                        : `${sure(m.hedefMudahaleDk)} / ${sure(m.hedefCozumDk)}`}
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(m.ozet.olculen)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: m.ozet.mudahaleIhlal ? '#b91c1c' : '#047857' }}>
                      {yuzde(m.ozet.mudahaleUyumYuzde)}
                    </td>
                    <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: m.ozet.cozumIhlal ? '#b91c1c' : '#047857' }}>
                      {yuzde(m.ozet.cozumUyumYuzde)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── FİŞLER ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0 0.5rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t.sla.fisBaslik}</h2>
            <button onClick={() => setSadeceIhlal((v) => !v)}
              style={{ padding: '0.35rem 0.8rem', borderRadius: 8, border: '1px solid #d1d5db', background: sadeceIhlal ? '#fee2e2' : 'white', color: sadeceIhlal ? '#991b1b' : '#374151', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              {sadeceIhlal ? t.sla.hepsi : t.sla.sadeceIhlal}
            </button>
          </div>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse', minWidth: '48rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.74rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.sla.sutunFisNo}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.sla.sutunMusteri}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.sla.sutunCihaz}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.sla.sutunAcilis}</th>
                  <th style={{ padding: '0.55rem 0.9rem', textAlign: 'right' }}>{t.sla.sutunMudahale}</th>
                  <th style={{ padding: '0.55rem 0.9rem', textAlign: 'right' }}>{t.sla.sutunCozum}</th>
                </tr>
              </thead>
              <tbody>
                {fisler.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>{t.sla.fisYok}</td></tr>
                )}
                {fisler.map((f) => {
                  const o = f.olcum;
                  const dis = !o.kapsamda;
                  const disEtiket = o.disKalmaKodu === 'TURETILMIS_GECMIS' ? t.sla.disTuretilmis
                    : o.disKalmaKodu === 'HEDEF_YOK' ? t.sla.disHedefYok
                      : o.disKalmaKodu === 'TAKVIM_GECERSIZ' ? t.sla.disTakvim : t.sla.kapsamDisi;
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: dis ? 0.6 : 1 }}>
                      <td style={{ padding: '0.55rem 0.9rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        <Link href={`/tickets/${f.id}`} style={{ color: '#4f46e5' }}>{f.ticketNumber}</Link>
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem' }}>{f.musteri}</td>
                      <td style={{ padding: '0.55rem 0.9rem', color: '#6b7280' }}>{f.cihaz || '—'}</td>
                      <td style={{ padding: '0.55rem 0.9rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{b.tarihSaat(f.acilis)}</td>
                      {dis ? (
                        <td colSpan={2} style={{ padding: '0.55rem 0.9rem', textAlign: 'right', color: '#9ca3af', fontSize: '0.78rem' }}>
                          {disEtiket}
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '0.55rem 0.9rem', textAlign: 'right', color: ihlalRenk(o.mudahaleIhlal), fontWeight: o.mudahaleIhlal ? 700 : 500, whiteSpace: 'nowrap' }}>
                            {sure(o.mudahaleDk)}{o.mudahaleAcik ? ` (${t.sla.acikIs})` : ''}
                          </td>
                          <td style={{ padding: '0.55rem 0.9rem', textAlign: 'right', color: ihlalRenk(o.cozumIhlal), fontWeight: o.cozumIhlal ? 700 : 500, whiteSpace: 'nowrap' }}>
                            {sure(o.cozumDk)}{o.cozumAcik ? ` (${t.sla.acikIs})` : ''}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── NE ÖLÇÜLDÜ ───────────────────────────────────────────────
              Sınırları gizleyen SLA raporu ilk denetimde çöker; burada
              önden yazıyoruz. */}
          <div style={{ marginTop: '1.5rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{t.sla.kapsamBaslik}</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.8rem', lineHeight: 1.7 }}>
              <li>{t.sla.kapsam1}</li>
              <li>{t.sla.kapsam2}</li>
              <li>{doldur(t.sla.kapsam3, { n: veri.ozet.hedefsizDisi })}</li>
              <li>{doldur(t.sla.kapsam4, { n: veri.ozet.turetilmisDisi })}</li>
              <li>{doldur(t.sla.kapsam5, {
                gun: gunAdlari(veri.takvim.gunler),
                bas: saat(veri.takvim.baslangicDk),
                bit: saat(veri.takvim.bitisDk),
                tz: veri.takvim.zamanDilimi,
              })}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
