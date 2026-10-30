'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Store, Share2, LifeBuoy, Blocks, Plug, ArrowUpRight } from 'lucide-react';
import { ALL_MODULE_KEYS, effectiveModules } from '@/lib/modules';
import { useT, useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { kurulumMetni } from '@/lib/kurulum-metin';
import type { AdimKodu, Renk } from '@/lib/kurulum';

/** /api/super-admin/tenants/[id]/baglantilar cevabı. */
interface Baglantilar {
    magaza: {
        pakette: boolean; kurulu: boolean; aktif: boolean; adresli: boolean;
        url: string | null; domain: string | null; bekleyenSiparis: number;
        talep: { tarih: string; okundu: boolean } | null;
    };
    paylasim: { anonim: boolean; anonimAt: string | null; adli: boolean; adliAt: string | null; duyuru: number };
    kurulum: {
        zorunluTamam: number; zorunluToplam: number; hazir: boolean; sonrakiAdim: AdimKodu | null;
        renk: Renk; bugunAranacak: boolean; sorumluAd: string | null; sonrakiTemas: string | null;
    } | null;
    sorun: { acik: number; durduran: number };
    whatsapp: boolean;
    crm: boolean;
    demo: boolean;
}

type Ton = 'iyi' | 'uyari' | 'hata' | 'notr';
const TON: Record<Ton, string> = {
    iyi: 'bg-emerald-50 text-emerald-700',
    uyari: 'bg-amber-50 text-amber-800',
    hata: 'bg-red-50 text-red-700',
    notr: 'bg-gray-100 text-gray-600',
};
const NOKTA: Record<Ton, string> = { iyi: 'bg-emerald-500', uyari: 'bg-amber-500', hata: 'bg-red-500', notr: 'bg-gray-400' };
const RENK_TONU: Record<Renk, Ton> = { YESIL: 'iyi', SARI: 'uyari', KIRMIZI: 'hata' };

/** Durum rozeti: dört kanal (iyi · uyarı · hata · nötr), 6px nokta + metin. */
function Rozet({ ton, children }: { ton: Ton; children: ReactNode }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${TON[ton]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${NOKTA[ton]}`} />
            {children}
        </span>
    );
}

function Bolme({ ikon: Ikon, baslik, sag, children }: { ikon: typeof Store; baslik: string; sag?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Ikon className="h-4 w-4 text-gray-500" />
                    {baslik}
                </h3>
                {sag}
            </div>
            {children}
        </section>
    );
}

const bagCls = 'inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline underline-offset-4';

/**
 * İŞLETME ÖZETİ — bayi panelindeki yeni özelliklerin bu bayideki hâli tek
 * bakışta: kurulum nerede, mağazası var mı, paylaşımı açık mı, sorun bildirdi
 * mi, hangi modüller açık. Her kutu ilgili ekrana gider; buradan bir şey
 * DEĞİŞTİRİLMEZ (değiştirme yeri Genel ve Abonelik sekmeleri).
 */
export default function OzetSekmesi({ id, tenant, paketAdi, abonelikSekmesi }: {
    id: string;
    tenant: { plan: string; modules?: string[] | null; marketEnabled?: boolean | null };
    paketAdi: string;
    abonelikSekmesi: () => void;
}) {
    const sz = useT();
    const b = useBicim();
    const { dil } = useDil();
    const o = sz.superAdmin.detay.ozet;
    const km = kurulumMetni(dil);
    const [v, setV] = useState<Baglantilar | null>(null);
    const [hata, setHata] = useState(false);

    useEffect(() => {
        fetch(`/api/super-admin/tenants/${id}/baglantilar`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(setV)
            .catch(() => setHata(true));
    }, [id]);

    const acik = effectiveModules(tenant as Parameters<typeof effectiveModules>[0]);
    const moduller = (
        <Bolme ikon={Blocks} baslik={o.moduller}
            sag={<button type="button" onClick={abonelikSekmesi} className={bagCls}>{o.modulDuzenle}</button>}>
            <p className="mb-3 text-xs text-gray-500">
                {paketAdi} · <span className="font-mono tabular-nums">{acik.size}/{ALL_MODULE_KEYS.length}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
                {ALL_MODULE_KEYS.map((k) => (
                    <span key={k} title={sz.modul.aciklama[k]}
                        className={`rounded-md px-2 py-1 text-xs ${acik.has(k)
                            ? 'bg-gray-900 text-white'
                            : 'border border-dashed border-gray-300 text-gray-400 line-through decoration-gray-300'}`}>
                        {sz.modul.ad[k]}
                    </span>
                ))}
            </div>
        </Bolme>
    );

    if (hata) return <div className="space-y-4"><p role="alert" className="text-sm text-red-700">{o.yuklenemedi}</p>{moduller}</div>;
    if (!v) {
        // Yükleme: düzenin kendi ölçülerinde iskelet.
        return (
            <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />)}
            </div>
        );
    }

    const k = v.kurulum;
    const m = v.magaza;
    const yuzde = k ? Math.round((k.zorunluTamam / Math.max(1, k.zorunluToplam)) * 100) : 0;

    const magazaDurumu: [Ton, string] = m.kurulu
        ? m.aktif ? ['iyi', o.magazaYayinda] : m.adresli ? ['uyari', o.magazaKapali] : ['uyari', o.magazaAdressiz]
        : m.pakette ? ['notr', o.magazaKurulmadi] : ['notr', o.magazaPaketDisi];

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                {/* KURULUM VE BAŞARI */}
                <Bolme ikon={ClipboardCheck} baslik={o.kurulum}
                    sag={k ? <Rozet ton={RENK_TONU[k.renk]}>{km.renk[k.renk]}</Rozet> : undefined}>
                    {k ? (
                        <>
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-lg font-semibold text-gray-900">
                                    {k.hazir ? o.kurulumTamam : doldur(o.kurulumAdim, { n: k.zorunluTamam, toplam: k.zorunluToplam })}
                                </span>
                                <span className="font-mono text-sm tabular-nums text-gray-500">{b.yuzde(yuzde)}</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                <div className={`h-full rounded-full ${k.hazir ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${yuzde}%` }} />
                            </div>
                            <ul className="mt-3 space-y-1 text-sm text-gray-700">
                                {k.sonrakiAdim && <li>{doldur(o.siradaki, { adim: km.ad[k.sonrakiAdim] })}</li>}
                                <li className="text-gray-500">{k.sorumluAd ? doldur(o.sorumlu, { ad: k.sorumluAd }) : o.sorumluYok}</li>
                            </ul>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {k.bugunAranacak && <Rozet ton="uyari">{o.bugunAranacak}</Rozet>}
                                <Link href={`/super-admin/kurulum/${id}`} className={bagCls}>
                                    {o.kurulumAc} <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">{o.kurulumDemo}</p>
                    )}
                </Bolme>

                {/* NEXTUS MAĞAZA */}
                <Bolme ikon={Store} baslik={o.magaza} sag={<Rozet ton={magazaDurumu[0]}>{magazaDurumu[1]}</Rozet>}>
                    {m.kurulu && (
                        <p className="font-mono text-sm text-gray-700 break-all">{m.domain ?? m.url}</p>
                    )}
                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {m.bekleyenSiparis > 0 && (
                            <li><Rozet ton="uyari">{doldur(o.magazaSiparis, { n: m.bekleyenSiparis })}</Rozet></li>
                        )}
                        {m.talep && (
                            <li className="flex flex-wrap items-center gap-3">
                                <span>{doldur(o.magazaTalep, { tarih: b.tarih(m.talep.tarih) })}</span>
                                <Link href="/super-admin/talepler?kaynak=magaza" className={bagCls}>{o.magazaTalepAc}</Link>
                            </li>
                        )}
                    </ul>
                    {m.kurulu && m.url && m.adresli && (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className={`${bagCls} mt-3`}>
                            {o.magazaAc} <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                    )}
                </Bolme>

                {/* ÜRETİCİ PAYLAŞIMI */}
                <Bolme ikon={Share2} baslik={o.paylasim}>
                    <dl className="divide-y divide-gray-100 text-sm">
                        {([[o.paylasimAnonim, v.paylasim.anonim, v.paylasim.anonimAt], [o.paylasimAdli, v.paylasim.adli, v.paylasim.adliAt]] as const).map(([ad, acikMi, tarih]) => (
                            <div key={ad} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                                <dt className="text-gray-700">{ad}</dt>
                                <dd className="flex items-center gap-2">
                                    {acikMi && tarih && <span className="text-xs text-gray-500">{b.tarih(tarih)}</span>}
                                    <Rozet ton={acikMi ? 'iyi' : 'notr'}>{acikMi ? o.acik : o.kapali}</Rozet>
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {v.paylasim.duyuru > 0 && (
                        <p className="mt-2 text-sm text-gray-700">{doldur(o.paylasimDuyuru, { n: v.paylasim.duyuru })}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">{o.paylasimNot}</p>
                </Bolme>

                {/* SORUN BİLDİRİMLERİ */}
                <Bolme ikon={LifeBuoy} baslik={o.sorunlar}
                    sag={<Rozet ton={v.sorun.durduran > 0 ? 'hata' : v.sorun.acik > 0 ? 'uyari' : 'iyi'}>
                        <span className="font-mono tabular-nums">{v.sorun.acik}</span>
                    </Rozet>}>
                    <p className="text-sm text-gray-700">
                        {v.sorun.acik > 0 ? doldur(o.sorunAcik, { n: v.sorun.acik }) : o.sorunYok}
                    </p>
                    {v.sorun.durduran > 0 && (
                        <p className="mt-1 text-sm font-semibold text-red-700">{doldur(o.sorunDurduran, { n: v.sorun.durduran })}</p>
                    )}
                    <Link href={`/super-admin/sorunlar?bayi=${id}`} className={`${bagCls} mt-3`}>
                        {o.sorunAc} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </Bolme>
            </div>

            {moduller}

            {/* BAĞLANTILAR — dışarıyla konuşan kanallar */}
            <Bolme ikon={Plug} baslik={o.baglantilar}>
                <dl className="divide-y divide-gray-100 text-sm">
                    <div className="flex items-center justify-between gap-2 py-2 first:pt-0">
                        <dt className="text-gray-700">{o.whatsapp}</dt>
                        <dd><Rozet ton={v.whatsapp ? 'iyi' : 'notr'}>{v.whatsapp ? o.bagli : o.bagliDegil}</Rozet></dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-2">
                        <dt className="text-gray-700">{o.crm}</dt>
                        <dd><Rozet ton={v.crm ? 'iyi' : 'uyari'}>{v.crm ? o.bagli : o.bagliDegil}</Rozet></dd>
                    </div>
                </dl>
                <p className="mt-2 text-xs text-gray-500">{o.crmNot}</p>
            </Bolme>
        </div>
    );
}
