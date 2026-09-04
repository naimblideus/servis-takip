import Link from 'next/link';

/**
 * 404 — SAYFA BULUNAMADI
 *
 * ── NEDEN GEREKLİ ────────────────────────────────────────────────────────
 * Bu dosya yokken Next.js'in kendi varsayılan sayfası çıkıyordu:
 * İngilizce, markasız, "404 · This page could not be found."
 *
 * Bunu en çok kim görür? MÜŞTERİ. Müşteri paneli bağlantısı (/m/<jeton>)
 * bayi tarafından iptal edildiğinde, jeton yenilendiğinde ya da WhatsApp'ta
 * bağlantı kırpıldığında `notFound()` çağrılıyor. Yani bayinin müşterisine
 * gösterilen ilk şey İngilizce bir geliştirici hatasıydı.
 *
 * Burada iki ayrı yol veriyoruz çünkü bu sayfayı iki farklı kişi görür:
 * bağlantısı bozulan MÜŞTERİ (bayisini aramalı) ve yanlış adres yazan
 * BAYİ (panele dönmeli). Hangisi olduğunu bilemeyiz, ikisini de yazıyoruz.
 */
export default function NotFound() {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '1.5rem',
    }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.5rem 0', color: '#0f172a' }}>
          Sayfa bulunamadı
        </h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
          Aradığınız sayfa taşınmış, silinmiş ya da adres yanlış yazılmış olabilir.
        </p>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
          Size gönderilen <strong>müşteri paneli bağlantısını</strong> açmaya
          çalışıyorsanız, bağlantı yenilenmiş olabilir. Servis firmanızdan yeni
          bağlantıyı isteyin.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '2.75rem', padding: '0 1.2rem', background: '#0f2253', color: 'white',
            border: 'none', borderRadius: 8, fontWeight: 700, textDecoration: 'none',
          }}>Panele Dön</Link>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '2.75rem', padding: '0 1.2rem', background: 'white', color: '#0f2253',
            border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, textDecoration: 'none',
          }}>Ana Sayfa</Link>
        </div>
      </div>
    </div>
  );
}
