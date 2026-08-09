/**
 * NÖBETÇİ — sessiz arızaları yakalar.
 *
 * Uygulamanın çökmesi kolay fark edilir; asıl tehlike SESSİZ arızalardır:
 * cron durmuştur ve ay sonuna kadar fatura kesilmemiştir, WhatsApp webhook'u
 * kopmuştur ve mesajlar hiç gelmiyordur, sayaç e-postaları birikip kimse
 * bakmıyordur. Bunlar hata vermez — sadece olmaz. Bu dosya "olmayanı" arar.
 *
 * Her kontrol kendi başına başarısız olabilir; biri patlarsa diğerleri çalışır.
 */
import { prisma } from '@/lib/prisma';

export type Seviye = 'iyi' | 'uyari' | 'kritik';

export interface Kontrol {
  ad: string;
  seviye: Seviye;
  mesaj: string;
  /** İnsanın atacağı ilk adım — alarm okunduğunda ne yapılacağı belli olsun. */
  nedeni?: string;
}

const gunOnce = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Veritabanı açık mı, ne kadar yavaş? */
async function kVeritabani(): Promise<Kontrol> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    if (ms > 2000) return { ad: 'Veritabanı', seviye: 'uyari', mesaj: `Yanıt ${ms} ms — yavaş`, nedeni: 'Sunucu yükü ya da disk. Coolify kaynak grafiğine bakın.' };
    return { ad: 'Veritabanı', seviye: 'iyi', mesaj: `${ms} ms` };
  } catch (e: any) {
    return { ad: 'Veritabanı', seviye: 'kritik', mesaj: `Bağlanılamıyor: ${e?.message ?? 'bilinmeyen'}`, nedeni: 'Postgres kapalı ya da DATABASE_URL yanlış.' };
  }
}

/**
 * Aylık faturalama cron'u çalıştı mı?
 * Ayın 1'inde çalışması gerekir; 5'inden sonra hâlâ bu aya ait fatura yoksa
 * cron ölmüş demektir. Ay başında kontrol etmek yanlış alarm üretir.
 */
async function kFaturaCron(): Promise<Kontrol> {
  const bugun = new Date();
  if (bugun.getDate() < 5) return { ad: 'Aylık faturalama', seviye: 'iyi', mesaj: 'Ay başı — henüz kontrol edilmiyor' };

  const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const [aktifKiralik, buAy] = await Promise.all([
    prisma.device.count({ where: { isRental: true, tenant: { isActive: true, deletedAt: null } } }),
    prisma.customerInvoice.count({ where: { createdAt: { gte: ayBasi } } }),
  ]);
  if (aktifKiralik === 0) return { ad: 'Aylık faturalama', seviye: 'iyi', mesaj: 'Kiralık cihaz yok' };
  if (buAy === 0) {
    return {
      ad: 'Aylık faturalama', seviye: 'kritik',
      mesaj: `${aktifKiralik} kiralık cihaz var ama bu ay hiç fatura üretilmemiş`,
      nedeni: 'Coolify → Scheduled Tasks: "node run-cron.mjs faturalar" görevi çalışmıyor olabilir.',
    };
  }
  return { ad: 'Aylık faturalama', seviye: 'iyi', mesaj: `Bu ay ${buAy} fatura` };
}

/**
 * WhatsApp webhook'u hâlâ mesaj alıyor mu?
 * Meta tarafında token süresi dolduğunda ya da numara taşındığında webhook
 * SESSİZCE susar — hata log'u bile düşmez. Tek belirtisi mesajın kesilmesidir.
 */
async function kWhatsapp(): Promise<Kontrol> {
  const kurulu = await prisma.tenant.count({
    where: { whatsappPhoneId: { not: null }, isActive: true, deletedAt: null } as any,
  });
  if (kurulu === 0) return { ad: 'WhatsApp', seviye: 'iyi', mesaj: 'Kurulu bayi yok' };

  const sonMesaj = await prisma.whatsAppMessage.findFirst({
    orderBy: { receivedAt: 'desc' }, select: { receivedAt: true },
  });
  if (!sonMesaj) {
    return { ad: 'WhatsApp', seviye: 'uyari', mesaj: `${kurulu} bayide kurulu ama hiç mesaj gelmemiş`, nedeni: 'Meta → Webhooks: doğrulama ve abonelik (messages) yapıldı mı?' };
  }
  const gun = Math.floor((Date.now() - sonMesaj.receivedAt.getTime()) / 86_400_000);
  if (gun >= 7) {
    return {
      ad: 'WhatsApp', seviye: 'kritik',
      mesaj: `${gun} gündür hiç mesaj gelmiyor (${kurulu} bayide kurulu)`,
      nedeni: 'Webhook kopmuş olabilir: Meta panelinde abonelik ve WHATSAPP_APP_SECRET kontrol edin.',
    };
  }
  return { ad: 'WhatsApp', seviye: 'iyi', mesaj: `Son mesaj ${gun === 0 ? 'bugün' : `${gun} gün önce`}` };
}

/**
 * Sayaç e-postaları: geliyor mu, ve inceleme kuyruğu birikiyor mu?
 * Kuyruk sessiz bir arıza kaynağı — kimse bakmazsa faturalar eksik kesilir.
 */
