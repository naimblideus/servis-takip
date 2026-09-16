'use client';

import { useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

/**
 * SAYAÇ GEÇMİŞİ AKTARIMI — göç köprüsünün son parçası.
 *
 * Müşteri ve cihaz aktarılabiliyordu ama sayaç geçmişi aktarılamıyordu.
 * Fark her zaman bir önceki okumaya göre hesaplandığı için, geçmişi olmayan
 * cihazda göçten sonraki İLK okuma zincirin başı sayılır ve farkı sıfır
 * çıkar: bayi göç ettiği ayın bütün sayfalarını kaybeder.
 *
 * Sıra önemli: ÖNCE müşteri/cihaz listesi, SONRA bu. Cihaz yoksa seri no
 * eşleşmez ve satır atlanır — ekranda bunu söylüyoruz.
 */
/** Sunucunun döndürdüğü kodlar; cümleyi ekran kendi dilinde kuruyor. */
const apiHatasi = (t: Sozluk, kod: unknown): string | null => (typeof kod !== 'string' ? null : ({
  YETKI: t.sayacAktar.hataYetki,
  BOS_DOSYA: t.sayacAktar.hataBosDosya,
  SATIR_YOK: t.sayacAktar.hataSatirYok,
  KOLON_EKSIK: t.sayacAktar.hataKolonEksik,
}[kod] ?? null));

const satirHatasi = (t: Sozluk, kod: string): string => ({
  SERI_NO_BOS: t.sayacAktar.satirSeriNoBos,
  TARIH_OKUNAMADI: t.sayacAktar.satirTarihOkunamadi,
  SIYAH_OKUNAMADI: t.sayacAktar.satirSiyahOkunamadi,
  SAYAC_NEGATIF: t.sayacAktar.satirSayacNegatif,
  TARIH_GELECEKTE: t.sayacAktar.satirTarihGelecekte,
  CIHAZ_BULUNAMADI: t.sayacAktar.satirCihazBulunamadi,
  AYNI_TARIH_IKI_KEZ: t.sayacAktar.satirAyniTarih,
}[kod] ?? kod);

export default function SayacGecmisiImport() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [onizleme, setOnizleme] = useState<any>(null);
  const [sonuc, setSonuc] = useState<any>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kodlamaNotu, setKodlamaNotu] = useState<string | null>(null);

  const sec = async (f: File | null) => {
    if (!f) return;
    setHata(null); setSonuc(null); setOnizleme(null); setKodlamaNotu(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setHata(t.excelAktar.csvOlmayanDosya);
      return;
    }
    if (f.size > 15 * 1024 * 1024) { setHata(t.excelAktar.dosyaBuyuk); return; }

    // Excel'in düz "CSV" çıktısı Türkçe'de windows-1254 — UTF-8 varsayarsak
    // seri numaralarındaki Türkçe karakter bozulur ve cihaz eşleşmez.
    const buf = await f.arrayBuffer();
    let metin: string;
    try {
      metin = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      metin = new TextDecoder('windows-1254').decode(buf);
      setKodlamaNotu(t.excelAktar.kodlamaDuzeltildi);
    }
    setCsv(metin); setDosyaAdi(f.name);
    await bak(metin);
  };

  const bak = async (metin: string) => {
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/sayac', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: metin, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) setHata(apiHatasi(t, d.kod) ?? t.excelAktar.okunamadi);
      else setOnizleme(d);
    } catch { setHata(t.excelAktar.sunucuYok); }
    setMesgul(false);
  };

  const aktar = async () => {
    if (!confirm(doldur(t.sayacAktar.onaySorusu, { n: onizleme.yazilacak }))) return;
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/sayac', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok) setHata(apiHatasi(t, d.kod) ?? t.excelAktar.aktarimBasarisiz);
      else setSonuc(d);
    } catch { setHata(t.excelAktar.sunucuYok); }
    setMesgul(false);
  };

  const sifirla = () => { setSonuc(null); setOnizleme(null); setCsv(''); setDosyaAdi(''); };

  // ── Sonuç ──
  if (sonuc) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-green-700 mb-3">{t.sayacAktar.sonucBaslik}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {[
            [t.sayacAktar.yazilanOkuma, sonuc.yazilan, 'text-green-700'],
            [t.sayacAktar.cihaz, sonuc.cihazSayisi, 'text-gray-700'],
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
              <div key={h.satir} className="mt-0.5">{doldur(t.excelAktar.satirNo, { n: h.satir })} ({h.seri || '—'}) {satirHatasi(t, h.hata)}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <a href="/devices" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold no-underline">{t.sayacAktar.cihazlaraGit}</a>
          <button onClick={sifirla} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700">{t.excelAktar.yeniDosya}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100">
        <p className="text-sm text-indigo-900 font-medium">
          {t.sayacAktar.ustBaslik}
        </p>
      </div>

      <div className="p-6">
        {/* Sıra uyarısı: cihaz yoksa eşleşme olmaz, dosya boşuna yüklenir. */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <b>{t.sayacAktar.siraVurgu}</b> {t.sayacAktar.siraOrta}
          <span className="font-semibold"> {t.sayacAktar.siraVurgu2}</span>
        </div>

        <div onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${dosyaAdi ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { sec(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="text-3xl mb-2">{dosyaAdi ? '📄' : '🔢'}</div>
          <p className="font-medium text-gray-700">{dosyaAdi || t.sayacAktar.dosyaSec}</p>
          <p className="text-xs text-gray-400 mt-2">
            {t.devirAktar.gerekenKolonlar} <b>{t.sayacAktar.gerekenKolonlarVurgu}</b> {t.sayacAktar.gerekenKolonlarSon}
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
                [t.sayacAktar.cihaz, onizleme.cihazSayisi, 'text-gray-700'],
                [t.devirAktar.atlanacak, onizleme.hatali, onizleme.hatali ? 'text-amber-700' : 'text-gray-400'],
              ].map(([l, v, c]: any) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            {/* Para uydurmama kuralı: bayi butona basmadan ÖNCE bilsin. */}
            {onizleme.notKod && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                {t.sayacAktar.notFaturalanmis}
              </div>
            )}

            {onizleme.eslesmeyenSeri?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <b>{t.sayacAktar.eslesmeyenBaslik}</b>{' '}
                {onizleme.eslesmeyenSeri.join(', ')}
                <div className="mt-1">{t.sayacAktar.eslesmeyenSon}</div>
              </div>
            )}

            {onizleme.ornek?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.excelAktar.ilkSatirlar}</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {[t.sayacAktar.sutunSeri, t.sayacAktar.sutunTarih, t.sayacAktar.sutunSiyah, t.sayacAktar.sutunRenkli].map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {onizleme.ornek.map((o: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 font-mono">{o.seri}</td>
                          <td className="px-2 py-1.5">{o.tarih}</td>
                          <td className="px-2 py-1.5 font-mono">{o.siyah}</td>
                          <td className="px-2 py-1.5 font-mono">{o.renkli}</td>
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
                  <div key={h.satir} className="mt-0.5">{doldur(t.excelAktar.satirNo, { n: h.satir })} ({h.seri || '—'}) {satirHatasi(t, h.hata)}</div>
                ))}
              </div>
            )}

            <button onClick={aktar} disabled={mesgul || !onizleme.yazilacak}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl font-bold">
              {mesgul ? t.excelAktar.aktariliyor : doldur(t.sayacAktar.okumayiAktar, { n: onizleme.yazilacak })}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {t.sayacAktar.dipnotOn} <b>{t.sayacAktar.dipnotVurgu}</b> {t.sayacAktar.dipnotSon}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
