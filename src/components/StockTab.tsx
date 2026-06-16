'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';

interface StockItem { id:string; source:'PART'|'PRINTER'; name:string; sku?:string|null; barcode?:string|null; category?:string|null; brand?:string|null; model?:string|null; color?:string|null; condition?:string|null; group?:string|null; buyPrice:number; sellPrice:number; stockQty:number; minStock?:number; notes?:string|null; }

const PART_GROUPS = ['Fırın Grubu','Paten','İşçilik','Dişli Grubu','Yedek Parça','Toner','Tamirat','Diğer'];
const PRINTER_CATS = ['TONER','MUREKEP','YAZICI'];
const s = { inp:{padding:'0.5rem 0.75rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',fontSize:'0.875rem',width:'100%',boxSizing:'border-box' as const}, lbl:{display:'block' as const,fontSize:'0.78rem',fontWeight:'500' as const,color:'#6b7280',marginBottom:'0.2rem'} };

const EMPTY_FORM = { source:'PART' as 'PART'|'PRINTER', name:'', sku:'', barcode:'', group:'', buyPrice:'', sellPrice:'', stockQty:'1', minStock:'5', category:'TONER', brand:'', model:'', color:'', condition:'SIFIR', quantity:'1', notes:'' };

export default function StockTab({ onSelectForSale, onStockChanged }:{ onSelectForSale:(item:StockItem)=>void; onStockChanged?:()=>void }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [srcFilter, setSrcFilter] = useState<'all'|'PART'|'PRINTER'>('all');
  const [modal, setModal] = useState<'add'|'edit'|null>(null);
  const [editItem, setEditItem] = useState<StockItem|null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [scanMsg, setScanMsg] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/stock');
      if (r.ok) { const d = await r.json(); setItems(d.items); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (srcFilter !== 'all' && i.source !== srcFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q) || (i.barcode||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q) || (i.group||'').toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setModal('add'); };
  const openEdit = (item:StockItem) => {
    setEditItem(item);
    setForm({ source:item.source, name:item.name, sku:item.sku||'', barcode:item.barcode||'', group:item.group||'', buyPrice:String(item.buyPrice), sellPrice:String(item.sellPrice), stockQty:String(item.stockQty), minStock:String(item.minStock ?? 5), category:item.category||'TONER', brand:item.brand||'', model:item.model||'', color:item.color||'', condition:item.condition||'SIFIR', quantity:String(item.stockQty), notes:item.notes||'' });
    setModal('edit');
  };

  // 🔴 Barkod okuyucu (USB HID — LS2208): okut -> kayıtlı kalemi bul ve düzenle (parça veya yazıcı/toner);
  // yoksa barkod ön-dolu "yeni kalem" formu aç (o barkodu bir ürüne ata).
  useBarcodeWedge((code) => {
    const found = items.find(i => (i.barcode || '') === code || (i.sku || '') === code);
    if (found) { setScanMsg(`✓ Okundu: ${found.name}`); openEdit(found); }
    else { setScanMsg(`Yeni barkod: ${code} — ürüne atayın`); setForm({ ...EMPTY_FORM, barcode: code }); setEditItem(null); setModal('add'); }
    setTimeout(() => setScanMsg(null), 4000);
  }, { enabled: !modal });

  const handleSave = async () => {
    if (form.source === 'PART' && !form.name.trim()) { alert('Parça adı zorunlu'); return; }
    if (form.source === 'PRINTER' && (!form.brand.trim() || !form.model.trim())) { alert('Marka ve model zorunlu'); return; }
    setSaving(true);
    try {
      const body = modal === 'edit' ? { ...form, id:editItem!.id } : form;
      const r = await fetch('/api/stock', { method: modal === 'edit' ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (r.ok) { setModal(null); load(); onStockChanged?.(); }
      else { const d = await r.json(); alert('Hata: '+d.error); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (item:StockItem) => {
    if (!confirm(`"${item.name}" silinsin mi?`)) return;
    await fetch(`/api/stock?id=${item.id}&source=${item.source}`, {method:'DELETE'});
    load();
  };

  const catColor = (src:string, cat?:string|null) => {
    if (src === 'PART') return {bg:'#eff6ff',color:'#1d4ed8',border:'#bfdbfe'};
    if (cat === 'TONER') return {bg:'#f5f3ff',color:'#6d28d9',border:'#ddd6fe'};
    if (cat === 'MUREKEP') return {bg:'#fff7ed',color:'#c2410c',border:'#fed7aa'};
    return {bg:'#f0fdf4',color:'#15803d',border:'#bbf7d0'};
  };

  const FormBody = () => (
    <div>
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
        {(['PART','PRINTER'] as const).map(src => (
          <button key={src} type="button" onClick={() => setForm(f=>({...f,source:src}))} disabled={modal==='edit'}
            style={{flex:1,padding:'0.625rem',borderRadius:'0.5rem',border:'none',cursor:'pointer',fontWeight:'600',fontSize:'0.85rem',
              backgroundColor:form.source===src?'#1e3a5f':'#f3f4f6',color:form.source===src?'white':'#374151',opacity:modal==='edit'?0.7:1}}>
            {src==='PART'?'🔧 Parça / Sarf':'🖨️ Yazıcı / Toner Stoku'}
          </button>
        ))}
      </div>

      {form.source === 'PART' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>Parça Adı *</label><input style={s.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Drum ünitesi, toner, vs." /></div>
          <div><label style={s.lbl}>SKU / Kod</label><input style={s.inp} value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="Otomatik" /></div>
          <div><label style={s.lbl}>📷 Barkod</label><input style={s.inp} value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder="Okuyucuyla okut veya yaz (EAN-13)" /></div>
          <div><label style={s.lbl}>Grup</label><select style={s.inp} value={form.group} onChange={e=>setForm(f=>({...f,group:e.target.value}))}><option value="">Seçiniz</option>{PART_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
          <div><label style={s.lbl}>Alış Fiyatı (₺)</label><input type="number" style={s.inp} value={form.buyPrice} onChange={e=>setForm(f=>({...f,buyPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>Satış Fiyatı (₺)</label><input type="number" style={s.inp} value={form.sellPrice} onChange={e=>setForm(f=>({...f,sellPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>Stok Adedi</label><input type="number" style={s.inp} value={form.stockQty} onChange={e=>setForm(f=>({...f,stockQty:e.target.value}))} /></div>
          <div><label style={s.lbl}>Min. Stok Uyarısı</label><input type="number" style={s.inp} value={form.minStock} onChange={e=>setForm(f=>({...f,minStock:e.target.value}))} /></div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div><label style={s.lbl}>Kategori</label><select style={s.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{PRINTER_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={s.lbl}>Durum</label><select style={s.inp} value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}><option value="SIFIR">Sıfır</option><option value="IKINCI_EL">İkinci El</option></select></div>
          <div><label style={s.lbl}>Marka *</label><input style={s.inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="HP, Canon, Epson..." /></div>
          <div><label style={s.lbl}>Model *</label><input style={s.inp} value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="103, 116, LaserJet..." /></div>
          <div><label style={s.lbl}>Renk</label><input style={s.inp} value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} placeholder="Siyah, Mavi, Renkli..." /></div>
          <div><label style={s.lbl}>Adet</label><input type="number" style={s.inp} value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} /></div>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>📷 Barkod</label><input style={s.inp} value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder="Okuyucuyla okut veya yaz (satış + etiket için)" /></div>
          <div><label style={s.lbl}>Alış Fiyatı (₺)</label><input type="number" style={s.inp} value={form.buyPrice} onChange={e=>setForm(f=>({...f,buyPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>Satış Fiyatı (₺)</label><input type="number" style={s.inp} value={form.sellPrice} onChange={e=>setForm(f=>({...f,sellPrice:e.target.value}))} placeholder="0.00" /></div>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>Notlar</label><textarea style={{...s.inp,resize:'vertical',minHeight:'60px'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="İsteğe bağlı..." /></div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{padding:'0 0 2rem'}}>
      {/* Barkod okutma bildirimi */}
      {scanMsg && (
        <div style={{position:'fixed',top:'1rem',right:'1rem',zIndex:1200,backgroundColor:'#111827',color:'white',padding:'0.6rem 1rem',borderRadius:'0.5rem',fontSize:'0.85rem',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>📷 {scanMsg}</div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}} onClick={()=>setModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:'1rem',width:'560px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 80px rgba(0,0,0,0.35)'}}>
            <div style={{background:'linear-gradient(135deg,#1e3a5f,#2563eb)',color:'white',padding:'1rem 1.25rem',borderRadius:'1rem 1rem 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:'700',fontSize:'1rem'}}>{modal==='add'?'📦 Yeni Stok Kalemi':'✏️ Stok Düzenle'}</span>
              <button onClick={()=>setModal(null)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <FormBody />
              <div style={{display:'flex',gap:'0.5rem',marginTop:'1.25rem'}}>
                <button onClick={()=>setModal(null)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>İptal</button>
                <button onClick={handleSave} disabled={saving} style={{flex:2,padding:'0.625rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:saving?0.7:1}}>
                  {saving?'Kaydediliyor...':modal==='add'?'✅ Ekle':'✅ Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
        <div>
          <h2 style={{fontWeight:'700',fontSize:'1.25rem',margin:0}}>📦 Stok Yönetimi</h2>
          <p style={{color:'#6b7280',margin:'0.2rem 0 0',fontSize:'0.85rem'}}>Parça, sarf malzeme ve yazıcı stoklarınız · <span style={{color:'#2563eb'}}>📷 barkod okuyucu hazır</span></p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <Link href="/satis" style={{backgroundColor:'#dcfce7',color:'#15803d',padding:'0.625rem 1rem',borderRadius:'0.5rem',border:'1px solid #86efac',fontWeight:'600',fontSize:'0.85rem',textDecoration:'none'}}>🛒 Barkodla Satış</Link>
          <Link href="/etiket" style={{backgroundColor:'#eef2ff',color:'#3730a3',padding:'0.625rem 1rem',borderRadius:'0.5rem',border:'1px solid #c7d2fe',fontWeight:'600',fontSize:'0.85rem',textDecoration:'none'}}>🏷️ Zebra Etiket</Link>
          <button onClick={openAdd} style={{backgroundColor:'#2563eb',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'600',cursor:'pointer',fontSize:'0.875rem'}}>+ Yeni Stok Kalemi</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',alignItems:'center'}}>
        <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.5rem',padding:'0.25rem'}}>
          {([['all','Tümü'],['PART','🔧 Parçalar'],['PRINTER','🖨️ Yazıcı/Toner']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setSrcFilter(k)} style={{padding:'0.4rem 0.875rem',borderRadius:'0.375rem',border:'none',cursor:'pointer',fontSize:'0.82rem',fontWeight:srcFilter===k?'600':'400',backgroundColor:srcFilter===k?'white':'transparent',color:srcFilter===k?'#374151':'#6b7280',boxShadow:srcFilter===k?'0 1px 2px rgba(0,0,0,0.1)':'none'}}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Ada, SKU veya barkoda göre ara..." style={{...s.inp,flex:1,backgroundColor:'#f9fafb'}} />
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {label:'Toplam Kalem',val:items.length,icon:'📦',color:'#3b82f6'},
          {label:'Parça',val:items.filter(i=>i.source==='PART').length,icon:'🔧',color:'#8b5cf6'},
          {label:'Yazıcı/Toner',val:items.filter(i=>i.source==='PRINTER').length,icon:'🖨️',color:'#f59e0b'},
        ].map(c=>(
          <div key={c.label} style={{backgroundColor:'white',border:'1px solid #e5e7eb',borderRadius:'0.75rem',padding:'0.875rem',display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <span style={{fontSize:'1.5rem'}}>{c.icon}</span>
            <div><div style={{fontSize:'1.25rem',fontWeight:'700',color:c.color}}>{c.val}</div><div style={{fontSize:'0.72rem',color:'#6b7280'}}>{c.label}</div></div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? <div style={{padding:'2rem',textAlign:'center',color:'#6b7280'}}>Yükleniyor...</div> : filtered.length === 0 ? (
        <div style={{padding:'3rem',textAlign:'center',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:'0.75rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>📭</div>
          <div>{search ? 'Arama sonucu bulunamadı' : 'Henüz stok kalemi eklenmemiş'}</div>
          {!search && <button onClick={openAdd} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.85rem'}}>+ İlk Kalemi Ekle</button>}
        </div>
      ) : (
        <div style={{backgroundColor:'white',borderRadius:'0.75rem',border:'1px solid #e5e7eb',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['Stok Kalemi','Kategori/Grup','Adet','Alış','Satış','İşlem'].map(h=>(
                  <th key={h} style={{padding:'0.625rem 0.875rem',textAlign:'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h === 'İşlem' ? '' : h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item,i)=>{
                const cc = catColor(item.source, item.category);
                const lowStock = item.stockQty <= (item.minStock ?? 5);
                return (
                  <tr key={item.id} style={{borderBottom:'1px solid #f3f4f6',backgroundColor:i%2===0?'white':'#fafafa'}}>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <div style={{fontWeight:'600',fontSize:'0.875rem',color:'#111827'}}>{item.name}</div>
                      {item.sku && <div style={{fontSize:'0.7rem',color:'#9ca3af'}}>SKU: {item.sku}</div>}
                      {item.barcode && <div style={{fontSize:'0.7rem',color:'#2563eb'}}>📷 {item.barcode}</div>}
                      {item.condition === 'IKINCI_EL' && <span style={{fontSize:'0.65rem',backgroundColor:'#fef3c7',color:'#92400e',padding:'0.1rem 0.35rem',borderRadius:'9999px',fontWeight:'600'}}>İkinci El</span>}
                    </td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{backgroundColor:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,padding:'0.15rem 0.5rem',borderRadius:'9999px',fontSize:'0.72rem',fontWeight:'600'}}>
                        {item.source==='PART'?(item.group||'Parça'):(item.category||'Stok')}
                      </span>
                    </td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{fontWeight:'700',color:lowStock?'#ef4444':'#111827',fontSize:'0.9rem'}}>{item.stockQty}</span>
                      {lowStock && <span style={{display:'block',fontSize:'0.65rem',color:'#ef4444'}}>⚠️ Az</span>}
                    </td>
                    <td style={{padding:'0.625rem 0.875rem',fontSize:'0.875rem',color:'#6b7280'}}>₺{item.buyPrice.toLocaleString('tr-TR',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{fontWeight:'700',color:'#10b981',fontSize:'0.9rem'}}>₺{item.sellPrice.toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
                    </td>
                    <td style={{padding:'0.625rem 0.5rem'}}>
                      <div style={{display:'flex',gap:'0.3rem',justifyContent:'flex-end'}}>
                        <button onClick={()=>onSelectForSale(item)} title="Satışa Ekle" style={{padding:'0.25rem 0.5rem',backgroundColor:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem',fontWeight:'600'}}>🛒 Sat</button>
                        <button onClick={()=>openEdit(item)} title="Düzenle" style={{padding:'0.25rem 0.4rem',backgroundColor:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem'}}>✏️</button>
                        <button onClick={()=>handleDelete(item)} title="Sil" style={{padding:'0.25rem 0.4rem',backgroundColor:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem'}}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
