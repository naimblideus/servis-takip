import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { prisma } from '@/lib/prisma';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit, istekIp } from '@/lib/audit';
import { sayfaIceAktar, type KiraOzeti } from '@/lib/sayfa-ice-aktar';
import { notEkle } from '@/lib/kurulum-veri';
import { kurulumMetni } from '@/lib/kurulum-metin';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { doldur } from '@/lib/i18n/sozluk';

/**
 * POST /api/super-admin/kurulum/[tenantId]/ice-aktar — "Veriyi biz yükleyelim".
 *
 * Satıştan sonra bayi listesini WhatsApp'tan yollar; Nextus kurulum ekibi
 * (SAHIP ya da EKIP) Kurulum ekranından yükler. Bayi tek satır doldurmaz.
 * Kural bayinin kendi ekranıyla AYNI (lib/sayfa-ice-aktar.ts): biz yükleyince
 * başka, bayi yükleyince başka sonuç çıkamaz.
 *
 * Bilerek bayi paneline girmiyoruz (impersonation): o, bayinin bütün verisini
 * açar. Burada yalnız yükleme var; önizleme yalnız gönderilen dosyayı gösterir.
 *
 * İzin: middleware /api/super-admin/* için oturum ve rol ister; bu uç EKIP'in
 * izinli öneki (/api/super-admin/kurulum) altında, DISTRIBUTOR açamaz.
 * Her gerçek aktarım denetime ve kurulum notlarına yazılır: kim, ne zaman,
 * ne kadar yükledi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ hata: 'OTURUM_YOK' }, { status: 401 });
  const { tenantId } = await params;

  // Demo bayisine yazılmaz: herkesin gezdiği ortak hesap.
  const bayi = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null, demo: false }, select: { id: true } });
  if (!bayi) return ucHatasi('ISLETME_BULUNAMADI', 404);

  const govde = (await req.json().catch(() => null)) as { csv?: unknown; mapping?: unknown; dryRun?: unknown } | null;
  if (!govde || typeof govde !== 'object') return ucHatasi('DOSYA_BOS_GORUNUYOR', 400, { ek: { kod: 'BOS_DOSYA' } });

  const s = await sayfaIceAktar({ tenantId, csv: govde.csv, mapping: govde.mapping, dryRun: govde.dryRun });
  if (!s.ok) return ucHatasi(s.hata, s.durum, { ek: s.ek, deger: s.deger });
  if (govde.dryRun) return NextResponse.json(s.govde);

  const g = s.govde as {
    customersCreated: number; customersUpdated: number; devicesCreated: number; devicesUpdated: number;
    skippedInvalid: number; failed: number; kiraOzeti: KiraOzeti;
  };
  const kim = sa.name || sa.email;
  await writeAudit({
    tenantId,
    action: 'VERI_AKTARILDI',
    entityType: 'IceAktarim',
    entityId: tenantId,
    newValue: {
      musteriYeni: g.customersCreated, musteriGuncel: g.customersUpdated,
      cihazYeni: g.devicesCreated, cihazGuncel: g.devicesUpdated,
      atlanan: g.skippedInvalid, hatali: g.failed, aylikKira: g.kiraOzeti.toplam,
    },
    ipAddress: istekIp(req),
    actorType: 'SUPER_ADMIN',
    actorName: `Nextus kurulum: ${kim}`,
  });

  // Kurulum ekibi notlara bakar, denetim kaydına değil: kimin ne yüklediği orada görünsün.
  const dil = await sunucuDili();
  const m = kurulumMetni(dil);
  const kira = new Intl.NumberFormat(dil === 'en' ? 'en-GB' : 'tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(g.kiraOzeti.toplam);
  await notEkle(tenantId, {
    yazanId: sa.id,
    yazanAd: kim,
    tur: 'NOT',
    metin: doldur(m.aktarimNotu, {
      yeniMusteri: g.customersCreated,
      yeniCihaz: g.devicesCreated,
      guncellenen: g.customersUpdated + g.devicesUpdated,
      kira,
      kiraCihaz: g.kiraOzeti.cihaz,
    }),
  });

  return NextResponse.json(s.govde);
}
