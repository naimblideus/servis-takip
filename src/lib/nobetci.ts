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
import { hedefOzeti, parolayiGizle } from '@/lib/db-hedef';
import { diskDurumu } from '@/lib/disk-durumu';
import { statfs } from 'node:fs/promises';
import {
  kontrolAdi, kontrolMesaji, kontrolNedeni, nobetciOzeti,
  type KontrolAdi, type MesajKod, type NedenKod,
} from '@/lib/nobetci-metin';
import { sozluk, VARSAYILAN_DIL } from '@/lib/i18n/sozluk';
import { nabizDurumu, nabizOzeti, type BayiNabzi } from '@/lib/sayac-nabzi';

export type Seviye = 'iyi' | 'uyari' | 'kritik';

/**
 * Kontrolün sonucu. Cümle KURULMAZ, KOD dönülür: aynı bulguyu süper admin
 * ekranı kullanıcının dilinde, alarm webhook'u platform dilinde yazar.
 * Cümleyi nobetci-metin.ts kurar.
 */
export interface Kontrol {
  ad: KontrolAdi;
  seviye: Seviye;
  mesajKod: MesajKod;
  /** İnsanın atacağı ilk adım — alarm okunduğunda ne yapılacağı belli olsun. */
  nedenKod?: NedenKod;
}

const gunOnce = (n: number) => new Date(Date.now() - n * 86_400_000);

/**
 * Veritabanı açık mı, ne kadar yavaş — ve HANGİ veritabanı?
 *
 * "Bağlanabiliyorum" tek başına yetmiyor. İki sessiz arıza daha var:
 *
 *   BOŞ VERİTABANI — göçler çalışmış, tablolar yerinde, ama içinde tek kayıt
 *   yok. Uygulama hata vermez; ekranlar boş açılır ve veri kaybolmuş sanılır.
 *   Gerçek sebep genelde budur: DATABASE_URL başka bir veritabanını gösterir,
 *   asıl veri eski veritabanında durmaktadır.
 *
 *   YEREL ADRES — üretimde localhost, konteynerin KENDİ içidir. Veritabanı
 *   ayrı bir kaynaksa adres o kaynağın servis adı olmalıdır.
 */
async function kVeritabani(): Promise<Kontrol> {
  const hedef = hedefOzeti(process.env.DATABASE_URL);
  // Makine adı: çevrilmez, olduğu gibi gösterilir.
  const nerede = hedef ? `${hedef.veritabani} @ ${hedef.sunucu}` : '';
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    const bayi = await prisma.tenant.count();

    if (bayi === 0) {
      return {
        ad: 'VERITABANI', seviye: 'kritik',
        mesajKod: { kod: 'DB_BOS', hedef: nerede },
        nedenKod: 'DB_BOS',
      };
    }
    if (ms > 2000) {
      return { ad: 'VERITABANI', seviye: 'uyari', mesajKod: { kod: 'DB_YAVAS', ms, hedef: nerede }, nedenKod: 'DB_YAVAS' };
    }
    // Geliştirme makinesinde localhost normaldir; uyarı sadece üretimde.
    if (hedef?.yerel && process.env.NODE_ENV === 'production') {
      return {
        ad: 'VERITABANI', seviye: 'uyari',
        mesajKod: { kod: 'DB_OK', ms, bayi, hedef: nerede },
        nedenKod: 'DB_YEREL',
      };
    }
    return { ad: 'VERITABANI', seviye: 'iyi', mesajKod: { kod: 'DB_OK', ms, bayi, hedef: nerede } };
  } catch (e: any) {
    return {
      ad: 'VERITABANI', seviye: 'kritik',
      mesajKod: { kod: 'DB_YOK', hedef: nerede, hata: parolayiGizle(String(e?.message ?? '?')) },
      nedenKod: 'DB_YOK',
    };
  }
}

