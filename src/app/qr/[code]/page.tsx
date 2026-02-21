import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

// QR kod okutunca buraya gelir: /qr/DEV-8F3A12
// Giriş yapmadıysa login'e yönlendirir, yaptıysa cihaz detayına gider
export default async function QRRedirectPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const session = await auth();

    if (!session) {
        // Login sayfasına yönlendir, giriş sonrası geri /qr/CODE'a dönecek
        redirect(`/login?callbackUrl=/qr/${code}`);
    }

    // publicCode ile cihazı bul
    const device = await prisma.device.findUnique({
        where: { publicCode: code },
    });

    if (!device) {
        redirect('/devices?error=device-not-found');
    }

    // Cihaz detay sayfasına yönlendir
    redirect(`/devices/${device.id}`);
}
