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
import { UYARI_TURU, UYARI_KATEGORISI, TONER_KRITIK, DURUM_TAZE_MS, type UyariKodu } from '@/lib/sayac-tarama';

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

  // Kiralık değil ama kendi sayfa fiyatı var: kopya başı anlaşmalı müşteri makinesi (lib/invoicing sayfaUcretliMi).
  const kopyaBasi = !device.isRental && ((device as any).pricePerBlack !== null || (device as any).pricePerColor !== null);
  const effectiveBlackPrice = (device as any).pricePerBlack !== null ? Number((device as any).pricePerBlack) : Number(tenant?.pricePerBlack ?? 0);
  const effectiveColorPrice = (device as any).pricePerColor !== null ? Number((device as any).pricePerColor) : Number(tenant?.pricePerColor ?? 0);
  const inclBlack = Number((device as any).includedBlack ?? 0);
  const inclColor = Number((device as any).includedColor ?? 0);
  // Aşım birim fiyatı = cihaz birim fiyatı (pricePerBlack/Color); billing ile tutarlı (tek kaynak)
  const overageBlack = effectiveBlackPrice;
  const overageColor = effectiveColorPrice;

  // ── CİHAZDAN ÖLÇÜLEN DURUM (Ağ Tarayıcı) ─────────────────────────────────
  const olcumAt = device.olcumAt;
  const olcumGun = olcumAt ? Math.floor((Date.now() - olcumAt.getTime()) / 86_400_000) : null;
  const olcumTaze = olcumAt !== null && Date.now() - olcumAt.getTime() <= DURUM_TAZE_MS;
  const uyarilar = (device.cihazUyarilari ?? []) as UyariKodu[];
  const uyariAdi = (u: UyariKodu) => (sz.tarayici.uyari as Record<string, string>)[u] ?? u;
  const servisUyarilari = uyarilar.filter((u) => UYARI_TURU[u] === 'SERVIS');
  const acikFis = device.serviceTickets.find((t) => t.status !== 'DELIVERED' && t.status !== 'CANCELLED');
  const fisQ = new URLSearchParams({ cihaz: device.publicCode });
  if (servisUyarilari.length) {
    fisQ.set('sorun', doldur(sz.tarayici.fisSorun, { uyarilar: servisUyarilari.map(uyariAdi).join(', ') }));
    const k = servisUyarilari.map((u) => UYARI_KATEGORISI[u]).find(Boolean);
    if (k) fisQ.set('kategori', k);
  }
  const rozetRengi = (u: UyariKodu) => UYARI_TURU[u] === 'SERVIS' ? ['#fee2e2', '#991b1b'] : UYARI_TURU[u] === 'SARF' ? ['#fef3c7', '#92400e'] : ['#f3f4f6', '#4b5563'];

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
            {kopyaBasi && (
              <span style={{ fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>{sz.cihaz.kopyaBasiRozet}</span>
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

      {/* Kopya başı anlaşma: müşteri makinesi, sayfa başı ücretli */}
      {kopyaBasi && (
        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', border: '1px solid #bbf7d0', marginTop: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#166534' }}>{sz.cihaz.kopyaBasiBaslik}</h2>
          {([
            [doldur(sz.cihaz.sayfaSiyah, { birim: b.simge }), (device as any).pricePerBlack !== null ? b.para(Number((device as any).pricePerBlack)) : '—'],
            [doldur(sz.cihaz.sayfaRenkli, { birim: b.simge }), (device as any).pricePerColor !== null ? b.para(Number((device as any).pricePerColor)) : '—'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #bbf7d0', fontSize: '0.875rem' }}>
              <span style={{ color: '#166534' }}>{k}</span>
              <span style={{ fontWeight: '600', color: '#14532d' }}>{v}</span>
            </div>
          ))}
          <p style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#166534' }}>{sz.cihaz.kopyaBasiNot}</p>
        </div>
      )}

      {/* Cihazdan ölçülen durum — yazıcının kendi söylediği (Ağ Tarayıcı) */}
      {olcumAt && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem 1.5rem', marginTop: '1rem', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h2 style={{ fontWeight: '600', margin: 0 }}>{sz.cihaz.olcumBaslik}</h2>
            <span style={{ fontSize: '0.8rem', color: olcumTaze ? '#6b7280' : '#b45309', fontWeight: olcumTaze ? 400 : 600 }}>
              {olcumTaze ? doldur(sz.cihaz.olcumSon, { zaman: b.tarihSaat(olcumAt) }) : doldur(sz.cihaz.olcumEski, { n: olcumGun ?? 0 })}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {([[sz.tarayici.sb, device.olcumSiyah], [sz.tarayici.renkli, device.olcumRenkli]] as [string, number | null][])
              .filter(([, v]) => v !== null)
              .map(([ad, v]) => {
                const kritik = (v as number) <= TONER_KRITIK;
                return (
                  <div key={ad} style={{ minWidth: 140 }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{doldur(sz.cihaz.olcumToner, { ad })}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: kritik ? '#b91c1c' : '#111827' }}>{b.yuzde(v)}</div>
                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${v}%`, height: '100%', background: kritik ? '#dc2626' : (v as number) <= 30 ? '#d97706' : '#059669' }} />
                    </div>
                  </div>
                );
              })}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.85rem', alignItems: 'center' }}>
            {uyarilar.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: '#166534' }}>✓ {sz.cihaz.uyariYok}</span>
            ) : uyarilar.map((u) => {
              const [bg, fg] = rozetRengi(u);
              return <span key={u} style={{ background: bg, color: fg, padding: '0.12rem 0.55rem', borderRadius: 999, fontWeight: 700, fontSize: '0.76rem' }}>{uyariAdi(u)}</span>;
            })}
            {servisUyarilari.length > 0 && !acikFis && (
              <Link href={`/tickets/new?${fisQ.toString()}`} style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', background: '#dc2626', color: 'white', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>
                {sz.tarayici.fisAc}
              </Link>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.7rem 0 0' }}>{sz.cihaz.olcumNot}</p>
        </div>
      )}

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
          <Link href={`/tickets/new?${fisQ.toString()}`} style={{
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