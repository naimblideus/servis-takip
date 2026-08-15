'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TwoFactorCard from '@/components/TwoFactorCard';

interface TenantInfo {
    id: string;
    name: string;
    logo: string | null;
    phone: string | null;
    address: string | null;
    pricePerBlack: number;
    pricePerColor: number;
    sayacEpostaKodu: string | null;
}

export default function SettingsPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [tenant, setTenant] = useState<TenantInfo | null>(null);
    const [form, setForm] = useState({ name: '', phone: '', address: '', pricePerBlack: '0.40', pricePerColor: '1.50', portalShowFinancials: true });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        fetch('/api/settings').then(r => r.json()).then(data => {
            setTenant(data);
            setForm({
                name: data.name || '',
                phone: data.phone || '',
                address: data.address || '',
                pricePerBlack: String(data.pricePerBlack ?? '0.40'),
                pricePerColor: String(data.pricePerColor ?? '1.50'),
                portalShowFinancials: data.portalShowFinancials !== false,
            });
        });
    }, []);

    const save = async () => {
        setSaving(true);
        setMsg('');
        const res = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setMsg('✅ Kaydedildi');
            router.refresh();
        } else {
            const d = await res.json();
            setMsg('❌ ' + d.error);
        }
        setSaving(false);
    };

    const uploadLogo = async (file: File) => {
        setUploading(true);
        setMsg('');
        const fd = new FormData();
        fd.append('logo', file);
        const res = await fetch('/api/settings', { method: 'POST', body: fd });
        if (res.ok) {
            const data = await res.json();
            // Base64 data URL'lerine ?t= eklenemez, sadece normal URL'lere cache-bust ekle
            const logoUrl = data.logo?.startsWith('data:') ? data.logo : (data.logo + '?t=' + Date.now());
            setTenant(prev => prev ? { ...prev, logo: logoUrl } : prev);
            setMsg('✅ Logo yüklendi');
        } else {
            const d = await res.json();
            setMsg('❌ ' + d.error);
        }
        setUploading(false);
    };

    const inp: React.CSSProperties = { width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };
    const lbl: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };

    if (!tenant) return <div style={{ padding: '2rem', color: '#9ca3af' }}>Yükleniyor...</div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Firma Ayarları</h1>

            {msg && <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', backgroundColor: msg.startsWith('✅') ? '#d1fae5' : '#fee2e2' }}>{msg}</div>}

            {/* Logo */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Firma Logosu</h2>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{
                        width: '120px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '0.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        backgroundColor: '#f9fafb',
                    }}>
                        {tenant.logo ? (
                            <img src={tenant.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Logo yok</span>
                        )}
                    </div>
                    <div>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); }} />
                        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                            padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem',
                            opacity: uploading ? 0.6 : 1,
                        }}>
                            {uploading ? 'Yükleniyor...' : '📁 Logo Yükle'}
                        </button>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>PNG, JPG, SVG veya WebP (önerilen: 300x100px)</p>
                    </div>
                </div>
            </div>

            {/* Firma Bilgileri */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Firma Bilgileri</h2>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={lbl}>Firma Adı</label>
                    <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={lbl}>Telefon</label>
                    <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0532 123 4567" />
                </div>
                <div style={{ marginBottom: '0' }}>
                    <label style={lbl}>Adres</label>
                    <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' } as React.CSSProperties} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Firma adresi" />
                </div>
            </div>

            {/* ── Cihazdan Sayaç: bayinin KENDİ e-posta adresi ──
                Bayi tarafındaki tek kurulum adımı bu adresi cihazlara girmek.
                Kod bayi açılırken üretiliyor; burada yalnız gösteriliyor. */}
            {tenant?.sayacEpostaKodu && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Cihazdan Otomatik Sayaç</h2>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.6 }}>
                        Çoğu fotokopi/yazıcı, sayaç raporunu ayın belirli günü e-postayla gönderebiliyor.
                        Cihazlarınıza <b>aşağıdaki adresi</b> tanımlarsanız sayaçlar kendiliğinden düşer —
                        kimse gezmez, kimse fotoğraf beklemez.
                    </p>

                    <div style={{
                        padding: '0.75rem 0.9rem', borderRadius: '0.6rem',
                        backgroundColor: '#f0fdfa', border: '1px solid #99f6e4',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
                    }}>
                        <code style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f766e', wordBreak: 'break-all' }}>
                            sayac+{tenant.sayacEpostaKodu}@nextusservis.com
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard?.writeText(`sayac+${tenant.sayacEpostaKodu}@nextusservis.com`);
                                setMsg('✅ Adres kopyalandı');
                            }}
                            style={{ padding: '0.4rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #14b8a6', background: 'white', color: '#0f766e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >Kopyala</button>
                    </div>

                    <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', color: '#374151', lineHeight: 1.7 }}>
                        <b>Cihaza nasıl tanımlanır:</b> cihazın web arayüzü → e-posta/bildirim ayarları →
                        sayaç raporu alıcısı olarak bu adresi girin, gönderim gününü ayın 1&apos;i yapın.
                    </div>
                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.6 }}>
                        Adresteki kod <b>size özeldir</b> — sayacın hangi firmaya ait olduğunu o söyler.
                        Tek e-postada onlarca cihaz gönderen filo raporları da desteklenir; okunamayan
                        cihazlar <b>Cihazdan Sayaç</b> ekranında incelemenizi bekler, hiçbir değer tahmin edilmez.
                    </div>
                </div>
            )}

            {/* Müşteri Paneli — mali bilgi görünürlüğü */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Müşteri Paneli</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Müşterilerinize gönderdiğiniz panelde mali bilgiler görünsün mü? Kapatırsanız
                    bakiye, fatura listesi ve servis tutarlarının <b>hepsi</b> gizlenir — biri açık
                    kalırsa diğerini ele verir. Cihazlar, servis durumu ve bildirim gönderme çalışmaya devam eder.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.portalShowFinancials} style={{ marginTop: '0.2rem', width: 18, height: 18, cursor: 'pointer' }}
                        onChange={e => setForm({ ...form, portalShowFinancials: e.target.checked })} />
                    <span style={{ fontSize: '0.875rem' }}>
                        <b>Bakiye ve faturaları müşteriye göster</b>
                        <span style={{ display: 'block', color: '#6b7280', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                            {form.portalShowFinancials
                                ? 'Müşteri kendi bakiyesini ve faturalarını görüyor.'
                                : 'Müşteri hiçbir tutar görmüyor; yalnız cihazlarını ve servis durumunu görüyor.'}
                        </span>
                    </span>
                </label>
            </div>

            {/* Sayaç Birim Fiyatları */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Varsayılan Sayaç Birim Fiyatları</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>Cihaz bazında özel fiyat belirtilmemişse bu varsayılan fiyatlar kullanılır. Her cihaza özel fiyat vermek için cihaz düzenleme ekranını kullanın.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={lbl}>⚫ Siyah Sayaç (TL/adet)</label>
                        <input type="number" step="0.01" min="0" style={inp} value={form.pricePerBlack}
                            onChange={e => setForm({ ...form, pricePerBlack: e.target.value })} />
                    </div>
                    <div>
                        <label style={lbl}>🟣 Renkli Sayaç (TL/adet)</label>
                        <input type="number" step="0.01" min="0" style={inp} value={form.pricePerColor}
                            onChange={e => setForm({ ...form, pricePerColor: e.target.value })} />
                    </div>
                </div>
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#1e40af' }}>
                    💡 Örnek: 500 siyah × ₺{Number(form.pricePerBlack || 0).toFixed(2)} = ₺{(500 * Number(form.pricePerBlack || 0)).toFixed(2)} | 1500 renkli × ₺{Number(form.pricePerColor || 0).toFixed(2)} = ₺{(1500 * Number(form.pricePerColor || 0)).toFixed(2)}
                </div>
            </div>

            {/* Kaydet */}
            <button onClick={save} disabled={saving} style={{
                width: '100%', padding: '0.75rem', backgroundColor: '#10b981', color: 'white',
                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem',
                opacity: saving ? 0.6 : 1,
            }}>
                {saving ? 'Kaydediliyor...' : '💾 Tümünü Kaydet'}
            </button>

            <TwoFactorCard />
            <BackupCard />
        </div>
    );
}

/** Yedek alma — verinin bir kopyasını kendi bilgisayarına indir (ayda bir hatırlatır). */
function BackupCard() {
    const [last, setLast] = useState<string | null>(null);
    useEffect(() => { setLast(localStorage.getItem('nx_last_backup')); }, []);

    const days = last ? Math.floor((Date.now() - Number(last)) / 86400000) : null;
    const overdue = days === null || days >= 30;

    const download = (photos: boolean) => {
        localStorage.setItem('nx_last_backup', String(Date.now()));
        setLast(String(Date.now()));
        window.location.href = `/api/backup${photos ? '?photos=1' : ''}`;
    };

    return (
        <div style={{
            marginTop: '1.5rem', backgroundColor: 'white', borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem',
            borderLeft: `4px solid ${overdue ? '#f59e0b' : '#10b981'}`,
        }}>
            <h2 style={{ fontWeight: '600', marginBottom: '0.35rem' }}>💾 Verinin Yedeği</h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '0.9rem' }}>
                Tüm müşteri, cihaz, fiş ve muhasebe kaydınızın kopyasını <b>kendi bilgisayarınıza</b> indirin.
                Ayda bir almanız yeterli. {overdue
                    ? <b style={{ color: '#b45309' }}>{days === null ? 'Henüz yedek almadınız.' : `Son yedek ${days} gün önce.`}</b>
                    : <span style={{ color: '#059669' }}>Son yedek {days} gün önce ✓</span>}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button onClick={() => download(false)} style={{
                    padding: '0.6rem 1.1rem', backgroundColor: '#0f2253', color: 'white',
                    border: 'none', borderRadius: '0.5rem', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem',
                }}>⬇️ Yedeği indir</button>
                <button onClick={() => download(true)} title="Sayaç fotoğrafları dahil — dosya çok büyük olabilir" style={{
                    padding: '0.6rem 1.1rem', backgroundColor: 'white', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem',
                }}>Fotoğraflarla birlikte</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.75rem', lineHeight: 1.5 }}>
                Dosyayı silmeyin. Bu, verinizin okunabilir bir kopyasıdır (JSON) — bir sorun
                yaşanırsa kayıtlarınız bu dosyadan geri getirilir. Uygulama içinde tek tuşla
                geri yükleme yoktur; geri yükleme destek tarafından yapılır.
            </p>
        </div>
    );
}
