'use client';

import { useRouter } from 'next/navigation';

interface Props {
    currentStatus?: string;
    currentPriority?: string;
    currentAssigned?: string;
    users: { id: string; name: string }[];
}

const STATUSES = [
    { value: '', label: 'Tüm Durumlar' },
    { value: 'NEW', label: 'Yeni' },
    { value: 'IN_SERVICE', label: 'Serviste' },
    { value: 'WAITING_FOR_PART', label: 'Parça Bkl.' },
    { value: 'READY', label: 'Hazır' },
    { value: 'DELIVERED', label: 'Teslim' },
    { value: 'CANCELLED', label: 'İptal' },
];

const PRIORITIES = [
    { value: '', label: 'Tüm Öncelikler' },
    { value: 'URGENT', label: '🔴 Acil' },
    { value: 'HIGH', label: '🟠 Yüksek' },
    { value: 'NORMAL', label: '🔵 Normal' },
    { value: 'LOW', label: '⚪ Düşük' },
];

export default function TicketFilters({ currentStatus, currentPriority, currentAssigned, users }: Props) {
    const router = useRouter();

    const update = (key: string, value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`/tickets?${params.toString()}`);
    };

    const clearAll = () => router.push('/tickets');
    const hasFilter = !!(currentStatus || currentPriority || currentAssigned);

    const sel = {
        padding: '0.5rem 0.75rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        backgroundColor: 'white',
        cursor: 'pointer',
        outline: 'none',
        minWidth: '150px',
    };

    return (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={sel} value={currentStatus || ''} onChange={e => update('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <select style={sel} value={currentPriority || ''} onChange={e => update('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            <select style={sel} value={currentAssigned || ''} onChange={e => update('assignedUserId', e.target.value)}>
                <option value="">Tüm Teknisyenler</option>
                <option value="unassigned">— Atanmamış</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            {hasFilter && (
                <button onClick={clearAll} style={{
                    padding: '0.5rem 1rem', backgroundColor: '#fee2e2', color: '#b91c1c',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                }}>
                    ✕ Filtreleri Temizle
                </button>
            )}

            {hasFilter && (
                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                    Filtre aktif
                </span>
            )}
        </div>
    );
}
