import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { parseCSV, detectDelimiter, trNumber, normalizePhone, basligiNormalle } from '@/lib/sheet-import';
import { parseDate } from '@/lib/import-parser';
import { ESKI_SISTEM } from '@/lib/fatura-belgesi';

/**
 * POST /api/import/devir
 *   { csv, tur: 'bakiye' | 'fatura', tarih?, dryRun }
 *
 * ── NİÇİN ────────────────────────────────────────────────────────────────
 * Başka programdan gelen bayinin müşterileri göç anında ZATEN borçlu. O
 * borç aktarılmazsa ilk gün bütün müşteriler ₺0 görünür; bayi Muhasebe
 * ekranına bir daha güvenmez ve eski programı açık tutmaya devam eder —
 * yani göç aslında olmamış olur.
 *
 * ── İKİ YOL, İKİSİ BİRDEN DEĞİL ──────────────────────────────────────────
 * 'bakiye' → müşteri başına tek rakam ("bu müşteri bana şu kadar borçlu")
 * 'fatura' → fatura fatura geçmiş (numarası, tarihi, tutarı, ödeneni)
 *
 * İkisi de AYNI borcu anlatıyor. Bir müşteri için ikisi birden yüklenirse
 * borç İKİYE KATLANIR ve bunu kimse fark etmez — müşteriye iki kat borç
 * görünür, bayi "program yanlış hesaplıyor" der. Bu yüzden aynı müşteride
 * ikisi birden borç üretemiyor; çakışan satır yazılmıyor ve sebebi
 * söyleniyor. (Tamamı ÖDENMİŞ geçmiş faturalar borç üretmediği için
 * çakışma saymıyor — kayıt olarak durabilirler.)
 *
 * ── PARA UYDURMAMA ───────────────────────────────────────────────────────
 * Devir kaydı GELİR YAZMIYOR. Defter nakit esaslı: gelir tahsilat anında
 * yazılıyor ve açılış bakiyesi bir tahsilat değil, devreden bakiye. Aynı
 * şekilde geçmiş faturalar da e-belge olarak GÖNDERİLMEYECEK biçimde
 * işaretleniyor — onlar eski sistemde zaten faturalandı.
 */

const MAX_ROWS = 20000;

type Satir = {
  no: number;
  musteri: string;
  telefon: string;
  faturaNo: string;
  tarih: Date | null;
  tutar: number | null;
  odenen: number;
  hata: string | null;
  customerId?: string;
};