/**
 * Disk doldu mu?
 *
 * 4 Eylül'de sunucunun diski derleme sırasında doldu; derleme öldü, yardımcı
 * konteyner kapanmadı, Coolify "deploy sürüyor" sandı ve uygulama 12 GÜN eski
 * imajda dondu. Site çalıştığı için kimse fark etmedi — nöbetçinin tanımına
 * birebir uyan bir arıza, ama nöbetçi diske bakmıyordu.
 *
 * Konteynerin kök dosya sistemi host'un diskiyle aynı aygıtta olduğu için
 * buradan okunan değer sunucunun gerçek doluluğudur.
 */
async function kDisk(): Promise<Kontrol> {
  try {
    const s = await statfs('/');
    const d = diskDurumu(Number(s.blocks) * Number(s.bsize), Number(s.bavail) * Number(s.bsize));
    if (!d) return { ad: 'DISK', seviye: 'iyi', mesajKod: { kod: 'DISK_OLCULEMEDI' } };
    return { ad: 'DISK', seviye: d.seviye, mesajKod: d.mesajKod, nedenKod: d.nedenKod };
  } catch (e: any) {
    // statfs her ortamda yok (eski Node, bazı kumlar). Ölçemiyor olmak
    // arıza değildir; nöbetçinin kendisi bu yüzden kırmızıya dönmemeli.
    return { ad: 'DISK', seviye: 'iyi', mesajKod: { kod: 'DISK_DESTEKSIZ' } };
  }
}

/**
 * Aylık faturalama cron'u çalıştı mı?
 * Ayın 1'inde çalışması gerekir; 5'inden sonra hâlâ bu aya ait fatura yoksa
 * cron ölmüş demektir. Ay başında kontrol etmek yanlış alarm üretir.
 */
async function kFaturaCron(): Promise<Kontrol> {
  const bugun = new Date();
  if (bugun.getDate() < 5) return { ad: 'FATURA_CRON', seviye: 'iyi', mesajKod: { kod: 'FATURA_AY_BASI' } };

  const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const [aktifKiralik, buAy] = await Promise.all([
    prisma.device.count({ where: { isRental: true, tenant: { isActive: true, deletedAt: null } } }),
    prisma.customerInvoice.count({ where: { createdAt: { gte: ayBasi } } }),
  ]);
  if (aktifKiralik === 0) return { ad: 'FATURA_CRON', seviye: 'iyi', mesajKod: { kod: 'FATURA_KIRALIK_YOK' } };
  if (buAy === 0) {
    return {
      ad: 'FATURA_CRON', seviye: 'kritik',
      mesajKod: { kod: 'FATURA_URETILMEMIS', cihaz: aktifKiralik },
      nedenKod: 'FATURA_CRON',
    };
  }
  return { ad: 'FATURA_CRON', seviye: 'iyi', mesajKod: { kod: 'FATURA_ADET', adet: buAy } };
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
  if (kurulu === 0) return { ad: 'WHATSAPP', seviye: 'iyi', mesajKod: { kod: 'WA_KURULU_YOK' } };

  const sonMesaj = await prisma.whatsAppMessage.findFirst({
    orderBy: { receivedAt: 'desc' }, select: { receivedAt: true },
  });
  if (!sonMesaj) {
    return { ad: 'WHATSAPP', seviye: 'uyari', mesajKod: { kod: 'WA_HIC_MESAJ', bayi: kurulu }, nedenKod: 'WA_ABONELIK' };
  }
  const gun = Math.floor((Date.now() - sonMesaj.receivedAt.getTime()) / 86_400_000);
  if (gun >= 7) {
    return {
      ad: 'WHATSAPP', seviye: 'kritik',
      mesajKod: { kod: 'WA_SESSIZ', gun, bayi: kurulu },
      nedenKod: 'WA_WEBHOOK',
    };
  }
  return { ad: 'WHATSAPP', seviye: 'iyi', mesajKod: gun === 0 ? { kod: 'WA_SON_BUGUN' } : { kod: 'WA_SON_GUN', gun } };
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
  if (toplam === 0) return { ad: 'SAYAC_EPOSTA', seviye: 'iyi', mesajKod: { kod: 'SE_KULLANILMIYOR' } };

  if (sonu && sonu.receivedAt < gunOnce(14)) {
    const gun = Math.floor((Date.now() - sonu.receivedAt.getTime()) / 86_400_000);
    return { ad: 'SAYAC_EPOSTA', seviye: 'uyari', mesajKod: { kod: 'SE_SESSIZ', gun }, nedenKod: 'SE_YONLENDIRME' };
  }
  if (bekleyen >= 25) {
    return { ad: 'SAYAC_EPOSTA', seviye: 'uyari', mesajKod: { kod: 'SE_KUYRUK', adet: bekleyen }, nedenKod: 'SE_KUYRUK' };
  }
  return { ad: 'SAYAC_EPOSTA', seviye: 'iyi', mesajKod: bekleyen ? { kod: 'SE_BEKLEYEN', adet: bekleyen } : { kod: 'SE_TEMIZ' } };
}

