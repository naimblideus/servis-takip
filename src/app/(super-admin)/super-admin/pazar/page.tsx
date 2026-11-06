'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, RefreshCw, TrendingUp, Percent, Package, Users } from 'lucide-react';
import { useT, useBicim } from '@/lib/i18n/client';

interface Stats {
  totalOrders: number; completedCount: number; gmv: number; commission: number; activeListings: number; sellers: number;
  recent: { id: string; title: string | null; total: number; commission: number; pct: number; buyer: string | null; seller: string | null; at: string }[];
}
export default function MarketStatsPage() {
  const sz = useT();
  const b = useBicim();
  const z = sz.superAdmin.pazar;
  // Komisyon geliri platformun kendi parası; bayinin birimiyle değil,
  // panelin dil/birim bağlamıyla biçimlenir.
  const fmt = (n: number) => b.para(n, 2);
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { fetch('/api/super-admin/market-stats').then((r) => r.json()).then(setS).catch(() => {}); }, []);

  if (!s) return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-7 h-7 animate-spin text-blue-700" /></div>;

  const cards = [
    { label: z.gmv, value: fmt(s.gmv), icon: TrendingUp, color: 'text-emerald-700' },
    { label: z.komisyon, value: fmt(s.commission), icon: Percent, color: 'text-blue-700' },
    { label: z.tamamlanan, value: `${s.completedCount} / ${s.totalOrders}`, icon: ShoppingCart, color: 'text-blue-700' },
    { label: z.aktifIlan, value: String(s.activeListings), icon: Package, color: 'text-amber-700' },
    { label: z.satici, value: String(s.sellers), icon: Users, color: 'text-pink-700' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-xl font-bold flex items-center gap-3 max-w-5xl mx-auto"><ShoppingCart className="w-5 h-5 text-blue-700" /> {z.baslik}</h1>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-2xl p-5">
              <c.icon className={`w-5 h-5 ${c.color} mb-3`} />
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-blue-700 mb-4">{z.sonSiparisler}</h3>
          {s.recent.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">{z.siparisYok}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                    <th className="py-2 pr-3">{z.sutunUrun}</th><th className="py-2 px-3">{z.sutunTaraf}</th>
                    <th className="py-2 px-3 text-right">{z.sutunTutar}</th><th className="py-2 px-3 text-right">{z.sutunKomisyon}</th><th className="py-2 pl-3 text-right">{z.sutunTarih}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium">{o.title || '—'}</td>
                      <td className="py-2 px-3 text-gray-500">{o.seller || '—'} → {o.buyer || '—'}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">{fmt(o.total)}</td>
                      <td className="py-2 px-3 text-right text-blue-700">{o.commission > 0 ? `${fmt(o.commission)} (${b.yuzde(o.pct)})` : '—'}</td>
                      <td className="py-2 pl-3 text-right text-gray-500 text-xs">{b.tarih(o.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
