import { NextResponse } from 'next/server';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';
import { magazaYoneticisi, vekilYaniti } from '@/lib/magaza-vekil';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * /api/magaza/siparisler — Servis'teki "Bugün" listesi ve "Siparişler" ekranı.
 *
 * Mağazanın /api/servis/siparisler ucuna vekil. Kurallar mağazada (onaysız
 * sipariş kargoya verilmez, stoğu düşmüş sipariş iptal edilmez…); mesajlar
 * ekrana aynen gider. Kapı: lib/magaza-vekil (yalnız yönetici: onay stoğu
 * düşürür ve cari yazar; demo okur, yazamaz).
 */
const FILTRELER = ['ACIK', 'HEPSI', 'YENI', 'ONAYLANDI', 'KARGODA', 'STOK_BEKLIYOR', 'ONAY_KUYRUKTA', 'HATA'];
const ISLEMLER = [
  'ONAYLA',
  'ODEME_GELDI',
  'ODEME_GELDI_ONAYLA',
  'PARASI_ALINDI_TESLIM',
  'HAZIRLANIYOR',
  'KARGOYA_VER',
  'TESLIM_EDILDI',
  'IPTAL',
  'HAZIR_HABER',
];
const gecersiz = () => NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

export async function GET(req: Request) {
  const k = await magazaYoneticisi();
  if (k.hata) return k.hata;
  const filtre = new URL(req.url).searchParams.get('filtre') ?? 'ACIK';
  if (!FILTRELER.includes(filtre)) return gecersiz();
  const y = await magazaIstegi(`/api/servis/siparisler?tenantId=${encodeURIComponent(k.user.tenantId)}&filtre=${filtre}`);
  return vekilYaniti(magazaYanitiCevir(y));
}

export async function POST(req: Request) {
  const k = await magazaYoneticisi({ kova: 'magaza-siparis', adet: 120 });
  if (k.hata) return k.hata;

  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object' || Array.isArray(g)) return gecersiz();
  // Yalnız bilinen işlemler ve alanlar geçer; kimlik her zaman oturumdan.
  if (typeof g.islem !== 'string' || !ISLEMLER.includes(g.islem)) return gecersiz();
  if (typeof g.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(g.orderId)) return gecersiz();
  const k2 = g.kargo && typeof g.kargo === 'object' && !Array.isArray(g.kargo) ? (g.kargo as Record<string, unknown>) : null;
  const metin = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : undefined);
  const kargo = k2 ? { firma: metin(k2.firma), takip: metin(k2.takip) } : undefined;

  // Onay servise stok düşümü ve cari kaydı olarak geri döner; ağır siparişte uzun sürebilir.
  const y = await magazaIstegi('/api/servis/siparisler', {
    method: 'POST',
    json: { islem: g.islem, orderId: g.orderId, ...(kargo ? { kargo } : {}), tenantId: k.user.tenantId },
    zamanAsimiMs: 45_000,
  });
  return vekilYaniti(magazaYanitiCevir(y));
}
