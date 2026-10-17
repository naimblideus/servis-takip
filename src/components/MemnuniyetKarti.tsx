'use client';

/**
 * "MEMNUNİYET SOR" — teslim edilen fişin ekranında, teknisyenin elinde.
 *
 * Müşteriye tek soru gider: "bizi bir tanıdığınıza tavsiye eder misiniz?"
 * Yeni bir WhatsApp şablonu (Meta onayı) GEREKMEZ, çünkü mesajı biz değil
 * teknisyen gönderir:
 *   · QR — müşteri teknisyenin ekranındakini kendi telefonuyla okutur.
 *   · WhatsApp — teknisyenin kendi WhatsApp'ı, hazır metinle (wa.me).
 *     Demoda bu bağlantı DemoBaglantiKoruma'ya takılır: mesaj gitmez, metin
 *     gösterilir.
 *   · Bağlantıyı kopyala — SMS, e-posta, nereye isterse.
 *
 * Kart açıldığında/gönderildiğinde "soruldu" satırı düşer (puansız); panodaki
 * cevap oranı bununla ölçülür. Fiş başına tek anket: cevap geldiyse kart
 * yalnız cevabı gösterir, yeniden sordurmaz.
 *
 * Mesaj BAYİNİN dilinde (useMusteriDili): İngilizce arayüz kullanan
 * çalışanın düğmesi Türk müşteriye İngilizce mesaj göndermesin.
 */
import { useState, useSyncExternalStore } from 'react';
import { useT, useBicim, useMusteriDili } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { waUrl, waGecerliMi } from '@/lib/share';
import { puanSinifi, kanalMi } from '@/lib/memnuniyet';

export interface KartAnketi {
  puan: number | null;
  yorum: string | null;
  kanal: string | null;
  gonderildiAt: string;
  cevaplandiAt: string | null;
}

interface Props {
  ticketId: string;
  /** /anket/<fiş>?t=… — mutlak adres tarayıcının kendi kökünden kurulur. */
  yol: string;
  musteriAdi: string | null;
  musteriTelefon: string | null;
  cihazAdi: string;
  bayiAdi: string | null;
  anket: KartAnketi | null;
  /** Aynı müşteriye son 30 günde BAŞKA bir fişte soruldu mu (gün). */
  sonSorulmaGun: number | null;
}

const bosAbone = () => () => {};

const SINIF_RENGI = {
  TAVSIYE: { zemin: '#E7F6EF', yazi: '#096847' },
  KARARSIZ: { zemin: '#F1F4F9', yazi: '#33405C' },
  MEMNUN_DEGIL: { zemin: '#FDECEC', yazi: '#962929' },
} as const;

