'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface TenantStats {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    plan: string;
    isActive: boolean;
    createdAt: string;
    _count: { users: number; customers: number; devices: number; serviceTickets: number };
    recentTickets: number;
    totalRevenue: number;
}

const PLANS = [
    { key: 'starter', label: 'Starter', color: '#6b7280', bg: '#f3f4f6', icon: '🌱' },
    { key: 'standard', label: 'Standard', color: '#2563eb', bg: '#eff6ff', icon: '⭐' },
    { key: 'pro', label: 'Pro', color: '#7c3aed', bg: '#f5f3ff', icon: '👑' },
];

export default function SuperAdminPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const role = (session?.user as any)?.role;

    const [tenants, setTenants] = useState<TenantStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editTenant, setEditTenant] = useState<TenantStats | null>(null);
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({
        tenantName: '', phone: '', address: '',
        adminName: '', adminEmail: '', adminPassword: '',
        plan: 'starter',
    });

    useEffect(() => {
        if (role && role !== 'SUPER_ADMIN') {
            router.push('/dashboard');
            return;
        }
        loadTenants();
    }, [role]);

    const loadTenants = async () => {
        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
            const data = await res.json();
            setTenants(data);
        }
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                setShowForm(false);
                setForm({ tenantName: '', phone: '', address: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter' });
                loadTenants();
            } else {
                alert('Hata: ' + data.error);
            }
        } catch (e: any) {
            alert('Hata: ' + e.message);
        }
        setSaving(false);
    };

    const handleToggleActive = async (t: TenantStats) => {
        if (!confirm(`${t.name} işletmesini ${t.isActive ? 'askıya almak' : 'aktif etmek'} istediğinize emin misiniz?`)) return;
        const res = await fetch('/api/admin/tenants', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: t.id, isActive: !t.isActive }),
        });
        if (res.ok) loadTenants();
    };

    const handleUpdatePlan = async (tenantId: string, plan: string) => {
        const res = await fetch('/api/admin/tenants', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, plan }),
        });
        if (res.ok) loadTenants();
    };

    const handleDelete = async (t: TenantStats) => {
        if (!confirm(`⚠️ DİKKAT: "${t.name}" işletmesi ve TÜM verileri kalıcı olarak silinecek! Bu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?`)) return;
        const res = await fetch(`/api/admin/tenants?tenantId=${t.id}`, { method: 'DELETE' });
        if (res.ok) loadTenants();
        else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
    };

    const handleSaveEdit = async () => {
        if (!editTenant) return;
        const res = await fetch('/api/admin/tenants', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: editTenant.id,
                name: editTenant.name,
                phone: editTenant.phone,
                address: editTenant.address,
            }),
        });
        if (res.ok) {
            setEditTenant(null);
            loadTenants();
        }
    };

    if (role !== 'SUPER_ADMIN') {
        return <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>⏳ Yükleniyor...</div>;
    }

    const filtered = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.phone || '').includes(search) ||
        (t.address || '').toLowerCase().includes(search.toLowerCase())
    );

    const totalUsers = tenants.reduce((s, t) => s + t._count.users, 0);
    const totalCustomers = tenants.reduce((s, t) => s + t._count.customers, 0);
    const totalDevices = tenants.reduce((s, t) => s + t._count.devices, 0);
    const totalTickets = tenants.reduce((s, t) => s + t._count.serviceTickets, 0);
    const totalRevenue = tenants.reduce((s, t) => s + t.totalRevenue, 0);
    const activeCount = tenants.filter(t => t.isActive).length;

    const inp: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '0.625rem', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', transition: 'border 0.15s' };
    const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}>🛡️</div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Süper Admin Paneli</h1>
                            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>Tüm işletmeleri yönetin — {tenants.length} kayıtlı işletme</p>
                        </div>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{
                    background: showForm ? '#f3f4f6' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
                    color: showForm ? '#374151' : 'white',
                    padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: showForm ? '1px solid #d1d5db' : 'none',
                    fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                    boxShadow: showForm ? 'none' : '0 4px 15px rgba(124,58,237,0.3)',
                    transition: 'all 0.2s',
                }}>
                    {showForm ? '✕ İptal' : '+ Yeni İşletme'}
                </button>
            </div>

            {/* Özet Kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'İşletme', value: `${activeCount}/${tenants.length}`, icon: '🏢', bg: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', color: '#7c3aed' },
                    { label: 'Kullanıcı', value: totalUsers, icon: '👤', bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', color: '#2563eb' },
                    { label: 'Müşteri', value: totalCustomers, icon: '👥', bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', color: '#059669' },
                    { label: 'Cihaz', value: totalDevices, icon: '🖨️', bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#d97706' },
                    { label: 'Toplam Fiş', value: totalTickets, icon: '📋', bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', color: '#db2777' },
                    { label: 'Toplam Ciro', value: `₺${totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`, icon: '💰', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#059669' },
                ].map(c => (
                    <div key={c.label} style={{ background: c.bg, borderRadius: '1rem', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.25rem' }}>{c.icon} {c.label}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Yeni İşletme Formu */}
            {showForm && (
                <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '1.75rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
                    <h2 style={{ fontWeight: '700', color: '#111827', marginBottom: '1rem', fontSize: '1.1rem' }}>🏢 Yeni İşletme Ekle</h2>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {/* Sol: İşletme Bilgileri */}
                            <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>İşletme Bilgileri</h3>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>Firma Adı *</label>
                                    <input required style={inp} value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} placeholder="Örn: ABC Fotokopi" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <label style={lbl}>Telefon</label>
                                        <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0532 xxx xx xx" />
                                    </div>
                                    <div>
                                        <label style={lbl}>Plan</label>
                                        <select style={inp} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>
                                            {PLANS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={lbl}>Adres</label>
                                    <input style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Şehir, ilçe..." />
                                </div>
                            </div>

                            {/* Sağ: Admin Bilgileri */}
                            <div>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yönetici Hesabı</h3>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>Ad Soyad *</label>
                                    <input required style={inp} value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} placeholder="Yöneticinin tam adı" />
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>E-posta *</label>
                                    <input required type="email" style={inp} value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@firma.com" />
                                </div>
                                <div>
                                    <label style={lbl}>Şifre *</label>
                                    <input required type="password" style={inp} value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="En az 6 karakter" minLength={6} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" disabled={saving} style={{
                                background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white',
                                padding: '0.75rem 2rem', borderRadius: '0.625rem', border: 'none',
                                fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                                opacity: saving ? 0.7 : 1,
                                boxShadow: '0 4px 15px rgba(124,58,237,0.3)',
                            }}>
                                {saving ? '⏳ Oluşturuluyor...' : '🏢 İşletmeyi Oluştur'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Arama */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '1rem' }}>🔍</span>
                <input
                    placeholder="İşletme adı, telefon veya adres ile ara..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ ...inp, paddingLeft: '2.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem' }}
                />
            </div>

            {/* İşletme Listesi */}
            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>⏳ Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '1rem' }}>
                    {search ? `"${search}" ile eşleşen işletme bulunamadı` : 'Henüz işletme yok — yukarıdan ekleyin'}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {filtered.map(t => {
                        const plan = PLANS.find(p => p.key === t.plan) || PLANS[0];
                        return (
                            <div key={t.id} style={{
                                backgroundColor: 'white', borderRadius: '1rem', padding: '1.25rem',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
                                opacity: t.isActive ? 1 : 0.55, transition: 'all 0.2s',
                                borderLeft: `4px solid ${t.isActive ? plan.color : '#d1d5db'}`,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    {/* Sol: Bilgiler */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#111827' }}>{t.name}</h3>
                                            <span style={{
                                                backgroundColor: plan.bg, color: plan.color,
                                                padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '700',
                                            }}>{plan.icon} {plan.label}</span>
                                            {!t.isActive && (
                                                <span style={{
                                                    backgroundColor: '#fef2f2', color: '#dc2626',
                                                    padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '700',
                                                }}>⏸️ Askıda</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            {t.phone && <span>📞 {t.phone}</span>}
                                            {t.address && <span>📍 {t.address}</span>}
                                            <span>📅 {new Date(t.createdAt).toLocaleDateString('tr-TR')}</span>
                                        </div>
                                    </div>

                                    {/* Orta: İstatistikler */}
                                    <div style={{ display: 'flex', gap: '1.25rem', margin: '0 1.5rem', alignItems: 'center' }}>
                                        {[
                                            { label: 'Kullanıcı', value: t._count.users, icon: '👤' },
                                            { label: 'Müşteri', value: t._count.customers, icon: '👥' },
                                            { label: 'Cihaz', value: t._count.devices, icon: '🖨️' },
                                            { label: 'Fiş', value: t._count.serviceTickets, icon: '📋' },
                                            { label: '30g Fiş', value: t.recentTickets, icon: '📊' },
                                        ].map(s => (
                                            <div key={s.label} style={{ textAlign: 'center', minWidth: '45px' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>{s.value}</div>
                                                <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{s.icon} {s.label}</div>
                                            </div>
                                        ))}
                                        <div style={{ textAlign: 'center', minWidth: '70px' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#059669' }}>
                                                ₺{t.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>💰 Ciro</div>
                                        </div>
                                    </div>

                                    {/* Sağ: Butonlar */}
                                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                        <select
                                            value={t.plan}
                                            onChange={e => handleUpdatePlan(t.id, e.target.value)}
                                            style={{
                                                padding: '0.35rem 0.5rem', fontSize: '0.72rem', borderRadius: '0.375rem',
                                                border: '1px solid #d1d5db', cursor: 'pointer', backgroundColor: '#f9fafb',
                                            }}
                                        >
                                            {PLANS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                                        </select>
                                        <button onClick={() => setEditTenant({ ...t })} title="Düzenle" style={{
                                            padding: '0.4rem 0.6rem', backgroundColor: '#eff6ff', color: '#2563eb',
                                            border: '1px solid #93c5fd', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                                        }}>✏️</button>
                                        <button onClick={() => handleToggleActive(t)} title={t.isActive ? 'Askıya Al' : 'Aktif Et'} style={{
                                            padding: '0.4rem 0.6rem',
                                            backgroundColor: t.isActive ? '#fffbeb' : '#ecfdf5',
                                            color: t.isActive ? '#d97706' : '#059669',
                                            border: `1px solid ${t.isActive ? '#fde68a' : '#a7f3d0'}`,
                                            borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                                        }}>{t.isActive ? '⏸️' : '▶️'}</button>
                                        <button onClick={() => handleDelete(t)} title="Sil" style={{
                                            padding: '0.4rem 0.6rem', backgroundColor: '#fef2f2', color: '#dc2626',
                                            border: '1px solid #fca5a5', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                                        }}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Düzenle Modal */}
            {editTenant && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    onClick={() => setEditTenant(null)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        backgroundColor: 'white', borderRadius: '1rem', padding: '1.75rem', width: '480px', maxWidth: '95vw',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>✏️ İşletme Düzenle</h3>
                            <button onClick={() => setEditTenant(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <label style={lbl}>Firma Adı</label>
                            <input style={inp} value={editTenant.name} onChange={e => setEditTenant({ ...editTenant, name: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                                <label style={lbl}>Telefon</label>
                                <input style={inp} value={editTenant.phone || ''} onChange={e => setEditTenant({ ...editTenant, phone: e.target.value })} />
                            </div>
                            <div>
                                <label style={lbl}>Plan</label>
                                <select style={inp} value={editTenant.plan} onChange={e => setEditTenant({ ...editTenant, plan: e.target.value })}>
                                    {PLANS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Adres</label>
                            <input style={inp} value={editTenant.address || ''} onChange={e => setEditTenant({ ...editTenant, address: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setEditTenant(null)} style={{
                                flex: 1, padding: '0.625rem', backgroundColor: '#f3f4f6', color: '#374151',
                                border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                            }}>İptal</button>
                            <button onClick={handleSaveEdit} style={{
                                flex: 1, padding: '0.625rem', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white',
                                border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700',
                            }}>✓ Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
