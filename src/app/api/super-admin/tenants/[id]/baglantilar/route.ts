import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { bayiMagazasi, magazaSiparisSayisi } from '@/lib/magaza-baglanti';
import { kurulumSatiri } from '@/lib/kurulum-veri';
import { bayininDuyurulari } from '@/lib/distributor-veri';
import { hasModule } from '@/lib/modules';

const GUN = 86_400_000;

/**
 * BAYİNİN BAĞLANTILARI — işletme detayının "Özet" sekmesi.
 *
 * Bayi panelinde sonradan doğan özellikler (Mağaza, Kurulum ve Başarı, Sorun
 * bildir, üretici paylaşımı, marka duyuruları, CRM sinyali) süper admin'de
 * ayrı ayrı ekranlardaydı; tek bir bayiye bakarken hiçbiri görünmüyordu.
 * "Bu bayinin mağazası var mı, paylaşımı açık mı, kurulumu nerede" sorusu beş
 * ekran gezerek cevaplanıyordu. Burada hepsi tek istekte, yalnız OKUNUR.
 *
 * Her parça kendi başına düşebilir: mağaza şeması olmayan ortamda mağaza
 * null, demo bayide kurulum null döner — biri patlarsa diğerleri yine gelir.
 *
 * Yetki middleware'de: /api/super-admin/tenants yalnız SAHIP'e açık.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const t = await prisma.tenant.findFirst({
        where: { id, deletedAt: null },
        select: {
            name: true, plan: true, modules: true, marketEnabled: true, demo: true,
            oemDataSharing: true, oemDataSharingAt: true, markaAdIzni: true, markaAdIzniAt: true,
            whatsappPhoneId: true,
        },
    });
    if (!t) return ucHatasi('BULUNAMADI', 404);

    const simdi = new Date();
    const [magaza, siparis, kurulum, sorun, duyurular, magazaTalebi] = await Promise.all([
        bayiMagazasi(id),
        magazaSiparisSayisi(id),
        kurulumSatiri(id, simdi).catch(() => null),
        prisma.sorunBildirimi.groupBy({
            by: ['tur'],
            where: { tenantId: id, durum: { in: ['YENI', 'INCELENIYOR'] } },
            _count: { _all: true },
        }),
        bayininDuyurulari(id, simdi).catch(() => []),
        // Paketinde Mağaza olmayan bayinin "Mağazamı kurun" basışı talep olarak
        // düşer (api/magaza/kurulum → PAKET_DISI). Talep firma adıyla yazılıyor.
        prisma.lead.findFirst({
            where: { kaynak: 'magaza', firma: t.name, createdAt: { gte: new Date(simdi.getTime() - 90 * GUN) } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, okundu: true },
        }),
    ]);

    const acikSorun = sorun.reduce((n, s) => n + s._count._all, 0);
    const durduran = sorun.find((s) => s.tur === 'DURDURUYOR')?._count._all ?? 0;

    return NextResponse.json({
        magaza: {
            pakette: hasModule(t, 'SHOP'),
            kurulu: !!magaza,
            aktif: magaza?.aktif ?? false,
            adresli: magaza?.adresli ?? false,
            url: magaza?.url ?? null,
            domain: magaza?.domain ?? null,
            bekleyenSiparis: siparis,
            talep: magazaTalebi ? { tarih: magazaTalebi.createdAt, okundu: magazaTalebi.okundu } : null,
        },
        paylasim: {
            anonim: t.oemDataSharing,
            anonimAt: t.oemDataSharingAt,
            adli: t.markaAdIzni,
            adliAt: t.markaAdIzniAt,
            duyuru: duyurular.length,
        },
        kurulum: kurulum
            ? {
                zorunluTamam: kurulum.kurulum.zorunluTamam,
                zorunluToplam: kurulum.kurulum.zorunluToplam,
                hazir: kurulum.kurulum.hazir,
                sonrakiAdim: kurulum.kurulum.sonrakiAdim?.kod ?? null,
                renk: kurulum.saglik.renk,
                bugunAranacak: kurulum.bugunAranacak,
                sorumluAd: kurulum.sorumluAd,
                sonrakiTemas: kurulum.sonrakiTemas,
            }
            : null,
        sorun: { acik: acikSorun, durduran },
        whatsapp: !!t.whatsappPhoneId,
        // CRM'e sinyal gönderimi cron'da; adres tanımlı değilse hiçbir sinyal gitmez.
        crm: !!process.env.NEXUS_CRM_OLAY,
        demo: t.demo,
    });
}
