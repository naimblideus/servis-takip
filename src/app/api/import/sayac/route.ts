import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { parseCSV, detectDelimiter, trInt } from '@/lib/sheet-import';
import { parseDate } from '@/lib/import-parser';
import { okumaFarki } from '@/lib/readings';

/**
 * POST /api/import/sayac
 *   { csv, dryRun }  → dryRun:true = ÖNİZLEME (hiçbir şey yazılmaz)
 *
 * ── NİÇİN AYRI BİR UÇ ────────────────────────────────────────────────────
 * Başka bir programdan (Paperpan, eski masaüstü yazılımı, Excel) gelen bayi
 * müşterisini ve cihazını aktarabiliyordu ama SAYAÇ GEÇMİŞİNİ aktaramıyordu.
 * Bu, göçten sonraki ilk faturayı sessizce bozuyor: fark her zaman önceki
 * okumaya göre hesaplanıyor, geçmiş yoksa ilk okuma zincirin BAŞI sayılıyor
 * ve farkı sıfır çıkıyor. Yani bayi göç ettiği ayın bütün sayfalarını
 * kaybediyor. (Aynı tuzak elle cihaz eklemede de vardı ve düzeltildi.)
 *
 * ── PARA UYDURMAMA KURALI ────────────────────────────────────────────────
 * Aktarılan okumalar `billed: true` yazılıyor ve tutar üretmiyor. Çünkü o
 * sayfalar ESKİ SİSTEMDE zaten faturalandı. Faturalanmamış yazsaydık, bayi
 * göçten sonra ilk kez "Bu Dönemi Faturala" dediğinde geçmişin tamamı yeni
 * bir faturaya dönüşür ve müşteriye iki kez fatura gider. Göç aracının
 * yapabileceği en pahalı hata budur.
 *
 * ── ZİNCİRİ BOZMAMA KURALI ───────────────────────────────────────────────
 * Yalnız cihazın MEVCUT en eski okumasından ÖNCEKİ tarihler kabul ediliyor.
 * Araya ya da sonraya satır eklemek, zaten yazılmış okumaların farkını
 * geçmişe dönük değiştirir — faturalanmış bir okumanın farkını değiştirmek
 * ise defterle faturayı ayrıştırır.
 */

const MAX_ROWS = 20000;

type Satir = {
  no: number;
  seri: string;
  tarih: Date | null;
  siyah: number | null;
  renkli: number;
  hata: string | null;
};

