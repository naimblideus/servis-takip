import Link from 'next/link';
import { auth } from '@/lib/auth';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { bayiMagazasi } from '@/lib/magaza-baglanti';
import { magazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { MagazaSekmeleri } from '../MagazaSekmeleri';
import { PanelGiris } from '../PanelGiris';
import { UrunYonetimi } from './UrunYonetimi';

export const dynamic = 'force-dynamic';

/**
 * MAĞAZA ÜRÜNLERİ VE STOK — fiyat ve yayın, Servis'in içinden.
 * Okuma ve kayıt /api/magaza/urunler üzerinden; kural mağazada
 * (nextus-magaza lib/urun-kaydet.ts). Yalnız yönetici.
 */
export default async function MagazaUrunleriSayfasi({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { dil } = await sunucuBicimi(user);
  const sm = magazaSiparisMetni(dil);
  const { filtre } = await searchParams;

  if (!yoneticiMi(user)) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{sm.urunlerBaslik}</h1>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>
          {sm.kodYETKI} <Link href="/magaza" style={{ color: '#1d4ed8' }}>{sm.sekmeBugun} →</Link>
        </p>
      </div>
    );
  }
  const magaza = await bayiMagazasi(user.tenantId);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{sm.urunlerBaslik}</h1>
      <MagazaSekmeleri aktif="urunler" sm={sm} />
      <UrunYonetimi ilkFiltre={filtre ?? 'HEPSI'} />
      {/* Toplu fiyat, döviz, fotoğraf ve yeni ürün mağaza panelinde: tek dokunuşla giriş. */}
      <p style={{ color: '#6b7280', fontSize: '0.84rem', margin: '1.2rem 0 0' }}>{sm.uPanelNotu}</p>
      {magaza?.adresli && <PanelGiris />}
    </div>
  );
}
