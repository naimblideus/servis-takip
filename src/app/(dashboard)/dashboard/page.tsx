'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import { openWhatsApp, reminderMessage, telUrl } from '@/lib/share';

interface StuckTicket {
  id: string;
  ticketNumber: string;
  status: string;
  days: number;
  customerName: string;
  customerPhone: string;
  device: string;
  technician: string | null;
}

interface Stats {
  sayaciEksikCihaz?: number; // 35+ gundur okumasi olmayan kiralik cihaz
  openTickets: number;
  todayTickets: number;
  waitingParts: number;
  readyForPickup: number;
  monthRevenue: number;
  lowStockItems: number;
  rentalDevices: number;
  recentTickets: any[];
  stuckTickets?: StuckTicket[];
  stuckDays?: number;
  contractAlerts?: ContractAlert[];
}

interface ContractAlert {
  id: string; name: string; phone: string;
  endDate: string; days: number; expired: boolean; deviceCount: number;
}

interface OverdueDebtor {
  customer: { id: string; name: string; phone: string };
  debt: number;
  daysSinceLastSale: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const tenantName = (session?.user as any)?.tenantName as string | undefined;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [overdueDebtors, setOverdueDebtors] = useState<OverdueDebtor[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
    fetch('/api/muhasebe/overdue')
      .then(r => r.json())
      .then(data => {
        setOverdueDebtors(data.debtors || []);
        setTotalDebt(data.summary?.totalDebt || 0);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stuck = stats?.stuckTickets || [];
  const contracts = stats?.contractAlerts || [];

  // Sayacı gelmeyen kiralık cihaz EN BAŞTA: bayinin bir numaralı derdi bu
  // ("ayda 2-3 makinenin sayacı hiç gelmez, o ay para kazanmam, fark etmem").
  // Sıfırken sakin renk; birden fazlaysa kırmızı — bakılması gereken şey o.
  // Tıklanınca sayaç turuna gider: görmek yetmez, oradan düzeltilebilmeli.
  const sayaciEksik = stats?.sayaciEksikCihaz || 0;
  // İkon kutuları artık DOLGU değil yumuşak yüzey: yan yana yedi doygun blok
  // gözü yoruyor ve hepsi eşit derecede "acil" görünüyordu. Sakin yüzeyde
  // gerçekten acil olan (kırmızı) öne çıkabiliyor.
  const ton = {
    uyari:  { yz: '#FDECEC', ik: '#B93333' },
    sakin:  { yz: '#F1F4F9', ik: '#6C7A93' },
    marka:  { yz: '#EEF2FA', ik: '#1D3E7E' },
    para:   { yz: '#E7F6EF', ik: '#0B8259' },
    bekle:  { yz: '#FCF3E4', ik: '#B0721F' },
    hazir:  { yz: '#F0EDFB', ik: '#5A48B8' },
    cihaz:  { yz: '#E6F4F5', ik: '#0B757D' },
  };
  const statCards = [
    {
      label: 'Sayacı Gelmeyen Cihaz', value: sayaciEksik,
      ton: sayaciEksik > 0 ? ton.uyari : ton.sakin, icon: '📟',
      href: '/sayac-turu', hint: '35+ gündür okuma yok', vurgu: sayaciEksik > 0,
    },
    { label: 'Açık Fişler', value: stats?.openTickets || 0, ton: ton.marka, icon: '📋' },
    { label: 'Bugünkü Fişler', value: stats?.todayTickets || 0, ton: ton.para, icon: '📅' },
    { label: 'Parça Bekliyor', value: stats?.waitingParts || 0, ton: ton.bekle, icon: '⏳' },
    { label: 'Teslime Hazır', value: stats?.readyForPickup || 0, ton: ton.hazir, icon: '✅' },
    { label: 'Bu Ay Ciro', value: formatCurrency(stats?.monthRevenue || 0), ton: ton.para, icon: '💰' },
    { label: 'Kiralık Cihaz', value: stats?.rentalDevices || 0, ton: ton.cihaz, icon: '🏷️' },
    { label: 'Kritik Stok', value: stats?.lowStockItems || 0, ton: (stats?.lowStockItems || 0) > 0 ? ton.uyari : ton.sakin, icon: '⚠️' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[.18em] text-gray-400">Bugün</div>
          <h1 className="mt-0.5 text-[1.6rem] font-extrabold tracking-[-.022em] text-gray-900">Genel Durum</h1>
        </div>
        <Link href="/tickets/new" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Fiş
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {statCards.map((card: any, i) => {
          const govde = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Etiket önce ve küçük, sayı büyük: göz sayıyı tarar, etiketi
                    yalnız gerektiğinde okur. */}
                <p className="truncate text-[.78rem] font-semibold uppercase tracking-[.04em] text-gray-500">{card.label}</p>
                <p className="mt-1.5 text-[1.75rem] font-extrabold leading-none tracking-[-.02em] text-gray-900 tabular-nums">{card.value}</p>
                {card.hint && <p className="mt-1 text-[.7rem] text-gray-400">{card.hint}</p>}
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: card.ton.yz, color: card.ton.ik }}>
                {card.icon}
              </div>
            </div>
          );
          // Tıklanabilir kart: görmek yetmez, oradan düzeltilebilmeli.
          const kap = 'card block transition-shadow duration-150';
          return card.href
            ? <Link key={i} href={card.href} className={kap + ' hover:shadow-[0_2px_4px_rgba(11,21,51,.05),0_8px_20px_-6px_rgba(11,21,51,.12)]'}
                style={card.vurgu ? { borderColor: '#F2C2C2' } : undefined}>{govde}</Link>
            : <div key={i} className={kap} style={card.vurgu ? { borderColor: '#F2C2C2' } : undefined}>{govde}</div>;
        })}
      </div>

      {/* Sözleşme Uyarısı — bitmiş / yaklaşan kiralama sözleşmeleri */}
      {contracts.length > 0 && (
        <div className="card" style={{ background: '#FAF9FE', borderColor: '#DDD5F5' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold" style={{ color: '#6d28d9' }}>📄 Sözleşme Uyarısı ({contracts.length})</h2>
            <Link href="/customers" className="text-blue-600 text-sm hover:underline">Müşteriler →</Link>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Süresi dolan sözleşme = cihaz bedava çalışıyor olabilir. Yenile ya da cihazı çek.
          </p>
          <div className="divide-y divide-gray-100">
            {contracts.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5">
                <span
                  style={{
                    flexShrink: 0, minWidth: 68, textAlign: 'center',
                    backgroundColor: c.expired ? '#fee2e2' : '#f5f3ff',
                    color: c.expired ? '#b91c1c' : '#6d28d9',
                    fontWeight: 700, fontSize: '0.72rem',
                    borderRadius: 9999, padding: '0.2rem 0.5rem',
                  }}
                >{c.expired ? `${Math.abs(c.days)} gün geçti` : `${c.days} gün kaldı`}</span>

                <Link href={`/customers/${c.id}`} className="flex-1 min-w-0 no-underline">
                  <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {new Date(c.endDate).toLocaleDateString('tr-TR')} · {c.deviceCount} cihaz
                  </div>
                </Link>

                {c.phone && (
                  <a href={telUrl(c.phone)} title={`Ara: ${c.phone}`}
                    className="flex-shrink-0 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 no-underline hover:bg-blue-100"
                  >📞</a>
                )}
              </div>
            ))}
          </div>
          {contracts.length > 6 && (
            <div className="text-center mt-3">
              <Link href="/customers" className="text-blue-600 text-sm hover:underline">+{contracts.length - 6} müşteri daha →</Link>
            </div>
          )}
        </div>
      )}

      {/* Duran İşler — durumu N gündür değişmemiş açık fişler */}
      {stuck.length > 0 && (
        <div className="card" style={{ background: '#FEFAF3', borderColor: '#F3DFBE' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-orange-600">⏳ Duran İşler ({stuck.length})</h2>
            <Link href="/tickets?status=IN_SERVICE" className="text-blue-600 text-sm hover:underline">Fişler →</Link>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {stats?.stuckDays ?? 3} gündür durumu değişmedi — müşteri bekliyor olabilir.
          </p>
          <div className="divide-y divide-gray-100">
            {stuck.slice(0, 8).map((t) => {
              const hot = t.days >= 7;
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span
                    title={`${t.days} gündür bekliyor`}
                    style={{
                      flexShrink: 0, minWidth: 44, textAlign: 'center',
                      backgroundColor: hot ? '#fee2e2' : '#ffedd5',
                      color: hot ? '#b91c1c' : '#9a3412',
                      fontWeight: 700, fontSize: '0.75rem',
                      borderRadius: 9999, padding: '0.2rem 0.5rem',
                    }}
                  >{t.days} gün</span>

                  <Link href={`/tickets/${t.id}`} className="flex-1 min-w-0 no-underline">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {t.customerName}
                      <span className="text-blue-600 font-mono font-normal text-xs ml-2">{t.ticketNumber}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {t.device}
                      {' · '}{getStatusLabel(t.status)}
                      {t.technician ? ` · ${t.technician}` : ' · atanmamış'}
                    </div>
                  </Link>

                  {t.customerPhone && (
                    <a
                      href={telUrl(t.customerPhone)}
                      onClick={(e) => e.stopPropagation()}
                      title={`Ara: ${t.customerPhone}`}
                      className="flex-shrink-0 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 no-underline hover:bg-blue-100"
                    >📞</a>
                  )}
                </div>
              );
            })}
          </div>
          {stuck.length > 8 && (
            <div className="text-center mt-3">
              <Link href="/tickets?status=IN_SERVICE" className="text-blue-600 text-sm hover:underline">
                +{stuck.length - 8} iş daha →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Overdue Debtors */}
      {overdueDebtors.length > 0 && (
        <div className="card" style={{ background: '#FEF7F7', borderColor: '#F2C2C2' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-red-600">⚠️ Borçlu Müşteriler ({overdueDebtors.length})</h2>
            <Link href="/accounting" className="text-blue-600 text-sm hover:underline">Muhasebe →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueDebtors.slice(0, 6).map(d => (
              <div key={d.customer.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="font-semibold text-gray-900 text-sm">{d.customer.name}</div>
                <div className="text-xs text-gray-500">📞 {d.customer.phone}</div>
                <div className="text-lg font-bold text-red-600 mt-1">₺{d.debt.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openWhatsApp(d.customer.phone, reminderMessage({ tenantName, customerName: d.customer.name, debt: d.debt }))}
                    className="flex-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md px-2 py-1.5"
                  >📱 Hatırlat</button>
                  <Link href="/accounting" className="text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md px-2 py-1.5 hover:bg-blue-50">Cari →</Link>
                </div>
              </div>
            ))}
          </div>
          {overdueDebtors.length > 6 && (
            <div className="text-center mt-3">
              <Link href="/accounting" className="text-blue-600 text-sm hover:underline">+{overdueDebtors.length - 6} müşteri daha →</Link>
            </div>
          )}
        </div>
      )}

      {/* Recent Tickets */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Son Servis Fişleri</h2>
          <Link href="/tickets" className="text-blue-600 text-sm hover:underline">
            Tümünü Gör →
          </Link>
        </div>
        {/* Mobil: kart listesi (tablo yerine — yatay kaydırma yok) */}
        <div className="md:hidden divide-y divide-gray-100">
          {stats?.recentTickets?.map((t: any) => (
            <Link key={t.id} href={`/tickets/${t.id}`} className="block py-3 active:bg-blue-50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-blue-600 font-mono text-sm font-semibold">{t.ticketNumber}</span>
                <span className={`badge ${getStatusColor(t.status)}`}>{getStatusLabel(t.status)}</span>
              </div>
              <div className="text-sm text-gray-800 font-medium mt-1">{t.device?.customer?.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.device?.brand} {t.device?.model} · {formatDate(t.createdAt)}</div>
            </Link>
          ))}
          {(!stats?.recentTickets || stats.recentTickets.length === 0) && (
            <div className="py-8 text-center text-gray-400 text-sm">Henüz servis fişi yok</div>
          )}
        </div>

        {/* Masaüstü: tablo */}
        <div className="hidden md:block overflow-x-auto">
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
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  style={{ cursor: 'pointer' }}
                  className="hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-blue-600 font-mono text-sm font-semibold">{ticket.ticketNumber}</span>
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