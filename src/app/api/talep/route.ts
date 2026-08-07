// Landing formu → Nexus CRM (sunucu tarafı aktarıcı)
//
// Form doğrudan CRM'e POST atmaz: anahtar tarayıcıya düşmesin ve CORS derdi olmasın.
// NEXUS_CRM_URL tanımlı değilse istek yine 200 döner (landing akışı bozulmaz),
// sadece log'a yazılır.
//
// .env:
//   NEXUS_CRM_URL="https://crm.alanadin.com/api/lead"
//   NEXUS_CRM_TOKEN="<CRM'deki WEBHOOK_TOKEN>"

import { NextResponse } from "next/server";

export async function POST(istek: Request) {
  const veri = await istek.json().catch(() => null);
  if (!veri?.telefon && !veri?.firma) {
    return NextResponse.json({ ok: false, hata: "eksik-alan" }, { status: 400 });
  }

  // bal küpü (botlar doldurur)
  if (veri.website_hp) return NextResponse.json({ ok: true });

  const url = process.env.NEXUS_CRM_URL;
  if (!url) {
    console.warn("[talep] NEXUS_CRM_URL tanımsız — lead yalnızca log'da:", veri);
    return NextResponse.json({ ok: true, uyari: "crm-tanimsiz" });
  }

  try {
    const cevap = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nexus-token": process.env.NEXUS_CRM_TOKEN ?? "",
      },
      body: JSON.stringify({
        ad: veri.firma || veri.ad,
        telefon: veri.telefon ?? null,
        eposta: veri.eposta ?? null,
        urun: "nexus-servis",
        kaynak: "landing",
        kanal: veri.utm_source || null,
        mesaj: [veri.ad ? `Yetkili: ${veri.ad}` : null, veri.mesaj]
          .filter(Boolean)
          .join("\n"),
        utm: veri.utm_source ? `utm_source=${veri.utm_source}` : null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!cevap.ok) throw new Error(`CRM ${cevap.status}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Lead'i kaybetme: CRM ulaşılamazsa en azından log'da kalsın
    console.error("[talep] CRM'e iletilemedi:", (e as Error).message, veri);
    return NextResponse.json({ ok: true, uyari: "kuyruga-alindi" });
  }
}
