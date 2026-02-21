import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Yönetici',
    TECHNICIAN: 'Teknisyen',
    FRONT_DESK: 'Resepsiyon',
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN: '#fee2e2',
    TECHNICIAN: '#dbeafe',
    FRONT_DESK: '#d1fae5',
};

export default async function UsersPage() {
    const session = await auth();
    if (!session) redirect('/login');

    const me = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!me || me.role !== 'ADMIN') redirect('/dashboard');

    const users = await prisma.user.findMany({
        where: { tenantId: me.tenantId },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const ticketCounts = await prisma.serviceTicket.groupBy({
        by: ['assignedUserId'],
        where: { tenantId: me.tenantId },
        _count: true,
    });
    const countMap = Object.fromEntries(ticketCounts.map(tc => [tc.assignedUserId, tc._count]));

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Kullanıcı Yönetimi</h1>
                    <p style={{ color: '#6b7280' }}>Toplam {users.length} kullanıcı</p>
                </div>
                <Link href="/users/new" style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' }}>+ Yeni Kullanıcı</Link>
            </div>

            {/* Rol Özeti */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {Object.entries(ROLE_LABELS).map(([role, label]) => {
                    const count = users.filter(u => u.role === role).length;
                    return (
                        <div key={role} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{count}</div>
                            </div>
                            <div style={{ backgroundColor: ROLE_COLORS[role], borderRadius: '0.5rem', padding: '0.5rem 0.875rem', fontSize: '0.8rem', fontWeight: '600' }}>
                                {role}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Kullanıcı Tablosu */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            {['Ad Soyad', 'E-posta', 'Rol', 'Durum', 'Atanan Fiş', 'Kayıt'].map(h => (
                                <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u, i) => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            backgroundColor: u.id === me.id ? '#2563eb' : '#6b7280',
                                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.875rem', fontWeight: '700', flexShrink: 0,
                                        }}>
                                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                                                {u.name} {u.id === me.id && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>(Ben)</span>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{u.email}</td>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <span style={{
                                        backgroundColor: ROLE_COLORS[u.role] || '#f3f4f6',
                                        padding: '0.2rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600',
                                    }}>
                                        {ROLE_LABELS[u.role] || u.role}
                                    </span>
                                </td>
                                <td style={{ padding: '0.875rem 1rem' }}>
                                    <span style={{
                                        backgroundColor: u.isActive ? '#d1fae5' : '#fee2e2',
                                        color: u.isActive ? '#065f46' : '#b91c1c',
                                        padding: '0.2rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600',
                                    }}>
                                        {u.isActive ? '● Aktif' : '○ Pasif'}
                                    </span>
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                                    {countMap[u.id] || 0}
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                    {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
