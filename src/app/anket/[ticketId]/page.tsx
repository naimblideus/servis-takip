import type { Metadata } from 'next';
import { anketSayfasi } from '@/lib/memnuniyet-veri';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { sozluk, doldur } from '@/lib/i18n/sozluk';
import AnketFormu from './AnketFormu';

/**
 * MÜŞTERİ ANKETİ — /anket/<fiş>?t=<anahtar>  (girişsiz)
 *
 * Teknisyen fişi teslim edince müşteriye tek soru soruluyor: "servisimizi bir
 * tanıdığınıza tavsiye eder misiniz?" Bağlantı ya teknisyenin ekranındaki
 * QR'dan ya da WhatsApp'tan gelir. Şifre yok, form yok, tek dokunuş.
 *
 * Sayfayı BAYİNİN müşterisi okur: başlıkta bayinin adı ve logosu var, bizim
 * adımız yok — müşteri bizi değil bayisini tanır. Dil bayinin dili; müşteri
 * dil çerezi taşıyorsa (aynı tarayıcıda dili değiştirmişse) o.
 *
 * Hangi durumda ne gösterileceğine burada karar verilmez: lib/memnuniyet-veri.ts
 * (anketSayfasi). Burada yalnız gösterim var.
 */

// Arama motorlarına KAPALI: anahtarlı bağlantı Google'a düşerse özel olmaktan çıkar.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const sz = sozluk(await sunucuDili()).memnuniyet;
  return { title: sz.sayfaBaslik, robots: { index: false, follow: false, nocache: true } };
}

export default async function AnketSayfasi({
  params, searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { ticketId } = await params;
  const sp = await searchParams;
  const anahtar = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const s = await anketSayfasi(ticketId, anahtar);
  const dil = await sunucuDili(s.durum === 'GECERSIZ' ? undefined : s.bayi.dil);
  const sz = sozluk(dil).memnuniyet;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9', display: 'flex', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#0F1E33' }}>
      <main style={{ width: '100%', maxWidth: 480, marginTop: '3vh' }}>
        {s.durum === 'GECERSIZ' ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
            <div aria-hidden style={{ fontSize: '2.25rem' }}>🔗</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.6rem 0 0.4rem' }}>{sz.gecersizBaslik}</h1>
            <p style={{ color: '#53617B', fontSize: '0.95rem', lineHeight: 1.55, margin: 0 }}>{sz.gecersizAlt}</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Bayinin kimliği: müşteri kimden geldiğini ilk bakışta görsün. */}
            <header style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.1rem 1.25rem', borderBottom: '1px solid #E4E9F1' }}>
              {s.bayi.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.bayi.logo} alt="" style={{ maxHeight: 44, maxWidth: 110, objectFit: 'contain' }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{s.bayi.ad || sz.servis}</div>
                {s.cihaz && <div style={{ color: '#6C7A93', fontSize: '0.85rem', marginTop: 2, overflowWrap: 'anywhere' }}>{s.cihaz}</div>}
              </div>
            </header>

            <div style={{ padding: '1.25rem' }}>
              {s.durum === 'ACIK' && (
                <AnketFormu ticketId={ticketId} anahtar={anahtar ?? ''} dil={dil} bayiAdi={s.bayi.ad || sz.servis} bayiTelefon={s.bayi.telefon} />
              )}
              {s.durum === 'CEVAPLANDI' && (
                <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                  <div aria-hidden style={{ fontSize: '2.25rem' }}>✅</div>
                  <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.5rem 0 0.35rem' }}>{sz.zatenBaslik}</h1>
                  <p style={{ color: '#53617B', fontSize: '0.95rem', margin: 0 }}>{sz.zatenAlt}</p>
                </div>
              )}
              {s.durum === 'KAPALI' && (
                <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                  <div aria-hidden style={{ fontSize: '2.25rem' }}>🛠️</div>
                  <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.5rem 0 0.35rem' }}>{sz.kapaliBaslik}</h1>
                  <p style={{ color: '#53617B', fontSize: '0.95rem', lineHeight: 1.55, margin: 0 }}>{sz.kapaliAlt}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {s.durum !== 'GECERSIZ' && (
          <p style={{ textAlign: 'center', color: '#6C7A93', fontSize: '0.78rem', marginTop: '1rem', lineHeight: 1.5 }}>
            {doldur(sz.altBilgi, { bayi: s.bayi.ad || sz.servis })}
          </p>
        )}
      </main>
    </div>
  );
}
