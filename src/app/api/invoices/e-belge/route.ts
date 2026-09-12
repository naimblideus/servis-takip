import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import {
  eBelgeUret, belgeEksikleri, belgeSenaryosu, gibNumarasiUret, saticiEksikleri,
  type BelgeSaticisi,
} from '@/lib/fatura-belgesi';

/**
 * GET /api/invoices/e-belge            → bütün faturaların hazırlık durumu
 * GET /api/invoices/e-belge?id=<id>    → tek faturanın belgesi (önizleme)
 *
 * ── NİÇİN YALNIZ OKUMA ───────────────────────────────────────────────────
 * Burada belge ÜRETİLİYOR ama numara YAKILMIYOR. GİB belge sırasında boşluk
 * olamaz; numarayı gerçekten göndermeden atarsak, gönderilmeyen her belge
 * sırada bir delik bırakır. O yüzden numara ancak gönderim anında ve
 * gönderimle aynı işlemde atanacak. Önizleme "bu belge hangi numarayı
 * alacak" diye gösteriyor, sayacı ARTIRMADAN.
 *
 * ── NİÇİN ŞİMDİ ──────────────────────────────────────────────────────────
 * Entegratör seçimi ticari bir karar ve henüz yapılmadı. Ama bayinin
 * verisinin hazır olup olmadığı o karardan BAĞIMSIZ ve şimdi ölçülebilir:
 * hangi entegratör seçilirse seçilsin aynı alanlar isteniyor. Bayi bugün
 * eksiklerini kapatırsa, entegratör geldiğinde gönderim tek adım olur.
 */

const SATICI_ALANLARI = {
  name: true, taxNumber: true, taxOffice: true, address: true,
  city: true, district: true, phone: true, email: true,
  eFaturaOnEk: true, eFaturaSeq: true, eFaturaSeqYil: true, eFaturaEtiket: true,
} as const;

const ALICI_ALANLARI = {
  name: true, legalName: true, taxNo: true, taxOffice: true,
  address: true, city: true, district: true, email: true, eInvoiceUser: true,
} as const;

/** Tenant satırını belge satıcısına çevirir — etiket yoksa ön eki kullan. */
function saticiyaCevir(t: {
  name: string; taxNumber: string | null; taxOffice: string | null;
  address: string | null; city: string | null; district: string | null;
  phone: string | null; email: string | null;
  eFaturaOnEk: string | null; eFaturaEtiket: string | null;
}): BelgeSaticisi {
  return { ...t, eFaturaEtiket: t.eFaturaEtiket || t.eFaturaOnEk };
}

