import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { musteriEkle } from '@/lib/musteri-ekle';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const customers = await prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true, name: true, phone: true, address: true,
        email: true, taxNo: true, createdAt: true,
        devices: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(customers);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    // Kural tek yerde (lib/musteri-ekle): telefon aktarımla aynı biçimde
    // saklanır; numara kayıtlıysa yeni kayıt açılmaz. Eskiden ham yazılıyordu
    // ve aynı numara ikinci kez gelince veritabanı hatası ekrana çıkıyordu.
    // E-posta da yazılır (form soruyordu ama kayıt e-postasız oluşuyordu).
    const s = await musteriEkle(user.tenantId, {
      ad: body.name, telefon: body.phone, adres: body.address, vergiNo: body.taxNo,
      eposta: body.email, onay: body.consent,
    });
    if (s.durum === 'HATA') return ucHatasi(s.kod, 400);
    // Fiş ekranı bu durumda mevcut müşteriyi seçer: tezgah aynı kişiyi ikinci
    // kez açmasın.
    if (s.durum === 'VAR') return ucHatasi('MUSTERI_TELEFON_KAYITLI', 409, { ek: { musteri: s.musteri } });
    return NextResponse.json(s.musteri);
  } catch (e: any) {
    console.error('CUSTOMER CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
