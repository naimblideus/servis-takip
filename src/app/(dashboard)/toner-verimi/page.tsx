'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface Grup {
  anahtar: string;
  marka: string;
  model: string;
  cihaz: number;
  verimli: number;
  sayacli: number;
  mevcutSb: number | null;
  mevcutRenkli: number | null;
}

/**
 * TONER VERİMİ — ürünün en güçlü özelliğini açan tek ekran.
 *
 * ── NEDEN BU EKRAN VAR ────────────────────────────────────────────────
 * Toner tükenme tahmini verim olmadan HİÇ çalışmıyor: `forecastChannel`
 * verim yoksa null dönüyor, yani takip kapalı. Ölçüldü: 854 cihazın
 * 853'ünde verim boş. Sayaç değeri 724 cihazda var, toner değişimi
 * kaydediliyor, altyapının tamamı hazır — eksik olan tek alan bu.
 *
 * Cihaz cihaz doldurmak 854 kayıt demek ve o iş yapılmaz. Verim modelin
 * özelliği: aynı yazıcıya takılan toner hep aynı sayfayı basar. Ekran o
 * yüzden model bazında ve ÇOK CİHAZLI MODEL ÜSTTE — bayi istediği yerde
 * durabiliyor, durduğu yere kadar en çok cihazı açmış oluyor.
 *
 * ── ÖNERİ ÜRETİLMİYOR ─────────────────────────────────────────────────
 * Elimizde model→verim sözlüğü yok. "HP P1102 → 1.600" gibi bir sayı
 * uydurmak, yanlış tahmin üretir; yanlış tahmin bu üründe en pahalı hata,
 * çünkü bayi müşteriye "toneriniz bitmek üzere" der ve değildir. Kutunun
 * üstünde yazan sayı giriliyor, sistem tahmin yürütmüyor.
 */
