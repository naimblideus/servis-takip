'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import { PART_GROUPS } from '@/lib/part-groups';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface StockItem { id:string; source:'PART'|'PRINTER'; name:string; sku?:string|null; barcode?:string|null; category?:string|null; brand?:string|null; model?:string|null; color?:string|null; condition?:string|null; group?:string|null; buyPrice:number; sellPrice:number; stockQty:number; minStock?:number; notes?:string|null; }

const PRINTER_CATS = ['TONER','MUREKEP','YAZICI'];
const s = { inp:{padding:'0.5rem 0.75rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',fontSize:'0.875rem',width:'100%',boxSizing:'border-box' as const}, lbl:{display:'block' as const,fontSize:'0.78rem',fontWeight:'500' as const,color:'#6b7280',marginBottom:'0.2rem'} };

const EMPTY_FORM = { source:'PART' as 'PART'|'PRINTER', name:'', sku:'', barcode:'', group:'', buyPrice:'', sellPrice:'', stockQty:'1', minStock:'5', category:'TONER', brand:'', model:'', color:'', condition:'SIFIR', quantity:'1', notes:'' };

export default function StockTab({ onSelectForSale, onStockChanged }:{ onSelectForSale:(item:StockItem)=>void; onStockChanged?:()=>void }) {
  // `sz` (sözlük): `s` stil nesnesi olarak kullanılıyor.
  const sz = useT();
  // Grup KOD olarak saklanıyor; ekranda adı görünür. Tanınmayan bir değer
  // (bayinin elle yazdığı eski grup) olduğu gibi gösterilir — kaybolmasın.
  const grupAdi = (g?: string | null) =>
      (g && (sz.parcaGrubu as Record<string, string>)[g]) || g || '';

  const bic = useBicim();
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
    if (found) { setScanMsg(doldur(sz.stok.okundu, { n: found.name })); openEdit(found); }
    else { setScanMsg(doldur(sz.stok.yeniBarkod, { n: code })); setForm({ ...EMPTY_FORM, barcode: code }); setEditItem(null); setModal('add'); }
    setTimeout(() => setScanMsg(null), 4000);
  }, { enabled: !modal });

  const handleSave = async () => {
    if (form.source === 'PART' && !form.name.trim()) { alert(sz.stok.parcaAdiZorunlu); return; }
    if (form.source === 'PRINTER' && (!form.brand.trim() || !form.model.trim())) { alert(sz.stok.markaModelZorunlu); return; }
    setSaving(true);
    try {
      const body = modal === 'edit' ? { ...form, id:editItem!.id } : form;
      const r = await fetch('/api/stock', { method: modal === 'edit' ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (r.ok) { setModal(null); load(); onStockChanged?.(); }
      else { const d = await r.json(); alert(doldur(sz.fisler.hata, { n: d.error })); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (item:StockItem) => {
    if (!confirm(doldur(sz.stok.silSor, { n: item.name }))) return;
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
            {src==='PART'?sz.stok.parcaSarf:sz.stok.yaziciToner}
          </button>
        ))}
      </div>

      {form.source === 'PART' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem'}}>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>{sz.stok.parcaAdi}</label><input style={s.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder={sz.stok.parcaAdiYer} /></div>
          <div><label style={s.lbl}>{sz.stok.skuKod}</label><input style={s.inp} value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder={sz.stok.otomatik} /></div>
          <div><label style={s.lbl}>{sz.stok.barkod}</label><input style={s.inp} value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder={sz.stok.barkodYer} /></div>
          <div><label style={s.lbl}>{sz.stok.grup}</label><select style={s.inp} value={form.group} onChange={e=>setForm(f=>({...f,group:e.target.value}))}><option value="">{sz.stok.seciniz}</option>{PART_GROUPS.map(g=><option key={g} value={g}>{grupAdi(g)}</option>)}</select></div>
          <div><label style={s.lbl}>{doldur(sz.stok.alisFiyati, { birim: bic.simge })}</label><input type="number" style={s.inp} value={form.buyPrice} onChange={e=>setForm(f=>({...f,buyPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>{doldur(sz.stok.satisFiyati, { birim: bic.simge })}</label><input type="number" style={s.inp} value={form.sellPrice} onChange={e=>setForm(f=>({...f,sellPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>{sz.stok.stokAdedi}</label><input type="number" style={s.inp} value={form.stockQty} onChange={e=>setForm(f=>({...f,stockQty:e.target.value}))} /></div>
          <div><label style={s.lbl}>{sz.stok.minStok}</label><input type="number" style={s.inp} value={form.minStock} onChange={e=>setForm(f=>({...f,minStock:e.target.value}))} /></div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(10rem,1fr))',gap:'0.75rem'}}>
          <div><label style={s.lbl}>{sz.gider.kategori}</label><select style={s.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{PRINTER_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={s.lbl}>{sz.stok.durum}</label><select style={s.inp} value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}><option value="SIFIR">{sz.stok.sifir}</option><option value="IKINCI_EL">{sz.stok.ikinciEl}</option></select></div>
          <div><label style={s.lbl}>{sz.stok.marka}</label><input style={s.inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder={sz.stok.markaYer} /></div>
          <div><label style={s.lbl}>{sz.stok.model}</label><input style={s.inp} value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder={sz.stok.modelYer} /></div>
          <div><label style={s.lbl}>{sz.stok.renk}</label><input style={s.inp} value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} placeholder={sz.stok.renkYer} /></div>
          <div><label style={s.lbl}>{sz.stok.adet}</label><input type="number" style={s.inp} value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} /></div>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>{sz.stok.barkod}</label><input style={s.inp} value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder={sz.stok.barkodYerYazici} /></div>
          <div><label style={s.lbl}>{doldur(sz.stok.alisFiyati, { birim: bic.simge })}</label><input type="number" style={s.inp} value={form.buyPrice} onChange={e=>setForm(f=>({...f,buyPrice:e.target.value}))} placeholder="0.00" /></div>
          <div><label style={s.lbl}>{doldur(sz.stok.satisFiyati, { birim: bic.simge })}</label><input type="number" style={s.inp} value={form.sellPrice} onChange={e=>setForm(f=>({...f,sellPrice:e.target.value}))} placeholder="0.00" /></div>
          <div style={{gridColumn:'1/-1'}}><label style={s.lbl}>{sz.stok.notlar}</label><textarea style={{...s.inp,resize:'vertical',minHeight:'60px'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={sz.gider.istegeBagli} /></div>
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
              <span style={{fontWeight:'700',fontSize:'1rem'}}>{modal==='add'?sz.stok.yeniBaslik:sz.stok.duzenleBaslik}</span>
              <button onClick={()=>setModal(null)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{padding:'1.25rem'}}>
              <FormBody />
              <div style={{display:'flex',gap:'0.5rem',marginTop:'1.25rem'}}>
                <button onClick={()=>setModal(null)} style={{flex:1,padding:'0.625rem',backgroundColor:'#f3f4f6',color:'#374151',border:'1px solid #d1d5db',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'500'}}>{sz.genel.iptal}</button>
                <button onClick={handleSave} disabled={saving} style={{flex:2,padding:'0.625rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontWeight:'600',opacity:saving?0.7:1}}>
                  {saving ? sz.genel.kaydediliyor : modal==='add' ? sz.stok.kalemEkle : `✅ ${sz.genel.kaydet}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1.25rem'}}>
        <div style={{minWidth:'11rem',flex:'1 1 14rem'}}>
          <h2 style={{fontWeight:'700',fontSize:'1.25rem',margin:0}}>{sz.stok.baslik}</h2>
          <p style={{color:'#6b7280',margin:'0.2rem 0 0',fontSize:'0.85rem'}}>{sz.stok.altOn} <span style={{color:'#2563eb'}}>{sz.stok.altOkuyucu}</span></p>
        </div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <Link href="/satis" style={{backgroundColor:'#dcfce7',color:'#15803d',padding:'0.625rem 1rem',borderRadius:'0.5rem',border:'1px solid #86efac',fontWeight:'600',fontSize:'0.85rem',textDecoration:'none'}}>{sz.stok.barkodlaSatis}</Link>
          <Link href="/etiket" style={{backgroundColor:'#eef2ff',color:'#3730a3',padding:'0.625rem 1rem',borderRadius:'0.5rem',border:'1px solid #c7d2fe',fontWeight:'600',fontSize:'0.85rem',textDecoration:'none'}}>{sz.stok.zebraEtiket}</Link>
          <button onClick={openAdd} style={{backgroundColor:'#2563eb',color:'white',padding:'0.625rem 1.25rem',borderRadius:'0.5rem',border:'none',fontWeight:'600',cursor:'pointer',fontSize:'0.875rem'}}>{sz.stok.yeniKalem}</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:'0.25rem',backgroundColor:'#f3f4f6',borderRadius:'0.5rem',padding:'0.25rem'}}>
          {([['all',sz.genel.tumu],['PART',sz.stok.filtreParca],['PRINTER',sz.stok.filtreYazici]] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setSrcFilter(k)} style={{padding:'0.4rem 0.875rem',borderRadius:'0.375rem',border:'none',cursor:'pointer',fontSize:'0.82rem',fontWeight:srcFilter===k?'600':'400',backgroundColor:srcFilter===k?'white':'transparent',color:srcFilter===k?'#374151':'#6b7280',boxShadow:srcFilter===k?'0 1px 2px rgba(0,0,0,0.1)':'none'}}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={sz.stok.araYer} style={{...s.inp,flex:1,backgroundColor:'#f9fafb'}} />
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(8.5rem,1fr))',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {label:sz.stok.toplamKalem,val:items.length,icon:'📦',color:'#3b82f6'},
          {label:sz.stok.parca,val:items.filter(i=>i.source==='PART').length,icon:'🔧',color:'#8b5cf6'},
          {label:sz.stok.yaziciTonerKisa,val:items.filter(i=>i.source==='PRINTER').length,icon:'🖨️',color:'#f59e0b'},
        ].map(c=>(
          <div key={c.label} style={{backgroundColor:'white',border:'1px solid #e5e7eb',borderRadius:'0.75rem',padding:'0.875rem',display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <span style={{fontSize:'1.5rem'}}>{c.icon}</span>
            <div><div style={{fontSize:'1.25rem',fontWeight:'700',color:c.color}}>{c.val}</div><div style={{fontSize:'0.72rem',color:'#6b7280'}}>{c.label}</div></div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? <div style={{padding:'2rem',textAlign:'center',color:'#6b7280'}}>{sz.genel.yukleniyor}</div> : filtered.length === 0 ? (
        <div style={{padding:'3rem',textAlign:'center',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:'0.75rem'}}>
          <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>📭</div>
          <div>{search ? sz.stok.aramaYok : sz.stok.kalemYok}</div>
          {!search && <button onClick={openAdd} style={{marginTop:'0.75rem',padding:'0.5rem 1rem',backgroundColor:'#2563eb',color:'white',border:'none',borderRadius:'0.5rem',cursor:'pointer',fontSize:'0.85rem'}}>{sz.stok.ilkKalem}</button>}
        </div>
      ) : (
        /* overflowX:auto — eskiden overflow:'hidden' idi ve geniş tablo
              telefonda KIRPILIYORDU: son sütunlara ulaşmanın hiçbir yolu
              yoktu. Artık tablo kendi içinde yana kayıyor, sayfa kaymıyor. */
        <div style={{backgroundColor:'white',borderRadius:'0.75rem',border:'1px solid #e5e7eb',overflowX:'auto'}}>
          <table style={{width:'100%',minWidth:'34rem',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{backgroundColor:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {[sz.stok.sutunKalem,sz.stok.sutunKategoriGrup,sz.stok.adet,sz.stok.sutunAlis,sz.stok.sutunSatis,''].map((h,hi)=>(
                  <th key={hi} style={{padding:'0.625rem 0.875rem',textAlign:'left',fontSize:'0.75rem',fontWeight:'600',color:'#374151'}}>{h}</th>
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
                      {item.condition === 'IKINCI_EL' && <span style={{fontSize:'0.65rem',backgroundColor:'#fef3c7',color:'#92400e',padding:'0.1rem 0.35rem',borderRadius:'9999px',fontWeight:'600'}}>{sz.stok.ikinciEl}</span>}
                    </td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{backgroundColor:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,padding:'0.15rem 0.5rem',borderRadius:'9999px',fontSize:'0.72rem',fontWeight:'600'}}>
                        {item.source==='PART'?(grupAdi(item.group)||sz.stok.parca):(item.category||sz.stok.stokKisa)}
                      </span>
                    </td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{fontWeight:'700',color:lowStock?'#ef4444':'#111827',fontSize:'0.9rem'}}>{item.stockQty}</span>
                      {lowStock && <span style={{display:'block',fontSize:'0.65rem',color:'#ef4444'}}>{sz.stok.az}</span>}
                    </td>
                    <td style={{padding:'0.625rem 0.875rem',fontSize:'0.875rem',color:'#6b7280'}}>{bic.para(item.buyPrice)}</td>
                    <td style={{padding:'0.625rem 0.875rem'}}>
                      <span style={{fontWeight:'700',color:'#10b981',fontSize:'0.9rem'}}>{bic.para(item.sellPrice)}</span>
                    </td>
                    <td style={{padding:'0.625rem 0.5rem'}}>
                      <div style={{display:'flex',gap:'0.3rem',justifyContent:'flex-end'}}>
                        <button onClick={()=>onSelectForSale(item)} title={sz.stok.satisaEkle} style={{padding:'0.25rem 0.5rem',backgroundColor:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem',fontWeight:'600'}}>{sz.stok.sat}</button>
                        <button onClick={()=>openEdit(item)} title={sz.genel.duzenle} style={{padding:'0.25rem 0.4rem',backgroundColor:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem'}}>✏️</button>
                        <button onClick={()=>handleDelete(item)} title={sz.genel.sil} style={{padding:'0.25rem 0.4rem',backgroundColor:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.7rem'}}>🗑️</button>
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
