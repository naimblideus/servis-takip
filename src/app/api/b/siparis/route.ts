import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { matbaaDili, sinirAsildi } from '@/lib/baski-musteri-uc';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { isOlustur } from '@/lib/baski-is-kayit';
import { isNo, type KalemGirdisi } from '@/lib/baski-is';

export const dynamic = 'force-dynamic';

/**
 * POST /api/b/siparis — sipariş sayfasından gelen iş (oturum yok).
 *
 * İstekten yalnız NE istendiği okunur: ürün, adet, sayfa, seçenek. Tutar
 * sunucuda fiyat listesinden hesaplanır; hangi işletmeye yazılacağı kısa
 * addan bulunur. İş GELEN'de açılır, personel "Kabul et" der.
 * Koruma: IP başına ve işletme başına hız sınırı, bal küpü alanı.
 */
export async function POST(req: Request) {
  try {
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const m = await kisaAddanMatbaa(String(g.kisaAd ?? ''));
    const dil = matbaaDili(m?.tenant.locale);
    if (sinirAsildi(req, { ad: 'siparis', adet: 8, dakika: 10 })) return baskiHatasi('COK_ISTEK', dil);
    if (!m || !m.ayar.siparisAcik) return baskiHatasi('SIPARIS_KAPALI', dil);
    // İnsan bu alanı görmez; dolduran bottur. Başarılı görünür, iş açılmaz.
    if (typeof g.web === 'string' && g.web.trim()) return NextResponse.json({ ok: true }, { status: 201 });
    // Tek bir işletmenin kuyruğu dağıtık bir saldırıyla doldurulmasın.
    if (!rateLimit(`b:siparis-isletme:${m.tenant.id}`, 120, 3_600_000).ok) return baskiHatasi('COK_ISTEK', dil);

    const ad = typeof g.musteriAd === 'string' ? g.musteriAd.trim() : '';
    if (ad.length < 2) return baskiHatasi('AD_SOYAD_GEREKLI', dil);
    const telefon = typeof g.telefon === 'string' ? g.telefon.trim() : '';
    const hane = telefon.replace(/\D/g, '').length;
    if (hane < 10 || hane > 15) return baskiHatasi('TELEFON_GEREKLI', dil);

    const havale = g.odemeYolu === 'HAVALE' && m.ayar.havaleKabul && !!m.tenant.odemeIban;
    const r = await isOlustur(m.tenant.id, {
      musteriAd: ad, telefon, not: typeof g.not === 'string' ? g.not : undefined,
      odemeYolu: havale ? 'HAVALE' : null,
      kalemler: (Array.isArray(g.kalemler) ? g.kalemler.slice(0, 20) : []) as KalemGirdisi[],
    }, null, { personel: false });
    if (!r.ok) return baskiHatasi(r.kod, dil);
    return NextResponse.json({ ok: true, jeton: r.is.jeton, no: isNo(r.is.no) }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
