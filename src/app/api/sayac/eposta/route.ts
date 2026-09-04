import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCounterEmail, parseCounterEmailCoklu, htmlToText, bildirilenSeri } from '@/lib/counter-email';
import { createReading, ReadingError, sonOkumalar } from '@/lib/readings';
import { bayiKodAdaylari } from '@/lib/sayac-eposta';
import { ekleriMetneCevir } from '@/lib/ek-dosya';

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
  const govde = String(body?.text ?? body?.html ?? '').slice(0, 500_000);
  const subject = String(body?.subject ?? '').slice(0, 500);
  const from = String(body?.from ?? '').slice(0, 200);
  const to = String(body?.to ?? '').slice(0, 1000);

  // ── EK DOSYALAR ─────────────────────────────────────────────────────────
  // Filo yazılımları (Kyocera Fleet Services, Lexmark Fleet Manager, MPS
  // Monitor…) sayaç raporunu gövdede DEĞİL ek dosyada gönderiyor — KFS
  // varsayılan olarak ZIP'li CSV atıyor. Uç yalnız gövdeyi okurken bu
  // e-postalar SESSİZCE SIFIR okuma üretiyordu: posta geliyor, hiçbir sayaç
  // işlenmiyor, kimse fark etmiyor.
  //
  // Ek yalnızca DÜZ METNE çevrilip mevcut ayrıştırıcıya veriliyor; yeni bir
  // sayaç çıkarma mantığı yok (bkz. lib/ek-dosya).
  const ekSonuc = ekleriMetneCevir(body?.attachments ?? body?.ekler);
  const ham = [govde, ekSonuc.metin].filter((x) => x.trim()).join('\n\n').slice(0, 500_000);

  if (!ham.trim()) {
    // Gövde de ek de okunamadıysa sebebi söyle — "Boş e-posta" demek,
    // ekli bir raporu sessizce çöpe atmak olurdu.
    const sebep = ekSonuc.atlanan.length
      ? `Gövde boş ve ek okunamadı: ${ekSonuc.atlanan.map((a) => `${a.ad} (${a.sebep})`).join(', ')}`
      : 'Boş e-posta';
    return NextResponse.json({ error: sebep }, { status: 400 });
  }

  // ── Alıcı adresinden bayi kodunu çıkar: sayac+KOD@… ya da KOD@alanadi ──
  // Çıkarma kuralı adres KURMA ile aynı dosyada (lib/sayac-eposta) — ikisi
  // birbirinin tersi ve ayrı yerlerde durursa sessizce ayrışırlar.
  // Çoğul olmasının sebebi orada anlatıldı: 'to' başlığı çok alıcılıdır.
  const adaylar = bayiKodAdaylari(to);
  const bulunan = adaylar.length
    ? await prisma.tenant.findMany({
        where: { sayacEpostaKodu: { in: adaylar }, isActive: true, isSuspended: false, deletedAt: null },
        select: { id: true },
      })
    : [];
  const bayi = bulunan.length === 1 ? bulunan[0] : null;

  // ── Kod var ama bayiye çözülmüyor ────────────────────────────────────────
  // Üç şeyin AYNI ANDA doğru olması gerekiyor, üçü de zor yoldan öğrenildi:
  //
  // 1. Seri araması yayılMAZ. Eskiden çözülemeyen kodda arama tüm aktif
  //    bayilere açılıyordu; aynı şehirdeki iki bayi rakiptir ve bir müşterinin
  //    ham sayaç raporu rakibin kuyruğuna düşebiliyordu.
  // 2. Cevap 2xx OLMALI. Köprü (Apps Script) yalnız 2xx'te mesajı okundu
  //    işaretliyor; 4xx dönersek tek bir yanlış yazılmış cihaz kodu 15
  //    dakikada bir sonsuza kadar yeniden denenir ve hiçbir yerde görünmez.
  // 3. Kayıt TUTULUR. Aksi hâlde bayi cihaza kodu yanlış girdiğinde sayaçlar
  //    sessizce kaybolur — fark edildiğinde fatura çoktan kesilmiştir.
  //
  // Kayıt sahipsiz (tenantId null) açılır ve YALNIZ süper yönetici görür;
  // bkz. /api/sayac/eposta/bekleyen.
  if (adaylar.length > 0 && !bayi) {
    const sebep = bulunan.length > 1
      ? `Adres birden çok bayiye çözülüyor (${adaylar.join(', ')}) — işlenmedi`
      : `Adresteki bayi kodu tanınmadı (${adaylar.join(', ')}) — cihazın e-posta ayarını kontrol edin`;
    const tek = parseCounterEmail(htmlToText(ham), [], subject);
    await prisma.counterEmail.create({
      data: {
        tenantId: null,
        fromAddress: from || null, subject: subject || null,
        rawText: htmlToText(ham).slice(0, 100_000),
        serial: bildirilenSeri(ham)[0] ?? null, deviceId: null,
        parsedBlack: tek.black, parsedColor: tek.color,
        status: 'BEKLIYOR', hata: sebep,
      },
    });
    return NextResponse.json({ ok: true, bayi: 'kod tanınmadı', islenen: 0, bekleyen: 1, sebep });
  }

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
    // Sistemde bulamasak bile cihazın YAZDIĞI seriyi kaydet. Eskiden null
    // yazılıyordu; bayi kuyrukta "bu hangi cihaz?" sorusunu ham metinden
    // çözmek zorunda kalıyor, sistem de hiçbir şey öğrenemiyordu. Seri
    // kayıtlıysa ekran eşleşme önerebiliyor ve tek tıkla kalıcı bağlanıyor.
    const yazilanSeriler = bildirilenSeri(ham);
    const yazilanSeri = yazilanSeriler[0] ?? null;

    // ── ÇOK CİHAZLI RAPORA TEK-CİHAZ OKUYUCUSU UYGULANMAZ ──────────────
    // `parseCounterEmail(duzMetin, [], …)` BÜTÜN metni tek cihaz gibi okur.
    // Rapor çok cihazlıysa (birden fazla seri bildirilmişse) bu, A cihazının
    // serisini B cihazının sayacıyla eşleştirip kuyruğa yazıyordu; bayi
    // kuyrukta "eşleştir" dediğinde YANLIŞ sayaç kaydediliyordu.
    // Bu özellikle ilk kurulumda tehlikeli: seriler henüz sisteme girilmemişken
    // gelen ilk filo raporlarının hepsi bu yoldan geçiyor.
    //
    // Çok seri varsa sayaç DOLDURULMAZ — bayi ham metne bakıp kendi girer.
    // Eksik veri, yanlış veriden iyidir.
    const cokCihazli = yazilanSeriler.length > 1;
    const tek = cokCihazli
      ? { black: null as number | null, color: null as number | null }
      : parseCounterEmail(duzMetin, [], subject);
    const kayit = await prisma.counterEmail.create({
      data: {
        tenantId: bayi?.id ?? null,
        fromAddress: from || null, subject: subject || null,
        rawText: duzMetin.slice(0, 100_000),
        serial: yazilanSeri, deviceId: null,
        parsedBlack: tek.black, parsedColor: tek.color,
        status: 'BEKLIYOR',
        // Tanınmayan bayi kodu buraya HİÇ ulaşmaz — yukarıda 422 ile
        // reddediliyor. Buraya düşen e-postada ya kod yok ya da kod geçerli.
        hata: cokCihazli
          ? `Bu rapor ${yazilanSeriler.length} cihaz içeriyor (${yazilanSeriler.slice(0, 3).join(', ')}${yazilanSeriler.length > 3 ? '…' : ''}) ve hiçbiri sistemde kayıtlı değil. Hangi sayacın hangi cihaza ait olduğu güvenle ayrılamadığı için sayaç DOLDURULMADI — cihazların seri numaralarını girip raporu tekrar gönderin ya da sayaçları ham metinden okuyup elle yazın.`
          : yazilanSeri
            ? `Cihaz "${yazilanSeri}" serisini bildirdi ama bu seri sistemde yok — cihazı seçip bağlayın`
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
    const hedef = cihazlar.filter(
      (c) => renksizSeriler.has(c.serialNo) || (!!c.reportedSerial && renksizSeriler.has(c.reportedSerial)),
    );
    for (const t of new Set(hedef.map((c) => c.tenantId))) {
      const harita = await sonOkumalar(t, hedef.filter((c) => c.tenantId === t).map((c) => c.id));
      for (const [id, o] of harita) sonRenk.set(id, o.counterColor);
    }
  }

  // Her serinin KENDİ satırı — kayıt başına tüm raporu saklamamak için.
  // Tek geçişte kurulur; cihaz başına metin taramak 1000 cihazda karesel olurdu.
  const satirlar = new Map<string, string>();
  if (coklu.cihazSayisi > 1) {
    const seriKumesi = new Set(coklu.okumalar.map((o) => o.serial));
    for (const satir of duzMetin.split('\n')) {
      for (const s of seriKumesi) {
        if (!satirlar.has(s) && satir.includes(s)) { satirlar.set(s, satir.trim().slice(0, 500)); break; }
      }
    }
  }

  // Seri → cihaz dizini, TEK geçişte. Döngü içinde cihazlar.filter() çağırmak
  // 1000 cihazlık raporda 1.000.000 karşılaştırma demekti (karesel). Aynı seri
  // iki bayide olabildiği için değer bir DİZİ: belirsizlik korunuyor.
  const seriDizini = new Map<string, typeof cihazlar>();
  for (const c of cihazlar) {
    for (const s of [c.serialNo, c.reportedSerial]) {
      if (!s) continue;
      const mevcut = seriDizini.get(s);
      if (mevcut) { if (!mevcut.includes(c)) mevcut.push(c); } else seriDizini.set(s, [c]);
    }
  }

  // Bayi kaydı BİR KEZ çekilir ve createReading'e geçirilir. Geçirilmezse
  // fonksiyon her cihaz için aynı bayiyi yeniden sorguluyor — 1000 cihazlık
  // raporda 1000 gereksiz sorgu. (readings.ts bunun için preloadedTenant
  // parametresini taşıyor; toplu uç kullanıyordu, bu uç kullanmıyordu.)
  const bayiKaydi = bayi ? await prisma.tenant.findUnique({ where: { id: bayi.id } }) : null;

  // ── Her cihaz için ayrı kayıt + ayrı okuma ──────────────────────────────
  const sonuclar: { serial: string; islendi: boolean; sebep?: string; siyah?: number | null }[] = [];
  let islenen = 0, bekleyen = 0;
  let ilkKayit = true;

  for (const okuma of coklu.okumalar) {
    const eslesen = seriDizini.get(okuma.serial) ?? [];
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
        // Çok cihazlı raporda her kayda RAPORUN TAMAMINI yazmıyoruz.
        // 1000 cihazlı bir filoda 20 KB × 1000 = ayda 20 MB, yılda 240 MB —
        // tek müşteri için. Üstelik bayi kuyrukta o cihaza bakarken 20 KB'lık
        // raporun tamamını değil, O CİHAZIN SATIRINI görmek istiyor.
        // İlk kayıtta rapor bütün olarak durur (kanıt için), gerisinde
        // yalnız ilgili satır.
        rawText: coklu.cihazSayisi > 1
          ? (ilkKayit ? duzMetin.slice(0, 100_000) : (satirlar.get(okuma.serial) ?? okuma.serial))
          : duzMetin.slice(0, 100_000),
        serial: okuma.serial,
        deviceId: cihaz?.id ?? null,
        parsedBlack: okuma.black, parsedColor: okuma.color,
        status: 'BEKLIYOR',
        hata,
      },
    });

    ilkKayit = false;

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
        source: 'CIHAZ_EPOSTA',
      }, cihaz.tenantId === bayi?.id ? bayiKaydi : undefined);
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
    bayi: bayi ? 'kodla belirlendi' : 'kod yok — seriyle arandı',
    // Ek okunduysa hangisi, okunamadıysa NEDEN — köprü günlüğünde görünsün.
    ...(ekSonuc.okunan.length || ekSonuc.atlanan.length
      ? { ekler: { okunan: ekSonuc.okunan, atlanan: ekSonuc.atlanan } }
      : {}),
    yerlesim: coklu.yerlesim,
    cihazSayisi: coklu.cihazSayisi,
    islenen, bekleyen,
    sonuclar,
  });
}
