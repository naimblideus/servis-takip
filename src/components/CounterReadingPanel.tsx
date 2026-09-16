'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

// Fotoğrafı tarayıcıda küçült (max ~1100px, JPEG ~0.6) -> küçük base64 (DB'de saklanır)
function downscaleImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const max = 1100;
                let { width, height } = img;
                if (width > max || height > max) {
                    const r = Math.min(max / width, max / height);
                    width = Math.round(width * r); height = Math.round(height * r);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('canvas yok'));
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Okumanın kaynağı — tartışmada kanıt ağırlığını söyler. "Adam o kadar
 * çekmedim diyor" anında bayinin ekranda görmesi gereken şey bu: cihazın
 * kendi raporu mu, teknisyenin elle yazdığı mı. Renk kanıt gücünü izler:
 * yeşil = cihaz kendisi bildirdi (itiraz edilemez), mavi = görsel kanıt,
 * gri = beyan.
 */
// Ad sözlükte (sayacPanel.kaynak); burada yalnız renk.
const KAYNAK_RENK: Record<string, { renk: string; arka: string }> = {
    CIHAZ_EPOSTA:  { renk: '#047857', arka: '#d1fae5' },
    FOTOGRAF:      { renk: '#1d4ed8', arka: '#dbeafe' },
    WHATSAPP_FOTO: { renk: '#1d4ed8', arka: '#dbeafe' },
    PORTAL:        { renk: '#6d28d9', arka: '#ede9fe' },
    TOPLU:         { renk: '#4b5563', arka: '#f3f4f6' },
    SERVIS_FISI:   { renk: '#4b5563', arka: '#f3f4f6' },
    ELLE:          { renk: '#4b5563', arka: '#f3f4f6' },
};

interface Reading {
    id: string;
    counterBlack: number;
    counterColor: number;
    deltaBlack: number;
    deltaColor: number;
    calculatedCost: number;
    monthlyRent: number;
    readingDate: string;
    ticket?: { ticketNumber: string } | null;
    hasPhoto?: boolean;
    /** CIHAZ_EPOSTA | FOTOGRAF | WHATSAPP_FOTO | PORTAL | TOPLU | SERVIS_FISI | ELLE */
    source?: string;
}

interface DeviceInfo {
    isRental: boolean;
    monthlyRent: number;
    pricePerBlack: number | null;
    pricePerColor: number | null;
}

interface Pricing {
    pricePerBlack: number;
    pricePerColor: number;
    isDeviceLevel: boolean;
}

