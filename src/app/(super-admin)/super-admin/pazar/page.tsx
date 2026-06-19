'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, RefreshCw, TrendingUp, Percent, Package, Users } from 'lucide-react';

interface Stats {
  totalOrders: number; completedCount: number; gmv: number; commission: number; activeListings: number; sellers: number;
  recent: { id: string; title: string | null; total: number; commission: number; pct: number; buyer: string | null; seller: string | null; at: string }[];
}
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MarketStatsPage() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { fetch('/api/super-admin/market-stats').then((r) => r.json()).then(setS).catch(() => {}); }, []);

  if (!s) return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-7 h-7 animate-spin text-violet-400" /></div>;

  const cards = [
    { label: 'Toplam İşlem Hacmi (GMV)', value: fmt(s.gmv), icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Platform Komisyon Geliri', value: fmt(s.commission), icon: Percent, color: 'text-violet-400' },
    { label: 'Tamamlanan Sipariş', value: `${s.completedCount} / ${s.totalOrders}`, icon: ShoppingCart, color: 'text-blue-400' },
    { label: 'Aktif İlan', value: String(s.activeListings), icon: Package, color: 'text-amber-400' },
    { label: 'Pazara Katılan Bayi', value: String(s.sellers), icon: Users, color: 'text-pink-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
        <h1 className="text-xl font-bold flex items-center gap-3 max-w-5xl mx-auto"><ShoppingCart className="w-5 h-5 text-violet-400" /> Bayi Pazarı</h1>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <c.icon className={`w-5 h-5 ${c.color} mb-3`} />
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-gray-400 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-violet-300 mb-4">Son Tamamlanan Siparişler</h3>
          {s.recent.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">Henüz tamamlanan sipariş yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-white/10">
                    <th className="py-2 pr-3">Ürün</th><th className="py-2 px-3">Satıcı → Alıcı</th>
                    <th className="py-2 px-3 text-right">Tutar</th><th className="py-2 px-3 text-right">Komisyon</th><th className="py-2 pl-3 text-right">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((o) => (
                    <tr key={o.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-medium">{o.title || '—'}</td>
                      <td className="py-2 px-3 text-gray-400">{o.seller || '—'} → {o.buyer || '—'}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">{fmt(o.total)}</td>
                      <td className="py-2 px-3 text-right text-violet-300">{o.commission > 0 ? `${fmt(o.commission)} (%${o.pct})` : '—'}</td>
                      <td className="py-2 pl-3 text-right text-gray-500 text-xs">{new Date(o.at).toLocaleDateString('tr-TR')}</td>
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
