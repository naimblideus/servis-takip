'use client';

/**
 * Cihaz Yaşı — yıl seçerek toplu giriş.
 *
 * Tasarım kararları (davranışı bozmadan doldurtmak için):
 *  1. TARİH DEĞİL YIL sorulur. Bayi "14 Mart 2019" hatırlamaz, "2019'da aldık" der.
 *  2. KANIT gösterilir: ilk servis kaydı cihazın en geç ne zaman kurulu olduğunu
 *     söyler. Sonraki yıllar tıklanamaz → yanlış seçenek ortadan kalkar.
 *  3. 20'LİK PARTİ. 552 cihaz göstermek moral kırar; bitişi olan iş yapılır.
 *  4. "BİLMİYORUM" butonu. İşaretlenen cihaz bir daha sorulmaz — yoksa kullanıcı
 *     kurtulmak için rastgele tarih girer ve veri bozulur.
 *  5. KEŞİF: yaş girilince bazen gerçek bir bulgu çıkar ("7 yaşında, 5 arıza").
 *     Kalıcı motivasyon rozetten değil, bu değişken ve GERÇEK bulgudan gelir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Row {
  id: string; brand: string; model: string; serialNo: string;
  customerId: string; customerName: string | null;
  musterideBekleyen: number;
  enGecKurulum: string | null;
}
interface Kesif {
  deviceId: string; baslik: string; musteri: string | null;
  yasAy: number; arizaSayisi: number;
}

export default function KurulumTarihiPage() {
  const t = useT();
  const b = useBicim();
  const [rows, setRows] = useState<Row[]>([]);
  const [sayac, setSayac] = useState({ toplam: 0, dolu: 0, bilinmeyen: 0, kalan: 0 });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kesifler, setKesifler] = useState<Kesif[]>([]);
  const [partiBaslangic, setPartiBaslangic] = useState(0);
  const [eskiYillar, setEskiYillar] = useState(false);

  const buYil = new Date().getFullYear();
  const yillar = useMemo(() => {
    const n = eskiYillar ? 20 : 9;
    return Array.from({ length: n }, (_, i) => buYil - i);
  }, [buYil, eskiYillar]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const d = await fetch('/api/devices/install-date').then(r => r.json());
    setRows(d.devices || []);
    setSayac({ toplam: d.toplam, dolu: d.dolu, bilinmeyen: d.bilinmeyen, kalan: d.kalan });
    setPartiBaslangic(d.devices?.length || 0);
    setYukleniyor(false);
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const kaydet = async (ids: string[], payload: { year?: number; unknown?: boolean }) => {
    const r = await fetch('/api/devices/install-date', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...payload }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || t.cihazYasi.kaydedilemedi); return; }
    setSayac({ toplam: d.toplam, dolu: d.dolu, bilinmeyen: d.bilinmeyen, kalan: d.kalan });
    setRows(prev => prev.filter(x => !ids.includes(x.id)));
    if (d.kesifler?.length) setKesifler(prev => [...d.kesifler, ...prev]);
  };

  const pct = sayac.toplam ? Math.round((sayac.dolu / sayac.toplam) * 100) : 0;
  const partiBiten = partiBaslangic - rows.length;
  const partiBitti = !yukleniyor && rows.length === 0 && partiBaslangic > 0;

  const kutu: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.1rem', marginBottom: '0.9rem',
  };
  const yilBtn = (aktif: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.7rem', borderRadius: '0.45rem', fontSize: '0.85rem',
    border: '1px solid ' + (aktif ? '#d1d5db' : '#f3f4f6'),
    backgroundColor: aktif ? 'white' : '#fafafa',
    color: aktif ? '#374151' : '#d1d5db',
    cursor: aktif ? 'pointer' : 'not-allowed', fontWeight: 500,
  });

  return (
    <div style={{ maxWidth: '58rem' }}>
      <Link href="/devices" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none' }}>{t.cihazYasi.geri}</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.4rem 0 0.25rem' }}>{t.cihazYasi.baslik}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
        {t.cihazYasi.altOn} <b>{t.cihazYasi.altVurgu}</b> {t.cihazYasi.altOrta}{' '}
        <b>{t.cihazYasi.altVurgu2}</b>{t.cihazYasi.altSon}
      </p>

      {/* Kapsam */}
      <div style={kutu}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, color: pct >= 80 ? '#15803d' : '#111827' }}>{b.yuzde(pct)}</span>
          <span style={{ fontSize: '0.9rem', color: '#374151' }}>{doldur(t.cihazYasi.kapsam, { dolu: sayac.dolu, toplam: sayac.toplam })}</span>
          {sayac.kalan > 0 && <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{doldur(t.cihazYasi.soruKaldi, { n: sayac.kalan })}</span>}
        </div>
        <div style={{ marginTop: '0.55rem', height: '8px', borderRadius: '9999px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: '9999px',
            backgroundColor: pct >= 80 ? '#16a34a' : '#3b82f6',
            transition: 'width .4s cubic-bezier(.4,0,.2,1), background-color .3s',
          }} />
        </div>
        {/* Eşik ödülü: rozet değil, gerçek rapor */}
        <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: pct >= 80 ? '#15803d' : '#6b7280' }}>
          {pct >= 80 ? t.cihazYasi.esikAcik : t.cihazYasi.esikKapali}
        </div>
      </div>

      {/* KEŞİFLER — asıl ödül burası */}
      {kesifler.length > 0 && (
        <div style={{ ...kutu, backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.5rem', fontSize: '0.92rem' }}>
            {doldur(t.cihazYasi.kesifBaslik, { n: kesifler.length })}
          </div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {kesifler.slice(0, 6).map(k => (
              <div key={k.deviceId} className="sa-slide" style={{ fontSize: '0.85rem', color: '#78350f' }}>
                <b>{k.baslik}</b>{k.musteri ? ` · ${k.musteri}` : ''}{t.cihazYasi.kesifOn}
                {doldur(t.cihazYasi.kesifYas, { n: Math.floor(k.yasAy / 12) })}{t.cihazYasi.kesifOrta}
                <b>{doldur(t.cihazYasi.kesifAriza, { n: k.arizaSayisi })}</b>{t.cihazYasi.kesifSon}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parti */}
      {yukleniyor ? (
        <div style={{ ...kutu, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>{t.genel.yukleniyor}</div>
      ) : partiBitti ? (
        <div style={{ ...kutu, textAlign: 'center', padding: '2.2rem' }} className="sa-pop">
          <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>✓</div>
          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.3rem' }}>{doldur(t.cihazYasi.partiBitti, { n: partiBiten })}</div>
          <div style={{ fontSize: '0.86rem', color: '#6b7280', marginBottom: '1rem' }}>
            {sayac.kalan > 0 ? doldur(t.cihazYasi.partiKalan, { n: sayac.kalan }) : t.cihazYasi.hepsiTamam}
          </div>
          {sayac.kalan > 0 && (
            <button type="button" className="btn-primary" onClick={yukle}>{t.cihazYasi.sonrakiParti}</button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.83rem', color: '#6b7280' }}>
            <span>{t.cihazYasi.partideKalanOn} <b>{rows.length}</b> {t.cihazYasi.partideKalanSon}</span>
            <span>{doldur(t.cihazYasi.partiIlerleme, { biten: partiBiten, toplam: partiBaslangic })}</span>
          </div>

          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {rows.map(r => {
              const sinir = r.enGecKurulum ? new Date(r.enGecKurulum) : null;
              const sinirYil = sinir ? sinir.getFullYear() : buYil;
              return (
                <div key={r.id} style={kutu}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.brand} {r.model}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {r.customerName || '—'} · <span style={{ fontFamily: 'monospace' }}>{r.serialNo}</span>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => kaydet([r.id], { unknown: true })}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.45rem',
                        padding: '0.3rem 0.7rem', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem', height: 'fit-content' }}>
                      {t.cihazYasi.bilmiyorum}
                    </button>
                  </div>

                  {/* Kanıt — kendi verisinden çıkan üst sınır */}
                  {sinir && (
                    <div style={{ fontSize: '0.78rem', color: '#0e7490', backgroundColor: '#ecfeff',
                      border: '1px solid #a5f3fc', borderRadius: '0.4rem', padding: '0.3rem 0.55rem',
                      display: 'inline-block', marginBottom: '0.5rem' }}>
                      {doldur(t.cihazYasi.enGecKurulum, { t: b.ayYil(sinir) })}
                      <span style={{ opacity: 0.75 }}>{t.cihazYasi.ilkServisKaydi}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    {yillar.map(y => {
                      const secilebilir = y <= sinirYil;
                      return (
                        <button key={y} type="button" disabled={!secilebilir} style={yilBtn(secilebilir)}
                          onClick={() => kaydet([r.id], { year: y })}>
                          {y}
                        </button>
                      );
                    })}
                    {!eskiYillar && (
                      <button type="button" onClick={() => setEskiYillar(true)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem' }}>
                        {t.cihazYasi.dahaEski}
                      </button>
                    )}
                  </div>

                  {/* Aynı müşterinin diğer cihazları genelde aynı partide kurulmuştur */}
                  {r.musterideBekleyen > 1 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                      {t.cihazYasi.grupOn} <b>{r.musterideBekleyen}</b> {t.cihazYasi.grupOrta}{' '}
                      {yillar.filter(y => y <= sinirYil).slice(0, 5).map(y => (
                        <button key={y} type="button"
                          onClick={() => {
                            const grup = rows.filter(x => x.customerId === r.customerId).map(x => x.id);
                            kaydet(grup, { year: y });
                          }}
                          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.35rem',
                            padding: '0.15rem 0.45rem', margin: '0 0.15rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
