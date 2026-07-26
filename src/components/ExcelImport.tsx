'use client';

import { useRef, useState } from 'react';

const FIELD_LABEL: Record<string, string> = {
  customerName: 'Müşteri / Firma',
  phone: 'Telefon',
  address: 'Adres',
  taxNo: 'Vergi No',
  brand: 'Marka',
  model: 'Model',
  serialNo: 'Seri No',
  location: 'Konum (kat/oda)',
  counterBlack: 'Sayaç (S/B)',
  counterColor: 'Sayaç (Renkli)',
  isRental: 'Kiralık mı',
  monthlyRent: 'Aylık kira',
  pricePerBlack: 'Sayfa fiyatı (S/B)',
  pricePerColor: 'Sayfa fiyatı (Renkli)',
};
const FIELD_KEYS = Object.keys(FIELD_LABEL);

export default function ExcelImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [encodingNote, setEncodingNote] = useState<string | null>(null);

  const pick = async (f: File | null) => {
    if (!f) return;
    setErr(null); setResult(null); setPreview(null); setEncodingNote(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setErr('Lütfen CSV dosyası seçin. Excel’de: Dosya → Farklı Kaydet → "CSV UTF-8 (virgülle ayrılmış)".');
      return;
    }
    if (f.size > 15 * 1024 * 1024) { setErr('Dosya çok büyük (en fazla 15MB).'); return; }

    // KODLAMA: Excel'in düz "CSV" çıktısı UTF-8 DEĞİL (Türkçe'de windows-1254) — Türkçe karakterler bozulur.
    // Önce katı UTF-8 dene; geçersizse windows-1254'e düş.
    const buf = await f.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      try {
        text = new TextDecoder('windows-1254').decode(buf);
        setEncodingNote('Dosya UTF-8 değildi (Excel’in eski CSV formatı) — Türkçe karakterler otomatik düzeltildi. Önizlemede kontrol edin.');
      } catch {
        text = new TextDecoder('utf-8').decode(buf);
        setEncodingNote('Dosya kodlaması tanınamadı — Türkçe karakterlerde bozulma olabilir. Excel’de "CSV UTF-8" olarak kaydedip tekrar deneyin.');
      }
    }

    setCsv(text); setFileName(f.name);
    await runPreview(text, null);
  };

  const runPreview = async (text: string, map: (string | null)[] | null) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/import/sheet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, mapping: map, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Dosya okunamadı'); if (d.headers) { setPreview(d); setMapping(d.mapping || []); } }
      else { setPreview(d); setMapping(d.mapping || []); }
    } catch { setErr('Sunucuya bağlanılamadı'); }
    setBusy(false);
  };

  const doImport = async () => {
    if (!confirm(`${preview.validRows} satır aktarılacak. Devam edilsin mi?\n\n(Aynı telefon/seri no varsa güncellenir, yenisi eklenmez.)`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/import/sheet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mapping, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || 'Aktarım başarısız');
      else setResult(d);
    } catch { setErr('Sunucuya bağlanılamadı'); }
    setBusy(false);
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
        <h2 className="text-lg font-bold text-green-700 mb-3">✓ Aktarım tamamlandı</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            ['Yeni müşteri', result.customersCreated, 'text-green-700'],
            ['Güncellenen müşteri', result.customersUpdated, 'text-gray-700'],
            ['Yeni cihaz', result.devicesCreated, 'text-green-700'],
            ['Güncellenen cihaz', result.devicesUpdated, 'text-gray-700'],
          ].map(([l, v, c]: any) => (
            <div key={l} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        {(result.skippedInvalid > 0 || result.failed > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">
            {result.skippedInvalid > 0 && <div>{result.skippedInvalid} satır eksik bilgi yüzünden atlandı.</div>}
            {result.failed > 0 && <div>{result.failed} satırda hata oluştu.</div>}
            {(result.failures || []).slice(0, 5).map((f: any) => (
              <div key={f.row} className="text-xs mt-1">Satır {f.row}: {f.error}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <a href="/customers" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold no-underline">Müşterilere git</a>
          <button onClick={() => { setResult(null); setPreview(null); setCsv(''); setFileName(''); }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700">Yeni dosya</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
        <p className="text-sm text-emerald-800 font-medium">
          Elinizdeki müşteri/cihaz listesini aktarın — kolonları sistem kendi tanır, siz sadece kontrol edersiniz.
        </p>
      </div>

      <div className="p-6">
        {/* Dosya seç */}
        <div onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${fileName ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'}`}>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { pick(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="text-3xl mb-2">{fileName ? '📄' : '📊'}</div>
          <p className="font-medium text-gray-700">{fileName || 'CSV dosyasını seçin'}</p>
          <p className="text-xs text-gray-400 mt-2">
            Excel’de: <b>Dosya → Farklı Kaydet → CSV UTF-8</b> · Noktalı virgüllü Türk formatı desteklenir
          </p>
        </div>

        {err && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}
        {encodingNote && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">ℹ️ {encodingNote}</div>}
        {busy && <p className="mt-4 text-sm text-gray-500">Okunuyor…</p>}

        {/* Kolon eşleme + önizleme */}
        {preview?.headers && (
          <div className="mt-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-gray-800">Kolon eşleme</h3>
              <span className="text-xs text-gray-500">
                {preview.totalRows} satır · <b className="text-green-700">{preview.validRows} geçerli</b>
                {preview.invalidRows > 0 && <> · <b className="text-amber-700">{preview.invalidRows} eksik</b></>}
              </span>
            </div>

            <div className="grid gap-2 mb-4">
              {preview.headers.map((h: string, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate" title={h}>
                    <b>{h || `(kolon ${i + 1})`}</b>
                    <span className="text-gray-400 ml-2 text-xs">{preview.sample?.[0] ? '' : ''}</span>
                  </span>
                  <span className="text-gray-400">→</span>
                  <select value={mapping[i] || ''} onChange={(e) => changeMap(i, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white min-w-[170px]">
                    <option value="">— kullanma —</option>
                    {FIELD_KEYS.map((k) => <option key={k} value={k}>{FIELD_LABEL[k]}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Çakışma uyarıları — aktarımdan ÖNCE bilinsin */}
            {preview.warnings?.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <b>Bilmeniz gerekenler:</b>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  {preview.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Örnek satırlar */}
            {preview.sample?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">İlk satırlar (kontrol edin)</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Müşteri', 'Telefon', 'Marka/Model', 'Seri No', 'Konum', 'Sayaç'].map((h) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.errorsSample?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <b>Atlanacak satırlar:</b>
                {preview.errorsSample.slice(0, 5).map((e: any) => (
                  <div key={e.row}>Satır {e.row}: {e.errors.join(', ')}</div>
                ))}
              </div>
            )}

            <button onClick={doImport} disabled={busy || !preview.validRows}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-bold">
              {busy ? 'Aktarılıyor…' : `${preview.validRows} satırı aktar`}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Aynı telefon/seri no zaten varsa <b>güncellenir</b>, kopyası oluşmaz — tekrar çalıştırmak güvenli.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
