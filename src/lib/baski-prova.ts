// PROVA — veritabanı tarafı. Kurallar saf dosyada (lib/baski-is provaYanitlanir).
//
// Personel prova dosyasını yükler; müşteriye giden bağlantı SÜRELİ (7 gün) ve
// TEK KULLANIMLIK: yanıt koşullu yazılır, ikinci yanıt ya da süresi geçmiş
// bağlantı işlem yapmaz. Yeni prova yüklenince eski bekleyen bağlantı kapanır:
// müşteri eski provayı onaylayamasın.
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { isNo, provaGorunum, provaSonTarihi, provaYanitlanir } from '@/lib/baski-is';
import { jetonGecerli } from '@/lib/matbaa-ayar';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { INDIRME_SANIYE } from '@/lib/baski-dosya';
import { indirmeAdresi, r2Ayari } from '@/lib/r2';
import { dilMi, type Dil } from '@/lib/i18n/sozluk';

/** Yüklenen prova dosyası için onay bağlantısı açar. */
export async function provaAc(tenantId: string, isId: string, dosyaId: string, gonderenAd: string | null): Promise<void> {
  const simdi = new Date();
  await prisma.$transaction([
    prisma.baskiProva.updateMany({ where: { isId, tenantId, durum: 'BEKLIYOR', sonTarih: { gt: simdi } }, data: { sonTarih: simdi } }),
    prisma.baskiProva.create({ data: { tenantId, isId, dosyaId, jeton: randomBytes(18).toString('base64url'), sonTarih: provaSonTarihi(simdi), gonderenAd } }),
    prisma.baskiOlayi.create({ data: { isId, tenantId, tur: 'PROVA', metin: 'YUKLENDI', kullaniciAd: gonderenAd } }),
  ]);
}

async function bul(kisaAd: string, jeton: string) {
  if (!jetonGecerli(jeton)) return null;
  const m = await kisaAddanMatbaa(kisaAd);
  if (!m) return null;
  const p = await prisma.baskiProva.findFirst({
    where: { jeton, tenantId: m.tenant.id },
    select: {
      id: true, isId: true, durum: true, sonTarih: true, musteriNotu: true,
      is: { select: { no: true, durum: true, jeton: true } },
      dosya: { select: { anahtar: true, ad: true, mime: true, durum: true } },
    },
  });
  return p ? { m, p } : null;
}

/** Prova sayfasının verisi (müşteriye gösterilecek kadarı). */
export async function provaVerisi(kisaAd: string, jeton: string) {
  const r = await bul(kisaAd, jeton);
  if (!r) return null;
  const { m, p } = r;
  const simdi = new Date();
  const r2 = r2Ayari();
  const dil: Dil = dilMi(m.tenant.locale) ? m.tenant.locale : 'tr';
  const yanit = provaYanitlanir(p, p.is.durum, simdi);
  return {
    dil, kisaAd: m.ayar.kisaAd!, firma: { ad: m.tenant.name, telefon: m.tenant.phone },
    isNo: isNo(p.is.no), isJeton: p.is.jeton,
    durum: provaGorunum(p, simdi),
    yanitlanir: yanit.ok,
    // Görsel sayfada gösterilir; PDF yeni sekmede açılır. Adres 5 dakikalık.
    dosya: r2 && p.dosya?.durum === 'HAZIR'
      ? { ad: p.dosya.ad, gorsel: p.dosya.mime === 'image/jpeg' || p.dosya.mime === 'image/png', url: indirmeAdresi(r2, p.dosya.anahtar, p.dosya.ad, INDIRME_SANIYE, true) }
      : null,
  };
}

/** Müşterinin yanıtı. Koşullu yazma: aynı bağlantı iki kez yanıtlanamaz. */
export async function provaYanitla(kisaAd: string, jeton: string, kararHam: unknown, notHam: unknown):
  Promise<{ ok: true; durum: 'ONAYLANDI' | 'DUZELTME' } | { ok: false; kod: 'PROVA_YOK' | 'PROVA_YANITLANDI' | 'PROVA_SURESI_DOLDU' | 'PROVA_KARAR_GECERSIZ' }> {
  const r = await bul(kisaAd, jeton);
  if (!r) return { ok: false, kod: 'PROVA_YOK' };
  const durum = kararHam === 'ONAY' ? 'ONAYLANDI' : kararHam === 'DUZELTME' ? 'DUZELTME' : null;
  if (!durum) return { ok: false, kod: 'PROVA_KARAR_GECERSIZ' };
  const simdi = new Date();
  const izin = provaYanitlanir(r.p, r.p.is.durum, simdi);
  if (!izin.ok) return izin;
  const not = typeof notHam === 'string' && notHam.trim() ? notHam.trim().slice(0, 1000) : null;
  const tenantId = r.m.tenant.id;
  const yazildi = await prisma.$transaction(async (tx) => {
    const y = await tx.baskiProva.updateMany({ where: { id: r.p.id, tenantId, durum: 'BEKLIYOR', sonTarih: { gt: simdi } }, data: { durum, musteriNotu: not, yanitAt: simdi } });
    if (y.count !== 1) return false;
    await tx.baskiOlayi.create({ data: { isId: r.p.isId, tenantId, tur: 'PROVA', metin: not && durum === 'DUZELTME' ? `${durum}: ${not}`.slice(0, 1000) : durum } });
    return true;
  });
  return yazildi ? { ok: true, durum } : { ok: false, kod: 'PROVA_YANITLANDI' };
}
