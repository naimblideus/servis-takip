'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

interface Props {
    currentStatus?: string;
    currentPriority?: string;
    currentAssigned?: string;
    currentDateFrom?: string;
    currentDateTo?: string;
    currentCustomer?: string;
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

export default function TicketFilters({ currentStatus, currentPriority, currentAssigned, currentDateFrom, currentDateTo, currentCustomer, users }: Props) {
    const router = useRouter();

    // Local state for text inputs (debounced)
    const [customerInput, setCustomerInput] = useState(currentCustomer || '');
    const [dateFrom, setDateFrom] = useState(currentDateFrom || '');
    const [dateTo, setDateTo] = useState(currentDateTo || '');

    const updateParam = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`/tickets?${params.toString()}`);
    }, [router]);

    // Müşteri aramasını sadece Enter veya Ara butonu ile tetikle (otomatik debounce kaldırıldı)
    const searchCustomer = useCallback(() => {
        const current = new URLSearchParams(window.location.search).get('customer') || '';
        if (customerInput.trim() !== current) {
            updateParam('customer', customerInput.trim());
        }
    }, [customerInput, updateParam]);

    // Tarih değişince hemen uygula
    const applyDate = (key: 'dateFrom' | 'dateTo', value: string) => {
        if (key === 'dateFrom') setDateFrom(value);
        else setDateTo(value);
        updateParam(key, value);
    };

    const clearAll = () => {
        setCustomerInput('');
        setDateFrom('');
        setDateTo('');
        router.push('/tickets');
    };

    const hasFilter = !!(currentStatus || currentPriority || currentAssigned || currentDateFrom || currentDateTo || currentCustomer);

    const sel: React.CSSProperties = {
        padding: '0.5rem 0.75rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        backgroundColor: 'white',
        cursor: 'pointer',
        outline: 'none',
        minWidth: '150px',
    };

    const dateInp: React.CSSProperties = {
        padding: '0.5rem 0.75rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        fontSize: '0.8rem',
        backgroundColor: 'white',
        outline: 'none',
        width: '145px',
    };

    const searchInp: React.CSSProperties = {
        padding: '0.5rem 0.75rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        backgroundColor: 'white',
        outline: 'none',
        minWidth: '200px',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* Satır 1: Durum, Öncelik, Teknisyen */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select style={sel} value={currentStatus || ''} onChange={e => updateParam('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <select style={sel} value={currentPriority || ''} onChange={e => updateParam('priority', e.target.value)}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>

                <select style={sel} value={currentAssigned || ''} onChange={e => updateParam('assignedUserId', e.target.value)}>
                    <option value="">Tüm Teknisyenler</option>
                    <option value="unassigned">— Atanmamış</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>

            {/* Satır 2: Tarih Aralığı + Müşteri Arama */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '500' }}>📅 Tarih:</span>
                    <input
                        type="date"
                        style={dateInp}
                        value={dateFrom}
                        onChange={e => applyDate('dateFrom', e.target.value)}
                        title="Başlangıç tarihi"
                    />
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>—</span>
                    <input
                        type="date"
                        style={dateInp}
                        value={dateTo}
                        onChange={e => applyDate('dateTo', e.target.value)}
                        title="Bitiş tarihi"
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '500' }}>👤 Müşteri:</span>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            style={{ ...searchInp, paddingRight: customerInput ? '2rem' : '0.75rem' }}
                            placeholder="Müşteri adı ara..."
                            value={customerInput}
                            onChange={e => setCustomerInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') searchCustomer();
                            }}
                        />
                        {customerInput && (
                            <button
                                onClick={() => { setCustomerInput(''); updateParam('customer', ''); }}
                                style={{
                                    position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem', padding: 0,
                                }}
                            >✕</button>
                        )}
                    </div>
                    <button
                        onClick={searchCustomer}
                        style={{
                            padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', color: 'white',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
                        }}
                    >🔍 Ara</button>
                </div>

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
        </div>
    );
}
