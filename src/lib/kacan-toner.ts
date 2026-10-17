/**
 * KAÇAN TONER — müşteri toneri başka yerden aldı.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Bayinin parası makinede değil tonerde: makineyi bir kez satar, toneri
 * yıllarca. Müşteri toneri internetten ya da başka bir bayiden alınca bayi
 * bunu hiç bilmez; kayıp sessizdir. Ağ tarayıcı ise makinenin toner
 * seviyesinin bitmeye yakından doluya sıçradığını görüyor (TonerChange,
 * source TARAYICI). Bayi o toneri vermediyse ortada kaçan bir satış var.
 *
 * ── "BAYİ VERDİ" SAYILANLAR (hiçbiri yoksa kaçan) ────────────────────────
 * O makinedeki BİR ÖNCEKİ değişimden sonra (en fazla 60 gün geriye) ile bu
 * değişimden 7 gün sonrası arasında:
 *   · o makineye toner sevki (TonerSevki, iptal değil),
 *   · o makinenin servis fişinde toner/mürekkep grubundan parça,
 *   · o müşteriye cariden toner satışı (ürün adında toner/kartuş/mürekkep
 *     geçen ya da bayinin toner kartlarından biriyle aynı adlı satır),
 *   · tarayıcının kaydına fişle parça bağlanmış olması (partId),
 *   · bayinin "bizden aldı, kaydı eksikti" işareti (bizdenAlindi),
 *   · değişimin emanetten düşülmesi (EmanetHareketi.tonerChangeId) ya da
 *     değişimden HEMEN ÖNCE müşterinin rafında bayinin bıraktığı toner
 *     olması (emanet bakiyesi > 0). Rafta yedek dururken görülen değişim
 *     büyük olasılıkla o yedektir; hangi kalem olduğu belirsiz diye
 *     emanetten düşülmemiş olsa bile "kaçırdın" denmez. Bilerek gevşek:
 *     rafta başka modelin toneri dururken gerçekten dışarıdan alınmış bir
 *     toner görünmeyebilir — haksız suçlamadan iyidir.
 * Önceki değişimden ÖNCEKİ toner sayılmaz: o toner o değişimde takıldı ve
 * tüketildi (fişle takılan toner kendi değişim kaydını zaten açar). Yoksa
 * bir ay önce fişle toner takılan her makinede sonraki kaçak hiç görünmezdi.
 * Pencere bunun dışında geniş: bayiye haksız bir "kaçırdın" listesi
 * göstermek, hiç göstermemekten kötüdür. Yeni (7 günden genç) değişim
 * sayılmaz: bayinin fişi girmesi için zaman tanınır.
 *
 * ── TUTAR ────────────────────────────────────────────────────────────────
 * O makineye en son takılan toner kartının satış fiyatı; yoksa aynı
 * marka/modelde bayinin en son taktığı tonerin fiyatı. Bilinmiyorsa tutar
 * yazılmaz (uydurulmaz), adet yine sayılır.
 */
import { prisma } from '@/lib/prisma';

const GUN = 86_400_000;
export const ONCE_GUN = 60;
export const SONRA_GUN = 7;
export const GERIYE_GUN = 120;
const TONER_ADI = /toner|kartu[sş]|cartridge|m[üu]rekkep|\bink\b/i;
const TONER_GRUPLARI = ['TONER', 'INK'];

export interface KacanToner {
  id: string;
  deviceId: string;
  cihaz: string;
  seri: string;
  musteri: { id: string; name: string; phone: string | null } | null;
  tarih: string;
  not: string | null;
  tutar: number | null;
  parca: string | null;
}

/**
 * Saf karar: bu değişim için bayinin verdiğine dair kanıt var mı.
 * `onceki`: aynı makinedeki bir önceki değişimin anı (yoksa null). Kanıt
 * ondan SONRA olmalı (aynı gün dahil değil: o günkü fiş o değişimindir).
 */
export function bayiVerdiMi(
  degisim: { changedAt: Date; deviceId: string; customerId: string | null; onceki: Date | null; id?: string },
  kanit: {
    sevk: Map<string, Date[]>; fis: Map<string, Date[]>; satis: Map<string, Date[]>;
    /** Emanetten düşülmüş değişimler (EmanetHareketi.tonerChangeId). */
    emanetTuketim?: Set<string>;
    /** Müşteri → emanet satırları (yalnız toner kalemleri; işaretli adet). */
    emanet?: Map<string, { tarih: Date; adet: number }[]>;
  },
): boolean {
  if (degisim.id !== undefined && kanit.emanetTuketim?.has(degisim.id)) return true;
  if (degisim.customerId !== null && raftaVardi(kanit.emanet?.get(degisim.customerId), degisim.changedAt)) return true;
  const enGeri = degisim.changedAt.getTime() - ONCE_GUN * GUN;
  const bas = degisim.onceki ? Math.max(enGeri, degisim.onceki.getTime() + GUN) : enGeri;
  const son = degisim.changedAt.getTime() + SONRA_GUN * GUN;
  const icinde = (l: Date[] | undefined) => (l ?? []).some((d) => d.getTime() >= bas && d.getTime() <= son);
  return icinde(kanit.sevk.get(degisim.deviceId)) || icinde(kanit.fis.get(degisim.deviceId))
    || (degisim.customerId !== null && icinde(kanit.satis.get(degisim.customerId)));
}

