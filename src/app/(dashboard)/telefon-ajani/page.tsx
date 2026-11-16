'use client';

/*
 * TELEFON AJANI — bayinin ekrani.
 *
 * Ustte ajanin biraktigi taslaklar (fisi bayi acar), altta sayac
 * ("ajanin actigi taslak / bayinin onayladigi") ve yoneticiye ayarlar:
 * ac/kapa, asistan adi, aktarma numarasi. Hat numarasini platform ekibi
 * atar (super admin); burada yalniz gorunur.
 */
import { useCallback, useEffect, useState } from 'react';
import AjanTaslaklari from '@/components/AjanTaslaklari';
import { useBicim, useDil } from '@/lib/i18n/client';
import { ajanMetni, doldurMetin, numaraGoster } from '@/lib/telefon-ajani-metin';
import type { HazirlikKodu, KurulumKodu, TaslakSayaci } from '@/lib/telefon-ajani';

interface AyarDurumu {
  acik: boolean;
  asistanAdi: string;
  aktarmaTelefonu: string | null;
  hatNumarasi: string | null;
  kurulu: boolean;
  retellSenkronAt: string | null;
  retellHata: string | null;
  whatsappKurulu: boolean;
  hazirlik: { kod: HazirlikKodu; tamam: boolean }[];
  sayac: { buAy: TaslakSayaci; toplam: TaslakSayaci };
  yonetici: boolean;
}

