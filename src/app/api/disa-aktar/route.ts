import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { csvMetni, csvSayi, csvTarih, csvDosyaAdi, csvBasliklari } from '@/lib/csv';
import { tumBakiyeler } from '@/lib/musteri-bakiye';
import { faturaEksikleri, faturaAdi, faturaYolu } from '@/lib/fatura-kimlik';
import { DURUM_ADI, ONCELIK_ADI } from '@/lib/rapor-ozeti';
import { getPaymentStatusLabel } from '@/lib/utils';

/**
 * GET /api/disa-aktar?tur=musteri|cihaz|fis|cari
 *
 * ── NİÇİN ────────────────────────────────────────────────────────────────
 * İçe aktarma vardı, dışa aktarma YOKTU. Veri içeri giriyor ama dışarı
 * çıkmıyordu; muhasebeciye müşteri listesi vermek, sigortaya cihaz dökümü
 * çıkarmak ya da ayın fişlerini göndermek için hiçbir yol yoktu.
 *
 * Bu aynı zamanda dürüstlük meselesi: veri bayinin. Bizden ayrılmak
 * isterse listesini alabilmeli. Alabileceğini bilen bayi kalmayı seçer;
 * alamayacağını düşünen en baştan girmez.
 *
 * ── EKRANLA AYNI RAKAM ───────────────────────────────────────────────────
 * Borç, ekrandakiyle AYNI kaynaktan (lib/musteri-bakiye.ts) çıkıyor; durum
 * ve öncelik adları rapor ekranıyla aynı sözlükten. Ayrı bir toplama ya da
 * ikinci bir sözlük yazsaydık iki yer iki farklı cevap verirdi ve bayi
 * hangisinin doğru olduğunu bilemezdi.
 *
 * Biçim lib/csv.ts'te: noktalı virgül + BOM + ondalık virgül + alan
 * kaçırma ("ABC Ltd; Şti" sütunları kaydırmıyor).
 */

const TURLER = ['musteri', 'cihaz', 'fis', 'cari'] as const;
type Tur = (typeof TURLER)[number];

