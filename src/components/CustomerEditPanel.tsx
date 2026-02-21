'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
    customer: {
        id: string;
        name: string;
        phone: string;
        address: string | null;
        taxNo: string | null;
    };
}

export default function CustomerEditPanel({ customer }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        taxNo: customer.taxNo || '',
    });

    const save = async () => {
        setSaving(true);
        const res = await fetch(`/api/customers/${customer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            router.refresh();
            setOpen(false);
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const deleteCustomer = async () => {
        if (!confirm(`"${customer.name}" müşterisini ve tüm cihazlarını/fişlerini silmek isteriyor musunuz?`)) return;
        const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/customers');
        } else {
            const d = await res.json();
            alert('Silinemedi: ' + d.error);
        }
    };

    const inp = {
        width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' as const,
    };
    const lbl = { fontSize: '0.8rem', fontWeight: '500' as const, color: '#6b7280', display: 'block' as const, marginBottom: '0.25rem' };

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setOpen(!open)} style={{
                padding: '0.5rem 1rem', backgroundColor: open ? '#f3f4f6' : 'white',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500',
            }}>
                {open ? '✕ Kapat' : '✏️ Düzenle'}
            </button>
            <button onClick={deleteCustomer} style={{
                padding: '0.5rem 0.875rem', backgroundColor: '#fee2e2', border: 'none',
                borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer',
                color: '#b91c1c', fontWeight: '500',
            }}>🗑️</button>

            {open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setOpen(false)}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '1rem', padding: '2rem',
                        width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '1.5rem' }}>Müşteri Düzenle</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Ad Soyad *</label>
                            <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Telefon *</label>
                            <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Adres</label>
                            <textarea rows={2} style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={lbl}>Vergi No</label>
                            <input style={inp} value={form.taxNo} onChange={e => setForm({ ...form, taxNo: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={save} disabled={saving} style={{
                                flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
                                opacity: saving ? 0.7 : 1,
                            }}>
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <button onClick={() => setOpen(false)} style={{
                                padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', backgroundColor: 'white',
                                borderRadius: '0.5rem', cursor: 'pointer', color: '#374151',
                            }}>İptal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
