/**
 * PARÇA ÖMRÜ SATIRI — /parca-omru listesi ve cihaz sayfasındaki kart AYNI
 * satırı çizer: iki ekran aynı drum için farklı cümle kurmasın.
 *
 * Hook yok (sözlük ve biçimlendirici parametre): sunucu bileşeninden de
 * (cihaz sayfası) istemci bileşeninden de (liste) çağrılır.
 *
 * Telefonda tablo değil liste: satır alt alta kırılır, yatay kaydırma yok;
 * "Fiş aç" ve "Cihaz" en az 44 px — teknisyen sahada eldivenle basıyor.
 */
import Link from 'next/link';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';
import type { OmurHesabi, OmurSatiri, OmurDurumu } from '@/lib/parca-omru';

const GUN_MS = 86_400_000;

export const DURUM_RENGI: Record<OmurDurumu, { fg: string; bg: string; bd: string; bar: string }> = {
  KRITIK: { fg: '#B93333', bg: '#FDECEC', bd: '#FBDADA', bar: '#D64545' },
  YAKINDA: { fg: '#B0721F', bg: '#FCF3E4', bd: '#F8E6C7', bar: '#D08A2C' },
  IYI: { fg: '#096847', bg: '#E7F6EF', bd: '#CFEDE0', bar: '#0E9F6E' },
  BILINMIYOR: { fg: '#53617B', bg: '#F1F4F9', bd: '#E4E9F1', bar: '#98A3B8' },
};

type Metin = Sozluk['parcaOmru'];

/** Kalan için ana cümle: "%8 kaldı" · "Ömrü doldu" · hesaplanamadıysa sebebi. */
export function kalanMetni(h: OmurHesabi, p: Metin, b: Bicimleyici): string {
  if (h.durum === 'BILINMIYOR') return h.sebep ? p.sebep[h.sebep] : p.durum.BILINMIYOR;
  if ((h.kalanSayfa !== null && h.kalanSayfa <= 0) || h.yuzde === 0) return p.doldu;
  return doldur(p.kalanYuzde, { y: b.yuzde(h.yuzde) });
}

/** Tahmini gün: "~12 gün" · "bugün–yarın" · "~5 gün önce doldu" · null (bilinmiyor). */
export function gunMetni(h: OmurHesabi, p: Metin, b: Bicimleyici): string | null {
  if (h.durum === 'BILINMIYOR' || h.gun === null) return null;
  if (h.gun < 0) return doldur(p.gunGecti, { n: b.sayi(-h.gun) });
  if (h.gun <= 1) return p.gunBugun;
  return doldur(p.gunTahmin, { n: b.sayi(h.gun) });
}

/** Satırdan açılan fiş: cihaz, plânlı değişim cümlesi ve kategori dolu gelir (/tickets/new okur). */
export function fisLinki(s: OmurSatiri, p: Metin, b: Bicimleyici): string {
  const q = new URLSearchParams({
    cihaz: s.cihaz.publicCode,
    sorun: doldur(p.fisSorun, { parca: s.parca || p.adsizParca, kalan: kalanMetni(s.hesap, p, b) }),
    kategori: s.kategori,
  });
  return `/tickets/new?${q.toString()}`;
}