/** Başlıkta seri/tarih/siyah/renkli sütunlarını bul. */
function sutunlar(basliklar: string[]) {
  const norm = basliklar.map((h) => h.toLocaleLowerCase('tr-TR').replace(/[\s_.-]/g, ''));
  const bul = (...adaylar: string[]) => {
    for (const a of adaylar) {
      const i = norm.findIndex((h) => h.includes(a));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    seri: bul('serino', 'seri', 'serial', 'barkod'),
    tarih: bul('tarih', 'date', 'okumatarihi'),
    siyah: bul('siyah', 'sb', 'mono', 'black', 'sayac'),
    renkli: bul('renkli', 'color', 'colour'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    // Sayaç geçmişi doğrudan faturayı belirleyen veridir — yönetici işi.
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Sayaç geçmişi aktarmak için yönetici yetkisi gerekir' }, { status: 403 });
    }

    const { csv, dryRun } = await req.json();
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ error: 'Dosya boş görünüyor' }, { status: 400 });
    }

    const satirlarHam = parseCSV(csv, detectDelimiter(csv));
    if (satirlarHam.length < 2) {
      return NextResponse.json({ error: 'Dosyada başlık satırı + en az 1 veri satırı olmalı' }, { status: 400 });
    }
    const basliklar = satirlarHam[0].map((h) => h.trim());
    const veri = satirlarHam.slice(1);
    if (veri.length > MAX_ROWS) {
      return NextResponse.json({ error: `Tek seferde en fazla ${MAX_ROWS} satır (dosyada ${veri.length})` }, { status: 400 });
    }

    const s = sutunlar(basliklar);
    if (s.seri < 0 || s.tarih < 0 || s.siyah < 0) {
      return NextResponse.json({
        error: 'Gerekli sütunlar bulunamadı. Dosyada en az şunlar olmalı: Seri No, Tarih, Siyah Sayaç (Renkli isteğe bağlı).',
        bulunanBasliklar: basliklar,
      }, { status: 400 });
    }

    const al = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const satirlar: Satir[] = veri.map((r, i) => {
      const seri = al(r, s.seri);
      const tarih = parseDate(al(r, s.tarih));
      const siyah = trInt(al(r, s.siyah));
      const renkli = trInt(al(r, s.renkli)) ?? 0;
      let hata: string | null = null;
      if (!seri) hata = 'Seri no boş';
      else if (!tarih) hata = 'Tarih okunamadı';
      else if (siyah === null) hata = 'Siyah sayaç okunamadı';
      else if (siyah < 0 || renkli < 0) hata = 'Sayaç negatif olamaz';
      else if (tarih.getTime() > Date.now()) hata = 'Tarih gelecekte';
      return { no: i + 2, seri, tarih, siyah, renkli, hata };
    });

    // ── CİHAZ EŞLEŞTİRME ────────────────────────────────────────────────
    // Etikette yazan seri (serialNo), cihazın kendi bildirdiği seri
    // (reportedSerial) ve barkod — üçü de kabul. Eski sistemden gelen dosya
    // hangisini taşıyorsa taşısın eşleşsin.
    const seriler = [...new Set(satirlar.filter((x) => !x.hata).map((x) => x.seri))];
    const cihazlar = seriler.length
      ? await prisma.device.findMany({
          where: {
            tenantId,
            OR: [
              { serialNo: { in: seriler } },
              { reportedSerial: { in: seriler } },
              { barcode: { in: seriler } },
            ],
          },
          select: { id: true, serialNo: true, reportedSerial: true, barcode: true },
        })
      : [];
    const cihazHarita = new Map<string, string>();
    for (const c of cihazlar) {
      for (const k of [c.serialNo, c.reportedSerial, c.barcode]) if (k) cihazHarita.set(k, c.id);
    }

    // Her cihazın MEVCUT en eski okuması — zincire araya girmeyi engelliyor.
    const cihazIdleri = [...new Set([...cihazHarita.values()])];
    const mevcutEnEski = new Map<string, Date>();
    if (cihazIdleri.length) {
      const gruplar = await prisma.counterReading.groupBy({
        by: ['deviceId'],
        where: { tenantId, deviceId: { in: cihazIdleri } },
        _min: { readingDate: true },
      });
      for (const g of gruplar) if (g._min.readingDate) mevcutEnEski.set(g.deviceId, g._min.readingDate);
    }

    for (const x of satirlar) {
      if (x.hata) continue;
      const devId = cihazHarita.get(x.seri);
      if (!devId) { x.hata = 'Bu seri no ile cihaz bulunamadı'; continue; }
      const enEski = mevcutEnEski.get(devId);
      if (enEski && x.tarih!.getTime() >= enEski.getTime()) {
        x.hata = `Bu cihazda ${enEski.toLocaleDateString('tr-TR')} tarihli okuma zaten var — geçmiş yalnız ondan ÖNCESİ için aktarılabilir`;
      }
    }

    const gecerli = satirlar.filter((x) => !x.hata);
    const hatali = satirlar.filter((x) => x.hata);

    // Cihaz bazında kronolojik sırala — fark zinciri buna göre kuruluyor.
    const cihazaGore = new Map<string, Satir[]>();
    for (const x of gecerli) {
      const id = cihazHarita.get(x.seri)!;
      const l = cihazaGore.get(id) ?? [];
      l.push(x);
      cihazaGore.set(id, l);
    }
    for (const l of cihazaGore.values()) l.sort((a, b) => a.tarih!.getTime() - b.tarih!.getTime());

    // Aynı cihaz + aynı tarih iki kez geldiyse ikincisi anlamsız.
    let tekrar = 0;
    for (const [, l] of cihazaGore) {
      const gorulen = new Set<number>();
      for (const x of l) {
        const g = x.tarih!.getTime();
        if (gorulen.has(g)) { x.hata = 'Aynı cihazda aynı tarih iki kez'; tekrar++; }
        gorulen.add(g);
      }
    }

    const yazilacak = gecerli.filter((x) => !x.hata);
    const ozet = {
      toplamSatir: satirlar.length,
      yazilacak: yazilacak.length,
      hatali: hatali.length + tekrar,
      cihazSayisi: cihazaGore.size,
      eslesmeyenSeri: [...new Set(satirlar.filter((x) => x.hata === 'Bu seri no ile cihaz bulunamadı').map((x) => x.seri))].slice(0, 20),
    };

    if (dryRun) {
      return NextResponse.json({
        onizleme: true,
        ...ozet,
        // Bayi ne yazılacağını görsün diye ilk satırlar örnek olarak dönüyor.
        ornek: yazilacak.slice(0, 10).map((x) => ({
          seri: x.seri, tarih: x.tarih!.toISOString().slice(0, 10), siyah: x.siyah, renkli: x.renkli,
        })),
        hatalar: hatali.slice(0, 30).map((x) => ({ satir: x.no, seri: x.seri, hata: x.hata })),
        not: 'Aktarılan okumalar FATURALANMIŞ olarak yazılır ve tutar üretmez — bu sayfalar eski sisteminizde zaten faturalandı.',
      });
    }

    // ── YAZMA ───────────────────────────────────────────────────────────
    let yazilan = 0;
    for (const [devId, liste] of cihazaGore) {
      const gecerliListe = liste.filter((x) => !x.hata);
      if (!gecerliListe.length) continue;
      let oncekiS: number | null = null;
      let oncekiR: number | null = null;
      const kayitlar = gecerliListe.map((x) => {
        // TEK KURAL: fark hesabı readings.ts'teki okumaFarki(). Burada ayrı
        // bir hesap yazmak, aynı işin iki yerde iki sonuç vermesi demekti.
        const dS = okumaFarki(x.siyah!, oncekiS);
        const dR = okumaFarki(x.renkli, oncekiR);
        oncekiS = x.siyah!;
        oncekiR = x.renkli;
        return {
          tenantId, deviceId: devId,
          counterBlack: x.siyah!, counterColor: x.renkli,
          deltaBlack: dS, deltaColor: dR,
          calculatedCost: 0,
          // Eski sistemde faturalandı — burada tekrar faturaya girmemeli.
          billed: true,
          source: 'TOPLU',
          readingDate: x.tarih!,
        };
      });
      await prisma.counterReading.createMany({ data: kayitlar });
      yazilan += kayitlar.length;
    }

    return NextResponse.json({
      onizleme: false,
      ...ozet,
      yazilan,
      hatalar: hatali.slice(0, 30).map((x) => ({ satir: x.no, seri: x.seri, hata: x.hata })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
