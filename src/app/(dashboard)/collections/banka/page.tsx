'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { icerir } from '@/lib/tr-katla';
import type { SatirSonucu, Kolonlar, Rol, Durum } from '@/lib/banka-ekstresi';

/**
 * ── BANKA EKSTRESİNDEN TOPLU TAHSİLAT ─────────────────────────────────────
 * Ay sonu 100 havaleyi Tahsilat ekranında tek tek girmek yerine: bankanın
 * dosyası yüklenir, sunucu gelen havaleleri müşterilere eşler, bayi seçer ve
 * onaylar. Ekran HİÇBİR satırı kendiliğinden kaydetmez; "Eşleşti" bile
 * yalnız işaretli gelir.
 *
 * Motor (lib/banka-ekstresi) sunucuda çalışır; buraya yalnız tipleri alınır.
 */

// Motorla aynı sıra; motor node:crypto kullandığı için buraya değer olarak alınmıyor.
const ROLLER: Rol[] = ['tarih', 'aciklama', 'tutar', 'alacak', 'borc', 'yon', 'gonderen', 'referans'];
const SIRA: Record<Durum, number> = { BELIRSIZ: 0, ESLESMEDI: 1, ONERI: 2, ESLESTI: 3, ISLENMIS: 4 };
const ROZET: Record<Durum, string> = {
  ESLESTI: 'bg-emerald-100 text-emerald-800',
  ONERI: 'bg-sky-100 text-sky-800',
  BELIRSIZ: 'bg-amber-100 text-amber-800',
  ESLESMEDI: 'bg-gray-100 text-gray-700',
  ISLENMIS: 'bg-gray-100 text-gray-500',
};

type Onizleme = {
  bicim: string;
  basliklar: string[];
  kolonlar: Kolonlar;
  ornek: string[][];
  giden: number;
  okunamayan: number[];
  satirlar: SatirSonucu[];
  musteriler: { id: string; ad: string; borc: number }[];
};
type Secim = { secili: boolean; musteriId: string | null };
type IslemSonucu = { iz: string; durum: string; tutar?: number; faturaya?: number; servise?: number; avans?: number };
type SonKayit = {
  id: string; tarih: string; tutar: number; musteriAd: string | null; customerId: string | null;
  faturaya: number; servise: number; avans: number; isleyen: string | null;
};

const bosKolonlar = (baslikSatiri = 0): Kolonlar =>
  ({ baslikSatiri, ...Object.fromEntries(ROLLER.map((r) => [r, -1])) }) as Kolonlar;

