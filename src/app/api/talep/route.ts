// Landing formu → önce VERİTABANI, sonra (varsa) Nexus CRM.
//
// ÖNCEDEN: lead doğrudan CRM'e aktarılıyordu ve NEXUS_CRM_URL tanımlı değilse
// (CRM canlıda değil) yalnızca console.warn ile loga yazılıyordu. Konteyner logu
// dönünce lead KAYBOLUYORDU; ziyaretçi ise "gönderildi" mesajını görüyordu.
// Yani landing'den gelen her talep sessizce yok oluyordu.
//
// ARTIK: talep her koşulda Lead tablosuna yazılır. CRM aktarımı bunun ÜSTÜNE
// ek bir adımdır ve başarısız olması lead'i kaybettirmez — süper-admin'deki
// Talepler ekranından görülür. Kayıt ve CRM adımı lib/talep.ts'te: kendi
// kendine açılan deneme hesapları da (/api/kayit) aynı yoldan geçer.

import { NextResponse } from "next/server";
import { talepKaydet } from "@/lib/talep";

export async function POST(istek: Request) {
  const veri = await istek.json().catch(() => null);
  if (!veri?.telefon && !veri?.firma) {
    return NextResponse.json({ ok: false, hata: "eksik-alan" }, { status: 400 });
  }

  // bal küpü (botlar doldurur) — sessizce başarılı dön, kaydetme
  if (veri.website_hp) return NextResponse.json({ ok: true });

  // HER KOŞULDA kaydet. Bu adım başarısız olursa ziyaretçiye hata göstermeliyiz,
  // çünkü talebin gittiği başka bir yer yok. CRM hatası talebi kaybettirmez.
  try {
    await talepKaydet(veri, "landing");
  } catch (e) {
    console.error("[talep] KAYDEDİLEMEDİ:", (e as Error).message, veri);
    return NextResponse.json({ ok: false, hata: "kaydedilemedi" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
