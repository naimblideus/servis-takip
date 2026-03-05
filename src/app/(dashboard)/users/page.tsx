import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import UsersClient from '@/components/UsersClient';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Yönetici', TECHNICIAN: 'Teknisyen', FRONT_DESK: 'Resepsiyon',
};
const ROLE_COLORS: Record<string, string> = {
    ADMIN: '#fee2e2', TECHNICIAN: '#dbeafe', FRONT_DESK: '#d1fae5',
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

            <UsersClient
                users={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
                meId={me.id}
                ticketCounts={countMap as Record<string, number>}
            />
        </div>
    );
}
