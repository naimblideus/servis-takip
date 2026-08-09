import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { jetondanMusteri, portalVerisi } from '@/lib/portal';
import CihazListesi from './CihazListesi';

/**
 * MÜŞTERİ PORTALI — /m/<jeton>
 *
 * Bayinin müşterisi buraya WhatsApp'tan gelen bağlantıyla girer. Şifre yok:
 * bayinin müşterisi bir parola daha yönetmez, yönetmeyince portalı kullanmaz.
 *
 * Bu sayfa hangi verinin görüneceğine KARAR VERMEZ — o karar src/lib/portal.ts
 * içinde tek yerde toplandı. Burada yalnızca gösterim var.
 */

// Arama motorlarına KAPALI. Özel bağlantı Google'a düşerse özel olmaktan çıkar.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Müşteri Paneli',
};

export const dynamic = 'force-dynamic';

const tl = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
const gun = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

const DURUM_RENK: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700 ring-slate-200',
  IN_SERVICE: 'bg-amber-50 text-amber-800 ring-amber-200',
  WAITING_FOR_PART: 'bg-orange-50 text-orange-800 ring-orange-200',
  READY: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  DELIVERED: 'bg-slate-50 text-slate-500 ring-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-400 ring-slate-200',
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const musteri = await jetondanMusteri(token);
  if (!musteri) notFound();

  const v = await portalVerisi(musteri);

  // "Müşteri kullanıyor mu" bayide görünsün. Sayfayı bekletmez.
  prisma.customer
    .update({ where: { id: musteri.id }, data: { portalLastSeen: new Date() } })
    .catch(() => {});

  const acikFisler = v.fisler.filter((f) => f.acik);
  const gecmisFisler = v.fisler.filter((f) => !f.acik);
  const acikFaturalar = v.faturalar.filter((f) => f.kalan > 0.005);
  const telHref = v.firma.telefon ? `tel:${v.firma.telefon.replace(/[^\d+]/g, '')}` : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Başlık: bayinin adı öne çıkar. Müşteri bizi değil, bayisini tanır. ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-2xl px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Müşteri Paneli</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{v.firma.ad}</h1>
          <p className="mt-1 text-sm text-slate-500">{v.musteri.ad}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 space-y-6">
        {/* ── Bakiye: "ne kadar borcum var" en sık gelen telefon. En üstte. ── */}
        <section className={`rounded-2xl border p-5 ${v.bakiye > 0.005 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="text-xs font-medium text-slate-600">Güncel bakiyeniz</div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${v.bakiye > 0.005 ? 'text-amber-900' : 'text-emerald-800'}`}>
            {tl(v.bakiye)}
          </div>
          <div className="mt-1.5 text-xs text-slate-600">
            {v.bakiye > 0.005
              ? `${acikFaturalar.length} açık fatura`
              : 'Ödenmemiş faturanız yok'}
          </div>
        </section>

        {/* ── Açık servis fişleri ── */}
        {acikFisler.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-slate-700">Devam eden servis</h2>
            <div className="space-y-2.5">
              {acikFisler.map((f) => (
                <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{f.cihaz ?? 'Cihaz'}</div>
                      <div className="mt-0.5 text-xs text-slate-500">Fiş {f.no} · {gun(f.tarih)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${DURUM_RENK[f.durum] ?? DURUM_RENK.NEW}`}>
                      {f.durumEtiket}
                    </span>
                  </div>
                  {f.ariza && <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{f.ariza}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Cihazlar + talep düğmeleri ── */}
        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-slate-700">
            Cihazlarınız {v.cihazlar.length > 0 && <span className="font-normal text-slate-400">({v.cihazlar.length})</span>}
          </h2>
          {v.cihazlar.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Kayıtlı cihazınız görünmüyor.
            </div>
          ) : (
            <CihazListesi token={token} cihazlar={v.cihazlar} />
          )}
        </section>

        {/* ── Müşterinin kendi talepleri: gönderdiği kayboldu sanmasın ── */}
        {v.talepler.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-slate-700">Bildirimleriniz</h2>
            <div className="space-y-2">
              {v.talepler.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {t.tur === 'ARIZA' ? 'Arıza bildirimi' : 'Sayaç bildirimi'}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                      t.durum === 'ISLENDI' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                        : t.durum === 'REDDEDILDI' ? 'bg-slate-100 text-slate-500 ring-slate-200'
                          : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                      {t.durum === 'ISLENDI' ? 'İşleme alındı' : t.durum === 'REDDEDILDI' ? 'Kapatıldı' : 'İletildi'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{gun(t.tarih)}</div>
                  {t.notu && <p className="mt-1.5 text-xs text-slate-600">Yanıt: {t.notu}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Faturalar ── */}
        {v.faturalar.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-sm font-semibold text-slate-700">Faturalar</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {v.faturalar.map((f, i) => (
                <div key={f.no} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.no}</div>
                    <div className="text-xs text-slate-500">{gun(f.tarih)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{tl(f.tutar)}</div>
                    {f.kalan > 0.005
                      ? <div className="text-xs text-amber-700 tabular-nums">Kalan {tl(f.kalan)}</div>
                      : <div className="text-xs text-emerald-700">Ödendi</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Geçmiş servisler ── */}
        {gecmisFisler.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:hidden">
              Geçmiş servisler ({gecmisFisler.length})
              <span className="ml-1 font-normal text-slate-400 group-open:hidden">— göster</span>
            </summary>
            <div className="mt-2.5 space-y-2">
              {gecmisFisler.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{f.cihaz ?? 'Cihaz'}</div>
                      <div className="text-xs text-slate-500">Fiş {f.no} · {gun(f.tarih)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {f.tutar > 0 && <div className="text-sm font-semibold tabular-nums">{tl(f.tutar)}</div>}
                      {/* Kapanmamış eski fiş burada; durumu gizlenmiyor, yalnız
                          "devam eden servis" başlığı altında değil. */}
                      {f.durum !== 'DELIVERED' && (
                        <div className="text-[11px] text-slate-400">{f.durumEtiket}</div>
                      )}
                    </div>
                  </div>
                  {f.yapilan && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{f.yapilan}</p>}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── İletişim: portal telefonun yerini almaz, kolaylaştırır ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold">{v.firma.ad}</div>
          {v.firma.adres && <div className="mt-1 text-xs text-slate-500">{v.firma.adres}</div>}
          {telHref && (
            <a href={telHref} className="mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">
              Servisi ara · {v.firma.telefon}
            </a>
          )}
        </section>

        <p className="pb-4 text-center text-[11px] leading-relaxed text-slate-400">
          Bu sayfa size özeldir. Bağlantıyı paylaşmayın — bağlantıya sahip herkes
          bu bilgileri görebilir.
        </p>
      </main>
    </div>
  );
}
