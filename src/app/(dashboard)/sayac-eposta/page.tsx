'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

interface Kayit {
  id: string;
  konu: string | null;
  gonderen: string | null;
  seri: string | null;
  siyah: number | null;
  renkli: number | null;
  durum: string;
  hata: string | null;
  tarih: string;
  onizleme: string;
}

interface Cihaz {
  id: string; brand: string; model: string; serialNo: string;
  location?: string | null; customer?: { name: string } | null;
}

interface FiloSatiri {
  deviceId: string;
  seri: string;
  marka: string;
  model: string;
  musteri: string | null;
  telefon: string | null;
  musteriId: string | null;
  durum: 'OTOMATIK' | 'DURDU' | 'KURULMADI';
  sonGonderim: string | null;
  sessizGun: number | null;
  araGun: number | null;
  gonderimSayisi: number;
  aciklama: string;
  aciklamaKod?: { kod: string; ara?: number; sessiz?: number; gun?: number };
}

/** Sunucudan gelen kodu kullanıcının dilinde cümleye çevirir. */
function durumMetni(t: Sozluk, f: { aciklama: string; aciklamaKod?: { kod: string; ara?: number; sessiz?: number; gun?: number } }): string {
  const k = f.aciklamaKod;
  if (!k) return f.aciklama;
  if (k.kod === 'HIC') return t.sayacEposta.durumHic;
  if (k.kod === 'DURDU_ARALIKLI') return doldur(t.sayacEposta.durumDurduAralikli, { ara: k.ara ?? 0, sessiz: k.sessiz ?? 0 });
  if (k.kod === 'DURDU_TEK') return doldur(t.sayacEposta.durumDurduTek, { sessiz: k.sessiz ?? 0 });
  if (k.kod === 'BUGUN') return t.sayacEposta.durumBugun;
  if (k.kod === 'GUN_ONCE') return doldur(t.sayacEposta.durumGunOnce, { gun: k.gun ?? 0 });
  return f.aciklama;
}

interface FiloOzeti {
  toplam: number; otomatik: number; durdu: number; kurulmadi: number; oran: number | null;
}

/**
 * CİHAZDAN GELEN SAYAÇLAR.
 *
 * ── İKİ AYRI SORU, TEK EKRAN ──────────────────────────────────────────
 * 1. KURULUM: hangi cihaz otomatik gönderiyor, hangisi susmuş?
 * 2. KUYRUK: gelen ama okunamayan e-postalar.
 *
 * Eskiden yalnız ikincisi vardı. Ölçüldüğünde 872 cihazlı bayide otomatik
 * gönderen cihaz sayısı SIFIRDI ve bunu hiçbir ekran söylemiyordu — kuyruk
 * boş olduğu için her şey yolunda görünüyordu. Boş kuyruk "kanal çalışıyor"
 * demek değil; "kimse göndermiyor" da olabilir. Üstteki bölüm o farkı
 * söylüyor.
 *
 * ── SIRALAMA PARAYA GÖRE ──────────────────────────────────────────────
 * Önce DURDU gelir: gönderirken susan cihaz görünmez bir arızadır, bayi son
 * bilinen sayaçtan faturaya devam eder ve aradaki sayfalar hiç faturalanmaz.
 * Kurulmamış cihaz ise bilinen bir eksiktir, sayaç turunda elle okunur.
 */
const LISTE_ADIMI = 40;

