'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

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
      if (!r.ok) { setHata(d.error || 'İşlem yapılamadı'); return; }
      if (d.uyari) alert('⚠️ ' + d.uyari);
      setAcik(null); yukle();
    } finally { setMesgul(null); }
  };

  const tarih = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
    d === 'OTOMATIK' ? 'otomatik' : d === 'DURDU' ? 'durdu' : 'kurulmadı';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cihazdan Gelen Sayaçlar</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Cihazlar sayaç raporunu e-postayla gönderir; sistem seri numarasını tanıdığında
            sayacı <b>kendiliğinden</b> işler. Tanıyamadıklarını aşağıda elle işlersiniz —
            böylece hiçbir sayaç kaybolmaz.
          </p>
        </div>
        <Link href="/sayac-turu" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Sayaç turu
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
                Otomatik gönderiyor
                {ozet.oran !== null && <span className="ml-1 text-gray-400">· %{ozet.oran}</span>}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className={`text-2xl font-bold tabular-nums ${ozet.durdu ? 'text-red-700' : ''}`}>{ozet.durdu}</div>
              <div className="text-sm text-gray-600">Gönderiyordu, durdu</div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-2xl font-bold tabular-nums">{ozet.kurulmadi}</div>
              <div className="text-sm text-gray-600">Hiç göndermedi</div>
            </div>
          </div>

          {ozet.durdu > 0 && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <b>{ozet.durdu} cihaz</b> daha önce otomatik gönderiyordu, artık göndermiyor.
              Bu cihazların sayacı son bilinen değerde duruyor; aradaki sayfalar faturaya girmiyor.
            </p>
          )}

          {ozet.otomatik === 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Hiçbir cihaz otomatik sayaç göndermiyor. Cihazın web arayüzünde e-posta/bildirim
              ayarlarına size özel adresi tanımlayınca sayaçlar kendiliğinden düşer —
              kimse gezmez, kimse fotoğraf beklemez.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {([
              ['IS', `Yapılacaklar (${ozet.durdu + ozet.kurulmadi})`],
              ['OTOMATIK', `Çalışanlar (${ozet.otomatik})`],
              ['HEPSI', `Hepsi (${ozet.toplam})`],
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
              Bu grupta cihaz yok.
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
                        <span>{f.aciklama}</span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${rozet(f.durum)}`}>
                      {rozetAd(f.durum)}
                    </span>
                    <Link href={`/devices/${f.deviceId}`}
                      className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
                      Cihaz kartı
                    </Link>
                  </li>
                ))}
              </ul>
              {filoListe.length > filoLimit && (
                <button type="button" onClick={() => setFiloLimit(n => n + LISTE_ADIMI)}
                  className="mt-3 rounded border px-3 py-2 text-sm hover:bg-gray-50">
                  {filoListe.length - filoLimit} cihaz daha göster
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* ── OKUNAMAYAN E-POSTALAR ────────────────────────────────────── */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Elle işlenecek e-postalar
          {bekleyen > 0 && (
            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              {bekleyen} bekliyor
            </span>
          )}
        </h2>
        <button type="button" onClick={() => setHepsi(!hepsi)}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          {hepsi ? 'Sadece bekleyenler' : 'Tümünü göster'}
        </button>
      </div>

      {yukleniyor && <p className="mt-4 text-sm text-gray-500">Yükleniyor…</p>}

      {!yukleniyor && items.length === 0 && (
        <div className="mt-4 rounded-lg border bg-white p-10 text-center">
          <div className="text-sm font-semibold text-gray-700">
            {hepsi ? 'Hiç e-posta yok' : 'Bekleyen yok'}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Elle işlenmesi gereken sayaç e-postası yok. Gelenler otomatik işleniyor.
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
                  {k.seri ? <>Seri: <code className="font-mono">{k.seri}</code></> : 'Seri tanınmadı'}
                  {k.durum === 'ISLENDI' && (
                    <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">işlendi</span>
                  )}
                  {k.durum === 'HATA' && (
                    <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">hata</span>
                  )}
                  {k.durum === 'ATLANDI' && (
                    <span className="ml-2 rounded-full border bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600">atlandı</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{tarih(k.tarih)}</div>
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {k.konu || '(konu yok)'}{k.gonderen ? ` · ${k.gonderen}` : ''}
                {(k.siyah != null || k.renkli != null) && (
                  <> · okunan: {k.siyah != null ? `S/B ${k.siyah.toLocaleString('tr-TR')}` : 'S/B —'}
                    {k.renkli != null ? ` · Renkli ${k.renkli.toLocaleString('tr-TR')}` : ''}</>
                )}
              </div>

              {k.hata && (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {k.hata}
                </div>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-500">E-posta içeriğini gör</summary>
                <div className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded border bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                  {k.onizleme}
                </div>
              </details>

              {acik === k.id ? (
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-semibold text-sky-900">Sayacı cihaza işle</div>
                  <select value={dev} onChange={e => setDev(e.target.value)}
                    className="mt-2 w-full rounded border px-3 py-2 text-sm">
                    <option value="">Cihaz seçin…</option>
                    {cihazlar.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.brand} {c.model} · {c.serialNo}{c.customer?.name ? ` — ${c.customer.name}` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="min-w-[130px] flex-1">
                      <label className="text-xs font-semibold text-sky-800">Siyah sayaç</label>
                      <input value={cb} onChange={e => setCb(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                    </div>
                    <div className="min-w-[130px] flex-1">
                      <label className="text-xs font-semibold text-sky-800">Renkli sayaç</label>
                      <input value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-bold text-sky-800">
                      Yeni değer eskisinden küçükse sebebini seçin
                    </div>
                    <div className="mt-1 grid gap-1">
                      {([
                        ['CIHAZ_DEGISTI', 'Cihaz değişti — başka makine takıldı', 'Yeni makinenin sayacı bu ayın kullanımı sayılmaz; buradan sonrası sayılır.'],
                        ['SAYAC_SIFIRLANDI', 'Aynı makine, sayacı sıfırlandı', 'Okunan değer bu ayın kullanımıdır ve faturalanır.'],
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
                          seçimi kaldır
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
                      {mesgul === k.id ? 'Kaydediliyor…' : 'Sayacı kaydet'}
                    </button>
                    <button type="button" onClick={() => setAcik(null)}
                      className="rounded border bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : bekliyor && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => ac(k)}
                    className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700">
                    Elle işle
                  </button>
                  <button type="button" onClick={() => gonder({ id: k.id, yoksay: true })} disabled={mesgul === k.id}
                    className="rounded border bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                    Bu sayaçla ilgilenme
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
