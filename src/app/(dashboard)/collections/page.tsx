'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { openWhatsApp, paymentMessage } from '@/lib/share';
import { openPrintable } from '@/lib/print';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Cust { id: string; name: string; phone: string; }
interface OpenInv { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; status: string; totalAmount: number; paidAmount: number; openAmount: number; }
interface AllocResult { paymentId: string; receiptToken?: string; allocations: { invoiceNumber: string; amount: number; status: string }[]; allocated: number; unallocated: number; }

export default function CollectionsPage() {
  const { data: session } = useSession();
  const t = useT();
  const b = useBicim();
  const fmt = (n: number) => b.para(n);
  const fmtDate = (s: string) => b.tarih(s);
  const tenantName = (session?.user as any)?.tenantName as string | undefined;
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

  const loadOpen = useCallback((customerId: string) => {
    fetch(`/api/collections?customerId=${customerId}`).then((r) => r.json()).then((d: any) => {
      setOpenInvoices(d.invoices || []);
      setOpenTotal(d.openTotal || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((d: any) => {
      const list: Cust[] = Array.isArray(d) ? d : d.customers || [];
      setCustomers(list);
      // Faturalar sayfasından "Tahsilat Yap" derin-linki ile gelindiyse müşteriyi ön-seç
      const pre = new URLSearchParams(window.location.search).get('customerId');
      if (pre) {
        const c = list.find((x) => x.id === pre);
        if (c) { setSel(c); setCustSearch(c.name); setShowDrop(false); loadOpen(c.id); }
      }
    }).catch(() => {});
  }, [loadOpen]);

  const pickCustomer = (c: Cust) => {
    setSel(c); setCustSearch(c.name); setShowDrop(false); setResult(null); setErr(null);
    loadOpen(c.id);
  };

  const submit = async () => {
    if (!sel || !amount || Number(amount) <= 0) { setErr(t.tahsilat.zorunlu); return; }
    setSaving(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sel.id, amount: Number(amount), method, referenceNo: refNo || null, date }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ paymentId: d.paymentId, receiptToken: d.receiptToken, allocations: d.allocations, allocated: d.allocated, unallocated: d.unallocated });
        setAmount(''); setRefNo('');
        loadOpen(sel.id);
      } else setErr(d.error || t.genel.hata);
    } catch { setErr(t.sayacTuru.sunucuYok); }
    setSaving(false);
  };

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).slice(0, 8);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.tahsilat.baslik}</h1>
      <p className="text-sm text-gray-500 mb-6">{t.tahsilat.alt}</p>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        {/* Müşteri seçimi */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.genel.musteri}</label>
          <input value={custSearch} onChange={(e) => { setCustSearch(e.target.value); setShowDrop(true); setSel(null); }}
            onFocus={() => setShowDrop(true)} placeholder={t.tahsilat.musteriAraYer}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
          {showDrop && custSearch && !sel && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filtered.length === 0 ? <div className="px-3 py-2 text-sm text-gray-400">{t.tahsilat.bulunamadi}</div> :
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
              <span>{t.tahsilat.acikFaturalar}</span>
              <span className="text-red-600">{doldur(t.tahsilat.toplamAcik, { n: fmt(openTotal) })}</span>
            </div>
            {openInvoices.length === 0 ? <p className="text-sm text-gray-400">{t.tahsilat.acikFaturaYok}</p> : (
              <div className="space-y-1">
                {openInvoices.map((i) => (
                  <div key={i.id} className="flex justify-between text-xs">
                    <span className="font-mono">{i.invoiceNumber} <span className="text-gray-400">· {doldur(t.tahsilat.vadeKisa, { n: fmtDate(i.dueDate) })}</span></span>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">{doldur(t.tahsilat.tutar, { birim: b.simge })}</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.tahsilat.yontem}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              {(['TRANSFER', 'CASH', 'CARD', 'OTHER'] as const).map((k) => (
                <option key={k} value={k}>{t.tahsilat.yontemler[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.tahsilat.dekont}</label>
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder={t.tahsilat.opsiyonel}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.genel.tarih}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button onClick={submit} disabled={saving || !sel}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
          {saving ? t.genel.kaydediliyor : t.tahsilat.kaydet}
        </button>

        {/* Sonuç */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <p className="font-medium text-green-800">
                {doldur(t.tahsilat.mahsupEdildi, { n: fmt(result.allocated) })}{result.unallocated > 0 ? doldur(t.tahsilat.avans, { n: fmt(result.unallocated) }) : ''}
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openPrintable(`/collections/${result.paymentId}/print`)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm">
                  {t.tahsilat.makbuzYazdir}
                </button>
                <button onClick={() => {
                  const link = result.receiptToken ? `${window.location.origin}/belge/makbuz/${result.paymentId}/${result.receiptToken}` : '';
                  const msg = paymentMessage({ tenantName, customerName: sel?.name, amount: result.allocated + result.unallocated, date })
                    + (link ? `\n\n${doldur(t.tahsilat.makbuzLinkOn, { n: link })}` : '');
                  openWhatsApp(sel?.phone, msg);
                }}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm">
                  {t.faturalar.whatsappLink}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {result.allocations.map((a, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700">
                  <span className="font-mono">{a.invoiceNumber}</span>
                  <span>{fmt(a.amount)} <span className={a.status === 'PAID' ? 'text-green-600' : 'text-amber-600'}>· {a.status === 'PAID' ? t.tahsilat.tamamlandi : t.tahsilat.kismi}</span></span>
                </div>
              ))}
              {result.allocations.length === 0 && <p className="text-sm text-gray-500">{t.tahsilat.hepsiAvans}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
