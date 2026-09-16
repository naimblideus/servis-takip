'use client';
import { useState, useEffect, useCallback } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Expense { id:string; category:string; description:string; amount:number; date:string; payee:string|null; method:string; notes:string|null; }

const CATS = ['KIRA','ELEKTRIK','SU','INTERNET','PERSONEL','MALZEME','BAKIM','VERGI','KARGO','GENEL','DIGER'];
const CAT_ICONS: Record<string,string> = { KIRA:'🏠',ELEKTRIK:'⚡',SU:'💧',INTERNET:'🌐',PERSONEL:'👤',MALZEME:'📦',BAKIM:'🔧',VERGI:'📋',KARGO:'🚚',GENEL:'💼',DIGER:'📌' };
const METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];
const s = { inp:{padding:'0.5rem 0.75rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',fontSize:'0.875rem',width:'100%',boxSizing:'border-box' as const,outline:'none'}, lbl:{display:'block' as const,fontSize:'0.78rem',fontWeight:'500' as const,color:'#6b7280',marginBottom:'0.2rem'} };

const EMPTY = { category:'GENEL', description:'', amount:'', date:new Date().toISOString().split('T')[0], payee:'', method:'CASH', notes:'' };

export default function ExpenseTab() {
  // `sz` (sözlük): `s` stil nesnesi, `t` kısa döngü değişkeni olarak kullanılıyor.
  const sz = useT();
  const bic = useBicim();
  const katAdi = (k: string) => (sz.gider.kategoriler as Record<string, string>)[k] ?? k;
  const yontemAdi = (k: string) => (sz.gider.yontem as Record<string, string>)[k] ?? k;
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [catFilter, setCatFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/expenses?month=${month}`);
      if (r.ok) { const d = await r.json(); setItems(d.expenses || []); }
    } finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const filtered = catFilter === 'all' ? items : items.filter(i => i.category === catFilter);
  const total = filtered.reduce((s,e) => s + Number(e.amount), 0);

  const byCategory = CATS.map(c => ({ cat:c, total: items.filter(i=>i.category===c).reduce((s,e)=>s+Number(e.amount),0) })).filter(c=>c.total>0);

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) { alert(sz.gider.zorunlu); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/expenses' + (editId ? '' : ''), {
        method: editId ? 'PATCH' : 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(editId ? {...form, id:editId, amount:parseFloat(form.amount)} : {...form, amount:parseFloat(form.amount)})
      });
      if (r.ok) { setShowForm(false); setEditId(null); setForm(EMPTY); load(); }
      else { const d = await r.json(); alert(doldur(sz.fisler.hata, { n: d.error })); }
    } finally { setSaving(false); }
  };

  const handleEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({ category:e.category, description:e.description, amount:String(e.amount), date:new Date(e.date).toISOString().split('T')[0], payee:e.payee||'', method:e.method, notes:e.notes||'' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(sz.gider.silSor)) return;
    await fetch(`/api/expenses?id=${id}`, {method:'DELETE'});
    load();
  };

  return (
    <div style={{padding:'0 0 2rem'}}>
      {/* Form Modal */}
      {showForm && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}} onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY);}}>
          <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',width:'520px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 80px rgba(0,0,0,0.35)'}}>
            <div style={{background:'linear-gradient(135deg,#dc2626,#ef4444)',color:'white',padding:'1rem 1.25rem',borderRadius:'1rem 1rem 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:'700',fontSize:'1rem'}}>{editId ? sz.gider.duzenle : sz.gider.yeniBaslik}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY);}} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem'}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.lbl}>{sz.gider.kategori}</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                  {CATS.map(c=>(
                    <button key={c} onClick={()=>setForm(f=>({...f,category:c}))} style={{padding:'0.3rem 0.7rem',borderRadius:'9999px',border:'1px solid',cursor:'pointer',fontSize:'0.75rem',fontWeight:'600',backgroundColor:form.category===c?'#dc2626':'white',color:form.category===c?'white':'#374151',borderColor:form.category===c?'#dc2626':'#d1d5db'}}>
                      {CAT_ICONS[c]} {katAdi(c)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>{sz.gider.aciklamaZorunlu}</label><input style={s.inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder={sz.gider.aciklamaYer} autoFocus /></div>
              <div><label style={s.lbl}>{doldur(sz.gider.tutar, { birim: bic.simge })}</label><input type="number" step="0.01" style={s.inp} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" /></div>
              <div><label style={s.lbl}>{sz.genel.tarih}</label><input type="date" style={s.inp} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div><label style={s.lbl}>{sz.gider.odenenKisi}</label><input style={s.inp} value={form.payee} onChange={e=>setForm(f=>({...f,payee:e.target.value}))} placeholder={sz.gider.odenenYer} /></div>
              <div><label style={s.lbl}>{sz.gider.odemeYontemi}</label>
                <select style={s.inp} value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}>
                  {METHODS.map(k=><option key={k} value={k}>{yontemAdi(k)}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>{sz.gider.not}</label><input style={s.inp} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={sz.gider.istegeBagli} /></div>
              <div style={{gridColumn:'1/-1',display:'flex',gap:'0.5rem'}}>
                <button onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY);}} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.genel.iptal}</button>
                <button onClick={handleSave} disabled={saving} style={{flex:2,padding:'0.625rem',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:saving?0.7:1}}>
                  {saving ? sz.genel.kaydediliyor : editId ? sz.gider.guncelle : sz.gider.ekle}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {/* flexWrap: dar ekranda başlık ile sağdaki düğme aynı satıra
          sıkışıyordu. Aynı desen Muhasebe ve Stok başlıklarında da düzeltildi. */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1.25rem'}}>
        <div style={{minWidth:'11rem',flex:'1 1 14rem'}}>
          <h2 style={{fontWeight:'700',fontSize:'1.25rem',margin:0}}>{sz.gider.baslik}</h2>
          <p style={{color:'#6b7280',margin:'0.2rem 0 0',fontSize:'0.85rem'}}>{sz.gider.alt}</p>
        </div>
        <button onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} style={{backgroundColor:'#dc2626',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'600',cursor:'pointer'}}>{sz.gider.yeni}</button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',alignItems:'center',flexWrap:'wrap'}}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{...s.inp,width:'auto',padding:'0.4rem 0.75rem'}} />
        <div style={{display:'flex',gap:'0.25rem',flexWrap:'wrap'}}>
          {[['all',sz.genel.tumu],...['KIRA','ELEKTRIK','PERSONEL','MALZEME','GENEL'].map(k=>[k,`${CAT_ICONS[k]} ${katAdi(k)}`])].map(([k,l])=>(
            <button key={k} onClick={()=>setCatFilter(k)} style={{padding:'0.35rem 0.75rem',borderRadius:'9999px',border:'1px solid',cursor:'pointer',fontSize:'0.78rem',fontWeight:catFilter===k?'700':'400',backgroundColor:catFilter===k?'#dc2626':'white',color:catFilter===k?'white':'#6b7280',borderColor:catFilter===k?'#dc2626':'#d1d5db'}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Özet kartlar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.75rem',marginBottom:'1.25rem'}}>
        <div style={{backgroundColor:'#fef2f2',border:'1px solid #fecaca',borderRadius:'0.75rem',padding:'1rem'}}>
          <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.25rem'}}>{doldur(sz.gider.toplamGider, { n: month })}</div>
          <div style={{fontSize:'1.4rem',fontWeight:'700',color:'#dc2626'}}>{bic.para(items.reduce((s,e)=>s+Number(e.amount),0))}</div>
        </div>
        {byCategory.slice(0,3).map(c=>(
          <div key={c.cat} style={{backgroundColor:'white',border:'1px solid #e5e7eb',borderRadius:'0.75rem',padding:'1rem'}}>
            <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.25rem'}}>{CAT_ICONS[c.cat]} {katAdi(c.cat)}</div>
            <div style={{fontSize:'1.1rem',fontWeight:'700',color:'#374151'}}>{bic.para(c.total)}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      {loading ? <div style={{padding:'2rem',textAlign:'center',color:'#6b7280'}}>{sz.genel.yukleniyor}</div> : filtered.length === 0 ? (
        <div style={{padding:'3rem',textAlign:'center',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:'0.75rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>💸</div>
          <div>{sz.gider.kayitYok}</div>
          <button onClick={()=>{setForm(EMPTY);setShowForm(true);}} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.85rem'}}>{sz.gider.ilkGider}</button>
        </div>
      ) : (
        /* overflowX:auto — eskiden overflow:'hidden' idi ve 7 sütunlu gider
           tablosu telefonda KIRPILIYORDU: Yöntem, Tutar ve silme sütununa
           ulaşmanın hiçbir yolu yoktu. Artık tablo kendi içinde yana
           kayıyor, sayfa yana kaymıyor. */
        <div style={{backgroundColor:'white',borderRadius:'0.75rem',border:'1px solid #e5e7eb',overflowX:'auto'}}>
          <table style={{width:'100%',minWidth:'36rem',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {[sz.genel.tarih,sz.gider.kategori,sz.muhasebe.sutunAciklama,sz.gider.sutunOdenecek,sz.gider.sutunYontem,sz.genel.tutar,''].map(h=>(
                  <th key={h} style={{padding:'0.625rem 0.875rem',textAlign:'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e,i)=>(
                <tr key={e.id} style={{borderBottom:'1px solid #f3f4f6',backgroundColor:i%2===0?'white':'#fafafa',borderLeft:'3px solid #ef4444'}}>
                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem',color:'#6b7280'}}>{bic.tarih(e.date)}</td>
                  <td style={{padding:'0.6rem 0.875rem'}}><span style={{backgroundColor:'#fef2f2',color:'#dc2626',padding:'0.15rem 0.5rem',borderRadius:'9999px',fontSize:'0.7rem',fontWeight:'600'}}>{CAT_ICONS[e.category]} {katAdi(e.category)}</span></td>
                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.875rem',fontWeight:'500'}}>{e.description}{e.notes&&<div style={{fontSize:'0.7rem',color:'#9ca3af'}}>{e.notes}</div>}</td>
                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem',color:'#6b7280'}}>{e.payee||'—'}</td>
                  <td style={{padding:'0.6rem 0.875rem',fontSize:'0.78rem'}}>{yontemAdi(e.method)}</td>
                  <td style={{padding:'0.6rem 0.875rem',fontWeight:'700',color:'#dc2626',fontSize:'0.95rem'}}>{bic.para(Number(e.amount))}</td>
                  <td style={{padding:'0.6rem 0.5rem'}}>
                    <div style={{display:'flex',gap:'0.25rem'}}>
                      <button onClick={()=>handleEdit(e)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}}>✏️</button>
                      <button onClick={()=>handleDelete(e.id)} style={{padding:'0.2rem 0.4rem',backgroundColor:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.65rem'}}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{backgroundColor:'#fef2f2',fontWeight:'700'}}>
                <td colSpan={5} style={{padding:'0.75rem 0.875rem',fontSize:'0.875rem',color:'#dc2626',textAlign:'right'}}>{sz.genel.toplam}</td>
                <td style={{padding:'0.75rem 0.875rem',fontSize:'1rem',color:'#dc2626'}}>{bic.para(total)}</td>
                <td/>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
