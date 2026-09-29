'use client';

import { signOut } from 'next-auth/react';
import { sozluk, type Dil } from '@/lib/i18n/sozluk';

/**
 * Tam ekran erişim kilidi — abonelik askıda/bitti veya bakım modunda.
 *
 * Dil PROP olarak geliyor, bağlamdan değil: bu ekran layout'un dil
 * sağlayıcısı kurulmadan önce dönüyor, yani bağlamı okusaydı kilitlenen
 * her bayiye Türkçe "Çıkış Yap" yazardı.
 */
export default function AccessLock({
  title, message, contactEmail, showLogout = true, dil, odeme,
}: {
  title: string;
  message: string;
  contactEmail?: string | null;
  /**
   * Abonelik kilidinde devam etmenin yolu. Eskiden yalnız e-posta vardı:
   * satın almaya hazır bayi, deneme bittiği an çıkmaz sokağa giriyordu.
   */
  odeme?: { iban: string | null; hesapAdi: string | null; aciklama: string; whatsappLink: string | null } | null;
  showLogout?: boolean;
  dil: Dil;
}) {
  const t = sozluk(dil);
  return (
    <div lang={dil} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, width: '100%', background: 'white', borderRadius: 16, padding: '2.25rem 2rem', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0', color: '#0f172a' }}>{title}</h1>
        <p style={{ color: '#475569', lineHeight: 1.6, margin: '0 0 1rem' }}>{message}</p>
        {odeme && (odeme.iban || odeme.whatsappLink) && (
          <div style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.9rem 1rem', margin: '0 0 1rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>{t.ortak.kilitDevamBaslik}</div>
            {odeme.iban && (
              <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.7 }}>
                <div>{t.ortak.kilitIban} <b style={{ fontFamily: 'monospace' }}>{odeme.iban}</b></div>
                {odeme.hesapAdi && <div>{t.ortak.kilitAlici} <b>{odeme.hesapAdi}</b></div>}
                <div>{t.ortak.kilitAciklama} <b>{odeme.aciklama}</b></div>
              </div>
            )}
            {odeme.whatsappLink && (
              <a href={odeme.whatsappLink} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', marginTop: '0.7rem', padding: '0.6rem', background: '#16a34a', color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
                {t.ortak.kilitWhatsapp}
              </a>
            )}
          </div>
        )}
        {contactEmail && <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t.ortak.kilitIletisim} <b>{contactEmail}</b></p>}
        {showLogout && (
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ marginTop: '1.4rem', padding: '0.6rem 1.4rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            {t.ortak.cikisYap}
          </button>
        )}
      </div>
    </div>
  );
}
