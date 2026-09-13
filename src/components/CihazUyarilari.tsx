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

export type GarantiBilgisi = {
  durum: 'BILINMIYOR' | 'KAPSAMDA' | 'BITIYOR' | 'BITTI' | 'BASLAMADI';
  mesaj: string;
  kalanGun: number | null;
  ucretli: boolean | null;
};

export type TekrarArizaBilgisi = {
  tekrar: boolean;
  adet: number;
  mesaj: string | null;
  fisler: { id: string; ticketNumber: string; arize: string; gunOnce: number }[];
};

const RENK: Record<GarantiBilgisi['durum'], { arka: string; kenar: string; yazi: string; etiket: string }> = {
  KAPSAMDA:   { arka: '#f0fdf4', kenar: '#bbf7d0', yazi: '#166534', etiket: 'Garanti kapsamında' },
  BITIYOR:    { arka: '#fffbeb', kenar: '#fde68a', yazi: '#92400e', etiket: 'Garanti bitiyor' },
  BITTI:      { arka: '#fef2f2', kenar: '#fecaca', yazi: '#991b1b', etiket: 'Garanti bitti' },
  BASLAMADI:  { arka: '#eff6ff', kenar: '#bfdbfe', yazi: '#1e40af', etiket: 'Garanti başlamadı' },
  BILINMIYOR: { arka: '#f9fafb', kenar: '#e5e7eb', yazi: '#4b5563', etiket: 'Garanti bilinmiyor' },
};

export default function CihazUyarilari({
  garanti, tekrar, deviceId,
}: {
  garanti?: GarantiBilgisi | null;
  tekrar?: TekrarArizaBilgisi | null;
  deviceId?: string;
}) {
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
              {RENK[garanti.durum].etiket}
            </span>
            {/* Ücret kararı YALNIZ garanti biliniyorsa yazılıyor. */}
            {garanti.ucretli === false && (
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>Bu iş ücretsiz</span>
            )}
            {garanti.ucretli === true && (
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>Bu iş ücretli</span>
            )}
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: RENK[garanti.durum].yazi }}>
            {garanti.mesaj}
          </p>
          {garanti.durum === 'BILINMIYOR' && deviceId && (
            <a href={`/devices/${deviceId}`} style={{ fontSize: '0.76rem', color: '#2563eb' }}>
              Cihaz kartından garanti tarihini gir →
            </a>
          )}
        </div>
      )}

      {tekrar?.tekrar && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.6rem', padding: '0.7rem 0.85rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a3412', marginBottom: '0.25rem' }}>
            TEKRAR ARIZA
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9a3412' }}>{tekrar.mesaj}</p>
          <div style={{ display: 'grid', gap: '0.15rem', marginTop: '0.4rem' }}>
            {tekrar.fisler.map((f) => (
              <a key={f.id} href={`/tickets/${f.id}`}
                style={{ fontSize: '0.76rem', color: '#9a3412', textDecoration: 'none' }}>
                <b>{f.ticketNumber}</b> · {f.gunOnce} gün önce{f.arize ? ` · ${f.arize}` : ''} →
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
