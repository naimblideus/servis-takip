'use client';

import { useRef, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

/**
 * CARİ DEVİR — açılış bakiyesi ve geçmiş faturalar.
 *
 * Göçün son parçası. Müşteri, cihaz ve sayaç geçmişi aktarıldıktan sonra
 * bile müşteriler ₺0 borçlu görünüyordu; bayi Muhasebe ekranına güvenmeyip
 * eski programı açık tutuyordu, yani göç aslında olmuyordu.
 *
 * İki yol var ve aynı müşteride İKİSİ BİRDEN kullanılamaz — ikisi de aynı
 * borcu anlatıyor, ikisi de yüklenirse borç ikiye katlanır. Ekranda bunu
 * söylüyoruz; uç nokta da çakışan satırı yazmıyor.
 */

type Tur = 'bakiye' | 'fatura';

const anlatim = (t: Sozluk): Record<Tur, { baslik: string; aciklama: string; kolonlar: string }> => ({
  bakiye: {
    baslik: t.devirAktar.turBakiyeBaslik,
    aciklama: t.devirAktar.turBakiyeAciklama,
    kolonlar: t.devirAktar.turBakiyeKolonlar,
  },
  fatura: {
    baslik: t.devirAktar.turFaturaBaslik,
    aciklama: t.devirAktar.turFaturaAciklama,
    kolonlar: t.devirAktar.turFaturaKolonlar,
  },
});

/** Sunucunun döndürdüğü kodlar; cümleyi ekran kendi dilinde kuruyor. */
const apiHatasi = (t: Sozluk, kod: unknown): string | null => (typeof kod !== 'string' ? null : ({
  YETKI: t.devirAktar.hataYetki,
  TUR_GECERSIZ: t.devirAktar.hataTurGecersiz,
  BOS_DOSYA: t.devirAktar.hataBosDosya,
  DEVIR_TARIHI_OKUNAMADI: t.devirAktar.hataDevirTarihi,
  DEVIR_TARIHI_GELECEK: t.devirAktar.hataDevirTarihiGelecek,
  SATIR_YOK: t.devirAktar.hataSatirYok,
  FATURA_KOLON_EKSIK: t.devirAktar.hataFaturaKolon,
}[kod] ?? null));

const satirHatasi = (t: Sozluk, kod: string): string => ({
  MUSTERI_TELEFON_BOS: t.devirAktar.satirMusteriTelefonBos,
  TUTAR_OKUNAMADI: t.devirAktar.satirTutarOkunamadi,
  FATURA_NO_BOS: t.devirAktar.satirFaturaNoBos,
  TARIH_OKUNAMADI: t.devirAktar.satirTarihOkunamadi,
  TUTAR_SIFIR: t.devirAktar.satirTutarSifir,
  ODENEN_NEGATIF: t.devirAktar.satirOdenenNegatif,
  ODENEN_BUYUK: t.devirAktar.satirOdenenBuyuk,
  TARIH_GELECEKTE: t.devirAktar.satirTarihGelecekte,
  AYNI_ADDA_COK: t.devirAktar.satirAyniAddaCok,
  MUSTERI_BULUNAMADI: t.devirAktar.satirMusteriBulunamadi,
  ACIK_DEVIR_FATURASI: t.devirAktar.satirAcikDevirFaturasi,
  ACILIS_BAKIYESI_VAR: t.devirAktar.satirAcilisBakiyesiVar,
  FATURA_NO_VAR: t.devirAktar.satirFaturaNoVar,
  DOSYADA_TEKRAR_MUSTERI: t.devirAktar.satirTekrarMusteri,
  DOSYADA_TEKRAR_FATURA: t.devirAktar.satirTekrarFatura,
}[kod] ?? kod);

export default function CariDevirImport() {
  const t = useT();
  const b = useBicim();
  const tl = (n: number) => b.para(n ?? 0);
  const ANLATIM = anlatim(t);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tur, setTur] = useState<Tur>('bakiye');
  const [csv, setCsv] = useState('');
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [tarih, setTarih] = useState('');
  const [onizleme, setOnizleme] = useState<any>(null);
  const [sonuc, setSonuc] = useState<any>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kodlamaNotu, setKodlamaNotu] = useState<string | null>(null);

  const sifirla = () => {
    setCsv(''); setDosyaAdi(''); setOnizleme(null); setSonuc(null);
    setHata(null); setKodlamaNotu(null);
  };

  const turDegistir = (y: Tur) => { setTur(y); sifirla(); };

  const sec = async (f: File | null) => {
    if (!f) return;
    setHata(null); setSonuc(null); setOnizleme(null); setKodlamaNotu(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setHata(t.excelAktar.csvOlmayanDosya);
      return;
    }
    if (f.size > 15 * 1024 * 1024) { setHata(t.excelAktar.dosyaBuyuk); return; }

    // Excel'in düz "CSV" çıktısı Türkçe'de windows-1254; UTF-8 varsayarsak
    // müşteri adları bozulur ve eşleşme tutmaz.
    const buf = await f.arrayBuffer();
    let metin: string;
    try {
      metin = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      metin = new TextDecoder('windows-1254').decode(buf);
      setKodlamaNotu(t.excelAktar.kodlamaDuzeltildi);
    }
    setCsv(metin); setDosyaAdi(f.name);
    await bak(metin, tarih);
  };

  const bak = async (metin: string, devirTarihi: string) => {
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/devir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: metin, tur, tarih: devirTarihi || undefined, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) setHata(apiHatasi(t, d.kod) ?? t.devirAktar.okunamadi);
      else setOnizleme(d);
    } catch { setHata(t.excelAktar.sunucuYok); }
    setMesgul(false);
  };

  const aktar = async () => {
    if (!confirm(doldur(t.devirAktar.onaySorusu, { n: onizleme.yazilacak, m: tl(onizleme.borcToplam) }))) return;
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/devir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, tur, tarih: tarih || undefined, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok) setHata(apiHatasi(t, d.kod) ?? t.devirAktar.aktarimBasarisiz);
      else setSonuc(d);
    } catch { setHata(t.excelAktar.sunucuYok); }
    setMesgul(false);
  };

  // ── Sonuç ──
  if (sonuc) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-green-700 mb-3">{t.devirAktar.sonucBaslik}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            [t.devirAktar.yazilanKayit, sonuc.yazilan, 'text-green-700'],
            [t.devirAktar.musteriSayisi, sonuc.musteriSayisi, 'text-gray-700'],
            [t.devirAktar.devredenBorc, tl(sonuc.borcToplam), 'text-gray-900'],
            [t.devirAktar.atlananSatir, sonuc.hatali, sonuc.hatali ? 'text-amber-700' : 'text-gray-400'],
          ].map(([l, v, c]: any) => (
            <div key={l} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        {sonuc.hatalar?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
            <b>{t.excelAktar.atlanacakSatirlar}</b>
            {sonuc.hatalar.slice(0, 8).map((h: any) => (
              <div key={h.satir} className="mt-0.5">{doldur(t.excelAktar.satirNo, { n: h.satir })} ({h.musteri || '—'}) {satirHatasi(t, h.hata)}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <a href="/accounting" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold no-underline">{t.devirAktar.muhasebeyeGit}</a>
          <button onClick={sifirla} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700">{t.excelAktar.yeniDosya}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <p className="text-sm text-amber-900 font-medium">
          {t.devirAktar.ustBaslik}
        </p>
      </div>

      <div className="p-6">
        {/* İki yol, ikisi birden DEĞİL. Bu uyarı butondan önce geliyor:
            seçim yapıldıktan sonra okumak geç olur. */}
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
          <b>{t.devirAktar.cakismaVurgu}</b> {t.devirAktar.cakismaOrta}{' '}
          <b>{t.devirAktar.cakismaVurgu2}</b>{t.devirAktar.cakismaSon}
        </div>

        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
          {(['bakiye', 'fatura'] as Tur[]).map((y) => (
            <button key={y} onClick={() => turDegistir(y)}
              className={`text-left p-3 rounded-xl border-2 transition
                ${tur === y ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="font-semibold text-sm text-gray-800">{ANLATIM[y].baslik}</div>
              <div className="text-xs text-gray-500 mt-1">{ANLATIM[y].aciklama}</div>
            </button>
          ))}
        </div>

        {tur === 'bakiye' && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t.devirAktar.devirTarihi}</label>
            <input type="date" value={tarih}
              onChange={(e) => { setTarih(e.target.value); if (csv) bak(csv, e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">
              {t.devirAktar.devirTarihiIpucu}
            </p>
          </div>
        )}

        <div onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${dosyaAdi ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'}`}>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { sec(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="text-3xl mb-2">{dosyaAdi ? '📄' : '💰'}</div>
          <p className="font-medium text-gray-700">{dosyaAdi || t.excelAktar.csvSecin}</p>
          <p className="text-xs text-gray-400 mt-2">
            {t.devirAktar.gerekenKolonlar} <b>{ANLATIM[tur].kolonlar}</b>
          </p>
        </div>

        {hata && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{hata}</div>}
        {kodlamaNotu && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">ℹ️ {kodlamaNotu}</div>}
        {mesgul && <p className="mt-4 text-sm text-gray-500">{t.excelAktar.okunuyor}</p>}

        {onizleme && (
          <div className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                [t.devirAktar.dosyadakiSatir, onizleme.toplamSatir, 'text-gray-700'],
                [t.devirAktar.aktarilacak, onizleme.yazilacak, 'text-green-700'],
                [t.devirAktar.devredenBorc, tl(onizleme.borcToplam), 'text-gray-900'],
                [t.devirAktar.atlanacak, onizleme.hatali, onizleme.hatali ? 'text-amber-700' : 'text-gray-400'],
              ].map(([l, v, c]: any) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            {onizleme.notKod && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                {onizleme.notKod === 'BAKIYE' ? t.devirAktar.notBakiye : t.devirAktar.notFatura}
              </div>
            )}

            {onizleme.eslesmeyenMusteri?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <b>{t.devirAktar.eslesmeyenBaslik}</b> {onizleme.eslesmeyenMusteri.join(', ')}
                <div className="mt-1">{t.devirAktar.eslesmeyenSon}</div>
              </div>
            )}

            {onizleme.ornek?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.excelAktar.ilkSatirlar}</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {(tur === 'bakiye'
                          ? [t.devirAktar.sutunMusteri, t.devirAktar.sutunBakiye]
                          : [t.devirAktar.sutunMusteri, t.devirAktar.sutunFaturaNo, t.devirAktar.sutunTarih, t.devirAktar.sutunTutar, t.devirAktar.sutunOdenen]
                        ).map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {onizleme.ornek.map((o: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1.5">{o.musteri}</td>
                          {tur === 'fatura' && <td className="px-2 py-1.5 font-mono">{o.faturaNo}</td>}
                          {tur === 'fatura' && <td className="px-2 py-1.5">{o.tarih}</td>}
                          <td className="px-2 py-1.5 font-mono">{tl(o.tutar)}</td>
                          {tur === 'fatura' && <td className="px-2 py-1.5 font-mono">{tl(o.odenen)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {onizleme.hatalar?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <b>{t.excelAktar.atlanacakSatirlar}</b>
                {onizleme.hatalar.slice(0, 8).map((h: any) => (
                  <div key={h.satir} className="mt-0.5">{doldur(t.excelAktar.satirNo, { n: h.satir })} ({h.musteri || '—'}) {satirHatasi(t, h.hata)}</div>
                ))}
              </div>
            )}

            <button onClick={aktar} disabled={mesgul || !onizleme.yazilacak}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-xl font-bold">
              {mesgul ? t.excelAktar.aktariliyor : doldur(t.devirAktar.kaydiAktar, { n: onizleme.yazilacak })}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {tur === 'bakiye' ? t.devirAktar.dipnotBakiye : t.devirAktar.dipnotFatura}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