export default function CounterReadingPanel({ deviceId }: { deviceId: string }) {
    const router = useRouter();
    const t = useT();
    const b = useBicim();
    const kaynakAdi = (k: string) => (t.sayacPanel.kaynak as Record<string, string>)[k];
    const [readings, setReadings] = useState<Reading[]>([]);
    const [device, setDevice] = useState<DeviceInfo | null>(null);
    const [pricing, setPricing] = useState<Pricing | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [form, setForm] = useState({ counterBlack: '', counterColor: '', includeMonthlyRent: true });
    const [photo, setPhoto] = useState<string>('');
    const [photoBusy, setPhotoBusy] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);
    // Sayaç düşünce uç REDDEDİYOR ve 'sıfırlandı onayıyla tekrar gönderin'
    // diyordu — ama bu ekranda öyle bir onay YOKTU. Bayi çıkmaz sokakta
    // kalıyor, tek makineyi düzeltmek için Sayaç Turu'na gitmesi gerekiyordu.
    // Sebep sorulmadan onay alınmıyor: iki durum tamamen farklı para demek.
    const [dususSoruluyor, setDususSoruluyor] = useState(false);
    const [resetTur, setResetTur] = useState<'CIHAZ_DEGISTI' | 'SAYAC_SIFIRLANDI' | null>(null);
    // Girişin YAPILDIĞI AN, teknisyen hâlâ makinenin başındayken verilen uyarı.
    // Kaçan Gelir ekranındaki şüpheli listesi ay sonunda yakalıyor; burası
    // hatanın düzeltilmesi en ucuz olan yer.
    const [uyari, setUyari] = useState<string | null>(null);

    // Edit modal state
    const [editReading, setEditReading] = useState<Reading | null>(null);
    const [editForm, setEditForm] = useState({ counterBlack: '', counterColor: '' });
    const [editSaving, setEditSaving] = useState(false);

    const load = async () => {
        const res = await fetch(`/api/devices/${deviceId}/readings`);
        if (res.ok) {
            const data = await res.json();
            setReadings(data.readings);
            setDevice(data.device);
            setPricing(data.pricing);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!form.counterBlack || !form.counterColor) return;
        // Düşüş soruldu ama sebep seçilmediyse gönderme: sebepsiz onay,
        // sistemin kendi kendine karar vermesi demek olurdu.
        if (dususSoruluyor && !resetTur) return;
        setSaving(true);
        setLastResult(null);
        setUyari(null);
        const res = await fetch(`/api/devices/${deviceId}/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                counterBlack: parseInt(form.counterBlack),
                counterColor: parseInt(form.counterColor),
                includeMonthlyRent: form.includeMonthlyRent,
                photo: photo || undefined,
                ...(resetTur ? { reset: true, resetTur } : {}),
            }),
        });
        if (res.ok) {
            const data = await res.json();
            setLastResult(data.breakdown);
            // Uç uyarıyı zaten döndürüyordu; bu ekran onu okumuyordu. Yanlış
            // yazılmış bir sayaç için en ucuz an, teknisyenin hâlâ makinenin
            // başında olduğu andır.
            setUyari(typeof data.warning === 'string' ? data.warning : null);
            setForm({ counterBlack: '', counterColor: '', includeMonthlyRent: true });
            setPhoto('');
            setDususSoruluyor(false);
            setResetTur(null);
            await load();
            router.refresh();
        } else {
            const d = await res.json();
            // Düşüşte hata kutusu göstermek yerine SEBEBİ soruyoruz — bayinin
            // burada yapacağı iş bu.
            if (d.code === 'COUNTER_DECREASE') setDususSoruluyor(true);
            else alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const deleteReading = async (readingId: string) => {
        if (!confirm(t.sayacPanel.silSor)) return;
        setDeleting(readingId);
        const res = await fetch(`/api/devices/${deviceId}/readings?readingId=${readingId}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            await load();
            router.refresh();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setDeleting(null);
    };

    const openEdit = (r: Reading) => {
        setEditReading(r);
        setEditForm({ counterBlack: String(r.counterBlack), counterColor: String(r.counterColor) });
    };

    const closeEdit = () => {
        setEditReading(null);
        setEditForm({ counterBlack: '', counterColor: '' });
    };

    const saveEdit = async () => {
        if (!editReading || !editForm.counterBlack || !editForm.counterColor) return;
        setEditSaving(true);
        const res = await fetch(`/api/devices/${deviceId}/readings?readingId=${editReading.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                counterBlack: parseInt(editForm.counterBlack),
                counterColor: parseInt(editForm.counterColor),
            }),
        });
        if (res.ok) {
            closeEdit();
            await load();
            router.refresh();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setEditSaving(false);
    };

    const inp = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', width: '140px' };
    const modalInp = { padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' as const };

    return (
        <>
            {/* ── Edit Modal ─────────────────────────────────────────── */}
            {editReading && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '1rem',
                        padding: '2rem', width: '380px', maxWidth: '95vw',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{t.sayacPanel.duzenleBaslik}</h3>
                            <button onClick={closeEdit} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '1.4rem', color: '#6b7280', lineHeight: 1,
                            }}>×</button>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.5rem', backgroundColor: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                            📅 {b.tarih(editReading.readingDate)}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                                    {t.fisDetay.siyahSayac}
                                </label>
                                <input
                                    type="number"
                                    style={modalInp}
                                    value={editForm.counterBlack}
                                    onChange={e => setEditForm({ ...editForm, counterBlack: e.target.value })}
                                />
                                {editForm.counterBlack && (
                                    <div style={{ fontSize: '0.75rem', color: '#0ea5e9', marginTop: '0.25rem', fontWeight: '600' }}>
                                        {b.sayi(Number(editForm.counterBlack))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                                    {t.fisDetay.renkliSayac}
                                </label>
                                <input
                                    type="number"
                                    style={modalInp}
                                    value={editForm.counterColor}
                                    onChange={e => setEditForm({ ...editForm, counterColor: e.target.value })}
                                />
                                {editForm.counterColor && (
                                    <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: '0.25rem', fontWeight: '600' }}>
                                        {b.sayi(Number(editForm.counterColor))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={closeEdit}
                                style={{
                                    flex: 1, padding: '0.6rem', border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem', cursor: 'pointer', backgroundColor: 'white',
                                    color: '#374151', fontWeight: '600', fontSize: '0.875rem',
                                }}
                            >
                                {t.genel.iptal}
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={!editForm.counterBlack || !editForm.counterColor || editSaving}
                                style={{
                                    flex: 1, padding: '0.6rem', border: 'none',
                                    borderRadius: '0.5rem', cursor: 'pointer',
                                    backgroundColor: '#0ea5e9', color: 'white',
                                    fontWeight: '600', fontSize: '0.875rem',
                                    opacity: (!editForm.counterBlack || !editForm.counterColor || editSaving) ? 0.6 : 1,
                                }}
                            >
                                {editSaving ? t.genel.kaydediliyor : t.fisPanel.kaydet}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Panel ──────────────────────────────────────────────── */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontWeight: '600' }}>{t.sayacPanel.baslik}</h2>
                    {device?.isRental && (
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.75rem', borderRadius: '9999px' }}>
                            {t.cihazlar.kiralik}
                        </span>
                    )}
                </div>

                {/* Birim Fiyat Bilgisi */}
                {device?.isRental && pricing && (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{doldur(t.sayacPanel.siyahBirim, { n: b.para(pricing.pricePerBlack) })}</span>
                        <span>{doldur(t.sayacPanel.renkliBirim, { n: b.para(pricing.pricePerColor) })}</span>
                        {device.monthlyRent > 0 && <span>{doldur(t.sayacPanel.aidat, { n: b.para(device.monthlyRent) })}</span>}
                        {pricing.isDeviceLevel && (
                            <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>{t.sayacPanel.ozelFiyat}</span>
                        )}
                    </div>
                )}

                {/* Yeni Okuma */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' }}>{t.sayacPanel.siyahSayac}</label>
                        <input type="number" style={inp} placeholder={t.sayacPanel.ornekSiyah} value={form.counterBlack} onChange={e => setForm({ ...form, counterBlack: e.target.value })} />
                        {form.counterBlack && <div style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: '600', marginTop: '0.2rem' }}>{b.sayi(Number(form.counterBlack))}</div>}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' }}>{t.sayacPanel.renkliSayac}</label>
                        <input type="number" style={inp} placeholder={t.sayacPanel.ornekRenkli} value={form.counterColor} onChange={e => setForm({ ...form, counterColor: e.target.value })} />
                        {form.counterColor && <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: '600', marginTop: '0.2rem' }}>{b.sayi(Number(form.counterColor))}</div>}
                    </div>
                    {device?.isRental && device.monthlyRent > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.includeMonthlyRent} onChange={e => setForm({ ...form, includeMonthlyRent: e.target.checked })} />
                            Aylık aidat dahil
                        </label>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' }}>{t.sayacPanel.fotograf}</label>
                        {photo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <img src={photo} alt={t.sayacPanel.fotografAlt} style={{ height: 37, borderRadius: 6, border: '1px solid #d1d5db' }} />
                                <button type="button" onClick={() => setPhoto('')} title={t.sayacPanel.kaldir} style={{ height: 37, width: 30, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                            </div>
                        ) : (
                            <label style={{ display: 'inline-flex', alignItems: 'center', height: 37, padding: '0 0.9rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#374151', background: 'white', whiteSpace: 'nowrap' }}>
                                {photoBusy ? '...' : t.sayacPanel.cekYukle}
                                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                                    onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setPhotoBusy(true); try { setPhoto(await downscaleImage(f)); } catch { alert(t.sayacPanel.fotoHatasi); } setPhotoBusy(false); e.target.value = ''; }} />
                            </label>
                        )}
                    </div>
                    <button onClick={save} disabled={!form.counterBlack || !form.counterColor || saving} style={{
                        padding: '0.5rem 1.25rem', backgroundColor: '#0ea5e9', color: 'white',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600',
                        opacity: (!form.counterBlack || !form.counterColor || saving) ? 0.6 : 1, fontSize: '0.875rem',
                        height: '37px',
                    }}>
                        {saving ? '...' : t.sayacPanel.ekle}
                    </button>
                </div>

                {/* DÜŞÜŞTE SEBEP SORUSU
                    Uç düşüşü reddedip "sıfırlandı onayıyla tekrar gönderin" diyordu,
                    ama bu ekranda öyle bir onay yoktu: bayi tek makineyi düzeltmek
                    için Sayaç Turu'na gitmek zorundaydı. Onay tek başına da yetmez —
                    iki durum tamamen farklı para demek, o yüzden SEBEP soruluyor. */}
                {dususSoruluyor && (
                    <div style={{ padding: '0.9rem 1rem', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '0.6rem', marginBottom: '1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.9rem' }}>{t.sayacPanel.dususBaslik}</div>
                        <p style={{ margin: '0.25rem 0 0.7rem', fontSize: '0.78rem', color: '#7c2d12', lineHeight: 1.5 }}>
                            {t.sayacPanel.dususAlt}
                        </p>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {([
                                ['CIHAZ_DEGISTI', t.sayacPanel.cihazDegisti, t.sayacPanel.cihazDegistiAlt],
                                ['SAYAC_SIFIRLANDI', t.sayacPanel.sayacSifirlandi, t.sayacPanel.sayacSifirlandiAlt],
                            ] as const).map(([tur, baslik, aciklama]) => (
                                <label key={tur} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'white', border: '1px solid ' + (resetTur === tur ? '#ea580c' : '#fed7aa'), borderRadius: 8, padding: '0.6rem 0.7rem', cursor: 'pointer' }}>
                                    <input type="radio" name="resetTur" checked={resetTur === tur} onChange={() => setResetTur(tur)} style={{ marginTop: 3 }} />
                                    <span>
                                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', color: '#0B1533' }}>{baslik}</span>
                                        <span style={{ display: 'block', fontSize: '0.74rem', color: '#5B6479', lineHeight: 1.45 }}>{aciklama}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: '0.7rem', flexWrap: 'wrap' }}>
                            <button onClick={save} disabled={!resetTur || saving}
                                style={{ minHeight: 40, padding: '0 1rem', background: '#ea580c', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: (!resetTur || saving) ? 0.6 : 1 }}>
                                {saving ? '...' : t.sayacPanel.onaylaKaydet}
                            </button>
                            <button onClick={() => { setDususSoruluyor(false); setResetTur(null); }}
                                style={{ minHeight: 40, padding: '0 1rem', background: 'white', color: '#7c2d12', border: '1px solid #fed7aa', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                                {t.genel.iptal}
                            </button>
                        </div>
                    </div>
                )}

                {/* GİRİŞ ANINDAKİ ANOMALİ UYARISI
                    Uç bunu zaten döndürüyordu, ekran okumuyordu. Yanlış yazılmış bir
                    sayacı düzeltmenin en ucuz anı, teknisyenin hâlâ makinenin başında
                    olduğu andır; ay sonunda düzeltmek fatura tartışması demektir.
                    Okuma yine de KAYDEDİLİR — sistem sessizce para tutmaz. */}
                {uyari && (
                    <div style={{ padding: '0.8rem 1rem', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '0.6rem', marginBottom: '1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1rem' }}>⚠️</span>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.85rem' }}>{t.sayacPanel.uyariBaslik}</div>
                            <div style={{ fontSize: '0.78rem', color: '#7c2d12', lineHeight: 1.5, marginTop: 2 }}>{uyari}</div>
                        </div>
                        <button onClick={() => setUyari(null)} title={t.genel.kapat}
                            style={{ marginLeft: 'auto', minWidth: 32, minHeight: 32, border: 'none', background: 'transparent', color: '#9a3412', cursor: 'pointer', fontSize: '0.95rem' }}>✕</button>
                    </div>
                )}

                {/* Son Hesaplama */}
                {lastResult && (
                    <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #86efac', marginBottom: '1.25rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#065f46' }}>{t.sayacPanel.ucretHesabi}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <div>{doldur(t.sayacPanel.siyahSatir, { adet: b.sayi(lastResult.deltaBlack), birim: b.para(lastResult.pricePerBlack) })}</div>
                            <div style={{ fontWeight: '600' }}>= {b.para(lastResult.blackCost)}</div>
                            <div>{doldur(t.sayacPanel.renkliSatir, { adet: b.sayi(lastResult.deltaColor), birim: b.para(lastResult.pricePerColor) })}</div>
                            <div style={{ fontWeight: '600' }}>= {b.para(lastResult.colorCost)}</div>
                            {lastResult.monthlyRent > 0 && <>
                                <div>{t.sayacPanel.aylikAidat}</div>
                                <div style={{ fontWeight: '600' }}>= {b.para(lastResult.monthlyRent)}</div>
                            </>}
                        </div>
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #86efac', fontSize: '1.1rem', fontWeight: '700', color: '#065f46' }}>
                            {doldur(t.sayacPanel.toplamSatir, { n: b.para(lastResult.total) })}
                        </div>
                    </div>
                )}

                {/* Okuma Geçmişi */}
                {loading ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{t.genel.yukleniyor}</p>
                ) : readings.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>{t.sayacPanel.okumaYok}</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    {[t.genel.tarih, t.sayacPanel.sutunSiyah, '+Δ', t.sayacPanel.sutunRenkli, '+Δ', ...(device?.isRental ? [t.sayacPanel.sutunUcret] : []), t.sayacPanel.sutunFis, t.sayacPanel.sutunIslemler].map((h, i) => (
                                        <th key={`${h}-${i}`} style={{
                                            padding: '0.6rem 0.75rem', textAlign: h === t.sayacPanel.sutunIslemler ? 'center' : 'left',
                                            fontSize: '0.75rem', fontWeight: '700', color: '#374151',
                                            whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {readings.map(r => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8faff')}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap' }}>
                                            {b.tarih(r.readingDate)}
                                            {/* Kaynak rozeti: tartışmada bayinin ilk baktığı şey.
                                                Tarihin altında, ayrı sütun açmadan — tablo zaten geniş. */}
                                            {r.source && KAYNAK_RENK[r.source] && (
                                                <div style={{
                                                    display: 'inline-block', marginTop: 3, padding: '1px 7px', borderRadius: 999,
                                                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.01em',
                                                    color: KAYNAK_RENK[r.source].renk, background: KAYNAK_RENK[r.source].arka,
                                                }} title={t.sayacPanel.kaynakIpucu}>
                                                    {kaynakAdi(r.source)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                            {b.sayi(r.counterBlack)}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: r.deltaBlack > 0 ? '#059669' : '#9ca3af' }}>
                                            {r.deltaBlack > 0 ? `+${b.sayi(r.deltaBlack)}` : '—'}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#7c3aed' }}>
                                            {b.sayi(r.counterColor)}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: r.deltaColor > 0 ? '#7c3aed' : '#9ca3af' }}>
                                            {r.deltaColor > 0 ? `+${b.sayi(r.deltaColor)}` : '—'}
                                        </td>
                                        {device?.isRental && (
                                            <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', fontWeight: '700', color: Number(r.calculatedCost) > 0 ? '#059669' : '#9ca3af', whiteSpace: 'nowrap' }}>
                                                {Number(r.calculatedCost) > 0 ? b.para(Number(r.calculatedCost)) : '—'}
                                            </td>
                                        )}
                                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#2563eb' }}>
                                            {r.ticket?.ticketNumber || '—'}
                                        </td>
                                        {/* İşlemler */}
                                        <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                {/* Foto (varsa) */}
                                                {r.hasPhoto && (
                                                    <a
                                                        href={`/api/devices/${deviceId}/readings/photo?readingId=${r.id}`}
                                                        target="_blank" rel="noreferrer"
                                                        title={t.sayacPanel.fotoIpucu}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                            backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                                                            borderRadius: '0.375rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
                                                        }}
                                                    >{t.sayacPanel.foto}</a>
                                                )}
                                                {/* Düzenle */}
                                                <button
                                                    onClick={() => openEdit(r)}
                                                    title={t.sayacPanel.duzenleIpucu}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        backgroundColor: '#eff6ff', color: '#1d4ed8',
                                                        border: '1px solid #bfdbfe',
                                                        borderRadius: '0.375rem', padding: '0.3rem 0.6rem',
                                                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                                >
                                                    {t.sayacPanel.duzenle}
                                                </button>

                                                {/* Sil */}
                                                <button
                                                    onClick={() => deleteReading(r.id)}
                                                    disabled={deleting === r.id}
                                                    title={t.sayacPanel.silIpucu}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        backgroundColor: '#fef2f2', color: '#b91c1c',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: '0.375rem', padding: '0.3rem 0.6rem',
                                                        cursor: deleting === r.id ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.75rem', fontWeight: '600',
                                                        opacity: deleting === r.id ? 0.5 : 1,
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (deleting !== r.id) e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                                >
                                                    {deleting === r.id ? t.sayacPanel.siliniyor : t.sayacPanel.sil}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
