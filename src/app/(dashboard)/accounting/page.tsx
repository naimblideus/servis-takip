'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { openPrintable } from '@/lib/print';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { sablonDoldur, SABLON_DEGISKENLERI } from '@/lib/mesaj-sablonu';
const StockTab = dynamic(() => import('@/components/StockTab'), { ssr: false });
const ExpenseTab = dynamic(() => import('@/components/ExpenseTab'), { ssr: false });

interface Entry { id: string; type: 'SALE'|'PAYMENT'; product: string|null; amount: number; method: string; notes: string|null; date: string; createdByName?: string|null; customer?: {id:string;name:string;phone:string}|null; }
// balance = BİRLEŞİK borç (servis + kira/sayaç faturası). Kırılım servisBorc/faturaBorc'ta.
interface Customer { id:string; name:string; phone:string; totalSales:number; totalPayments:number; balance:number; servisBorc?:number; faturaBorc?:number; }
interface AllCustomer { id:string; name:string; phone:string; }
interface EkstreSatiri { id:string; kaynak:'SERVIS'|'FATURA'; tip:'BORC'|'ODEME'; aciklama:string; tutar:number; tarih:string; detay?:string|null; }
interface CustDetail { customer:{id:string;name:string;phone:string;address:string|null;email:string|null}; entries:Entry[]; ekstre?:EkstreSatiri[]; summary:{totalSales:number;totalPayments:number;balance:number;servisBorc?:number;faturaBorc?:number;entryCount:number}; }

interface StockItem { id:string; source:'PART'|'PRINTER'; name:string; sku?:string|null; category?:string|null; brand?:string|null; model?:string|null; color?:string|null; condition?:string|null; group?:string|null; buyPrice:number; sellPrice:number; stockQty:number; notes?:string|null; }
// Etiketler sözlükte (muhasebe.yontem); kod veritabanına yazılan şey.
const METHODS = ['CASH', 'CARD', 'TRANSFER', 'OPEN_ACCOUNT', 'OTHER'];

