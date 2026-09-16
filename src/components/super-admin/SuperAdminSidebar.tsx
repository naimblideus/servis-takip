'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Receipt, Package, Settings, LogOut, Shield, ShoppingCart, Database } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import type { Sozluk } from '@/lib/i18n/sozluk';

// Etiket sözlükten ÇAĞRI ANINDA okunuyor: modül düzeyinde sabitlenseydi ilk
// yüklendiği dilde donar, kullanıcı dili değiştirince menü Türkçe kalırdı.
const menu = (sz: Sozluk) => [
    { href: '/super-admin/dashboard', label: sz.superAdmin.menu.panel, icon: LayoutDashboard },
    { href: '/super-admin/tenants', label: sz.superAdmin.menu.isletmeler, icon: Building2 },
    // Ağın veri ürettiğini gösteren panel — veri katmanının sağlık göstergesi
    { href: '/super-admin/veri-kapsami', label: sz.superAdmin.menu.veriKapsami, icon: Database },
    { href: '/super-admin/billing', label: sz.superAdmin.menu.faturalama, icon: Receipt },
    { href: '/super-admin/plans', label: sz.superAdmin.menu.paketler, icon: Package },
    { href: '/super-admin/pazar', label: sz.superAdmin.menu.pazar, icon: ShoppingCart },
    { href: '/super-admin/settings', label: sz.superAdmin.menu.ayarlar, icon: Settings },
];

export default function SuperAdminSidebar() {
    const pathname = usePathname();
    const sz = useT();
    const navItems = menu(sz);

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
                        <div className="text-sm font-bold">{sz.superAdmin.baslik}</div>
                        <div className="text-xs text-violet-400">{sz.superAdmin.altBaslik}</div>
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
                    ↗ {sz.superAdmin.bayiPaneli}
                </Link>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    {sz.ortak.cikisYap}
                </button>
            </div>
        </aside>
    );
}
