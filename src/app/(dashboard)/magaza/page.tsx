import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { bayiMagazasi } from '@/lib/magaza-baglanti';

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

  const magaza = await bayiMagazasi(user.tenantId);

  // Mağaza kurulmamışsa tanıtım + kurulum yönergesi göster.
  if (!magaza) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🛒 Nextus Mağaza</h1>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 1.5rem', fontSize: '0.92rem', lineHeight: 1.6 }}>
          Kendi stoğunuzdan beslenen bir e-ticaret vitrini. Ürünleriniz, stoğunuz ve uyumluluk
          bilgileriniz buradaki servis verisinden gelir; ayrıca katalog yönetmeniz gerekmez.
        </p>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Müşterinizin göreceği farklar</div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', fontSize: '0.88rem', lineHeight: 1.9 }}>
            <li><b>Cihazlarım:</b> kendi yazıcılarını ve yalnız onlara uyan sarfı görür.</li>
            <li><b>Toner tahmini:</b> sayaç hızından &ldquo;yaklaşık kaç gün kaldı&rdquo;.</li>
            <li><b>Tekrar sipariş:</b> geçen sefer takılan parçayı tek tıkla ister.</li>
            <li><b>Uyumluluk:</b> tahmin değil — servis kayıtlarınızdan doğrulanmış eşleşmeler.</li>
          </ul>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '1rem', marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>Mağaza henüz kurulmamış</div>
          <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0.35rem 0 0', lineHeight: 1.6 }}>
            Kurulum için Nextus ekibiyle iletişime geçin. Kurulduğunda stoğunuzdan katalog
            otomatik üretilir; siz yalnız fiyatları girersiniz.
          </p>
        </div>
      </div>
    );
  }

  // Mağaza kurulu — durum özeti.
  const [urun, yayinda, fiyatsiz, yeniSiparis, stokBekleyen] = await Promise.all([
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${user.tenantId}`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${user.tenantId} AND durum = 'YAYINDA'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopProduct" WHERE "tenantId" = ${user.tenantId} AND fiyat IS NULL`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopOrder" WHERE "tenantId" = ${user.tenantId} AND durum = 'YENI'`,
    prisma.$queryRaw<{ c: number }[]>`SELECT count(*)::int c FROM shop."ShopOrder" WHERE "tenantId" = ${user.tenantId} AND durum = 'STOK_BEKLIYOR'`,
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
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🛒 Nextus Mağaza</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {magaza.aktif ? 'Yayında' : 'Yayında değil'} · {magaza.domain ?? magaza.url.replace(/^https?:\/\//, '')}
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
          Mağazayı aç →
        </a>
      </div>

      {!magaza.aktif && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '0.9rem 1rem', marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.88rem' }}>Mağaza yayında değil</div>
          <p style={{ color: '#92400e', fontSize: '0.83rem', margin: '0.3rem 0 0' }}>
            Mağaza panelindeki Ayarlar ekranından kurumsal unvanı girip yayına alabilirsiniz.
            Unvan girilmeden mağaza açılmaz: mesafeli satış sözleşmesi o bilgiyle üretiliyor.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '1rem 0' }}>
        {kutu('Yayındaki ürün', s(yayinda), `${s(urun)} kayıt`)}
        {kutu('Fiyatı girilmemiş', s(fiyatsiz), 'yayınlanamaz', true)}
        {kutu('Yeni sipariş', s(yeniSiparis), 'onay bekliyor', true)}
        {kutu('Stok bekleyen', s(stokBekleyen), 'müşteriyle konuşun', true)}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.95rem' }}>Mağaza nasıl besleniyor?</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#374151', fontSize: '0.86rem', lineHeight: 1.9 }}>
          <li><b>Stok</b> buradan okunur — mağaza kendi kopyasını tutmaz, iki farklı sayı olmaz.</li>
          <li><b>Uyumluluk</b> servis fişlerinizden doğar: parçayı hangi cihaza taktıysanız o eşleşme kaydedilir.</li>
          <li><b>Sipariş onaylandığında</b> stok düşümü ve cari kaydı burada, sizin bildiğiniz gibi işlenir.</li>
          <li><b>Toner tahmini</b> için cihazlarda toner verimi ve son değişim sayacı dolu olmalı — <Link href="/sarf" style={{ color: '#1d4ed8' }}>Sarf Takibi</Link> ekranından girilir.</li>
        </ul>
      </div>
    </div>
  );
}
