'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import { PART_GROUPS } from '@/lib/part-groups';

interface Part {
    id: string;
    sku: string;
    name: string;
    sellPrice: number;
    stockQty: number;
    group: string | null;
}

interface TicketPart {
    id: string;
    quantity: number;
    unitPrice: number;
    part: { sku: string; name: string; group: string | null };
}

interface Props {
    ticketId: string;
}

export default function TicketPartsPanel({ ticketId }: Props) {
    const router = useRouter();
    const [ticketParts, setTicketParts] = useState<TicketPart[]>([]);
    const [allParts, setAllParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Arama state
    const [searchText, setSearchText] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [quantity, setQuantity] = useState('1');
    const searchRef = useRef<HTMLDivElement>(null);

    // Yeni parça ekleme formu
    const [showNewPartForm, setShowNewPartForm] = useState(false);
    const [newPart, setNewPart] = useState({
        name: '', group: '', sellPrice: '', stockQty: '1'
    });
    const [creatingPart, setCreatingPart] = useState(false);

    // Barkod okuyucu (HID) geri bildirimi
    const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null);

    // ── TONER DEĞİŞİMİ ────────────────────────────────────────────────
    // Fişe toner eklemek, toner DEĞİŞTİ demektir. Sistem bunu kendisi
    // kaydediyor ve iki değişim arasındaki sayfa farkından o modelin
    // gerçek verimini öğreniyor. Rengi addan çıkmıyorsa teknisyene tek
    // dokunuşluk soru soruluyor — yanlış kanala yazmaktansa sormak.
    const [tonerSoru, setTonerSoru] = useState<{ ticketPartId: string; partAdi: string } | null>(null);
    const [tonerBilgi, setTonerBilgi] = useState<string | null>(null);

    // ── BU MODELDE EN ÇOK KULLANILANLAR ──────────────────────────────
    // Ölçüldü: 8.188 parça kullanımının %41'i her modelin ilk 3
    // parçasında. Teknisyen makinenin başında, telefonuyla, elleri
    // kirli — aradığı parça belliyse aratmamak lazım.
    const [oneri, setOneri] = useState<any[]>([]);

    const tonerCevabi = (d: any) => {
        if (d?.tonerSorusu) { setTonerSoru(d.tonerSorusu); setTonerBilgi(null); return; }
        if (d?.tonerKaydi) {
            setTonerSoru(null);
            const k = d.tonerKaydi.kanal === 'COLOR' ? 'Renkli' : 'S/B';
            setTonerBilgi(d.tonerKaydi.olculenVerim
                ? `${k} toner değişimi kaydedildi — bu cihazda ${d.tonerKaydi.olculenVerim.toLocaleString('tr-TR')} sayfa ölçüldü.`
                : `${k} toner değişimi kaydedildi. Verim, bir sonraki değişimde ölçülecek.`);
        }
    };

    const kanalCevapla = async (kanal: string) => {
        if (!tonerSoru) return;
        const r = await fetch(`/api/tickets/${ticketId}/parts`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketPartId: tonerSoru.ticketPartId, kanal }),
        });
        const d = await r.json();
        if (!r.ok) { alert(d.error || 'Kaydedilemedi'); return; }
        setTonerSoru(null);
        const k = kanal === 'COLOR' ? 'Renkli' : 'S/B';
        setTonerBilgi(d.olculenVerim
            ? `${k} toner değişimi kaydedildi — bu cihazda ${d.olculenVerim.toLocaleString('tr-TR')} sayfa ölçüldü.`
            : `${k} toner değişimi kaydedildi. Verim, bir sonraki değişimde ölçülecek.`);
    };

    const load = async () => {
        const [tpRes, pRes] = await Promise.all([
            fetch(`/api/tickets/${ticketId}/parts`),
            fetch('/api/inventory'),
        ]);
        if (tpRes.ok) setTicketParts(await tpRes.json());
        if (pRes.ok) setAllParts(await pRes.json());
        setLoading(false);
    };

    // Öneriler ayrı yükleniyor: gecikirse ya da boş dönerse parça
    // ekleme akışı beklemesin.
    useEffect(() => {
        fetch(`/api/tickets/${ticketId}/parts/oneri`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setOneri(Array.isArray(d?.parcalar) ? d.parcalar : []))
            .catch(() => {});
    }, [ticketId]);

    useEffect(() => { load(); }, []);

    // Scan mesajını birkaç saniye sonra otomatik temizle
    useEffect(() => {
        if (!scanMsg) return;
        const t = setTimeout(() => setScanMsg(null), 3500);
        return () => clearTimeout(t);
    }, [scanMsg]);

    // ═══ Barkod okuyucuyla fişe parça ekle (okut → otomatik 1 adet düş) ═══
    const handleScan = async (code: string) => {
        setScanMsg({ text: `Okutuluyor: ${code}…`, ok: true });
        try {
            const res = await fetch(`/api/tickets/${ticketId}/parts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode: code, quantity: 1 }),
            });
            if (res.ok) {
                tonerCevabi(await res.json().catch(() => null));
                await load();
                const tpRes = await fetch(`/api/tickets/${ticketId}/parts`);
                if (tpRes.ok) { const parts = await tpRes.json(); await syncTotalCost(parts); }
                router.refresh();
                setScanMsg({ text: `Eklendi: ${code}`, ok: true });
            } else {
                const d = await res.json().catch(() => ({}));
                setScanMsg({ text: `${d.error || 'Barkod bulunamadı'} (${code})`, ok: false });
            }
        } catch {
            setScanMsg({ text: `Bağlantı hatası (${code})`, ok: false });
        }
    };

    // Yeni ürün formu açıkken (kullanıcı yazarken) wedge'i kapat; hook zaten input odağında bypass eder.
    useBarcodeWedge(handleScan, { enabled: !loading && !showNewPartForm });

    // Dış tıklama ile dropdown'ı kapat
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Arama filtresi
    const filteredParts = allParts.filter(p =>
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchText.toLowerCase()) ||
        (p.group && p.group.toLowerCase().includes(searchText.toLowerCase()))
    );

    const selectPart = (p: Part) => {
        setSelectedPart(p);
        setSearchText(`${p.sku} — ${p.name}`);
        setShowResults(false);
    };

    // Parça toplamını ticket totalCost olarak güncelle
    const syncTotalCost = async (parts: TicketPart[]) => {
        const newTotal = parts.reduce((s, tp) => s + Number(tp.unitPrice) * tp.quantity, 0);
        await fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalCost: newTotal }),
        });
    };

    /** Tek dokunuşla ekle — arama, seçme, adet yazma adımları atlanıyor. */
    const hizliEkle = async (partId: string) => {
        setSaving(true);
        const res = await fetch(`/api/tickets/${ticketId}/parts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partId, quantity: 1 }),
        });
        if (res.ok) {
            tonerCevabi(await res.json().catch(() => null));
            await load();
            const tpRes = await fetch(`/api/tickets/${ticketId}/parts`);
            if (tpRes.ok) { const parts = await tpRes.json(); await syncTotalCost(parts); }
            router.refresh();
        } else {
            const d = await res.json().catch(() => ({}));
            alert('Hata: ' + (d.error || 'Eklenemedi'));
        }
        setSaving(false);
    };

    const addPart = async () => {
        if (!selectedPart) return;
        setSaving(true);
        const res = await fetch(`/api/tickets/${ticketId}/parts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partId: selectedPart.id, quantity: parseInt(quantity) }),
        });
        if (res.ok) {
            tonerCevabi(await res.json().catch(() => null));
            setSelectedPart(null);
            setSearchText('');
            setQuantity('1');
            await load();
            // Toplam güncelle
            const tpRes = await fetch(`/api/tickets/${ticketId}/parts`);
            if (tpRes.ok) { const parts = await tpRes.json(); await syncTotalCost(parts); }
            router.refresh();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const removePart = async (ticketPartId: string) => {
        if (!confirm('Bu parçayı fişten çıkarıp stoğa geri koymak isteniyor musunuz?')) return;
        await fetch(`/api/tickets/${ticketId}/parts?ticketPartId=${ticketPartId}`, {
            method: 'DELETE',
        });
        await load();
        // Toplam güncelle
        const tpRes = await fetch(`/api/tickets/${ticketId}/parts`);
        if (tpRes.ok) { const parts = await tpRes.json(); await syncTotalCost(parts); }
        router.refresh();
    };

    // Inline fiyat/adet güncelleme
    const updateTicketPart = async (tpId: string, field: 'unitPrice' | 'quantity', value: string) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal) || numVal < 0) return;
        await fetch(`/api/parts/ticket-parts/${tpId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: numVal }),
        });
        await load();
        // Toplam güncelle
        const tpRes = await fetch(`/api/tickets/${ticketId}/parts`);
        if (tpRes.ok) { const parts = await tpRes.json(); await syncTotalCost(parts); }
        router.refresh();
    };

    // Yeni parça oluştur (stoktan)
    const createNewPart = async () => {
        if (!newPart.name.trim()) return;
        setCreatingPart(true);
        try {
            const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPart.name,
                    group: newPart.group || null,
                    sellPrice: newPart.sellPrice || '0',
                    buyPrice: '0',
                    stockQty: newPart.stockQty || '1',
                    minStock: '1',
                }),
            });
            if (res.ok) {
                const createdPart = await res.json();
                // Listeyi güncelle ve yeni parçayı seç
                await load();
                setSelectedPart(createdPart);
                setSearchText(`${createdPart.sku} — ${createdPart.name}`);
                setShowNewPartForm(false);
                setNewPart({ name: '', group: '', sellPrice: '', stockQty: '1' });
            } else {
                const d = await res.json();
                alert('Hata: ' + d.error);
            }
        } catch (e) {
            alert('Ürün oluşturulurken hata oluştu');
        }
        setCreatingPart(false);
    };

    const total = ticketParts.reduce((s, tp) => s + Number(tp.unitPrice) * tp.quantity, 0);
    const inp: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' };
    const editInp: React.CSSProperties = {
        padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem',
        fontSize: '0.875rem', width: '80px', textAlign: 'right' as const,
    };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ fontWeight: '600', margin: 0 }}>Kullanılan Parçalar</h2>
                <span title="USB barkod okuyucuyla bir parça barkodunu okutun — otomatik olarak 1 adet eklenir."
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc',
                        padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: '600',
                    }}>
                    <span style={{ fontSize: '0.85rem' }}>▮▮▯▮</span> Barkod okuyucu hazır
                </span>
            </div>

            {/* ═══ BU MODELDE EN ÇOK KULLANILANLAR ═══
                Katalog ya da uyumluluk tablosu DEĞİL: bayinin kendi
                geçmişinde bu modele ne taktığı. Uydurma uyumluluk,
                yanlış parça önermek olurdu. */}
            {oneri.length > 0 && (
                <div style={{ marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>
                        Bu modelde en çok kullanılanlar
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {oneri.map((o) => {
                            const yok = o.stockQty < 1;
                            return (
                                <button key={o.id} type="button" disabled={saving || yok}
                                    onClick={() => hizliEkle(o.id)}
                                    title={yok ? `${o.name} — stokta yok` : `${o.name} · ${o.kullanim} kez kullanıldı · stok ${o.stockQty}`}
                                    style={{
                                        padding: '0.45rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.82rem',
                                        fontWeight: 600, cursor: yok ? 'not-allowed' : 'pointer', textAlign: 'left',
                                        border: '1px solid ' + (yok ? '#e5e7eb' : '#bfdbfe'),
                                        background: yok ? '#f9fafb' : '#eff6ff',
                                        color: yok ? '#9ca3af' : '#1e3a8a',
                                        maxWidth: '15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                    + {o.name}{yok ? ' (stokta yok)' : ` · stok ${o.stockQty}`}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ TONER DEĞİŞİMİ — tek dokunuşluk soru ═══ */}
            {tonerSoru && (
                <div style={{
                    backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem',
                    padding: '0.75rem 1rem', marginBottom: '0.75rem',
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '0.5rem' }}>
                        {tonerSoru.partAdi} takıldı — hangi toner?
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => kanalCevapla('BLACK')} style={{
                            padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: 'none',
                            background: '#111827', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                        }}>S/B</button>
                        <button type="button" onClick={() => kanalCevapla('COLOR')} style={{
                            padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: 'none',
                            background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                        }}>Renkli</button>
                        <button type="button" onClick={() => setTonerSoru(null)} style={{
                            padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
                            background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                        }}>Toner değişmedi</button>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
                        Bu cevap tonerin ne kadar dayandığını ölçmek için; parça zaten fişe eklendi.
                    </div>
                </div>
            )}
            {tonerBilgi && (
                <div style={{
                    backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857',
                    borderRadius: '0.5rem', padding: '0.6rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.82rem',
                }}>
                    ✓ {tonerBilgi}
                </div>
            )}

            {/* ═══ Barkod okuma geri bildirimi ═══ */}
            {scanMsg && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    backgroundColor: scanMsg.ok ? '#ecfdf5' : '#fef2f2',
                    color: scanMsg.ok ? '#047857' : '#b91c1c',
                    border: `1px solid ${scanMsg.ok ? '#a7f3d0' : '#fecaca'}`,
                    borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
                    fontSize: '0.85rem', fontWeight: '500',
                }}>
                    <span>{scanMsg.ok ? '✓' : '✕'}</span> {scanMsg.text}
                </div>
            )}

            {/* ═══ Parça Arama (Autocomplete) ═══ */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div ref={searchRef} style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Parça Ara (Ad, SKU veya Grup)
                    </label>
                    <input
                        type="text"
                        style={{ ...inp, width: '100%' }}
                        value={searchText}
                        onChange={e => {
                            setSearchText(e.target.value);
                            setShowResults(true);
                            if (!e.target.value) setSelectedPart(null);
                        }}
                        onFocus={() => setShowResults(true)}
                        placeholder="🔍 Parça adı veya kodu yazın..."
                    />
                    {showResults && searchText && filteredParts.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                            maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}>
                            {filteredParts.slice(0, 30).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => selectPart(p)}
                                    style={{
                                        padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                                        borderBottom: '1px solid #f3f4f6',
                                        backgroundColor: selectedPart?.id === p.id ? '#eff6ff' : 'white',
                                        opacity: p.stockQty <= 0 ? 0.5 : 1,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = selectedPart?.id === p.id ? '#eff6ff' : 'white')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>{p.sku}</span>
                                            <span style={{ fontWeight: '500' }}>{p.name}</span>
                                        </div>
                                        <span style={{ fontWeight: '600', color: '#059669', fontSize: '0.8rem' }}>₺{Number(p.sellPrice).toFixed(2)}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                                        Stok: {p.stockQty} {p.group ? `• ${p.group}` : ''}
                                        {p.stockQty <= 0 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>Stok yok</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {showResults && searchText && filteredParts.length === 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                            padding: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}>
                            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>Sonuç bulunamadı</p>
                            <button
                                onClick={() => { setShowNewPartForm(true); setShowResults(false); setNewPart(p => ({ ...p, name: searchText })); }}
                                style={{
                                    marginTop: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: '#10b981',
                                    color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: '500',
                                }}
                            >+ Yeni Ürün Oluştur</button>
                        </div>
                    )}
                </div>

                <input
                    type="number" min="1" style={{ ...inp, width: '70px' }}
                    value={quantity} onChange={e => setQuantity(e.target.value)}
                />
                <button onClick={addPart} disabled={!selectedPart || saving} style={{
                    padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                    opacity: (!selectedPart || saving) ? 0.6 : 1, fontSize: '0.875rem',
                }}>
                    {saving ? '...' : '+ Ekle'}
                </button>
                <button onClick={() => setShowNewPartForm(!showNewPartForm)} style={{
                    padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a',
                    border: '1px solid #86efac', borderRadius: '0.5rem', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '500',
                }}>
                    Yeni Ürün
                </button>
            </div>

            {/* ═══ Yeni Parça Oluşturma Formu ═══ */}
            {showNewPartForm && (
                <div style={{
                    backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem',
                    padding: '1rem', marginBottom: '1rem',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#16a34a', margin: 0 }}>Yeni Ürün Oluştur</h3>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ürün kodu otomatik verilecek</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Ürün Adı *</label>
                            <input
                                type="text" style={{ ...inp, width: '100%' }}
                                value={newPart.name}
                                onChange={e => setNewPart({ ...newPart, name: e.target.value })}
                                placeholder="Ürün adı girin..."
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Ürün Grubu</label>
                            <select
                                style={{ ...inp, width: '100%' }}
                                value={newPart.group}
                                onChange={e => setNewPart({ ...newPart, group: e.target.value })}
                            >
                                <option value="">Grup seçin...</option>
                                {PART_GROUPS.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Satış Fiyatı (₺)</label>
                            <input
                                type="number" step="0.01" min="0" style={{ ...inp, width: '100%' }}
                                value={newPart.sellPrice}
                                onChange={e => setNewPart({ ...newPart, sellPrice: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Stok Adedi</label>
                            <input
                                type="number" min="0" style={{ ...inp, width: '100%' }}
                                value={newPart.stockQty}
                                onChange={e => setNewPart({ ...newPart, stockQty: e.target.value })}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button onClick={createNewPart} disabled={creatingPart || !newPart.name.trim()} style={{
                            padding: '0.5rem 1rem', backgroundColor: '#16a34a', color: 'white',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                            fontSize: '0.85rem', opacity: (creatingPart || !newPart.name.trim()) ? 0.6 : 1,
                        }}>
                            {creatingPart ? 'Kaydediliyor...' : '✓ Oluştur ve Seç'}
                        </button>
                        <button onClick={() => setShowNewPartForm(false)} style={{
                            padding: '0.5rem 1rem', backgroundColor: 'white', color: '#374151',
                            border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}>İptal</button>
                    </div>
                </div>
            )}

            {/* ═══ Parça Listesi ═══ */}
            {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Yükleniyor...</p>
            ) : ticketParts.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Henüz parça eklenmedi</p>
            ) : (
                <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['SKU', 'Parça', 'Grup', 'Adet', 'Birim Fiyat', 'Toplam', ''].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ticketParts.map(tp => (
                                <tr key={tp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>{tp.part.sku}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{tp.part.name}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                                        {tp.part.group ? (
                                            <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '500' }}>
                                                {tp.part.group}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#9ca3af' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <input
                                            type="number" min="1" style={editInp}
                                            defaultValue={tp.quantity}
                                            onBlur={e => updateTicketPart(tp.id, 'quantity', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <input
                                            type="number" step="0.01" min="0" style={editInp}
                                            defaultValue={Number(tp.unitPrice).toFixed(2)}
                                            onBlur={e => updateTicketPart(tp.id, 'unitPrice', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>₺{(Number(tp.unitPrice) * tp.quantity).toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <button onClick={() => removePart(tp.id)} style={{
                                            backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none',
                                            borderRadius: '0.375rem', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem',
                                        }}>Çıkar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: '#059669' }}>
                        Parçalar Toplamı: ₺{total.toFixed(2)}
                    </div>
                </>
            )}
        </div>
    );
}
