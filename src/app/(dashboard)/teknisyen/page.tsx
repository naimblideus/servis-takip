'use client';

/**
 * TEKNİSYEN KARNESİ EKRANI.
 *
 * Ekranın cevapladığı tek soru: İŞ BİR SEFERDE BİTİYOR MU.
 *
 * Bir insanı ölçen ekran, ölçemediği yeri saklamamak zorundadır. O yüzden
 * burada üç kutu hep görünür: bekleyen (süresi dolmamış), belirsiz
 * (kategorisiz ziyaret var) ve kategorisiz fiş. Bunlar orana GİRMEZ ve
 * gizlenmezler — gizlendiklerinde oran olduğundan güzel görünür.
 *
 * Sıralama "en iyi teknisyen" değil "en çok tekrar çağrısı olan" üstte:
 * ekrana bakan yönetici önce sorunu görsün. Oranı hesaplanamayanlar en altta
 * durur; sıfır iş almış teknisyen de listede kalır.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Karne {
  teknisyenId: string | null;
  teknisyenAdi: string | null;
  fis: number; ariza: number; planli: number; acik: number;
  ilkSeferde: number; tekrar: number; beklemede: number; belirsiz: number; kategorisiz: number;
  yaklasik: number;
  ilkSeferdeYuzde: number | null;
  oranYok: 'AZ_IS' | 'OLCUM_YOK' | null;
  mudahaleOrtancaDk: number | null;
  cozumOrtancaDk: number | null;
  sureOlculen: number;
}
interface Tekrar {
  fisNo: string; tekrarFisNo: string; gun: number;
  cihaz: string; musteri: string; kategori: string;
  teknisyenId: string | null; teknisyenAdi: string | null;
}
interface Ozet {
  fis: number; ariza: number; ilkSeferde: number; tekrar: number;
  beklemede: number; belirsiz: number; kategorisiz: number; yaklasik: number; atanmamis: number;
  ilkSeferdeYuzde: number | null;
  oranYok: 'AZ_IS' | 'OLCUM_YOK' | null;
  mudahaleOrtancaDk: number | null; cozumOrtancaDk: number | null;
  teknisyen: number;
}
interface Veri {
  donem: string;
  karneler: Karne[];
  atanmamis: Karne | null;
  tekrarlar: Tekrar[];
  ozet: Ozet;
  takvimSorunlu: boolean;
  tekrarGun: number;
}

export default function TeknisyenPage() {
  const t = useT();
  const b = useBicim();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ay, setAy] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/teknisyen?ay=${ay}`)
      .then((r) => r.json())
      .then((d) => setVeri(d?.ozet ? d : null))
      .catch(() => setVeri(null))
      .finally(() => setYukleniyor(false));
  }, [ay]);
  useEffect(() => { yukle(); }, [yukle]);

  /** Dakikayı okunur süreye çevirir: 90 → "1s 30dk". */
  const sure = (dk: number | null) => {
    if (dk === null || dk === undefined) return '—';
    if (dk < 60) return `${b.sayi(dk)} ${t.teknisyen.dakikaKisa}`;
    const s = Math.floor(dk / 60), k = dk % 60;
    return k ? `${b.sayi(s)} ${t.teknisyen.saatKisa} ${b.sayi(k)} ${t.teknisyen.dakikaKisa}` : `${b.sayi(s)} ${t.teknisyen.saatKisa}`;
  };

  const aylar = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const arizaAdi = (kod: string) => (t.ariza as Record<string, string>)[kod] ?? kod;

  /** Oran hücresi: sayı yoksa SEBEBİ yazılır, boş bırakılmaz. */
  const oranHucresi = (k: Karne) => {
    if (k.ilkSeferdeYuzde !== null) return b.yuzde(k.ilkSeferdeYuzde, 0);
    if (k.fis === 0) return t.teknisyen.isYok;
    return k.oranYok === 'AZ_IS' ? t.teknisyen.oranAzIs : t.teknisyen.oranOlcumYok;
  };
  const oranRenk = (k: Karne) => {
    if (k.ilkSeferdeYuzde === null) return '#6b7280';
    return k.ilkSeferdeYuzde >= 90 ? '#047857' : k.ilkSeferdeYuzde >= 75 ? '#b45309' : '#b91c1c';
  };

  const satir = (k: Karne, anahtar: string, puanli: boolean) => (
    <tr key={anahtar} style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}>
        {k.teknisyenAdi ?? t.teknisyen.atanmamisBaslik}
      </td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(k.fis)}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: '#6b7280' }}>{b.sayi(k.ariza)}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: '#6b7280' }}>{b.sayi(k.planli)}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: k.acik ? '#b45309' : '#6b7280' }}>{b.sayi(k.acik)}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{puanli ? b.sayi(k.ilkSeferde) : '—'}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: k.tekrar ? '#b91c1c' : '#6b7280' }}>
        {puanli ? b.sayi(k.tekrar) : '—'}
      </td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 800, color: puanli ? oranRenk(k) : '#6b7280', fontSize: puanli && k.ilkSeferdeYuzde !== null ? '0.95rem' : '0.78rem' }}>
        {puanli ? oranHucresi(k) : '—'}
      </td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{sure(k.mudahaleOrtancaDk)}</td>
      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{sure(k.cozumOrtancaDk)}</td>
    </tr>
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.teknisyen.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 680 }}>
            {doldur(t.teknisyen.alt, { n: veri?.tekrarGun ?? 30 })}
          </p>
        </div>
        <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          {t.teknisyen.donem}&nbsp;
          <select value={ay} onChange={(e) => setAy(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
            {aylar.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {yukleniyor && <div style={{ color: '#6b7280', marginTop: '1.5rem' }}>{t.teknisyen.yukleniyor}</div>}

      {!yukleniyor && veri?.takvimSorunlu && (
        <div style={{ marginTop: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.86rem' }}>
          {t.teknisyen.takvimSorunu}
        </div>
      )}

      {!yukleniyor && veri && (
        <>
          {/* ── ÖZET ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(9.5rem,1fr))', gap: '0.75rem', margin: '1.25rem 0' }}>
            {[
              {
                l: t.teknisyen.ilkSeferde,
                v: veri.ozet.ilkSeferdeYuzde === null
                  ? (veri.ozet.oranYok === 'AZ_IS' ? t.teknisyen.oranAzIs : t.teknisyen.oranOlcumYok)
                  : b.yuzde(veri.ozet.ilkSeferdeYuzde, 0),
                alt: `${t.teknisyen.olculenFis}: ${b.sayi(veri.ozet.ilkSeferde + veri.ozet.tekrar)}`,
                c: veri.ozet.ilkSeferdeYuzde === null ? '#6b7280' : veri.ozet.ilkSeferdeYuzde >= 90 ? '#047857' : '#b45309',
                kucuk: veri.ozet.ilkSeferdeYuzde === null,
              },
              { l: t.teknisyen.tekrarCagri, v: b.sayi(veri.ozet.tekrar), alt: '', c: veri.ozet.tekrar ? '#b91c1c' : '#047857', kucuk: false },
              { l: t.teknisyen.ortancaMudahale, v: sure(veri.ozet.mudahaleOrtancaDk), alt: '', c: '#111827', kucuk: false },
              { l: t.teknisyen.ortancaCozum, v: sure(veri.ozet.cozumOrtancaDk), alt: '', c: '#111827', kucuk: false },
              { l: t.teknisyen.bekleyen, v: b.sayi(veri.ozet.beklemede), alt: '', c: '#6b7280', kucuk: false },
              { l: t.teknisyen.belirsiz, v: b.sayi(veri.ozet.belirsiz + veri.ozet.kategorisiz), alt: '', c: '#6b7280', kucuk: false },
            ].map((k) => (
              <div key={k.l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>{k.l}</div>
                <div style={{ fontSize: k.kucuk ? '0.95rem' : '1.5rem', fontWeight: 800, color: k.c, marginTop: k.kucuk ? '0.3rem' : 0 }}>{k.v}</div>
                {k.alt && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{k.alt}</div>}
              </div>
            ))}
          </div>

          {veri.ozet.oranYok === 'AZ_IS' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '0.7rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
              {doldur(t.teknisyen.azIsIpucu, { n: 5 })}
            </div>
          )}

          {/* ── TEKNİSYEN BAZINDA ────────────────────────────────────── */}
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '1.5rem 0 0.5rem' }}>{t.teknisyen.karneBaslik}</h2>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse', minWidth: '52rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.74rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem 0.9rem' }}>{t.teknisyen.sutunTeknisyen}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunFis}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunAriza}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunPlanli}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunAcik}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunIlkSeferde}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunTekrar}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunOran}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunMudahale}</th>
                  <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.sutunCozum}</th>
                </tr>
              </thead>
              <tbody>
                {veri.karneler.map((k) => satir(k, k.teknisyenId ?? 'yok', true))}
                {/* Atanmamış fiş puanlanmaz; satırı toplam yalan söylemesin diye burada. */}
                {veri.atanmamis && veri.atanmamis.fis > 0 && satir(veri.atanmamis, 'atanmamis', false)}
                {!veri.karneler.length && !veri.atanmamis && (
                  <tr><td colSpan={10} style={{ padding: '1.25rem 0.9rem', color: '#6b7280' }}>{t.teknisyen.kayitYok}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {veri.atanmamis && veri.atanmamis.fis > 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.5rem 0 0' }}>{t.teknisyen.atanmamisNot}</p>
          )}

          {/* ── TEKRAR ÇAĞRILAR ──────────────────────────────────────── */}
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '1.75rem 0 0.25rem' }}>{t.teknisyen.tekrarBaslik}</h2>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{t.teknisyen.tekrarAlt}</p>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse', minWidth: '46rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.74rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.tekrarSutunFis}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.tekrarSutunGeri}</th>
                  <th style={{ padding: '0.55rem 0.9rem', textAlign: 'right' }}>{t.teknisyen.tekrarSutunGun}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.tekrarSutunKategori}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.tekrarSutunCihaz}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.tekrarSutunMusteri}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.teknisyen.sutunTeknisyen}</th>
                </tr>
              </thead>
              <tbody>
                {veri.tekrarlar.map((r) => (
                  <tr key={`${r.fisNo}-${r.tekrarFisNo}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.55rem 0.9rem', fontWeight: 600 }}>{r.fisNo}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#b91c1c', fontWeight: 600 }}>{r.tekrarFisNo}</td>
                    <td style={{ padding: '0.55rem 0.9rem', textAlign: 'right' }}>{doldur(t.teknisyen.gunKisa, { n: b.sayi(r.gun) })}</td>
                    <td style={{ padding: '0.55rem 0.9rem' }}>{arizaAdi(r.kategori)}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#4b5563' }}>{r.cihaz}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#4b5563' }}>{r.musteri}</td>
                    <td style={{ padding: '0.55rem 0.9rem', color: '#4b5563' }}>{r.teknisyenAdi ?? '—'}</td>
                  </tr>
                ))}
                {!veri.tekrarlar.length && (
                  <tr><td colSpan={7} style={{ padding: '1.25rem 0.9rem', color: '#047857', fontWeight: 600 }}>{t.teknisyen.tekrarYok}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── KAPSAM ───────────────────────────────────────────────── */}
          <div style={{ marginTop: '1.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.15rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem' }}>{t.teknisyen.kapsamBaslik}</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.75 }}>
              <li>{doldur(t.teknisyen.kapsam1, { n: veri.tekrarGun })}</li>
              <li>{t.teknisyen.kapsam2}</li>
              <li>{doldur(t.teknisyen.kapsam3, { n: veri.tekrarGun, b: b.sayi(veri.ozet.beklemede) })}</li>
              <li>{doldur(t.teknisyen.kapsam4, { n: b.sayi(veri.ozet.kategorisiz) })}</li>
              <li>{t.teknisyen.kapsam5}</li>
              <li>{t.teknisyen.kapsam6}</li>
              {/* Yaklaşık kapanış anına dayanan hüküm varsa SAYISI yazılır. */}
              {veri.ozet.yaklasik > 0 && <li>{doldur(t.teknisyen.kapsam7, { n: b.sayi(veri.ozet.yaklasik) })}</li>}
            </ul>
            <div style={{ marginTop: '0.6rem' }}>
              <Link href="/sla" style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.82rem' }}>{t.menu['/sla']} →</Link>
              <span style={{ color: '#d1d5db', margin: '0 0.5rem' }}>·</span>
              <Link href="/bakim" style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.82rem' }}>{t.menu['/bakim']} →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
