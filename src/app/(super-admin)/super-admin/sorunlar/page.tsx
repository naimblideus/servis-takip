import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { sunucuDili } from '@/lib/i18n/sunucu';
import { suzgecKur, SORUN_DURUMLARI, SORUN_KUTULARI, SORUN_TURLERI } from '@/lib/sorun';
import { sorunListesi, durumSayilari } from '@/lib/sorun-veri';
import { sorunMetni } from '@/lib/sorun-metin';
import SorunKarti, { type KartVerisi } from './SorunKarti';

export const dynamic = 'force-dynamic';

/**
 * SORUNLAR — ürün içinden gelen "Sorun bildir" kayıtlarının ayıklandığı ekran.
 *
 * Akış basit: haftada bir YENI'leri aç, her birine bir kutu ver (rehbere
 * yazılacak bilgi eksiği / düzeltilecek hata / istek), durumu ilerlet.
 * Çözülünce bildiren bayiye WhatsApp'tan tek tek "yapıldı" de ve
 * "Müşteriye bildirildi"yi işaretle. Excel'e indir: Notion'a aktarmak için.
 *
 * Demo bildirimleri varsayılan HARİÇ: herkese açık demodan gelen gürültü
 * gerçek bayinin sesini bastırmasın; ?demo=1 ile görülür.
 */
type Arama = { durum?: string; kutu?: string; tur?: string; bayi?: string; demo?: string };

export default async function SorunlarSayfasi({ searchParams }: { searchParams: Promise<Arama> }) {
  const admin = await getSuperAdminSession();
  if (!admin) redirect('/super-admin/login');

  const q = await searchParams;
  const dil = await sunucuDili();
  const m = sorunMetni(dil);
  const sp = new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string' && v) as [string, string][]);
  const where = suzgecKur(sp);
  const demoDahil = q.demo === '1';
  const [liste, sayilar] = await Promise.all([sorunListesi(where), durumSayilari(demoDahil)]);

  /** Bir süzgeci değiştirip ötekileri koruyan adres. */
  const adres = (deg: Partial<Arama>) => {
    const yeni = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(deg)) {
      if (v) yeni.set(k, v);
      else yeni.delete(k);
    }
    const s = yeni.toString();
    return `/super-admin/sorunlar${s ? `?${s}` : ''}`;
  };
  const csvAdres = (() => {
    const y = new URLSearchParams(sp);
    y.set('format', 'csv');
    return `/api/super-admin/sorunlar?${y}`;
  })();

  const cip = (aktif: boolean) =>
    `inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-xl text-sm border ${aktif ? 'bg-blue-100 border-blue-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`;

  const zaman = (d: Date | null) =>
    d ? d.toLocaleString(dil === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  const kartlar: KartVerisi[] = liste.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    bayi: s.bayi,
    yetkili: s.yetkili,
    telefon: s.telefon,
    kullaniciAd: s.kullaniciAd,
    rol: s.rol,
    tur: s.tur,
    neYapiyordu: s.neYapiyordu,
    neOldu: s.neOldu,
    sayfa: s.sayfa,
    ekran: s.ekran,
    tarayici: s.tarayici,
    demo: s.demo,
    durum: s.durum,
    kutu: s.kutu,
    yoneticiNotu: s.yoneticiNotu,
    ekranVar: s.ekranVar,
    zaman: zaman(s.createdAt) ?? '',
    tarih: s.createdAt.toLocaleDateString(dil === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long' }),
    bildirildi: zaman(s.bildirildiAt),
  }));

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{m.baslik}</h1>
              <p className="text-gray-500 text-sm mt-1 max-w-3xl">{m.alt}</p>
            </div>
            <a href={csvAdres} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
              {m.csvIndir}
            </a>
          </div>

          {/* Durum sayıları: aynı zamanda durum süzgeci. */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Link href={adres({ durum: undefined })} className={`rounded-xl border px-3 py-2 ${!q.durum ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.hepsi}</div>
              <div className="text-xl font-bold">{Object.values(sayilar).reduce((a, b) => a + b, 0)}</div>
            </Link>
            {SORUN_DURUMLARI.map((d) => (
              <Link key={d} href={adres({ durum: d })} className={`rounded-xl border px-3 py-2 ${q.durum === d ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.durum[d]}</div>
                <div className={`text-xl font-bold ${d === 'YENI' && sayilar[d] > 0 ? 'text-amber-700' : ''}`}>{sayilar[d]}</div>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 w-12">{m.kutuBaslik}</span>
            <Link href={adres({ kutu: undefined })} className={cip(!q.kutu)}>{m.hepsi}</Link>
            <Link href={adres({ kutu: 'YOK' })} className={cip(q.kutu === 'YOK')}>{m.kutuYok}</Link>
            {SORUN_KUTULARI.map((k) => (
              <Link key={k} href={adres({ kutu: k })} className={cip(q.kutu === k)}>{m.kutu[k]}</Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 w-12">{m.turBaslik}</span>
            <Link href={adres({ tur: undefined })} className={cip(!q.tur)}>{m.hepsi}</Link>
            {SORUN_TURLERI.map((t) => (
              <Link key={t} href={adres({ tur: t })} className={cip(q.tur === t)}>{m.tur[t]}</Link>
            ))}
            <Link href={adres({ demo: demoDahil ? undefined : '1' })} className={cip(demoDahil)}>{m.demoDahil}</Link>
            {q.bayi && (
              <Link href={adres({ bayi: undefined })} className={cip(true)}>
                {m.bayiSuzgeci} · {m.suzgeciKaldir}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {kartlar.length === 0 ? (
          <p className="text-gray-500">{m.bos}</p>
        ) : (
          <ul className="space-y-3">
            {kartlar.map((k) => (
              <SorunKarti key={k.id} k={k} m={m} bayiAdresi={adres({ bayi: k.tenantId })} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