// Tek seferde dönen fiş sayısı. Sınırsız bırakmak büyük bayide sunucuyu
// kilitler; sessizce kesmek de olmaz — kesildiyse son satırda yazıyor.
const FIS_TAVANI = 10000;

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const tur = (req.nextUrl.searchParams.get('tur') || '') as Tur;
    if (!TURLER.includes(tur)) {
      return NextResponse.json(
        { error: `Bilinmeyen liste. Seçenekler: ${TURLER.join(', ')}` },
        { status: 400 },
      );
    }

    let basliklar: string[] = [];
    let satirlar: unknown[][] = [];

    if (tur === 'musteri') {
      const [musteriler, bakiyeler] = await Promise.all([
        prisma.customer.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
          select: {
            id: true, name: true, legalName: true, phone: true, email: true,
            taxNo: true, taxOffice: true, city: true, district: true, address: true,
            contactPerson: true, eInvoiceUser: true, contractEndDate: true,
            _count: { select: { devices: true } },
          },
        }),
        tumBakiyeler(tenantId),
      ]);
      // Borç da bu listede: muhasebeciye giden dosyada en çok sorulan şey bu
      // ve iki ayrı dosyayı elle birleştirmeye gerek kalmıyor.
      basliklar = [
        'Müşteri', 'Ticari unvan', 'Telefon', 'E-posta', 'Vergi/TC No',
        'Vergi dairesi', 'İl', 'İlçe', 'Adres', 'Yetkili', 'Cihaz adedi',
        'Toplam borç (₺)', 'Fatura yolu', 'Fatura eksikleri', 'Sözleşme bitişi',
      ];
      satirlar = musteriler.map((m) => [
        m.name, m.legalName ?? '', m.phone, m.email ?? '', m.taxNo ?? '',
        m.taxOffice ?? '', m.city ?? '', m.district ?? '', m.address ?? '',
        m.contactPerson ?? '', m._count.devices,
        csvSayi(bakiyeler.get(m.id)?.toplamBorc ?? 0),
        faturaYolu(m) ?? 'bilinmiyor',
        faturaEksikleri(m).join(' · '),
        csvTarih(m.contractEndDate),
      ]);
    }

    if (tur === 'cihaz') {
      const cihazlar = await prisma.device.findMany({
        where: { tenantId },
        orderBy: [{ customer: { name: 'asc' } }, { serialNo: 'asc' }],
        select: {
          brand: true, model: true, serialNo: true, barcode: true, location: true,
          isRental: true, monthlyRent: true, includedBlack: true, includedColor: true,
          pricePerBlack: true, pricePerColor: true, counterBlack: true, counterColor: true,
          installedAt: true, customer: { select: { name: true } },
          counterReadings: {
            orderBy: { readingDate: 'desc' }, take: 1,
            select: { readingDate: true, counterBlack: true, counterColor: true },
          },
        },
      });
      basliklar = [
        'Müşteri', 'Marka', 'Model', 'Seri No', 'Barkod', 'Konum', 'Kiralık',
        'Aylık kira (₺)', 'Dahil S/B', 'Dahil Renkli', 'S/B birim (₺)', 'Renkli birim (₺)',
        'Sayaç S/B', 'Sayaç Renkli', 'Son okuma', 'Kurulum',
      ];
      satirlar = cihazlar.map((d) => {
        const son = d.counterReadings[0];
        return [
          d.customer?.name ?? '', d.brand, d.model, d.serialNo, d.barcode ?? '',
          d.location ?? '', d.isRental ? 'Evet' : 'Hayır',
          csvSayi(Number(d.monthlyRent)), d.includedBlack, d.includedColor,
          d.pricePerBlack === null ? '' : csvSayi(Number(d.pricePerBlack), 4),
          d.pricePerColor === null ? '' : csvSayi(Number(d.pricePerColor), 4),
          // Sayaç hiç okunmamışsa BOŞ bırakılıyor, sıfır yazılmıyor:
          // "okunmamış" ile "sayacı sıfır" aynı şey değil ve sıfır yazmak
          // bir sonraki faturada kayıp sayfa demek.
          d.counterBlack ?? son?.counterBlack ?? '',
          d.counterColor ?? son?.counterColor ?? '',
          csvTarih(son?.readingDate), csvTarih(d.installedAt),
        ];
      });
    }

    if (tur === 'fis') {
      const fisler = await prisma.serviceTicket.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: FIS_TAVANI,
        select: {
          ticketNumber: true, status: true, priority: true, paymentStatus: true,
          issueText: true, actionText: true, totalCost: true, laborCost: true,
          createdAt: true,
          // Fişte ayrı bir müşteri ilişkisi YOK (yalnız customerId var);
          // müşteri adı cihaz üzerinden geliyor.
          device: { select: { brand: true, model: true, serialNo: true, customer: { select: { name: true } } } },
          assignedUser: { select: { name: true } },
        },
      });
      basliklar = [
        'Fiş No', 'Tarih', 'Müşteri', 'Cihaz', 'Seri No', 'Teknisyen',
        'Durum', 'Öncelik', 'Ödeme', 'Arıza', 'Yapılan', 'İşçilik (₺)', 'Tutar (₺)',
      ];
      satirlar = fisler.map((f) => [
        f.ticketNumber, csvTarih(f.createdAt), f.device?.customer?.name ?? '',
        [f.device?.brand, f.device?.model].filter(Boolean).join(' '),
        f.device?.serialNo ?? '', f.assignedUser?.name ?? '',
        DURUM_ADI[f.status] ?? f.status, ONCELIK_ADI[f.priority] ?? f.priority,
        getPaymentStatusLabel(f.paymentStatus),
        f.issueText ?? '', f.actionText ?? '',
        csvSayi(Number(f.laborCost)), csvSayi(Number(f.totalCost)),
      ]);
      // Sessizce kesmek "hepsi bu kadarmış" demektir. Kesildiyse dosyanın
      // içinde yazsın ki bayi eksik bir listeyi tam sansın diye bir şey olmasın.
      if (fisler.length === FIS_TAVANI) {
        satirlar.push([
          `NOT: En yeni ${FIS_TAVANI} fiş aktarıldı, daha eskiler bu dosyada yok.`,
          ...Array(basliklar.length - 1).fill(''),
        ]);
      }
    }

    if (tur === 'cari') {
      // Tek müşterinin ekstresi değil, müşteri bazında borç özeti: bayi bunu
      // muhasebeciye verip "kim ne kadar borçlu" sorusunu kapatıyor.
      const [musteriler, bakiyeler] = await Promise.all([
        prisma.customer.findMany({
          where: { tenantId }, orderBy: { name: 'asc' },
          select: { id: true, name: true, legalName: true, phone: true, taxNo: true },
        }),
        tumBakiyeler(tenantId),
      ]);
      basliklar = [
        'Müşteri', 'Faturadaki ad', 'Telefon', 'Vergi/TC No',
        'Servis borcu (₺)', 'Kira/sayaç borcu (₺)', 'Toplam borç (₺)',
      ];
      satirlar = musteriler.map((m) => {
        const b = bakiyeler.get(m.id);
        return [
          m.name, faturaAdi(m), m.phone, m.taxNo ?? '',
          csvSayi(b?.servisBorc ?? 0), csvSayi(b?.faturaBorc ?? 0), csvSayi(b?.toplamBorc ?? 0),
        ];
      });
    }

    const bugun = new Date();
    const dosya = csvDosyaAdi(
      tur,
      `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`,
    );
    return new NextResponse(csvMetni(basliklar, satirlar), { headers: csvBasliklari(dosya) });
  } catch (e) {
    return authErrorResponse(e);
  }
}
