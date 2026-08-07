// Landing formu → önce VERİTABANI, sonra (varsa) Nexus CRM.
//
// ÖNCEDEN: lead doğrudan CRM'e aktarılıyordu ve NEXUS_CRM_URL tanımlı değilse
// (CRM canlıda değil) yalnızca console.warn ile loga yazılıyordu. Konteyner logu
// dönünce lead KAYBOLUYORDU; ziyaretçi ise "gönderildi" mesajını görüyordu.
// Yani landing'den gelen her talep sessizce yok oluyordu.
//
// ARTIK: talep her koşulda Lead tablosuna yazılır. CRM aktarımı bunun ÜSTÜNE
// ek bir adımdır ve başarısız olması lead'i kaybettirmez — süper-admin'deki
// Talepler ekranından görülür.
//
// .env (isteğe bağlı):
//   NEXUS_CRM_URL="https://crm.alanadin.com/api/lead"
//   NEXUS_CRM_TOKEN="<CRM'deki WEBHOOK_TOKEN>"

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Aşırı uzun alanların veritabanını şişirmesini önle (bot/kötü niyetli gönderim). */
const kirp = (v: unknown, n = 200): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, n) : null;
};

export async function POST(istek: Request) {
  const veri = await istek.json().catch(() => null);
  if (!veri?.telefon && !veri?.firma) {
    return NextResponse.json({ ok: false, hata: "eksik-alan" }, { status: 400 });
  }

  // bal küpü (botlar doldurur) — sessizce başarılı dön, kaydetme
  if (veri.website_hp) return NextResponse.json({ ok: true });

  // 1) HER KOŞULDA kaydet. Bu adım başarısız olursa ziyaretçiye hata göstermeliyiz,
  //    çünkü talebin gittiği başka bir yer yok.
  let lead;
  try {
    lead = await prisma.lead.create({
      data: {
        firma: kirp(veri.firma),
        yetkili: kirp(veri.ad ?? veri.yetkili),
        telefon: kirp(veri.telefon, 40),
        eposta: kirp(veri.eposta, 120),
        cihazSayisi: kirp(veri.cihazSayisi ?? veri.cihaz, 40),
        mesaj: kirp(veri.mesaj, 2000),
        kaynak: kirp(veri.utm_source, 80),
        kampanya: kirp(veri.utm_campaign, 120),
      },
    });
  } catch (e) {
    console.error("[talep] KAYDEDİLEMEDİ:", (e as Error).message, veri);
    return NextResponse.json({ ok: false, hata: "kaydedilemedi" }, { status: 500 });
  }

  // 2) CRM'e aktar — isteğe bağlı. Başarısızlığı ziyaretçiye yansıtmıyoruz,
  //    talep zaten kalıcı olarak kaydedildi.
  const url = process.env.NEXUS_CRM_URL;
  if (!url) return NextResponse.json({ ok: true });

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
        mesaj: [veri.ad ? `Yetkili: ${veri.ad}` : null, veri.mesaj].filter(Boolean).join("\n"),
        utm: veri.utm_source ? `utm_source=${veri.utm_source}` : null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!cevap.ok) throw new Error(`CRM ${cevap.status}`);
    await prisma.lead.update({ where: { id: lead.id }, data: { crmDurum: "aktarildi" } });
  } catch (e) {
    console.error("[talep] CRM'e iletilemedi (lead kayıtlı):", (e as Error).message);
    await prisma.lead.update({ where: { id: lead.id }, data: { crmDurum: "hata" } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
