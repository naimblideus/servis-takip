// BASKI DOSYASI — veritabanı ve R2 tarafı. Kurallar saf dosyada (lib/baski-dosya).
// Bütün sorgular kiracıya kapsamlı: her birinde tenantId.
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isDurumu } from '@/lib/baski-is';
import {
  gorunenAd, INDIRME_SANIYE, nesneAnahtari, PARCA_BOYU, PARCA_SANIYE, parcalarTam, parcaSayisi, saklamaDoldu, yuklemeGecerli,
  type DosyaHatasi,
} from '@/lib/baski-dosya';
import { indirmeAdresi, nesneSil, parcaAdresi, parcalariOku, r2Ayari, yuklemeBaslat, yuklemeBitir, yuklemeIptal } from '@/lib/r2';
import { saklamaGunu } from '@/lib/matbaa-ayar';
import { provaAc } from '@/lib/baski-prova';

export type DosyaIslemHatasi = DosyaHatasi | 'DOSYA_KAPALI' | 'IS_YOK' | 'DOSYA_YOK' | 'YUKLEME_HATASI' | 'YUKLEME_EKSIK';
type Hata = { ok: false; kod: DosyaIslemHatasi };
export interface Yukleyen { tur: 'MUSTERI' | 'PERSONEL'; ad?: string | null }

const UYARILAR = ['DUSUK_COZUNURLUK', 'SIFRELI', 'SAYFA_OKUNAMADI'];

/** Yüklemeyi açar: kaydı yazar, R2'de çok parçalı yüklemeyi başlatır. */
export async function yuklemeAc(
  tenantId: string, isId: string,
  g: { ad?: unknown; boyut?: unknown; sayfaSayisi?: unknown; olcu?: unknown; uyarilar?: unknown; tur?: unknown },
  kim: Yukleyen,
): Promise<{ ok: true; dosyaId: string; parca: number; parcaBoyu: number } | Hata> {
  const r2 = r2Ayari();
  if (!r2) return { ok: false, kod: 'DOSYA_KAPALI' };
  const is = await prisma.baskiIsi.findFirst({ where: { id: isId, tenantId }, select: { id: true, durum: true } });
  if (!is) return { ok: false, kod: 'IS_YOK' };
  // Yarım yüklemeler de sayılır: sınır, yükleme açıp bırakarak aşılamasın.
  const mevcut = await prisma.baskiDosyasi.aggregate({ where: { isId, tenantId, durum: { in: ['HAZIR', 'YUKLENIYOR'] } }, _count: true, _sum: { boyut: true } });
  const v = yuklemeGecerli({ ad: g.ad, boyut: g.boyut }, { durum: isDurumu(is.durum) ?? 'SIRADA', mevcutSayi: mevcut._count, mevcutBoyut: mevcut._sum.boyut ?? 0 }, kim.tur);
  if (!v.ok) return v;

  const id = `d${randomBytes(12).toString('hex')}`;
  const ad = gorunenAd(g.ad);
  const anahtar = nesneAnahtari(tenantId, isId, id, ad);
  const sayfa = Math.floor(Number(g.sayfaSayisi));
  let yuklemeId: string;
  try {
    yuklemeId = await yuklemeBaslat(r2, anahtar, v.mime);
  } catch (e) {
    console.error('[baski-dosya] yükleme açılamadı', e instanceof Error ? e.message : e);
    return { ok: false, kod: 'YUKLEME_HATASI' };
  }
  await prisma.baskiDosyasi.create({
    data: {
      id, tenantId, isId, anahtar, yuklemeId, ad, boyut: v.boyut, mime: v.mime,
      // PROVA'yı yalnız personel yükler; müşteriden gelen her dosya baskı dosyasıdır.
      tur: kim.tur === 'PERSONEL' && g.tur === 'PROVA' ? 'PROVA' : 'BASKI',
      sayfaSayisi: sayfa >= 1 && sayfa <= 100_000 ? sayfa : null,
      olcu: typeof g.olcu === 'string' && g.olcu.trim() ? g.olcu.trim().slice(0, 40) : null,
      uyarilar: (Array.isArray(g.uyarilar) ? g.uyarilar.filter((u) => UYARILAR.includes(u as string)).slice(0, 5) : []) as Prisma.InputJsonValue,
      yukleyen: kim.tur, yukleyenAd: kim.tur === 'PERSONEL' ? kim.ad ?? null : null,
    },
  });
  return { ok: true, dosyaId: id, parca: v.parca, parcaBoyu: PARCA_BOYU };
}

