import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { adresCalisiyor, magazaKurdur, vitrinAdi } from '@/lib/magaza-kurulum';
import { magazaKiraciId } from '@/lib/magaza-baglanti';
import { hasModule } from '@/lib/modules';
import { talepKaydet } from '@/lib/talep';

export const dynamic = 'force-dynamic';
// Katalog aktarımı mağaza tarafında on saniyeleri bulabilir.
export const maxDuration = 120;

/**
 * POST /api/magaza/kurulum — "Mağazamı kurun".
 *
 * Bayinin Mağaza ekranı eskiden yalnız "Nextus ekibiyle iletişime geçin"
 * diyordu: düğme yok, bağlantı yok, ilgilenen bayi orada kayboluyordu.
 * Artık tek dokunuş: mağaza kendiliğinden kurulmaya çalışılır (lib/
 * magaza-kurulum) ve sonuç ne olursa olsun platform sahibine TALEP düşer —
 * adres bağlamak ve yayına almak için bayiyi arayacak olan o.
 *
 * Dönüş durumları (ekran bunlara göre konuşur):
 *   HAZIR          mağaza kuruldu, adresi var, panel daveti döndü
 *   ADRES_BEKLIYOR mağaza kuruldu ama alan adı yok (bağlanınca davet WhatsApp'tan)
 *   TALEP          kendiliğinden kurulamadı; talep alındı, elle kurulacak
 *   PAKET_DISI     paketinde Mağaza (SHOP) yok; mağaza açılmadı, teklif için
 *                  talep alındı. Mağaza menüde her pakette görünüyor, ama
 *                  kendiliğinden kurulum yalnız paketinde olana.
 *
 * Mağazası KURULU bayi de buraya basar ("Mağaza paneline girin"): uç
 * idempotent, mevcut mağaza için yalnız yeni bir tek kullanımlık panel
 * daveti döner. O durumda talep DÜŞMEZ — bayi kendi paneline giriyor,
 * platform sahibinin yapacak bir işi yok.
 *
 * DEMO hesap (herkese açık demo, şifresi giriş sayfasında yazılı) mağaza
 * açtıramaz ve talep düşürmez: her ziyaretçi basınca canlıda bir mağaza
 * ve platform sahibine sahte bir talep doğardı.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, hata: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ ok: false, hata: 'User not found' }, { status: 404 });
  if (!yoneticiMi(user)) return NextResponse.json({ ok: false, kod: 'YETKI' }, { status: 403 });

  // Yanlışlıkla üst üste basılmasın; ikinci basış zaten yeni mağaza açmaz.
  // Panel girişi de buradan (telefon + bilgisayar), o yüzden 5.
  const sinir = rateLimit(`magaza-kurulum:${user.tenantId}`, 5, 10 * 60_000);
  if (!sinir.ok) return NextResponse.json({ ok: false, kod: 'SINIR' }, { status: 429 });

  const t = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true, phone: true, email: true, city: true, ownerName: true, demo: true, plan: true, modules: true, marketEnabled: true },
  });
  if (!t) return NextResponse.json({ ok: false, hata: 'Tenant not found' }, { status: 404 });
  if (t.demo) return NextResponse.json({ ok: false, kod: 'DEMO' }, { status: 403 });

  // Paketinde Mağaza olmayan bayiye mağaza açılmaz: platform sahibine teklif
  // talebi düşer. Mağazası zaten kurulu olan (paketi sonradan değişmiş olsa
  // da) aşağıda yalnız panel davetini alır — kendi mağazasından kilitlenmez.
  if (!hasModule(t, 'SHOP') && !(await magazaKiraciId(user.tenantId))) {
    await talepKaydet(
      {
        firma: t.name,
        ad: user.name ?? t.ownerName,
        telefon: t.phone,
        eposta: t.email ?? user.email,
        il: t.city,
        mesaj: `Mağaza istiyor; paketinde Mağaza yok (paket: ${t.plan ?? '—'}). Mağaza açılmadı — fiyat için arayın.`,
        utm_source: 'magaza',
      },
      'magaza'
    ).catch((e) => console.error('[magaza-kurulum] talep kaydedilemedi:', (e as Error).message));
    return NextResponse.json({ ok: true, durum: 'PAKET_DISI' });
  }

  const r = await magazaKurdur({
    tenantId: user.tenantId,
    firma: vitrinAdi(t.name),
    sehir: t.city,
    telefon: t.phone,
    eposta: t.email,
  });

  // Adres hesaplandı ama açılmıyorsa (joker DNS yok) bozuk bağlantı verilmez.
  const adresAcik = r.ok && !!r.adres && !!r.davet && (await adresCalisiyor(r.adres));

  const sonuc = r.ok
    ? r.yeni
      ? `Mağaza KENDİLİĞİNDEN KURULDU: ${r.slug} · ${r.urun} ürün (${r.yayinda} fiyatlı ürün yayına hazır). Mağaza kapalı doğdu; yasal bilgiler bayiden.`
      : `Mağaza zaten vardı (${r.slug}); yeni panel daveti üretildi.`
    : r.kod === 'AYAR_YOK'
      ? 'Kendiliğinden kurulum KAPALI (servis-takip ortamında MAGAZA_API_URL yok). Mağazayı elle kurun.'
      : `Kendiliğinden kurulum BAŞARISIZ: ${r.hata}. Mağazayı elle kurun.`;
  const sonraki = r.ok
    ? adresAcik
      ? `Adres: ${r.adres}. Bayi panel davetini ekranda gördü; yayına alma için arayın.`
      : r.adres
        ? `ADRES AÇILMIYOR: ${r.adres} çözülmüyor (joker DNS yok?). Alan adı bağlayın, sonra mağaza panelinden davet üretip WhatsApp'tan gönderin.`
      : 'ADRES YOK: Coolify\'da alan adı bağlayın, sonra mağaza panelinden davet üretip WhatsApp\'tan gönderin.'
    : '';

  // Talep: yeni kurulumda ve başarısızlıkta platform sahibi bu bayiyi arayacak.
  // Mevcut mağazaya panel girişinde talep yok.
  if (!r.ok || r.yeni) await talepKaydet(
    {
      firma: t.name,
      ad: user.name ?? t.ownerName,
      telefon: t.phone,
      eposta: t.email ?? user.email,
      il: t.city,
      mesaj: [sonuc, sonraki].filter(Boolean).join('\n'),
      utm_source: 'magaza',
    },
    'magaza'
  ).catch((e) => console.error('[magaza-kurulum] talep kaydedilemedi:', (e as Error).message));

  if (r.ok) {
    return NextResponse.json({
      ok: true,
      durum: adresAcik ? 'HAZIR' : 'ADRES_BEKLIYOR',
      yeni: r.yeni,
      davet: adresAcik ? r.davet : null,
      urun: r.urun,
    });
  }
  return NextResponse.json({ ok: true, durum: 'TALEP' });
}
