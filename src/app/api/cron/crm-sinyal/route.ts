// NEXUS CRM — servis-takip → CRM kullanım sinyali (GÜNLÜK CRON)
//
// Kopyala:  servis-takip/src/app/api/cron/crm-sinyal/route.ts
//
// NEDEN CRON, NEDEN İŞ MANTIĞININ İÇİNE ÇAĞRI DEĞİL:
// servis-takip canlıda ve fatura kesiyor. Fatura/servis yazma yollarına CRM çağrısı
// sokmak, CRM yavaşladığında veya çöktüğünde müşterinin faturasını riske atar.
// Bu dosya hiçbir mevcut koda dokunmaz: günde bir kez çalışır, her tenant'ın MEVCUT
// durumunu okur ve CRM'e bildirir. Mükerrerliği CRM eler (anahtar alanı), o yüzden
// burada "gönderdim mi" durumu tutmaya, tabloya kolon eklemeye gerek yok.
//
// İKİ İŞ YAPAR:
//   1) CRM'e ulaşamamış landing taleplerini tekrar dener (Lead.crmDurum != aktarildi)
//   2) Her kiracının kullanım durumunu CRM'e sinyal olarak bildirir
//
// .env (servis-takip):
//   NEXUS_CRM_URL="https://crm.alanadin.com/api/lead"    (bekleyen talepler için)
//   NEXUS_CRM_OLAY="https://crm.alanadin.com/api/olay"   (kullanım sinyalleri için)
//   NEXUS_CRM_TOKEN="<CRM'deki WEBHOOK_TOKEN>"
//
// Çalıştırma: Coolify/Vercel cron → GET /api/cron/crm-sinyal?secret=$CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED
  const header = req.headers.get("authorization");
  const qp = new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || qp === secret;
}

type Sinyal = {
  tur: "DENEME_BASLADI" | "ILK_KAYIT" | "FATURA_KESILDI" | "LIMIT_DOLDU" | "GIRIS_YOK";
  baslik: string;
  detay?: string;
  anahtar: string; // mükerrer koruma — CRM aynı anahtarı ikinci kez işlemez
};

async function crmYolla(telefon: string, s: Sinyal) {
  const url = process.env.NEXUS_CRM_OLAY;
  if (!url) return false;
  try {
    const cevap = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nexus-token": process.env.NEXUS_CRM_TOKEN ?? "",
      },
      body: JSON.stringify({ urun: "nexus-servis", telefon, ...s }),
      signal: AbortSignal.timeout(8000),
    });
    return cevap.ok;
  } catch {
    return false; // CRM kapalıysa cron sessizce geçer, bir dahaki gün tekrar dener
  }
}

/**
 * Landing'den gelmiş ama CRM'e ULAŞMAMIŞ talepleri tekrar dener.
 *
 * /api/talep lead'i her koşulda Lead tablosuna yazar; CRM kapalıysa ya da
 * NEXUS_CRM_URL o an tanımsızsa crmDurum "bekliyor"/"hata" olarak kalır.
 * Bu adım olmasaydı o lead'ler orada sonsuza kadar takılı kalırdı.
 */
