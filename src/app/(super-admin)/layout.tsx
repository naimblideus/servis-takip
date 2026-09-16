import type { Metadata } from 'next';
import SuperAdminSidebar from '@/components/super-admin/SuperAdminSidebar';

export const metadata: Metadata = {
    title: 'Nextus Servis — Super Admin',
};

/**
 * Süper admin kabuğu.
 *
 * BURADA <html> VE <body> YOK — ve bu bir düzeltme. Bu dosya eskiden kendi
 * <html lang="tr"><body> çiftini açıyordu; kök yerleşim (src/app/layout.tsx)
 * zaten bir tane açtığı için tarayıcıya İÇ İÇE iki html/body gidiyordu.
 * Tarayıcı ikinci etiketi atar ve yalnız yeni öznitelikleri devralır: dış
 * html'de lang zaten dolu olduğu için buradaki lang="tr" SESSİZCE yok
 * sayılıyordu. Yani dil seçimi bu ekranlarda hiç işlemiyordu ve görünür bir
 * hata da vermiyordu. Koyu zemin artık gövdeye değil bu sarmalayıcıya veriliyor.
 *
 * globals.css de buradan çekilmiyor: kök yerleşim zaten içeri alıyor.
 *
 * Başlık çevrilmiyor: <head> istemci dilini bilmiyor ve "Super Admin" iki
 * dilde de aynı okunur.
 */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-950 text-white">
            <SuperAdminSidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
