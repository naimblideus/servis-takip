'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Receipt, Settings, LogOut, ShoppingCart, Database, PhoneCall, MessageCircle, ClipboardCheck, LifeBuoy, Users, UserCog, Factory, Menu, X, Inbox, ShieldCheck, History, type LucideIcon } from 'lucide-react';
import { rolErisebilir, type SaRol } from '@/lib/super-admin-rol';
import { useT, useDil } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import { aktivasyonMetni } from '@/lib/aktivasyon-metin';
import Monogram from '@/components/Monogram';
import DilSecici from '@/components/DilSecici';

type Bolum = keyof Sozluk['superAdmin']['menuBolum'];
type Oge = { href: string; label: string; icon: LucideIcon };

// Etiket sözlükten ÇAĞRI ANINDA okunuyor: modül düzeyinde sabitlenseydi ilk
// yüklendiği dilde donar, kullanıcı dili değiştirince menü Türkçe kalırdı.
//
// Bölümler bayi panelindeki gibi işe göre: sabah açılınca bakılanlar üstte,
// platform ayarları altta. Eskiden düz bir listeydi; "Paketler" olmayan bir
// sayfaya gidiyordu, Talepler/Denetim/Geri Yükle ise menüde hiç yoktu.
const menu = (sz: Sozluk, dil: string): { bolum: Bolum; ogeler: Oge[] }[] => {
    const m = sz.superAdmin.menu;
    return [
        {
            bolum: 'gunluk', ogeler: [
                { href: '/super-admin/dashboard', label: m.panel, icon: LayoutDashboard },
                // Deneme hesaplarından bugün aranacaklar (etiketi kendi metin dosyasından).
                { href: '/super-admin/aktivasyon', label: aktivasyonMetni(dil).menu, icon: PhoneCall },
                // Kurulum ve Başarı: her bayinin kurulumu nerede, kimi bugün aramalı.
                { href: '/super-admin/kurulum', label: m.kurulum, icon: ClipboardCheck },
                // Üründeki "Sorun bildir" ile gelenler.
                { href: '/super-admin/sorunlar', label: m.sorunlar, icon: LifeBuoy },
                // Landing formu, kayıt ve "Mağazamı kurun" talepleri.
                { href: '/super-admin/talepler', label: m.talepler, icon: Inbox },
            ],
        },
        {
            bolum: 'bayiler', ogeler: [
                { href: '/super-admin/tenants', label: m.isletmeler, icon: Building2 },
                // Ağın veri ürettiğini gösteren panel — veri katmanının sağlık göstergesi
                { href: '/super-admin/veri-kapsami', label: m.veriKapsami, icon: Database },
                { href: '/super-admin/pazar', label: m.pazar, icon: ShoppingCart },
                // Distribütör paneli (ör. Pantum Türkiye): marka verisi, talep tahmini, duyuru.
                { href: '/super-admin/distributor', label: m.distributor, icon: Factory },
            ],
        },
        {
            bolum: 'para', ogeler: [
                { href: '/super-admin/billing', label: m.faturalama, icon: Receipt },
            ],
        },
        {
            bolum: 'platform', ogeler: [
                // Platform WhatsApp numarasının Meta kurulumu: ne eksik, sıradaki adım.
                { href: '/super-admin/whatsapp', label: sz.superAdmin.whatsapp.menu, icon: MessageCircle },
                { href: '/super-admin/settings', label: m.ayarlar, icon: Settings },
                { href: '/super-admin/audit', label: m.denetim, icon: ShieldCheck },
                { href: '/super-admin/geri-yukle', label: m.geriYukle, icon: History },
                // Ekip hesapları yalnız sahipte.
                { href: '/super-admin/ekip', label: m.ekip, icon: Users },
            ],
        },
        {
            bolum: 'hesap', ogeler: [
                { href: '/super-admin/hesabim', label: m.hesabim, icon: UserCog },
            ],
        },
    ];
};

export default function SuperAdminSidebar({ rol = 'SAHIP', eposta }: { rol?: SaRol; eposta?: string }) {
    const pathname = usePathname();
    const sz = useT();
    const { dil } = useDil();
    // Ekip ve distribütör yalnız kendi ekranlarını görür; kural tek yerde (lib/super-admin-rol).
    const bolumler = menu(sz, dil)
        .map((b) => ({ ...b, ogeler: b.ogeler.filter(({ href }) => rolErisebilir(rol, href)) }))
        .filter((b) => b.ogeler.length > 0);
    // İki bölüm kalan rolde (ekip, distribütör) başlık gürültü olur.
    const basliklar = bolumler.length > 2;

    // Telefonda menü çekmece: kapalıyken sayfa tam genişlik, sayfa değişince kapanır.
    const [acik, setAcik] = useState(false);
    useEffect(() => { setAcik(false); }, [pathname]);

    const handleLogout = async () => {
        await fetch('/api/super-admin/login', { method: 'DELETE' });
        window.location.href = '/super-admin/login';
    };

    return (
        <>
        <div className="md:hidden flex items-center gap-3 px-4 h-14 bg-gray-900 text-white flex-shrink-0">
            <button type="button" onClick={() => setAcik(true)} aria-label={sz.menu.menuAc}
                className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl text-gray-300 hover:bg-white/5">
                <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold">{sz.superAdmin.baslik}</span>
        </div>
        {acik && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setAcik(false)} />}
        <aside className={`w-64 bg-gray-900 text-white flex flex-col flex-shrink-0 h-full fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0 ${acik ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* Wordmark — bayi panelinin kenar çubuğuyla aynı yerde, aynı ölçüde */}
            <div className="px-5 py-5 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <Monogram size={32} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">Nextus Servis</div>
                        <div className="text-xs text-gray-400 truncate">{sz.superAdmin.baslik}</div>
                    </div>
                    <button type="button" onClick={() => setAcik(false)} aria-label={sz.genel.kapat}
                        className="md:hidden w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-gray-400 hover:bg-white/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <nav className="kaydirma-koyu flex-1 px-3 py-4 overflow-y-auto">
                {bolumler.map((b, i) => (
                    <div key={b.bolum} className={i > 0 ? 'mt-4' : ''}>
                        {basliklar && (
                            <p className="px-3 mb-1.5 text-[0.65rem] font-bold tracking-[0.08em] text-gray-500">
                                {sz.superAdmin.menuBolum[b.bolum]}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {b.ogeler.map(({ href, label, icon: Icon }) => {
                                const aktif = pathname === href || pathname.startsWith(href + '/');
                                return (
                                    <Link key={href} href={href} className={`sidebar-link ${aktif ? 'active' : ''}`}>
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        {label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="px-3 py-4 border-t border-gray-700 space-y-2">
                {eposta && (
                    <p className="px-3 text-xs text-gray-400 truncate" title={eposta}>
                        {doldur(sz.superAdmin.oturum, { eposta })}
                    </p>
                )}
                <div className="px-3 flex items-center justify-between gap-2">
                    <DilSecici />
                    <Link href="/" target="_blank" className="text-xs text-gray-400 hover:text-white">
                        {sz.superAdmin.bayiPaneli} ↗
                    </Link>
                </div>
                <button type="button" onClick={handleLogout} className="sidebar-link w-full text-left">
                    <LogOut className="w-4 h-4" />
                    {sz.ortak.cikisYap}
                </button>
            </div>
        </aside>
        </>
    );
}
