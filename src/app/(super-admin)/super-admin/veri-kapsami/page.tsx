'use client';

/**
 * VERİ KAPSAMI — süper-admin paneli.
 *
 * Veri katmanının değeri cihaz sayısıyla değil KAPSAMLA büyür:
 *   100.000 cihaz × %5 kategori = çöp
 *    30.000 cihaz × %80 kategori = ürün
 * Bu ekran "hangi bayi veri üretiyor" ve "üretici ürünü ne zaman mümkün olur"
 * sorularını cevaplar.
 */
import { useEffect, useState } from 'react';
import { Database, RefreshCw, Layers, Gauge, AlertTriangle } from 'lucide-react';

interface Satir {
  id: string; ad: string; cihaz: number; fis12Ay: number;
  kategoriPct: number; yasPct: number; sayacPct: number; oemPct: number;
  paydaPct: number; skor: number;
}
interface Veri {
  ag: {
    bayi: number; cihaz: number; fis12Ay: number;
    kategoriPct: number; yasPct: number; sayacPct: number;
    model: number; esigiGecenModel: number; kEsigi: number;
  };
  satirlar: Satir[];
}

const renk = (p: number) =>
  p >= 70 ? 'text-emerald-400' : p >= 35 ? 'text-amber-400' : 'text-red-400';
const bar = (p: number) =>
  p >= 70 ? 'bg-emerald-500' : p >= 35 ? 'bg-amber-500' : 'bg-red-500';

function Bar({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[3rem]">
        <div className={`h-full rounded-full ${bar(p)}`} style={{ width: `${p}%` }} />
      </div>
      <span className={`text-xs tabular-nums w-9 text-right ${renk(p)}`}>%{p}</span>
    </div>
  );
}

export default function VeriKapsamiPage() {
  const [d, setD] = useState<Veri | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/super-admin/data-coverage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Yetki yok veya hata'))))
      .then(setD)
      .catch((e) => setHata(e.message));
  }, []);

  if (hata) return <div className="min-h-screen bg-gray-950 text-red-400 flex items-center justify-center">{hata}</div>;
  if (!d) return <div className="flex items-center justify-center h-screen bg-gray-950"><RefreshCw className="w-7 h-7 animate-spin text-violet-400" /></div>;

  const a = d.ag;
  const kartlar = [
    { l: 'Bayi', v: String(a.bayi), i: Layers, c: 'text-violet-400' },
    { l: 'Cihaz', v: a.cihaz.toLocaleString('tr-TR'), i: Database, c: 'text-blue-400' },
    { l: 'Fiş (12 ay)', v: a.fis12Ay.toLocaleString('tr-TR'), i: Gauge, c: 'text-pink-400' },
    { l: 'Arıza kategorisi', v: '%' + a.kategoriPct, i: Gauge, c: renk(a.kategoriPct) },
    { l: 'Cihaz yaşı', v: '%' + a.yasPct, i: Gauge, c: renk(a.yasPct) },
    { l: 'Sayaç okuması', v: '%' + a.sayacPct, i: Gauge, c: renk(a.sayacPct) },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
        <h1 className="text-xl font-bold flex items-center gap-3 max-w-6xl mx-auto">
          <Database className="w-5 h-5 text-violet-400" /> Veri Kapsamı
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <p className="text-sm text-gray-400 mb-5">
          Veri katmanının değeri cihaz sayısıyla değil <b className="text-gray-200">kapsamla</b> büyür.
          Kapsam düşükse ağ büyüse bile veri satılabilir hale gelmez.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {kartlar.map((c) => (
            <div key={c.l} className="bg-white/3 border border-white/10 rounded-2xl p-4">
              <c.i className={`w-4 h-4 ${c.c} mb-2`} />
              <div className="text-xl font-bold tabular-nums">{c.v}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{c.l}</div>
            </div>
          ))}
        </div>

        {/* Üretici ürünü hazırlığı */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-violet-300 mb-3">Üretici Ürünü Hazırlığı (k-anonimlik)</h3>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <div className="text-2xl font-bold tabular-nums">{a.esigiGecenModel}</div>
              <div className="text-xs text-gray-400">
                model en az {a.kEsigi} bayide görülüyor — <b className="text-gray-200">gösterilebilir satır</b>
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-gray-500">{a.model}</div>
              <div className="text-xs text-gray-400">toplam model</div>
            </div>
          </div>
          {a.esigiGecenModel === 0 && (
            <div className="mt-3 flex gap-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Henüz hiçbir model {a.kEsigi} bayide birden görülmüyor — üretici ucu bugün <b>her satırı bastırıyor</b>.
                Bu doğru davranış: az bayiden gelen veri anonim değildir. Bayi sayısı arttıkça açılır.
              </span>
            </div>
          )}
        </div>

        {/* Bayi bazında */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-violet-300 mb-4">Bayi Bazında Kapsam</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[52rem]">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-white/10">
                  <th className="py-2 pr-3">Bayi</th>
                  <th className="py-2 px-3 text-right">Cihaz</th>
                  <th className="py-2 px-3 text-right">Fiş</th>
                  <th className="py-2 px-3 w-36">Arıza kategorisi</th>
                  <th className="py-2 px-3 w-36">Cihaz yaşı</th>
                  <th className="py-2 px-3 w-36">Sayaç</th>
                  <th className="py-2 px-3 text-right" title="Hiç fişi olmayan cihaz oranı. Yüksekse cihazlar arızadan bağımsız kaydediliyor demektir — arıza oranı hesaplanabilir.">Payda</th>
                  <th className="py-2 pl-3 text-right">Skor</th>
                </tr>
              </thead>
              <tbody>
                {d.satirlar.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 font-medium">{r.ad}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">{r.cihaz.toLocaleString('tr-TR')}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">{r.fis12Ay.toLocaleString('tr-TR')}</td>
                    <td className="py-2.5 px-3"><Bar p={r.kategoriPct} /></td>
                    <td className="py-2.5 px-3"><Bar p={r.yasPct} /></td>
                    <td className="py-2.5 px-3"><Bar p={r.sayacPct} /></td>
                    <td className={`py-2.5 px-3 text-right tabular-nums ${r.paydaPct >= 20 ? 'text-emerald-400' : 'text-red-400'}`}>
                      %{r.paydaPct}
                    </td>
                    <td className={`py-2.5 pl-3 text-right font-bold tabular-nums ${renk(r.skor)}`}>{r.skor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-[11px] text-gray-500 leading-relaxed">
            <b className="text-gray-400">Payda:</b> hiç servis fişi olmayan cihaz oranı. Düşükse cihazlar yalnızca
            arızalandığında kaydediliyor demektir ve <b className="text-gray-400">arıza oranı hesaplanamaz</b> —
            sadece bozulanları görürsün. %20'nin üzeri sağlıklı.
            <br />
            <b className="text-gray-400">Skor:</b> kategori %40 · yaş %30 · sayaç %20 · OEM kodu %10 ağırlıklı.
          </div>
        </div>
      </div>
    </div>
  );
}
