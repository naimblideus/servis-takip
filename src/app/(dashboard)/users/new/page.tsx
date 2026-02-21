'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TECHNICIAN',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 6) { setError('Şifre en az 6 karakter olmalı'); return; }
        setLoading(true);
        setError('');
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok) {
            router.push('/users');
        } else {
            setError(data.error || 'Bir hata oluştu');
            setLoading(false);
        }
    };

    const inp = {
        width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const,
    };
    const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };

    return (
        <div style={{ padding: '2rem', maxWidth: '500px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/users" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Kullanıcılar</Link>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.25rem' }}>Yeni Kullanıcı</h1>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                {error && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ❌ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={lbl}>Ad Soyad *</label>
                        <input required style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ahmet Yılmaz" />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={lbl}>E-posta *</label>
                        <input required type="email" style={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ahmet@firma.com" />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={lbl}>Şifre * (min. 6 karakter)</label>
                        <input required type="password" style={inp} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={lbl}>Rol *</label>
                        <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="TECHNICIAN">Teknisyen</option>
                            <option value="FRONT_DESK">Resepsiyon</option>
                            <option value="ADMIN">Yönetici</option>
                        </select>
                    </div>

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white',
                        border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
                        fontSize: '1rem', opacity: loading ? 0.7 : 1,
                    }}>
                        {loading ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
                    </button>
                </form>
            </div>
        </div>
    );
}