const ekle = (m: Map<string, Date[]>, k: string, d: Date) => { const l = m.get(k); if (l) l.push(d); else m.set(k, [d]); };

/** Değişimden hemen önce rafta bayinin bıraktığı toner var mıydı (o ana kadarki Σ adet > 0)? */
export function raftaVardi(satirlar: readonly { tarih: Date; adet: number }[] | undefined, an: Date): boolean {
  if (!satirlar) return false;
  let n = 0;
  for (const s of satirlar) if (s.tarih.getTime() < an.getTime()) n += s.adet;
  return n > 0;
}

export async function kacanTonerler(tenantId: string, simdi = new Date()): Promise<{
  kayitlar: KacanToner[]; adet: number; tutar: number; izlenenCihaz: number;
  /** İlk tarayıcı ölçümünden bu yana gün; tarayıcı yeniyse "görülmedi" iddiası kurulmaz. */
  izlemeGun: number | null;
}> {
  const enEski = new Date(simdi.getTime() - GERIYE_GUN * GUN);
  const enYeni = new Date(simdi.getTime() - SONRA_GUN * GUN);
  const izlenenCihaz = await prisma.device.count({ where: { tenantId, olcumAt: { gte: new Date(simdi.getTime() - 30 * GUN) } } });
  const ilkTarama = await prisma.sayacTaramasi.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }).catch(() => null);
  const izlemeGun = ilkTarama ? Math.floor((simdi.getTime() - ilkTarama.createdAt.getTime()) / GUN) : null;

  const adaylar = await prisma.tonerChange.findMany({
    where: { tenantId, source: 'TARAYICI', partId: null, bizdenAlindi: false, changedAt: { gte: enEski, lte: enYeni } },
    orderBy: { changedAt: 'desc' },
    include: { device: { select: { id: true, brand: true, model: true, serialNo: true, customer: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!adaylar.length) return { kayitlar: [], adet: 0, tutar: 0, izlenenCihaz, izlemeGun };

  const cihazlar = [...new Set(adaylar.map((a) => a.deviceId))];
  const musteriler = [...new Set(adaylar.map((a) => a.device.customer?.id).filter((x): x is string => !!x))];
  const pencereBas = new Date(enEski.getTime() - ONCE_GUN * GUN);

  const [sevkler, fisParcalari, satislar, tonerKartlari, emanetler] = await Promise.all([
    prisma.tonerSevki.findMany({ where: { tenantId, deviceId: { in: cihazlar }, durum: { not: 'IPTAL' }, gonderildiAt: { gte: pencereBas } }, select: { deviceId: true, gonderildiAt: true } }),
    prisma.ticketPart.findMany({
      where: { tenantId, createdAt: { gte: pencereBas }, part: { group: { in: TONER_GRUPLARI } }, ticket: { deviceId: { in: cihazlar }, deletedAt: null } },
      select: { createdAt: true, ticket: { select: { deviceId: true } } },
    }),
    prisma.accountEntry.findMany({ where: { tenantId, type: 'SALE', customerId: { in: musteriler }, date: { gte: pencereBas } }, select: { customerId: true, date: true, product: true } }),
    prisma.part.findMany({ where: { tenantId, group: { in: TONER_GRUPLARI } }, select: { name: true } }),
    // Emanet defteri yoksa (eski kurulum) kaçan toner ekranı yine çalışsın.
    prisma.emanetHareketi.findMany({
      where: { tenantId, customerId: { in: musteriler } },
      select: { customerId: true, adet: true, tarih: true, tonerChangeId: true, parcaAdi: true, part: { select: { group: true } } },
    }).catch(() => []),
  ]);
  const kartAdlari = new Set(tonerKartlari.map((p) => p.name.trim().toLowerCase()));
  const kanit = {
    sevk: new Map<string, Date[]>(), fis: new Map<string, Date[]>(), satis: new Map<string, Date[]>(),
    emanetTuketim: new Set<string>(), emanet: new Map<string, { tarih: Date; adet: number }[]>(),
  };
  for (const e of emanetler) {
    if (e.tonerChangeId) kanit.emanetTuketim.add(e.tonerChangeId);
    // Grubu belli kalemde gruba, değilse ada bakılır: rafta duran drum toner sayılmaz.
    const toner = e.part?.group ? TONER_GRUPLARI.includes(e.part.group) : TONER_ADI.test(e.parcaAdi);
    if (!toner) continue;
    const l = kanit.emanet.get(e.customerId);
    if (l) l.push({ tarih: e.tarih, adet: e.adet }); else kanit.emanet.set(e.customerId, [{ tarih: e.tarih, adet: e.adet }]);
  }
  for (const s of sevkler) ekle(kanit.sevk, s.deviceId, s.gonderildiAt);
  for (const f of fisParcalari) ekle(kanit.fis, f.ticket.deviceId, f.createdAt);
  for (const s of satislar) {
    const ad = (s.product ?? '').trim();
    // "Kyocera TK-1170 Toner ×2" → kart adıyla karşılaştırmadan önce adedi at.
    const kartAdi = ad.replace(/\s*×\d+$/, '').toLowerCase();
    if (TONER_ADI.test(ad) || kartAdlari.has(kartAdi)) ekle(kanit.satis, s.customerId, s.date);
  }

  // Her adayın aynı makinede (aynı kanalda) bir önceki değişimi.
  const tumDegisimler = await prisma.tonerChange.findMany({
    where: { tenantId, deviceId: { in: cihazlar }, changedAt: { gte: pencereBas } },
    select: { id: true, deviceId: true, channel: true, changedAt: true },
  });
  const onceki = (a: { id: string; deviceId: string; channel: string; changedAt: Date }): Date | null => {
    let en: Date | null = null;
    for (const d of tumDegisimler) {
      if (d.id === a.id || d.deviceId !== a.deviceId || d.channel !== a.channel || d.changedAt >= a.changedAt) continue;
      if (!en || d.changedAt > en) en = d.changedAt;
    }
    return en;
  };
  const kacanlar = adaylar.filter((a) => !bayiVerdiMi({ id: a.id, changedAt: a.changedAt, deviceId: a.deviceId, customerId: a.device.customer?.id ?? null, onceki: onceki(a) }, kanit));
  if (!kacanlar.length) return { kayitlar: [], adet: 0, tutar: 0, izlenenCihaz, izlemeGun };

  // Tutar: o makineye en son takılan toner; yoksa aynı modelde en son takılan.
  const takilanlar = await prisma.tonerChange.findMany({
    where: { tenantId, partId: { not: null }, channel: 'BLACK' },
    orderBy: { changedAt: 'desc' },
    select: { deviceId: true, device: { select: { brand: true, model: true } }, partId: true },
    take: 2000,
  });
  const parcaIdleri = [...new Set(takilanlar.map((t) => t.partId!).filter(Boolean))];
  const parcalar = new Map((await prisma.part.findMany({ where: { tenantId, id: { in: parcaIdleri } }, select: { id: true, name: true, sellPrice: true } }))
    .map((p) => [p.id, { ad: p.name, fiyat: Number(p.sellPrice) }]));
  const cihazinParcasi = new Map<string, string>();
  const modelinParcasi = new Map<string, string>();
  for (const t of takilanlar) {
    if (!cihazinParcasi.has(t.deviceId)) cihazinParcasi.set(t.deviceId, t.partId!);
    const mk = `${t.device.brand}|${t.device.model}`.toLowerCase();
    if (!modelinParcasi.has(mk)) modelinParcasi.set(mk, t.partId!);
  }

  const kayitlar: KacanToner[] = kacanlar.map((a) => {
    const pid = cihazinParcasi.get(a.deviceId) ?? modelinParcasi.get(`${a.device.brand}|${a.device.model}`.toLowerCase());
    const p = pid ? parcalar.get(pid) : undefined;
    return {
      id: a.id,
      deviceId: a.deviceId,
      cihaz: `${a.device.brand} ${a.device.model}`.trim(),
      seri: a.device.serialNo,
      musteri: a.device.customer ? { id: a.device.customer.id, name: a.device.customer.name, phone: a.device.customer.phone ?? null } : null,
      tarih: a.changedAt.toISOString(),
      not: a.note,
      tutar: p && p.fiyat > 0 ? p.fiyat : null,
      parca: p?.ad ?? null,
    };
  });
  const tutar = Math.round(kayitlar.reduce((t, k) => t + (k.tutar ?? 0), 0) * 100) / 100;
  return { kayitlar, adet: kayitlar.length, tutar, izlenenCihaz, izlemeGun };
}
