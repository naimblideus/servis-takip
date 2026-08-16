import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCounterEmail, parseCounterEmailCoklu, htmlToText, bildirilenSeri } from '@/lib/counter-email';
import { createReading, ReadingError, sonOkumalar } from '@/lib/readings';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/sayac/eposta — cihazın gönderdiği sayaç e-postasını al ve işle.
 *
 * KAYNAK: e-postayı ileten herhangi bir yol olabilir — Cloudflare Email
 * Routing, Mailgun/Postmark inbound, Zapier, elle yapıştırma. Bu yüzden
 * bilerek SADE bir sözleşme: { to, subject, from, text } JSON.
 *
 * GÜVENLİK: uç dışarıdan çağrılacağı için paylaşılan sır ZORUNLU (fail-closed).
 * SAYAC_EPOSTA_SECRET tanımlı değilse hiçbir istek kabul edilmez.
 *
 * ── BAYİYİ "to" ADRESİ SÖYLER ────────────────────────────────────────────
 * Cihazlar sayac+<kod>@alanadi adresine gönderir; kod bayiyi belirler ve seri
 * araması O BAYİNİN cihazlarıyla sınırlanır. Kodsuz tek adres iki sorun
 * üretiyordu: aynı seri iki bayide varsa hangisi olduğu bilinemiyordu ve her
 * e-postada tüm bayilerin tüm cihazları taranıyordu.
 *
 * Kod yoksa (eski kurulum) davranış eskisi gibi: tüm cihazlarda aranır ve
 * seri birden çok bayide bulunursa TAHMİN EDİLMEZ, kuyruğa düşer.
 *
 * ── TEK E-POSTA, BİRDEN ÇOK CİHAZ ────────────────────────────────────────
 * Onlarca makinesi olan firmada filo yazılımı hepsini tek raporda gönderir.
 * Her cihaz KENDİ satırından okunur; okunamayan cihaz kuyruğa düşer, diğerleri
 * işlenmeye devam eder — bir satır yüzünden bütün rapor beklemez.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SAYAC_EPOSTA_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'SAYAC_EPOSTA_SECRET tanımlı değil — uç kapalı' }, { status: 503 });
  }
  const verilen = req.headers.get('x-sayac-secret') ?? new URL(req.url).searchParams.get('secret');
  if (verilen !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ham = String(body?.text ?? body?.html ?? '').slice(0, 500_000);
  const subject = String(body?.subject ?? '').slice(0, 500);
  const from = String(body?.from ?? '').slice(0, 200);
  const to = String(body?.to ?? '').slice(0, 200);
  if (!ham.trim()) return NextResponse.json({ error: 'Boş e-posta' }, { status: 400 });

  // ── Alıcı adresinden bayi kodunu çıkar: sayac+KOD@… ya da KOD@… ──
  const kod = (to.match(/\+([a-z0-9]{4,32})@/i) ?? to.match(/^([a-z0-9]{4,32})@/i))?.[1]?.toLowerCase() ?? null;
  const bayi = kod
    ? await prisma.tenant.findFirst({
        where: { sayacEpostaKodu: kod, isActive: true, isSuspended: false, deletedAt: null },
        select: { id: true },
      })
    : null;

  // Seri araması: kod varsa O BAYİYLE sınırlı, yoksa tüm aktif bayiler.
  const cihazlar = await prisma.device.findMany({
    where: bayi
      ? { tenantId: bayi.id }
      : { tenant: { isActive: true, isSuspended: false, deletedAt: null } },
    select: { id: true, serialNo: true, reportedSerial: true, tenantId: true },
  });

  const duzMetin = htmlToText(ham);
  // Arama İKİ seriyle de yapılır: etiketteki (serialNo) ve cihazın kendi
  // maile yazdığı (reportedSerial). İkincisi bayi kuyrukta bir kez elle
  // eşleştirdiğinde öğreniliyor — o cihaz bir daha elle işlenmesin diye.
  const aranacak = [...new Set(cihazlar.flatMap((c) => [c.serialNo, c.reportedSerial]).filter(Boolean) as string[])];
  const coklu = parseCounterEmailCoklu(ham, aranacak, subject);

  // Hiç seri eşleşmedi: tek kayıt aç, elle incelensin.
  if (coklu.seriYok) {
    const tek = parseCounterEmail(duzMetin, [], subject);
    // Sistemde bulamasak bile cihazın YAZDIĞI seriyi kaydet. Eskiden null
    // yazılıyordu; bayi kuyrukta "bu hangi cihaz?" sorusunu ham metinden
    // çözmek zorunda kalıyor, sistem de hiçbir şey öğrenemiyordu. Seri
    // kayıtlıysa ekran eşleşme önerebiliyor ve tek tıkla kalıcı bağlanıyor.
    const yazilanSeriler = bildirilenSeri(ham);
    const yazilanSeri = yazilanSeriler[0] ?? null;
    const kayit = await prisma.counterEmail.create({
      data: {
        tenantId: bayi?.id ?? null,
        fromAddress: from || null, subject: subject || null,
        rawText: duzMetin.slice(0, 100_000),
        serial: yazilanSeri, deviceId: null,
        parsedBlack: tek.black, parsedColor: tek.color,
        status: 'BEKLIYOR',
        hata: kod && !bayi
          ? 'Adresteki bayi kodu tanınmadı — kod yanlış ya da bayi pasif'
          : yazilanSeri
            ? `Cihaz "${yazilanSeri}" serisini bildirdi${yazilanSeriler.length > 1 ? ` (+${yazilanSeriler.length - 1} cihaz daha)` : ''} ama bu seri sistemde yok — cihazı seçip bağlayın`
            : 'Seri numarası eşleşmedi',
      },
    });
    return NextResponse.json({
      ok: true, islenen: 0, bekleyen: 1, id: kayit.id,
      bildirilenSeri: yazilanSeri, bildirilenSeriler: yazilanSeriler, sebep: kayit.hata,
    });
  }

  // ── Raporda RENKLİ sayaç yoksa öncekini taşı ────────────────────────────
  // Filo raporlarının çoğu yalnız siyah sayacı verir. Renkli yerine 0 yazmak,
  // renkli cihazda "sayaç geriledi" demektir ve kayıt REDDEDİLİR — onlarca
  // makinesi olan firmada raporun yarısı sessizce kuyruğa düşer.
  // Bilinmeyen sayacı UYDURMUYORUZ: öncekini aynen taşıyoruz (artış 0), yani
  // okunmayan renkli sayfa hiç ücretlendirilmez. Eksik ücret, yanlış üretilmiş
  // ücretten iyidir; bir sonraki rapor farkı zaten toplar.
  const renksizSeriler = new Set(coklu.okumalar.filter((o) => o.color === null).map((o) => o.serial));
  const sonRenk = new Map<string, number>();
  if (renksizSeriler.size > 0) {
    const hedef = cihazlar.filter((c) => renksizSeriler.has(c.serialNo));
    for (const t of new Set(hedef.map((c) => c.tenantId))) {
      const harita = await sonOkumalar(t, hedef.filter((c) => c.tenantId === t).map((c) => c.id));
      for (const [id, o] of harita) sonRenk.set(id, o.counterColor);
    }
  }

  // ── Her cihaz için ayrı kayıt + ayrı okuma ──────────────────────────────
  const sonuclar: { serial: string; islendi: boolean; sebep?: string; siyah?: number | null }[] = [];
  let islenen = 0, bekleyen = 0;

  for (const okuma of coklu.okumalar) {
    const eslesen = cihazlar.filter((c) => c.serialNo === okuma.serial || c.reportedSerial === okuma.serial);
    // Aynı seri iki bayide olabilir; bayi kodu yoksa hangisi olduğu belirsizdir.
    const belirsiz = eslesen.length > 1;
    const cihaz = eslesen.length === 1 ? eslesen[0] : null;

    const hata = belirsiz
      ? 'Aynı seri birden fazla bayide bulundu — bayi kodlu adres kullanın ya da elle seçin'
      : (okuma.sebep ?? null);

    const kayit = await prisma.counterEmail.create({
      data: {
        tenantId: cihaz?.tenantId ?? bayi?.id ?? null,
        fromAddress: from || null, subject: subject || null,
        // Çok cihazlı raporda her kayda TÜM metni yazmak veritabanını
        // gereksiz şişirir; kayıt başına 20 KB yeterli, tamamı ilk kayıtta.
        rawText: (coklu.cihazSayisi > 1 ? duzMetin.slice(0, 20_000) : duzMetin.slice(0, 100_000)),
        serial: okuma.serial,
        deviceId: cihaz?.id ?? null,
        parsedBlack: okuma.black, parsedColor: okuma.color,
        status: 'BEKLIYOR',
        hata,
      },
    });

    if (!cihaz || !okuma.guvenli || belirsiz) {
      bekleyen++;
      sonuclar.push({ serial: okuma.serial, islendi: false, sebep: hata ?? 'Elle inceleme gerekiyor' });
      continue;
    }

    try {
      const r = await createReading({
        tenantId: cihaz.tenantId,
        deviceId: cihaz.id,
        counterBlack: okuma.black!,
        counterColor: okuma.color ?? sonRenk.get(cihaz.id) ?? 0,
      });
      await prisma.counterEmail.update({
        where: { id: kayit.id },
        data: { status: 'ISLENDI', readingId: r.reading.id },
      });
      islenen++;
      sonuclar.push({ serial: okuma.serial, islendi: true, siyah: okuma.black });
    } catch (e: any) {
      // En sık: sayaç önceki değerden küçük (cihaz değişmiş/sıfırlanmış).
      // Otomatik kabul edilmez — sıfırlama kararı bayinin.
      // BİR CİHAZIN HATASI DİĞERLERİNİ DURDURMAZ.
      const mesaj = e instanceof ReadingError ? e.message : (e?.message || 'Okuma kaydedilemedi');
      await prisma.counterEmail.update({
        where: { id: kayit.id },
        data: { status: 'HATA', hata: mesaj },
      });
      bekleyen++;
      sonuclar.push({ serial: okuma.serial, islendi: false, sebep: mesaj });
    }
  }

  return NextResponse.json({
    ok: true,
    bayi: bayi ? 'kodla belirlendi' : (kod ? 'kod tanınmadı' : 'kod yok — seriyle arandı'),
    yerlesim: coklu.yerlesim,
    cihazSayisi: coklu.cihazSayisi,
    islenen, bekleyen,
    sonuclar,
  });
}