export default function MemnuniyetKarti({
  ticketId, yol, musteriAdi, musteriTelefon, cihazAdi, bayiAdi, anket: ilkAnket, sonSorulmaGun,
}: Props) {
  const t = useT();
  const m = t.memnuniyet;
  const b = useBicim();
  const musteri = useMusteriDili();
  // Sunucuda kök bilinmez; tarayıcıda okunur. Effect'siz: ilk boyamada boş,
  // canlanınca dolu (WhatsApp düğmesi ancak o zaman bağlantı taşır).
  const kok = useSyncExternalStore(bosAbone, () => window.location.origin, () => '');
  const tamAdres = kok ? `${kok}${yol}` : '';

  const [anket, setAnket] = useState<KartAnketi | null>(ilkAnket);
  const [qr, setQr] = useState<string | null>(null);
  const [qrAcik, setQrAcik] = useState(false);
  const [qrHata, setQrHata] = useState(false);
  const [kopya, setKopya] = useState<'YOK' | 'TAMAM' | 'ELLE'>('YOK');
  const [hata, setHata] = useState<string | null>(null);

  /** "Soruldu" kaydı. Başarısız olursa müşteri yine okutabilir; yalnız sayım eksik kalır, bu yüzden söylenir. */
  const kaydet = async (kanal: 'YERINDE' | 'WHATSAPP' | null) => {
    try {
      const r = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/memnuniyet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanal }),
        // WhatsApp sekmesi açılırken istek yarıda kesilmesin.
        keepalive: true,
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.anket) { setAnket(d.anket); setHata(null); }
      else if (!r.ok) setHata(doldur(m.kaydedilemedi, { n: d?.error || t.genel.hata }));
    } catch {
      setHata(doldur(m.kaydedilemedi, { n: t.genel.baglantiHatasi }));
    }
  };

  const qrAcKapa = async () => {
    if (qrAcik) { setQrAcik(false); return; }
    setQrAcik(true);
    void kaydet('YERINDE');
    if (qr || !tamAdres) return;
    try {
      // Kütüphane yalnız QR istenince yüklenir: fiş ekranı her açılışta taşımasın.
      const kutuphane = await import('qrcode');
      const QR = (kutuphane as unknown as { default?: typeof kutuphane }).default ?? kutuphane;
      const svg = await QR.toString(tamAdres, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      setQrHata(false);
    } catch {
      setQrHata(true);
    }
  };

  const kopyala = async () => {
    if (!tamAdres) return;
    void kaydet(null);
    try {
      await navigator.clipboard.writeText(tamAdres);
      setKopya('TAMAM');
    } catch {
      // Şifresiz bağlantıda (http) pano kapalı: adresi seçilebilir göster.
      setKopya('ELLE');
    }
  };

  const mesaj = [
    musteriAdi ? doldur(musteri.sz.musteriMesaji.sayin, { ad: musteriAdi }) : musteri.sz.musteriMesaji.merhaba,
    doldur(musteri.sz.memnuniyet.waGovde, { cihaz: cihazAdi }),
    tamAdres,
    ...(bayiAdi ? ['', bayiAdi] : []),
  ].join('\n');

  const cevapli = anket !== null && anket.puan !== null;
  const kanalAdi = (k: string | null) => (kanalMi(k) ? m.kanal[k] : m.kanal.BAGLANTI);

  const dugme: React.CSSProperties = { minHeight: 44, flex: '1 1 12rem', fontSize: '0.92rem' };

  return (
    <section className="card" style={{ marginBottom: '1rem' }} aria-labelledby="memnuniyet-baslik">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 id="memnuniyet-baslik" style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>⭐ {m.kartBaslik}</h2>
        {anket && !cevapli && (
          <span className="badge" style={{ background: '#FCF3E4', color: '#B0721F' }}>{m.bekliyor}</span>
        )}
      </div>

      {cevapli ? (
        (() => {
          const puan = anket!.puan as number;
          const sinif = puanSinifi(puan);
          const renk = SINIF_RENGI[sinif];
          return (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ background: renk.zemin, color: renk.yazi, fontWeight: 800, fontSize: '1.35rem', borderRadius: 12, padding: '0.3rem 0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                  {`${puan}/10`}
                </span>
                <span style={{ fontWeight: 600 }}>{doldur(m.cevapVerdi, { p: puan })}</span>
                <span style={{ color: renk.yazi, fontSize: '0.85rem', fontWeight: 600 }}>{m.sinif[sinif]}</span>
              </div>
              {anket!.yorum && (
                <blockquote style={{ margin: '0.7rem 0 0', padding: '0.6rem 0.8rem', background: '#F8FAFC', borderLeft: '3px solid #CFD7E4', borderRadius: 8, color: '#33405C', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {anket!.yorum}
                </blockquote>
              )}
              {anket!.cevaplandiAt && (
                <div style={{ color: '#6C7A93', fontSize: '0.78rem', marginTop: '0.5rem' }}>{b.tarihSaat(anket!.cevaplandiAt)}</div>
              )}
            </div>
          );
        })()
      ) : (
        <>
          <p style={{ color: '#53617B', fontSize: '0.88rem', lineHeight: 1.5, margin: '0.4rem 0 0.8rem' }}>{m.kartAlt}</p>

          {anket && (
            <p style={{ color: '#6C7A93', fontSize: '0.8rem', margin: '0 0 0.7rem' }}>
              {`${b.tarihSaat(anket.gonderildiAt)} · ${kanalAdi(anket.kanal)}`}
            </p>
          )}

          {/* Aynı müşteriye sık sormak onu yorar: engellemiyoruz, söylüyoruz. */}
          {!anket && sonSorulmaGun !== null && (
            <p style={{ background: '#FCF3E4', color: '#7A4F12', borderRadius: 10, padding: '0.55rem 0.75rem', fontSize: '0.82rem', lineHeight: 1.45, margin: '0 0 0.75rem' }}>
              {sonSorulmaGun === 0 ? m.sonSorulmaBugun : doldur(m.sonSorulma, { n: sonSorulmaGun })}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={qrAcKapa} className="btn-primary" style={dugme} aria-expanded={qrAcik}>
              {qrAcik ? m.qrKapat : m.qrGoster}
            </button>
            {waGecerliMi(musteriTelefon) && (
              tamAdres ? (
                <a href={waUrl(musteriTelefon, mesaj)} target="_blank" rel="noreferrer" onClick={() => { void kaydet('WHATSAPP'); }}
                  className="btn-secondary" style={{ ...dugme, color: '#096847', borderColor: '#9FD9BF' }}>
                  {m.waGonder}
                </a>
              ) : (
                <button type="button" disabled className="btn-secondary" style={dugme}>{m.waGonder}</button>
              )
            )}
            <button type="button" onClick={kopyala} disabled={!tamAdres} className="btn-secondary" style={dugme}>
              {kopya === 'TAMAM' ? m.kopyalandi : m.kopyala}
            </button>
          </div>

          {qrAcik && (
            <div style={{ marginTop: '0.9rem', textAlign: 'center' }}>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={m.qrAlt} style={{ width: 'min(72vw, 260px)', height: 'auto', aspectRatio: '1 / 1', background: '#fff', border: '1px solid #E4E9F1', borderRadius: 12, padding: 8 }} />
              ) : qrHata ? (
                <p role="alert" style={{ color: '#B93333', fontSize: '0.88rem' }}>{m.qrUretilemedi}</p>
              ) : (
                <div style={{ width: 'min(72vw, 260px)', aspectRatio: '1 / 1', margin: '0 auto', background: '#F1F4F9', borderRadius: 12 }} />
              )}
              <p style={{ color: '#33405C', fontSize: '0.9rem', margin: '0.5rem 0 0', fontWeight: 600 }}>{m.qrAlt}</p>
            </div>
          )}

          {kopya === 'ELLE' && tamAdres && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ color: '#53617B', fontSize: '0.82rem', margin: '0 0 0.3rem' }}>{m.kopyalaElle}</p>
              <input readOnly value={tamAdres} onFocus={(e) => e.currentTarget.select()}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.7rem', border: '1px solid #CFD7E4', borderRadius: 10, fontSize: '16px', fontFamily: 'monospace' }} />
            </div>
          )}
        </>
      )}

      {hata && <p role="alert" style={{ color: '#B93333', fontSize: '0.82rem', margin: '0.6rem 0 0' }}>{hata}</p>}
    </section>
  );
}
