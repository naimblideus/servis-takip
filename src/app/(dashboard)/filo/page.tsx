'use client';

/**
 * FİLO OPTİMİZASYONU EKRANI.
 *
 * Tek soru: DOĞRU MAKİNE DOĞRU YERDE Mİ.
 *
 * Her satırın sonunda bir EYLEM yazıyor. Durum adı ("az kullanım") kimseye
 * ne yapacağını söylemez; "küçük paket hem ucuz hem masada savunulabilir"
 * söyler. Bu ekranın çıktısı bir rapor değil, bir görüşme gündemidir.
 *
 * Kullanılmayan dahil sayfa hiçbir yerde paraya çevrilmiyor; yalnız AŞIM
 * tutar olarak yazılıyor, çünkü aşan sayfa gerçekten faturalanıyor.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

type Durum = 'HIC_BASMIYOR' | 'AZ_KULLANIM' | 'ASIM' | 'DENGELI' | 'BILINMIYOR';
type Sebep = 'KIRALIK_DEGIL' | 'OKUMA_YOK' | 'DAHIL_SAYFA_YOK' | 'KIRA_YOK';

interface Sonuc {
  durum: Durum; sebep: Sebep | null;
  kullanimOrani: number | null; kullanilmayanSayfa: number | null;
  asimSiyah: number; asimRenkli: number; asimTutar: number | null;
  renkliGereksiz: boolean;
}
interface Satir {
  deviceId: string; brand: string; model: string; serialNo: string; location: string | null;
  musteriId: string | null; musteri: string;
  kiralik: boolean; aylikKira: number;
  dahilSiyah: number; dahilRenkli: number;
  aylikSiyah: number | null; aylikRenkli: number | null;
  renkliCihaz: boolean; durum: Sonuc;
}
interface Ozet {
  toplam: number; bostaDuran: number; asimli: number; azKullanim: number;
  dengeli: number; bilinmeyen: number; okumasiz: number;
  aylikAsimTutari: number; fiyatsizAsim: number; renkliGereksiz: number;
}
interface Veri { ay: number; ozet: Ozet; satirlar: Satir[] }

const RENK: Record<Durum, string> = {
  HIC_BASMIYOR: '#b91c1c',
  ASIM: '#b45309',
  AZ_KULLANIM: '#7c3aed',
  DENGELI: '#047857',
  BILINMIYOR: '#6b7280',
};

export default function FiloPage() {
  const t = useT();
  const b = useBicim();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ay, setAy] = useState(3);
  const [suzgec, setSuzgec] = useState<Durum | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/filo?ay=${ay}`)
      .then((r) => r.json())
      .then((d) => setVeri(d?.ozet ? d : null))
      .catch(() => setVeri(null))
      .finally(() => setYukleniyor(false));
  }, [ay]);
  useEffect(() => { yukle(); }, [yukle]);

  const durumAdi = (d: Durum) => ({
    HIC_BASMIYOR: t.filo.bostaDuran,
    ASIM: t.filo.asimli,
    AZ_KULLANIM: t.filo.azKullanim,
    DENGELI: t.filo.dengeli,
    BILINMIYOR: t.filo.bilinmeyen,
  }[d]);

  /** Her satırın sonunda ne yapılacağı yazar — durum adı tek başına eylem değildir. */
  const oneri = (s: Sonuc) => {
    if (s.durum === 'HIC_BASMIYOR') return t.filo.oneriBosta;
    if (s.durum === 'ASIM') return t.filo.oneriAsim;
    if (s.durum === 'AZ_KULLANIM') return t.filo.oneriAz;
    if (s.durum === 'DENGELI') return t.filo.oneriDengeli;
    return {
      KIRALIK_DEGIL: t.filo.oneriKiralikDegil,
      OKUMA_YOK: t.filo.oneriOkumaYok,
      DAHIL_SAYFA_YOK: t.filo.oneriPaketYok,
      KIRA_YOK: t.filo.oneriKiraYok,
    }[s.sebep ?? 'OKUMA_YOK'];
  };

  const sayfa = (n: number | null) => (n === null ? t.filo.okunmadi : b.sayi(n));
  const satirlar = (veri?.satirlar ?? []).filter((s) => !suzgec || s.durum.durum === suzgec);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.filo.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 700 }}>
            {doldur(t.filo.alt, { n: veri?.ay ?? ay })}
          </p>
        </div>
        <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          {t.filo.pencere}&nbsp;
          <select value={ay} onChange={(e) => setAy(Number(e.target.value))}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
            {[3, 6, 12].map((a) => <option key={a} value={a}>{doldur(t.filo.ayKisa, { n: a })}</option>)}
          </select>
        </label>
      </div>

      {yukleniyor && <div style={{ color: '#6b7280', marginTop: '1.5rem' }}>{t.filo.yukleniyor}</div>}

      {!yukleniyor && veri && (
        <>
          {/* ── ÖZET ─── kartlar aynı zamanda süzgeç ─────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(9.5rem,1fr))', gap: '0.75rem', margin: '1.25rem 0' }}>
            {([
              { d: 'HIC_BASMIYOR' as Durum, l: t.filo.bostaDuran, v: veri.ozet.bostaDuran },
              { d: 'ASIM' as Durum, l: t.filo.asimli, v: veri.ozet.asimli },
              { d: 'AZ_KULLANIM' as Durum, l: t.filo.azKullanim, v: veri.ozet.azKullanim },
              { d: 'DENGELI' as Durum, l: t.filo.dengeli, v: veri.ozet.dengeli },
              { d: 'BILINMIYOR' as Durum, l: t.filo.bilinmeyen, v: veri.ozet.bilinmeyen },
            ]).map((k) => (
              <button key={k.d} onClick={() => setSuzgec((x) => (x === k.d ? null : k.d))}
                style={{
                  background: suzgec === k.d ? '#eef2ff' : 'white',
                  border: `1px solid ${suzgec === k.d ? '#c7d2fe' : '#e5e7eb'}`,
                  borderRadius: 10, padding: '0.8rem 1rem', textAlign: 'left', cursor: 'pointer',
                }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{k.l}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: RENK[k.d] }}>{b.sayi(k.v)}</div>
              </button>
            ))}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.8rem 1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{t.filo.aylikAsim}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#b45309' }}>{b.para(veri.ozet.aylikAsimTutari)}</div>
            </div>
            {veri.ozet.renkliGereksiz > 0 && (
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{t.filo.renkliGereksizBaslik}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed' }}>{b.sayi(veri.ozet.renkliGereksiz)}</div>
              </div>
            )}
          </div>

          {/* ── LİSTE ────────────────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', minWidth: '62rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.73rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.filo.sutunCihaz}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.filo.sutunMusteri}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.filo.sutunDurum}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.filo.sutunAylikSayfa}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.filo.sutunDahil}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.filo.sutunKullanim}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.filo.sutunAsim}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.filo.sutunKira}</th>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.filo.sutunOneri}</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => {
                  const dahil = s.dahilSiyah + s.dahilRenkli;
                  const aylik = s.aylikSiyah === null && s.aylikRenkli === null
                    ? null : (s.aylikSiyah ?? 0) + (s.aylikRenkli ?? 0);
                  return (
                    <tr key={s.deviceId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <Link href={`/devices/${s.deviceId}`} style={{ fontWeight: 600, color: '#1f2937', textDecoration: 'none' }}>
                          {s.brand} {s.model}
                        </Link>
                        <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>{s.serialNo}{s.location ? ` · ${s.location}` : ''}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', color: '#4b5563' }}>{s.musteri}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <span style={{ color: RENK[s.durum.durum], fontWeight: 700, fontSize: '0.8rem' }}>{durumAdi(s.durum.durum)}</span>
                        {s.durum.renkliGereksiz && (
                          <div style={{ color: '#7c3aed', fontSize: '0.7rem' }}>{t.filo.renkliGereksizNot}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: aylik === null ? '#9ca3af' : '#111827' }}>{sayfa(aylik)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: dahil ? '#111827' : '#9ca3af' }}>
                        {dahil ? b.sayi(dahil) : t.filo.paketYok}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: RENK[s.durum.durum] }}>
                        {s.durum.kullanimOrani === null ? '—' : b.yuzde(s.durum.kullanimOrani * 100, 0)}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>
                        {s.durum.durum !== 'ASIM' ? '—' : (
                          <>
                            <div style={{ fontWeight: 700, color: '#b45309' }}>
                              {s.durum.asimTutar === null ? '—' : b.para(s.durum.asimTutar)}
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                              {b.sayi(s.durum.asimSiyah + s.durum.asimRenkli)}
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: '#4b5563' }}>
                        {s.kiralik ? b.para(s.aylikKira) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', color: '#4b5563', fontSize: '0.78rem', maxWidth: 260 }}>{oneri(s.durum)}</td>
                    </tr>
                  );
                })}
                {!satirlar.length && (
                  <tr><td colSpan={9} style={{ padding: '1.25rem 0.9rem', color: '#6b7280' }}>{t.filo.cihazYok}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── KAPSAM ───────────────────────────────────────────────── */}
          <div style={{ marginTop: '1.5rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.15rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>{t.filo.kapsamBaslik}</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.75 }}>
              <li>{doldur(t.filo.kapsam1, { n: veri.ay })}</li>
              <li>{t.filo.kapsam2}</li>
              <li>{doldur(t.filo.kapsam3, { n: b.sayi(veri.ozet.fiyatsizAsim) })}</li>
              <li>{doldur(t.filo.kapsam4, { n: b.sayi(veri.ozet.okumasiz) })}</li>
              <li>{t.filo.kapsam5}</li>
              <li>{t.filo.kapsam6}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
