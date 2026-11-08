'use client';

import { useRef, useState } from 'react';
import { useT, useBicim, useDil } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { xlsxOku, xlsxSayfalari, satirlarCsv } from '@/lib/xlsx-oku';
import { eskiXlsMi, metinTablosu, metniCoz, zipMi } from '@/lib/tablo-metin';
import { sablonCsv } from '@/lib/ice-aktar-sablon';
import { yedekli } from '@/lib/sozluk-yedek';

const alanEtiketleri = (t: Sozluk): Record<string, string> => ({
  customerName: t.excelAktar.alanMusteri,
  phone: t.excelAktar.alanTelefon,
  address: t.excelAktar.alanAdres,
  taxNo: t.excelAktar.alanVergiNo,
  // Fatura kimliği: defterdeki adla faturaya yazılan ad aynı şey değil.
  legalName: t.excelAktar.alanUnvan,
  taxOffice: t.excelAktar.alanVergiDairesi,
  city: t.excelAktar.alanIl,
  district: t.excelAktar.alanIlce,
  brand: t.excelAktar.alanMarka,
  model: t.excelAktar.alanModel,
  serialNo: t.excelAktar.alanSeriNo,
  location: t.excelAktar.alanKonum,
  counterBlack: t.excelAktar.alanSayacSb,
  counterColor: t.excelAktar.alanSayacRenkli,
  isRental: t.excelAktar.alanKiralik,
  monthlyRent: t.excelAktar.alanKira,
  pricePerBlack: t.excelAktar.alanFiyatSb,
  pricePerColor: t.excelAktar.alanFiyatRenkli,
  includedBlack: t.excelAktar.alanDahilSb,
  includedColor: t.excelAktar.alanDahilRenkli,
  overagePriceBlack: t.excelAktar.alanAsimSb,
  overagePriceColor: t.excelAktar.alanAsimRenkli,
  installedAt: t.excelAktar.alanKurulumTarihi,
  lastInvoicedPeriod: t.excelAktar.alanSonFatura,
});

/** Sunucunun döndürdüğü kodları kullanıcının dilinde cümleye çevirir. */
const apiHatasi = (t: Sozluk, kod: unknown): string | null => (typeof kod !== 'string' ? null : ({
  YETKI: t.excelAktar.hataYetki,
  BOS_DOSYA: t.excelAktar.hataBosDosya,
  SATIR_YOK: t.excelAktar.hataSatirYok,
  KOLON_TANINMADI: t.excelAktar.hataKolonTaninmadi,
  GECERLI_SATIR_YOK: t.excelAktar.hataGecerliSatirYok,
  MUSTERI_BULUNAMADI: t.excelAktar.hataMusteriBulunamadi,
}[kod] ?? null));

const satirHatasi = (t: Sozluk, kod: string): string => ({
  MUSTERI_ADI_BOS: t.excelAktar.satirHataMusteriAdi,
  TELEFON_BOS: t.excelAktar.satirHataTelefon,
  CIHAZ_BILGISI_YOK: t.excelAktar.satirHataCihaz,
}[kod] ?? kod);

const uyariMetni = (t: Sozluk, u: { kod: string; n: number; ornek?: string; isimler?: string }): string => {
  const d = { n: u.n, ornek: u.ornek ?? '', isimler: u.isimler ?? '' };
  if (u.kod === 'TELEFON_CAKISMASI') return doldur(t.excelAktar.uyariTelefonCakismasi, d);
  if (u.kod === 'SERI_CAKISMASI') return doldur(t.excelAktar.uyariSeriCakismasi, d);
  if (u.kod === 'SERI_NO_YOK') return doldur(t.excelAktar.uyariSeriNoYok, d);
  if (u.kod === 'KIRA_YOK') return doldur(t.excelAktar.uyariKiraYok, d);
  if (u.kod === 'DAHIL_FIYATSIZ') return doldur(t.excelAktar.uyariDahilFiyatsiz, d);
  if (u.kod === 'TARIH_OKUNAMADI') return doldur(t.excelAktar.uyariTarihOkunamadi, d);
  if (u.kod === 'DONEM_OKUNAMADI') return doldur(t.excelAktar.uyariDonemOkunamadi, d);
  if (u.kod === 'DONEM_GELECEK') return doldur(t.excelAktar.uyariDonemGelecek, d);
  if (u.kod === 'BASLIK_ASAGIDA') return doldur(t.excelAktar.uyariBaslikAsagida, d);
  if (u.kod === 'MUSTERI_USTTEN') return doldur(t.excelAktar.uyariMusteriUstten, d);
  if (u.kod === 'TELEFON_YOK') return doldur(t.excelAktar.uyariTelefonYok, d);
  return u.kod;
};

