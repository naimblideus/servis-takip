'use client';

import { useState } from 'react';
import { useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import type { MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { KARGO_OTOMATIK_GITTI, KIRMIZI, MAVI, YESIL, dugme, kodMetni, siparisIslemi, type IslemAdi, type Siparis } from './siparis-ortak';

/**
 * SİPARİŞİN TEK BÜYÜK DÜĞMESİ — o an yapılacak iş (mağazanın hesapladığı
 * `adim`). Mağaza panelindeki sipariş satırının Servis'teki karşılığı: aynı
 * adımlar, aynı sorular; kural ve mesaj mağazadan gelir.
 *
 * İşlem bitince yeni sipariş hâli üst bileşene gider (`onDegisti`): Bugün
 * listesi satırı kapatır ya da sıradaki işe (onay → kargo) geçirir.
 */
export function SiparisEylemi({
  s,
  sm,
  bagli,
  otomatikWa,
  kargoFirmalari,
  onDegisti,
}: {
  s: Siparis;
  sm: MagazaSiparisMetni;
  bagli: boolean;
  otomatikWa: boolean;
  kargoFirmalari: string[];
  onDegisti: (yeni: Siparis, mesaj: string) => void;
}) {
  const b = useBicim();
  const [mesgul, setMesgul] = useState(false);
  const [mesaj, setMesaj] = useState<{ tur: 'ok' | 'uyari' | 'hata'; metin: string } | null>(null);
  const [kargoAcik, setKargoAcik] = useState(false);
  const [firma, setFirma] = useState(s.kargo.firma ?? '');
  const [takip, setTakip] = useState(s.kargo.takip ?? '');
  // Otomatik "hazır" mesajı gitmediyse bayinin kendi WhatsApp'ı yedek yol olur.
  const [hazirYedek, setHazirYedek] = useState(false);

  async function calistir(islem: IslemAdi, basari?: string) {
    setMesgul(true);
    setMesaj(null);
    const r = await siparisIslemi(islem, s.id, islem === 'KARGOYA_VER' ? { firma, takip } : undefined);
    setMesgul(false);
    if (!r.ok) {
      if (islem === 'HAZIR_HABER' && r.hata) {
        setHazirYedek(true);
        setMesaj({ tur: 'uyari', metin: doldur(sm.hataHazir, { sebep: r.hata }) });
      } else {
        setMesaj({ tur: 'hata', metin: r.hata ?? kodMetni(r.kod, sm) });
      }
      // Kural hatası da siparişi değiştirebilir (yetersiz stok → "stok bekliyor").
      if (r.siparis) onDegisti(r.siparis, r.hata ?? '');
      return;
    }
    let metin = r.uyari ? (r.mesaj ?? '') : (basari ?? r.mesaj ?? '');
    if (islem === 'KARGOYA_VER') metin = r.bildirim?.startsWith(KARGO_OTOMATIK_GITTI) ? sm.okKargoOtomatik : sm.okKargoElle;
    setKargoAcik(false);
    setMesaj({ tur: r.uyari ? 'uyari' : 'ok', metin });
    if (r.siparis) onDegisti(r.siparis, metin);
  }

  function odemesizOnayla() {
    if (!window.confirm(bagli ? sm.sorOdemesizBagli : sm.sorOdemesiz)) return;
    void calistir('ONAYLA');
  }

  function hazirHaberVer() {
    if (s.hazirBildirimAt && !window.confirm(doldur(sm.sorHazirTekrar, { t: b.tarihSaat(s.hazirBildirimAt) }))) return;
    void calistir('HAZIR_HABER', sm.okHazir);
  }

  // Dükkândan teslimde "hazır" haberi: kanal açık ve müşteri izin verdiyse
  // platformdan otomatik, değilse bayinin kendi WhatsApp'ı (her zaman çalışır).
  const hazirOtomatik = s.teslimat === 'GEL_AL' && otomatikWa && s.whatsappIzin && !hazirYedek;
  const hazirDugmesi =
    s.teslimat !== 'GEL_AL' ? null : hazirOtomatik ? (
      <button type="button" disabled={mesgul} onClick={hazirHaberVer} style={dugme(MAVI, true)}>
        {s.hazirBildirimAt ? doldur(sm.dHaberVerildi, { t: b.tarihSaat(s.hazirBildirimAt) }) : sm.dHazirHaber}
      </button>
    ) : s.hazirWaLink ? (
      <a href={s.hazirWaLink} target="_blank" rel="noopener noreferrer" style={dugme(MAVI, true)}>
        {sm.dHazirHaber}
      </a>
    ) : null;

  const ana = (etiket: string, islem: IslemAdi, basari?: string) => (
    <button type="button" disabled={mesgul} onClick={() => void calistir(islem, basari)} style={dugme(YESIL)}>
      {mesgul ? sm.isleniyor : etiket}
    </button>
  );

  let dugmeler: React.ReactNode = null;
  switch (s.adim) {
    case 'ONAY':
      dugmeler = ana(s.settleHata ? sm.dTekrarOnayla : sm.dOnayla, 'ONAYLA');
      break;
    case 'ODEME_ONAY':
      dugmeler = (
        <>
          {ana(sm.dOdemeGeldi, 'ODEME_GELDI_ONAYLA')}
          <button type="button" disabled={mesgul} onClick={odemesizOnayla} style={dugme('#6b7280', true)}>
            {sm.dOdemesizOnay}
          </button>
        </>
      );
      break;
    case 'DUKKAN_TESLIM':
      dugmeler = (
        <>
          {hazirDugmesi}
          {ana(sm.dParasiAlindi, 'PARASI_ALINDI_TESLIM')}
        </>
      );
      break;
    case 'KARGO':
      dugmeler = kargoAcik ? null : (
        <>
          <button type="button" disabled={mesgul} onClick={() => setKargoAcik(true)} style={dugme(YESIL)}>
            {sm.dKargoyaVerdim}
          </button>
          <button type="button" disabled={mesgul} onClick={() => void calistir('TESLIM_EDILDI', sm.okTeslim)} style={dugme('#6b7280', true)}>
            {sm.dEldenTeslim}
          </button>
        </>
      );
      break;
    case 'GEL_AL':
      dugmeler = (
        <>
          {hazirDugmesi}
          {ana(sm.dTeslimEdildi, 'TESLIM_EDILDI', sm.okTeslim)}
        </>
      );
      break;
    case 'TEKNISYEN':
    case 'TESLIM':
      dugmeler = ana(sm.dTeslimEdildi, 'TESLIM_EDILDI', sm.okTeslim);
      break;
    case 'KUYRUK':
      dugmeler = <span style={{ color: '#6b7280', fontSize: '0.84rem' }}>{sm.kuyrukNotu}</span>;
      break;
  }

  return (
    <div>
      {dugmeler && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{dugmeler}</div>}

      {s.adim === 'KARGO' && kargoAcik && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem', marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{sm.kargoSoru}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0.5rem 0' }}>
            {kargoFirmalari.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={firma === k}
                onClick={() => setFirma(k)}
                style={{
                  padding: '0.4rem 0.8rem', borderRadius: 999, fontSize: '0.84rem', cursor: 'pointer', minHeight: 36,
                  border: `1px solid ${firma === k ? MAVI : '#d1d5db'}`, background: firma === k ? '#eff6ff' : 'white',
                  color: firma === k ? MAVI : '#111827', fontWeight: firma === k ? 700 : 500,
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder={sm.kargoBaska} aria-label={sm.kargoBaska} maxLength={60} style={girdi} />
          <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginTop: 8 }}>
            {sm.kargoTakip}
            <input value={takip} onChange={(e) => setTakip(e.target.value)} maxLength={60} inputMode="text" style={{ ...girdi, marginTop: 4 }} />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={mesgul} onClick={() => void calistir('KARGOYA_VER')} style={dugme(YESIL)}>
              {mesgul ? sm.isleniyor : sm.kaydet}
            </button>
            <button type="button" disabled={mesgul} onClick={() => setKargoAcik(false)} style={dugme('#6b7280', true)}>
              {sm.vazgec}
            </button>
          </div>
        </div>
      )}

      {mesaj && (
        <p
          role="status"
          style={{
            margin: '0.5rem 0 0', fontSize: '0.84rem',
            color: mesaj.tur === 'ok' ? '#05603a' : mesaj.tur === 'uyari' ? '#93370d' : KIRMIZI,
          }}
        >
          {mesaj.metin}
          {/* Otomatik mesaj gitmediyse aynı yerden bayinin kendi WhatsApp'ı. */}
          {hazirYedek && s.hazirWaLink && (
            <>
              {' '}
              <a href={s.hazirWaLink} target="_blank" rel="noopener noreferrer" style={{ color: MAVI, fontWeight: 600 }}>
                {sm.dMusteriyeYaz} ↗
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

const girdi: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '1rem', background: 'white', color: '#111827', boxSizing: 'border-box',
};
