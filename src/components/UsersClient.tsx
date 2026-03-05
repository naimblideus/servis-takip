'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Yönetici', TECHNICIAN: 'Teknisyen', FRONT_DESK: 'Resepsiyon',
};
const ROLE_COLORS: Record<string, string> = {
    ADMIN: '#fee2e2', TECHNICIAN: '#dbeafe', FRONT_DESK: '#d1fae5',
};

interface User {
    id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string;
}
interface Props {
    users: User[];
    meId: string;
    ticketCounts: Record<string, number>;
}

export default function UsersClient({ users, meId, ticketCounts }: Props) {
    const router = useRouter();
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '', isActive: true });
    const [saving, setSaving] = useState(false);

    const startEdit = (u: User) => {
        setEditId(u.id);
        setEditForm({ name: u.name, email: u.email, role: u.role, password: '', isActive: u.isActive });
    };

    const saveEdit = async (id: string) => {
        setSaving(true);
        const body: any = { name: editForm.name, email: editForm.email, role: editForm.role, isActive: editForm.isActive };
        if (editForm.password) body.password = editForm.password;
        const res = await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); alert('Hata: ' + d.error); }
        else { setEditId(null); router.refresh(); }
        setSaving(false);
    };

    const deleteUser = async (id: string, name: string) => {
        if (!confirm(`"${name}" pasife alınsın mı? Kullanıcı giriş yapamaz ancak fişleri korunur.`)) return;
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (!res.ok) { const d = await res.json(); alert('Hata: ' + d.error); return; }
        router.refresh();
    };

    const inp = { padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' as const };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        {['Ad Soyad', 'E-posta', 'Rol', 'Durum', 'Şifre', 'Atanan Fiş', 'Kayıt', 'İşlem'].map(h => (
                            <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {users.map((u, i) => {
                        const isMe = u.id === meId;
                        const isEditing = editId === u.id;

                        if (isEditing) {
                            return (
                                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fffbeb' }}>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <input style={inp} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <input style={inp} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <select style={inp} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                            <option value="ADMIN">Yönetici</option>
                                            <option value="TECHNICIAN">Teknisyen</option>
                                            <option value="FRONT_DESK">Resepsiyon</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <select style={inp} value={editForm.isActive ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}>
                                            <option value="true">Aktif</option>
                                            <option value="false">Pasif</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <input style={inp} type="password" placeholder="Yeni şifre (opsiyonel)" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                                    </td>
                                    <td style={{ padding: '0.5rem 1rem' }}>{ticketCounts[u.id] || 0}</td>
                                    <td style={{ padding: '0.5rem 1rem' }}>—</td>
                                    <td style={{ padding: '0.5rem 1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                            <button onClick={() => saveEdit(u.id)} disabled={saving} style={{ padding: '0.3rem 0.625rem', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>✓ Kaydet</button>
                                            <button onClick={() => setEditId(null)} style={{ padding: '0.3rem 0.5rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>İptal</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: !u.isActive ? '#fafafa' : (i % 2 === 0 ? 'white' : '#fafafa') }}>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                            backgroundColor: isMe ? '#2563eb' : (u.isActive ? '#6b7280' : '#d1d5db'),
                                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.875rem', fontWeight: '700',
                                        }}>
                                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.875rem', opacity: u.isActive ? 1 : 0.5 }}>
                                                {u.name} {isMe && <span style={{ color: '#2563eb', fontSize: '0.7rem' }}>(Ben)</span>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: u.isActive ? '#374151' : '#9ca3af' }}>{u.email}</td>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <span style={{ backgroundColor: ROLE_COLORS[u.role] || '#f3f4f6', padding: '0.2rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                                        {ROLE_LABELS[u.role] || u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <span style={{ backgroundColor: u.isActive ? '#d1fae5' : '#fee2e2', color: u.isActive ? '#065f46' : '#b91c1c', padding: '0.2rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                                        {u.isActive ? '● Aktif' : '○ Pasif'}
                                    </span>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#9ca3af' }}>••••••</td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: '600' }}>{ticketCounts[u.id] || 0}</td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{new Date(u.createdAt).toLocaleDateString('tr-TR')}</td>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                                        <button onClick={() => startEdit(u)} style={{ padding: '0.3rem 0.625rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>✏ Düzenle</button>
                                        {!isMe && (
                                            <button onClick={() => deleteUser(u.id, u.name)} style={{ padding: '0.3rem 0.5rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
