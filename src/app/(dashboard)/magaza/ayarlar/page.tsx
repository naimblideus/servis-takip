import Link from 'next/link';
import { auth } from '@/lib/auth';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { magazaKurulumMetni } from '@/lib/magaza-kurulum-metin';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { magazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { MagazaSekmeleri } from '../MagazaSekmeleri';
import { MagazaAyarlari } from './MagazaAyarlari';

export const dynamic = 'force-dynamic';

/**
 * MAĞAZA AYARLARI — Servis'in içinden, mağaza paneline gitmeden.
 *
 * Ayarların kuralı mağazada (nextus-magaza lib/ayar-kaydet.ts); bu ekran
 * /api/magaza/ayarlar üzerinden okur ve yazar, mağazanın mesajını aynen
 * gösterir. Yalnız yönetici.
 */
export default async function MagazaAyarlariSayfasi() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { dil } = await sunucuBicimi(user);
  const km = magazaKurulumMetni(dil);

  if (!yoneticiMi(user)) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 760, margin: '0 auto' }}>
        <Link href="/magaza" style={{ color: '#1d4ed8', fontSize: '0.85rem', textDecoration: 'none' }}>{km.ayGeri}</Link>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>{km.ayYetki}</p>
      </div>
    );
  }
  return <MagazaAyarlari sekmeler={<MagazaSekmeleri aktif="site" sm={magazaSiparisMetni(dil)} />} />;
}