function sutunlar(basliklar: string[]) {
  const norm = basliklar.map(basligiNormalle);
  const bul = (...adaylar: string[]) => {
    for (const a of adaylar) {
      const i = norm.findIndex((h) => h.includes(a));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    // "Fatura No" önce aranıyor: geniş "no" kalıbı onu yutmasın.
    faturaNo: bul('fatura no', 'belge no', 'faturano', 'fis no'),
    musteri: bul('musteri', 'cari', 'firma', 'unvan', 'isim', 'ad soyad', 'customer'),
    telefon: bul('telefon', 'tel', 'gsm', 'cep', 'phone'),
    tarih: bul('tarih', 'date'),
    // "Kalan"/"Bakiye" borç sütunu; "Tutar"/"Toplam" fatura tutarı.
    tutar: bul('bakiye', 'borc', 'tutar', 'toplam', 'genel toplam', 'amount'),
    odenen: bul('odenen', 'tahsil', 'ode', 'paid'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    // Doğrudan borcu belirleyen veri — yönetici işi.
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Devir aktarmak için yönetici yetkisi gerekir' }, { status: 403 });
    }

    const { csv, tur, tarih, dryRun } = await req.json();
    if (tur !== 'bakiye' && tur !== 'fatura') {
      return NextResponse.json({ error: 'Aktarım türü "bakiye" ya da "fatura" olmalı' }, { status: 400 });
    }
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ error: 'Dosya boş görünüyor' }, { status: 400 });
    }

    const devirTarihi = tarih ? parseDate(String(tarih)) : new Date();
    if (!devirTarihi) return NextResponse.json({ error: 'Devir tarihi okunamadı' }, { status: 400 });
    if (devirTarihi.getTime() > Date.now() + 86400000) {
      return NextResponse.json({ error: 'Devir tarihi gelecekte olamaz' }, { status: 400 });
    }

    const ham = parseCSV(csv, detectDelimiter(csv));
    if (ham.length < 2) {
      return NextResponse.json({ error: 'Dosyada başlık satırı + en az 1 veri satırı olmalı' }, { status: 400 });
    }
    const basliklar = ham[0].map((h) => h.trim());
    const veri = ham.slice(1);
    if (veri.length > MAX_ROWS) {
      return NextResponse.json({ error: `Tek seferde en fazla ${MAX_ROWS} satır (dosyada ${veri.length})` }, { status: 400 });
    }

    const s = sutunlar(basliklar);
    const kimlikVar = s.musteri >= 0 || s.telefon >= 0;
    if (!kimlikVar || s.tutar < 0) {
      return NextResponse.json({
        error: tur === 'bakiye'
          ? 'Gerekli sütunlar bulunamadı. Dosyada en az şunlar olmalı: Müşteri (ya da Telefon) ve Bakiye.'
          : 'Gerekli sütunlar bulunamadı. Dosyada en az şunlar olmalı: Müşteri (ya da Telefon), Fatura No, Tarih, Tutar.',
        bulunanBasliklar: basliklar,
      }, { status: 400 });
    }
    if (tur === 'fatura' && (s.faturaNo < 0 || s.tarih < 0)) {
      return NextResponse.json({
        error: 'Fatura geçmişi için "Fatura No" ve "Tarih" sütunları da gerekli.',
        bulunanBasliklar: basliklar,
      }, { status: 400 });
    }

    const al = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const satirlar: Satir[] = veri.map((r, i) => {
      const musteri = al(r, s.musteri);
      const telefon = normalizePhone(al(r, s.telefon));
      const faturaNo = al(r, s.faturaNo).slice(0, 60);
      const tarihH = al(r, s.tarih);
      const tutar = trNumber(al(r, s.tutar));
      const odenen = trNumber(al(r, s.odenen)) ?? 0;
      const t: Satir = {
        no: i + 2, musteri, telefon, faturaNo,
        tarih: tarihH ? parseDate(tarihH) : (tur === 'bakiye' ? devirTarihi : null),
        tutar, odenen, hata: null,
      };
      if (!musteri && !telefon) t.hata = 'Müşteri adı ve telefon boş';
      else if (tutar === null) t.hata = 'Tutar okunamadı';
      else if (tur === 'fatura') {
        if (!faturaNo) t.hata = 'Fatura no boş';
        else if (!t.tarih) t.hata = 'Tarih okunamadı';
        else if (tutar <= 0) t.hata = 'Fatura tutarı sıfır ya da negatif';
        else if (odenen < 0) t.hata = 'Ödenen negatif olamaz';
        else if (odenen > tutar + 0.001) t.hata = 'Ödenen tutardan büyük olamaz';
      }
      if (!t.hata && t.tarih && t.tarih.getTime() > Date.now() + 86400000) t.hata = 'Tarih gelecekte';
      return t;
    });

    // ── MÜŞTERİ EŞLEŞTİRME ──────────────────────────────────────────────
    // Telefon tekil anahtar; ad ikinci şans. Türkçe büyük/küçük harf
    // karşılaştırması tr-TR ile yapılıyor (İ/ı tuzağı).
    const musteriler = await prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true },
    });
    const telefonla = new Map(musteriler.map((m) => [m.phone, m.id]));
    const adla = new Map<string, string[]>();
    for (const m of musteriler) {
      const k = m.name.toLocaleLowerCase('tr-TR').trim();
      adla.set(k, [...(adla.get(k) ?? []), m.id]);
    }

    for (const x of satirlar) {
      if (x.hata) continue;
      let id = x.telefon ? telefonla.get(x.telefon) : undefined;
      if (!id && x.musteri) {
        const aday = adla.get(x.musteri.toLocaleLowerCase('tr-TR').trim()) ?? [];
        // Aynı adda iki müşteri varsa TAHMİN ETMİYORUZ: yanlış müşteriye
        // borç yazmak, borç yazmamaktan daha kötü.
        if (aday.length === 1) id = aday[0];
        else if (aday.length > 1) { x.hata = 'Aynı adda birden çok müşteri var — telefon kolonu ekleyin'; continue; }
      }
      if (!id) { x.hata = 'Bu müşteri sistemde bulunamadı'; continue; }
      x.customerId = id;
    }

    // ── ÇİFT BORÇ KORUMASI ──────────────────────────────────────────────
    const gecerli = satirlar.filter((x) => !x.hata && x.customerId);
    const ilgiliMusteriler = [...new Set(gecerli.map((x) => x.customerId!))];

    const [mevcutAcilis, mevcutFatura] = await Promise.all([
      ilgiliMusteriler.length
        ? prisma.accountEntry.findMany({
            where: { tenantId, customerId: { in: ilgiliMusteriler }, importKey: { not: null } },
            select: { customerId: true, amount: true, type: true, importKey: true },
          })
        : [],
      ilgiliMusteriler.length
        ? prisma.customerInvoice.findMany({
            where: {
              tenantId, customerId: { in: ilgiliMusteriler }, deletedAt: null,
              eBelgeDurum: ESKI_SISTEM, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
            },
            select: { customerId: true, invoiceNumber: true, totalAmount: true, paidAmount: true },
          })
        : [],
    ]);

    const acilisBorclu = new Set(
      mevcutAcilis.filter((e) => Number(e.amount) > 0).map((e) => e.customerId),
    );
    const faturaBorclu = new Set(
      mevcutFatura.filter((f) => Number(f.totalAmount) - Number(f.paidAmount) > 0.001).map((f) => f.customerId),
    );
    // Dosyadaki numara zaten sistemde varsa (devir olsun olmasın) yazmıyoruz.
    const tumFaturaNo = new Set(
      (await prisma.customerInvoice.findMany({
        where: { tenantId, invoiceNumber: { in: gecerli.map((x) => x.faturaNo).filter(Boolean) } },
        select: { invoiceNumber: true },
      })).map((f) => f.invoiceNumber),
    );
    for (const x of gecerli) {
      if (tur === 'bakiye') {
        if (Number(x.tutar) > 0 && faturaBorclu.has(x.customerId!)) {
          x.hata = 'Bu müşterinin açık devir faturası var — bakiye de yazılırsa borç ikiye katlanır';
        }
      } else {
        const acik = Number(x.tutar) - x.odenen;
        if (acik > 0.001 && acilisBorclu.has(x.customerId!)) {
          x.hata = 'Bu müşteride açılış bakiyesi var — fatura da yazılırsa borç ikiye katlanır';
        } else if (tumFaturaNo.has(x.faturaNo)) {
          x.hata = 'Bu fatura numarası sistemde zaten var';
        }
      }
    }

    // Aynı dosyada aynı müşteri iki kez (bakiye) / aynı fatura no iki kez.
    let tekrar = 0;
    const gorulen = new Set<string>();
    for (const x of satirlar) {
      if (x.hata || !x.customerId) continue;
      const k = tur === 'bakiye' ? x.customerId : x.faturaNo;
      if (gorulen.has(k)) { x.hata = tur === 'bakiye' ? 'Aynı müşteri dosyada iki kez' : 'Aynı fatura no dosyada iki kez'; tekrar++; }
      gorulen.add(k);
    }

    const yazilacak = satirlar.filter((x) => !x.hata && x.customerId);
    const hatali = satirlar.filter((x) => x.hata);
    const borcToplam = yazilacak.reduce(
      (t, x) => t + (tur === 'bakiye' ? Number(x.tutar) : Number(x.tutar) - x.odenen),
      0,
    );

    const ozet = {
      toplamSatir: satirlar.length,
      yazilacak: yazilacak.length,
      hatali: hatali.length,
      musteriSayisi: new Set(yazilacak.map((x) => x.customerId)).size,
      borcToplam: Math.round(borcToplam * 100) / 100,
      eslesmeyenMusteri: [...new Set(
        satirlar.filter((x) => x.hata === 'Bu müşteri sistemde bulunamadı').map((x) => x.musteri || x.telefon),
      )].slice(0, 20),
    };

    if (dryRun) {
      return NextResponse.json({
        onizleme: true, tur, ...ozet,
        devirTarihi: devirTarihi.toISOString().slice(0, 10),
        ornek: yazilacak.slice(0, 10).map((x) => ({
          musteri: x.musteri || x.telefon,
          faturaNo: x.faturaNo || null,
          tarih: x.tarih ? x.tarih.toISOString().slice(0, 10) : null,
          tutar: x.tutar,
          odenen: tur === 'fatura' ? x.odenen : null,
        })),
        hatalar: hatali.slice(0, 30).map((x) => ({ satir: x.no, musteri: x.musteri || x.telefon, hata: x.hata })),
        not: tur === 'bakiye'
          ? 'Açılış bakiyesi GELİR YAZMAZ — devreden borçtur, satış değil. Aynı dosyayı tekrar yüklerseniz borç ikiye katlanmaz, mevcut açılış kaydı güncellenir.'
          : 'Geçmiş faturalar "eski sistemde kesildi" olarak işaretlenir: e-Fatura ekranında gönderilecekler arasında ÇIKMAZ ve gelir yazmazlar.',
      });
    }

    // ── YAZMA ───────────────────────────────────────────────────────────
    let yazilan = 0;
    if (tur === 'bakiye') {
      for (const x of yazilacak) {
        const tutar = Number(x.tutar);
        // Eksi bakiye = müşteri ALACAKLI (peşin ödemiş). Borcu eksiye
        // çeviren tek yol PAYMENT kaydı; SALE'e eksi yazmak defteri bozar.
        const pozitif = Math.abs(Math.round(tutar * 100) / 100);
        const tip = tutar >= 0 ? 'SALE' : 'PAYMENT';
        const anahtar = `acilis:${x.customerId}`;
        const veriler = {
          tenantId, customerId: x.customerId!,
          type: tip as 'SALE' | 'PAYMENT',
          product: tutar >= 0 ? 'Devir bakiyesi (eski sistemden)' : null,
          amount: pozitif,
          method: 'OPEN_ACCOUNT',
          notes: 'Göç sırasında aktarılan açılış bakiyesi',
          createdByUserId: user.id,
          createdByName: user.name,
          importKey: anahtar,
          date: x.tarih ?? devirTarihi,
        };
        // Tekrar yüklemede GÜNCELLE: ikinci bir açılış kaydı borcu ikiye katlar.
        await prisma.accountEntry.upsert({
          where: { tenantId_importKey: { tenantId, importKey: anahtar } },
          create: veriler,
          update: { type: veriler.type, amount: veriler.amount, product: veriler.product, date: veriler.date },
        });
        yazilan++;
      }
    } else {
      for (const x of yazilacak) {
        const toplam = Math.round(Number(x.tutar) * 100) / 100;
        const odenen = Math.round(x.odenen * 100) / 100;
        const t = x.tarih ?? devirTarihi;
        const donem = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
        await prisma.customerInvoice.create({
          data: {
            tenantId, customerId: x.customerId!,
            invoiceNumber: x.faturaNo,
            period: donem,
            invoiceDate: t,
            // Vade bilinmiyor; fatura tarihi yazılıyor ki "vadesi geçmiş"
            // hesabı uydurma bir tarihe dayanmasın.
            dueDate: t,
            // KDV ayrımı eski sistemde kaldı. Uydurmuyoruz: matrah = toplam,
            // KDV = 0. Borç doğru, ayrım bilinmiyor ve öyle yazıyor.
            subtotal: toplam, vatRate: 0, vatAmount: 0,
            totalAmount: toplam, paidAmount: odenen,
            status: odenen >= toplam - 0.001 ? 'PAID' : odenen > 0 ? 'PARTIAL' : 'OPEN',
            paidAt: odenen >= toplam - 0.001 ? t : null,
            source: 'MANUAL',
            // e-Fatura ekranı bunları gönderilecekler arasında GÖSTERMEZ.
            eBelgeDurum: ESKI_SISTEM,
            eBelgeDurumAt: new Date(),
            eBelgeNot: 'Eski sistemde faturalandı — göçte kayıt olarak aktarıldı',
            notes: 'Göç sırasında aktarıldı (KDV ayrımı eski sistemde kaldı)',
          },
        });
        yazilan++;
      }
    }

    return NextResponse.json({
      onizleme: false, tur, ...ozet, yazilan, tekrar,
      hatalar: hatali.slice(0, 30).map((x) => ({ satir: x.no, musteri: x.musteri || x.telefon, hata: x.hata })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
