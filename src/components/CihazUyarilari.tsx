'use client';

/**
 * CİHAZ UYARILARI — fiş açılırken teknisyenin görmesi gereken iki şey.
 *
 * Arıza bilgilerinden ÖNCE duruyor, çünkü ikisi de "bu işi nasıl
 * yapacağım" sorusunu değiştiriyor:
 *
 *   GARANTİ      → ücret alınacak mı? Yanlış bilmek ya müşteriye
 *                  kapsamdaki işi faturalatır ya bayiye kapsam dışı işi
 *                  bedava yaptırır.
 *   TEKRAR ARIZA → aynı makine kısa sürede ikinci kez geldiyse ilk onarım
 *                  tutmamıştır: teknisyen aynı parçayı tekrar denemesin,
 *                  bayi ikinci kez ücret istemeden önce düşünsün.
 *
 * GARANTİ TAHMİN EDİLMİYOR. Tarih girilmemişse "bilinmiyor" yazıyor ve
 * ücret kararı verilmiyor — kurulum tarihinden türetmek yanlış faturaya
 * yol açardı (ikinci el makine, devir alınan park, uzatılmış garanti).
 */

import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';
import type { Bicimleyici } from '@/lib/bicim';

export type GarantiBilgisi = {
  durum: 'BILINMIYOR' | 'KAPSAMDA' | 'BITIYOR' | 'BITTI' | 'BASLAMADI';
  mesaj: string;
  kalanGun: number | null;
  ucretli: boolean | null;
  /** Cümleyi ekran kendi dilinde kurabilsin diye ham tarihler de geliyor. */
  bitis?: string | Date | null;
  baslangic?: string | Date | null;
  not?: string | null;
};

export type TekrarArizaBilgisi = {
  tekrar: boolean;
  adet: number;
  mesaj: string | null;
  gunler?: number | null;
  esikGun?: number;
  fisler: { id: string; ticketNumber: string; arize: string; gunOnce: number }[];
};

const RENK: Record<GarantiBilgisi['durum'], { arka: string; kenar: string; yazi: string }> = {
  KAPSAMDA:   { arka: '#f0fdf4', kenar: '#bbf7d0', yazi: '#166534' },
  BITIYOR:    { arka: '#fffbeb', kenar: '#fde68a', yazi: '#92400e' },
  BITTI:      { arka: '#fef2f2', kenar: '#fecaca', yazi: '#991b1b' },
  BASLAMADI:  { arka: '#eff6ff', kenar: '#bfdbfe', yazi: '#1e40af' },
  BILINMIYOR: { arka: '#f9fafb', kenar: '#e5e7eb', yazi: '#4b5563' },
};

const rozet = (t: Sozluk, d: GarantiBilgisi['durum']): string => ({
  KAPSAMDA: t.garanti.rozetKapsamda,
  BITIYOR: t.garanti.rozetBitiyor,
  BITTI: t.garanti.rozetBitti,
  BASLAMADI: t.garanti.rozetBaslamadi,
  BILINMIYOR: t.garanti.rozetBilinmiyor,
}[d]);

/**
 * Garanti cümlesi. Sunucu Türkçesini yalnız ham tarih gelmediğinde
 * kullanıyoruz — eski bir yanıt biçimi kalırsa ekran boş kalmasın.
 */
function garantiMetni(t: Sozluk, b: Bicimleyici, g: GarantiBilgisi): string {
  const kapsam = g.not ? doldur(t.garanti.kapsamNotu, { not: g.not }) : '';
  if (g.durum === 'BILINMIYOR') return t.garanti.mesajBilinmiyor;
  if (g.durum === 'BASLAMADI') {
    return g.baslangic ? doldur(t.garanti.mesajBaslamadi, { t: b.tarih(g.baslangic) }) : g.mesaj;
  }
  if (!g.bitis) return g.mesaj;
  const tarih = b.tarih(g.bitis);
  const n = g.kalanGun ?? 0;
  if (g.durum === 'BITTI') return doldur(t.garanti.mesajBitti, { t: tarih, n: Math.abs(n) });
  if (g.durum === 'BITIYOR') return doldur(t.garanti.mesajBitiyor, { n, t: tarih }) + kapsam;
  return doldur(t.garanti.mesajKapsamda, { t: tarih, n }) + kapsam;
}

function tekrarMetni(t: Sozluk, x: TekrarArizaBilgisi): string {
  if (x.adet === 1 && x.gunler != null && x.fisler[0]) {
    return doldur(t.garanti.tekrarTek, { n: x.gunler, fis: x.fisler[0].ticketNumber });
  }
  if (x.esikGun != null && x.gunler != null) {
    return doldur(t.garanti.tekrarCoklu, { esik: x.esikGun, n: x.adet, gun: x.gunler });
  }
  return x.mesaj ?? '';
}

export default function CihazUyarilari({
  garanti, tekrar, deviceId,
}: {
  garanti?: GarantiBilgisi | null;
  tekrar?: TekrarArizaBilgisi | null;
  deviceId?: string;
}) {
  const t = useT();
  const b = useBicim();
  if (!garanti && !tekrar?.tekrar) return null;

  return (
    <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
      {garanti && (
        <div style={{
          background: RENK[garanti.durum].arka,
          border: `1px solid ${RENK[garanti.durum].kenar}`,
          borderRadius: '0.6rem', padding: '0.7rem 0.85rem',
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: RENK[garanti.durum].yazi,
              background: 'rgba(255,255,255,0.7)', borderRadius: '999px', padding: '0.12rem 0.55rem',
              whiteSpace: 'nowrap',
            }}>
              {rozet(t, garanti.durum)}
            </span>
            {/* Ücret kararı YALNIZ garanti biliniyorsa yazılıyor. */}
            {garanti.ucretli === false && (
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>{t.garanti.ucretsiz}</span>
            )}
            {garanti.ucretli === true && (
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>{t.garanti.ucretli}</span>
            )}
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: RENK[garanti.durum].yazi }}>
            {garantiMetni(t, b, garanti)}
          </p>
          {garanti.durum === 'BILINMIYOR' && deviceId && (
            <a href={`/devices/${deviceId}`} style={{ fontSize: '0.76rem', color: '#2563eb' }}>
              {t.garanti.tarihGir}
            </a>
          )}
        </div>
      )}

      {tekrar?.tekrar && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.6rem', padding: '0.7rem 0.85rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a3412', marginBottom: '0.25rem' }}>
            {t.garanti.tekrarBaslik}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9a3412' }}>{tekrarMetni(t, tekrar)}</p>
          <div style={{ display: 'grid', gap: '0.15rem', marginTop: '0.4rem' }}>
            {tekrar.fisler.map((f) => (
              <a key={f.id} href={`/tickets/${f.id}`}
                style={{ fontSize: '0.76rem', color: '#9a3412', textDecoration: 'none' }}>
                <b>{f.ticketNumber}</b> · {doldur(t.garanti.tekrarGunOnce, { n: f.gunOnce })}{f.arize ? ` · ${f.arize}` : ''} →
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
