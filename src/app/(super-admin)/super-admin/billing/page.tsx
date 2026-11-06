'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, RefreshCw, Download } from 'lucide-react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

export default function BillingPage() {
    const sz = useT();
    const b = useBicim();
    const f = sz.superAdmin.fatura;
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
        const period = prompt(f.donemSor) || new Date().toISOString().slice(0, 7);
        setGenerating(true);
        const res = await fetch('/api/super-admin/billing/generate-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period }),
        });
        const data = await res.json();
        alert(doldur(f.sonuc, {
            n: data.total,
            o: data.results?.filter((r: any) => r.status === 'created').length || 0,
            a: data.results?.filter((r: any) => r.status === 'skipped').length || 0,
        }));
        setGenerating(false);
        fetch_();
    };

    const handlePay = async (id: string) => {
        const method = prompt(f.odemeYontemiSor) || 'transfer';
        await fetch(`/api/super-admin/billing/invoices/${id}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: method }),
        });
        fetch_();
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-900">
            <div className="bg-white border-b border-gray-200 px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-blue-700" />
                        {f.baslik}
                    </h1>
                    <button onClick={handleGenerate} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm disabled:opacity-50">
                        {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {f.aylikOlustur}
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Özet */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="text-xs text-blue-700">{f.tahakkuk}</div>
                        <div className="text-xl font-bold text-blue-700">{b.para(summary.totalBilled || 0)}</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="text-xs text-green-700">{f.tahsilat}</div>
                        <div className="text-xl font-bold text-green-700">{b.para(summary.totalCollected || 0)}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="text-xs text-red-700">{f.gecikmis}</div>
                        <div className="text-xl font-bold text-red-700">{b.para(summary.overdueAmount || 0)}</div>
                    </div>
                </div>

                {/* Filtreler */}
                <div className="flex gap-3 mb-4">
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm bg-white">
                        <option value="" className="bg-white">{f.tumDurumlar}</option>
                        <option value="pending" className="bg-white">{f.bekliyor}</option>
                        <option value="paid" className="bg-white">{f.odendi}</option>
                        <option value="overdue" className="bg-white">{f.gecikmisDurum}</option>
                    </select>
                </div>

                {/* Tablo */}
                {loading ? (
                    <div className="flex items-center justify-center h-48"><RefreshCw className="w-7 h-7 animate-spin text-blue-700" /></div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
                        <table className="w-full text-sm min-w-[40rem]">
                            <thead>
                                <tr className="border-b border-gray-200 text-xs text-gray-500">
                                    <th className="text-left px-4 py-3">{f.sutunNo}</th>
                                    <th className="text-left px-4 py-3">{f.sutunIsletme}</th>
                                    <th className="text-left px-4 py-3">{f.sutunDonem}</th>
                                    <th className="text-right px-4 py-3">{f.sutunTutar}</th>
                                    <th className="text-left px-4 py-3">{f.sutunDurum}</th>
                                    <th className="text-left px-4 py-3">{f.sutunSonOdeme}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-gray-500">{f.bulunamadi}</td></tr>
                                ) : invoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-xs text-blue-700">{inv.invoiceNumber}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{inv.tenant?.name}</div>
                                            <div className="text-xs text-gray-500">{inv.tenant?.ownerName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{inv.period}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{b.para(inv.totalAmount)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-green-50 text-green-700' :
                                                    inv.status === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                                                }`}>{inv.status === 'paid' ? f.odendi : inv.status === 'overdue' ? f.gecikmisDurum : f.bekliyor}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{b.tarih(inv.dueDate)}</td>
                                        <td className="px-4 py-3">
                                            {inv.status !== 'paid' && (
                                                <button onClick={() => handlePay(inv.id)} className="text-xs text-green-700 hover:text-green-800 px-2 py-1 rounded-lg hover:bg-green-100">
                                                    {f.ode}
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
