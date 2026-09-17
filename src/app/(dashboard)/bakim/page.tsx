'use client';

/**
 * PERİYODİK BAKIM PLANI.
 *
 * Ekranın işi tek bir soruyu cevaplamak: "bu hafta hangi makineye gitmeliyim".
 * Bu yüzden gecikenler en üstte, yanında müşteri ve konum — teknisyen listeyi
 * okuyup rotasını kurabilsin.
 *
 * "Bilinmiyor" satırları da listede durur ve YEŞİL GÖSTERİLMEZ: eşiği ya da
 * son bakım kaydı olmayan bir makine, bakımı gelmemiş makine değildir —
 * bakımı hiç planlanmamış makinedir. İkisini aynı renge boyamak, o makinenin
 * habersiz ölmesi demektir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Durum {
  durum: 'GECIKTI' | 'YAKLASTI' | 'PLANLI' | 'BILINMIYOR';
  sebep: 'SAYFA' | 'AY' | 'POLITIKA_YOK' | 'BASLANGIC_YOK' | 'SAYAC_YOK';
  sayfaKalan: number | null;
  gunKalan: number | null;
  gecenAy: number | null;
  ayKalan: number | null;
  tahminiTarih: string | null;
}
interface Satir {
  deviceId: string; brand: string; model: string; serialNo: string; location: string | null;
  musteriId: string | null; musteri: string; musteriTelefon: string | null;
  sayfaAraligi: number | null; ayAraligi: number | null;
  politikaKaynak: 'CIHAZ' | 'VARSAYILAN' | 'YOK';
  sonBakimTarihi: string | null; sonBakimSayaci: number | null;
  guncelSayac: number | null; gunlukHiz: number | null;
  durum: Durum;
}
interface Veri {
  ozet: { geciken: number; yaklasan: number; planli: number; bilinmeyen: number; politikasiz: number };
  satirlar: Satir[];
  varsayilanSayfa: number | null;
  varsayilanAy: number | null;
}

const RENK: Record<Durum['durum'], { bg: string; fg: string; bd: string }> = {
  GECIKTI: { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' },
  YAKLASTI: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' },
  PLANLI: { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' },
  BILINMIYOR: { bg: '#f3f4f6', fg: '#4b5563', bd: '#e5e7eb' },
};
const HIZ_PENCERESI_GUN = 120;

export default function BakimPage() {
  const t = useT();
  const b = useBicim();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [suzgec, setSuzgec] = useState<'HEPSI' | Durum['durum']>('HEPSI');
  const [sayfa, setSayfa] = useState('');
  const [ay, setAy] = useState('');
  const [mesaj, setMesaj] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch('/api/bakim')
      .then((r) => r.json())
      .then((d: Veri) => {
        setVeri(d?.ozet ? d : null);
        if (d?.ozet) {
          setSayfa(d.varsayilanSayfa ? String(d.varsayilanSayfa) : '');
          setAy(d.varsayilanAy ? String(d.varsayilanAy) : '');
        }
      })
      .catch(() => setVeri(null))
      .finally(() => setYukleniyor(false));
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const varsayilanKaydet = async () => {
    const r = await fetch('/api/bakim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ islem: 'varsayilan', sayfa: sayfa === '' ? null : sayfa, ay: ay === '' ? null : ay }),
    });
    const d = await r.json().catch(() => ({}));
    setMesaj(r.ok ? t.bakim.varsayilanKaydedildi : (d.error || ''));
    setTimeout(() => setMesaj(''), 4000);
    if (r.ok) yukle();
  };

  const yapildiIsaretle = async (s: Satir) => {
    const ad = `${s.brand} ${s.model} ${s.serialNo}`.trim();
    if (!confirm(doldur(t.bakim.yapildiOnay, { cihaz: ad }))) return;
    const r = await fetch('/api/bakim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ islem: 'yapildi', deviceId: s.deviceId }),
    });
    const d = await r.json().catch(() => ({}));
    setMesaj(r.ok ? t.bakim.yapildiTamam : (d.error || ''));
    setTimeout(() => setMesaj(''), 4000);
    if (r.ok) yukle();
  };

  const satirlar = useMemo(() => {
    if (!veri) return [];
    return suzgec === 'HEPSI' ? veri.satirlar : veri.satirlar.filter((s) => s.durum.durum === suzgec);
  }, [veri, suzgec]);

  const durumAdi = (d: Durum['durum']) =>
    d === 'GECIKTI' ? t.bakim.geciken : d === 'YAKLASTI' ? t.bakim.yaklasan
      : d === 'PLANLI' ? t.bakim.planli : t.bakim.bilinmeyen;

  /** Kalan sütunu: sayfa ve/veya ay. Hesaplanamayan için sebebi yazılır. */
  const kalan = (d: Durum) => {
    if (d.durum === 'BILINMIYOR') {
      return d.sebep === 'POLITIKA_YOK' ? t.bakim.sebepPolitikaYok
        : d.sebep === 'SAYAC_YOK' ? t.bakim.sebepSayacYok : t.bakim.sebepBaslangicYok;
    }
    const parcalar: string[] = [];
    if (d.sayfaKalan !== null) {
      parcalar.push(d.sayfaKalan < 0
        ? doldur(t.bakim.sayfaAsildi, { n: b.sayi(-d.sayfaKalan) })
        : doldur(t.bakim.sayfaKalan, { n: b.sayi(d.sayfaKalan) }));
    }
    if (d.ayKalan !== null) {
      parcalar.push(d.ayKalan < 0
        ? doldur(t.bakim.ayAsildi, { n: b.sayi(-d.ayKalan) })
        : doldur(t.bakim.ayKalan, { n: b.sayi(d.ayKalan) }));
    }
    return parcalar.join(' · ') || '—';
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{t.bakim.baslik}</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem', maxWidth: 680 }}>{t.bakim.alt}</p>
      </div>

      {yukleniyor && <div style={{ color: '#6b7280', marginTop: '1.5rem' }}>{t.bakim.yukleniyor}</div>}

      {!yukleniyor && veri && (
        <>
          {/* ── ÖZET / SÜZGEÇ ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(9rem,1fr))', gap: '0.7rem', margin: '1.25rem 0' }}>
            {([
              ['GECIKTI', t.bakim.geciken, veri.ozet.geciken],
              ['YAKLASTI', t.bakim.yaklasan, veri.ozet.yaklasan],
              ['PLANLI', t.bakim.planli, veri.ozet.planli],
              ['BILINMIYOR', t.bakim.bilinmeyen, veri.ozet.bilinmeyen],
            ] as [Durum['durum'], string, number][]).map(([k, ad, n]) => {
              const r = RENK[k];
              const secili = suzgec === k;
              return (
                <button key={k} onClick={() => setSuzgec(secili ? 'HEPSI' : k)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', background: r.bg,
                    border: `1px solid ${secili ? r.fg : r.bd}`, borderRadius: 10, padding: '0.7rem 1rem',
                  }}>
                  <div style={{ fontSize: '0.72rem', color: r.fg, fontWeight: 700 }}>{ad}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: r.fg }}>{b.sayi(n)}</div>
                </button>
              );
            })}
          </div>

          {/* ── FİLO GENELİ EŞİK ────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t.bakim.varsayilanBaslik}</div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.3rem 0 0.8rem', maxWidth: 680, lineHeight: 1.6 }}>
              {t.bakim.varsayilanAlt}
            </p>
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t.bakim.varsayilanSayfa}
                </label>
                <input type="number" min={1} value={sayfa} onChange={(e) => setSayfa(e.target.value)}
                  style={{ padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.86rem', width: '9rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t.bakim.varsayilanAy}
                </label>
                <input type="number" min={1} value={ay} onChange={(e) => setAy(e.target.value)}
                  style={{ padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.86rem', width: '9rem' }} />
              </div>
              <button onClick={varsayilanKaydet}
                style={{ padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none', background: '#4f46e5', color: 'white', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }}>
                {t.bakim.varsayilanKaydet}
              </button>
              {mesaj && <span style={{ fontSize: '0.82rem', color: '#047857' }}>{mesaj}</span>}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.6rem 0 0', maxWidth: 680 }}>{t.bakim.ikisiBirden}</p>
          </div>

          {/* ── LİSTE ───────────────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse', minWidth: '52rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.74rem', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunCihaz}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunMusteri}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunDurum}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunKalan}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunTahmin}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunSonBakim}</th>
                  <th style={{ padding: '0.55rem 0.9rem' }}>{t.bakim.sutunIslem}</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>{t.bakim.cihazYok}</td></tr>
                )}
                {satirlar.map((s) => {
                  const r = RENK[s.durum.durum];
                  return (
                    <tr key={s.deviceId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.55rem 0.9rem' }}>
                        <Link href={`/devices/${s.deviceId}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
                          {s.brand} {s.model}
                        </Link>
                        <div style={{ color: '#9ca3af', fontSize: '0.74rem' }}>
                          {s.serialNo}{s.location ? ` · ${s.location}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem' }}>
                        {s.musteriId
                          ? <Link href={`/customers/${s.musteriId}`} style={{ color: '#374151' }}>{s.musteri}</Link>
                          : s.musteri}
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem' }}>
                        <span style={{ background: r.bg, color: r.fg, border: `1px solid ${r.bd}`, borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {durumAdi(s.durum.durum)}
                        </span>
                        {s.durum.durum !== 'BILINMIYOR' && (
                          <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                            {s.durum.sebep === 'SAYFA' ? t.bakim.sebepSayfa : t.bakim.sebepAy}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem', color: s.durum.durum === 'BILINMIYOR' ? '#9ca3af' : '#374151' }}>
                        {kalan(s.durum)}
                        {s.durum.gunKalan !== null && (
                          <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>
                            {s.durum.gunKalan < 0
                              ? doldur(t.bakim.ayAsildi, { n: b.sayi(Math.round(-s.durum.gunKalan / 30)) })
                              : doldur(t.bakim.gunKalan, { n: b.sayi(s.durum.gunKalan) })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {s.durum.tahminiTarih ? b.tarih(s.durum.tahminiTarih) : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {s.sonBakimTarihi ? b.tarih(s.sonBakimTarihi) : '—'}
                        {s.politikaKaynak !== 'YOK' && (
                          <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>
                            {s.politikaKaynak === 'CIHAZ' ? t.bakim.politikaCihaz : t.bakim.politikaVarsayilan}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem 0.9rem' }}>
                        <button onClick={() => yapildiIsaretle(s)}
                          style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {t.bakim.yapildi}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── NASIL HESAPLANDI ────────────────────────────────────── */}
          <div style={{ marginTop: '1.5rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{t.bakim.notBaslik}</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#4b5563', fontSize: '0.8rem', lineHeight: 1.7 }}>
              <li>{t.bakim.not1}</li>
              <li>{doldur(t.bakim.not2, { n: HIZ_PENCERESI_GUN })}</li>
              <li>{t.bakim.not3}</li>
              <li>{doldur(t.bakim.not4, { n: veri.ozet.bilinmeyen })}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
