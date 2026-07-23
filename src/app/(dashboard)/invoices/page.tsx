'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { openWhatsApp, invoiceMessage } from '@/lib/share';
import { openPrintable } from '@/lib/print';

interface Line { kind: string; description: string; quantity: number; unitPrice: number; lineTotal: number; }
interface Invoice {
  id: string; docToken?: string; invoiceNumber: string; period: string; invoiceDate: string; dueDate: string;
  status: string; source: string;
  customer: { id: string; name: string; phone: string } | null;
  subtotal: number; vatAmount: number; totalAmount: number; paidAmount: number; openAmount: number;
  lines: Line[];
}
interface Summary { count: number; total: number; open: number; overdue: number; paidCount: number; }

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Açık', cls: 'bg-blue-100 text-blue-700' },
  PARTIAL: { label: 'Kısmi', cls: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Ödendi', cls: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Vadesi Geçti', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'İptal', cls: 'bg-gray-100 text-gray-500' },
  DRAFT: { label: 'Taslak', cls: 'bg-gray-100 text-gray-500' },
};
const KIND: Record<string, string> = { COUNTER: 'Sayaç', RENTAL: 'Kira', PART: 'Parça', LABOR: 'İşçilik', OTHER: 'Diğer' };
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR');

export default function InvoicesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const tenantName = (session?.user as any)?.tenantName as string | undefined;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ count: 0, total: 0, open: 0, overdue: 0, paidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (status !== 'all') p.set('status', status);
    if (search.trim()) p.set('search', search.trim());
    try {
      const res = await fetch(`/api/invoices?${p}`);
      if (res.ok) {
        const d = await res.json();
        setInvoices(d.invoices);
        setSummary(d.summary);
      }
    } catch { /* yoksay */ }
    setLoading(false);
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const runBilling = async () => {
    if (!confirm('Bu dönem için tüm müşterilere otomatik fatura kesilecek (sayaç + kira + ödenmemiş servis). Devam edilsin mi?')) return;
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (res.ok) { setMsg(`✓ ${d.created} fatura kesildi (toplam ${fmt(d.total)})${d.errors ? ` · ${d.errors} hata` : ''}`); load(); }
      else setMsg('❌ ' + (d.error || 'Hata'));
    } catch { setMsg('❌ Sunucuya bağlanılamadı'); }
    setRunning(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faturalar</h1>
          <p className="text-sm text-gray-500 mt-1">Otomatik kesilen müşteri faturaları — sayaç, kira ve servis tek faturada</p>
        </div>
        <button onClick={runBilling} disabled={running}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {running ? 'Kesiliyor…' : '⚡ Bu Dönemi Faturala'}
        </button>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg bg-gray-50 border text-sm text-gray-700">{msg}</div>}

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">Toplam Fatura</p><span>🧾</span></div>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{summary.count}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{summary.paidCount} adet ödendi</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">Toplam Tutar</p><span>💼</span></div>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{fmt(summary.total)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">KDV dahil ciro</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">Açık Bakiye</p><span>⏳</span></div>
          <p className="text-2xl font-bold text-blue-600 mt-1 tabular-nums">{fmt(summary.open)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Tahsil edilecek</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          <div className="flex items-center justify-between"><p className="text-xs text-gray-500 font-medium">Vadesi Geçen</p><span>🔴</span></div>
          <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">{fmt(summary.overdue)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Gecikmiş tutar</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Fatura no / müşteri ara…"
          className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="all">Tüm Durumlar</option>
          <option value="OPEN">Açık</option>
          <option value="PARTIAL">Kısmi</option>
          <option value="OVERDUE">Vadesi Geçti</option>
          <option value="PAID">Ödendi</option>
        </select>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Fatura No</th>
                <th className="text-left px-4 py-3">Müşteri</th>
                <th className="text-left px-4 py-3">Dönem</th>
                <th className="text-right px-4 py-3">Tutar</th>
                <th className="text-right px-4 py-3">Açık</th>
                <th className="text-left px-4 py-3">Vade</th>
                <th className="text-left px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Yükleniyor…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  Henüz fatura yok. "Bu Dönemi Faturala" ile başlatabilirsiniz.
                </td></tr>
              ) : invoices.map((i) => {
                const st = STATUS[i.status] || STATUS.OPEN;
                return (
                  <tr key={i.id} onClick={() => setDetail(i)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.invoiceNumber}</td>
                    <td className="px-4 py-3">{i.customer?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{i.period}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(i.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">{i.openAmount > 0 ? <span className="text-red-600 font-medium">{fmt(i.openAmount)}</span> : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(i.dueDate)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detay modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-gray-500">{detail.invoiceNumber}</p>
                <h3 className="text-lg font-bold">{detail.customer?.name}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-5">
              <div className="flex justify-between text-sm text-gray-500 mb-3">
                <span>Dönem: {detail.period}</span>
                <span>Vade: {fmtDate(detail.dueDate)}</span>
              </div>
              <table className="w-full text-sm mb-4">
                <thead className="text-xs text-gray-400 border-b">
                  <tr><th className="text-left py-1">Kalem</th><th className="text-right py-1">Adet</th><th className="text-right py-1">B.Fiyat</th><th className="text-right py-1">Tutar</th></tr>
                </thead>
                <tbody>
                  {detail.lines.map((l, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2"><span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded mr-1">{KIND[l.kind] || l.kind}</span>{l.description}</td>
                      <td className="py-2 text-right">{l.quantity}</td>
                      <td className="py-2 text-right">{fmt(l.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{fmt(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between text-gray-500"><span>Ara Toplam</span><span>{fmt(detail.subtotal)}</span></div>
                <div className="flex justify-between text-gray-500"><span>KDV</span><span>{fmt(detail.vatAmount)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Genel Toplam</span><span>{fmt(detail.totalAmount)}</span></div>
                <div className="flex justify-between text-green-600"><span>Tahsil Edilen</span><span>{fmt(detail.paidAmount)}</span></div>
                <div className="flex justify-between font-medium text-red-600"><span>Kalan</span><span>{fmt(detail.openAmount)}</span></div>
              </div>
            </div>
            {/* Aksiyonlar */}
            <div className="p-4 border-t bg-gray-50 flex gap-2 flex-wrap sticky bottom-0">
              <button onClick={() => openPrintable(`/invoices/${detail.id}/print`)}
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                🖨 Yazdır / PDF
              </button>
              {detail.customer && (
                <button onClick={() => {
                  const link = detail.docToken ? `${window.location.origin}/belge/fatura/${detail.id}/${detail.docToken}` : '';
                  const msg = invoiceMessage({ tenantName, customerName: detail.customer!.name, invoiceNumber: detail.invoiceNumber, period: detail.period, totalAmount: detail.totalAmount, openAmount: detail.openAmount, dueDate: detail.dueDate })
                    + (link ? `\n\n📄 Faturanızı görüntüleyin: ${link}` : '');
                  openWhatsApp(detail.customer!.phone, msg);
                }}
                  className="flex-1 min-w-[120px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                  📱 WhatsApp + Link
                </button>
              )}
              {detail.docToken && (
                <button onClick={() => {
                  const link = `${window.location.origin}/belge/fatura/${detail.id}/${detail.docToken}`;
                  navigator.clipboard?.writeText(link).then(() => setMsg('🔗 Belge linki kopyalandı')).catch(() => window.open(link, '_blank'));
                }}
                  className="px-4 py-2.5 bg-white border text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium" title="Girişsiz görüntülenebilir belge linki">
                  🔗 Link
                </button>
              )}
              {detail.openAmount > 0 && detail.customer && (
                <button onClick={() => router.push(`/collections?customerId=${detail.customer!.id}`)}
                  className="flex-1 min-w-[140px] px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                  💰 Tahsilat Yap
                </button>
              )}
              <button onClick={() => setDetail(null)}
                className="px-4 py-2.5 bg-white border text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