export default function TonerVerimiSayfasi() {
  const [gruplar, setGruplar] = useState<Grup[]>([]);
  const [ozet, setOzet] = useState<{ model: number; cihaz: number; verimli: number; eksik: number } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState('');
  const [sadeceEksik, setSadeceEksik] = useState(true);
  const [girdi, setGirdi] = useState<Record<string, { sb: string; renkli: string }>>({});
  const [calisan, setCalisan] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<Record<string, string>>({});
  const [hata, setHata] = useState('');

  async function yukle() {
    setYukleniyor(true);
    try {
      const r = await fetch('/api/devices/toner-verimi');
      const j = await r.json();
      if (r.ok) {
        setGruplar(j.gruplar);
        setOzet(j.ozet);
      } else setHata(j.error ?? 'Liste alınamadı');
    } catch {
      setHata('Bağlantı hatası');
    } finally {
      setYukleniyor(false);
    }
  }

  useEffect(() => {
    yukle();
  }, []);

  const gosterilen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase('tr');
    return gruplar.filter((g) => {
      if (sadeceEksik && g.verimli >= g.cihaz) return false;
      if (!q) return true;
      return (g.marka + ' ' + g.model).toLocaleLowerCase('tr').includes(q);
    });
  }, [gruplar, ara, sadeceEksik]);

  /**
   * KÜMÜLATİF KAPSAM: "bu satıra kadar doldurursan kaç cihaz açılır".
   * Bayinin nerede durabileceğini görmesi, listenin uzunluğundan daha
   * önemli — 401 satır gördüğünde vazgeçiyor, "ilk 20 satır 250 cihaz"
   * gördüğünde başlıyor.
   */
  const kumulatif = useMemo(() => {
    let t = 0;
    return gosterilen.map((g) => (t += g.cihaz - g.verimli));
  }, [gosterilen]);

  async function uygula(g: Grup) {
    const v = girdi[g.anahtar] ?? { sb: '', renkli: '' };
    if (!v.sb && !v.renkli) return;
    setCalisan(g.anahtar);
    setHata('');
    try {
      const r = await fetch('/api/devices/toner-verimi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anahtar: g.anahtar, sb: v.sb, renkli: v.renkli }),
      });
      const j = await r.json();
      if (r.ok) {
        setMesaj((m) => ({ ...m, [g.anahtar]: `${j.guncellenen} cihaza yazıldı` }));
        await yukle();
      } else setHata(j.error ?? 'Yazılamadı');
    } catch {
      setHata('Bağlantı hatası');
    } finally {
      setCalisan(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Toner Verimi</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Bir tonerin kaç sayfa bastığını modele bir kez yazın; o modeldeki
            bütün cihazlara uygulanır. <b>Toner tükenme tahmini bu bilgi olmadan
            hiç çalışmıyor.</b>
          </p>
        </div>
        <Link href="/sarf" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Sarf takibi
        </Link>
      </div>

      {ozet && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { ad: 'Verimi tanımlı cihaz', n: ozet.verimli },
            { ad: 'Verimi eksik cihaz', n: ozet.eksik, vurgu: ozet.eksik > 0 },
            { ad: 'Farklı model', n: ozet.model },
          ].map((k) => (
            <div key={k.ad} className="rounded-lg border bg-white p-4">
              <div className={`text-2xl font-bold tabular-nums ${k.vurgu ? 'text-amber-700' : ''}`}>{k.n}</div>
              <div className="text-sm text-gray-600">{k.ad}</div>
            </div>
          ))}
        </div>
      )}

      {hata && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{hata}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={sadeceEksik} onChange={(e) => setSadeceEksik(e.target.checked)} />
          Yalnız eksik olanlar
        </label>
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Marka veya model ara"
          className="ml-auto w-56 rounded border px-3 py-1.5 text-sm"
        />
      </div>

      {yukleniyor ? (
        <p className="mt-6 text-sm text-gray-500">Yükleniyor…</p>
      ) : gosterilen.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
          {sadeceEksik ? 'Eksik model kalmadı — bütün cihazlarda verim tanımlı.' : 'Model bulunamadı.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border bg-white">
          {gosterilen.map((g, i) => {
            const v = girdi[g.anahtar] ?? { sb: '', renkli: '' };
            const eksik = g.cihaz - g.verimli;
            return (
              <li key={g.anahtar} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {g.marka} <span className="font-mono">{g.model}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                    <span className="tabular-nums">{g.cihaz} cihaz</span>
                    {eksik > 0 && <span className="tabular-nums text-amber-700">{eksik} eksik</span>}
                    {/* Sayaç değeri olmayan cihazda verim girilse de tahmin
                        anlam kazanmıyor — bayi bunu önceden bilsin. */}
                    <span className="tabular-nums">{g.sayacli} cihazda sayaç var</span>
                    <span className="tabular-nums text-gray-400">
                      buraya kadar {kumulatif[i]} cihaz açılır
                    </span>
                  </div>
                  {mesaj[g.anahtar] && (
                    <div className="mt-1 text-xs font-medium text-green-700">{mesaj[g.anahtar]}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={v.sb}
                    onChange={(e) => setGirdi((s) => ({ ...s, [g.anahtar]: { ...v, sb: e.target.value } }))}
                    placeholder={g.mevcutSb ? String(g.mevcutSb) : 'S/B sayfa'}
                    aria-label={`${g.marka} ${g.model} siyah beyaz toner verimi`}
                    className="w-28 rounded border px-2 py-1.5 text-sm tabular-nums"
                  />
                  <input
                    inputMode="numeric"
                    value={v.renkli}
                    onChange={(e) => setGirdi((s) => ({ ...s, [g.anahtar]: { ...v, renkli: e.target.value } }))}
                    placeholder={g.mevcutRenkli ? String(g.mevcutRenkli) : 'Renkli'}
                    aria-label={`${g.marka} ${g.model} renkli toner verimi`}
                    className="w-24 rounded border px-2 py-1.5 text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={calisan === g.anahtar || (!v.sb && !v.renkli)}
                    onClick={() => uygula(g)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {calisan === g.anahtar ? '…' : 'Uygula'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Verim, toner kutusunun üstünde yazan sayfa sayısıdır (&ldquo;%5 doluluk&rdquo;).
        Sistem tahmin yürütmez — girdiğiniz sayı kullanılır. Zaten dolu olan
        cihazlara dokunulmaz.
      </p>
    </div>
  );
}
