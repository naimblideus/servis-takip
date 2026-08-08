import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCounterEmail, htmlToText } from '@/lib/counter-email';
import { createReading, ReadingError } from '@/lib/readings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sayac/eposta — cihazın gönderdiği sayaç e-postasını al ve işle.
 *
 * KAYNAK: Bu uca e-postayı ileten herhangi bir yol olabilir — Cloudflare Email
 * Routing, Mailgun/Postmark inbound, Zapier, ya da elle yapıştırma. Bu yüzden
 * bilerek SADE bir sözleşme: { subject, from, text } JSON.
 *
 * GÜVENLİK: Uç dışarıdan çağrılacağı için paylaşılan sır ZORUNLU (fail-closed).
 * SAYAC_EPOSTA_SECRET tanımlı değilse hiçbir istek kabul edilmez.
 *
 * AKIŞ:
 *  1. E-posta HER ZAMAN kaydedilir (işlense de işlenmese de kaybolmaz)
 *  2. Metinde BİLİNEN seri numarası aranır (biçimden bağımsız ters eşleştirme)
 *  3. Sayaç güvenle okunduysa createReading çağrılır — düşüş kontrolü ve dönem
 *     hesabı oradan gelir, burada tekrarlanmaz
 *  4. Okunamadıysa BEKLIYOR olarak kuyrukta kalır; ASLA tahmin edilmez
 *
 * Okuma kaydedildiği an aylık faturalama zinciri onu kendiliğinden alır
 * (billed:false olan okumalar fatura satırına dönüşür), yani muhasebeye
 * ayrıca bir şey yapmak gerekmez.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SAYAC_EPOSTA_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'SAYAC_EPOSTA_SECRET tanımlı değil — uç kapalı' }, { status: 503 });
  }
  const verilen = req.headers.get('x-sayac-secret') ?? new URL(req.url).searchParams.get('secret');
  if (verilen !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ham = String(body?.text ?? body?.html ?? '').slice(0, 200_000); // 200 KB üstü kabul etme
  const subject = String(body?.subject ?? '').slice(0, 500);
  const from = String(body?.from ?? '').slice(0, 200);
  if (!ham.trim()) return NextResponse.json({ error: 'Boş e-posta' }, { status: 400 });

  const duzMetin = htmlToText(ham);

  // Bilinen seri numaraları. Kiracı bilinmediği için TÜM cihazlar taranır —
  // e-postanın hangi bayiye ait olduğunu ancak seri söyler.
  const cihazlar = await prisma.device.findMany({
    select: { id: true, serialNo: true, tenantId: true },
  });
  const sonuc = parseCounterEmail(duzMetin, cihazlar.map((c) => c.serialNo), subject);

  const eslesen = sonuc.serial
    ? cihazlar.filter((c) => c.serialNo === sonuc.serial)
    : [];

  // Aynı seri iki farklı bayide varsa hangi cihaz olduğu belirsizdir — TAHMİN ETME.
  const belirsiz = eslesen.length > 1;
  const cihaz = eslesen.length === 1 ? eslesen[0] : null;

  const kayit = await prisma.counterEmail.create({
    data: {
      tenantId: cihaz?.tenantId ?? null,
      fromAddress: from || null,
      subject: subject || null,
      rawText: duzMetin.slice(0, 100_000),
      serial: sonuc.serial,
      deviceId: cihaz?.id ?? null,
      parsedBlack: sonuc.black,
      parsedColor: sonuc.color,
      status: 'BEKLIYOR',
      hata: belirsiz ? 'Aynı seri birden fazla bayide bulundu — elle seçilmeli' : (sonuc.sebep ?? null),
    },
  });

  if (!cihaz || !sonuc.guvenli || belirsiz) {
    return NextResponse.json({
      ok: true, islendi: false, id: kayit.id,
      sebep: kayit.hata ?? 'Elle inceleme gerekiyor',
    });
  }

  // Okumayı kaydet — düşüş kontrolü, dönem ve aşım hesabı createReading'den gelir.
  try {
    const r = await createReading({
      tenantId: cihaz.tenantId,
      deviceId: cihaz.id,
      counterBlack: sonuc.black!,
      counterColor: sonuc.color ?? 0,
    });
    await prisma.counterEmail.update({
      where: { id: kayit.id },
      data: { status: 'ISLENDI', readingId: r.reading.id },
    });
    return NextResponse.json({
      ok: true, islendi: true, id: kayit.id,
      cihaz: cihaz.serialNo, siyah: sonuc.black, renkli: sonuc.color,
      uyari: r.warning ?? null,
    });
  } catch (e: any) {
    // En sık hata: sayaç önceki değerden küçük (cihaz değişmiş ya da sayaç sıfırlanmış).
    // Bunu OTOMATİK kabul etmiyoruz — sıfırlama kararı bayinin olmalı.
    const mesaj = e instanceof ReadingError ? e.message : (e?.message || 'Okuma kaydedilemedi');
    await prisma.counterEmail.update({
      where: { id: kayit.id },
      data: { status: 'HATA', hata: mesaj },
    });
    return NextResponse.json({ ok: true, islendi: false, id: kayit.id, sebep: mesaj });
  }
}