type KiraOzeti = { toplam: number; cihaz: number; kirasiz: number; musteriler: { ad: string; cihaz: number; toplam: number }[] };

/**
 * Aylık kira toplamı. Kurulumu biz yaptığımızda bayiye tek soru sorulur:
 * "aylık kira geliriniz aşağı yukarı bu mu?" Tutmazsa bir kolon yanlış
 * eşlenmiştir; ilk fatura kesilmeden yakalanır.
 */
function KiraKutusu({ ozet, t, para }: { ozet: KiraOzeti; t: Sozluk; para: (n: number) => string }) {
  if (!ozet.cihaz && !ozet.kirasiz) return null;
  return (
    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <b>{t.excelAktar.kiraOzetiBaslik}</b>
        <span><b className="text-lg">{para(ozet.toplam)}</b> <span className="text-xs">{doldur(t.excelAktar.kiraOzetiCihaz, { n: ozet.cihaz })}</span></span>
      </div>
      {ozet.kirasiz > 0 && <p className="mt-1 text-xs text-amber-800">{doldur(t.excelAktar.kiraOzetiKirasiz, { n: ozet.kirasiz })}</p>}
      <p className="mt-1 text-xs">{t.excelAktar.kiraOzetiNot}</p>
      {ozet.musteriler.length > 1 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold">{t.excelAktar.kiraOzetiMusteriler}</summary>
          <ul className="mt-1 space-y-0.5">
            {ozet.musteriler.map((m, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{m.ad} <span className="text-emerald-700">· {m.cihaz}</span></span>
                <span className="font-mono shrink-0">{para(m.toplam)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * @param uc         aktarma ucu. Bayinin ekranı `/api/import/sheet`; Nextus
 *                   kurulum ekibi bayi adına `/api/super-admin/kurulum/<id>/ice-aktar`.
 *                   İkisi aynı kuraldan geçer (lib/sayfa-ice-aktar.ts).
 * @param bayiPaneli sonuç ekranındaki "Müşterilere git" bayinin paneline
 *                   götürür; süper admin ekranında anlamsız, gizlenir.
 */
export default function ExcelImport({ uc = '/api/import/sheet', bayiPaneli = true }: { uc?: string; bayiPaneli?: boolean } = {}) {
  const t = useT();
  const b = useBicim();
  const { dil } = useDil();
  const FIELD_LABEL = alanEtiketleri(t);
  const FIELD_KEYS = Object.keys(FIELD_LABEL);
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [encodingNote, setEncodingNote] = useState<string | null>(null);

  // Birden çok sayfalı Excel: hangi sayfanın okunacağını bayi seçer.
  const [xlsxBuf, setXlsxBuf] = useState<ArrayBuffer | null>(null);
  const [sayfalar, setSayfalar] = useState<string[]>([]);
  const [seciliSayfa, setSeciliSayfa] = useState('');

  /**
   * XLSX: bayinin elindeki dosya neredeyse hep bu. "Önce CSV'ye çevirin"
   * demek aktarmamak demekti. Sayfa okunup aynı CSV yoluna veriliyor —
   * sunucu, eşleme ve önizleme CSV ile birebir aynı. Sayı hücreleri Türk
   * biçimine (ondalık virgül) çevrilir: "0.125" binlik sanılıp 125 olmasın.
   */
  const xlsxSayfasiniOku = async (buf: ArrayBuffer, sayfa: string | undefined, ad: string) => {
    let metin: string;
    try {
      metin = satirlarCsv(await xlsxOku(buf, { ondalikVirgul: true, sayfa }));
    } catch {
      setErr(t.excelAktar.okunamadi);
      return;
    }
    if (!metin.trim()) { setErr(t.excelAktar.hataBosDosya); setPreview(null); return; }
    setCsv(metin); setFileName(ad);
    await runPreview(metin, null);
  };

  const sayfaSec = async (sayfa: string) => {
    if (!xlsxBuf) return;
    setSeciliSayfa(sayfa); setErr(null); setResult(null); setPreview(null);
    await xlsxSayfasiniOku(xlsxBuf, sayfa, fileName);
  };

  const pick = async (f: File | null) => {
    if (!f) return;
    setErr(null); setResult(null); setPreview(null); setEncodingNote(null);
    setXlsxBuf(null); setSayfalar([]); setSeciliSayfa('');
    if (!/\.(xlsx|xls|csv|txt|htm|html|xml)$/i.test(f.name)) {
      setErr(yedekli(t.excelAktar, 'desteklenmeyenDosya', t.excelAktar.csvOlmayanDosya));
      return;
    }
    if (f.size > 15 * 1024 * 1024) { setErr(t.excelAktar.dosyaBuyuk); return; }

    // Biçim adından değil İÇERİKTEN anlaşılır: eski programların ".xls"
    // dökümlerinin çoğu aslında HTML tablosu ya da XML 2003 (lib/tablo-metin).
    const buf = await f.arrayBuffer();
    const bayt = new Uint8Array(buf);
    if (zipMi(bayt)) {
      const adlar = await xlsxSayfalari(buf).catch(() => [] as string[]);
      if (adlar.length > 1) { setXlsxBuf(buf); setSayfalar(adlar); setSeciliSayfa(adlar[0]); }
      await xlsxSayfasiniOku(buf, adlar[0], f.name);
      return;
    }
    // Gerçek eski ikili Excel (BIFF) okunamaz: Excel'de .xlsx olarak kaydedilmeli.
    if (eskiXlsMi(bayt)) { setErr(yedekli(t.excelAktar, 'desteklenmeyenDosya', t.excelAktar.csvOlmayanDosya)); return; }
    const tablo = metinTablosu(metniCoz(bayt));
    if (tablo) {
      const metin = satirlarCsv(tablo.satirlar.filter((s) => s.some((h) => h !== '')));
      if (!metin.trim()) { setErr(t.excelAktar.hataBosDosya); return; }
      setCsv(metin); setFileName(f.name);
      await runPreview(metin, null);
      return;
    }

    // KODLAMA: Excel'in düz "CSV" çıktısı UTF-8 DEĞİL (Türkçe'de windows-1254) — Türkçe karakterler bozulur.
    // Önce katı UTF-8 dene; geçersizse windows-1254'e düş.
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      try {
        text = new TextDecoder('windows-1254').decode(buf);
        setEncodingNote(t.excelAktar.kodlamaDuzeltildi);
      } catch {
        text = new TextDecoder('utf-8').decode(buf);
        setEncodingNote(t.excelAktar.kodlamaTaninmadi);
      }
    }

    setCsv(text); setFileName(f.name);
    await runPreview(text, null);
  };

  const runPreview = async (text: string, map: (string | null)[] | null) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(uc, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, mapping: map, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(apiHatasi(t, d.kod) ?? t.excelAktar.okunamadi); if (d.headers) { setPreview(d); setMapping(d.mapping || []); } }
      else { setPreview(d); setMapping(d.mapping || []); }
    } catch { setErr(t.excelAktar.sunucuYok); }
    setBusy(false);
  };

  const doImport = async () => {
    if (!confirm(doldur(t.excelAktar.onaySorusu, { n: preview.validRows }))) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(uc, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mapping, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok) setErr(apiHatasi(t, d.kod) ?? t.excelAktar.aktarimBasarisiz);
      else setResult(d);
    } catch { setErr(t.excelAktar.sunucuYok); }
    setBusy(false);
  };

  /** Örnek şablon — tarayıcıda üretilir (sunucu yok). Başlıklar eşleyicinin tanıdığı yazımlar. */
  const sablonIndir = () => {
    const blob = new Blob([sablonCsv(dil === 'en' ? 'en' : 'tr')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dil === 'en' ? 'customer-device-template.csv' : 'musteri-cihaz-sablonu.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const changeMap = (i: number, v: string) => {
    const next = [...mapping];
    next[i] = v || null;
    // Aynı alan iki kolona atanmasın
    if (v) next.forEach((m, j) => { if (j !== i && m === v) next[j] = null; });
    setMapping(next);
    runPreview(csv, next);
  };

  // ── Sonuç ──
  if (result) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-green-700 mb-3">{t.excelAktar.sonucBaslik}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            [t.excelAktar.yeniMusteri, result.customersCreated, 'text-green-700'],
            [t.excelAktar.guncellenenMusteri, result.customersUpdated, 'text-gray-700'],
            [t.excelAktar.yeniCihaz, result.devicesCreated, 'text-green-700'],
            [t.excelAktar.guncellenenCihaz, result.devicesUpdated, 'text-gray-700'],
          ].map(([l, v, c]: any) => (
            <div key={l} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        {(result.skippedInvalid > 0 || result.failed > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">
            {result.skippedInvalid > 0 && <div>{doldur(t.excelAktar.atlanan, { n: result.skippedInvalid })}</div>}
            {result.failed > 0 && <div>{doldur(t.excelAktar.hataliSatir, { n: result.failed })}</div>}
            {(result.failures || []).slice(0, 5).map((f: any) => (
              <div key={f.row} className="text-xs mt-1">{doldur(t.excelAktar.satirNo, { n: f.row })} {apiHatasi(t, f.kod) ?? f.error}</div>
            ))}
          </div>
        )}
        {result.kiraOzeti && <KiraKutusu ozet={result.kiraOzeti} t={t} para={(n) => b.para(n)} />}
        <div className="flex gap-2 flex-wrap">
          {bayiPaneli && <a href="/customers" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold no-underline">{t.excelAktar.musterilereGit}</a>}
          <button onClick={() => { setResult(null); setPreview(null); setCsv(''); setFileName(''); }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700">{t.excelAktar.yeniDosya}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
        <p className="text-sm text-emerald-800 font-medium">
          {t.excelAktar.ustBaslik}
        </p>
      </div>

      <div className="p-6">
        {/* Dosya seç */}
        <div onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${fileName ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'}`}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt,.htm,.html,.xml" className="hidden"
            onChange={(e) => { pick(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="text-3xl mb-2">{fileName ? '📄' : '📊'}</div>
          <p className="font-medium text-gray-700">{fileName || yedekli(t.excelAktar, 'dosyaSecin', t.excelAktar.csvSecin)}</p>
          <p className="text-xs text-gray-400 mt-2">
            {t.excelAktar.ipucuOn} <b>{t.excelAktar.ipucuVurgu}</b> {t.excelAktar.ipucuSon}
          </p>
        </div>

        {/* Örnek şablon: boş ekranda "hangi kolonlar?" sorusunun cevabı. */}
        <div className="mt-3 text-center">
          <button type="button" onClick={sablonIndir}
            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold hover:bg-emerald-50">
            {yedekli(t.excelAktar, 'sablonIndir', t.genel.excelIndir)}
          </button>
        </div>

        {sayfalar.length > 1 && (
          <label className="mt-4 flex items-center gap-2 flex-wrap text-sm text-gray-700">
            <span className="font-semibold">{doldur(t.excelAktar.sayfaSec, { n: sayfalar.length })}</span>
            <select value={seciliSayfa} disabled={busy} onChange={(e) => sayfaSec(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
              {sayfalar.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        {err && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}
        {encodingNote && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">ℹ️ {encodingNote}</div>}
        {busy && <p className="mt-4 text-sm text-gray-500">{t.excelAktar.okunuyor}</p>}

        {/* Kolon eşleme + önizleme */}
        {preview?.headers && (
          <div className="mt-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-gray-800">{t.excelAktar.kolonEsleme}</h3>
              <span className="text-xs text-gray-500">
                {doldur(t.excelAktar.satirOzeti, { n: preview.totalRows })} <b className="text-green-700">{doldur(t.excelAktar.gecerliSatir, { n: preview.validRows })}</b>
                {preview.invalidRows > 0 && <> · <b className="text-amber-700">{doldur(t.excelAktar.eksikSatir, { n: preview.invalidRows })}</b></>}
              </span>
            </div>

            <div className="grid gap-2 mb-4">
              {preview.headers.map((h: string, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate" title={h}>
                    <b>{h || doldur(t.excelAktar.kolonAdsiz, { n: i + 1 })}</b>
                    <span className="text-gray-400 ml-2 text-xs">{preview.sample?.[0] ? '' : ''}</span>
                  </span>
                  <span className="text-gray-400">→</span>
                  <select value={mapping[i] || ''} onChange={(e) => changeMap(i, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white min-w-[170px]">
                    <option value="">{t.excelAktar.kullanma}</option>
                    {FIELD_KEYS.map((k) => <option key={k} value={k}>{FIELD_LABEL[k]}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Çakışma uyarıları — aktarımdan ÖNCE bilinsin */}
            {preview.warnings?.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <b>{t.excelAktar.bilmenizGerekenler}</b>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  {preview.warnings.map((w: any, i: number) => <li key={i}>{uyariMetni(t, w)}</li>)}
                </ul>
              </div>
            )}

            {preview.kiraOzeti && <KiraKutusu ozet={preview.kiraOzeti} t={t} para={(n) => b.para(n)} />}

            {/* Örnek satırlar */}
            {preview.sample?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.excelAktar.ilkSatirlar}</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* Kiralık + aylık kira kolonları da görünür: eşleme yanlışsa
                            ("Kiralık" kolonu kira tutarı sanılırsa) kiralık filo
                            sessizce kirasız aktarılıyordu — burada fark edilsin. */}
                        {[t.excelAktar.ornekMusteri, t.excelAktar.alanTelefon, t.excelAktar.ornekMarkaModel, t.excelAktar.alanSeriNo, t.excelAktar.alanKonum, t.excelAktar.ornekSayac, t.excelAktar.alanKiralik, t.excelAktar.alanKira, t.excelAktar.ornekDahil].map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.slice(0, 5).map((s: any) => (
                        <tr key={s.row} className={`border-t border-gray-100 ${s.errors?.length ? 'bg-amber-50' : ''}`}>
                          <td className="px-2 py-1.5">{s.customerName || '—'}</td>
                          <td className="px-2 py-1.5 font-mono">{s.phone || '—'}</td>
                          <td className="px-2 py-1.5">{[s.brand, s.model].filter(Boolean).join(' ') || '—'}</td>
                          <td className="px-2 py-1.5 font-mono">{s.serialNo || '—'}</td>
                          <td className="px-2 py-1.5">{s.location || '—'}</td>
                          <td className="px-2 py-1.5 font-mono">{s.counterBlack ?? '—'}</td>
                          <td className="px-2 py-1.5">{s.isRental ? t.genel.evet : t.genel.hayir}</td>
                          <td className="px-2 py-1.5 font-mono">{s.monthlyRent != null ? b.para(Number(s.monthlyRent)) : '—'}</td>
                          <td className="px-2 py-1.5 font-mono">{s.includedBlack != null ? s.includedBlack : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.errorsSample?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <b>{t.excelAktar.atlanacakSatirlar}</b>
                {preview.errorsSample.slice(0, 5).map((e: any) => (
                  <div key={e.row}>{doldur(t.excelAktar.satirNo, { n: e.row })} {e.errors.map((k: string) => satirHatasi(t, k)).join(', ')}</div>
                ))}
              </div>
            )}

            <button onClick={doImport} disabled={busy || !preview.validRows}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-bold">
              {busy ? t.excelAktar.aktariliyor : doldur(t.excelAktar.satiriAktar, { n: preview.validRows })}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {t.excelAktar.tekrarGuvenliOn} <b>{t.excelAktar.tekrarGuvenliVurgu}</b>{t.excelAktar.tekrarGuvenliSon}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