export default function SayacEpostaPage() {
  const t = useT();
  const b = useBicim();
  const [items, setItems] = useState<Kayit[]>([]);
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hepsi, setHepsi] = useState(false);
  const [acik, setAcik] = useState<string | null>(null);
  const [dev, setDev] = useState('');
  const [cb, setCb] = useState('');
  const [cc, setCc] = useState('');
  // Burada TEK kutu vardı ve üstünde "Sayaç sıfırlandı" yazıyordu — ama uç
  // sebebi almadığı için sistem bunu CIHAZ_DEGISTI sayıp farkı SIFIR
  // yazıyordu. Yani etiket bir şey vaat ediyor, sistem başkasını yapıyordu ve
  // aradaki fark doğrudan para. Sayaç Turu ile cihaz kartında sebep zaten
  // soruluyor; üçüncü ekran da aynı soruyu sormalı.
  const [resetTur, setResetTur] = useState<'CIHAZ_DEGISTI' | 'SAYAC_SIFIRLANDI' | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);

  const [filo, setFilo] = useState<FiloSatiri[]>([]);
  const [ozet, setOzet] = useState<FiloOzeti | null>(null);
  const [filoSuzgec, setFiloSuzgec] = useState<'IS' | 'OTOMATIK' | 'HEPSI'>('IS');
  const [filoLimit, setFiloLimit] = useState(LISTE_ADIMI);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/sayac/eposta/bekleyen${hepsi ? '?hepsi=1' : ''}`)
      .then(r => r.json()).then(d => setItems(d.items || []))
      .catch(() => {}).finally(() => setYukleniyor(false));
  }, [hepsi]);

  useEffect(() => { yukle(); }, [yukle]);
  useEffect(() => {
    fetch('/api/devices').then(r => r.json())
      .then(d => setCihazlar(Array.isArray(d) ? d : (d.devices ?? [])))
      .catch(() => {});
    fetch('/api/sayac/otomatik-durum').then(r => r.json())
      .then(d => { setFilo(d.cihazlar ?? []); setOzet(d.ozet ?? null); })
      .catch(() => {});
  }, []);

  /** Paneli açarken okunan değerlerle DOLDUR — bayi yalnızca yanlışı düzeltsin. */
  const ac = (k: Kayit) => {
    setAcik(k.id); setHata(null); setResetTur(null);
    setCb(k.siyah != null ? String(k.siyah) : '');
    setCc(k.renkli != null ? String(k.renkli) : '');
    // Seri okunduysa cihazı önceden seç
    const eslesen = k.seri ? cihazlar.find(c => c.serialNo === k.seri) : null;
    setDev(eslesen?.id ?? '');
  };

  const gonder = async (body: any) => {
    setMesgul(body.id); setHata(null);
    try {
      const r = await fetch('/api/sayac/eposta/bekleyen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setHata(d.error || t.sayacEposta.islemYapilamadi); return; }
      if (d.uyari) alert('⚠️ ' + d.uyari);
      setAcik(null); yukle();
    } finally { setMesgul(null); }
  };

  const tarih = (iso: string) => b.tarihSaat(iso);

  const bekleyen = items.filter(i => i.durum === 'BEKLIYOR' || i.durum === 'HATA').length;

  const filoListe = filo.filter(f =>
    filoSuzgec === 'HEPSI' ? true
      : filoSuzgec === 'OTOMATIK' ? f.durum === 'OTOMATIK'
        : f.durum !== 'OTOMATIK');

  const rozet = (d: FiloSatiri['durum']) =>
    d === 'OTOMATIK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : d === 'DURDU' ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-gray-50 text-gray-600 border-gray-200';

  const rozetAd = (d: FiloSatiri['durum']) =>
    d === 'OTOMATIK' ? t.sayacEposta.rozetOtomatik : d === 'DURDU' ? t.sayacEposta.rozetDurdu : t.sayacEposta.rozetKurulmadi;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sayacEposta.baslik}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t.sayacEposta.altOn} <b>{t.sayacEposta.altVurgu}</b>{t.sayacEposta.altSon}
          </p>
        </div>
        <Link href="/sayac-turu" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          {t.sayacEposta.sayacTuru}
        </Link>
      </div>

      {/* ── KURULUM DURUMU ───────────────────────────────────────────────
          Kuyruk boşken "her şey yolunda" görünüyordu. Boş kuyruk kanalın
          çalıştığını değil, kimsenin göndermediğini de anlatabilir. */}
      {ozet && ozet.toplam > 0 && (
        <section className="mt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{ozet.otomatik}</div>
              <div className="text-sm text-gray-600">
                {t.sayacEposta.otomatikGonderiyor}
                {ozet.oran !== null && <span className="ml-1 text-gray-400">· {b.yuzde(ozet.oran)}</span>}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className={`text-2xl font-bold tabular-nums ${ozet.durdu ? 'text-red-700' : ''}`}>{ozet.durdu}</div>
              <div className="text-sm text-gray-600">{t.sayacEposta.durdu}</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-2xl font-bold tabular-nums">{ozet.kurulmadi}</div>
              <div className="text-sm text-gray-600">{t.sayacEposta.hicGondermedi}</div>
            </div>
          </div>

          {ozet.durdu > 0 && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <b>{doldur(t.sayacEposta.durduUyariVurgu, { n: ozet.durdu })}</b> {t.sayacEposta.durduUyariSon}
            </p>
          )}

          {ozet.otomatik === 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t.sayacEposta.hicUyari}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {([
              ['IS', doldur(t.sayacEposta.sekmeIs, { n: ozet.durdu + ozet.kurulmadi })],
              ['OTOMATIK', doldur(t.sayacEposta.sekmeCalisan, { n: ozet.otomatik })],
              ['HEPSI', doldur(t.sayacEposta.sekmeHepsi, { n: ozet.toplam })],
            ] as const).map(([k, ad]) => (
              <button key={k} type="button"
                onClick={() => { setFiloSuzgec(k); setFiloLimit(LISTE_ADIMI); }}
                className={`rounded border px-3 py-1.5 text-sm ${filoSuzgec === k ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
                {ad}
              </button>
            ))}
          </div>

          {filoListe.length === 0 ? (
            <p className="mt-4 rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
              {t.sayacEposta.grupBos}
            </p>
          ) : (
            <>
              <ul className="mt-4 divide-y rounded-lg border bg-white">
                {filoListe.slice(0, filoLimit).map(f => (
                  <li key={f.deviceId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {f.marka} <span className="font-mono">{f.model}</span>
                        <span className="ml-2 font-mono text-xs text-gray-500">{f.seri}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                        {f.musteri && <span className="truncate">{f.musteri}</span>}
                        <span>{durumMetni(t, f)}</span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${rozet(f.durum)}`}>
                      {rozetAd(f.durum)}
                    </span>
                    <Link href={`/devices/${f.deviceId}`}
                      className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
                      {t.sayacEposta.cihazKarti}
                    </Link>
                  </li>
                ))}
              </ul>
              {filoListe.length > filoLimit && (
                <button type="button" onClick={() => setFiloLimit(n => n + LISTE_ADIMI)}
                  className="mt-3 rounded border px-3 py-2 text-sm hover:bg-gray-50">
                  {doldur(t.sayacEposta.dahaGoster, { n: filoListe.length - filoLimit })}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* ── OKUNAMAYAN E-POSTALAR ────────────────────────────────────── */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t.sayacEposta.kuyrukBaslik}
          {bekleyen > 0 && (
            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {doldur(t.sayacEposta.bekliyorRozet, { n: bekleyen })}
            </span>
          )}
        </h2>
        <button type="button" onClick={() => setHepsi(!hepsi)}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          {hepsi ? t.sayacEposta.sadeceBekleyen : t.sayacEposta.tumunuGoster}
        </button>
      </div>

      {yukleniyor && <p className="mt-4 text-sm text-gray-500">{t.genel.yukleniyor}</p>}

      {!yukleniyor && items.length === 0 && (
        <div className="mt-4 rounded-lg border bg-white p-10 text-center">
          <div className="text-sm font-semibold text-gray-700">
            {hepsi ? t.sayacEposta.hicEposta : t.sayacEposta.bekleyenYok}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {t.sayacEposta.kuyrukBosAlt}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items.map(k => {
          const bekliyor = k.durum === 'BEKLIYOR' || k.durum === 'HATA';
          return (
            <div key={k.id} className={`rounded-lg border bg-white p-4 ${bekliyor ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-sm font-semibold">
                  {k.seri ? <>{t.sayacEposta.seriOn} <code className="font-mono">{k.seri}</code></> : t.sayacEposta.seriTanimadi}
                  {k.durum === 'ISLENDI' && (
                    <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{t.sayacEposta.durumIslendi}</span>
                  )}
                  {k.durum === 'HATA' && (
                    <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{t.sayacEposta.durumHata}</span>
                  )}
                  {k.durum === 'ATLANDI' && (
                    <span className="ml-2 rounded-full border bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600">{t.sayacEposta.durumAtlandi}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{tarih(k.tarih)}</div>
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {k.konu || t.sayacEposta.konuYok}{k.gonderen ? ` · ${k.gonderen}` : ''}
                {(k.siyah != null || k.renkli != null) && (
                  <>{doldur(t.sayacEposta.okunan, {
                    sb: k.siyah != null ? doldur(t.sayacEposta.okunanSb, { n: b.sayi(k.siyah) }) : t.sayacEposta.okunanSbYok,
                  })}
                    {k.renkli != null ? doldur(t.sayacEposta.okunanRenkli, { n: b.sayi(k.renkli) }) : ''}</>
                )}
              </div>

              {k.hata && (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {k.hata}
                </div>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-500">{t.sayacEposta.icerigiGor}</summary>
                <div className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded border bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                  {k.onizleme}
                </div>
              </details>

              {acik === k.id ? (
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">{t.sayacEposta.islePanel}</div>
                  <select value={dev} onChange={e => setDev(e.target.value)}
                    className="mt-2 w-full rounded border px-3 py-2 text-sm">
                    <option value="">{t.sayacEposta.cihazSecin}</option>
                    {cihazlar.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.brand} {c.model} · {c.serialNo}{c.customer?.name ? ` — ${c.customer.name}` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="min-w-[130px] flex-1">
                      <label className="text-xs font-semibold text-sky-800">{t.sayacEposta.siyahSayac}</label>
                      <input value={cb} onChange={e => setCb(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                    </div>
                    <div className="min-w-[130px] flex-1">
                      <label className="text-xs font-semibold text-sky-800">{t.sayacEposta.renkliSayac}</label>
                      <input value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-bold text-sky-800">
                      {t.wa.sebepBaslik}
                    </div>
                    <div className="mt-1 grid gap-1">
                      {([
                        ['CIHAZ_DEGISTI', t.wa.sebepCihazBaslik, t.wa.sebepCihazAlt],
                        ['SAYAC_SIFIRLANDI', t.wa.sebepSifirBaslik, t.wa.sebepSifirAlt],
                      ] as const).map(([tur, baslik, aciklama]) => (
                        <label key={tur} className="flex cursor-pointer items-start gap-2 text-xs text-sky-900">
                          <input type="radio" name={`resetTur-${k.id}`} checked={resetTur === tur}
                            onChange={() => setResetTur(tur)} className="mt-0.5" />
                          <span>
                            {baslik}
                            <span className="block text-[11px] leading-snug text-sky-700">{aciklama}</span>
                          </span>
                        </label>
                      ))}
                      {resetTur && (
                        <button type="button" onClick={() => setResetTur(null)}
                          className="justify-self-start px-1 py-1 text-xs font-bold text-sky-800 underline">
                          {t.wa.secimiKaldir}
                        </button>
                      )}
                    </div>
                  </div>

                  {hata && <p className="mt-2 text-sm text-red-700">{hata}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button"
                      onClick={() => gonder({ id: k.id, deviceId: dev, counterBlack: cb, counterColor: cc || 0, ...(resetTur ? { reset: true, resetTur } : {}) })}
                      disabled={mesgul === k.id || !dev || cb === ''}
                      className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                      {mesgul === k.id ? t.genel.kaydediliyor : t.sayacEposta.sayaciKaydet}
                    </button>
                    <button type="button" onClick={() => setAcik(null)}
                      className="rounded border bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      {t.genel.iptal}
                    </button>
                  </div>
                </div>
              ) : bekliyor && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => ac(k)}
                    className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">
                    {t.sayacEposta.elleIsle}
                  </button>
                  <button type="button" onClick={() => gonder({ id: k.id, yoksay: true })} disabled={mesgul === k.id}
                    className="rounded border bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                    {t.sayacEposta.ilgilenme}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
