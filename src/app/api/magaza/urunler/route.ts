import { NextResponse } from 'next/server';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';
import { magazaYoneticisi, vekilYaniti } from '@/lib/magaza-vekil';

export const dynamic = 'force-dynamic';

/**
 * /api/magaza/urunler — Servis'teki "Ürünler ve stok" ekranı.
 *
 * Mağazanın /api/servis/urunler ucuna vekil. Kural mağazada (fiyatsız ürün
 * yayınlanmaz; yayındaki ürünün fiyatı silinirse taslağa düşer); mesaj
 * ekrana aynen gider. Kapı: lib/magaza-vekil (yalnız yönetici, demo yazamaz).
 */
const FILTRELER = ['HEPSI', 'FIYATSIZ', 'YAYINDA', 'TASLAK'];
const gecersiz = () => NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

export async function GET(req: Request) {
  const k = await magazaYoneticisi();
  if (k.hata) return k.hata;
  const q = new URL(req.url).searchParams;
  const filtre = q.get('filtre') ?? 'HEPSI';
  if (!FILTRELER.includes(filtre)) return gecersiz();
  const arama = (q.get('q') ?? '').slice(0, 80);
  const sayfa = String(Math.min(500, Math.max(1, parseInt(q.get('sayfa') ?? '1', 10) || 1)));
  const p = new URLSearchParams({ tenantId: k.user.tenantId, filtre, q: arama, sayfa });
  const y = await magazaIstegi(`/api/servis/urunler?${p.toString()}`);
  return vekilYaniti(magazaYanitiCevir(y));
}

export async function POST(req: Request) {
  const k = await magazaYoneticisi({ kova: 'magaza-urun', adet: 300 });
  if (k.hata) return k.hata;

  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return gecersiz();
  if (typeof g.urunId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(g.urunId)) return gecersiz();
  if (g.fiyat !== undefined && (typeof g.fiyat !== 'string' || g.fiyat.length > 24)) return gecersiz();
  if (g.durum !== undefined && g.durum !== 'YAYINDA' && g.durum !== 'TASLAK') return gecersiz();

  // Yalnız bilinen alanlar geçer; kimlik her zaman oturumdan.
  const y = await magazaIstegi('/api/servis/urunler', {
    method: 'POST',
    json: {
      islem: 'KAYDET',
      urunId: g.urunId,
      ...(g.fiyat !== undefined ? { fiyat: g.fiyat } : {}),
      ...(g.durum !== undefined ? { durum: g.durum } : {}),
      tenantId: k.user.tenantId,
    },
  });
  return vekilYaniti(magazaYanitiCevir(y));
}