async function kSayacEposta(): Promise<Kontrol> {
  const [toplam, bekleyen, sonu] = await Promise.all([
    prisma.counterEmail.count(),
    prisma.counterEmail.count({ where: { status: 'BEKLIYOR' } }),
    prisma.counterEmail.findFirst({ orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }),
  ]);
  if (toplam === 0) return { ad: 'Sayaç e-postası', seviye: 'iyi', mesaj: 'Kullanılmıyor' };

  if (sonu && sonu.receivedAt < gunOnce(14)) {
    const gun = Math.floor((Date.now() - sonu.receivedAt.getTime()) / 86_400_000);
    return { ad: 'Sayaç e-postası', seviye: 'uyari', mesaj: `${gun} gündür e-posta gelmiyor`, nedeni: 'E-posta yönlendirme (Cloudflare Email Routing) kuralı kapanmış olabilir.' };
  }
  if (bekleyen >= 25) {
    return { ad: 'Sayaç e-postası', seviye: 'uyari', mesaj: `${bekleyen} e-posta inceleme bekliyor`, nedeni: 'Panelde "Sayaç e-postaları" ekranından geçin; birikirse faturalar eksik kesilir.' };
  }
  return { ad: 'Sayaç e-postası', seviye: 'iyi', mesaj: bekleyen ? `${bekleyen} bekleyen` : 'Kuyruk temiz' };
}

/**
 * Vadesi geçen hatırlatma cron'u: bekleyen bildirim kuyruğu tıkanmış mı?
 * Kuyrukta günlerdir PENDING duran kayıt varsa gönderici çalışmıyordur.
 */
async function kBildirimKuyrugu(): Promise<Kontrol> {
  try {
    const takili = await prisma.notificationLog.count({
      where: { status: 'PENDING', createdAt: { lt: gunOnce(2) } } as any,
    });
    if (takili >= 10) {
      return { ad: 'Bildirim kuyruğu', seviye: 'uyari', mesaj: `${takili} bildirim 2 günden uzun süredir gönderilmemiş`, nedeni: 'WhatsApp/SMS anahtarları ya da şablon onayı eksik olabilir.' };
    }
    return { ad: 'Bildirim kuyruğu', seviye: 'iyi', mesaj: takili ? `${takili} bekleyen` : 'Temiz' };
  } catch {
    return { ad: 'Bildirim kuyruğu', seviye: 'iyi', mesaj: 'Kontrol edilemedi' };
  }
}

/** Denetim zinciri kopmuş mu? (kayıt sonradan değiştirilmiş olabilir) */
async function kDenetimZinciri(): Promise<Kontrol> {
  const hashsiz = await prisma.auditLog.count({ where: { hash: null } });
  const toplam = await prisma.auditLog.count();
  if (toplam === 0) return { ad: 'Denetim kaydı', seviye: 'iyi', mesaj: 'Henüz kayıt yok' };
  if (hashsiz > 0) {
    return { ad: 'Denetim kaydı', seviye: 'uyari', mesaj: `${hashsiz} kayıtta hash yok`, nedeni: 'Denetim kaydı writeAudit dışından yazılmış olabilir.' };
  }
  return { ad: 'Denetim kaydı', seviye: 'iyi', mesaj: `${toplam} kayıt` };
}

export interface NobetciSonuc {
  seviye: Seviye;
  ozet: string;
  kontroller: Kontrol[];
  zaman: string;
}

/** Tüm kontrolleri çalıştır. Bir kontrol patlarsa diğerleri etkilenmez. */
export async function nobetciCalistir(): Promise<NobetciSonuc> {
  const isler: [string, () => Promise<Kontrol>][] = [
    ['Veritabanı', kVeritabani],
    ['Aylık faturalama', kFaturaCron],
    ['WhatsApp', kWhatsapp],
    ['Sayaç e-postası', kSayacEposta],
    ['Bildirim kuyruğu', kBildirimKuyrugu],
    ['Denetim kaydı', kDenetimZinciri],
  ];

  const kontroller = await Promise.all(
    isler.map(async ([ad, fn]): Promise<Kontrol> => {
      try { return await fn(); }
      catch (e: any) { return { ad, seviye: 'uyari', mesaj: `Kontrol çalıştırılamadı: ${e?.message ?? 'bilinmeyen'}` }; }
    }),
  );

  const kritik = kontroller.filter((k) => k.seviye === 'kritik');
  const uyari = kontroller.filter((k) => k.seviye === 'uyari');
  const seviye: Seviye = kritik.length ? 'kritik' : uyari.length ? 'uyari' : 'iyi';
  const ozet = kritik.length
    ? `${kritik.length} kritik, ${uyari.length} uyarı`
    : uyari.length ? `${uyari.length} uyarı` : 'Her şey yolunda';

  return { seviye, ozet, kontroller, zaman: new Date().toISOString() };
}

/**
 * Sorun varsa haber ver. ALARM_WEBHOOK_URL tanımlı değilse sessizce geçer —
 * kurulmamış bir alarm yüzünden nöbetçinin kendisi patlamamalı.
 * Slack/Discord/n8n hepsi düz JSON `text` alanını kabul eder.
 */
export async function alarmGonder(sonuc: NobetciSonuc): Promise<'gonderildi' | 'kapali' | 'gerekmiyor' | 'hata'> {
  const url = process.env.ALARM_WEBHOOK_URL;
  if (!url) return 'kapali';
  if (sonuc.seviye === 'iyi') return 'gerekmiyor';

  const satirlar = sonuc.kontroller
    .filter((k) => k.seviye !== 'iyi')
    .map((k) => `• [${k.seviye.toUpperCase()}] ${k.ad}: ${k.mesaj}${k.nedeni ? `\n   → ${k.nedeni}` : ''}`);
  const text = `Nextus Servis nöbetçi — ${sonuc.ozet}\n${satirlar.join('\n')}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text, seviye: sonuc.seviye, kontroller: sonuc.kontroller }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok ? 'gonderildi' : 'hata';
  } catch {
    return 'hata';
  }
}