export default function ParcaOmruSatiri({ s, t, b, cihazGoster = true }: {
  s: OmurSatiri; t: Sozluk; b: Bicimleyici; cihazGoster?: boolean;
}) {
  const p = t.parcaOmru;
  const h = s.hesap;
  const renk = DURUM_RENGI[h.durum];
  const gun = gunMetni(h, p, b);
  // Gün yoksa NEDEN yok: kart ömrü mü eksik, sayaç hızı mı.
  const gunNedeni = h.durum === 'BILINMIYOR' || gun !== null ? null
    : s.kaynak === 'CIHAZ' && !s.kart ? p.gunNedenKart : p.gunNedenHiz;
  const eskiGun = s.olcumAt ? Math.floor((Date.now() - new Date(s.olcumAt).getTime()) / GUN_MS) : 0;

  const ayrinti: string[] = [];
  if (h.kalanSayfa !== null && h.durum !== 'BILINMIYOR') {
    if (h.kalanSayfa < 0) ayrinti.push(doldur(p.asildi, { n: b.sayi(-h.kalanSayfa) }));
    else if (h.kalanSayfa > 0) ayrinti.push(doldur(s.kaynak === 'CIHAZ' ? p.kalanSayfaTahmin : p.kalanSayfa, { n: b.sayi(h.kalanSayfa) }));
  }
  if (s.kaynak === 'CIHAZ' && s.kart) ayrinti.push(doldur(s.kart.kaynak === 'BU_CIHAZ' ? p.kartBuCihaz : p.kartModel, { ad: s.kart.ad }));
  if (s.takilis) {
    ayrinti.push(s.takilis.sayac !== null
      ? doldur(p.takildiSayac, { fis: s.takilis.fisNo, tarih: b.tarih(s.takilis.tarih), n: b.sayi(s.takilis.sayac) })
      : doldur(p.takildi, { fis: s.takilis.fisNo, tarih: b.tarih(s.takilis.tarih) }));
  }
  // Telefonda title görünmüyor: gün neden yok, ayrıntıda açıkça yazar.
  if (gunNedeni) ayrinti.push(gunNedeni);
  if (s.sayactan) {
    const sg = gunMetni(s.sayactan, p, b);
    ayrinti.push(doldur(p.sayactanAyrinti, {
      kalan: [kalanMetni(s.sayactan, p, b), sg, s.sayactan.yaklasik ? p.yaklasik : null].filter(Boolean).join(' · '),
    }));
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1" style={{ flexBasis: '15rem' }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900" style={{ overflowWrap: 'anywhere' }}>{s.parca || p.adsizParca}</span>
          <span className="badge" style={s.kaynak === 'CIHAZ'
            ? { background: '#EEF2FA', color: '#1D3E7E' }
            : { background: '#F1F4F9', color: '#53617B' }}>
            {s.kaynak === 'CIHAZ' ? p.kaynakCihaz : p.kaynakSayac}
          </span>
          {s.yaklasik && <span className="badge" style={{ background: '#FCF3E4', color: '#B0721F' }} title={p.yaklasikIpucu}>{p.yaklasik}</span>}
          {s.eskiOlcum && (
            <span className="badge" style={{ background: '#FCF3E4', color: '#B0721F' }} title={doldur(p.eskiOlcumIpucu, { gun: eskiGun })}>{p.eskiOlcum}</span>
          )}
        </div>
        {cihazGoster && (
          <p className="mt-0.5 text-sm text-gray-600" style={{ overflowWrap: 'anywhere' }}>
            {s.musteri ? <Link href={`/customers/${s.musteri.id}`} className="hover:underline">{s.musteri.ad}</Link> : t.genel.musterisizCihaz}
            <span className="text-gray-400"> · </span>
            <Link href={`/devices/${s.deviceId}`} className="hover:underline">{s.cihaz.marka} {s.cihaz.model}</Link>
            <span className="text-gray-400"> · {s.cihaz.seri}</span>
          </p>
        )}
        {ayrinti.length > 0 && <p className="mt-0.5 text-xs text-gray-500" style={{ overflowWrap: 'anywhere' }}>{ayrinti.join(' · ')}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div style={{ minWidth: '7.5rem' }}>
          <div className="text-base font-extrabold" style={{ color: renk.fg }}>{kalanMetni(h, p, b)}</div>
          {h.yuzde !== null && (
            <div style={{ height: 5, background: '#E4E9F1', borderRadius: 999, marginTop: 3, overflow: 'hidden' }}>
              <div style={{ width: `${h.yuzde}%`, height: '100%', background: renk.bar }} />
            </div>
          )}
          <div className="mt-0.5 text-xs text-gray-500">
            {gun !== null ? <>{gun} <span className="text-gray-400">· {p.tahmin}</span></> : (gunNedeni ? p.gunYok : null)}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={fisLinki(s, p, b)} className="btn-primary" style={{ minHeight: 44 }}>{p.fisAc}</Link>
          {cihazGoster && <Link href={`/devices/${s.deviceId}`} className="btn-secondary" style={{ minHeight: 44 }}>{p.cihazaGit}</Link>}
        </div>
      </div>
    </li>
  );
}
