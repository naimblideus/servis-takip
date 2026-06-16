import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PublicFaultReport from '@/components/PublicFaultReport';

// Cihazdaki QR okutulunca buraya gelinir: /qr/DEV-8F3A12
// - Personel (oturumlu) → cihaz detayına gider.
// - Müşteri (oturumsuz) → PUBLIC "Arıza Bildir" formu (login'e zorlamaz).
export default async function QRPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();

  const device = await prisma.device.findUnique({
    where: { publicCode: code },
    select: { id: true, brand: true, model: true, tenant: { select: { name: true } } },
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

  return <PublicFaultReport code={code} deviceName={`${device.brand} ${device.model}`} tenantName={device.tenant?.name || 'Servis'} />;
}
