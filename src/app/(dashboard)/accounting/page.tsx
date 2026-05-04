'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

interface Entry { id: string; type: 'SALE'|'PAYMENT'; product: string|null; amount: number; method: string; notes: string|null; date: string; customer?: {id:string;name:string;phone:string}|null; }
interface Customer { id:string; name:string; phone:string; totalSales:number; totalPayments:number; balance:number; }
interface CustDetail { customer:{id:string;name:string;phone:string;address:string|null;email:string|null}; entries:Entry[]; summary:{totalSales:number;totalPayments:number;balance:number;entryCount:number}; }

const METHOD_LABELS: Record<string,string> = { CASH:'💵 Nakit', CARD:'💳 Kredi Kartı', TRANSFER:'🏦 IBAN/Havale', OPEN_ACCOUNT:'📖 Açık Hesap', OTHER:'📋 Diğer' };
const METHOD_OPTIONS = Object.entries(METHOD_LABELS);

export default function AccountingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({totalSales:0,totalPayments:0,totalDebt:0,debtorCount:0,customerCount:0});
  const [filter, setFilter] = useState<'all'|'paid'|'unpaid'>('all');
  const [search, setSearch] = useState('');
  const [selCust, setSelCust] = useState<Customer|null>(null);
  const [detail, setDetail] = useState<CustDetail|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({type:'SALE' as 'SALE'|'PAYMENT', customerId:'', product:'', amount:'', method:'CASH', notes:'', date: new Date().toISOString().split('T')[0]});
  const [editModal, setEditModal] = useState<{id:string;type:'SALE'|'PAYMENT';product:string;amount:string;method:string;notes:string;date:string}|null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const inp: React.CSSProperties = {width:'100%',padding:'0.5rem 0.75rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',fontSize:'0.875rem',boxSizing:'border-box',outline:'none'};
  const lbl: React.CSSProperties = {display:'block',fontSize:'0.8rem',fontWeight:'500',color:'#6b7280',marginBottom:'0.25rem'};

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/muhasebe?${params}`);
    if (res.ok) { const d = await res.json(); setCustomers(d.customers); setSummary(d.summary); }
    setLoading(false);
  }, [filter, search]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/muhasebe/customer/${id}`);
    if (res.ok) setDetail(await res.json());
    setDetailLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (selCust) loadDetail(selCust.id); }, [selCust, loadDetail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch('/api/muhasebe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    if (res.ok) {
      setForm({type:'SALE',customerId:'',product:'',amount:'',method:'CASH',notes:'',date:new Date().toISOString().split('T')[0]});
      setShowForm(false); loadData(); if (selCust) loadDetail(selCust.id);
    } else { const d = await res.json(); alert('Hata: '+d.error); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
    await fetch(`/api/muhasebe?id=${id}`, {method:'DELETE'});
    loadData(); if (selCust) loadDetail(selCust.id);
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

  const sendWhatsApp = (cust: {name:string;phone:string}, debt: number) => {
    let phone = cust.phone.replace(/[^0-9]/g,'');
    if (phone.startsWith('0')) phone = '90'+phone.substring(1);
    if (!phone.startsWith('90')) phone = '90'+phone;
    const msg = `Sayın ${cust.name},\n\nÖdenmemiş borcunuz: ₺${debt.toFixed(2)}\n\nSaygılarımızla`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrint = () => window.print();

  if (loading) return <div style={{padding:'2rem',color:'#6b7280'}}>Yükleniyor...</div>;

  return (
    <div style={{padding:'2rem',maxWidth:'1400px'}}>
      {/* BAŞLIK */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{fontSize:'1.875rem',fontWeight:'bold',margin:0}}>Muhasebe</h1>
          <p style={{color:'#6b7280',margin:'0.25rem 0 0'}}>Manuel cari hesap takibi</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button onClick={handlePrint} style={{padding:'0.625rem 1rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>🖨️ Yazdır</button>
          <button onClick={() => {setShowForm(!showForm); if(!showForm && selCust) setForm(f=>({...f,customerId:selCust.id}));}} style={{backgroundColor:'#3b82f6',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'500',cursor:'pointer'}}>
            {showForm ? '✕ İptal' : '+ Yeni Kayıt'}
          </button>
        </div>
      </div>

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
              <div>
                <label style={lbl}>Müşteri *</label>
                <select required style={inp} value={form.customerId} onChange={e => setForm({...form,customerId:e.target.value})}>
                  <option value="">— Seçiniz —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {form.type === 'SALE' && (
                <div>
                  <label style={lbl}>Ürün/Hizmet *</label>
                  <input required style={inp} value={form.product} onChange={e => setForm({...form,product:e.target.value})} placeholder="Aldığı ürün..." />
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
                    {detail.summary.balance > 0 && (
                      <button onClick={() => sendWhatsApp(detail.customer, detail.summary.balance)} style={{backgroundColor:'#25d366',color:'white',border:'none',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>📱 WhatsApp</button>
                    )}
                    <button onClick={() => {setForm(f=>({...f,customerId:selCust.id}));setShowForm(true);}} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.5rem',padding:'0.5rem 0.875rem',cursor:'pointer',fontSize:'0.8rem',fontWeight:'500'}}>+ Kayıt Ekle</button>
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
                    <button onClick={() => {setForm(f=>({...f,customerId:selCust.id}));setShowForm(true);}} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#3b82f6',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.8rem'}} className="print-hide">+ Kayıt Ekle</button>
                  </div>
                ) : (
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                        {['Tarih','Tür','Ürün/Hizmet','Yöntem','Not','Tutar',''].map(h => (
                          <th key={h} style={{padding:'0.6rem 0.875rem',textAlign:'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h}</th>
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

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #app-sidebar { display: none !important; }
          body { background: white !important; }
          #print-area { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}
