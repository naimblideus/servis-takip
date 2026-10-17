// Yazdırılabilir + paylaşılabilir EMANET TESLİM TUTANAĞI (tek kaynak: oturumlu
// yazdırma sayfası + imzalı herkese açık bağlantı; bkz. ReceiptDocument).
//
// Belge MÜŞTERİYE verilir: dil BAYİDEN gelir, fiyat ve maliyet basılmaz.
// Hukuki ağırlığı imza kutularında: "kaç toner bıraktık" sorusu aylar sonra
// sözleşme biterken sorulur ve cevabı müşterinin imzasıdır.
import React from 'react';
import { sozluk, doldur, dilMi, VARSAYILAN_DIL, type Dil } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';
import type { EmanetTutanakVerisi } from '@/lib/emanet-veri';

export default function EmanetTutanagi({ v }: { v: EmanetTutanakVerisi }) {
  const dil: Dil = dilMi(v.bayi.dil) ? v.bayi.dil : VARSAYILAN_DIL;
  const S = sozluk(dil).emanet.belge;
  const b = bicimYap(dil);
  const toplam = v.kalemler.reduce((t, k) => t + k.adet, 0);
  return (
    <>
      <style>{`
        @import url('/fonts/inter.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }
        @page { size: A5 portrait; margin: 8mm 10mm; }
        @media print {
          .no-print, #app-sidebar { display: none !important; }
          body { background: white !important; }
          .tutanak-sarmal { padding: 0 !important; background: white !important; }
          .tutanak { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; border: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media screen {
          .tutanak-sarmal { padding: 1.25rem 0.75rem; min-height: 100vh; background: #e5e7eb; }
          .tutanak { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.16); overflow: hidden; border: 1px solid #e5e7eb; }
        }
        .ust { background: #0F2253; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .logo { max-height: 44px; max-width: 120px; object-fit: contain; background: white; border-radius: 8px; padding: 4px 8px; }
        .firma { font-size: 16px; font-weight: 800; }
        .firma-alt { font-size: 11px; opacity: 0.8; margin-top: 2px; }
        .etiket { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; background: rgba(255,255,255,0.18); padding: 2px 8px; border-radius: 4px; display: inline-block; }
        .no { font-size: 12px; margin-top: 5px; font-variant-numeric: tabular-nums; opacity: 0.9; }
        .govde { padding: 16px 20px; }
        h1.baslik { font-size: 15px; font-weight: 800; margin-bottom: 10px; color: #0F2253; }
        .bilgi { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 14px; }
        .satir { display: flex; flex-direction: column; }
        .anahtar { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .deger { font-size: 13px; font-weight: 700; color: #111827; overflow-wrap: anywhere; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 10px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; padding: 7px 8px; border-bottom: 2px solid #d1d5db; background: #f9fafb; }
        td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; }
        .sayi { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
        .toplam td { border-top: 2px solid #d1d5db; font-weight: 800; }
        .not { font-size: 12px; color: #374151; margin: 6px 0; }
        .beyan { font-size: 11.5px; color: #374151; line-height: 1.5; margin: 12px 0 4px; }
        .imzalar { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
        .imza-alan { height: 54px; border-bottom: 2px solid #9ca3af; margin-bottom: 6px; }
        .imza-etiket { font-size: 11px; color: #374151; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }
        .imza-alt { font-size: 10px; color: #6b7280; text-align: center; }
        .alt { text-align: center; font-size: 10px; color: #9ca3af; padding: 10px 20px 14px; border-top: 1px solid #f3f4f6; background: #fafafa; }
      `}</style>
      <div className="tutanak-sarmal" lang={dil}>
        <div className="tutanak">
          <div className="ust">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {v.bayi.logo && <img src={v.bayi.logo} alt="Logo" className="logo" />}
              <div>
                <div className="firma">{v.bayi.ad}</div>
                <div className="firma-alt">{[v.bayi.telefon, v.bayi.adres].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="etiket">{S.etiket}</div>
              <div className="no">{S.no}: {v.no}</div>
            </div>
          </div>
          <div className="govde">
            <h1 className="baslik">{S.baslik}</h1>
            <div className="bilgi">
              <div className="satir"><span className="anahtar">{S.musteri}</span><span className="deger">{v.musteri.ad}</span></div>
              <div className="satir"><span className="anahtar">{S.tarih}</span><span className="deger">{b.tarihSaat(v.tarih)}</span></div>
              {v.musteri.unvan && <div className="satir" style={{ gridColumn: '1 / -1' }}><span className="anahtar">{S.unvan}</span><span className="deger">{v.musteri.unvan}</span></div>}
              {v.musteri.adres && <div className="satir" style={{ gridColumn: '1 / -1' }}><span className="anahtar">{S.adres}</span><span className="deger">{v.musteri.adres}</span></div>}
              {v.teslimEden && <div className="satir"><span className="anahtar">{S.teslimEden}</span><span className="deger">{v.teslimEden}</span></div>}
              {v.cihaz && <div className="satir"><span className="anahtar">{S.cihaz}</span><span className="deger">{v.cihaz}</span></div>}
            </div>
            <table>
              <thead>
                <tr><th style={{ width: 28 }}>{S.sira}</th><th>{S.urun}</th><th style={{ width: 90 }}>{S.kod}</th><th className="sayi" style={{ width: 52 }}>{S.adet}</th></tr>
              </thead>
              <tbody>
                {v.kalemler.map((k, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{k.ad}</td><td>{k.kod ?? '—'}</td><td className="sayi">{k.adet}</td></tr>
                ))}
                <tr className="toplam"><td /><td>{S.toplam}</td><td /><td className="sayi">{toplam}</td></tr>
              </tbody>
            </table>
            {v.bosAdet > 0 && <p className="not">{doldur(S.bosKartus, { n: v.bosAdet })}</p>}
            {v.not && <p className="not"><b>{S.not}:</b> {v.not}</p>}
            <p className="beyan">{doldur(S.beyan, { bayi: v.bayi.ad })}</p>
            <div className="imzalar">
              {[S.teslimEdenImza, S.teslimAlanImza].map((e) => (
                <div key={e}><div className="imza-alan" /><div className="imza-etiket">{e}</div><div className="imza-alt">{S.adSoyad}</div></div>
              ))}
            </div>
          </div>
          <div className="alt">{doldur(S.altbilgi, { bayi: v.bayi.ad, tarih: b.tarih(v.tarih) })}</div>
        </div>
      </div>
    </>
  );
}
