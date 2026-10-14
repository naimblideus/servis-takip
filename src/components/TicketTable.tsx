'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';

// Etiketler sözlükte (durum.fisKisa / durum.oncelik); burada yalnız renk.
const statusRenk: Record<string, { color: string; text: string }> = {
    NEW: { color: '#fef3c7', text: '#92400e' },
    IN_SERVICE: { color: '#dbeafe', text: '#1e40af' },
    WAITING_FOR_PART: { color: '#fce7f3', text: '#9d174d' },
    READY: { color: '#d1fae5', text: '#065f46' },
    DELIVERED: { color: '#f0fdf4', text: '#166534' },
    CANCELLED: { color: '#f3f4f6', text: '#374151' },
};

const priorityRenk: Record<string, string> = {
    LOW: '#6b7280',
    NORMAL: '#3b82f6',
    HIGH: '#f59e0b',
    URGENT: '#ef4444',
};

interface Ticket {
    id: string;
    ticketNumber: string;
    issueText: string | null;
    status: string;
    priority: string;
    createdAt: Date;
    device: {
        brand: string; model: string; isRental: boolean;
        counterBlack?: number | null; counterColor?: number | null;
        customer: { name: string }
    };
    assignedUser: { name: string } | null;
}

type SortKey = 'ticketNumber' | 'customer' | 'status' | 'createdAt';

// İLK 50 FİŞ ÇİZİLİR, gerisi düğmeyle 50'şer gelir. Ölçüldü — telefonda
// 326 fişin hepsi çizilince sayfa ~42.000 px oluyordu; bayi listenin sonuna
// hiç inmiyor, en yenilere bakıyor. Sıralama BÜTÜN liste üzerinde yapılır,
// kesme ondan sonra: "en yeni 50" gerçekten en yeni 50'dir.
const SAYFA = 50;

