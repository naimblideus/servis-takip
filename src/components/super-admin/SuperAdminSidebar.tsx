'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Receipt, Package, Settings, LogOut, Shield } from 'lucide-react';

const navItems = [
    { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/super-admin/tenants', label: 'İşletmeler', icon: Building2 },
    { href: '/super-admin/billing', label: 'Faturalama', icon: Receipt },
    { href: '/super-admin/plans', label: 'Paketler', icon: Package },
    { href: '/super-admin/settings', label: 'Platform Ayarları', icon: Settings },
];

export default function SuperAdminSidebar() {
    const pathname = usePathname();

    const handleLogout = async () => {
        await fetch('/api/super-admin/login', { method: 'DELETE' });
        window.location.href = '/super-admin/login';
    };

    return (
        <aside className="w-64 bg-gray-900 border-r border-white/10 flex flex-col flex-shrink-0 h-full">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-bold">Süper Admin</div>
                        <div className="text-xs text-violet-400">Platform Yönetimi</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-white/10">
                <Link href="/" target="_blank"
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all mb-1">
                    ↗ Tenant Paneli
                </Link>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                </button>
            </div>
        </aside>
    );
}