export default function TelefonAjaniSayfasi() {
  const { dil } = useDil();
  const b = useBicim();
  const m = ajanMetni(dil);

  const [d, setD] = useState<AyarDurumu | null>(null);
  const [ad, setAd] = useState('');
  const [aktarma, setAktarma] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<{ tur: 'ok' | 'uyari' | 'hata'; metin: string } | null>(null);

  const yukle = useCallback(async () => {
    const r = await fetch('/api/telefon-ajani/ayar').catch(() => null);
    if (!r?.ok) return;
    const v = (await r.json()) as AyarDurumu;
    setD(v);
    setAd(v.asistanAdi);
    setAktarma(v.aktarmaTelefonu ?? '');
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const senkronMetni = (s: { ok: boolean; kod?: KurulumKodu } | null | undefined) =>
    s && !s.ok ? `${m.ayar.senkronHata}${s.kod ? ` (${m.kurulum[s.kod]})` : ''}` : null;

  const kaydet = async (govde: Record<string, unknown>, yontem: 'PATCH' | 'POST' = 'PATCH') => {
    setMesgul(true);
    setBilgi(null);
    try {
      const r = await fetch('/api/telefon-ajani/ayar', {
        method: yontem,
        headers: { 'Content-Type': 'application/json' },
        body: yontem === 'PATCH' ? JSON.stringify(govde) : undefined,
      });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBilgi({ tur: 'hata', metin: v.error || m.hata });
        return;
      }
      const uyari = senkronMetni(v.senkron);
      setBilgi(uyari ? { tur: 'uyari', metin: uyari } : { tur: 'ok', metin: m.ayar.kaydedildi });
      await yukle();
    } finally {
      setMesgul(false);
    }
  };

  const kart: React.CSSProperties = {
    background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '1rem 1.15rem', marginBottom: '1rem',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.95rem', boxSizing: 'border-box',
  };
  const etiket: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#4b5563', display: 'block', marginBottom: 4 };
  const dugme = (ana: boolean, renk = '#0f2253'): React.CSSProperties => ({
    padding: '0.55rem 1rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 700,
    cursor: mesgul ? 'wait' : 'pointer', background: ana ? renk : 'white', color: ana ? 'white' : '#374151',
    border: `1px solid ${ana ? renk : '#d1d5db'}`,
  });
  const sesHazir = d ? d.hazirlik.filter((h) => h.kod !== 'WHATSAPP').every((h) => h.tamam) : false;

  const sayacSatiri = (baslik: string, s: TaslakSayaci) => (
    <tr key={baslik}>
      <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>{baslik}</th>
      <td style={{ padding: '6px 8px' }}>{b.sayi(s.acilan)}</td>
      <td style={{ padding: '6px 8px' }}>
        {b.sayi(s.onaylanan)}
        {s.mesajdan > 0 && <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>{` (${doldurMetin(m.sayac.mesajdan, { n: s.mesajdan })})`}</span>}
      </td>
      <td style={{ padding: '6px 8px' }}>{b.sayi(s.reddedilen)}</td>
      <td style={{ padding: '6px 8px' }}>{b.sayi(s.bekleyen)}</td>
    </tr>
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.35rem' }}>{m.baslik}</h1>
      <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: 0, marginBottom: '1rem', lineHeight: 1.6 }}>{m.alt}</p>

      <AjanTaslaklari gecmisVar />

      {d && (
        <section style={kart} aria-label={m.sayac.baslik}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 800 }}>{m.sayac.baslik}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }} />
                  <th style={{ padding: '6px 8px' }}>{m.sayac.acilan}</th>
                  <th style={{ padding: '6px 8px' }}>{m.sayac.onaylanan}</th>
                  <th style={{ padding: '6px 8px' }}>{m.sayac.reddedilen}</th>
                  <th style={{ padding: '6px 8px' }}>{m.sayac.bekleyen}</th>
                </tr>
              </thead>
              <tbody>
                {sayacSatiri(m.sayac.buAy, d.sayac.buAy)}
                {sayacSatiri(m.sayac.toplam, d.sayac.toplam)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {d && (
        <section style={kart} aria-label={m.ayar.baslik}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                {d.acik ? m.ayar.acik : m.ayar.kapali}
              </h2>
              <p style={{ margin: '4px 0 0', color: '#4b5563', fontSize: '0.86rem', lineHeight: 1.5 }}>
                {d.acik ? m.ayar.acikAciklama : m.ayar.kapaliAciklama}
              </p>
            </div>
            {d.yonetici ? (
              <button type="button" disabled={mesgul} onClick={() => kaydet({ acik: !d.acik })}
                style={dugme(true, d.acik ? '#b91c1c' : '#15803d')} aria-pressed={d.acik}>
                {d.acik ? m.ayar.kapat : m.ayar.ac}
              </button>
            ) : (
              <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{m.ayar.yalnizYonetici}</span>
            )}
          </div>

          {bilgi && (
            <div role={bilgi.tur === 'hata' ? 'alert' : 'status'} style={{
              marginTop: 12, borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.86rem',
              background: bilgi.tur === 'ok' ? '#ecfdf5' : bilgi.tur === 'uyari' ? '#fffbeb' : '#fef2f2',
              color: bilgi.tur === 'ok' ? '#065f46' : bilgi.tur === 'uyari' ? '#92400e' : '#991b1b',
            }}>
              {bilgi.metin}
              {bilgi.tur === 'uyari' && d.yonetici && (
                <button type="button" onClick={() => kaydet({}, 'POST')} style={{ ...dugme(false), marginLeft: 8, padding: '2px 8px', fontSize: '0.8rem' }}>
                  {m.ayar.yenidenGonder}
                </button>
              )}
            </div>
          )}

          {d.yonetici && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
              <div>
                <label style={etiket} htmlFor="asistan-adi">{m.ayar.asistanAdi}</label>
                <input id="asistan-adi" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={20} style={inp} />
              </div>
              <div>
                <label style={etiket} htmlFor="aktarma">{m.ayar.aktarma}</label>
                <input id="aktarma" value={aktarma} onChange={(e) => setAktarma(e.target.value)} inputMode="tel" maxLength={20} style={inp} />
                <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: 4, lineHeight: 1.45 }}>{m.ayar.aktarmaIpucu}</div>
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button type="button" disabled={mesgul} onClick={() => kaydet({ asistanAdi: ad, aktarmaTelefonu: aktarma })} style={dugme(true)}>
                  {m.ayar.kaydet}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: '0.88rem' }}>
            <strong>{m.ayar.hat}: </strong>
            {d.hatNumarasi ? doldurMetin(m.ayar.hatVar, { no: hatGoster(d.hatNumarasi) }) : m.ayar.hatYok}
          </div>

          {d.yonetici && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 800 }}>{m.hazirlik.baslik}</h3>
              <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: sesHazir ? '#065f46' : '#92400e' }}>
                {sesHazir ? m.hazirlik.sesHazir : m.hazirlik.sesEksik}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                {d.hazirlik.map((h) => (
                  <li key={h.kod} style={{ fontSize: '0.84rem', display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: h.tamam ? '#15803d' : '#b45309', minWidth: 52 }}>
                      {h.tamam ? m.hazirlik.tamam : m.hazirlik.eksik}
                    </span>
                    <span>{m.hazirlik.kod[h.kod]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** 908501234567 → +90 850 123 45 67; Turkiye disi numara oldugu gibi. */
function hatGoster(hat: string): string {
  if (hat.length === 12 && hat.startsWith('90')) return `+90 ${numaraGoster(hat.slice(2)).slice(1)}`;
  return `+${hat}`;
}
