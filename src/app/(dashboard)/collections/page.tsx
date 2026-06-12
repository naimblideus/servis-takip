'use client';
import { useState, useEffect, useCallback } from 'react';

interface Cust { id: string; name: string; phone: string; }
interface OpenInv { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; status: string; totalAmount: number; paidAmount: number; openAmount: number; }
interface AllocResult { allocations: { invoiceNumber: string; amount: number; status: string }[]; allocated: number; unallocated: number; }

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR');

export default function CollectionsPage() {
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [sel, setSel] = useState<Cust | null>(null);

  const [openInvoices, setOpenInvoices] = useState<OpenInv[]>([]);
  const [openTotal, setOpenTotal] = useState(0);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AllocResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d: any) => {
      setCustomers(Array.isArray(d) ? d : d.customers || []);
    }).catch(() => {});
  }, []);

  const loadOpen = useCallback((customerId: string) => {
    fetch(`/api/collections?customerId=${customerId}`).then((r) => r.json()).then((d: any) => {
      setOpenInvoices(d.invoices || []);
      setOpenTotal(d.openTotal || 0);
    }).catch(() => {});
  }, []);

  const pickCustomer = (c: Cust) => {
    setSel(c); setCustSearch(c.name); setShowDrop(false); setResult(null); setErr(null);
    loadOpen(c.id);
  };

  const submit = async () => {
    if (!sel || !amount || Number(amount) <= 0) { setErr('Müşteri ve tutar zorunlu'); return; }
    setSaving(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sel.id, amount: Number(amount), method, referenceNo: refNo || null, date }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ allocations: d.allocations, allocated: d.allocated, unallocated: d.unallocated });
        setAmount(''); setRefNo('');
        loadOpen(sel.id);
      } else setErr(d.error || 'Hata');
    } catch { setErr('Sunucuya bağlanılamadı'); }
    setSaving(false);
  };

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).slice(0, 8);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tahsilat</h1>
      <p className="text-sm text-gray-500 mb-6">IBAN/havale/nakit tahsilat — en eski açık faturadan başlayarak <b>otomatik mahsup</b> (FIFO), onay gerekmez.</p>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        {/* Müşteri seçimi */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">Müşteri</label>
          <input value={custSearch} onChange={(e) => { setCustSearch(e.target.value); setShowDrop(true); setSel(null); }}
            onFocus={() => setShowDrop(true)} placeholder="Müşteri ara…"
            className="w-full px-3 py-2 border rounded-lg text-sm" />
          {showDrop && custSearch && !sel && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filtered.length === 0 ? <div className="px-3 py-2 text-sm text-gray-400">Bulunamadı</div> :
                filtered.map((c) => (
                  <div key={c.id} onClick={() => pickCustomer(c)} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    {c.name} <span className="text-gray-400 text-xs">· {c.phone}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Açık faturalar (FIFO önizleme) */}
        {sel && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span>Açık Faturalar (FIFO sırası)</span>
              <span className="text-red-600">Toplam açık: {fmt(openTotal)}</span>
            </div>
            {openInvoices.length === 0 ? <p className="text-sm text-gray-400">Açık fatura yok.</p> : (
              <div className="space-y-1">
                {openInvoices.map((i) => (
                  <div key={i.id} className="flex justify-between text-xs">
                    <span className="font-mono">{i.invoiceNumber} <span className="text-gray-400">· vade {fmtDate(i.dueDate)}</span></span>
                    <span className="font-medium">{fmt(i.openAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tahsilat formu */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tutar (₺)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Yöntem</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="TRANSFER">🏦 IBAN/Havale</option>
              <option value="CASH">💵 Nakit</option>
              <option value="CARD">💳 Kart</option>
              <option value="OTHER">📋 Diğer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dekont/Referans No</label>
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="opsiyonel"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button onClick={submit} disabled={saving || !sel}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
          {saving ? 'Kaydediliyor…' : 'Tahsilatı Kaydet ve Otomatik Mahsup Et'}
        </button>

        {/* Sonuç */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-medium text-green-800 mb-2">
              ✓ {fmt(result.allocated)} mahsup edildi{result.unallocated > 0 ? ` · ${fmt(result.unallocated)} avans (gelecek faturaya)` : ''}
            </p>
            <div className="space-y-1">
              {result.allocations.map((a, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700">
                  <span className="font-mono">{a.invoiceNumber}</span>
                  <span>{fmt(a.amount)} <span className={a.status === 'PAID' ? 'text-green-600' : 'text-amber-600'}>· {a.status === 'PAID' ? 'Tamamlandı' : 'Kısmi'}</span></span>
                </div>
              ))}
              {result.allocations.length === 0 && <p className="text-sm text-gray-500">Açık fatura olmadığı için tamamı avans olarak kaydedildi.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
