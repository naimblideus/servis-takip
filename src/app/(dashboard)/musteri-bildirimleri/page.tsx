'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Müşteri panelinden gelen bildirimler.
 *
 * Onay adımı bilerek var: portaldan gelen veri güvenilmeyen girdidir. Sayaç
 * bildiriminde müşterinin yazdığı değer, SON OKUMAYLA yan yana gösteriliyor
 * (faturayı belirleyen sayı odur) — bayi bakmadan onaylamasın.
 */

interface Talep {
  id: string; tur: 'ARIZA' | 'SAYAC'; durum: string; tarih: string;
  aciklama: string | null; sayacBlack: number | null; sayacColor: number | null;
  notu: string | null; ticketId: string | null;
  musteri: { id: string; ad: string; telefon: string } | null;
  cihaz: { id: string; ad: string; seri: string; yer: string | null; sonBlack: number | null; sonColor: number | null; sonTarih: string | null } | null;
}

const sayi = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('tr-TR'));

export default function MusteriBildirimleriPage() {
  const [items, setItems] = useState<Talep[]>([]);
  const [bekleyen, setBekleyen] = useState(0);
  const [durum, setDurum] = useState('BEKLIYOR');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemde, setIslemde] = useState<string | null>(null);
  const [hata, setHata] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/portal-talepleri?durum=${durum}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setBekleyen(d.bekleyen ?? 0); })
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, [durum]);

  useEffect(() => { yukle(); }, [yukle]);

  async function isle(id: string, islem: 'onayla' | 'reddet') {
    let notu: string | undefined;
    if (islem === 'reddet') {
      const c = window.prompt('Müşteriye görünecek kısa not (isteğe bağlı):', '');
      if (c === null) return; // vazgeçti
      notu = c;
    }
    setIslemde(id); setHata('');
    try {
      const r = await fetch(`/api/portal-talepleri/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ islem, notu }),
      });
      const d = await r.json();
      if (!r.ok) { setHata(d.error ?? 'İşlem başarısız'); return; }
      yukle();
    } catch {
      setHata('Bağlantı kurulamadı.');
    } finally {
      setIslemde(null);
    }
  }

  const kart = 'rounded-xl border border-gray-200 bg-white p-4';
  const dugme = 'rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40';

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Müşteri Bildirimleri</h1>
        <p className="mt-1 text-sm text-gray-500">
          Müşterilerinizin kendi panellerinden gönderdiği arıza ve sayaç bildirimleri.
          {bekleyen > 0 && <> <b className="text-amber-700">{bekleyen} bekleyen</b>.</>}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {[['BEKLIYOR', 'Bekleyen'], ['ISLENDI', 'İşlenen'], ['REDDEDILDI', 'Kapatılan'], ['HEPSI', 'Hepsi']].map(([k, l]) => (
          <button key={k} onClick={() => setDurum(k)}
            className={`rounded-lg px-3 py-1.5 text-sm ${durum === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {hata && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{hata}</div>}
      {yukleniyor && <div className="text-sm text-gray-500">Yükleniyor…</div>}

      {!yukleniyor && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <div className="font-semibold">Bildirim yok</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Müşteri paneli açık olan müşterileriniz buradan arıza ve sayaç bildirebilir.
            Panel, müşteri kartındaki <b>Müşteri paneli</b> bölümünden açılır.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className={kart}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    t.tur === 'ARIZA' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    {t.tur === 'ARIZA' ? 'Arıza' : 'Sayaç'}
                  </span>
                  <span className="text-sm font-semibold">
                    {t.musteri
                      ? <Link href={`/customers/${t.musteri.id}`} className="hover:underline">{t.musteri.ad}</Link>
                      : 'Müşteri'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {t.cihaz ? `${t.cihaz.ad}${t.cihaz.yer ? ` · ${t.cihaz.yer}` : ''} · ${t.cihaz.seri}` : 'Cihaz belirtilmemiş'}
                  {' · '}{new Date(t.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {t.musteri?.telefon && (
                <a href={`tel:${t.musteri.telefon.replace(/[^\d+]/g, '')}`}
                  className="shrink-0 text-xs text-blue-600 hover:underline">{t.musteri.telefon}</a>
              )}
            </div>

            {t.tur === 'ARIZA' && t.aciklama && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">{t.aciklama}</p>
            )}

            {t.tur === 'SAYAC' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">Müşterinin bildirdiği</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">
                    S/B {sayi(t.sayacBlack)}
                    {t.sayacColor != null && <> · Renkli {sayi(t.sayacColor)}</>}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">
                    Son okuma{t.cihaz?.sonTarih ? ` · ${new Date(t.cihaz.sonTarih).toLocaleDateString('tr-TR')}` : ''}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-gray-600">
                    {t.cihaz?.sonBlack == null ? 'Hiç okunmamış' : <>
                      S/B {sayi(t.cihaz.sonBlack)}
                      {t.cihaz.sonColor != null && <> · Renkli {sayi(t.cihaz.sonColor)}</>}
                    </>}
                  </div>
                  {/* Fark faturayı belirler — bayi onaylamadan önce görsün. */}
                  {t.cihaz?.sonBlack != null && t.sayacBlack != null && (
                    <div className={`mt-1 text-[11px] font-semibold ${t.sayacBlack < t.cihaz.sonBlack ? 'text-red-600' : 'text-gray-500'}`}>
                      {t.sayacBlack < t.cihaz.sonBlack
                        ? `Bildirilen değer son okumadan DÜŞÜK (${sayi(t.cihaz.sonBlack - t.sayacBlack)} eksik)`
                        : `Fark: ${sayi(t.sayacBlack - t.cihaz.sonBlack)} sayfa`}
                    </div>
                  )}
                </div>
                {t.sayacColor == null && (
                  <p className="col-span-2 text-[11px] text-gray-500">
                    Renkli sayaç bildirilmedi — onaylarsanız renkli fark 0 olarak işlenir.
                  </p>
                )}
              </div>
            )}

            {t.notu && <p className="mt-2.5 text-xs text-gray-500">Not: {t.notu}</p>}

            {t.durum === 'BEKLIYOR' ? (
              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => isle(t.id, 'onayla')} disabled={islemde === t.id}
                  className={`${dugme} bg-gray-900 text-white hover:bg-gray-700`}>
                  {islemde === t.id ? 'İşleniyor…' : t.tur === 'ARIZA' ? 'Onayla — fiş aç' : 'Onayla — sayacı kaydet'}
                </button>
                <button onClick={() => isle(t.id, 'reddet')} disabled={islemde === t.id}
                  className={`${dugme} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
                  Kapat
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
                <span className={`text-xs font-semibold ${t.durum === 'ISLENDI' ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {t.durum === 'ISLENDI' ? 'İşlendi' : 'Kapatıldı'}
                </span>
                {t.ticketId && (
                  <Link href={`/tickets/${t.ticketId}`} className="text-xs text-blue-600 hover:underline">Fişi aç →</Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