export async function GET(req: NextRequest) {
  // Fatura içeriği mali veri — yalnız yönetici.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const id = req.nextUrl.searchParams.get('id');

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }, select: SATICI_ALANLARI,
    });
    if (!tenant) return NextResponse.json({ error: 'Bayi bulunamadı' }, { status: 404 });
    const satici = saticiyaCevir(tenant);
    const saticiEksik = saticiEksikleri(satici);

    // ── TEK FATURA: belgenin kendisi ────────────────────────────────────
    if (id) {
      const f = await prisma.customerInvoice.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: {
          id: true, invoiceNumber: true, invoiceDate: true, notes: true,
          subtotal: true, vatRate: true, vatAmount: true, totalAmount: true,
          ettn: true, gibNo: true, senaryo: true, faturaTipi: true,
          eBelgeDurum: true, eBelgeDurumAt: true, eBelgeNot: true,
          customer: { select: ALICI_ALANLARI },
          lines: {
            orderBy: { createdAt: 'asc' },
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true, vatRate: true },
          },
        },
      });
      if (!f) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 });

      const satirlar = f.lines.map((l) => ({
        aciklama: l.description,
        miktar: Number(l.quantity),
        birimFiyat: Number(l.unitPrice),
        tutar: Number(l.lineTotal),
        kdvOrani: l.vatRate === null ? null : Number(l.vatRate),
      }));
      const fatura = {
        invoiceNumber: f.invoiceNumber, invoiceDate: f.invoiceDate, notes: f.notes,
        subtotal: Number(f.subtotal), vatRate: Number(f.vatRate),
        vatAmount: Number(f.vatAmount), totalAmount: Number(f.totalAmount),
      };

      const eksikler = belgeEksikleri(satici, f.customer, fatura, satirlar);

      // Numara ÖNİZLEMESİ: sayaç artırılmıyor, yalnız "sıradaki hangisi"
      // gösteriliyor. Gerçek atama gönderim anında yapılacak.
      let numaraOnizleme: string | null = f.gibNo;
      if (!numaraOnizleme && tenant.eFaturaOnEk) {
        try {
          numaraOnizleme = gibNumarasiUret(
            tenant.eFaturaOnEk, new Date().getFullYear(),
            tenant.eFaturaSeq, tenant.eFaturaSeqYil,
          ).no;
        } catch { numaraOnizleme = null; }
      }

      let belge = null;
      let belgeHatasi: string | null = null;
      if (!eksikler.length) {
        try {
          belge = eBelgeUret({
            satici, alici: f.customer, fatura, satirlar,
            ettn: f.ettn ?? '(gönderimde atanacak)',
            gibNo: f.gibNo ?? numaraOnizleme ?? '(gönderimde atanacak)',
          });
        } catch (e) {
          // Toplam tutmazsa buraya düşüyor — bayi neden olduğunu görsün.
          belgeHatasi = e instanceof Error ? e.message : String(e);
        }
      }

      return NextResponse.json({
        faturaId: f.id,
        invoiceNumber: f.invoiceNumber,
        musteri: f.customer.name,
        hazir: !eksikler.length && !belgeHatasi,
        eksikler,
        belgeHatasi,
        senaryo: belgeSenaryosu(f.customer),
        numaraOnizleme,
        gonderimDurumu: {
          durum: f.eBelgeDurum, tarih: f.eBelgeDurumAt, not: f.eBelgeNot,
          ettn: f.ettn, gibNo: f.gibNo,
        },
        belge,
      });
    }

    // ── LİSTE: bayi nereden başlasın ────────────────────────────────────
    // ESKİ SİSTEMDE KESİLENLER BU LİSTEDE YOK. Göçte kayıt olarak
    // aktarıldılar; tekrar gönderilirlerse müşteriye ikinci kez fatura
    // gider. Listede görünselerdi bayi onları da hazırlamaya çalışırdı.
    const faturalar = await prisma.customerInvoice.findMany({
      where: {
        tenantId, deletedAt: null, status: { not: 'CANCELLED' },
        NOT: { eBelgeDurum: 'ESKI_SISTEM' },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 500,
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true,
        subtotal: true, vatRate: true, vatAmount: true,
        ettn: true, gibNo: true, eBelgeDurum: true,
        customer: { select: ALICI_ALANLARI },
        _count: { select: { lines: true } },
      },
    });

    const sayac = new Map<string, number>();
    const satirlar = faturalar.map((f) => {
      const eksikler = belgeEksikleri(
        satici, f.customer,
        { totalAmount: Number(f.totalAmount) },
        // Kalem SAYISI yeterli: bu listede kalem içeriği değil, "kalem var mı"
        // sorusu soruluyor. 500 faturanın bütün kalemlerini çekmek gereksiz.
        Array.from({ length: f._count.lines }, () => ({
          aciklama: '', miktar: 0, birimFiyat: 0, tutar: 0, kdvOrani: null,
        })),
      );
      // Satıcı eksikleri bu sayıma GİRMİYOR. Bayinin kendi vergi dairesi
      // eksikse bu TEK bir iş, 12 fatura değil; sayıma girseydi "en çok
      // tekrar eden" listesi aynı işin kopyalarıyla dolar ve asıl
      // yapılacaklar (alıcı eksikleri) ekranın altına düşerdi. Satıcı
      // eksikleri zaten ayrı ve üstte gösteriliyor.
      for (const e of eksikler) {
        if (e.startsWith('Satıcı: ')) continue;
        sayac.set(e, (sayac.get(e) ?? 0) + 1);
      }
      return {
        id: f.id,
        invoiceNumber: f.invoiceNumber,
        tarih: f.invoiceDate,
        musteri: f.customer.name,
        tutar: Number(f.totalAmount),
        hazir: eksikler.length === 0,
        eksikSayisi: eksikler.length,
        eksikler: eksikler.slice(0, 5),
        senaryo: belgeSenaryosu(f.customer),
        durum: f.eBelgeDurum,
        gibNo: f.gibNo,
      };
    });

    return NextResponse.json({
      saticiEksikleri: saticiEksik,
      toplam: satirlar.length,
      hazir: satirlar.filter((x) => x.hazir).length,
      eksik: satirlar.filter((x) => !x.hazir).length,
      // Bayi tek işle en çok faturayı hazır edeceği yeri görsün.
      enSikEksikler: [...sayac.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([eksik, adet]) => ({ eksik, adet })),
      faturalar: satirlar,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
