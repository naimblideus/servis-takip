'use client';

import { useRef, useState } from 'react';

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

const ANLATIM: Record<Tur, { baslik: string; aciklama: string; kolonlar: string }> = {
  bakiye: {
    baslik: 'Sadece bakiye',
    aciklama: 'Elinde müşteri başına tek bir borç rakamı var (eski programın "cari bakiye" raporu).',
    kolonlar: 'Müşteri (ya da Telefon) · Bakiye',
  },
  fatura: {
    baslik: 'Fatura fatura',
    aciklama: 'Elinde geçmiş faturaların listesi var; açık borç bunlardan kendiliğinden çıkar.',
    kolonlar: 'Müşteri (ya da Telefon) · Fatura No · Tarih · Tutar · Ödenen',
  },
};

const tl = (n: number) =>
  `₺${(n ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CariDevirImport() {
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
      setHata('Lütfen CSV dosyası seçin. Excel’de: Dosya → Farklı Kaydet → "CSV UTF-8".');
      return;
    }
    if (f.size > 15 * 1024 * 1024) { setHata('Dosya çok büyük (en fazla 15MB).'); return; }

    // Excel'in düz "CSV" çıktısı Türkçe'de windows-1254; UTF-8 varsayarsak
    // müşteri adları bozulur ve eşleşme tutmaz.
    const buf = await f.arrayBuffer();
    let metin: string;
    try {
      metin = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      metin = new TextDecoder('windows-1254').decode(buf);
      setKodlamaNotu('Dosya UTF-8 değildi (Excel’in eski CSV formatı) — Türkçe karakterler otomatik düzeltildi.');
    }
    setCsv(metin); setDosyaAdi(f.name);
    await bak(metin, tarih);
  };

  const bak = async (metin: string, t: string) => {
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/devir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: metin, tur, tarih: t || undefined, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) setHata(d.error || 'Dosya okunamadı');
      else setOnizleme(d);
    } catch { setHata('Sunucuya bağlanılamadı'); }
    setMesgul(false);
  };

  const aktar = async () => {
    if (!confirm(
      `${onizleme.yazilacak} kayıt aktarılacak, toplam ${tl(onizleme.borcToplam)} borç.\n\n`
      + 'Bu kayıtlar GELİR YAZMAZ — devreden bakiyedir, satış değil. Devam edilsin mi?',
    )) return;
    setMesgul(true); setHata(null);
    try {
      const r = await fetch('/api/import/devir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, tur, tarih: tarih || undefined, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok) setHata(d.error || 'Aktarım başarısız');
      else setSonuc(d);
    } catch { setHata('Sunucuya bağlanılamadı'); }
    setMesgul(false);
  };

  // ── Sonuç ──
  if (sonuc) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-green-700 mb-3">✓ Devir aktarıldı</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            ['Yazılan kayıt', sonuc.yazilan, 'text-green-700'],
            ['Müşteri', sonuc.musteriSayisi, 'text-gray-700'],
            ['Devreden borç', tl(sonuc.borcToplam), 'text-gray-900'],
            ['Atlanan satır', sonuc.hatali, sonuc.hatali ? 'text-amber-700' : 'text-gray-400'],
          ].map(([l, v, c]: any) => (
            <div key={l} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{l}</div>
              <div className={`text-xl font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        {sonuc.hatalar?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
            <b>Atlanan satırlar:</b>
            {sonuc.hatalar.slice(0, 8).map((h: any) => (
              <div key={h.satir} className="mt-0.5">Satır {h.satir} ({h.musteri || '—'}): {h.hata}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <a href="/accounting" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold no-underline">Muhasebeye git</a>
          <button onClick={sifirla} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700">Yeni dosya</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <p className="text-sm text-amber-900 font-medium">
          Müşterilerin göç anındaki borcunu aktarın — ilk gün herkes ₺0 borçlu görünmesin.
        </p>
      </div>

      <div className="p-6">
        {/* İki yol, ikisi birden DEĞİL. Bu uyarı butondan önce geliyor:
            seçim yapıldıktan sonra okumak geç olur. */}
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
          <b>Bir müşteri için ikisinden yalnız birini kullanın.</b> İkisi de aynı borcu
          anlatır; ikisi birden yüklenirse müşteri <b>iki kat borçlu</b> görünür.
          Sistem çakışan satırı yazmaz ve size söyler.
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Devir tarihi</label>
            <input type="date" value={tarih}
              onChange={(e) => { setTarih(e.target.value); if (csv) bak(csv, e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">
              Eski programdan çıkış tarihiniz. Boş bırakırsanız bugün kullanılır.
            </p>
          </div>
        )}

        <div onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
            ${dosyaAdi ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'}`}>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { sec(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="text-3xl mb-2">{dosyaAdi ? '📄' : '💰'}</div>
          <p className="font-medium text-gray-700">{dosyaAdi || 'CSV dosyasını seçin'}</p>
          <p className="text-xs text-gray-400 mt-2">
            Gereken kolonlar: <b>{ANLATIM[tur].kolonlar}</b>
          </p>
        </div>

        {hata && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{hata}</div>}
        {kodlamaNotu && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">ℹ️ {kodlamaNotu}</div>}
        {mesgul && <p className="mt-4 text-sm text-gray-500">Okunuyor…</p>}

        {onizleme && (
          <div className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                ['Dosyadaki satır', onizleme.toplamSatir, 'text-gray-700'],
                ['Aktarılacak', onizleme.yazilacak, 'text-green-700'],
                ['Devreden borç', tl(onizleme.borcToplam), 'text-gray-900'],
                ['Atlanacak', onizleme.hatali, onizleme.hatali ? 'text-amber-700' : 'text-gray-400'],
              ].map(([l, v, c]: any) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500">{l}</div>
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            {onizleme.not && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                {onizleme.not}
              </div>
            )}

            {onizleme.eslesmeyenMusteri?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <b>Sistemde bulunamayan müşteriler:</b> {onizleme.eslesmeyenMusteri.join(', ')}
                <div className="mt-1">Önce müşteri listenizi aktarın, sonra bu dosyayı tekrar yükleyin.</div>
              </div>
            )}

            {onizleme.ornek?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">İlk satırlar (kontrol edin)</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {(tur === 'bakiye'
                          ? ['Müşteri', 'Bakiye']
                          : ['Müşteri', 'Fatura No', 'Tarih', 'Tutar', 'Ödenen']
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
                <b>Atlanacak satırlar:</b>
                {onizleme.hatalar.slice(0, 8).map((h: any) => (
                  <div key={h.satir} className="mt-0.5">Satır {h.satir} ({h.musteri || '—'}): {h.hata}</div>
                ))}
              </div>
            )}

            <button onClick={aktar} disabled={mesgul || !onizleme.yazilacak}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-xl font-bold">
              {mesgul ? 'Aktarılıyor…' : `${onizleme.yazilacak} kaydı aktar`}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {tur === 'bakiye'
                ? 'Aynı dosyayı tekrar yüklerseniz borç ikiye katlanmaz — mevcut açılış kaydı güncellenir.'
                : 'Aktarılan faturalar e-Fatura ekranında gönderilecekler arasında çıkmaz.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
