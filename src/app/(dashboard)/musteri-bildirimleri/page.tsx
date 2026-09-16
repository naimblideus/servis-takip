'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

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

export default function MusteriBildirimleriPage() {
  const t = useT();
  const b = useBicim();
  const sayi = (n: number | null | undefined) => (n == null ? '—' : b.sayi(n));
  const [items, setItems] = useState<Talep[]>([]);
  const [bekleyen, setBekleyen] = useState(0);
  // Sayı tek başına "acil mi" sorusunu cevaplamıyordu: "3 bekliyor"
  // yazıyor ama üçü de dünkü mü, biri iki haftalık mı belli değildi.
  const [geciken, setGeciken] = useState(0);
  const [enEskiGun, setEnEskiGun] = useState<number | null>(null);
  const [durum, setDurum] = useState('BEKLIYOR');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemde, setIslemde] = useState<string | null>(null);
  const [hata, setHata] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/portal-talepleri?durum=${durum}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setBekleyen(d.bekleyen ?? 0);
        setGeciken(d.geciken ?? 0);
        setEnEskiGun(d.enEskiGun ?? null);
      })
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, [durum]);

  useEffect(() => { yukle(); }, [yukle]);

  async function isle(id: string, islem: 'onayla' | 'reddet') {
    let notu: string | undefined;
    if (islem === 'reddet') {
      const c = window.prompt(t.bildirim.redNotu, '');
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
      if (!r.ok) { setHata(d.error ?? t.bildirim.islemBasarisiz); return; }
      yukle();
    } catch {
      setHata(t.bildirim.baglantiYok);
    } finally {
      setIslemde(null);
    }
  }

  const kart = 'rounded-xl border border-gray-200 bg-white p-4';
  const dugme = 'rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40';

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{t.bildirim.baslik}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t.bildirim.alt}
          {bekleyen > 0 && <> <b className="text-amber-700">{doldur(t.bildirim.bekleyenEk, { n: bekleyen })}</b>.</>}
        </p>
        {/* Müşteri portaldan yazıp dönülmeyince telefonla arıyor ve bayi
            "bize ulaşmadı" diyor — oysa kayıt ekranda duruyor. Gecikeni
            ayrıca söylemek o telefonu önlüyor. */}
        {geciken > 0 && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <b>{doldur(t.bildirim.gecikenVurgu, { n: geciken, gun: enEskiGun ?? 0 })}</b>{' '}
            {t.bildirim.gecikenSon}
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {[['BEKLIYOR', t.bildirim.sekmeBekleyen], ['ISLENDI', t.bildirim.sekmeIslenen], ['REDDEDILDI', t.bildirim.sekmeKapatilan], ['HEPSI', t.bildirim.sekmeHepsi]].map(([k, l]) => (
          <button key={k} onClick={() => setDurum(k)}
            className={`rounded-lg px-3 py-1.5 text-sm ${durum === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {hata && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{hata}</div>}
      {yukleniyor && <div className="text-sm text-gray-500">{t.genel.yukleniyor}</div>}

      {!yukleniyor && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <div className="font-semibold">{t.bildirim.bosBaslik}</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            {t.bildirim.bosAltOn} <b>{t.bildirim.bosAltVurgu}</b> {t.bildirim.bosAltSon}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((x) => (
          <div key={x.id} className={kart}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    x.tur === 'ARIZA' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    {x.tur === 'ARIZA' ? t.bildirim.turAriza : t.bildirim.turSayac}
                  </span>
                  <span className="text-sm font-semibold">
                    {x.musteri
                      ? <Link href={`/customers/${x.musteri.id}`} className="hover:underline">{x.musteri.ad}</Link>
                      : t.bildirim.musteriVarsayilan}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {x.cihaz ? `${x.cihaz.ad}${x.cihaz.yer ? ` · ${x.cihaz.yer}` : ''} · ${x.cihaz.seri}` : t.bildirim.cihazBelirtilmemis}
                  {' · '}{b.tarihSaat(x.tarih)}
                </div>
              </div>
              {x.musteri?.telefon && (
                <a href={`tel:${x.musteri.telefon.replace(/[^\d+]/g, '')}`}
                  className="shrink-0 text-xs text-blue-600 hover:underline">{x.musteri.telefon}</a>
              )}
            </div>

            {x.tur === 'ARIZA' && x.aciklama && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">{x.aciklama}</p>
            )}

            {x.tur === 'SAYAC' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">{t.bildirim.bildirilen}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">
                    {doldur(t.bildirim.sb, { n: sayi(x.sayacBlack) })}
                    {x.sayacColor != null && <> · {doldur(t.bildirim.renkli, { n: sayi(x.sayacColor) })}</>}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <div className="text-[11px] text-gray-500">
                    {t.bildirim.sonOkuma}{x.cihaz?.sonTarih ? ` · ${b.tarih(x.cihaz.sonTarih)}` : ''}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-gray-600">
                    {x.cihaz?.sonBlack == null ? t.bildirim.hicOkunmamis : <>
                      {doldur(t.bildirim.sb, { n: sayi(x.cihaz.sonBlack) })}
                      {x.cihaz.sonColor != null && <> · {doldur(t.bildirim.renkli, { n: sayi(x.cihaz.sonColor) })}</>}
                    </>}
                  </div>
                  {/* Fark faturayı belirler — bayi onaylamadan önce görsün. */}
                  {x.cihaz?.sonBlack != null && x.sayacBlack != null && (
                    <div className={`mt-1 text-[11px] font-semibold ${x.sayacBlack < x.cihaz.sonBlack ? 'text-red-600' : 'text-gray-500'}`}>
                      {x.sayacBlack < x.cihaz.sonBlack
                        ? doldur(t.bildirim.dusukUyari, { n: sayi(x.cihaz.sonBlack - x.sayacBlack) })
                        : doldur(t.bildirim.farkSayfa, { n: sayi(x.sayacBlack - x.cihaz.sonBlack) })}
                    </div>
                  )}
                </div>
                {x.sayacColor == null && (
                  <p className="col-span-2 text-[11px] text-gray-500">
                    {t.bildirim.renkliYok}
                  </p>
                )}
              </div>
            )}

            {x.notu && <p className="mt-2.5 text-xs text-gray-500">{doldur(t.bildirim.not, { n: x.notu })}</p>}

            {x.durum === 'BEKLIYOR' ? (
              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => isle(x.id, 'onayla')} disabled={islemde === x.id}
                  className={`${dugme} bg-gray-900 text-white hover:bg-gray-700`}>
                  {islemde === x.id ? t.bildirim.isleniyor : x.tur === 'ARIZA' ? t.bildirim.onaylaFis : t.bildirim.onaylaSayac}
                </button>
                <button onClick={() => isle(x.id, 'reddet')} disabled={islemde === x.id}
                  className={`${dugme} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
                  {t.bildirim.kapat}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
                <span className={`text-xs font-semibold ${x.durum === 'ISLENDI' ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {x.durum === 'ISLENDI' ? t.bildirim.durumIslendi : t.bildirim.durumKapatildi}
                </span>
                {x.ticketId && (
                  <Link href={`/tickets/${x.ticketId}`} className="text-xs text-blue-600 hover:underline">{t.bildirim.fisiAc}</Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