/** Ritim ölçümü için geriye kaç güne bakılır. */
const HAT_PENCERESI_GUN = 180;

/**
 * Sayaç hattı: HANGİ bayiden akış kesildi?
 *
 * Yukarıdaki kSayacEposta platform geneline ve sabit 14 güne bakıyor. Bu
 * kontrol bayi bazında ve BAYİNİN KENDİ RİTMİNE göre bakar: saatte bir
 * gönderen filoyla ayda bir gönderen filo aynı eşiğe tabi tutulamaz.
 *
 * Ölçülen şey "e-posta geldi" değil "e-posta geldi VE bir cihaza bağlandı":
 * eşleşmeyen posta kuyrukta durur ve onu zaten kuyruk kontrolü yakalar.
 */
async function kSayacHatti(): Promise<Kontrol> {
  const okumalar = await prisma.counterReading.findMany({
    where: { source: 'CIHAZ_EPOSTA', createdAt: { gte: gunOnce(HAT_PENCERESI_GUN) } },
    select: { tenantId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 20000,
  });
  if (!okumalar.length) return { ad: 'SAYAC_HATTI', seviye: 'iyi', mesajKod: { kod: 'SH_KULLANILMIYOR' } };

  const damga = new Map<string, Date[]>();
  for (const o of okumalar) {
    if (!damga.has(o.tenantId)) damga.set(o.tenantId, []);
    damga.get(o.tenantId)!.push(o.createdAt);
  }

  const adlar = await prisma.tenant.findMany({
    where: { id: { in: [...damga.keys()] } },
    select: { id: true, name: true },
  });
  const ad = new Map(adlar.map((t) => [t.id, t.name]));

  const girdi: BayiNabzi[] = [...damga.entries()].map(([bayiId, damgalar]) => ({
    bayiId, bayiAd: ad.get(bayiId) ?? bayiId, damgalar,
  }));
  const sonuclar = girdi.map((b) => nabizDurumu(b, new Date()));
  const ozet = nabizOzeti(sonuclar);

  // Hepsi birden sustuysa arıza bayilerde değil ortak yolda.
  if (ozet.kopruOlu) {
    return {
      ad: 'SAYAC_HATTI', seviye: 'kritik',
      mesajKod: { kod: 'SH_KOPRU', bayi: ozet.sessiz, saat: ozet.enUzunSessizlikSaat ?? 0 },
      nedenKod: 'SH_KOPRU',
    };
  }
  if (ozet.sessiz > 0) {
    return {
      ad: 'SAYAC_HATTI', seviye: 'uyari',
      mesajKod: { kod: 'SH_SESSIZ', bayi: ozet.sessiz, toplam: ozet.ritimli, saat: ozet.enUzunSessizlikSaat ?? 0 },
      nedenKod: 'SH_BAYI',
    };
  }
  // Hiç ritimli bayi yoksa hüküm verilmez — az veriden eşik uydurulmaz.
  if (ozet.ritimli === 0) {
    return { ad: 'SAYAC_HATTI', seviye: 'iyi', mesajKod: { kod: 'SH_RITIM_YOK', bayi: ozet.ritimsiz } };
  }
  return { ad: 'SAYAC_HATTI', seviye: 'iyi', mesajKod: { kod: 'SH_AKIYOR', bayi: ozet.akiyor } };
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
      return { ad: 'BILDIRIM_KUYRUGU', seviye: 'uyari', mesajKod: { kod: 'BK_TAKILI', adet: takili }, nedenKod: 'BK_ANAHTAR' };
    }
    return { ad: 'BILDIRIM_KUYRUGU', seviye: 'iyi', mesajKod: takili ? { kod: 'BK_BEKLEYEN', adet: takili } : { kod: 'BK_TEMIZ' } };
  } catch {
    return { ad: 'BILDIRIM_KUYRUGU', seviye: 'iyi', mesajKod: { kod: 'BK_OKUNAMADI' } };
  }
}