function MusteriSecici({
  musteriler, adaylar, deger, onSec, t,
}: {
  musteriler: { id: string; ad: string }[];
  adaylar: string[];
  deger: string | null;
  onSec: (id: string) => void;
  t: ReturnType<typeof useT>;
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState('');
  const adi = useMemo(() => new Map(musteriler.map((m) => [m.id, m.ad])), [musteriler]);
  const liste = useMemo(() => {
    if (!acik) return [];
    // Türkçe katlanarak: "adliye" yazan "ADLİYE"yi bulur.
    const aday = adaylar.map((id) => ({ id, ad: adi.get(id) ?? id }));
    const kalan = musteriler.filter((m) => !adaylar.includes(m.id) && icerir(m.ad, ara));
    return [...aday.filter((m) => icerir(m.ad, ara)), ...kalan].slice(0, 8);
  }, [acik, ara, adaylar, musteriler, adi]);

  return (
    <div className="relative min-w-[12rem]">
      {deger && !acik ? (
        <button type="button" onClick={() => setAcik(true)} className="text-left text-sm font-semibold text-gray-900 hover:underline">
          {adi.get(deger) ?? deger}
        </button>
      ) : (
        <>
          {!acik && adaylar.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {adaylar.slice(0, 4).map((id) => (
                <button key={id} type="button" onClick={() => onSec(id)}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100">
                  {adi.get(id) ?? id}
                </button>
              ))}
            </div>
          )}
          {acik ? (
            <input autoFocus value={ara} onChange={(e) => setAra(e.target.value)} onBlur={() => setTimeout(() => setAcik(false), 150)}
              placeholder={t.bankaEkstresi.musteriAra} className="w-full rounded border px-2 py-1 text-sm" />
          ) : (
            <button type="button" onClick={() => setAcik(true)} className="text-sm text-blue-700 hover:underline">{t.bankaEkstresi.musteriSec}</button>
          )}
        </>
      )}
      {acik && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg">
          {liste.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">{t.bankaEkstresi.bulunamadi}</div>
          ) : liste.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSec(m.id); setAcik(false); setAra(''); }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${adaylar.includes(m.id) ? 'font-semibold text-amber-900' : 'text-gray-800'}`}>
              {m.ad}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BankaEkstresiPage() {
  const t = useT();
  const b = useBicim();
  const s = t.bankaEkstresi;

  const [dosya, setDosya] = useState<File | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [ornek, setOrnek] = useState<string[][] | null>(null);
  const [kolonlar, setKolonlar] = useState<Kolonlar | null>(null);
  const [secim, setSecim] = useState<Record<string, Secim>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [sonuc, setSonuc] = useState<IslemSonucu[] | null>(null);
  const [son, setSon] = useState<SonKayit[] | null>(null);

  const sonuYukle = useCallback(() => {
    fetch('/api/collections/banka').then((r) => (r.ok ? r.json() : null)).then((d) => setSon(d?.kayitlar ?? [])).catch(() => setSon([]));
  }, []);
  useEffect(() => { sonuYukle(); }, [sonuYukle]);

  const hataMetni = (kod: string, n?: number) => {
    const sozluk = s.hata as Record<string, string>;
    return doldur(sozluk[kod] ?? s.hata.OKUNAMADI, { n: n ?? '' });
  };

  const oku = async (elle?: Kolonlar | null) => {
    if (!dosya) { setHata(s.hata.DOSYA_YOK); return; }
    setYukleniyor(true); setHata(null); setSonuc(null);
    try {
      const form = new FormData();
      form.append('dosya', dosya);
      if (elle) form.append('kolonlar', JSON.stringify(elle));
      const r = await fetch('/api/collections/banka/onizle', { method: 'POST', body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setOnizleme(null);
        setHata(d?.kod ? hataMetni(d.kod, d.n) : (d?.error ?? s.hata.OKUNAMADI));
        if (Array.isArray(d?.ornek)) {
          setOrnek(d.ornek);
          setKolonlar((k) => k ?? bosKolonlar(0));
        }
        return;
      }
      const o = d as Onizleme;
      setOnizleme(o);
      setOrnek(o.ornek);
      setKolonlar(o.kolonlar);
      setSecim(Object.fromEntries(o.satirlar.map((x) => [x.hareket.iz, { secili: x.secili, musteriId: x.musteriId }])));
    } catch {
      setHata(s.hata.BAGLANTI);
    } finally {
      setYukleniyor(false);
    }
  };

  const satirlar = useMemo(() => {
    if (!onizleme) return [];
    return [...onizleme.satirlar].sort((a, c) => SIRA[a.durum] - SIRA[c.durum] || a.hareket.tarih.localeCompare(c.hareket.tarih));
  }, [onizleme]);

  const secilenler = satirlar.filter((x) => x.durum !== 'ISLENMIS' && secim[x.hareket.iz]?.secili && secim[x.hareket.iz]?.musteriId);
  const seciliToplam = secilenler.reduce((t2, x) => t2 + x.hareket.tutar, 0);
  const sayac = useMemo(() => {
    const c: Record<Durum, number> = { ESLESTI: 0, ONERI: 0, BELIRSIZ: 0, ESLESMEDI: 0, ISLENMIS: 0 };
    for (const x of onizleme?.satirlar ?? []) c[x.durum]++;
    return c;
  }, [onizleme]);

  const sec = (iz: string, degisim: Partial<Secim>) => setSecim((m) => ({ ...m, [iz]: { ...(m[iz] ?? { secili: false, musteriId: null }), ...degisim } }));

  const hepsiniSec = () => setSecim((m) => {
    const y = { ...m };
    for (const x of satirlar) {
      if (x.durum === 'ESLESTI' && !x.elleGirilmisOlabilir && y[x.hareket.iz]?.musteriId) y[x.hareket.iz] = { ...y[x.hareket.iz], secili: true };
    }
    return y;
  });
  const hicbiri = () => setSecim((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, secili: false }])));

  const kaydet = async () => {
    if (!secilenler.length) { setHata(s.hata.SECIM_YOK); return; }
    if (!confirm(doldur(s.onay, { n: secilenler.length, tutar: b.para(seciliToplam) }))) return;
    setKaydediliyor(true); setHata(null);
    try {
      const r = await fetch('/api/collections/banka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satirlar: secilenler.map((x) => ({ hareket: x.hareket, musteriId: secim[x.hareket.iz].musteriId })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHata(d?.kod ? hataMetni(d.kod, d.n) : (d?.error ?? s.hata.BAGLANTI)); return; }
      const sonuclar: IslemSonucu[] = d.sonuclar ?? [];
      setSonuc(sonuclar);
      // İşlenen (ya da zaten işlenmiş) satırlar bu ekranda da kapanıyor: ikinci
      // tıklamada yeniden gönderilmesinler.
      const kapanan = new Set(sonuclar.filter((x) => x.durum === 'TAMAM' || x.durum === 'ISLENMIS').map((x) => x.iz));
      setOnizleme((o) => o && { ...o, satirlar: o.satirlar.map((x) => (kapanan.has(x.hareket.iz) ? { ...x, durum: 'ISLENMIS' as const, secili: false } : x)) });
      setSecim((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, kapanan.has(k) ? { ...v, secili: false } : v])));
      sonuYukle();
    } catch {
      setHata(s.hata.BAGLANTI);
    } finally {
      setKaydediliyor(false);
    }
  };

  const ozet = useMemo(() => {
    if (!sonuc) return null;
    const tamam = sonuc.filter((x) => x.durum === 'TAMAM');
    const topla = (k: 'tutar' | 'faturaya' | 'servise' | 'avans') => tamam.reduce((a, x) => a + (x[k] ?? 0), 0);
    return {
      tamam: tamam.length, tutar: topla('tutar'), faturaya: topla('faturaya'), servise: topla('servise'), avans: topla('avans'),
      islenmis: sonuc.filter((x) => x.durum === 'ISLENMIS').length,
      hata: sonuc.filter((x) => x.durum !== 'TAMAM' && x.durum !== 'ISLENMIS').length,
    };
  }, [sonuc]);

  const musteriHaritasi = useMemo(() => new Map((onizleme?.musteriler ?? []).map((m) => [m.id, m])), [onizleme]);
  const basliklar = onizleme?.basliklar ?? (ornek && kolonlar ? ornek[kolonlar.baslikSatiri] ?? [] : []);
  const tarihGoster = (d: string) => b.tarih(`${d.slice(0, 10)}T12:00:00`);

  return (
    <div className="mx-auto max-w-6xl p-6 pb-16">
      <Link href="/collections" className="text-sm text-blue-700 hover:underline">{s.geri}</Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{s.baslik}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-gray-500">{s.alt}</p>

      {/* Dosya */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.xls,.csv,.txt,.xml,.htm,.html"
            onChange={(e) => { setDosya(e.target.files?.[0] ?? null); setOnizleme(null); setOrnek(null); setKolonlar(null); setSonuc(null); setHata(null); }}
            className="text-sm" />
          <button type="button" onClick={() => oku(null)} disabled={!dosya || yukleniyor}
            className="rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {yukleniyor ? s.okunuyor : s.oku}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{s.dosyaNot}</p>
        <details className="mt-3 text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">{s.nasil}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.nasilMaddeler.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <p className="mt-2">{s.paraNereye}</p>
        </details>
      </div>

      {hata && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{hata}</div>}

      {/* Kolonlar */}
      {kolonlar && ornek && (
        <details open={!onizleme} className="mt-4 rounded-xl border bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">
            {s.kolonBaslik}
            {onizleme && (
              <span className="ml-2 font-normal text-gray-500">
                {ROLLER.filter((r) => kolonlar[r] >= 0).map((r) => `${s.rol[r]}: ${basliklar[kolonlar[r]] ?? '?'}`).join(' · ')}
              </span>
            )}
          </summary>
          <p className="mt-1 text-xs text-gray-500">{s.kolonAlt}</p>
          {!onizleme && (
            <div className="mt-3 overflow-x-auto">
              <table className="text-xs">
                <tbody>
                  {ornek.slice(0, 12).map((satir, i) => (
                    <tr key={i} className={i === kolonlar.baslikSatiri ? 'bg-blue-50 font-semibold' : ''}>
                      <td className="pr-2 text-gray-400">{i + 1}</td>
                      {satir.slice(0, 10).map((h, j) => <td key={j} className="max-w-[10rem] truncate border px-1.5 py-0.5">{h}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <label className="text-xs text-gray-600">
              {s.baslikSatiri}
              <input type="number" min={1} max={ornek.length} value={kolonlar.baslikSatiri + 1}
                onChange={(e) => setKolonlar({ ...kolonlar, baslikSatiri: Math.max(0, Math.min(ornek.length - 1, Number(e.target.value) - 1)) })}
                className="mt-1 block w-full rounded border px-2 py-1 text-sm" />
            </label>
            {ROLLER.map((r) => (
              <label key={r} className="text-xs text-gray-600">
                {s.rol[r]}
                <select value={kolonlar[r]} onChange={(e) => setKolonlar({ ...kolonlar, [r]: Number(e.target.value) })}
                  className="mt-1 block w-full rounded border px-2 py-1 text-sm">
                  <option value={-1}>{s.kolonYok}</option>
                  {(ornek[kolonlar.baslikSatiri] ?? []).map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => oku(kolonlar)} disabled={yukleniyor}
            className="mt-3 rounded-lg border border-[#0f2253] px-3 py-1.5 text-sm font-semibold text-[#0f2253] disabled:opacity-50">
            {s.yenidenOku}
          </button>
        </details>
      )}

      {/* Sonuç */}
      {ozet && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {ozet.tamam > 0 && <p className="font-semibold">{doldur(s.sonucTamam, { n: ozet.tamam, tutar: b.para(ozet.tutar) })}</p>}
          {ozet.tamam > 0 && <p>{doldur(s.sonucDagilim, { fatura: b.para(ozet.faturaya), servis: b.para(ozet.servise), avans: b.para(ozet.avans) })}</p>}
          {ozet.islenmis > 0 && <p className="text-gray-700">{doldur(s.sonucIslenmis, { n: ozet.islenmis })}</p>}
          {ozet.hata > 0 && <p className="text-red-700">{doldur(s.sonucHata, { n: ozet.hata })}</p>}
        </div>
      )}

      {/* Hareketler */}
      {onizleme && (
        <div className="mt-4 rounded-xl border bg-white">
          {/* Kaydet çubuğu tablonun ÜSTÜNDE ve yapışık: altta sabit dururken yan
              menünün ve yardım düğmesinin altında kalıyordu. */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-xl border-b bg-white px-4 py-3">
            <span className="text-sm text-gray-700">{doldur(s.secili, { n: secilenler.length, tutar: b.para(seciliToplam) })}</span>
            <button type="button" onClick={kaydet} disabled={kaydediliyor || secilenler.length === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {kaydediliyor ? s.kaydediliyor : doldur(s.kaydet, { n: secilenler.length })}
            </button>
            <span className="ml-auto flex gap-3">
              <button type="button" onClick={hepsiniSec} className="text-xs text-blue-700 hover:underline">{s.hepsiniSec}</button>
              <button type="button" onClick={hicbiri} className="text-xs text-gray-600 hover:underline">{s.hicbiri}</button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
            <b className="text-gray-900">{doldur(s.ozet, { n: onizleme.satirlar.length })}</b>
            {(Object.keys(sayac) as Durum[]).filter((d) => sayac[d] > 0).map((d) => (
              <span key={d} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROZET[d]}`}>{s.durum[d]}: {sayac[d]}</span>
            ))}
            {onizleme.giden > 0 && <span className="text-xs text-gray-500">{doldur(s.ozetGiden, { n: onizleme.giden })}</span>}
            {onizleme.okunamayan.length > 0 && (
              <span className="text-xs text-amber-700">
                {doldur(s.ozetOkunamayan, { n: onizleme.okunamayan.length, liste: onizleme.okunamayan.slice(0, 8).join(', ') })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">{s.sutunTarih}</th>
                  <th className="px-3 py-2 text-right">{s.sutunTutar}</th>
                  <th className="px-3 py-2">{s.sutunAciklama}</th>
                  <th className="px-3 py-2">{s.sutunMusteri}</th>
                  <th className="px-3 py-2">{s.sutunDurum}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {satirlar.map((x) => {
                  const h = x.hareket;
                  const sc = secim[h.iz] ?? { secili: false, musteriId: null };
                  const kapali = x.durum === 'ISLENMIS';
                  const metin = [h.gonderen, h.aciklama, h.referans].filter(Boolean).join(' · ');
                  return (
                    <tr key={h.iz} className={kapali ? 'bg-gray-50 text-gray-500' : sc.secili ? 'bg-emerald-50/40' : ''}>
                      <td className="px-3 py-2 align-top">
                        <input type="checkbox" checked={!kapali && sc.secili} disabled={kapali || !sc.musteriId}
                          onChange={(e) => sec(h.iz, { secili: e.target.checked })} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">{tarihGoster(h.tarih)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold">{b.para(h.tutar)}</td>
                      <td className="max-w-md px-3 py-2 align-top">
                        <div className="line-clamp-2 text-gray-700" title={metin}>{metin}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {kapali ? (musteriHaritasi.get(sc.musteriId ?? x.musteriId ?? '')?.ad ?? '') : (
                          <>
                            <MusteriSecici t={t} musteriler={onizleme.musteriler} adaylar={x.adaylar} deger={sc.musteriId}
                              onSec={(id) => sec(h.iz, { musteriId: id, secili: true })} />
                            {sc.musteriId && (() => {
                              const borc = musteriHaritasi.get(sc.musteriId)?.borc ?? 0;
                              return borc > 0.004
                                ? <div className="mt-1 text-xs text-gray-600">{doldur(s.borc, { n: b.para(borc) })}</div>
                                : <div className="mt-1 max-w-[14rem] text-xs text-amber-700">{s.borcYok}</div>;
                            })()}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {!kapali && sc.musteriId && sc.musteriId !== x.musteriId ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">{s.elleSecildi}</span>
                        ) : (
                          <>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROZET[x.durum]}`}>{s.durum[x.durum]}</span>
                            {x.neden && !kapali && <span className="ml-1 text-xs text-gray-500">{s.neden[x.neden]}</span>}
                          </>
                        )}
                        {x.tutarTutuyor && !kapali && <div className="mt-1 text-xs text-emerald-700">✓ {s.tutarTutuyor}</div>}
                        {x.elleGirilmisOlabilir && !kapali && <div className="mt-1 max-w-[14rem] text-xs text-amber-700">⚠ {s.elleGirilmis}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Son işlenenler */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">{s.sonIslenenler}</h2>
        {son === null ? null : son.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{s.sonYok}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{s.sonBankaTarihi}</th>
                  <th className="px-3 py-2">{s.sutunMusteri}</th>
                  <th className="px-3 py-2 text-right">{s.sutunTutar}</th>
                  <th className="px-3 py-2">{s.sonDagilim}</th>
                  <th className="px-3 py-2">{s.sonIsleyen}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {son.map((k) => (
                  <tr key={k.id}>
                    <td className="whitespace-nowrap px-3 py-2">{tarihGoster(k.tarih)}</td>
                    <td className="px-3 py-2">
                      {k.customerId ? <Link href={`/customers/${k.customerId}`} className="text-blue-700 hover:underline">{k.musteriAd}</Link> : k.musteriAd}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{b.para(k.tutar)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {doldur(s.dagilimKisa, { fatura: b.para(k.faturaya), servis: b.para(k.servise), avans: b.para(k.avans) })}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{k.isleyen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
