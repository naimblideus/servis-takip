'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
const StockTab = dynamic(() => import('@/components/StockTab'), { ssr: false });
const ExpenseTab = dynamic(() => import('@/components/ExpenseTab'), { ssr: false });

interface Entry { id: string; type: 'SALE'|'PAYMENT'; product: string|null; amount: number; method: string; notes: string|null; date: string; createdByName?: string|null; customer?: {id:string;name:string;phone:string}|null; }
interface Customer { id:string; name:string; phone:string; totalSales:number; totalPayments:number; balance:number; }
interface AllCustomer { id:string; name:string; phone:string; }
interface CustDetail { customer:{id:string;name:string;phone:string;address:string|null;email:string|null}; entries:Entry[]; summary:{totalSales:number;totalPayments:number;balance:number;entryCount:number}; }

interface StockItem { id:string; source:'PART'|'PRINTER'; name:string; sku?:string|null; category?:string|null; brand?:string|null; model?:string|null; color?:string|null; condition?:string|null; group?:string|null; buyPrice:number; sellPrice:number; stockQty:number; notes?:string|null; }
const METHOD_LABELS: Record<string,string> = { CASH:'💵 Nakit', CARD:'💳 Kredi Kartı', TRANSFER:'🏦 IBAN/Havale', OPEN_ACCOUNT:'📖 Açık Hesap', OTHER:'📋 Diğer' };
const METHOD_OPTIONS = Object.entries(METHOD_LABELS);

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<'accounting'|'stock'|'expense'>('accounting');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<AllCustomer[]>([]); // Form dropdown için filtresiz liste
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({totalSales:0,totalPayments:0,totalDebt:0,debtorCount:0,customerCount:0});
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
  // Toplu WhatsApp
  const [showBulkWA, setShowBulkWA] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMsgTpl, setBulkMsgTpl] = useState('Sayın {ad},\n\nHesabınızda ₺{borç} tutarında ödenmemiş bakiye bulunmaktadır.\n\nLütfen en kısa sürede ödeme yapmanızı rica ederiz.\n\nSaygılarımızla');
  const [bulkIdx, setBulkIdx] = useState(-1);
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
        const d = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        setError(d.error || `Sunucu hatası (${res.status})`);
      }
    } catch (e: any) {
      setError('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.');
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
    if (!quickStockName.trim()) { alert('Ürün adı zorunlu'); return; }
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
      } else { const d = await r.json(); alert('Hata: '+d.error); }
    } catch(e:any) { alert('Hata: '+e.message); }
    setQuickStockSaving(false);
  };

  const handleQuickAddCust = async () => {
    if (!quickCustForm.name.trim() || !quickCustForm.phone.trim()) { alert('Ad ve telefon zorunlu'); return; }
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
      alert('Hata: ' + (d.error || 'Bilinmeyen hata'));
    }
    setQuickCustSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { alert('Lütfen bir müşteri seçin'); return; }
    setSaving(true);
    const res = await fetch('/api/muhasebe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    if (res.ok) {
      resetForm();
      setShowForm(false); loadData(); if (selCust) loadDetail(selCust.id);
    } else { const d = await res.json(); alert('Hata: '+d.error); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
    try {
      const res = await fetch(`/api/muhasebe?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert('Silme hatası: ' + d.error); return; }
      await loadData();
      if (selCust) await loadDetail(selCust.id);
    } catch {
      alert('Silme işlemi başarısız.');
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
    else { const d = await res.json(); alert('Hata: '+d.error); }
    setEditSaving(false);
  };

  const formatPhone = (raw: string) => {
    let p = raw.replace(/[^0-9]/g,'');
    if (p.startsWith('0')) p = '90'+p.substring(1);
    if (!p.startsWith('90')) p = '90'+p;
    return p;
  };

  const sendWhatsApp = (cust: {name:string;phone:string}, debt: number) => {
    const phone = formatPhone(cust.phone);
    const msg = `Sayın ${cust.name},\n\nÖdenmemiş borcunuz: ₺${debt.toFixed(2)}\n\nSaygılarımızla`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const debtors = customers.filter(c => c.balance > 0);

  const openBulkWA = () => {
    setBulkSelected(new Set(debtors.map(c => c.id)));
    setBulkIdx(-1);
    setShowBulkWA(true);
  };

  const bulkSendNext = () => {
    const list = debtors.filter(c => bulkSelected.has(c.id));
    const nextIdx = bulkIdx + 1;
    if (nextIdx >= list.length) { setShowBulkWA(false); setBulkIdx(-1); return; }
    const c = list[nextIdx];
    const phone = formatPhone(c.phone);
    const msg = bulkMsgTpl
      .replace(/{ad}/g, c.name)
      .replace(/{borç}/g, c.balance.toFixed(2))
      .replace(/{telefon}/g, c.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    setBulkIdx(nextIdx);
  };

  const handlePrint = () => {
    if (!selCust) { alert('Lütfen önce soldan bir müşteri seçin, sonra "Yazdır"a basın.'); return; }
    window.open(`/accounting/${selCust.id}/print`, '_blank');
  };

  if (loading) return <div style={{padding:'2rem',color:'#6b7280'}}>Yükleniyor...</div>;

  if (error) return (
    <div style={{padding:'2rem',maxWidth:'600px',margin:'2rem auto'}}>
      <div style={{backgroundColor:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'0.75rem',padding:'1.5rem',textAlign:'center'}}>
        <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>⚠️</div>
        <h2 style={{color:'#dc2626',fontWeight:'700',margin:'0 0 0.5rem'}}>Muhasebe Modülü Hatası</h2>
        <p style={{color:'#7f1d1d',fontSize:'0.9rem',margin:'0 0 1rem',lineHeight:'1.5'}}>{error}</p>
        <button onClick={() => { setLoading(true); loadData(); }} style={{padding:'0.625rem 1.5rem',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',fontSize:'0.9rem'}}>🔄 Tekrar Dene</button>
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
              <span style={{fontWeight:'700',fontSize:'1rem'}}>📦 Stoka Ekle &amp; Seç</span>
              <button onClick={()=>setQuickAddStock(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <p style={{fontSize:'0.82rem',color:'#6b7280',margin:'0 0 1rem'}}>Ürün stoka eklenecek ve satış fiyatı otomatik forma aktarılacak.</p>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>Ürün / Hizmet Adı *</label>
                <input style={inp} value={quickStockName} onChange={e=>setQuickStockName(e.target.value)} placeholder="Drum ünitesi, toner, servis ücr..." autoFocus />
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={lbl}>Satış Fiyatı (₺) <span style={{fontWeight:'400',color:'#9ca3af'}}>→ otomatik forma gelir</span></label>
                <input type="number" step="0.01" style={inp} value={quickStockPrice} onChange={e=>setQuickStockPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={()=>setQuickAddStock(false)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>İptal</button>
                <button onClick={handleQuickAddStock} disabled={quickStockSaving} style={{flex:2,padding:'0.625rem',backgroundColor:'#15803d',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:quickStockSaving?0.7:1}}>
                  {quickStockSaving?'Ekleniyor...':'✅ Stoka Ekle & Seç'}
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
                <div style={{fontWeight:'700',fontSize:'1.05rem'}}>📱 Toplu WhatsApp Hatırlatma</div>
                <div style={{fontSize:'0.78rem',opacity:0.85,marginTop:'0.15rem'}}>{debtors.filter(c=>bulkSelected.has(c.id)).length} borçlu müşteri seçili</div>
              </div>
              <button onClick={() => setShowBulkWA(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'30px',height:'30px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>

            <div style={{padding:'1.25rem'}}>
              {bulkIdx === -1 ? (
                <>
                  {/* Mesaj Şablonu */}
                  <div style={{marginBottom:'1rem'}}>
                    <label style={{...lbl,color:'#374151',fontSize:'0.85rem'}}>✏️ Mesaj Şablonu</label>
                    <div style={{fontSize:'0.72rem',color:'#9ca3af',marginBottom:'0.35rem'}}>Kullanılabilir değişkenler: <code style={{background:'#f3f4f6',padding:'0.1rem 0.3rem',borderRadius:'3px'}}>{'{ad}'}</code> <code style={{background:'#f3f4f6',padding:'0.1rem 0.3rem',borderRadius:'3px'}}>{'{borç}'}</code> <code style={{background:'#f3f4f6',padding:'0.1rem 0.3rem',borderRadius:'3px'}}>{'{telefon}'}</code></div>
                    <textarea rows={5} style={{...inp,resize:'vertical',fontFamily:'inherit',lineHeight:'1.5'}} value={bulkMsgTpl} onChange={e => setBulkMsgTpl(e.target.value)} />
                  </div>

                  {/* Müşteri Listesi */}
                  <div style={{marginBottom:'1rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                      <label style={{...lbl,color:'#374151',fontSize:'0.85rem',marginBottom:0}}>👥 Borçlu Müşteriler</label>
                      <div style={{display:'flex',gap:'0.5rem'}}>
                        <button onClick={() => setBulkSelected(new Set(debtors.map(c=>c.id)))} style={{fontSize:'0.72rem',color:'#2563eb',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>Tümünü Seç</button>
                        <span style={{color:'#d1d5db'}}>|</span>
                        <button onClick={() => setBulkSelected(new Set())} style={{fontSize:'0.72rem',color:'#dc2626',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>Hiçbirini Seçme</button>
                      </div>
                    </div>
                    <div style={{border:'1px solid #e5e7eb',borderRadius:'0.5rem',overflow:'hidden',maxHeight:'220px',overflowY:'auto'}}>
                      {debtors.map(c => (
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
                          <span style={{fontWeight:'700',color:'#ef4444',fontSize:'0.875rem'}}>₺{c.balance.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Önizleme */}
                  {debtors[0] && bulkSelected.has(debtors[0].id) && (
                    <div style={{backgroundColor:'#f0fdf4',border:'1px solid #86efac',borderRadius:'0.5rem',padding:'0.75rem',marginBottom:'1rem'}}>
                      <div style={{fontSize:'0.72rem',color:'#15803d',fontWeight:'600',marginBottom:'0.35rem'}}>👁️ Mesaj Önizleme ({debtors[0].name})</div>
                      <div style={{fontSize:'0.8rem',color:'#374151',whiteSpace:'pre-wrap',lineHeight:'1.5'}}>
                        {bulkMsgTpl.replace(/{ad}/g,debtors[0].name).replace(/{borç}/g,debtors[0].balance.toFixed(2)).replace(/{telefon}/g,debtors[0].phone)}
                      </div>
                    </div>
                  )}

                  <button onClick={bulkSendNext} disabled={bulkSelected.size===0} style={{width:'100%',padding:'0.75rem',backgroundColor:'#22c55e',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'700',fontSize:'0.95rem',opacity:bulkSelected.size===0?0.5:1}}>
                    📱 Göndermeye Başla ({debtors.filter(c=>bulkSelected.has(c.id)).length} mesaj)
                  </button>
                </>
              ) : (
                // Gönderim aşaması
                <>
                  <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
                    <div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📱</div>
                    <div style={{fontWeight:'700',fontSize:'1.1rem',color:'#15803d'}}>
                      {bulkIdx + 1} / {debtors.filter(c=>bulkSelected.has(c.id)).length} gönderildi
                    </div>
                    <div style={{color:'#6b7280',fontSize:'0.85rem',marginTop:'0.25rem'}}>WhatsApp açıldı, mesajı gönderdikten sonra buraya dönün</div>
                  </div>

                  {/* İlerleme çubuğu */}
                  <div style={{backgroundColor:'#f3f4f6',borderRadius:'9999px',height:'8px',marginBottom:'1.25rem'}}>
                    <div style={{backgroundColor:'#22c55e',borderRadius:'9999px',height:'8px',width:`${((bulkIdx+1)/debtors.filter(c=>bulkSelected.has(c.id)).length)*100}%`,transition:'width 0.3s'}} />
                  </div>

                  {/* Gönderilen kişi */}
                  {(() => { const list=debtors.filter(c=>bulkSelected.has(c.id)); const sent=list.slice(0,bulkIdx+1); const remaining=list.slice(bulkIdx+1); return (
                    <>
                      <div style={{border:'1px solid #e5e7eb',borderRadius:'0.5rem',overflow:'hidden',maxHeight:'180px',overflowY:'auto',marginBottom:'1rem'}}>
                        {sent.map((c,i) => (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0.875rem',borderBottom:'1px solid #f3f4f6',backgroundColor:'#f0fdf4'}}>
                            <span style={{color:'#22c55e',fontWeight:'700'}}>✓</span>
                            <span style={{fontSize:'0.85rem',flex:1}}>{c.name}</span>
                            <span style={{fontSize:'0.75rem',color:'#ef4444',fontWeight:'600'}}>₺{c.balance.toFixed(2)}</span>
                          </div>
                        ))}
                        {remaining.map(c => (
                          <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0.875rem',borderBottom:'1px solid #f3f4f6',opacity:0.5}}>
                            <span style={{color:'#d1d5db'}}>○</span>
                            <span style={{fontSize:'0.85rem',flex:1}}>{c.name}</span>
                            <span style={{fontSize:'0.75rem',color:'#ef4444'}}>₺{c.balance.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ); })()}

                  <div style={{display:'flex',gap:'0.75rem'}}>
                    <button onClick={() => {setShowBulkWA(false); setBulkIdx(-1);}} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>Bitir</button>
                    <button onClick={bulkSendNext} style={{flex:2,padding:'0.625rem',backgroundColor:'#22c55e',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'700',fontSize:'0.9rem'}}>
                      {bulkIdx + 1 >= debtors.filter(c=>bulkSelected.has(c.id)).length ? '✅ Tamamlandı' : `Sıradaki → ${debtors.filter(c=>bulkSelected.has(c.id))[bulkIdx+1]?.name}`}
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
              <span style={{fontWeight:'700',fontSize:'1rem'}}>👤 Yeni Müşteri Ekle</span>
              <button onClick={() => setQuickAddCust(false)} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>Ad Soyad *</label>
                <input style={inp} value={quickCustForm.name} onChange={e => setQuickCustForm(f=>({...f,name:e.target.value}))} placeholder="Müşteri adı..." autoFocus />
              </div>
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>Telefon *</label>
                <input style={inp} value={quickCustForm.phone} onChange={e => setQuickCustForm(f=>({...f,phone:e.target.value}))} placeholder="05xx xxx xx xx" />
              </div>
              <div style={{marginBottom:'1rem'}}>
                <label style={lbl}>Adres</label>
                <input style={inp} value={quickCustForm.address} onChange={e => setQuickCustForm(f=>({...f,address:e.target.value}))} placeholder="İsteğe bağlı..." />
              </div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button onClick={() => setQuickAddCust(false)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>İptal</button>
                <button onClick={handleQuickAddCust} disabled={quickCustSaving} style={{flex:2,padding:'0.625rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:quickCustSaving?0.7:1}}>
                  {quickCustSaving ? 'Kaydediliyor...' : '✅ Müşteri Ekle & Seç'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div>
          <h1 style={{fontSize:'1.875rem',fontWeight:'bold',margin:0}}>Muhasebe</h1>
          <p style={{color:'#6b7280',margin:'0.25rem 0 0'}}>Cari hesap takibi ve stok yönetimi</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          {activeTab==='accounting' && (
            <>
              <button onClick={handlePrint} style={{padding:'0.625rem 1rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>🖨️ Yazdır</button>
              {debtors.length > 0 && (
                <button onClick={openBulkWA} style={{padding:'0.625rem 1rem',backgroundColor:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',display:'flex',alignItems:'center',gap:'0.4rem'}}>
                  📱 Toplu WhatsApp <span style={{backgroundColor:'#15803d',color:'white',borderRadius:'9999px',padding:'0.1rem 0.45rem',fontSize:'0.75rem'}}>{debtors.length}</span>
                </button>
              )}
              <button onClick={()=>{ if(showForm){resetForm();setShowForm(false);}else{setShowForm(true);if(selCust)selectFormCust({id:selCust.id,name:selCust.name,phone:selCust.phone});} }} style={{backgroundColor:'#3b82f6',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'500',cursor:'pointer'}}>
                {showForm ? '✕ İptal' : '+ Yeni Kayıt'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.625rem',padding:'0.3rem',marginBottom:'1.5rem',width:'fit-content'}} className="print-hide">
        {([['accounting','📊 Muhasebe'],['expense','💸 Giderler'],['stock','📦 Stok']] as [string,string][]).map(([k,l])=>(
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

      {/* ÖZET KARTLAR */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'1rem',marginBottom:'1.5rem'}} className="print-hide">
        {[
          {label:'Toplam Satış',value:summary.totalSales,icon:'📈',bg:'#ecfdf5',border:'#a7f3d0',color:'#10b981'},
          {label:'Toplam Ödeme',value:summary.totalPayments,icon:'💵',bg:'#eff6ff',border:'#bfdbfe',color:'#3b82f6'},
          {label:'Toplam Borç',value:summary.totalDebt,icon:'⚠️',bg:'#fef2f2',border:'#fecaca',color:'#ef4444'},
          {label:'Borçlu Müşteri',value:summary.debtorCount,icon:'👥',bg:'#fffbeb',border:'#fde68a',color:'#f59e0b',isCurrency:false},
        ].map(c => (
          <div key={c.label} style={{backgroundColor:c.bg,borderRadius:'0.75rem',padding:'1.25rem',border:`1px solid ${c.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}>
              <span style={{fontSize:'1.25rem'}}>{c.icon}</span>
              <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{c.label}</span>
            </div>
            <div style={{fontSize:'1.5rem',fontWeight:'bold',color:c.color}}>
              {'isCurrency' in c && !c.isCurrency ? c.value : `₺${Number(c.value).toLocaleString('tr-TR',{minimumFractionDigits:2})}`}
            </div>
          </div>
        ))}
      </div>

      {/* FİLTRELER */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.5rem',alignItems:'center'}} className="print-hide">
        <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.5rem',padding:'0.25rem'}}>
          {([['all','Tümü'],['unpaid','⚠️ Borçlu'],['paid','✅ Temiz']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'0.5rem 1rem',borderRadius:'0.375rem',border:'none',cursor:'pointer',fontSize:'0.85rem',
              fontWeight:filter===k?'600':'400', backgroundColor:filter===k?'white':'transparent',
              color:filter===k?'#374151':'#6b7280', boxShadow:filter===k?'0 1px 2px rgba(0,0,0,0.1)':'none',
            }}>{l}</button>
          ))}
        </div>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#9ca3af'}}>🔍</span>
          <input placeholder="Müşteri ara..." value={search} onChange={e => setSearch(e.target.value)} style={{...inp,paddingLeft:'2.25rem',backgroundColor:'#f9fafb'}} />
        </div>
      </div>

      {/* YENİ KAYIT FORMU */}
      {showForm && (
        <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',padding:'1.5rem',marginBottom:'1.5rem',border:'1px solid #e5e7eb'}} className="print-hide">
          <h2 style={{fontWeight:'600',marginBottom:'1rem',fontSize:'1rem'}}>Yeni Kayıt Ekle</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
              {(['SALE','PAYMENT'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm({...form,type:t})} style={{
                  flex:1,padding:'0.75rem',borderRadius:'0.5rem',border:'none',cursor:'pointer',fontWeight:'600',
                  backgroundColor:form.type===t?(t==='SALE'?'#f59e0b':'#10b981'):'#f3f4f6',
                  color:form.type===t?'white':'#374151',
                }}>{t==='SALE'?'🛒 Satış/Ürün':'💵 Ödeme'}</button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem',marginBottom:'1rem'}}>
              <div style={{position:'relative'}}>
                <label style={lbl}>Müşteri *</label>
                <input
                  type="text"
                  style={inp}
                  value={formCustSearch}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { setFormCustSearch(e.target.value); setShowCustDrop(true); if(!e.target.value){ setFormSelCust(null); setForm(f=>({...f,customerId:''})); } }}
                  onFocus={() => setShowCustDrop(true)}
                  placeholder="Müşteri adı yazarak arayın..."
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
                      <span style={{fontSize:'1rem'}}>+</span> Yeni Müşteri Ekle
                    </div>
                  </div>
                )}
                {showCustDrop && formCustSearch && filteredFormCusts.length === 0 && (
                  <div onClick={e => e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,backgroundColor:'white',border:'1px solid #d1d5db',borderRadius:'0.5rem',boxShadow:'0 4px 12px rgba(0,0,0,0.1)',marginTop:'2px'}}>
                    <div style={{padding:'0.6rem 0.75rem',fontSize:'0.8rem',color:'#9ca3af'}}>Müşteri bulunamadı</div>
                    <div onClick={() => { setShowCustDrop(false); setQuickCustForm(f=>({...f,name:formCustSearch})); setQuickAddCust(true); }} style={{padding:'0.5rem 0.75rem',cursor:'pointer',fontSize:'0.82rem',color:'#2563eb',fontWeight:'600',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'0.4rem'}}
                      onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#eff6ff')}
                      onMouseLeave={e=>(e.currentTarget.style.backgroundColor='white')}>
                      <span style={{fontSize:'1rem'}}>+</span> "{formCustSearch}" adıyla yeni müşteri ekle
                    </div>
                  </div>
                )}
              </div>
              {form.type === 'SALE' && (
                <div style={{position:'relative'}}>
                  <label style={lbl}>Ürün/Hizmet * <span style={{fontWeight:'400',color:'#9ca3af',fontSize:'0.72rem'}}>(stoktan seç veya yaz)</span></label>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    <div style={{position:'relative',flex:1}}>
                      <input style={inp} value={formStockSearch}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>{ const v=e.target.value; setFormStockSearch(v); setForm(f=>({...f,product:v})); setShowStockDrop(true); if(!v) setFormStockItem(null); }}
                        onFocus={()=>setShowStockDrop(true)}
                        placeholder="Stoktan ara veya yaz..." autoComplete="off" />
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
                                <div style={{fontSize:'0.7rem',color:'#9ca3af'}}>{item.source==='PART'?'🔧':'🖨️'} Stok: {item.stockQty}</div>
                              </div>
                              {item.sellPrice>0 && <span style={{fontWeight:'700',color:'#10b981',fontSize:'0.85rem',whiteSpace:'nowrap'}}>₺{item.sellPrice.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>}
                            </div>
                          ))}
                          {allStock.length===0 && <div style={{padding:'0.6rem 0.75rem',fontSize:'0.8rem',color:'#9ca3af'}}>Stok bulunamadı</div>}
                          <div onClick={()=>{ setShowStockDrop(false); setQuickStockName(formStockSearch); setQuickAddStock(true); }}
                            style={{padding:'0.5rem 0.75rem',cursor:'pointer',fontSize:'0.82rem',color:'#15803d',fontWeight:'600',borderTop:'2px solid #e5e7eb',backgroundColor:'#f0fdf4',display:'flex',alignItems:'center',gap:'0.4rem'}}
                            onMouseEnter={e=>(e.currentTarget.style.backgroundColor='#dcfce7')}
                            onMouseLeave={e=>(e.currentTarget.style.backgroundColor='#f0fdf4')}>
                            📦 Stoka Ekle &amp; Seç: <strong>"{formStockSearch||'Yeni Ürün'}"</strong>
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" title="Stoka yeni ürün ekle"
                      onClick={()=>{ setQuickStockName(formStockSearch); setQuickAddStock(true); }}
                      style={{padding:'0 0.75rem',backgroundColor:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600',whiteSpace:'nowrap'}}>
                      📦+
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label style={lbl}>Tutar (₺) *</label>
                <input required type="number" step="0.01" min="0" style={inp} value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'1rem',marginBottom:'1rem'}}>
              <div>
                <label style={lbl}>Ödeme Yöntemi</label>
                <select style={inp} value={form.method} onChange={e => setForm({...form,method:e.target.value})}>
                  {METHOD_OPTIONS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tarih</label>
                <input type="date" style={inp} value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>Not</label>
                <input style={inp} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="İsteğe bağlı..." />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{backgroundColor:form.type==='SALE'?'#f59e0b':'#10b981',color:'white',padding:'0.625rem 1.5rem',borderRadius:'0.5rem',border:'none',fontWeight:'600',cursor:'pointer',opacity:saving?0.7:1}}>
              {saving ? 'Kaydediliyor...' : (form.type==='SALE'?'🛒 Satış Kaydet':'💵 Ödeme Kaydet')}
            </button>
          </form>
        </div>
      )}

      {/* ANA İÇERİK: MÜŞTERİ LİSTESİ + DETAY */}
      <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:'1.5rem'}}>
        {/* SOL: MÜŞTERİ LİSTESİ */}
        <div>
          <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',overflow:'hidden',maxHeight:'75vh',overflowY:'auto'}}>
            {customers.length === 0 ? (
              <div style={{padding:'2rem',textAlign:'center',color:'#9ca3af',fontSize:'0.85rem'}}>Müşteri bulunamadı</div>
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
                      <span style={{fontSize:'0.85rem',fontWeight:'700',color:'#ef4444'}}>₺{c.balance.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
                    ) : (
                      <span style={{fontSize:'0.75rem',color:'#10b981',fontWeight:'600'}}>✅ Temiz</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ: MÜŞTERİ DETAY */}
        <div id="print-area">
          {/* PRINT BAŞLIĞI - sadece yazdırmada görünür */}
          <div className="print-only" style={{display:'none',marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1rem 1.5rem',background:'#1e3a5f',color:'white',borderRadius:'0.5rem 0.5rem 0 0'}}>
              <div>
                <div style={{fontWeight:'900',fontSize:'1.2rem',letterSpacing:'0.03em'}}>SAYGILI FOTOKOPİ</div>
                <div style={{fontSize:'0.72rem',opacity:0.8,marginTop:'0.1rem'}}>///// SERVİ MAH. SÜMER1 SK. NO5/E KÜTAHYA</div>
                <div style={{fontSize:'0.72rem',opacity:0.8}}>📞 02742236206</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:'700',fontSize:'0.95rem'}}>CARİ HESAP EKSTRESİ</div>
                <div style={{fontSize:'0.72rem',opacity:0.85,marginTop:'0.2rem'}}>Tarih: {new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})}</div>
              </div>
            </div>
            {selCust && (
              <div style={{backgroundColor:'#f8fafc',border:'1px solid #e2e8f0',borderTop:'none',padding:'0.75rem 1.5rem',display:'grid',gridTemplateColumns:'1fr 1fr',fontSize:'0.8rem'}}>
                <div><span style={{color:'#6b7280'}}>Müşteri: </span><strong>{selCust.name}</strong></div>
                <div><span style={{color:'#6b7280'}}>Telefon: </span>{selCust.phone}</div>
              </div>
            )}
          </div>
          {!selCust ? (
            <div style={{backgroundColor:'white',borderRadius:'0.75rem',padding:'3rem',textAlign:'center',color:'#9ca3af',border:'2px dashed #e5e7eb'}}>
              <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>👈</div>
              <div>Sol taraftan bir müşteri seçin</div>
            </div>
          ) : detailLoading ? (
            <div style={{padding:'2rem',textAlign:'center',color:'#6b7280'}}>Yükleniyor...</div>
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
                    <button onClick={() => window.open(`/accounting/${selCust.id}/print`, '_blank')} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>🖨️ Ekstre Yazdır</button>
                    {detail.summary.balance > 0 && (
                      <button onClick={() => sendWhatsApp(detail.customer, detail.summary.balance)} style={{backgroundColor:'#25d366',color:'white',border:'none',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>📱 WhatsApp</button>
                    )}
                    <button onClick={() => { selectFormCust({ id: selCust.id, name: selCust.name, phone: selCust.phone }); setShowForm(true); }} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'500'}}>+ Kayıt Ekle</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.75rem',marginTop:'1rem'}}>
                  {[
                    {label:'Toplam Satış',value:detail.summary.totalSales,color:'#fbbf24'},
                    {label:'Toplam Ödeme',value:detail.summary.totalPayments,color:'#34d399'},
                    {label:'Bakiye (Borç)',value:detail.summary.balance,color:detail.summary.balance>0?'#f87171':'#34d399'},
                  ].map(b => (
                    <div key={b.label} style={{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.75rem'}}>
                      <div style={{fontSize:'0.7rem',opacity:0.7,marginBottom:'0.25rem'}}>{b.label}</div>
                      <div style={{fontSize:'1.1rem',fontWeight:'700',color:b.color}}>₺{Math.abs(b.value).toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* İŞLEM GEÇMİŞİ */}
              <div style={{backgroundColor:'white',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',overflow:'hidden'}}>
                <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:'600',fontSize:'0.9rem'}}>İşlem Geçmişi</span>
                  <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{detail.entries.length} kayıt</span>
                </div>
                {detail.entries.length === 0 ? (
                  <div style={{padding:'3rem',textAlign:'center',color:'#9ca3af',fontSize:'0.85rem'}}>
                    Bu müşteriye ait kayıt yok
                    <br/>
                    <button onClick={() => { selectFormCust(selCust as any); setShowForm(true); }} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#3b82f6',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.8rem'}} className="print-hide">+ Kayıt Ekle</button>
                  </div>
                ) : (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                        {['Tarih','Tür','Ürün/Hizmet','Yöntem','Kaydeden','Not','Tutar','İşlem'].map(h => (
                          <th key={h} style={{padding:'0.6rem 0.875rem',textAlign:'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h === 'İşlem' ? '' : h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((e: Entry, i: number) => {
                        const isSale = e.type === 'SALE';
                        return (
                          <tr key={e.id} style={{borderBottom:'1px solid #f3f4f6',backgroundColor:i%2===0?'white':'#fafafa',borderLeft:`3px solid ${isSale?'#f59e0b':'#10b981'}`}}>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem',color:'#6b7280'}}>{new Date(e.date).toLocaleDateString('tr-TR')}</td>
                            <td style={{padding:'0.6rem 0.875rem'}}>
                              <span style={{backgroundColor:isSale?'#fef3c7':'#d1fae5',color:isSale?'#92400e':'#065f46',padding:'0.15rem 0.45rem',borderRadius:'9999px',fontSize:'0.65rem',fontWeight:'600'}}>
                                {isSale?'SATIŞ':'ÖDEME'}
                              </span>
                            </td>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.875rem',fontWeight:'500'}}>{e.product || '—'}</td>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem'}}>{METHOD_LABELS[e.method]||e.method}</td>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.75rem',color:'#374151'}}>{e.createdByName ? `👤 ${e.createdByName}` : '—'}</td>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.75rem',color:'#6b7280'}}>{e.notes||'—'}</td>
                            <td style={{padding:'0.6rem 0.875rem',fontSize:'0.95rem',fontWeight:'700',color:isSale?'#f59e0b':'#10b981'}}>
                              {isSale?'':'+'} ₺{Number(e.amount).toLocaleString('tr-TR',{minimumFractionDigits:2})}
                            </td>
                            <td style={{padding:'0.6rem 0.5rem'}} className="print-hide">
                              <div style={{display:'flex',gap:'0.25rem'}}>
                                <button onClick={() => openEdit(e)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}} title="Düzenle">✏️</button>
                                <button onClick={() => handleDelete(e.id)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}} title="Sil">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
              <h3 style={{fontWeight:'700',fontSize:'1.1rem',margin:0}}>✏️ Kaydı Düzenle</h3>
              <button onClick={() => setEditModal(null)} style={{background:'none',border:'none',fontSize:'1.25rem',cursor:'pointer',color:'#6b7280'}}>✕</button>
            </div>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
              {(['SALE','PAYMENT'] as const).map(t => (
                <button key={t} type="button" onClick={() => setEditModal({...editModal,type:t})} style={{
                  flex:1,padding:'0.625rem',borderRadius:'0.5rem',border:'none',cursor:'pointer',fontWeight:'600',
                  backgroundColor:editModal.type===t?(t==='SALE'?'#f59e0b':'#10b981'):'#f3f4f6',
                  color:editModal.type===t?'white':'#374151',
                }}>{t==='SALE'?'🛒 Satış':'💵 Ödeme'}</button>
              ))}
            </div>
            {editModal.type === 'SALE' && (
              <div style={{marginBottom:'0.75rem'}}>
                <label style={lbl}>Ürün/Hizmet *</label>
                <input style={inp} value={editModal.product} onChange={e => setEditModal({...editModal,product:e.target.value})} placeholder="Aldığı ürün..." />
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
              <div>
                <label style={lbl}>Tutar (₺) *</label>
                <input type="number" step="0.01" min="0" style={inp} value={editModal.amount} onChange={e => setEditModal({...editModal,amount:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>Ödeme Yöntemi</label>
                <select style={inp} value={editModal.method} onChange={e => setEditModal({...editModal,method:e.target.value})}>
                  {METHOD_OPTIONS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              <div>
                <label style={lbl}>Tarih</label>
                <input type="date" style={inp} value={editModal.date} onChange={e => setEditModal({...editModal,date:e.target.value})} />
              </div>
              <div>
                <label style={lbl}>Not</label>
                <input style={inp} value={editModal.notes} onChange={e => setEditModal({...editModal,notes:e.target.value})} placeholder="İsteğe bağlı..." />
              </div>
            </div>
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button onClick={() => setEditModal(null)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>İptal</button>
              <button onClick={handleEdit} disabled={editSaving} style={{
                flex:1,padding:'0.625rem',backgroundColor:'#3b82f6',color:'white',
                border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:editSaving?0.7:1,
              }}>{editSaving ? 'Kaydediliyor...' : '✓ Kaydet'}</button>
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
          .print-only { display: block !important; }

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

          /* Footer */
          body::after {
            content: 'Saygılı Fotokopi - Servi Mah. Sümer1 Sk. No5/E Kütahya - Tel: 02742236206';
            display: block;
            text-align: center;
            font-size: 0.65rem;
            color: #9ca3af;
            margin-top: 1.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid #e5e7eb;
          }
        }
      `}</style>
    </div>
  );
}