/** Denetim zinciri kopmuş mu? (kayıt sonradan değiştirilmiş olabilir) */
async function kDenetimZinciri(): Promise<Kontrol> {
  const hashsiz = await prisma.auditLog.count({ where: { hash: null } });
  const toplam = await prisma.auditLog.count();
  if (toplam === 0) return { ad: 'DENETIM_KAYDI', seviye: 'iyi', mesajKod: { kod: 'DZ_KAYIT_YOK' } };
  if (hashsiz > 0) {
    return { ad: 'DENETIM_KAYDI', seviye: 'uyari', mesajKod: { kod: 'DZ_HASHSIZ', adet: hashsiz }, nedenKod: 'DZ_HASHSIZ' };
  }
  return { ad: 'DENETIM_KAYDI', seviye: 'iyi', mesajKod: { kod: 'DZ_ADET', adet: toplam } };
}

export interface NobetciSonuc {
  seviye: Seviye;
  /** Platform dilinde özet — alarm ve cron kaydı için. Ekran kendi dilinde kurar. */
  ozet: string;
  kritikSayisi: number;
  uyariSayisi: number;
  kontroller: Kontrol[];
  zaman: string;
}

/** Tüm kontrolleri çalıştır. Bir kontrol patlarsa diğerleri etkilenmez. */
export async function nobetciCalistir(): Promise<NobetciSonuc> {
  const isler: [KontrolAdi, () => Promise<Kontrol>][] = [
    ['VERITABANI', kVeritabani],
    ['DISK', kDisk],
    ['FATURA_CRON', kFaturaCron],
    ['WHATSAPP', kWhatsapp],
    ['SAYAC_EPOSTA', kSayacEposta],
    ['SAYAC_HATTI', kSayacHatti],
    ['BILDIRIM_KUYRUGU', kBildirimKuyrugu],
    ['DENETIM_KAYDI', kDenetimZinciri],
  ];

  const kontroller = await Promise.all(
    isler.map(async ([ad, fn]): Promise<Kontrol> => {
      try { return await fn(); }
      catch (e: any) { return { ad, seviye: 'uyari', mesajKod: { kod: 'KONTROL_PATLADI', hata: String(e?.message ?? '?') } }; }
    }),
  );

  const kritik = kontroller.filter((k) => k.seviye === 'kritik');
  const uyari = kontroller.filter((k) => k.seviye === 'uyari');
  const seviye: Seviye = kritik.length ? 'kritik' : uyari.length ? 'uyari' : 'iyi';
  // Özet burada PLATFORM dilinde kuruluyor: alarmı ve cron kaydını okuyan
  // sunucu tarafıdır. Ekran aynı işlevi kendi diliyle yeniden çağırır.
  const ozet = nobetciOzeti(sozluk(VARSAYILAN_DIL), kritik.length, uyari.length);

  return {
    seviye,
    ozet,
    kritikSayisi: kritik.length,
    uyariSayisi: uyari.length,
    kontroller,
    zaman: new Date().toISOString(),
  };
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

  // Alarm sunucudan gidiyor: okuyan platform sahibidir, platform dili kullanılır.
  const sz = sozluk(VARSAYILAN_DIL);
  const satirlar = sonuc.kontroller
    .filter((k) => k.seviye !== 'iyi')
    .map((k) => {
      const neden = kontrolNedeni(sz, k.nedenKod);
      return `• [${k.seviye.toUpperCase()}] ${kontrolAdi(sz, k.ad)}: ${kontrolMesaji(sz, k.mesajKod)}${neden ? `\n   → ${neden}` : ''}`;
    });
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
