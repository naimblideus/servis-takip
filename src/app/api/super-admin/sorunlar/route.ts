import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { csvMetni, csvBasliklari, csvDosyaAdi } from '@/lib/csv';
import { suzgecKur, csvSatiri, CSV_SUTUNLARI } from '@/lib/sorun';
import { sorunListesi } from '@/lib/sorun-veri';
import { sorunMetni } from '@/lib/sorun-metin';

/**
 * GET /api/super-admin/sorunlar — bildirim listesi (yenisi üstte).
 *   ?durum ?kutu ?tur ?bayi ?demo=1   süzgeçler (demo varsayılan HARİÇ)
 *   ?format=csv                        Excel'de açılan dosya (Notion'a aktarmak için)
 *
 * Görüntü verisi listede de CSV'de de YOK: yalnız var/yok. Görüntü tek
 * kayıt ucundan (sorunlar/[id]/ekran) tıklayınca gelir.
 */
export async function GET(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const where = suzgecKur(sp);

  if (sp.get('format') === 'csv') {
    const m = sorunMetni(await sunucuDili());
    const liste = await sorunListesi(where, 5000);
    const govde = csvMetni(
      CSV_SUTUNLARI.map((k) => m.csv[k]),
      liste.map((s) => csvSatiri(s, m.evet, m.hayir)),
    );
    const tarih = new Date().toISOString().slice(0, 10);
    return new NextResponse(govde, { headers: csvBasliklari(csvDosyaAdi('sorunlar', tarih)) });
  }

  const liste = await sorunListesi(where);
  return NextResponse.json({ liste }, { headers: { 'Cache-Control': 'no-store' } });
}