/** Bir parçanın yükleneceği imzalı adres. */
export async function parcaAdresiVer(tenantId: string, isId: string, dosyaId: string, noHam: unknown): Promise<{ ok: true; url: string } | Hata> {
  const r2 = r2Ayari();
  if (!r2) return { ok: false, kod: 'DOSYA_KAPALI' };
  const d = await prisma.baskiDosyasi.findFirst({ where: { id: dosyaId, isId, tenantId, durum: 'YUKLENIYOR' }, select: { anahtar: true, yuklemeId: true, boyut: true } });
  const no = Math.floor(Number(noHam));
  if (!d?.yuklemeId || !(no >= 1 && no <= parcaSayisi(d.boyut))) return { ok: false, kod: 'DOSYA_YOK' };
  return { ok: true, url: parcaAdresi(r2, d.anahtar, d.yuklemeId, no, PARCA_SANIYE) };
}

/**
 * Yüklemeyi kapatır. Parça listesi R2'den okunur ve bildirilen boyutla
 * karşılaştırılır: eksik yükleme "yüklendi" olmaz.
 */
export async function yuklemeKapat(tenantId: string, isId: string, dosyaId: string): Promise<{ ok: true } | Hata> {
  const r2 = r2Ayari();
  if (!r2) return { ok: false, kod: 'DOSYA_KAPALI' };
  const d = await prisma.baskiDosyasi.findFirst({ where: { id: dosyaId, isId, tenantId, durum: 'YUKLENIYOR' } });
  if (!d?.yuklemeId) return { ok: false, kod: 'DOSYA_YOK' };
  try {
    const parcalar = await parcalariOku(r2, d.anahtar, d.yuklemeId);
    if (!parcalarTam(parcalar, d.boyut)) return { ok: false, kod: 'YUKLEME_EKSIK' };
    await yuklemeBitir(r2, d.anahtar, d.yuklemeId, parcalar);
  } catch (e) {
    console.error('[baski-dosya] yükleme kapatılamadı', e instanceof Error ? e.message : e);
    return { ok: false, kod: 'YUKLEME_HATASI' };
  }
  await prisma.$transaction([
    prisma.baskiDosyasi.updateMany({ where: { id: d.id, tenantId, durum: 'YUKLENIYOR' }, data: { durum: 'HAZIR', yuklemeId: null } }),
    prisma.baskiOlayi.create({ data: { isId, tenantId, tur: 'DOSYA', metin: d.ad.slice(0, 200), kullaniciAd: d.yukleyenAd } }),
  ]);
  // Prova dosyası: müşteri için süreli onay bağlantısı açılır.
  if (d.tur === 'PROVA') await provaAc(tenantId, isId, d.id, d.yukleyenAd);
  return { ok: true };
}

/** Yarım yüklemeden vazgeçilir: R2'deki parçalar atılır, kayıt silinir. */
export async function yuklemeVazgec(tenantId: string, isId: string, dosyaId: string): Promise<void> {
  const d = await prisma.baskiDosyasi.findFirst({ where: { id: dosyaId, isId, tenantId, durum: 'YUKLENIYOR' }, select: { id: true, anahtar: true, yuklemeId: true } });
  if (!d) return;
  const r2 = r2Ayari();
  if (r2 && d.yuklemeId) await yuklemeIptal(r2, d.anahtar, d.yuklemeId);
  await prisma.baskiDosyasi.deleteMany({ where: { id: d.id, tenantId } });
}

/** Personel için 5 dakikalık indirme adresi. */
export async function dosyaAdresi(tenantId: string, dosyaId: string, satirIci = false): Promise<{ ok: true; url: string } | Hata> {
  const r2 = r2Ayari();
  if (!r2) return { ok: false, kod: 'DOSYA_KAPALI' };
  const d = await prisma.baskiDosyasi.findFirst({ where: { id: dosyaId, tenantId, durum: 'HAZIR' }, select: { anahtar: true, ad: true } });
  if (!d) return { ok: false, kod: 'DOSYA_YOK' };
  return { ok: true, url: indirmeAdresi(r2, d.anahtar, d.ad, INDIRME_SANIYE, satirIci) };
}

