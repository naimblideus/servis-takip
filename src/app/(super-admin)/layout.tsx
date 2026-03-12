import type { Metadata } from 'next';
import '../globals.css';
import SuperAdminSidebar from '@/components/super-admin/SuperAdminSidebar';

export const metadata: Metadata = {
    title: 'Süper Admin — Servis Takip',
    description: 'Platform yönetim paneli',
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="tr">
            <body className="bg-gray-950 text-white">
                <div className="flex h-screen overflow-hidden">
                    <SuperAdminSidebar />
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}
