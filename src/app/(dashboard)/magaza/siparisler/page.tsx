import Link from 'next/link';
import { auth } from '@/lib/auth';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { magazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { MagazaSekmeleri } from '../MagazaSekmeleri';
import { SiparisYonetimi } from './SiparisYonetimi';

export const dynamic = 'force-dynamic';

/**
 * MAĞAZA SİPARİŞLERİ — Servis'in içinden, mağaza paneline gitmeden.
 * Okuma ve işlem /api/magaza/siparisler üzerinden; kurallar mağazada
 * (nextus-magaza lib/siparis-islem.ts). Yalnız yönetici: onay stok düşürür.
 */
export default async function MagazaSiparisleriSayfasi() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { dil } = await sunucuBicimi(user);
  const sm = magazaSiparisMetni(dil);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{sm.siparislerBaslik}</h1>
      {yoneticiMi(user) ? (
        <>
          <MagazaSekmeleri aktif="siparisler" sm={sm} />
          <SiparisYonetimi />
        </>
      ) : (
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>
          {sm.kodYETKI} <Link href="/magaza" style={{ color: '#1d4ed8' }}>{sm.sekmeBugun} →</Link>
        </p>
      )}
    </div>
  );
}