/** Personel dosyayı kaldırır (yanlış dosya). Kayıt durur, içerik silinir. */
export async function dosyaKaldir(tenantId: string, dosyaId: string, kimAd: string | null): Promise<{ ok: true } | Hata> {
  const d = await prisma.baskiDosyasi.findFirst({ where: { id: dosyaId, tenantId, durum: 'HAZIR' }, select: { id: true, isId: true, anahtar: true, ad: true } });
  if (!d) return { ok: false, kod: 'DOSYA_YOK' };
  const r2 = r2Ayari();
  if (r2 && !(await nesneSil(r2, d.anahtar))) return { ok: false, kod: 'YUKLEME_HATASI' };
  await prisma.$transaction([
    prisma.baskiDosyasi.updateMany({ where: { id: d.id, tenantId }, data: { durum: 'SILINDI', silindiAt: new Date() } }),
    prisma.baskiOlayi.create({ data: { isId: d.isId, tenantId, tur: 'DOSYA', metin: `- ${d.ad}`.slice(0, 200), kullaniciAd: kimAd } }),
  ]);
  return { ok: true };
}

/**
 * SAKLAMA SÜRESİ (gece işi): teslim ya da iptalden sonra süresi dolan işlerin
 * dosyaları R2'den silinir; kayıt "silindi" olarak durur (işin geçmişinde
 * dosyanın adı kalır). Bir günden eski yarım yüklemeler de atılır.
 * R2 silmesi başarısız olan dosya işaretlenmez, ertesi gece yeniden denenir.
 */
export async function dosyaTemizligi(simdi = new Date(), azami = 500): Promise<{ silinen: number; yarim: number; hata: number }> {
  const r2 = r2Ayari();
  if (!r2) return { silinen: 0, yarim: 0, hata: 0 };
  let silinen = 0, yarim = 0, hata = 0;

  const eski = await prisma.baskiDosyasi.findMany({
    where: { durum: 'YUKLENIYOR', createdAt: { lt: new Date(simdi.getTime() - 86_400_000) } },
    select: { id: true, tenantId: true, anahtar: true, yuklemeId: true }, take: azami,
  });
  for (const d of eski) {
    if (d.yuklemeId) await yuklemeIptal(r2, d.anahtar, d.yuklemeId);
    await prisma.baskiDosyasi.deleteMany({ where: { id: d.id, tenantId: d.tenantId, durum: 'YUKLENIYOR' } });
    yarim++;
  }

  // En kısa saklama 7 gün: yalnız en az 7 gün önce kapanmış işlerin dosyaları adaydır.
  const sinir = new Date(simdi.getTime() - 7 * 86_400_000);
  const adaylar = await prisma.baskiDosyasi.findMany({
    where: { durum: 'HAZIR', is: { OR: [{ durum: 'TESLIM', teslimAt: { lt: sinir } }, { durum: 'IPTAL', iptalAt: { lt: sinir } }] } },
    select: { id: true, tenantId: true, anahtar: true, is: { select: { durum: true, teslimAt: true, iptalAt: true } } },
    orderBy: { createdAt: 'asc' }, take: azami,
  });
  const ayarlar = new Map((await prisma.matbaaAyar.findMany({ where: { tenantId: { in: [...new Set(adaylar.map((a) => a.tenantId))] } }, select: { tenantId: true, saklamaGun: true } })).map((a) => [a.tenantId, a.saklamaGun]));
  for (const d of adaylar) {
    if (!saklamaDoldu(d.is, saklamaGunu(ayarlar.get(d.tenantId)), simdi)) continue;
    if (!(await nesneSil(r2, d.anahtar))) { hata++; continue; }
    await prisma.baskiDosyasi.updateMany({ where: { id: d.id, tenantId: d.tenantId }, data: { durum: 'SILINDI', silindiAt: simdi } });
    silinen++;
  }
  return { silinen, yarim, hata };
}
