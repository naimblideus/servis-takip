import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { bayiMagazasi, magazaKiraciId } from '@/lib/magaza-baglanti';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

/**
 * NEXTUS MAĞAZA — modül sayfası.
 *
 * Mağaza ayrı bir uygulamada çalışır; burası ona AÇILAN KAPI ve durum
 * özetidir. Bilerek yalın: mağazanın yönetimi mağazanın kendi panelinde,
 * iki yerde yönetim iki farklı doğru üretir.
 *
 * Buradaki sayılar okunur ve TEK SORU'ya cevap verir: "mağazam çalışıyor mu,
 * bekleyen bir işim var mı".
 */
export default async function MagazaSayfasi() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;

  const { sz } = await sunucuBicimi(user);
  const magaza = await bayiMagazasi(user.tenantId);

  // Mağaza kurulmamışsa tanıtım + kurulum yönergesi göster.
  if (!magaza) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{sz.magaza.baslik}</h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 1.5rem', fontSize: '0.92rem', lineHeight: 1.6 }}>
          {sz.magaza.tanitimAlt}
        </p>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{sz.magaza.farklarBaslik}</div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', fontSize: '0.88rem', lineHeight: 1.9 }}>
            <li><b>{sz.magaza.farkCihazlarVurgu}</b> {sz.magaza.farkCihazlar}</li>
            <li><b>{sz.magaza.farkTonerVurgu}</b> {sz.magaza.farkToner}</li>
            <li><b>{sz.magaza.farkSiparisVurgu}</b> {sz.magaza.farkSiparis}</li>
            <li><b>{sz.magaza.farkUyumVurgu}</b> {sz.magaza.farkUyum}</li>
          </ul>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '1rem', marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>{sz.magaza.kurulmadiBaslik}</div>
          <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0.35rem 0 0', lineHeight: 1.6 }}>
            {sz.magaza.kurulmadiAlt}
          </p>
        </div>
      </div>
    );
  }

  // Mağaza kurulu — durum özeti.
  /**
   * MAĞAZANIN KENDİ KİMLİĞİ — servis kimliği DEĞİL.
   *
   * Bu sorgular `user.tenantId`'yi doğrudan kullanıyordu ve kimlik ayrımından
   * sonra hepsi 0 dönüyordu (ölçüldü: 0 ürün, gerçekte 519). Sıfır burada
   * masum görünüyor — "daha kurmadım" diye okunur — o yüzden kimse aramaz.
   */
  const magazaId = await magazaKiraciId(user.tenantId);

  const [urun, yayinda, fiyatsiz, yeniSiparis, stokBekleyen] = await Promise.all([
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${magazaId}`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${magazaId} AND durum = 'YAYINDA'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${magazaId} AND fiyat IS NULL`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopOrder" WHERE "tenantId" = ${magazaId} AND durum = 'YENI'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopOrder" WHERE "tenantId" = ${magazaId} AND durum = 'STOK_BEKLIYOR'`,
  ]);

  const s = (r: { c: number }[]) => r[0]?.c ?? 0;

  const kutu = (baslik: string, deger: number, alt: string, uyari = false) => (
    <div
      key={baslik}
      style={{
        flex: '1 1 150px',
        background: 'white',
        border: `1px solid ${uyari && deger > 0 ? '#fde68a' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{baslik}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: uyari && deger > 0 ? '#92400e' : '#111827' }}>{deger}</div>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{alt}</div>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{sz.magaza.baslik}</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {magaza.aktif ? sz.magaza.yayinda : sz.magaza.yayindaDegil} · {magaza.domain ?? magaza.url.replace(/^https?:\/\//, '')}
          </p>
        </div>
        <a
          href={magaza.url}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '0.55rem 1rem', background: '#0ea5e9', color: 'white', borderRadius: 8,
            fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          {sz.magaza.magazayiAc}
        </a>
      </div>

      {!magaza.aktif && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '0.9rem 1rem', marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.88rem' }}>{sz.magaza.yayindaDegilBaslik}</div>
          <p style={{ color: '#92400e', fontSize: '0.83rem', margin: '0.3rem 0 0' }}>
            {sz.magaza.yayindaDegilAlt}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '1rem 0' }}>
        {kutu(sz.magaza.kartYayindaki, s(yayinda), doldur(sz.magaza.kartKayit, { n: s(urun) }))}
        {kutu(sz.magaza.kartFiyatsiz, s(fiyatsiz), sz.magaza.kartFiyatsizAlt, true)}
        {kutu(sz.magaza.kartYeniSiparis, s(yeniSiparis), sz.magaza.kartYeniSiparisAlt, true)}
        {kutu(sz.magaza.kartStokBekleyen, s(stokBekleyen), sz.magaza.kartStokBekleyenAlt, true)}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.95rem' }}>{sz.magaza.beslenmeBaslik}</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', fontSize: '0.86rem', lineHeight: 1.9 }}>
          <li><b>{sz.magaza.beslenmeStokVurgu}</b> {sz.magaza.beslenmeStok}</li>
          <li><b>{sz.magaza.beslenmeUyumVurgu}</b> {sz.magaza.beslenmeUyum}</li>
          <li><b>{sz.magaza.beslenmeSiparisVurgu}</b> {sz.magaza.beslenmeSiparis}</li>
          <li><b>{sz.magaza.beslenmeTonerVurgu}</b> {sz.magaza.beslenmeTonerOn} <Link href="/sarf" style={{ color: '#1d4ed8' }}>{sz.magaza.beslenmeTonerLink}</Link> {sz.magaza.beslenmeTonerSon}</li>
        </ul>
      </div>
    </div>
  );
}
