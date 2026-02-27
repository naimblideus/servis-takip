'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';

interface Stats {
  openTickets: number;
  todayTickets: number;
  waitingParts: number;
  readyForPickup: number;
  monthRevenue: number;
  lowStockItems: number;
  rentalDevices: number;
  recentTickets: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Açık Fişler', value: stats?.openTickets || 0, color: 'bg-blue-500', icon: '📋' },
    { label: 'Bugünkü Fişler', value: stats?.todayTickets || 0, color: 'bg-green-500', icon: '📅' },
    { label: 'Parça Bekliyor', value: stats?.waitingParts || 0, color: 'bg-orange-500', icon: '⏳' },
    { label: 'Teslime Hazır', value: stats?.readyForPickup || 0, color: 'bg-purple-500', icon: '✅' },
    { label: 'Bu Ay Ciro', value: formatCurrency(stats?.monthRevenue || 0), color: 'bg-emerald-500', icon: '💰' },
    { label: 'Kiralık Cihaz', value: stats?.rentalDevices || 0, color: 'bg-cyan-500', icon: '🏷️' },
    { label: 'Kritik Stok', value: stats?.lowStockItems || 0, color: 'bg-red-500', icon: '⚠️' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Genel durum özeti</p>
        </div>
        <Link href="/tickets/new" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Fiş
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center text-2xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Tickets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Son Servis Fişleri</h2>
          <Link href="/tickets" className="text-blue-600 text-sm hover:underline">
            Tümünü Gör →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Fiş No</th>
                <th className="px-4 py-3 text-left">Müşteri</th>
                <th className="px-4 py-3 text-left">Cihaz</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-left">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats?.recentTickets.map((ticket: any) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline font-mono text-sm">
                      {ticket.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{ticket.device?.customer?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {ticket.device?.brand} {ticket.device?.model}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(ticket.createdAt)}</td>
                </tr>
              ))}
              {(!stats?.recentTickets || stats.recentTickets.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Henüz servis fişi yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}