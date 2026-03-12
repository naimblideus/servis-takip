'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, RefreshCw, Download } from 'lucide-react';

export default function BillingPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [generating, setGenerating] = useState(false);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const res = await fetch(`/api/super-admin/billing?${params}`);
        const data = await res.json();
        setInvoices(data.invoices || []);
        setSummary(data.summary || {});
        setLoading(false);
    }, [status]);

    useEffect(() => { fetch_(); }, [fetch_]);

    const handleGenerate = async () => {
        const period = prompt('Dönem (ör. 2026-03):') || new Date().toISOString().slice(0, 7);
        setGenerating(true);
        const res = await fetch('/api/super-admin/billing/generate-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period }),
        });
        const data = await res.json();
        alert(`${data.total} fatura işlendi (${data.results?.filter((r: any) => r.status === 'created').length || 0} oluşturuldu, ${data.results?.filter((r: any) => r.status === 'skipped').length || 0} atlandı)`);
        setGenerating(false);
        fetch_();
    };

    const handlePay = async (id: string) => {
        const method = prompt('Ödeme yöntemi (cash/transfer/card):') || 'transfer';
        await fetch(`/api/super-admin/billing/invoices/${id}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: method }),
        });
        fetch_();
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-violet-400" />
                        Faturalama
                    </h1>
                    <button onClick={handleGenerate} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm disabled:opacity-50">
                        {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Aylık Fatura Oluştur
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Özet */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4">
                        <div className="text-xs text-blue-400">Toplam Tahakkuk</div>
                        <div className="text-xl font-bold text-blue-300">{(summary.totalBilled || 0).toLocaleString('tr-TR')} ₺</div>
                    </div>
                    <div className="bg-green-900/20 border border-green-500/20 rounded-xl p-4">
                        <div className="text-xs text-green-400">Toplam Tahsilat</div>
                        <div className="text-xl font-bold text-green-300">{(summary.totalCollected || 0).toLocaleString('tr-TR')} ₺</div>
                    </div>
                    <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4">
                        <div className="text-xs text-red-400">Gecikmiş</div>
                        <div className="text-xl font-bold text-red-300">{(summary.overdueAmount || 0).toLocaleString('tr-TR')} ₺</div>
                    </div>
                </div>

                {/* Filtreler */}
                <div className="flex gap-3 mb-4">
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm bg-gray-900">
                        <option value="" className="bg-gray-900">Tüm Durumlar</option>
                        <option value="pending" className="bg-gray-900">Bekliyor</option>
                        <option value="paid" className="bg-gray-900">Ödendi</option>
                        <option value="overdue" className="bg-gray-900">Gecikmiş</option>
                    </select>
                </div>

                {/* Tablo */}
                {loading ? (
                    <div className="flex items-center justify-center h-48"><RefreshCw className="w-7 h-7 animate-spin text-violet-400" /></div>
                ) : (
                    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-xs text-gray-400">
                                    <th className="text-left px-4 py-3">Fatura No</th>
                                    <th className="text-left px-4 py-3">İşletme</th>
                                    <th className="text-left px-4 py-3">Dönem</th>
                                    <th className="text-right px-4 py-3">Tutar</th>
                                    <th className="text-left px-4 py-3">Durum</th>
                                    <th className="text-left px-4 py-3">Son Ödeme</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">Fatura bulunamadı</td></tr>
                                ) : invoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-white/5 hover:bg-white/3">
                                        <td className="px-4 py-3 font-mono text-xs text-violet-300">{inv.invoiceNumber}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{inv.tenant?.name}</div>
                                            <div className="text-xs text-gray-500">{inv.tenant?.ownerName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{inv.period}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{inv.totalAmount.toLocaleString('tr-TR')} ₺</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                    inv.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>{inv.status === 'paid' ? 'Ödendi' : inv.status === 'overdue' ? 'Gecikmiş' : 'Bekliyor'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(inv.dueDate).toLocaleDateString('tr-TR')}</td>
                                        <td className="px-4 py-3">
                                            {inv.status !== 'paid' && (
                                                <button onClick={() => handlePay(inv.id)} className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-lg hover:bg-green-500/10">
                                                    Öde
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
