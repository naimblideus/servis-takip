import type { Metadata } from 'next';
import SuperAdminSidebar from '@/components/super-admin/SuperAdminSidebar';
import { getSuperAdminSession } from '@/lib/super-admin-auth';

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
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    // Menü rolüne göre süzülür (ekip yalnız kendi ekranlarını görür).
    // Oturum yokken (giriş sayfası) menü HİÇ çizilmez: eskiden sahip menüsü
    // çiziliyordu ve giriş ekranı "içerideyim" gibi görünüyordu.
    const oturum = await getSuperAdminSession();
    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-950 text-white">
            {oturum && <SuperAdminSidebar rol={oturum.rol ?? 'SAHIP'} />}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
