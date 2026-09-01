import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PublicFaultReport from '@/components/PublicFaultReport';
import { bayiMagazasi } from '@/lib/magaza-baglanti';

// Cihazdaki QR okutulunca buraya gelinir: /qr/DEV-8F3A12
// - Personel (oturumlu) → cihaz detayına gider.
// - Müşteri (oturumsuz) → PUBLIC "Arıza Bildir" formu (login'e zorlamaz).
export default async function QRPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();

  const device = await prisma.device.findUnique({
    where: { publicCode: code },
    select: { id: true, brand: true, model: true, tenantId: true, tenant: { select: { name: true } } },
  });

  // Personel girişliyse cihaz detayına yönlendir
  if (session) {
    if (!device) redirect('/devices?error=device-not-found');
    redirect(`/devices/${device.id}`);
  }

  // Oturumsuz (müşteri) → public arıza bildirimi
  if (!device) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
        <div>
          <div style={{ fontSize: '2.5rem' }}>❓</div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#374151' }}>Geçersiz kod</h1>
          <p style={{ color: '#6b7280' }}>Bu QR kod bir cihaza ait değil. Lütfen etiketteki kodu kontrol edin.</p>
        </div>
      </div>
    );
  }

  /**
   * ── AYNI QR, İKİ İŞ: ARIZA BİLDİR / SARF SİPARİŞ ET ───────────────
   * Etiket yazıcının üstünde ve oradaki kişinin iki derdi olabilir: makine
   * bozuldu ya da toner bitti. İkincisi için mağaza varsa düğme burada.
   * Mağaza yoksa ya da kapalıysa düğme hiç çizilmiyor — kırık bağlantı
   * göstermek, hiç göstermemekten kötü.
   *
   * QR'ın hedefi hep bu sayfa kalıyor (bayinin kendi alan adı), mağaza
   * adresi değişse de basılmış etiketler çalışmaya devam ediyor.
   */
  const magaza = await bayiMagazasi(device.tenantId);
  const magazaLinki = magaza?.aktif ? `${magaza.url}/c/${encodeURIComponent(code)}` : null;

  return (
    <>
      {magazaLinki && (
        <div style={{ background: '#0b0e14', padding: '1rem 1.5rem', textAlign: 'center', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '.8rem', marginBottom: '.5rem' }}>
            {device.brand} {device.model} — toner ya da parça mı lazım?
          </div>
          <a
            href={magazaLinki}
            style={{ display: 'inline-block', background: '#1b4dff', color: '#fff', fontWeight: 700, padding: '.7rem 1.4rem', borderRadius: 8, textDecoration: 'none', fontSize: '.95rem' }}
          >
            Bu yazıcı için sarf sipariş et →
          </a>
        </div>
      )}
      <PublicFaultReport code={code} deviceName={`${device.brand} ${device.model}`} tenantName={device.tenant?.name || 'Servis'} />
    </>
  );
}
