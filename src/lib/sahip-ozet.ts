/**
 * GÜNLÜK ÖZET — platform sahibine her sabah: bugün kimi aramalı.
 *
 * Deneme hesabı açmak artık kolay (/kayit); zor olan, açılan hesabın veriyi
 * yükleyip kullanmaya başlaması. Yardım edilmeyen deneme sessizce ölür. Bu
 * özet, Talepler ve bayi ekranlarına bakmadan aynı soruyu cevaplar:
 *   · son 24 saatte açılan deneme hesapları,
 *   · iki gündür hiç veri yüklemeyenler (kurulumda yardım),
 *   · denemesi 3 gün içinde bitenler (paket ve ödeme),
 *   · denemesi bitip hâlâ ödemeyenler (son 7 gün),
 *   · siteden gelen talepler.
 * Demo hesapları sayılmaz. Hepsi boşsa e-posta gitmez.
 */
import { prisma } from '@/lib/prisma';
import { sahibeEposta, siteAdresi, whatsappBaglantisi } from '@/lib/sahip-bildirim';

const GUN = 86_400_000;
const tarih = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

export interface DenemeSatiri {
  firma: string;
  il: string | null;
  telefon: string | null;
  musteri: number;
  cihaz: number;
  acildi: Date;
  bitis: Date | null;
}

export interface GunlukOzet {
  yeni: DenemeSatiri[];
  bekleyen: DenemeSatiri[];
  bitecek: DenemeSatiri[];
  biten: DenemeSatiri[];
  talepler: { firma: string | null; telefon: string | null; mesaj: string | null }[];
  bos: boolean;
}

export async function gunlukOzet(simdi = new Date()): Promise<GunlukOzet> {
  const t = simdi.getTime();
  const denemeler = await prisma.tenant.findMany({
    where: { plan: 'trial', demo: false, deletedAt: null, isActive: true },
    select: { id: true, name: true, city: true, phone: true, createdAt: true, trialEndsAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const ids = denemeler.map((d) => d.id);
  const [musteri, cihaz, talepler] = await Promise.all([
    ids.length ? prisma.customer.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? prisma.device.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _count: { _all: true } }) : [],
    // Kendi kendine kayıtlar (kaynak 'kayit') zaten "yeni deneme hesabı" bölümünde.
    prisma.lead.findMany({
      where: { createdAt: { gte: new Date(t - GUN) }, OR: [{ kaynak: null }, { kaynak: { not: 'kayit' } }] },
      select: { firma: true, telefon: true, mesaj: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const mSay = new Map(musteri.map((x) => [x.tenantId, x._count._all]));
  const cSay = new Map(cihaz.map((x) => [x.tenantId, x._count._all]));
  const satirlar: DenemeSatiri[] = denemeler.map((d) => ({
    firma: d.name, il: d.city, telefon: d.phone,
    musteri: mSay.get(d.id) ?? 0, cihaz: cSay.get(d.id) ?? 0,
    acildi: d.createdAt, bitis: d.trialEndsAt,
  }));
  const bitti = (s: DenemeSatiri) => s.bitis !== null && s.bitis.getTime() <= t;

  const yeni = satirlar.filter((s) => t - s.acildi.getTime() < GUN);
  const bekleyen = satirlar.filter((s) => t - s.acildi.getTime() >= 2 * GUN && !bitti(s) && s.musteri === 0 && s.cihaz === 0);
  const bitecek = satirlar.filter((s) => s.bitis !== null && s.bitis.getTime() > t && s.bitis.getTime() - t <= 3 * GUN);
  const biten = satirlar.filter((s) => s.bitis !== null && bitti(s) && t - s.bitis.getTime() <= 7 * GUN);
  return {
    yeni, bekleyen, bitecek, biten, talepler,
    bos: !yeni.length && !bekleyen.length && !bitecek.length && !biten.length && !talepler.length,
  };
}

function bayiSatiri(s: DenemeSatiri, ek?: string): string[] {
  const wa = whatsappBaglantisi(s.telefon);
  return [
    `• ${s.firma}${s.il ? ` · ${s.il}` : ''}${s.telefon ? ` · ${s.telefon}` : ''} · müşteri ${s.musteri}, cihaz ${s.cihaz}${ek ? ` · ${ek}` : ''}`,
    wa ? `  WhatsApp: ${wa}` : null,
  ].filter((x): x is string => x !== null);
}

/** Konu ve gövde. Sayılar konuda: e-postayı açmadan ne kadar iş var görülsün. */
export function ozetMetni(o: GunlukOzet): { konu: string; satirlar: string[] } {
  const parca = [
    o.yeni.length ? `${o.yeni.length} yeni hesap` : null,
    o.bekleyen.length ? `${o.bekleyen.length} aranacak` : null,
    o.bitecek.length ? `${o.bitecek.length} denemesi bitiyor` : null,
    o.biten.length ? `${o.biten.length} ödeme bekliyor` : null,
    o.talepler.length ? `${o.talepler.length} talep` : null,
  ].filter(Boolean);
  const satirlar: string[] = ['Günaydın. Bugün aranacaklar:', ''];
  const bolum = (baslik: string, not: string | null, liste: string[]) => {
    if (!liste.length) return;
    satirlar.push(baslik + (not ? ` — ${not}` : ''), ...liste, '');
  };
  bolum(`YENİ DENEME HESAPLARI (${o.yeni.length})`, 'bugün arayın', o.yeni.flatMap((s) => bayiSatiri(s)));
  bolum(`VERİ YÜKLEMEDEN BEKLEYENLER (${o.bekleyen.length})`, '2+ gündür boş: kurulumda yardım edin',
    o.bekleyen.flatMap((s) => bayiSatiri(s, `${tarih.format(s.acildi)}'den beri`)));
  bolum(`DENEMESİ 3 GÜN İÇİNDE BİTENLER (${o.bitecek.length})`, 'paket ve ödeme konuşun',
    o.bitecek.flatMap((s) => bayiSatiri(s, `bitiş ${tarih.format(s.bitis as Date)}`)));
  bolum(`DENEMESİ BİTEN, ÖDEME YAPMAYANLAR (${o.biten.length})`, 'kaybetmeden arayın',
    o.biten.flatMap((s) => bayiSatiri(s, `${tarih.format(s.bitis as Date)}'de bitti`)));
  bolum(`SİTEDEN GELEN TALEPLER (${o.talepler.length})`, null, o.talepler.map((l) =>
    `• ${l.firma ?? 'Adsız'}${l.telefon ? ` · ${l.telefon}` : ''}${l.mesaj ? ` · ${l.mesaj.replace(/\s+/g, ' ').slice(0, 90)}` : ''}`));
  satirlar.push(`Bayiler: ${siteAdresi()}/super-admin/tenants`, `Talepler: ${siteAdresi()}/super-admin/talepler`);
  return { konu: `Günlük özet: ${parca.join(' · ')}`, satirlar };
}

/** Zamanlayıcının çağırdığı iş: özet boş değilse gönderir. */
export async function ozetiGonder(simdi = new Date()) {
  const o = await gunlukOzet(simdi);
  const sayilar = { yeni: o.yeni.length, bekleyen: o.bekleyen.length, bitecek: o.bitecek.length, biten: o.biten.length, talep: o.talepler.length };
  if (o.bos) return { gonderim: 'bos' as const, sayilar };
  const { konu, satirlar } = ozetMetni(o);
  return { gonderim: await sahibeEposta(konu, satirlar), sayilar };
}