async function bekleyenTalepleriAktar() {
  const url = process.env.NEXUS_CRM_URL;
  if (!url) return { denenen: 0, aktarilan: 0 };

  const bekleyenler = await prisma.lead.findMany({
    where: { crmDurum: { in: ["bekliyor", "hata"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let aktarilan = 0;
  for (const l of bekleyenler) {
    if (!l.telefon && !l.firma) continue; // eşleşecek bilgi yok
    try {
      const cevap = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nexus-token": process.env.NEXUS_CRM_TOKEN ?? "",
        },
        body: JSON.stringify({
          ad: l.firma || l.yetkili,
          telefon: l.telefon,
          eposta: l.eposta,
          urun: "nexus-servis",
          kaynak: "landing",
          kanal: l.kaynak,
          mesaj: [
            l.yetkili ? `Yetkili: ${l.yetkili}` : null,
            l.cihazSayisi ? `Cihaz: ${l.cihazSayisi}` : null,
            l.mesaj,
          ]
            .filter(Boolean)
            .join("\n"),
          utm: l.kaynak ? `utm_source=${l.kaynak}` : null,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!cevap.ok) throw new Error(`CRM ${cevap.status}`);
      await prisma.lead.update({
        where: { id: l.id },
        data: { crmDurum: "aktarildi" },
      });
      aktarilan++;
    } catch {
      // bir dahaki gün tekrar denenir; lead kaybolmaz
    }
  }
  return { denenen: bekleyenler.length, aktarilan };
}

async function run() {
  const talepler = await bekleyenTalepleriAktar();

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, isActive: true, phone: { not: null } },
    select: { id: true, name: true, phone: true, createdAt: true },
  });

  let gonderilen = 0;

  for (const t of tenants) {
    const [devices, tickets, invoices, sonGiris] = await Promise.all([
      prisma.device.count({ where: { tenantId: t.id } }),
      prisma.serviceTicket.count({ where: { tenantId: t.id } }),
      prisma.customerInvoice.count({ where: { tenantId: t.id, deletedAt: null } }),
      prisma.user.findFirst({
        where: { tenantId: t.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    const sinyaller: Sinyal[] = [];

    // Hesap açıldı ama henüz veri yok → deneme başladı
    if (devices === 0 && tickets === 0) {
      sinyaller.push({
        tur: "DENEME_BASLADI",
        baslik: "Hesap açıldı, henüz veri girilmedi",
        anahtar: `DENEME_BASLADI:${t.id}`,
      });
    }

    // ⭐ Aktivasyon: ilk gerçek servis kaydı girildi
    if (tickets > 0) {
      sinyaller.push({
        tur: "ILK_KAYIT",
        baslik: "İlk servis kaydını girdi",
        detay: `${tickets} servis kaydı · ${devices} cihaz`,
        anahtar: `ILK_KAYIT:${t.id}`,
      });
    }

    // Gerçekten kullanıyor: fatura kesmiş
    if (invoices > 0) {
      sinyaller.push({
        tur: "FATURA_KESILDI",
        baslik: "İlk faturasını kesti",
        detay: `${invoices} fatura`,
        anahtar: `FATURA_KESILDI:${t.id}`,
      });
    }

    // Paket limiti: cihaz başına ücretlendirme — 20/25/100 dahil cihaz
    // Kendi paket eşiğine göre ayarla; burada Başlangıç (20) örneklendi.
    const LIMIT = 20;
    if (devices >= LIMIT) {
      sinyaller.push({
        tur: "LIMIT_DOLDU",
        baslik: "Paket cihaz limitine dayandı",
        detay: `${devices} cihaz (paket ${LIMIT})`,
        // ay bazlı anahtar: her ay yeniden hatırlatsın
        anahtar: `LIMIT_DOLDU:${t.id}:${new Date().toISOString().slice(0, 7)}`,
      });
    }

    // 14 gündür kimse girmemiş → soğuma riski (haftalık tekrar hatırlatır)
    const ikiHafta = Date.now() - 14 * 86400000;
    if (sonGiris && sonGiris.updatedAt.getTime() < ikiHafta && tickets > 0) {
      const hafta = Math.floor(Date.now() / (7 * 86400000));
      sinyaller.push({
        tur: "GIRIS_YOK",
        baslik: "14 gündür giriş yok",
        detay: `${t.name} soğuyor`,
        anahtar: `GIRIS_YOK:${t.id}:${hafta}`,
      });
    }

    for (const s of sinyaller) {
      if (await crmYolla(t.phone!, s)) gonderilen++;
    }
  }

  return { tenants: tenants.length, gonderilen, talepler };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
