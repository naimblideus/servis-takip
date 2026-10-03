import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { oturumKullanicisi } from '@/lib/api-auth';
import { tonerDurumu } from '@/lib/toner-veri';
import { sevkBaglami } from '@/lib/toner-sevk-veri';

// GET /api/toner — toner takibi açık cihazların tükenme tahmini (proaktif sevkiyat listesi)
// ve her cihaz için toner sevki bağlamı: ihtiyaç, önerilen toner, yolda olan sevk.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const d = await tonerDurumu(user.tenantId);
  const sevk = await sevkBaglami(user.tenantId, d.takipli);
  return NextResponse.json({
    items: d.takipli.map((i) => ({ ...i, kanallar: sevk.kanallar.get(i.id) ?? null })),
    trackedCount: d.takipli.length,
    // Verimi hiç bilinmeyen cihaz sayısı — ekranda "ikinci toner
    // değişiminde kendiliğinden açılacak" diye gösteriliyor.
    bilinmeyen: d.bilinmeyen,
    olculen: d.olculen,
    urgent: d.urgent,
    canli: d.canli,
    // Sevk için: seçilebilecek tonerler ve stokta hazır toneri olan ihtiyaç sayısı.
    tonerParcalari: sevk.tonerParcalari,
    hazir: sevk.hazir,
  });
}