export default function AccountingPage() {
  // `sz` (sözlük): aşağıdaki liste döngüleri `t` adını kullanıyor.
  const sz = useT();
  const b = useBicim();
  const yontem = (kod: string) => (sz.muhasebe.yontem as Record<string, string>)[kod] ?? kod;
  const [activeTab, setActiveTab] = useState<'accounting'|'stock'|'expense'>('accounting');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<AllCustomer[]>([]); // Form dropdown için filtresiz liste
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({totalDebt:0,servisAlacak:0,faturaAlacak:0,debtorCount:0,customerCount:0});
  const [filter, setFilter] = useState<'all'|'paid'|'unpaid'>('all');
  const [search, setSearch] = useState('');
  const [selCust, setSelCust] = useState<Customer|null>(null);
  const [detail, setDetail] = useState<CustDetail|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [form, setForm] = useState({type:'SALE' as 'SALE'|'PAYMENT', customerId:'', product:'', amount:'', method:'CASH', notes:'', date: new Date().toISOString().split('T')[0]});

  // Form müşteri arama
  const [formCustSearch, setFormCustSearch] = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [formSelCust, setFormSelCust] = useState<AllCustomer|null>(null);
  const [quickAddCust, setQuickAddCust] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({name:'', phone:'', address:''});
  const [quickCustSaving, setQuickCustSaving] = useState(false);
  const [editModal, setEditModal] = useState<{id:string;type:'SALE'|'PAYMENT';product:string;amount:string;method:string;notes:string;date:string}|null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  // Toplu WhatsApp
  const [showBulkWA, setShowBulkWA] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMsgTpl, setBulkMsgTpl] = useState(sz.toplu.varsayilanSablon);
  const [bulkIdx, setBulkIdx] = useState(-1);
  const [bulkQueue, setBulkQueue] = useState<Customer[]>([]); // gönderim başında dondurulan liste
  const [smsSending, setSmsSending] = useState(false);
  const [waSending, setWaSending] = useState(false);
  // Hangi toplu kanal kurulu? (kurulu değilse buton hata vermek yerine "kurulum gerekli" görünür)
  const [channels, setChannels] = useState<{sms:boolean;whatsapp:boolean}|null>(null);
  // Stok picker
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [formStockSearch, setFormStockSearch] = useState('');
  const [showStockDrop, setShowStockDrop] = useState(false);
  const [formStockItem, setFormStockItem] = useState<StockItem|null>(null);
  // Hızlı stok ekleme
  const [quickAddStock, setQuickAddStock] = useState(false);
  const [quickStockName, setQuickStockName] = useState('');
  const [quickStockPrice, setQuickStockPrice] = useState('');
  const [quickStockSaving, setQuickStockSaving] = useState(false);

  const inp: React.CSSProperties = {width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',fontSize:'0.875rem',boxSizing:'border-box',outline:'none'};
  const lbl: React.CSSProperties = {display:'block',fontSize:'0.8rem',fontWeight:'500',color:'#6b7280',marginBottom:'0.25rem'};

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/muhasebe?${params}`);
      if (res.ok) { const d = await res.json(); setCustomers(d.customers); setSummary(d.summary); }
      else {
        const d = await res.json().catch(() => ({ error: sz.muhasebe.bilinmeyenHata }));
        setError(d.error || doldur(sz.muhasebe.sunucuHatasi, { n: res.status }));
      }
    } catch (e: any) {
      setError(sz.muhasebe.baglantiYok);
    }
    setLoading(false);
  }, [filter, search]);

  // Tüm müşterileri form dropdown için ayrıca yükle
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then((data: any) => {
      const list = Array.isArray(data) ? data : data.customers || [];
      setAllCustomers(list);
    }).catch(() => {});
  }, []);

  // Stok listesini yükle
  const loadStock = useCallback(() => {
    fetch('/api/stock').then(r => r.json()).then((d:any) => { if (d.items) setAllStock(d.items); }).catch(()=>{});
  }, []);
  useEffect(() => { loadStock(); }, [loadStock]);

  // Dropdown'ları dışarı tıklayınca kapat
  useEffect(() => {
    const handler = () => { setShowCustDrop(false); setShowStockDrop(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/muhasebe/customer/${id}`);
      if (res.ok) setDetail(await res.json());
      else setDetail(null);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (selCust) loadDetail(selCust.id); }, [selCust, loadDetail]);

  const filteredFormCusts = allCustomers.filter(c =>
    c.name.toLowerCase().includes(formCustSearch.toLowerCase()) ||
    c.phone.includes(formCustSearch)
  );

  const selectFormCust = (c: AllCustomer) => {
    setFormSelCust(c);
    setFormCustSearch(c.name);
    setForm(f => ({ ...f, customerId: c.id }));
    setShowCustDrop(false);
  };

  const resetForm = () => {
    setForm({type:'SALE', customerId:'', product:'', amount:'', method:'CASH', notes:'', date: new Date().toISOString().split('T')[0]});
    setFormCustSearch(''); setFormSelCust(null); setShowCustDrop(false);
    setFormStockSearch(''); setFormStockItem(null); setShowStockDrop(false);
  };

  const selectStockItem = (item: StockItem) => {
    setFormStockItem(item);
    setFormStockSearch(item.name);
    setForm(f => ({ ...f, product: item.name, amount: item.sellPrice > 0 ? String(item.sellPrice) : f.amount }));
    setShowStockDrop(false);
  };

  const handleQuickAddStock = async () => {
    if (!quickStockName.trim()) { alert(sz.muhasebe.urunAdiZorunlu); return; }
    setQuickStockSaving(true);
    try {
      const r = await fetch('/api/stock', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ source:'PART', name: quickStockName.trim(), sellPrice: quickStockPrice||'0', buyPrice:'0', stockQty:'1', minStock:'1' }) });
      if (r.ok) {
        const d = await r.json();
        const si: StockItem = { id:d.id, source:'PART', name:d.name, sellPrice:Number(d.sellPrice), buyPrice:Number(d.buyPrice), stockQty:d.stockQty||1 };
        setAllStock(prev => [...prev, si]);
        selectStockItem(si);
        setQuickAddStock(false); setQuickStockName(''); setQuickStockPrice('');
        loadStock();
      } else { const d = await r.json(); alert(doldur(sz.fisler.hata, { n: d.error })); }
    } catch(e:any) { alert(doldur(sz.fisler.hata, { n: e.message })); }
    setQuickStockSaving(false);
  };

  const handleQuickAddCust = async () => {
    if (!quickCustForm.name.trim() || !quickCustForm.phone.trim()) { alert(sz.muhasebe.adTelefonZorunlu); return; }
    setQuickCustSaving(true);
    const res = await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(quickCustForm) });
    if (res.ok) {
      const newCust = await res.json();
      setAllCustomers(prev => [...prev, newCust]);
      selectFormCust(newCust);
      setQuickAddCust(false);
      setQuickCustForm({name:'', phone:'', address:''});
    } else {
      const d = await res.json();
      alert(doldur(sz.fisler.hata, { n: d.error || sz.muhasebe.bilinmeyenHata }));
    }
    setQuickCustSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { alert(sz.muhasebe.musteriSecin); return; }
    setSaving(true);
    const res = await fetch('/api/muhasebe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    if (res.ok) {
      resetForm();
      setShowForm(false); loadData(); if (selCust) loadDetail(selCust.id);
    } else { const d = await res.json(); alert(doldur(sz.fisler.hata, { n: d.error })); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(sz.muhasebe.silSor)) return;
    try {
      const res = await fetch(`/api/muhasebe?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(doldur(sz.muhasebe.silmeHatasi, { n: d.error })); return; }
      await loadData();
      if (selCust) await loadDetail(selCust.id);
    } catch {
      alert(sz.muhasebe.silmeBasarisiz);
    }
  };

  const openEdit = (e: Entry) => {
    setEditModal({id:e.id, type:e.type, product:e.product||'', amount:String(e.amount), method:e.method, notes:e.notes||'', date:new Date(e.date).toISOString().split('T')[0]});
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setEditSaving(true);
    const res = await fetch('/api/muhasebe', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(editModal)});
    if (res.ok) { setEditModal(null); loadData(); if (selCust) loadDetail(selCust.id); }
    else { const d = await res.json(); alert(doldur(sz.fisler.hata, { n: d.error })); }
    setEditSaving(false);
  };

  const formatPhone = (raw: string) => {
    let p = (raw || '').replace(/[^0-9]/g,'');
    if (p.startsWith('0090')) p = p.slice(2);            // 0090... -> 90...
    if (p.startsWith('90') && p.length === 12) return p;  // zaten 90 + 10 hane
    if (p.startsWith('0')) p = p.slice(1);                // 0532... -> 532...
    if (p.length === 10) return '90' + p;                 // 5XXXXXXXXX -> 90...
    return p.startsWith('90') ? p : '90' + p;
  };
  // Geçerli TR WhatsApp numarası mı? (90 + 10 hane). Boş/eksik numaralar elenir.
  const isValidWa = (raw: string) => /^90\d{10}$/.test(formatPhone(raw));

  // Modal açılınca kanal durumunu bir kez öğren
  useEffect(() => {
    if (!showBulkWA || channels) return;
    fetch('/api/sms/bulk').then(r => r.ok ? r.json() : null).then(d => { if (d) setChannels(d); }).catch(() => {});
  }, [showBulkWA, channels]);

  const sendWhatsApp = (cust: {name:string;phone:string}, debt: number) => {
    const phone = formatPhone(cust.phone);
    const msg = sablonDoldur(sz.toplu.tekMesaj, { ad: cust.name, borc: b.para(debt), telefon: cust.phone });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Açık servis fişlerini toplu olarak cariye işle (idempotent, güvenli)
  const backfillCari = async () => {
    if (!confirm(sz.muhasebe.aktarSor)) return;
    setBackfilling(true);
    try {
      const r = await fetch('/api/tickets/backfill-cari', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { alert(doldur(sz.muhasebe.aktarildi, { n: d.synced, toplam: d.processed })); loadData(); }
      else alert(d.error || sz.muhasebe.aktarilamadi);
    } catch { alert(sz.sayacTuru.sunucuYok); }
    setBackfilling(false);
  };

  // Kira + sayaç bedelini hesapla (otomatik) → kullanıcı onayıyla cariye ekle (otomatik EKLEMEZ)
  const addPeriodCharges = async () => {
    if (!selCust) return;
    try {
      const pr = await fetch(`/api/customers/${selCust.id}/period-charges`);
      const c = await pr.json().catch(() => ({}));
      if (!pr.ok) { alert(c.error || sz.muhasebe.hesaplanamadi); return; }
      const rent = c.rent || 0, counter = c.counter || 0;
      if (rent <= 0 && counter <= 0) { alert(sz.muhasebe.donemYok); return; }
      // Gösterilen tutar KDV DAHİL — cariye yazılan tutarın aynısı.
      // Net ve KDV ayrı satırda: bayi neyi onayladığını tahmin etmesin.
      const net = (c.rentNet || 0) + (c.counterNet || 0);
      const kdv = rent + counter - net;
      if (!confirm(doldur(sz.muhasebe.donemOnay, {
        donem: c.period, musteri: selCust.name,
        kira: b.para(rent), sayac: b.para(counter),
        net: b.para(net), oran: c.vatRate ?? 0, kdv: b.para(kdv),
        toplam: b.para(rent + counter),
      }))) return;
      const r = await fetch(`/api/customers/${selCust.id}/period-charges`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { alert(doldur(sz.muhasebe.donemEklendi, { n: d.added })); loadData(); loadDetail(selCust.id); }
      else alert(d.error || sz.muhasebe.eklenemedi);
    } catch { alert(sz.sayacTuru.sunucuYok); }
  };

  const debtors = customers.filter(c => c.balance > 0);
  const debtorsWithPhone = debtors.filter(c => isValidWa(c.phone)); // sadece geçerli telefonu olanlar
  const noPhoneCount = debtors.length - debtorsWithPhone.length;    // telefonu olmayan/bozuk borçlu sayısı

  const openBulkWA = () => {
    setBulkSelected(new Set(debtorsWithPhone.map(c => c.id)));
    setBulkIdx(-1);
    setBulkQueue([]);
    setShowBulkWA(true);
  };

  const bulkSendNext = () => {
    // Gönderim başında listeyi DONDUR (veri yenilenirse sıra kaymasın, atlama/çift olmasın).
    let list = bulkQueue;
    if (bulkIdx === -1) {
      list = debtorsWithPhone.filter(c => bulkSelected.has(c.id));
      setBulkQueue(list);
    }
    const nextIdx = bulkIdx + 1;
    if (nextIdx >= list.length) { setShowBulkWA(false); setBulkIdx(-1); return; }
    const c = list[nextIdx];
    const phone = formatPhone(c.phone);
    const msg = sablonDoldur(bulkMsgTpl, { ad: c.name, borc: b.para(c.balance), telefon: c.phone });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setBulkIdx(nextIdx);
  };

  // Toplu SMS: seçili borçlulara TEK TIKLA (sunucu üzerinden Netgsm). Mesaj sunucuda üretilir.
  const handleBulkSms = async () => {
    const ids = debtorsWithPhone.filter(c => bulkSelected.has(c.id)).map(c => c.id);
    if (!ids.length) return;
    if (!confirm(doldur(sz.toplu.smsOnay, { n: ids.length }))) return;
    setSmsSending(true);
    try {
      const res = await fetch('/api/sms/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerIds: ids, template: bulkMsgTpl }) });
      const d = await res.json();
      if (res.ok) {
        alert(doldur(sz.toplu.smsSonuc, { n: d.sent, ek: d.skipped ? doldur(sz.toplu.atlandi, { n: d.skipped }) : '' }));
        setShowBulkWA(false);
      } else alert(`❌ ${d.error || sz.toplu.smsHata}${d.code ? ` (${d.code})` : ''}`);
    } catch { alert(sz.toplu.baglantiHatasi); }
    setSmsSending(false);
  };

  // Toplu WhatsApp: seçili borçlulara TEK TIKLA (Meta Cloud API, onaylı şablon). Sunucu üzerinden.
  const handleBulkWa = async () => {
    const ids = debtorsWithPhone.filter(c => bulkSelected.has(c.id)).map(c => c.id);
    if (!ids.length) return;
    if (!confirm(doldur(sz.toplu.waOnay, { n: ids.length }))) return;
    setWaSending(true);
    try {
      const res = await fetch('/api/whatsapp/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerIds: ids }) });
      const d = await res.json();
      if (res.ok) {
        const ek = `${d.failed ? doldur(sz.toplu.basarisiz, { n: d.failed }) : ''}${d.skipped ? doldur(sz.toplu.atlandi, { n: d.skipped }) : ''}`;
        alert(`${doldur(sz.toplu.waSonuc, { n: d.sent, ek })}${d.errors?.length ? `\n\n${d.errors.join('\n')}` : ''}`);
        setShowBulkWA(false);
      } else alert(`❌ ${d.error || sz.toplu.waHata}`);
    } catch { alert(sz.toplu.baglantiHatasi); }
    setWaSending(false);
  };

  const handlePrint = () => {
    if (!selCust) { alert(sz.muhasebe.yazdirSec); return; }
    openPrintable(`/accounting/${selCust.id}/print`);
  };

  if (loading) return <div style={{padding:'2rem',color:'#6b7280'}}>{sz.genel.yukleniyor}</div>;

  if (error) return (
    <div style={{padding:'2rem',maxWidth:'600px',margin:'2rem auto'}}>
      <div style={{backgroundColor:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'0.75rem',padding:'1.5rem',textAlign:'center'}}>
        <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>⚠️</div>
        <h2 style={{color:'#dc2626',fontWeight:'700',margin:'0 0 0.5rem'}}>{sz.muhasebe.hataBaslik}</h2>
        <p style={{color:'#7f1d1d',fontSize:'0.9rem',margin:'0 0 1rem',lineHeight:'1.5'}}>{error}</p>
        <button onClick={() => { setLoading(true); loadData(); }} style={{padding:'0.625rem 1.5rem',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',fontSize:'0.9rem'}}>{sz.muhasebe.tekrarDene}</button>
      </div>
    </div>
  );

  return (
    <div style={{padding:'2rem',maxWidth:'1400px'}}>

      {/* HIZLI STOK EKLEME MODALİ */}
      {quickAddStock && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100}} onClick={()=>setQuickAddStock(false)}>
          <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',width:'420px',maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',overflow:'hidden'}}>
            <div style={{background:'linear-gradient(135deg,#15803d,#22c55e)',color:'white',padding:'1rem 1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:'700',fontSize:'1rem'}}>{sz.muhasebe.stokaEkleBaslik}</span>
              <button onClick={()=>setQuickAddStock(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <p style={{fontSize:'0.82rem',color:'#6b7280',margin:'0 0 1rem'}}>{sz.muhasebe.stokaEkleAlt}</p>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>{sz.muhasebe.urunAdi}</label>
                <input style={inp} value={quickStockName} onChange={e=>setQuickStockName(e.target.value)} placeholder={sz.muhasebe.urunAdiYer} autoFocus />
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={lbl}>{doldur(sz.muhasebe.satisFiyati, { birim: b.simge })} <span style={{fontWeight:'400',color:'#9ca3af'}}>{sz.muhasebe.formaGelir}</span></label>
                <input type="number" step="0.01" style={inp} value={quickStockPrice} onChange={e=>setQuickStockPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={()=>setQuickAddStock(false)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.genel.iptal}</button>
                <button onClick={handleQuickAddStock} disabled={quickStockSaving} style={{flex:2,padding:'0.625rem',backgroundColor:'#15803d',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:quickStockSaving?0.7:1}}>
                  {quickStockSaving ? sz.cihazHizli.ekleniyor : sz.muhasebe.stokaEkleBaslik}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOPLU WHATSAPP MODALI */}
      {showBulkWA && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}} onClick={() => setShowBulkWA(false)}>
          <div onClick={e => e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',width:'560px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 80px rgba(0,0,0,0.4)'}}>
            {/* Modal Başlık */}
            <div style={{background:'linear-gradient(135deg,#15803d,#22c55e)',color:'white',padding:'1rem 1.25rem',borderRadius:'1rem 1rem 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:'700',fontSize:'1.05rem'}}>{sz.toplu.baslik}</div>
                <div style={{fontSize:'0.78rem',opacity:0.85,marginTop:'0.15rem'}}>{doldur(sz.toplu.secili, { n: debtorsWithPhone.filter(c=>bulkSelected.has(c.id)).length })}</div>
              </div>
              <button onClick={() => setShowBulkWA(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'30px',height:'30px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>

            <div style={{padding:'1.25rem'}}>
              {bulkIdx === -1 ? (
                <>
                  {/* Mesaj Şablonu */}
                  <div style={{marginBottom:'1rem'}}>
                    <label style={{...lbl,color:'#374151',fontSize:'0.85rem'}}>{sz.toplu.sablon}</label>
                    <div style={{fontSize:'0.72rem',color:'#9ca3af',marginBottom:'0.35rem'}}>{sz.toplu.degiskenler} {(SABLON_DEGISKENLERI[b.dil] ?? SABLON_DEGISKENLERI.tr).map(v => (
                      <code key={v} style={{background:'#f3f4f6',padding:'0.1rem 0.3rem',borderRadius:'3px',marginRight:'0.25rem'}}>{v}</code>
                    ))}</div>
                    <textarea rows={5} style={{...inp,resize:'vertical',fontFamily:'inherit',lineHeight:'1.5'}} value={bulkMsgTpl} onChange={e => setBulkMsgTpl(e.target.value)} />
                  </div>

                  {/* Müşteri Listesi */}
                  <div style={{marginBottom:'1rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                      <label style={{...lbl,color:'#374151',fontSize:'0.85rem',marginBottom:0}}>{sz.toplu.borclular}</label>
                      <div style={{display:'flex',gap:'0.5rem'}}>
                        <button onClick={() => setBulkSelected(new Set(debtorsWithPhone.map(c=>c.id)))} style={{fontSize:'0.72rem',color:'#2563eb',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>{sz.toplu.tumunuSec}</button>
                        <span style={{color:'#d1d5db'}}>|</span>
                        <button onClick={() => setBulkSelected(new Set())} style={{fontSize:'0.72rem',color:'#dc2626',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>{sz.toplu.hicbiri}</button>
                      </div>
                    </div>
                    {noPhoneCount > 0 && (
                      <div style={{fontSize:'0.72rem',color:'#b45309',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'0.4rem',padding:'0.4rem 0.6rem',marginBottom:'0.5rem'}}>{doldur(sz.toplu.telefonsuz, { n: noPhoneCount })}</div>
                    )}
                    <div style={{border:'1px solid #e5e7eb',borderRadius:'0.5rem',overflow:'hidden',maxHeight:'220px',overflowY:'auto'}}>
                      {debtorsWithPhone.map(c => (
                        <label key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.6rem 0.875rem',borderBottom:'1px solid #f3f4f6',cursor:'pointer',backgroundColor:bulkSelected.has(c.id)?'#f0fdf4':'white'}}>
                          <input type="checkbox" checked={bulkSelected.has(c.id)} onChange={e => {
                            const s = new Set(bulkSelected);
                            e.target.checked ? s.add(c.id) : s.delete(c.id);
                            setBulkSelected(s);
                          }} style={{accentColor:'#22c55e',width:'16px',height:'16px'}} />
                          <div style={{flex:1}}>
                            <div style={{fontWeight:'600',fontSize:'0.875rem'}}>{c.name}</div>
                            <div style={{fontSize:'0.72rem',color:'#6b7280'}}>📞 {c.phone}</div>
                          </div>
                          <span style={{fontWeight:'700',color:'#ef4444',fontSize:'0.875rem'}}>{b.para(c.balance)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Önizleme */}
                  {debtorsWithPhone[0] && bulkSelected.has(debtorsWithPhone[0].id) && (
                    <div style={{backgroundColor:'#f0fdf4',border:'1px solid #86efac',borderRadius:'0.5rem',padding:'0.75rem',marginBottom:'1rem'}}>
                      <div style={{fontSize:'0.72rem',color:'#15803d',fontWeight:'600',marginBottom:'0.35rem'}}>{doldur(sz.toplu.onizleme, { n: debtorsWithPhone[0].name })}</div>
                      <div style={{fontSize:'0.8rem',color:'#374151',whiteSpace:'pre-wrap',lineHeight:'1.5'}}>
                        {sablonDoldur(bulkMsgTpl, { ad: debtorsWithPhone[0].name, borc: b.para(debtorsWithPhone[0].balance), telefon: debtorsWithPhone[0].phone })}
                      </div>
                    </div>
                  )}

                  {/* Toplu kanallar — sadece KURULU olan buton olarak çıkar; kurulu değilse hata vermez, "kurulum gerekli" der */}
                  {channels?.sms !== false && (
                    <button onClick={handleBulkSms} disabled={bulkSelected.size===0 || smsSending} style={{width:'100%',padding:'0.8rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'700',fontSize:'0.95rem',opacity:(bulkSelected.size===0||smsSending)?0.5:1,marginBottom:'0.6rem'}}>
                      {smsSending ? `📩 ${sz.toplu.gonderiliyor}` : doldur(sz.toplu.smsGonder, { n: debtorsWithPhone.filter(c=>bulkSelected.has(c.id)).length })}
                    </button>
                  )}
                  {channels?.whatsapp !== false && (
                    <button onClick={handleBulkWa} disabled={bulkSelected.size===0 || waSending} style={{width:'100%',padding:'0.8rem',backgroundColor:'#16a34a',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'700',fontSize:'0.95rem',opacity:(bulkSelected.size===0||waSending)?0.5:1,marginBottom:'0.35rem'}}>
                      {waSending ? `🟢 ${sz.toplu.gonderiliyor}` : doldur(sz.toplu.waGonder, { n: debtorsWithPhone.filter(c=>bulkSelected.has(c.id)).length })}
                    </button>
                  )}
                  {(channels?.sms || channels?.whatsapp || channels === null) && (
                    <div style={{fontSize:'0.68rem',color:'#9ca3af',textAlign:'center',marginBottom:'0.6rem'}}>{sz.toplu.kaynakNot}</div>
                  )}
                  {channels && (!channels.sms || !channels.whatsapp) && (
                    <div style={{fontSize:'0.72rem',color:'#64748b',background:'#f8fafc',border:'1px dashed #cbd5e1',borderRadius:'0.5rem',padding:'0.6rem 0.75rem',marginBottom:'0.7rem',lineHeight:1.6}}>
                      ⚙️ <b>{sz.toplu.hatYokBaslik}</b>{!channels.sms && !channels.whatsapp ? '' : !channels.sms ? ' (SMS)' : ' (WhatsApp)'}
                      {!channels.sms && <>{sz.toplu.hatYokSms}</>}{!channels.whatsapp && <>{sz.toplu.hatYokWa}</>}{sz.toplu.hatYokSon}
                      <br />{sz.toplu.hatYokAlt}
                    </div>
                  )}
                  <div style={{fontSize:'0.72rem',color:'#9ca3af',textAlign:'center',marginBottom:'0.5rem'}}>
                    {channels && !channels.sms && !channels.whatsapp ? sz.toplu.ucretsiz : sz.toplu.veyaUcretsiz}
                  </div>
                  {(() => {
                    const solo = !!channels && !channels.sms && !channels.whatsapp; // tek seçenek kaldıysa ana buton gibi görünsün
                    return (
                      <button onClick={bulkSendNext} disabled={bulkSelected.size===0} style={{width:'100%',padding:solo?'0.8rem':'0.6rem',backgroundColor:solo?'#16a34a':'white',color:solo?'white':'#15803d',border:solo?'none':'1px solid #86efac',borderRadius:'0.5rem',cursor:'pointer',fontWeight:solo?'700':'600',fontSize:solo?'0.95rem':'0.88rem',opacity:bulkSelected.size===0?0.5:1}}>
                        {doldur(sz.toplu.tekTekAc, { n: debtorsWithPhone.filter(c=>bulkSelected.has(c.id)).length })}
                      </button>
                    );
                  })()}
                </>
              ) : (
                // Gönderim aşaması
                <>
                  <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
                    <div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📱</div>
                    <div style={{fontWeight:'700',fontSize:'1.1rem',color:'#15803d'}}>
                      {doldur(sz.toplu.gonderildi, { n: bulkIdx + 1, toplam: bulkQueue.length })}
                    </div>
                    <div style={{color:'#6b7280',fontSize:'0.85rem',marginTop:'0.25rem'}}>{sz.toplu.waAcildi}</div>
                  </div>

                  {/* İlerleme çubuğu */}
                  <div style={{backgroundColor:'#f3f4f6',borderRadius:'9999px',height:'8px',marginBottom:'1.25rem'}}>
                    <div style={{backgroundColor:'#22c55e',borderRadius:'9999px',height:'8px',width:`${((bulkIdx+1)/bulkQueue.length)*100}%`,transition:'width 0.3s'}} />
                  </div>

                  {/* Gönderilen kişi */}
                  {(() => { const list=bulkQueue; const sent=list.slice(0,bulkIdx+1); const remaining=list.slice(bulkIdx+1); return (
                    <>
                      <div style={{border:'1px solid #e5e7eb',borderRadius:'0.5rem',overflow:'hidden',maxHeight:'180px',overflowY:'auto',marginBottom:'1rem'}}>
                        {sent.map((c,i) => (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0.875rem',borderBottom:'1px solid #f3f4f6',backgroundColor:'#f0fdf4'}}>
                            <span style={{color:'#22c55e',fontWeight:'700'}}>✓</span>
                            <span style={{fontSize:'0.85rem',flex:1}}>{c.name}</span>
                            <span style={{fontSize:'0.75rem',color:'#ef4444',fontWeight:'600'}}>{b.para(c.balance)}</span>
                          </div>
                        ))}
                        {remaining.map(c => (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0.875rem',borderBottom:'1px solid #f3f4f6',opacity:0.5}}>
                            <span style={{color:'#d1d5db'}}>○</span>
                            <span style={{fontSize:'0.85rem',flex:1}}>{c.name}</span>
                            <span style={{fontSize:'0.75rem',color:'#ef4444'}}>{b.para(c.balance)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ); })()}

                  <div style={{display:'flex',gap:'0.75rem'}}>
                    <button onClick={() => {setShowBulkWA(false); setBulkIdx(-1);}} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.toplu.bitir}</button>
                    <button onClick={bulkSendNext} style={{flex:2,padding:'0.625rem',backgroundColor:'#22c55e',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'700',fontSize:'0.9rem'}}>
                      {bulkIdx + 1 >= bulkQueue.length ? sz.toplu.tamamlandi : doldur(sz.toplu.siradaki, { n: bulkQueue[bulkIdx+1]?.name ?? '' })}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIZLI MÜŞTERİ EKLEME MODALI */}
      {quickAddCust && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={() => setQuickAddCust(false)}>
          <div onClick={e => e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',width:'420px',maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',overflow:'hidden'}}>
            <div style={{background:'linear-gradient(135deg,#1e3a5f,#2563eb)',color:'white',padding:'1rem 1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:'700',fontSize:'1rem'}}>{sz.muhasebe.yeniMusteriBaslik}</span>
              <button onClick={() => setQuickAddCust(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>{sz.muhasebe.adSoyad}</label>
                <input style={inp} value={quickCustForm.name} onChange={e => setQuickCustForm(f=>({...f,name:e.target.value}))} placeholder={sz.muhasebe.musteriAdiYer} autoFocus />
              </div>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>{sz.muhasebe.telefonZorunlu}</label>
                <input style={inp} value={quickCustForm.phone} onChange={e => setQuickCustForm(f=>({...f,phone:e.target.value}))} placeholder={sz.muhasebe.telefonYer} />
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={lbl}>{sz.fisYeni.adres}</label>
                <input style={inp} value={quickCustForm.address} onChange={e => setQuickCustForm(f=>({...f,address:e.target.value}))} placeholder={sz.muhasebe.adresYer} />
              </div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={() => setQuickAddCust(false)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.genel.iptal}</button>
                <button onClick={handleQuickAddCust} disabled={quickCustSaving} style={{flex:2,padding:'0.625rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:quickCustSaving?0.7:1}}>
                  {quickCustSaving ? sz.genel.kaydediliyor : sz.muhasebe.musteriEkleSec}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* flexWrap + minWidth: dar ekranda buton grubu küçülemediği için
          başlığın ÜSTÜNE biniyordu (telefonda "Muhasebe" yazısı butonların
          altında kalıyordu). Artık alt satıra iniyor. */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem'}}>
        <div style={{minWidth:'12rem',flex:'1 1 16rem'}}>
          {/* "Cari hesap" jargonu kaldırıldı: bayi teknik değil, bu ekrandan
              tek bir şey soruyor — kim bana ne kadar borçlu. */}
          <h1 style={{fontSize:'1.875rem',fontWeight:'bold',margin:0}}>{sz.muhasebe.baslik}</h1>
          <p style={{color:'#6b7280',margin:'0.25rem 0 0'}}>{sz.muhasebe.alt}</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          {activeTab==='accounting' && (
            <>
              <button onClick={handlePrint} style={{padding:'0.625rem 1rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.fisDetay.yazdir}</button>
              {/* Muhasebeciye giden dosya. Borç ekrandakiyle AYNI
                  kaynaktan (lib/musteri-bakiye.ts) — iki yer iki farklı
                  rakam gösterirse hangisine inanılacağı belli olmaz. */}
              <a href="/api/disa-aktar?tur=cari" title={sz.muhasebe.excelIpucu} style={{padding:'0.625rem 1rem',backgroundColor:'#0f2253',color:'white',borderRadius:'0.5rem',textDecoration:'none',fontWeight:500,fontSize:'0.875rem',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center'}}>{sz.genel.excelIndir}</a>
              <button onClick={backfillCari} disabled={backfilling} title={sz.muhasebe.fisleriAktarIpucu} style={{padding:'0.625rem 1rem',backgroundColor:'#eef2ff',color:'#4338ca',border:'1px solid #c7d2fe',borderRadius:'0.5rem',cursor:backfilling?'not-allowed':'pointer',fontWeight:'600',opacity:backfilling?0.6:1}}>{backfilling ? sz.muhasebe.aktariliyor : sz.muhasebe.fisleriAktar}</button>
              {debtors.length > 0 && (
                <button onClick={openBulkWA} style={{padding:'0.625rem 1rem',backgroundColor:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',display:'flex',alignItems:'center',gap:'0.4rem'}}>
                  {sz.muhasebe.topluHatirlatma} <span style={{backgroundColor:'#15803d',color:'white',borderRadius:'9999px',padding:'0.1rem 0.45rem',fontSize:'0.75rem'}}>{debtors.length}</span>
                </button>
              )}
              <button onClick={()=>{ if(showForm){resetForm();setShowForm(false);}else{setShowForm(true);if(selCust)selectFormCust({id:selCust.id,name:selCust.name,phone:selCust.phone});} }} style={{backgroundColor:'#3b82f6',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'500',cursor:'pointer'}}>
                {showForm ? sz.muhasebe.iptalKisa : sz.muhasebe.yeniKayit}
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.625rem',padding:'0.3rem',marginBottom:'1.5rem',width:'fit-content'}} className="print-hide">
        {([['accounting',sz.muhasebe.sekme.muhasebe],['expense',sz.muhasebe.sekme.gider],['stock',sz.muhasebe.sekme.stok]] as [string,string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k as any)} style={{
            padding:'0.5rem 1.25rem',borderRadius:'0.375rem',border:'none',cursor:'pointer',fontSize:'0.9rem',
            fontWeight:activeTab===k?'700':'400', backgroundColor:activeTab===k?'white':'transparent',
            color:activeTab===k?'#1e3a5f':'#6b7280', boxShadow:activeTab===k?'0 1px 3px rgba(0,0,0,0.12)':'none',
            transition:'all 0.15s'
          }}>{l}</button>
        ))}
      </div>

      {/* STOK SEKMESI */}
      {activeTab==='stock' && (
        <StockTab
          onSelectForSale={(item)=>{ selectStockItem(item); setActiveTab('accounting' as any); setShowForm(true); }}
          onStockChanged={loadStock}
        />
      )}

      {/* GİDER SEKMESİ */}
      {activeTab==='expense' && <ExpenseTab />}

      {/* MUHASEBE SEKMESI */}
      {activeTab==='accounting' && <>

      {/* ── TEK GERÇEK: TOPLAM ALACAK ────────────────────────────────────
          Eskiden dört eşit kart vardı (Toplam Satış / Toplam Ödeme / Toplam
          Borç / Borçlu Müşteri) ve hepsi YALNIZ servis kalemlerini sayıyordu;
          kira-sayaç faturası borcu bu ekranda hiç görünmüyordu. Artık tek
          büyük sayı var — "bu bayiye toplam ne kadar girecek" — ve altında
          nereden geldiğinin kırılımı. */}
      {/* auto-fit: geniş ekranda üç kart yan yana, telefonda alt alta.
          Sabit üç sütun 375 px'de taşıyordu — rakamın sonu kesiliyordu
          (₺17.103,0) ve üçüncü kart hiç görünmüyordu. */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(13rem,1fr))',gap:'1rem',marginBottom:'1.5rem'}} className="print-hide">
        <div style={{backgroundColor:'#fef2f2',borderRadius:'0.75rem',padding:'1.25rem',border:'1px solid #fecaca'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.35rem'}}>
            <span style={{fontSize:'1.25rem'}}>💰</span>
            <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{sz.muhasebe.toplamAlacak}</span>
          </div>
          <div style={{fontSize:'2rem',fontWeight:'bold',color:'#ef4444',lineHeight:1.1}}>
            {b.para(Number(summary.totalDebt))}
          </div>
          <div style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:'0.35rem'}}>
            {doldur(sz.muhasebe.alacakAlt, { n: summary.debtorCount })}
          </div>
        </div>
        <div style={{backgroundColor:'#fffbeb',borderRadius:'0.75rem',padding:'1.25rem',border:'1px solid #fde68a'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}>
            <span style={{fontSize:'1.25rem'}}>🔧</span>
            <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{sz.muhasebe.servisten}</span>
          </div>
          <div style={{fontSize:'1.4rem',fontWeight:'bold',color:'#f59e0b'}}>
            {b.para(Number(summary.servisAlacak))}
          </div>
        </div>
        <div style={{backgroundColor:'#eff6ff',borderRadius:'0.75rem',padding:'1.25rem',border:'1px solid #bfdbfe'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}>
            <span style={{fontSize:'1.25rem'}}>🏷️</span>
            <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{sz.muhasebe.kiraSayactan}</span>
          </div>
          <div style={{fontSize:'1.4rem',fontWeight:'bold',color:'#3b82f6'}}>
            {b.para(Number(summary.faturaAlacak))}
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.5rem',alignItems:'center'}} className="print-hide">
        <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.5rem',padding:'0.25rem'}}>
          {([['all',sz.genel.tumu],['unpaid',sz.muhasebe.filtre.borclu],['paid',sz.muhasebe.filtre.temiz]] as const).map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'0.5rem 1rem',borderRadius:'0.375rem',border:'none',cursor:'pointer',fontSize:'0.85rem',
              fontWeight:filter===k?'600':'400', backgroundColor:filter===k?'white':'transparent',
              color:filter===k?'#374151':'#6b7280', boxShadow:filter===k?'0 1px 2px rgba(0,0,0,0.1)':'none',
            }}>{l}</button>
          ))}
        </div>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}>🔍</span>
          <input placeholder={sz.muhasebe.musteriAraYer} value={search} onChange={e => setSearch(e.target.value)} style={{...inp,paddingLeft:'2.25rem',backgroundColor:'#f9fafb'}} />
        </div>
      </div>

      {/* YENİ KAYIT FORMU */}
      {showForm && (
        <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',padding:'1.5rem',marginBottom:'1.5rem',border:'1px solid #e5e7eb'}} className="print-hide">
          <h2 style={{fontWeight:'600',marginBottom:'1rem',fontSize:'1rem'}}>{sz.muhasebe.yeniKayitBaslik}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
              {(['SALE','PAYMENT'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm({...form,type:t})} style={{
                  flex:1,padding:'0.75rem',borderRadius:'0.5rem',border:'none',cursor:'pointer',fontWeight:'600',
                  backgroundColor:form.type===t?(t==='SALE'?'#f59e0b':'#10b981'):'#f3f4f6',
                  color:form.type===t?'white':'#374151',
                }}>{t==='SALE'?sz.muhasebe.satisUrun:sz.muhasebe.odemeKisa}</button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(11rem,1fr))',gap:'1rem',marginBottom:'1rem'}}>
              <div style={{position:'relative'}}>
                <label style={lbl}>{sz.muhasebe.musteriZorunlu}</label>
                <input
                  type="text"
                  style={inp}
                  value={formCustSearch}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { setFormCustSearch(e.target.value); setShowCustDrop(true); if(!e.target.value){ setFormSelCust(null); setForm(f=>({...f,customerId:''})); } }}
                  onFocus={() => setShowCustDrop(true)}
                  placeholder={sz.muhasebe.musteriYer}
                  autoComplete="off"
                />
                {formSelCust && (
                  <span style={{position:'absolute',right:'0.5rem',top:'2rem',color:'#10b981',fontSize:'0.8rem'}}>✓</span>
                )}
                {showCustDrop && formCustSearch && filteredFormCusts.length > 0 && (
                  <div onClick={e => e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,backgroundColor:'white',border:'1px solid #d1d5db',borderRadius:'0.5rem',maxHeight:'200px',overflowY:'auto',boxShadow:'0 4px 12px rgba(0,0,0,0.15)',marginTop:'2px'}}>
                    {filteredFormCusts.slice(0,20).map(c => (
                      <div key={c.id} onClick={() => selectFormCust(c)} style={{padding:'0.45rem 0.75rem',cursor:'pointer',fontSize:'0.85rem',borderBottom:'1px solid #f3f4f6',backgroundColor:form.customerId===c.id?'#eff6ff':'white'}}
                        onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#f3f4f6')}
                        onMouseLeave={e=>(e.currentTarget.style.backgroundColor=form.customerId===c.id?'#eff6ff':'white')}>
                        <div style={{fontWeight:'500'}}>{c.name}</div>
                        <div style={{fontSize:'0.72rem',color:'#6b7280'}}>{c.phone}</div>
                      </div>
                    ))}
                    <div onClick={() => { setShowCustDrop(false); setQuickCustForm(f=>({...f,name:formCustSearch})); setQuickAddCust(true); }} style={{padding:'0.5rem 0.75rem',cursor:'pointer',fontSize:'0.82rem',color:'#2563eb',fontWeight:'600',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'0.4rem'}}
                      onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#eff6ff')}
                      onMouseLeave={e=>(e.currentTarget.style.backgroundColor='white')}>
                      <span style={{fontSize:'1rem'}}>+</span> {sz.muhasebe.yeniMusteriEkle}
                    </div>
                  </div>
                )}
                {showCustDrop && formCustSearch && filteredFormCusts.length === 0 && (
                  <div onClick={e => e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,backgroundColor:'white',border:'1px solid #d1d5db',borderRadius:'0.5rem',boxShadow:'0 4px 12px rgba(0,0,0,0.1)',marginTop:'2px'}}>
                    <div style={{padding:'0.6rem 0.75rem',fontSize:'0.8rem',color:'#9ca3af'}}>{sz.muhasebe.musteriBulunamadi}</div>
                    <div onClick={() => { setShowCustDrop(false); setQuickCustForm(f=>({...f,name:formCustSearch})); setQuickAddCust(true); }} style={{padding:'0.5rem 0.75rem',cursor:'pointer',fontSize:'0.82rem',color:'#2563eb',fontWeight:'600',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'0.4rem'}}
                      onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#eff6ff')}
                      onMouseLeave={e=>(e.currentTarget.style.backgroundColor='white')}>
                      <span style={{fontSize:'1rem'}}>+</span> {doldur(sz.muhasebe.adiylaEkle, { q: formCustSearch })}
                    </div>
                  </div>
                )}
              </div>
              {form.type === 'SALE' && (
                <div style={{position:'relative'}}>
                  <label style={lbl}>{sz.muhasebe.urunHizmet} <span style={{fontWeight:'400',color:'#9ca3af',fontSize:'0.72rem'}}>{sz.muhasebe.stoktanSec}</span></label>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    <div style={{position:'relative',flex:1}}>
                      <input style={inp} value={formStockSearch}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>{ const v=e.target.value; setFormStockSearch(v); setForm(f=>({...f,product:v})); setShowStockDrop(true); if(!v) setFormStockItem(null); }}
                        onFocus={()=>setShowStockDrop(true)}
                        placeholder={sz.muhasebe.stokAraYer} autoComplete="off" />
                      {formStockItem && <span style={{position:'absolute',right:'0.5rem',top:'50%',transform:'translateY(-50%)',color:'#10b981',fontSize:'0.85rem'}}>✓</span>}
                      {showStockDrop && (
                        <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,right:0,zIndex:300,backgroundColor:'white',border:'1px solid #d1d5db',borderRadius:'0.5rem',maxHeight:'200px',overflowY:'auto',boxShadow:'0 4px 16px rgba(0,0,0,0.15)',marginTop:'2px'}}>
                          {allStock.filter(i=> !formStockSearch || i.name.toLowerCase().includes(formStockSearch.toLowerCase())).slice(0,12).map(item=>(
                            <div key={item.id} onClick={()=>selectStockItem(item)}
                              style={{padding:'0.45rem 0.75rem',cursor:'pointer',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                              onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#f3f4f6')}
                              onMouseLeave={e=>(e.currentTarget.style.backgroundColor='white')}>
                              <div>
                                <div style={{fontWeight:'600',fontSize:'0.85rem'}}>{item.name}</div>
                                <div style={{fontSize:'0.7rem',color:'#9ca3af'}}>{item.source==='PART'?'🔧':'🖨️'} {doldur(sz.muhasebe.stokAdet, { n: item.stockQty })}</div>
                              </div>
                              {item.sellPrice>0 && <span style={{fontWeight:'700',color:'#10b981',fontSize:'0.85rem',whiteSpace:'nowrap'}}>{b.para(item.sellPrice)}</span>}
                            </div>
                          ))}
                          {allStock.length===0 && <div style={{padding:'0.6rem 0.75rem',fontSize:'0.8rem',color:'#9ca3af'}}>{sz.muhasebe.stokBulunamadi}</div>}
                          <div onClick={()=>{ setShowStockDrop(false); setQuickStockName(formStockSearch); setQuickAddStock(true); }}
                            style={{padding:'0.5rem 0.75rem',cursor:'pointer',fontSize:'0.82rem',color:'#15803d',fontWeight:'600',borderTop:'2px solid #e5e7eb',backgroundColor:'#f0fdf4',display:'flex',alignItems:'center',gap:'0.4rem'}}
                            onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#dcfce7')}
                            onMouseLeave={e=>(e.currentTarget.style.backgroundColor='#f0fdf4')}>
                            {doldur(sz.muhasebe.stokaEkleSec, { q: formStockSearch || sz.muhasebe.yeniUrun })}
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" title={sz.muhasebe.stokaEkleIpucu}
                      onClick={()=>{ setQuickStockName(formStockSearch); setQuickAddStock(true); }}
                      style={{padding:'0 0.75rem',backgroundColor:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600',whiteSpace:'nowrap'}}>
                      📦+
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label style={lbl}>{doldur(sz.muhasebe.tutar, { birim: b.simge })}</label>
                <input required type="number" step="0.01" min="0" style={inp} value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(11rem,1fr))',gap:'1rem',marginBottom:'1rem'}}>
              <div>
                <label style={lbl}>{sz.muhasebe.odemeYontemi}</label>
                <select style={inp} value={form.method} onChange={e => setForm({...form,method:e.target.value})}>
                  {METHODS.map(k => <option key={k} value={k}>{yontem(k)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{sz.genel.tarih}</label>
                <input type="date" style={inp} value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>{sz.muhasebe.not}</label>
                <input style={inp} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder={sz.muhasebe.istegeBagli} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{backgroundColor:form.type==='SALE'?'#f59e0b':'#10b981',color:'white',padding:'0.625rem 1.5rem',borderRadius:'0.5rem',border:'none',fontWeight:'600',cursor:'pointer',opacity:saving?0.7:1}}>
              {saving ? sz.genel.kaydediliyor : (form.type==='SALE'?sz.muhasebe.satisKaydet:sz.muhasebe.odemeKaydet)}
            </button>
          </form>
        </div>
      )}

      {/* ANA İÇERİK: MÜŞTERİ LİSTESİ + DETAY */}
      {/* 340 px'lik sabit sol sütun telefonda da duruyordu; sağdaki müşteri
          detay paneli ekranın 175 px dışında kalıyordu — bayi telefonda bir
          müşteriye dokunduğunda açılan paneli göremiyordu. auto-fit ile
          telefonda alt alta, masaüstünde yine liste solda / detay sağda. */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(19rem,1fr))',gap:'1.5rem'}}>
        {/* SOL: MÜŞTERİ LİSTESİ */}
        <div>
          <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',overflow:'hidden',maxHeight:'75vh',overflowY:'auto'}}>
            {customers.length === 0 ? (
              <div style={{padding:'1.75rem 1rem',textAlign:'center',color:'#6b7280',fontSize:'0.85rem'}}>
                <div style={{fontSize:'1.5rem',marginBottom:'0.35rem'}}>👥</div>
                <div style={{fontWeight:600,color:'#111827',marginBottom:'0.15rem'}}>{sz.muhasebe.musteriYok}</div>
                <div style={{marginBottom:'0.85rem'}}>{sz.muhasebe.musteriYokAlt}</div>
                <a href="/customers/new" style={{
                  display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'2.5rem',
                  padding:'0 1rem',backgroundColor:'#1e3a5f',color:'white',borderRadius:'0.5rem',
                  textDecoration:'none',fontWeight:600,fontSize:'0.85rem',
                }}>{sz.muhasebe.ilkMusteri}</a>
              </div>
            ) : customers.map(c => (
              <div key={c.id} onClick={() => setSelCust(c)} style={{
                padding:'0.875rem 1rem',cursor:'pointer',borderBottom:'1px solid #f3f4f6',
                backgroundColor:selCust?.id===c.id?'#eff6ff':'white',
                borderLeft:selCust?.id===c.id?'3px solid #3b82f6':'3px solid transparent',
                transition:'all 0.1s',
              }}
              onMouseEnter={e => {if(selCust?.id!==c.id) (e.currentTarget).style.backgroundColor='#f9fafb';}}
              onMouseLeave={e => {if(selCust?.id!==c.id) (e.currentTarget).style.backgroundColor='white';}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'600',fontSize:'0.9rem',color:'#111827'}}>{c.name}</div>
                    <div style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.1rem'}}>📞 {c.phone}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    {c.balance > 0 ? (
                      <span style={{fontSize:'0.85rem',fontWeight:'700',color:'#ef4444'}}>{b.para(c.balance)}</span>
                    ) : (
                      <span style={{fontSize:'0.75rem',color:'#10b981',fontWeight:'600'}}>{sz.muhasebe.temiz}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ: MÜŞTERİ DETAY */}
        <div id="print-area">
          {/* Buradaki yazdırma antetinde TEK BİR BAYİNİN adı, adresi ve telefonu
              gömülüydü ("SAYGILI FOTOKOPİ … KÜTAHYA"). Çok kiracılı üründe
              başka bir bayi Ctrl+P yaptığında müşterisine BAŞKASININ antetli
              ekstresi çıkıyordu. Kaldırıldı: ekstrenin gerçek yeri
              /accounting/[customerId]/print — orası anteti bayinin kendi
              kaydından (tenant.name) alıyor. */}
          {!selCust ? (
            <div style={{backgroundColor:'white',borderRadius:'0.75rem',padding:'2.5rem 1.5rem',textAlign:'center',color:'#6b7280',border:'2px dashed #e5e7eb'}}>
              {/* Liste boşken "soldan seç" demek çelişki: seçilecek bir şey yok. */}
              <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>{customers.length === 0 ? '🧾' : '👈'}</div>
              <div style={{fontWeight:600,color:'#111827',marginBottom:'0.2rem'}}>
                {customers.length === 0 ? sz.muhasebe.bosBaslik : sz.muhasebe.secBaslik}
              </div>
              <div style={{fontSize:'0.85rem'}}>
                {customers.length === 0 ? sz.muhasebe.bosAlt : sz.muhasebe.secAlt}
              </div>
            </div>
          ) : detailLoading ? (
            <div style={{padding:'2rem',textAlign:'center',color:'#6b7280'}}>{sz.genel.yukleniyor}</div>
          ) : detail ? (
            <>
              {/* MÜŞTERİ BAŞLIK */}
              <div style={{backgroundColor:'#1e3a5f',borderRadius:'0.75rem',padding:'1.25rem',marginBottom:'1rem',color:'white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <h2 style={{fontSize:'1.25rem',fontWeight:'700',margin:0}}>{detail.customer.name}</h2>
                    <div style={{fontSize:'0.8rem',opacity:0.8,marginTop:'0.25rem'}}>📞 {detail.customer.phone} {detail.customer.address && `• 📍 ${detail.customer.address}`}</div>
                  </div>
                  <div style={{display:'flex',gap:'0.5rem'}} className="print-hide">
                    <button onClick={() => openPrintable(`/accounting/${selCust.id}/print`)} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>{sz.muhasebe.ekstreYazdir}</button>
                    {detail.summary.balance > 0 && (
                      <button onClick={() => sendWhatsApp(detail.customer, detail.summary.balance)} style={{backgroundColor:'#25d366',color:'white',border:'none',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>📱 WhatsApp</button>
                    )}
                    <button onClick={addPeriodCharges} title={sz.muhasebe.kiraSayacIpucu} style={{backgroundColor:'rgba(255,255,255,0.18)',color:'white',border:'1px solid rgba(255,255,255,0.35)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'700'}}>{sz.muhasebe.kiraSayacEkle}</button>
                    <button onClick={() => { selectFormCust({ id: selCust.id, name: selCust.name, phone: selCust.phone }); setShowForm(true); }} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'500'}}>{sz.muhasebe.kayitEkle}</button>
                  </div>
                </div>
                {/* Tek gerçek önce, kırılımı sonra: bayinin sorduğu soru
                    "bu müşteri bana ne kadar borçlu" — cevabı büyük yazıyor. */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem',marginTop:'1rem'}}>
                  <div style={{backgroundColor:'rgba(255,255,255,0.14)',borderRadius:'0.5rem',padding:'0.85rem'}}>
                    <div style={{fontSize:'0.7rem',opacity:0.75,marginBottom:'0.25rem'}}>
                      {detail.summary.balance>0?sz.muhasebe.toplamBorcu:detail.summary.balance<0?sz.muhasebe.fazlaOdeme:sz.muhasebe.borcuYok}
                    </div>
                    <div style={{fontSize:'1.6rem',fontWeight:'800',lineHeight:1.1,color:detail.summary.balance>0?'#fca5a5':detail.summary.balance<0?'#6ee7b7':'#d1d5db'}}>
                      {b.para(Math.abs(detail.summary.balance))}
                    </div>
                  </div>
                  <div style={{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.75rem'}}>
                    <div style={{fontSize:'0.7rem',opacity:0.7,marginBottom:'0.25rem'}}>{sz.muhasebe.servistenKisa}</div>
                    <div style={{fontSize:'1.05rem',fontWeight:'700',color:'#fbbf24'}}>{b.para(Math.abs(detail.summary.servisBorc ?? 0))}</div>
                  </div>
                  <div style={{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.75rem'}}>
                    <div style={{fontSize:'0.7rem',opacity:0.7,marginBottom:'0.25rem'}}>{sz.muhasebe.kiraSayacKisa}</div>
                    <div style={{fontSize:'1.05rem',fontWeight:'700',color:'#93c5fd'}}>{b.para(Math.abs(detail.summary.faturaBorc ?? 0))}</div>
                  </div>
                </div>
              </div>

              {/* İŞLEM GEÇMİŞİ */}
              <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',overflow:'hidden'}}>
                {/* ── BİRLEŞİK EKSTRE ────────────────────────────────────
                    Servis kalemleri + kira/sayaç faturaları TEK listede,
                    tarih sıralı. Eskiden burada yalnız servis kalemleri
                    vardı; müşterinin kira faturası bu ekranda hiç
                    görünmüyordu ve bakiye eksik okunuyordu.
                    Sütunlar da sadeleşti: Yöntem/Kaydeden/Not kolonları
                    bayinin sorduğu soruya cevap vermiyordu, kaldırıldı
                    (detay satırın altında küçük yazıyla duruyor). */}
                {(() => {
                  const satirlar = detail.ekstre ?? [];
                  return (
                    <>
                      <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:'600',fontSize:'0.9rem'}}>{sz.muhasebe.hareketler}</span>
                        <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{doldur(sz.muhasebe.hareketSayisi, { n: satirlar.length })}</span>
                      </div>
                      {satirlar.length === 0 ? (
                        <div style={{padding:'3rem',textAlign:'center',color:'#9ca3af',fontSize:'0.85rem'}}>
                          {sz.muhasebe.hareketYok}
                          <br/>
                          <button onClick={() => { selectFormCust(selCust as any); setShowForm(true); }} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#3b82f6',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.8rem'}} className="print-hide">{sz.muhasebe.kayitEkle}</button>
                        </div>
                      ) : (
                        <table style={{width:'100%',borderCollapse:'collapse'}}>
                          <thead>
                            <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                              {[sz.genel.tarih,sz.muhasebe.sutunNereden,sz.muhasebe.sutunAciklama,sz.genel.tutar,''].map((h,hi) => (
                                <th key={hi} style={{padding:'0.6rem 0.875rem',textAlign:hi===3?'right':'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {satirlar.map((s: EkstreSatiri, i: number) => {
                              const borc = s.tip === 'BORC';
                              const servis = s.kaynak === 'SERVIS';
                              // Düzenle/sil YALNIZ elle girilebilen servis kalemlerinde.
                              // Fatura satırı Faturalar ekranından yönetilir.
                              const duzenlenebilir = servis;
                              const kayit = duzenlenebilir ? detail.entries.find(e => e.id === s.id) : null;
                              // Satırın solunda renk şeridi YOK: borç/ödeme ayrımını tutarın
                              // rengi ve '+' işareti taşıyor, kaynak ayrımını "Nereden" rozeti.
                              // Şerit aynı bilgiyi üçüncü kez söylüyordu.
                              return (
                                <tr key={s.id} style={{borderBottom:'1px solid #f3f4f6',backgroundColor:i%2===0?'white':'#fafafa'}}>
                                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem',color:'#6b7280',whiteSpace:'nowrap'}}>{b.tarih(s.tarih)}</td>
                                  <td style={{padding:'0.6rem 0.875rem'}}>
                                    <span style={{backgroundColor:servis?'#fef3c7':'#dbeafe',color:servis?'#92400e':'#1e40af',padding:'0.15rem 0.45rem',borderRadius:'9999px',fontSize:'0.65rem',fontWeight:'600',whiteSpace:'nowrap'}}>
                                      {servis?sz.muhasebe.rozetServis:sz.muhasebe.rozetKira}
                                    </span>
                                  </td>
                                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.875rem',fontWeight:'500'}}>
                                    {s.aciklama}
                                    {s.detay && <div style={{fontSize:'0.7rem',color:'#9ca3af',fontWeight:'400'}}>{s.detay}</div>}
                                  </td>
                                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.95rem',fontWeight:'700',textAlign:'right',whiteSpace:'nowrap',color:borc?'#f59e0b':'#10b981'}}>
                                    {borc?'':'+'} {b.para(Number(s.tutar))}
                                  </td>
                                  <td style={{padding:'0.6rem 0.5rem'}} className="print-hide">
                                    {kayit && (
                                      <div style={{display:'flex',gap:'0.25rem'}}>
                                        <button onClick={() => openEdit(kayit)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}} title={sz.genel.duzenle}>✏️</button>
                                        <button onClick={() => handleDelete(kayit.id)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}} title={sz.genel.sil}>🗑️</button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* DÜZENLEME MODAL */}
      {editModal && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={() => setEditModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',padding:'1.5rem',width:'480px',maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h3 style={{fontWeight:'700',fontSize:'1.1rem',margin:0}}>{sz.muhasebe.kaydiDuzenle}</h3>
              <button onClick={() => setEditModal(null)} style={{background:'none',border:'none',fontSize:'1.25rem',cursor:'pointer',color:'#6b7280'}}>✕</button>
            </div>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
              {(['SALE','PAYMENT'] as const).map(t => (
                <button key={t} type="button" onClick={() => setEditModal({...editModal,type:t})} style={{
                  flex:1,padding:'0.625rem',borderRadius:'0.5rem',border:'none',cursor:'pointer',fontWeight:'600',
                  backgroundColor:editModal.type===t?(t==='SALE'?'#f59e0b':'#10b981'):'#f3f4f6',
                  color:editModal.type===t?'white':'#374151',
                }}>{t==='SALE'?sz.muhasebe.satisKisa:sz.muhasebe.odemeKisa}</button>
              ))}
            </div>
            {editModal.type === 'SALE' && (
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>{sz.muhasebe.urunHizmet}</label>
                <input style={inp} value={editModal.product} onChange={e => setEditModal({...editModal,product:e.target.value})} placeholder={sz.muhasebe.urunYer} />
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem',marginBottom:'0.75rem'}}>
              <div>
                <label style={lbl}>{doldur(sz.muhasebe.tutar, { birim: b.simge })}</label>
                <input type="number" step="0.01" min="0" style={inp} value={editModal.amount} onChange={e => setEditModal({...editModal,amount:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>{sz.muhasebe.odemeYontemi}</label>
                <select style={inp} value={editModal.method} onChange={e => setEditModal({...editModal,method:e.target.value})}>
                  {METHODS.map(k => <option key={k} value={k}>{yontem(k)}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem',marginBottom:'1rem'}}>
              <div>
                <label style={lbl}>{sz.genel.tarih}</label>
                <input type="date" style={inp} value={editModal.date} onChange={e => setEditModal({...editModal,date:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>{sz.muhasebe.not}</label>
                <input style={inp} value={editModal.notes} onChange={e => setEditModal({...editModal,notes:e.target.value})} placeholder={sz.muhasebe.istegeBagli} />
              </div>
            </div>
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button onClick={() => setEditModal(null)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.genel.iptal}</button>
              <button onClick={handleEdit} disabled={editSaving} style={{
                flex:1,padding:'0.625rem',backgroundColor:'#3b82f6',color:'white',
                border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:editSaving?0.7:1,
              }}>{editSaving ? sz.genel.kaydediliyor : `✓ ${sz.genel.kaydet}`}</button>
            </div>
          </div>
        </div>
      )}

      </> /* accounting tab end */}

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #app-sidebar, nav, header, aside { display: none !important; }
          body { background: white !important; margin: 0; }
          #print-area { grid-column: 1 / -1 !important; }

          /* Print sayfa düzeni */
          @page { margin: 1.5cm; size: A4; }

          /* Başlık kutusu */
          #print-area > div:first-child {
            background: #1e3a5f !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Tablo border'ları */
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #e5e7eb !important; font-size: 0.78rem !important; }

          /* Renk bantları */
          tr:nth-child(even) td { background: #f9fafb !important; }
        }
      `}</style>
    </div>
  );
}
