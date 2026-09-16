import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DeviceEditPanel from '@/components/DeviceEditPanel';
import CounterReadingPanel from '@/components/CounterReadingPanel';
import DeviceQRCode from '@/components/DeviceQRCode';
import TonerPanel from '@/components/TonerPanel';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';

// statusLabel and priorityLabel removed — replaced with counter columns

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  // IDOR koruması: önce kullanıcı, sonra cihazı tenant-scoped çek
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');
  const { sz, b } = await sunucuBicimi(user);

  const device = await prisma.device.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      customer: true,
      serviceTickets: {
        // Çöpe atılan fiş cihazın arıza geçmişinde görünmemeli — hem sayım
        // hem de "bu cihaz kaç kez arızalandı" değerlendirmesi bozuluyordu.
        where: { deletedAt: null },
        include: { assignedUser: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!device) redirect('/devices');

  // ── FİŞ LİSTESİNDEKİ SAYAÇ SÜTUNU ────────────────────────────────────────
  // ÖNCEDEN her satıra device.counterBlack yazılıyordu — yani cihazın GÜNCEL
  // sayacı. Sonuç: yeni bir okuma girilince GEÇMİŞ fişlerin sayacı da değişmiş
  // görünüyordu. Fişin üstündeki sayı, o fiş açıldığında okunan değer olmalı.
  //
  // Tek sorguyla tüm okumaları alıp bellekte eşleştiriyoruz (fiş başına sorgu
  // atmak N+1 olurdu; bir cihazda yüzlerce fiş olabiliyor).
  const okumalar = await prisma.counterReading.findMany({
    where: { tenantId: user.tenantId, deviceId: device.id },
    orderBy: { readingDate: 'asc' },
    select: { id: true, ticketId: true, readingDate: true, counterBlack: true, counterColor: true },
  });
  const fisOkumasi = new Map(okumalar.filter((o) => o.ticketId).map((o) => [o.ticketId!, o]));

  /** Fişin sayacı: kendi okuması varsa o; yoksa fiş tarihine kadarki SON okuma. */
  function fisinSayaci(t: { id: string; createdAt: Date }) {
    const kendi = fisOkumasi.get(t.id);
    if (kendi) return { ...kendi, kendiOkumasi: true };
    // Fiş tarihinden SONRAKİ bir okumayı o fişe yazmak, olmayan bir şeyi
    // belgelemek olur — bu yüzden yalnız tarihe kadar olanlara bakılıyor.
    let bulunan = null as (typeof okumalar)[number] | null;
    for (const o of okumalar) {
      if (o.readingDate <= t.createdAt) bulunan = o; else break;
    }
    return bulunan ? { ...bulunan, kendiOkumasi: false } : null;
  }

  // Tenant varsayılan fiyatlarını al
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { pricePerBlack: true, pricePerColor: true },
  });

  const effectiveBlackPrice = (device as any).pricePerBlack !== null ? Number((device as any).pricePerBlack) : Number(tenant?.pricePerBlack ?? 0);
  const effectiveColorPrice = (device as any).pricePerColor !== null ? Number((device as any).pricePerColor) : Number(tenant?.pricePerColor ?? 0);
  const inclBlack = Number((device as any).includedBlack ?? 0);
  const inclColor = Number((device as any).includedColor ?? 0);
  // Aşım birim fiyatı = cihaz birim fiyatı (pricePerBlack/Color); billing ile tutarlı (tek kaynak)
  const overageBlack = effectiveBlackPrice;
  const overageColor = effectiveColorPrice;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      {/* Başlık */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/devices" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← {sz.menu['/devices']}</Link>
        {/* flexWrap: telefonda cihaz adı + KİRALIK rozeti solda, QR/Düzenle/
            Sil sağda aynı satıra sıkışıyordu; buton grubu ekranın dışına
            taşıyordu (ölçüldü: grup 228 px, toplam taşma 258 px) — teknisyen
            cihazı telefondan düzenleyemiyordu. Artık alt satıra iniyor. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{device.brand} {device.model}</h1>
            {device.isRental && (
              <span style={{ fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>{sz.cihazlar.kiralik}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <DeviceQRCode publicCode={device.publicCode} deviceName={`${device.brand} ${device.model}`} />
            <DeviceEditPanel device={{
              id: device.id, brand: device.brand, model: device.model, serialNo: device.serialNo,
              barcode: (device as any).barcode ?? null,
              location: device.location, isRental: device.isRental, monthlyRent: Number(device.monthlyRent || 0),
              pricePerBlack: (device as any).pricePerBlack !== null ? Number((device as any).pricePerBlack) : null,
              pricePerColor: (device as any).pricePerColor !== null ? Number((device as any).pricePerColor) : null,
              includedBlack: inclBlack,
              includedColor: inclColor,
              warrantyStart: (device as any).warrantyStart ? new Date((device as any).warrantyStart).toISOString() : null,
              warrantyEnd: (device as any).warrantyEnd ? new Date((device as any).warrantyEnd).toISOString() : null,
              warrantyNote: (device as any).warrantyNote ?? null,
            }} />
          </div>
        </div>
        <p style={{ color: '#6b7280' }}>{doldur(sz.cihaz.seriNoEtiket, { n: device.serialNo })}</p>
      </div>

      {/* Cihaz + Müşteri + Kiralık Bilgisi */}
      {/* auto-fit: kiralık cihazda üç kart 375 px'e sığmıyordu, "Kira
          Bilgileri" kartı ekranın dışında kalıyordu. Telefonda tek sütun,
          masaüstünde yine yan yana. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(15rem,1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.cihaz.bilgiler}</h2>
          {[
            [sz.fisYeni.marka, device.brand],
            [sz.fisYeni.model, device.model],
            [sz.fisDetay.seriNo, device.serialNo],
            [sz.cihaz.sayacSiyah, device.counterBlack ? b.sayi(device.counterBlack) : '-'],
            [sz.cihaz.sayacRenkli, device.counterColor ? b.sayi(device.counterColor) : '-'],
            [sz.fisDetay.konum, device.location || '-'],
            [sz.cihaz.qrKodu, device.publicCode],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.genel.musteri}</h2>
          {[
            [sz.belge.fis.adSoyad, device.customer.name],
            [sz.fisDetay.telefon, device.customer.phone],
            [sz.fisYeni.adres, device.customer.address || '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: '500' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: '1rem' }}>
            <Link href={`/customers/${device.customer.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>
              {sz.cihaz.musteriDetayina}
            </Link>
          </div>
        </div>

        {/* Kiralık Bilgi Kartı */}
        {device.isRental && (
          <div style={{ backgroundColor: '#eff6ff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', border: '1px solid #bfdbfe' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem', color: '#1e40af' }}>{sz.cihaz.kiraBilgileri}</h2>
            {([
              [sz.cihaz.aylikKiraKisa, b.para(Number(device.monthlyRent))],
              ...(inclBlack > 0 ? [[sz.cihaz.dahilSiyahKisa, doldur(sz.cihaz.sayfaKisa, { n: b.sayi(inclBlack) })]] : []),
              ...(inclColor > 0 ? [[sz.cihaz.dahilRenkliKisa, doldur(sz.cihaz.sayfaKisa, { n: b.sayi(inclColor) })]] : []),
              [inclBlack > 0 ? sz.cihaz.asimSiyahKisa : sz.cihaz.siyahBirim, b.para(overageBlack)],
              [inclColor > 0 ? sz.cihaz.asimRenkliKisa : sz.cihaz.renkliBirim, b.para(overageColor)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #bfdbfe', fontSize: '0.875rem' }}>
                <span style={{ color: '#1e40af' }}>{k}</span>
                <span style={{ fontWeight: '600', color: '#1e3a8a' }}>{v}</span>
              </div>
            ))}
            {((device as any).pricePerBlack !== null || (device as any).pricePerColor !== null) && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                {sz.cihaz.ozelFiyat}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toner Takibi */}
      <TonerPanel
        deviceId={device.id}
        counterBlack={device.counterBlack ?? null}
        counterColor={device.counterColor ?? null}
        tonerYieldBlack={(device as any).tonerYieldBlack ?? null}
        tonerYieldColor={(device as any).tonerYieldColor ?? null}
        tonerResetBlack={(device as any).tonerResetBlack ?? null}
        tonerResetColor={(device as any).tonerResetColor ?? null}
        tonerChangedAt={(device as any).tonerChangedAt ? new Date((device as any).tonerChangedAt).toISOString() : null}
      />

      {/* Servis Fişleri */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600' }}>{doldur(sz.cihaz.fisler, { n: device.serviceTickets.length })}</h2>
          <Link href={`/tickets/new`} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem',
            borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500'
          }}>{sz.fisler.yeni}</Link>
        </div>

        {device.serviceTickets.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>{sz.cihaz.fisYok}</p>
        ) : (
          /* Sarmalayıcı: bu tablo 577 px, telefonda kap 311 px. Kaydırıcı
             yokken SAYFANIN TAMAMI yana kayıyordu (ölçüldü: #app-main 633/375)
             ve yana kaydırınca cihaz kartları ekrandan çıkıyordu. Sayaç
             tablosunun zaten olan sarmalayıcısının aynısı. */
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '36rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {[sz.fisler.tablo.fisNo, sz.fisler.tablo.ariza, sz.cihaz.sutunSiyahSayac, sz.cihaz.sutunRenkliSayac, sz.fisDetay.teknisyen, sz.genel.tarih, ''].map(h => (
                  <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {device.serviceTickets.map((t, i) => {
                const sayac = fisinSayaci(t);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>{t.ticketNumber}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      {sayac ? b.sayi(sayac.counterBlack) : '—'}
                      {sayac && !sayac.kendiOkumasi && (
                        <span title={sz.cihaz.yildizIpucu}
                          style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 3 }}>*</span>
                      )}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.85rem', fontWeight: '600', color: '#7c3aed' }}>
                      {sayac ? b.sayi(sayac.counterColor) : '—'}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.assignedUser?.name ?? '-'}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>{b.tarih(t.createdAt)}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <Link href={`/tickets/${t.id}`} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none' }}>{sz.genel.detayOk}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        {device.serviceTickets.length > 0 && (
          <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#9ca3af' }}>
            {sz.cihaz.sayacNotuOn} <b>*</b> {sz.cihaz.sayacNotuSon}
          </p>
        )}
      </div>

      {/* Sayaç Okumalar */}
      <CounterReadingPanel deviceId={device.id} />
    </div>
  );
}