const kartStili: React.CSSProperties = { backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

export default function TicketTable({ tickets, onDelete, filtreliMi = false }: { tickets: Ticket[]; onDelete?: (id: string, num: string) => void; filtreliMi?: boolean }) {
    const router = useRouter();
    // `sz`: satır döngüsü fişi `t` adıyla taşıyor, gölgelenmesin.
    const sz = useT();
    const b = useBicim();
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [gorunen, setGorunen] = useState(SAYFA);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'createdAt' ? 'desc' : 'asc');
        }
    };

    const sorted = useMemo(() => {
        return [...tickets].sort((a, b) => {
            let va: string | number, vb: string | number;
            if (sortKey === 'ticketNumber') { va = a.ticketNumber; vb = b.ticketNumber; }
            else if (sortKey === 'customer') { va = a.device.customer.name.toLowerCase(); vb = b.device.customer.name.toLowerCase(); }
            else if (sortKey === 'status') { va = a.status; vb = b.status; }
            else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [tickets, sortKey, sortDir]);

    const thStyle = (key?: SortKey): React.CSSProperties => ({
        padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600',
        color: key && sortKey === key ? '#2563eb' : '#374151',
        cursor: key ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    });

    const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    // Durum/öncelik etiketi ve rengi: tablo da telefon kartı da AYNI yerden.
    const durumu = (t: Ticket) => ({ label: (sz.durum.fisKisa as Record<string, string>)[t.status] ?? t.status, ...(statusRenk[t.status] ?? { color: '#f3f4f6', text: '#374151' }) });
    const onceligi = (t: Ticket) => ({ label: (sz.durum.oncelik as Record<string, string>)[t.priority] ?? t.priority, color: priorityRenk[t.priority] ?? '#6b7280' });
    const durumCipi = (st: { color: string; text: string }): React.CSSProperties => ({ backgroundColor: st.color, color: st.text, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' });

    // BOŞ LİSTE TABLOSUZ çizilir. Mesaj 44rem'lik tablonun ortasına
    // hizalanınca telefonda sağdan kesiliyordu ("Bu filtreye uyan fiş yok"
    // yarım okunuyordu); düz kutuda her genişlikte ortada durur.
    if (tickets.length === 0) {
        return (
            <div style={{ ...kartStili, padding: '2.5rem 1.5rem', textAlign: 'center', color: '#6b7280' }}>
                {/* Filtre sonucu boş olmakla HİÇ fiş olmaması aynı şey değil.
                    Yeni bayiye "bulunamadı" demek hata gibi okunur. */}
                {filtreliMi ? (
                    <>
                        <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>🔍</div>
                        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.15rem' }}>{sz.fisler.tablo.filtreBos}</div>
                        <div style={{ fontSize: '0.85rem' }}>{sz.fisler.tablo.filtreBosAlt}</div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>🧾</div>
                        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.15rem' }}>{sz.fisler.tablo.yok}</div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.9rem' }}>{sz.fisler.tablo.yokAlt}</div>
                        <a href="/tickets/new" style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minHeight: '2.5rem', padding: '0 1rem', backgroundColor: '#1e3a5f', color: 'white',
                            borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem',
                        }}>{sz.fisler.tablo.ilkFis}</a>
                    </>
                )}
            </div>
        );
    }

    const satirlar = sorted.slice(0, gorunen);
    const kalan = sorted.length - satirlar.length;

    return (
        <>
        {/* ── TELEFON: kart listesi ── 44rem'lik tabloda telefonda yalnız "Fiş No"
            ile "Müşteri / Cihaz" görünüyor, durum ve tarih için yana kaydırmak
            gerekiyordu. Kartta bayinin baktığı üç şey üç satırda: hangi fiş ve
            ne durumda · kimin hangi makinesi · ne arızası, ne zaman. Kartın
            tamamı fişe gider (satırdaki gibi). Yazdır/sil fiş detayında var;
            telefonda listede sil düğmesi, kaydırırken yanlış basılacak hedef olur. */}
        <div className="md:hidden" style={{ ...kartStili, overflow: 'hidden' }}>
            {satirlar.map((t, i) => {
                const st = durumu(t);
                const pr = onceligi(t);
                return (
                    <Link
                        key={t.id}
                        href={`/tickets/${t.id}`}
                        className="active:bg-blue-50"
                        style={{ display: 'block', padding: '0.75rem 0.9rem', borderTop: i === 0 ? 'none' : '1px solid #e5e7eb', textDecoration: 'none', color: 'inherit' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '0.85rem', color: '#2563eb', whiteSpace: 'nowrap' }}>{t.ticketNumber}</span>
                                {/* Öncelik yalnız sıradan değilse: "Acil" kartta görünmeli, "Normal" gürültü. */}
                                {(t.priority === 'URGENT' || t.priority === 'HIGH') && (
                                    <span style={{ color: pr.color, fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap' }}>{pr.label}</span>
                                )}
                            </span>
                            <span style={{ ...durumCipi(st), flexShrink: 0, whiteSpace: 'nowrap' }}>{st.label}</span>
                        </div>
                        <div style={{ marginTop: '0.3rem', fontSize: '0.875rem', fontWeight: '500', color: '#111827', overflowWrap: 'anywhere' }}>
                            {t.device.customer.name}
                            {t.device.isRental && (
                                <span style={{ marginLeft: '0.375rem', backgroundColor: '#ede9fe', color: '#6d28d9', fontSize: '0.65rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '9999px', verticalAlign: 'middle' }}>{sz.fisler.tablo.kiralik}</span>
                            )}
                            <span style={{ color: '#6b7280', fontWeight: '400' }}> · {t.device.brand} {t.device.model}</span>
                        </div>
                        <div style={{ marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.78rem', color: '#6b7280' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText || '—'}</span>
                            <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{b.tarih(t.createdAt)}</span>
                        </div>
                    </Link>
                );
            })}
        </div>

        {/* ── MASAÜSTÜ: tablo ── (md ve üstü) */}
        <div className="hidden md:block" style={{ ...kartStili, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '44rem', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={thStyle('ticketNumber')} onClick={() => toggleSort('ticketNumber')}>{sz.fisler.tablo.fisNo}{arrow('ticketNumber')}</th>
                        <th style={thStyle('customer')} onClick={() => toggleSort('customer')}>{sz.fisler.tablo.musteriCihaz}{arrow('customer')}</th>
                        <th style={thStyle()}>{sz.fisler.tablo.ariza}</th>
                        <th style={thStyle('status')} onClick={() => toggleSort('status')}>{sz.genel.durum}{arrow('status')}</th>
                        <th style={thStyle()}>{sz.fisler.tablo.oncelik}</th>
                        <th style={thStyle()}>{sz.fisler.tablo.teknisyen}</th>
                        <th style={thStyle('createdAt')} onClick={() => toggleSort('createdAt')}>{sz.genel.tarih}{arrow('createdAt')}</th>
                        <th style={thStyle()}></th>
                    </tr>
                </thead>
                <tbody>
                    {satirlar.map((t, i) => {
                        const st = durumu(t);
                        const pr = onceligi(t);
                        const hasCounter = t.device.counterBlack != null || t.device.counterColor != null;
                        return (
                            <tr
                                key={t.id}
                                onClick={() => router.push(`/tickets/${t.id}`)}
                                style={{
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'white' : '#f9fafb')}
                            >
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: '600' }}>
                                    <span style={{ color: '#2563eb' }}>{t.ticketNumber}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t.device.customer.name}</span>
                                        {t.device.isRental && (
                                            <span style={{ backgroundColor: '#ede9fe', color: '#6d28d9', fontSize: '0.65rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>{sz.fisler.tablo.kiralik}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {t.device.brand} {t.device.model}
                                        {/* Bu sayı CİHAZIN BUGÜNKÜ sayacı — fişin kesildiği andaki
                                            sayaç DEĞİL. Fiş detayı fişe bağlı okumayı gösteriyor;
                                            etiketsizken aynı fiş iki ekranda farklı sayı gösteriyor
                                            ve bayi hangisinin doğru olduğunu bilemiyordu.
                                            Listede fiş başına gerçek okumayı çekmek 698 fişte N+1
                                            sorgu demek; sayının NE OLDUĞUNU söylemek doğru çözüm. */}
                                        {hasCounter && (
                                            <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}
                                                title={sz.fisler.tablo.suAnIpucu}>
                                                {sz.fisler.tablo.suAn}{' '}
                                                {t.device.counterBlack != null && `⚫${b.sayi(t.device.counterBlack)}`}
                                                {t.device.counterBlack != null && t.device.counterColor != null && ' '}
                                                {t.device.counterColor != null && `🟣${b.sayi(t.device.counterColor)}`}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={durumCipi(st)}>{st.label}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{ color: pr.color, fontSize: '0.8rem', fontWeight: '600' }}>{pr.label}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.assignedUser?.name ?? '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{b.tarih(t.createdAt)}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    {/* DOKUNMA HEDEFİ: ölçüldü — yazdır 20×19 px, sil 17×25 px idi.
                                        Telefonda parmak ucu ~45 px'lik alana basar; 19 px'lik hedefte
                                        yanlış düğmeye basmak kural olur ve bunlardan biri FİŞİ SİLİYOR.
                                        36×36'ya çıkarıldı, aralık açıldı. */}
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <Link
                                            href={`/tickets/${t.id}/print`}
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', color: '#6b7280', fontSize: '1rem', textDecoration: 'none' }}
                                            target="_blank" title={sz.genel.yazdir} aria-label={sz.fisler.tablo.yazdirEtiket}
                                        >🖨️</Link>
                                        {onDelete && (
                                            <button
                                                onClick={() => onDelete(t.id, t.ticketNumber)}
                                                title={sz.fisler.tablo.cope}
                                                aria-label={sz.fisler.tablo.copeEtiket}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', lineHeight: 1 }}
                                            >🗑️</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {/* Daha fazla: kalan fişlerden 50'si daha. Sayaç "kaçını görüyorum"
            sorusunu cevaplar; liste kesik görünmesin. */}
        {kalan > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.875rem' }}>
                <button
                    type="button"
                    onClick={() => setGorunen(n => n + SAYFA)}
                    style={{
                        minHeight: '2.75rem', padding: '0 1.25rem', backgroundColor: 'white', color: '#1e3a5f',
                        border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: '600',
                    }}
                >+{b.sayi(Math.min(SAYFA, kalan))} {sz.genel.dahaFazla}</button>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{b.sayi(satirlar.length)} / {b.sayi(sorted.length)}</span>
            </div>
        )}
        </>
    );
}
